import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { QUIZ_QUESTIONS, ZONE_COLORS } from '../../lib/quizQuestions'
import { getZoneForPosition } from '../../lib/arena/physics'
import Arena from '../arena/Arena'
import QuizZones from '../arena/QuizZones'

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
    const ch = supabase.channel(`quiz:${room.id}`, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'quiz-pos' }, ({ payload }) => {
      if (payload?.playerId) {
        reportedPositionsRef.current.set(payload.playerId, { x: payload.x, y: payload.y })
      }
    })
    ch.subscribe()
    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [room.id])
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealedAnswer, setRevealedAnswer] = useState(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [revealStats, setRevealStats] = useState(null) // { survived, eliminated }

  const questionIndex = room.current_round - 1
  const question = QUIZ_QUESTIONS[questionIndex] ?? null
  const isLastQuestion = questionIndex >= QUIZ_QUESTIONS.length - 1
  const alivePlayers = useMemo(() => players.filter((p) => p.is_alive), [players])

  const allRevealed = revealedAnswer !== null

  async function handleReveal() {
    if (isRevealing || !question) return
    setIsRevealing(true)

    const correctAnswer = question.correct
    const aliveSnapshot = [...alivePlayers]

    // Clear previously reported positions and broadcast reveal to mobile clients.
    // Each mobile client will respond with their exact position (quiz-pos event).
    reportedPositionsRef.current.clear()
    setRevealedAnswer(correctAnswer)
    channelRef.current?.send({
      type: 'broadcast', event: 'quiz-reveal',
      payload: { correct: correctAnswer, round: room.current_round },
    })

    // Wait for mobile clients to report their positions + animation time
    await new Promise((r) => setTimeout(r, 2000))

    // Use positions reported by mobile clients (exact, no lag).
    // Fall back to host's broadcast-target positions if a client didn't report.
    const hostSnapshot = new Map(arenaRef.current)
    const eliminatedIds = []

    for (const p of aliveSnapshot) {
      const pos = reportedPositionsRef.current.get(p.id) ?? hostSnapshot.get(p.id)
      if (!pos) {
        eliminatedIds.push(p.id)
        continue
      }
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

    setIsRevealing(false)
  }

  async function handleNextQuestion() {
    if (isAdvancing) return
    setIsAdvancing(true)

    const { error } = await supabase
      .from('rooms')
      .update({ current_round: room.current_round + 1 })
      .eq('id', room.id)

    if (!error) {
      setRevealedAnswer(null)
      setRevealStats(null)
      reportedPositionsRef.current.clear()
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
                / {QUIZ_QUESTIONS.length}
              </span>
            </h2>
            <p className="font-body text-sm mt-1" style={{ color: 'var(--cream-400)' }}>
              {alivePlayers.length} player{alivePlayers.length !== 1 ? 's' : ''} remaining
            </p>
          </div>

          {/* Action button */}
          <div className="flex gap-3">
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
