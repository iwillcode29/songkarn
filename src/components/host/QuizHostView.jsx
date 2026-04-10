import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { getQuizQuestions, ZONE_COLORS } from '../../lib/quizQuestions'
import { getZoneForPosition } from '../../lib/arena/physics'
import { useCountdown } from '../../hooks/useCountdown'
import { sfx } from '../../lib/sfx'
import Arena from '../arena/Arena'
import QuizZones from '../arena/QuizZones'
import CountdownRing from '../ui/CountdownRing'

/**
 * Host view for quiz mode. Shows the arena with 4 zones,
 * the current question, and a reveal button.
 *
 * Positions are snapshot'd at the moment the host clicks "Reveal"
 * so players cannot reposition after seeing the correct answer.
 * Broadcasts reveal/next events so mobile clients can show results.
 */
export default function QuizHostView({ room, players }) {
  const arenaRef = useRef(new Map())
  const channelRef = useRef(null)
  const reportedPositionsRef = useRef(new Map()) // positions reported by mobile clients on reveal

  // Quiz broadcast channel — host sends reveal/next events to mobile clients
  useEffect(() => {
    let destroyed = false
    let ch = null

    function createChannel() {
      ch = supabase.channel(`quiz:${room.id}`, { config: { broadcast: { self: false } } })
      ch.on('broadcast', { event: 'quiz-pos' }, ({ payload }) => {
        if (payload?.playerId) {
          reportedPositionsRef.current.set(payload.playerId, { x: payload.x, y: payload.y })
        }
      })
      ch.subscribe((status) => {
        if (destroyed) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.removeChannel(ch)
          setTimeout(() => { if (!destroyed) createChannel() }, 1000)
        }
      })
      channelRef.current = ch
    }

    createChannel()
    return () => {
      destroyed = true
      if (ch) supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [room.id])
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealedAnswer, setRevealedAnswer] = useState(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [revealStats, setRevealStats] = useState(null) // { correct, wrong }

  // Reset reveal state when room advances to a new round.
  // This avoids the race where local state resets before the fresh
  // question_started_at arrives via realtime, which caused the old
  // (expired) timestamp to auto-reveal the next question immediately.
  useEffect(() => {
    setRevealedAnswer(null)
    setRevealStats(null)
    reportedPositionsRef.current.clear()
  }, [room.current_round])

  const questions = useMemo(() => getQuizQuestions(room.id, room.quiz_seed, room.quiz_category), [room.id, room.quiz_seed, room.quiz_category])
  const questionIndex = room.current_round - 1
  const question = questions[questionIndex] ?? null
  const isLastQuestion = questionIndex >= questions.length - 1
  const sortedByScore = useMemo(() => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [players])

  const allRevealed = revealedAnswer !== null

  // ── 15-second countdown per question ──
  const { secondsLeft, isExpired } = useCountdown(
    allRevealed ? null : room.question_started_at,
    15,
  )
  const revealingRef = useRef(false) // synchronous guard against double-tap

  // Audio beep for last 3 seconds
  useEffect(() => {
    if (!allRevealed && secondsLeft <= 3 && secondsLeft > 0) {
      sfx.countdown(secondsLeft)
    }
  }, [secondsLeft, allRevealed])

  // Auto-reveal when countdown expires (guard against empty players on host refresh)
  const handleRevealRef = useRef(null)
  useEffect(() => {
    if (isExpired && !allRevealed && !revealingRef.current && players.length > 0) {
      handleRevealRef.current?.()
    }
  }, [isExpired, allRevealed, players.length])

  const handleReveal = useCallback(async () => {
    if (revealingRef.current || isRevealing || !question) return
    revealingRef.current = true
    setIsRevealing(true)

    try {
      const correctAnswer = question.correct
      const playersSnapshot = [...players]

      // Clear previously reported positions and broadcast reveal to mobile clients.
      reportedPositionsRef.current.clear()
      setRevealedAnswer(correctAnswer)
      const revealPayload = {
        type: 'broadcast', event: 'quiz-reveal',
        payload: { correct: correctAnswer, round: room.current_round },
      }
      if (channelRef.current?.state === 'joined') {
        channelRef.current.send(revealPayload)
      } else {
        await new Promise((r) => setTimeout(r, 1500))
        channelRef.current?.send(revealPayload)
      }

      // Wait for mobile clients to report their positions.
      await new Promise((r) => setTimeout(r, 4000))

      // Determine who was in the correct zone → +1 score
      const hostSnapshot = new Map(arenaRef.current)
      const correctIds = []
      let noData = 0

      for (const p of playersSnapshot) {
        const pos = reportedPositionsRef.current.get(p.id) ?? hostSnapshot.get(p.id)
        if (!pos) { noData++; continue }
        const zone = getZoneForPosition(pos.x, pos.y)
        if (zone === correctAnswer) {
          correctIds.push(p.id)
        }
      }

      // Atomic score increment — try RPC first, fall back to individual updates
      if (correctIds.length > 0) {
        const { error: rpcError } = await supabase.rpc('increment_score', { player_ids: correctIds })
        if (rpcError) {
          // Fallback: individual updates (less atomic but works without RPC)
          await Promise.all(
            correctIds.map((id) => {
              const current = playersSnapshot.find((p) => p.id === id)
              return supabase.from('players').update({ score: (current?.score ?? 0) + 1 }).eq('id', id)
            }),
          )
        }
      }

      const answeredCount = playersSnapshot.length - noData
      setRevealStats({ correct: correctIds.length, wrong: answeredCount - correctIds.length })

      // End game after last question
      if (isLastQuestion) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
      }
    } finally {
      setIsRevealing(false)
      revealingRef.current = false
    }
  }, [isRevealing, question, players, room.current_round, isLastQuestion, room.id])

  // Keep ref current so auto-reveal effect always calls the latest closure
  useEffect(() => { handleRevealRef.current = handleReveal }, [handleReveal])

  async function handleNextQuestion() {
    if (isAdvancing) return
    setIsAdvancing(true)

    const { error } = await supabase
      .from('rooms')
      .update({ current_round: room.current_round + 1, question_started_at: new Date().toISOString() })
      .eq('id', room.id)

    if (!error) {
      // State reset handled by useEffect on room.current_round
      channelRef.current?.send({
        type: 'broadcast', event: 'quiz-next',
        payload: { round: room.current_round + 1 },
      })
    }
    setIsAdvancing(false)
  }

  const quizOverlay = (
    <QuizZones question={question} revealedAnswer={revealedAnswer} />
  )

  return (
    <div className="sk-bg p-6 lg:p-8 overflow-hidden">
      {/* Flash on reveal */}
      <AnimatePresence>
        {isRevealing && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0.5, 0] }}
            transition={{ duration: 1.2, times: [0, 0.1, 0.5, 1] }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: 'radial-gradient(circle, rgba(232,184,74,0.4), transparent)' }}
          />
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-4 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl lg:text-4xl font-black" style={{ color: 'var(--cream-50)' }}>
              Question <span className="sk-gold-text">{room.current_round}</span>
              <span className="text-lg font-normal ml-2" style={{ color: 'var(--cream-400)' }}>
                / {questions.length}
              </span>
            </h2>
            <p className="font-body text-sm mt-1" style={{ color: 'var(--cream-400)' }}>
              {players.length} player{players.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Action button + countdown */}
          <div className="flex items-center gap-3">
            {!allRevealed && <CountdownRing secondsLeft={secondsLeft} total={15} size={56} />}
            <AnimatePresence mode="wait">
              {!allRevealed && (
                <motion.button
                  key="reveal"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReveal}
                  disabled={isRevealing}
                  className="px-8 py-4 font-black text-xl rounded-2xl disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))',
                    color: 'var(--twilight-950)',
                    boxShadow: '0 8px 24px rgba(232,184,74,0.25)',
                  }}
                >
                  {isRevealing ? 'Revealing...' : 'REVEAL!'}
                </motion.button>
              )}

              {allRevealed && !isRevealing && room.status === 'playing' && !isLastQuestion && (
                <motion.button
                  key="next"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNextQuestion}
                  disabled={isAdvancing}
                  className="px-8 py-4 font-black text-xl rounded-2xl disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--water-400), var(--water-600))',
                    color: 'var(--cream-50)',
                    boxShadow: '0 8px 24px rgba(74,184,212,0.2)',
                  }}
                >
                  {isAdvancing ? 'Loading...' : 'Next Question →'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Question card */}
        {question && (
          <motion.div
            key={questionIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="sk-surface sk-border-top rounded-2xl p-6"
          >
            <p
              className="text-2xl lg:text-3xl font-bold leading-snug"
              style={{ color: 'var(--cream-50)' }}
            >
              {question.question}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {['a', 'b', 'c', 'd'].map((key) => {
                const color = ZONE_COLORS[key]
                const isCorrect = revealedAnswer === key
                const isWrong = revealedAnswer && revealedAnswer !== key
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all"
                    style={{
                      background: isCorrect
                        ? 'rgba(34,197,94,0.15)'
                        : isWrong
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.04)',
                      border: isCorrect
                        ? '1px solid rgba(34,197,94,0.4)'
                        : `1px solid ${isWrong ? 'rgba(255,255,255,0.04)' : color.border}`,
                      opacity: isWrong ? 0.4 : 1,
                    }}
                  >
                    <span
                      className="font-black text-lg w-8 text-center"
                      style={{ color: isCorrect ? '#22c55e' : color.text }}
                    >
                      {key.toUpperCase()}
                    </span>
                    <span
                      className="font-body text-sm"
                      style={{ color: isCorrect ? '#bbf7d0' : 'var(--cream-200)' }}
                    >
                      {question[key]}
                    </span>
                    {isCorrect && <span className="ml-auto">✅</span>}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Result summary after reveal */}
        <AnimatePresence>
          {revealStats && !isRevealing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-2"
            >
              <p className="font-bold" style={{ color: 'var(--water-300)' }}>
                {revealStats.correct} correct — {revealStats.wrong} wrong
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arena + Leaderboard side by side */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 max-w-3xl">
            <Arena
              roomId={room.id}
              playerId={null}
              players={players}
              joystickRef={null}
              quizOverlay={quizOverlay}
              positionsMapRef={arenaRef}
            />
          </div>

          {/* Leaderboard */}
          <div className="w-56 flex-shrink-0 sk-surface sk-border-top rounded-2xl p-4">
            <p className="font-black text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--gold-400)' }}>
              Leaderboard
            </p>
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {sortedByScore.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="flex items-center gap-2 rounded-lg py-1.5 px-2"
                    style={{
                      background: i === 0 && (p.score ?? 0) > 0
                        ? 'rgba(232,184,74,0.1)'
                        : 'rgba(255,255,255,0.03)',
                      border: i === 0 && (p.score ?? 0) > 0
                        ? '1px solid rgba(232,184,74,0.2)'
                        : '1px solid transparent',
                    }}
                  >
                    <span
                      className="font-black text-xs w-5 text-center flex-shrink-0"
                      style={{ color: i < 3 ? 'var(--gold-400)' : 'var(--cream-400)' }}
                    >
                      {i + 1}
                    </span>
                    <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                    <span
                      className="font-medium text-sm truncate"
                      style={{ color: 'var(--cream-100)' }}
                    >
                      {p.name}
                    </span>
                    <span
                      className="ml-auto font-black text-sm flex-shrink-0"
                      style={{ color: 'var(--gold-400)' }}
                    >
                      {p.score ?? 0}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
