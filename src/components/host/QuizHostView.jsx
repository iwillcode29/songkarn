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
  const [revealStats, setRevealStats] = useState(null) // { survived, eliminated }

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
  const alivePlayers = useMemo(() => players.filter((p) => p.is_alive), [players])

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
    if (isExpired && !allRevealed && !revealingRef.current && alivePlayers.length > 0) {
      handleRevealRef.current?.()
    }
  }, [isExpired, allRevealed, alivePlayers.length])

  const handleReveal = useCallback(async () => {
    if (revealingRef.current || isRevealing || !question) return
    revealingRef.current = true
    setIsRevealing(true)

    try {
      const correctAnswer = question.correct
      const aliveSnapshot = [...alivePlayers]

      // Clear previously reported positions and broadcast reveal to mobile clients.
      // Each mobile client will respond with their exact position (quiz-pos event).
      reportedPositionsRef.current.clear()
      setRevealedAnswer(correctAnswer)
      // Retry send if channel is reconnecting (e.g. after CHANNEL_ERROR recovery)
      const revealPayload = {
        type: 'broadcast', event: 'quiz-reveal',
        payload: { correct: correctAnswer, round: room.current_round },
      }
      if (channelRef.current?.state === 'joined') {
        channelRef.current.send(revealPayload)
      } else {
        // Channel not ready — wait briefly and retry once
        await new Promise((r) => setTimeout(r, 1500))
        channelRef.current?.send(revealPayload)
      }

      // Wait for mobile clients to report their positions + animation time.
      // 4s gives enough time for slow party WiFi round-trips.
      await new Promise((r) => setTimeout(r, 4000))

      // Use positions reported by mobile clients (exact, no lag).
      // Fall back to host's broadcast-target positions if a client didn't report.
      // Players with no position at all are NOT eliminated — skip them gracefully.
      const hostSnapshot = new Map(arenaRef.current)
      const eliminatedIds = []

      for (const p of aliveSnapshot) {
        const pos = reportedPositionsRef.current.get(p.id) ?? hostSnapshot.get(p.id)
        if (!pos) continue // no position data — don't punish for connectivity
        const zone = getZoneForPosition(pos.x, pos.y)
        if (zone !== correctAnswer) {
          eliminatedIds.push(p.id)
        }
      }

      // Eliminate wrong players
      if (eliminatedIds.length > 0) {
        await supabase.from('players').update({ is_alive: false }).in('id', eliminatedIds)
      }

      const survivorCount = aliveSnapshot.length - eliminatedIds.length
      setRevealStats({ survived: survivorCount, eliminated: eliminatedIds.length })

      // End game if no survivors or last question
      if (survivorCount <= 0 || isLastQuestion) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
      }
    } finally {
      setIsRevealing(false)
      revealingRef.current = false
    }
  }, [isRevealing, question, alivePlayers, room.current_round, isLastQuestion, room.id])

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
              {alivePlayers.length} player{alivePlayers.length !== 1 ? 's' : ''} remaining
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

              {allRevealed && !isRevealing && room.status === 'playing' && !isLastQuestion && revealStats?.survived > 0 && (
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
                {revealStats.survived} survived — {revealStats.eliminated} eliminated
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arena with zones */}
        <Arena
          roomId={room.id}
          playerId={null}
          players={alivePlayers}
          joystickRef={null}
          quizOverlay={quizOverlay}
          positionsMapRef={arenaRef}
        />
      </div>
    </div>
  )
}
