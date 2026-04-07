import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useRoom } from '../hooks/useRoom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { useReconnect } from '../hooks/useReconnect'
import { sfx } from '../lib/sfx'
import { WEAPONS } from '../lib/gameLogic'
import { getQuizQuestions, ZONE_COLORS } from '../lib/quizQuestions'
import { getZoneForPosition } from '../lib/arena/physics'
import JoinForm from '../components/mobile/JoinForm'
import PickScreen from '../components/mobile/PickScreen'
import MobileChampionScreen from '../components/mobile/MobileChampionScreen'
import Arena from '../components/arena/Arena'
import QuizZones from '../components/arena/QuizZones'
import Joystick from '../components/arena/Joystick'
import { useKeyboard } from '../hooks/useKeyboard'

/**
 * JoinPage drives the entire mobile player experience.
 *
 * Phase state machine (derived — never stored explicitly):
 *
 *  'invalid'         — room doesn't exist or is closed
 *  'joining'         — no player ID yet, show name form
 *  'lobby_wait'      — joined, waiting for host to start
 *  'bye'             — got a bye this round, auto-advance
 *  'picking'         — pick weapon screen
 *  'choice_locked'   — waiting for reveal after locking in choice
 *  'round_won'       — won this round, waiting for next round
 *  'round_draw'      — this match was a draw, rematch incoming
 *  'eliminated'      — knocked out of tournament
 *  'champion'        — last player standing
 */
export default function JoinPage() {
  const { roomId } = useParams()

  const [playerId, setPlayerId] = useState(
    () => localStorage.getItem(`songkran_player_${roomId}`) ?? null,
  )

  const joystickRef = useRef({ dx: 0, dy: 0 })
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  useKeyboard(joystickRef)

  // Mobile screen shake on self-hit — seed counter forces CSS animation restart
  const [shakeSeed, setShakeSeed] = useState(0)
  const handleSelfHit = useCallback(() => {
    navigator.vibrate?.(50)
    setShakeSeed(s => s + 1)
  }, [])

  // Quiz reveal state — set by host broadcast
  const [quizReveal, setQuizReveal] = useState(null) // 'a'|'b'|'c'|'d' or null

  const myPositionRef = useRef(null) // Arena writes player's own position here
  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId

  // Quiz broadcast channel — stable per roomId (reads playerId from ref, not closure)
  const quizChRef = useRef(null) // always points to the live quiz channel
  useEffect(() => {
    if (!roomId) return
    let ch = null
    let destroyed = false

    function createChannel() {
      ch = supabase.channel(`quiz:${roomId}`, { config: { broadcast: { self: false } } })
      quizChRef.current = ch
      ch.on('broadcast', { event: 'quiz-reveal' }, ({ payload }) => {
        if (payload?.correct) {
          setQuizReveal(payload.correct)
          const pid = playerIdRef.current
          if (pid && myPositionRef.current) {
            const pos = myPositionRef.current
            // Use ref to always send via the live channel (not a stale closure)
            quizChRef.current?.send({
              type: 'broadcast', event: 'quiz-pos',
              payload: { playerId: pid, x: pos.x, y: pos.y },
            })
          }
        }
      })
      ch.on('broadcast', { event: 'quiz-next' }, () => {
        setQuizReveal(null)
      })
      ch.subscribe((status) => {
        if (destroyed) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Tear down and retry after a short delay
          supabase.removeChannel(ch)
          setTimeout(() => { if (!destroyed) createChannel() }, 1000)
        }
      })
    }

    createChannel()
    return () => {
      destroyed = true
      if (ch) supabase.removeChannel(ch)
    }
  }, [roomId])

  const { room, loading: roomLoading, refetch: refetchRoom } = useRoom(roomId)
  const { players, refetch: refetchPlayers } = usePlayers(roomId)
  const { matches, refetch: refetchMatches } = useMatches(roomId)

  const { isReconnecting } = useReconnect(
    useCallback(
      () => Promise.all([refetchRoom(), refetchPlayers(), refetchMatches()]),
      [refetchRoom, refetchPlayers, refetchMatches],
    ),
  )

  // Clear stale quiz reveal when room resets to lobby (play again)
  useEffect(() => {
    if (room && room.status === 'lobby') setQuizReveal(null)
  }, [room?.status])

  const myPlayer = useMemo(
    () => players.find((p) => p.id === playerId),
    [players, playerId],
  )

  const myCurrentMatch = useMemo(() => {
    if (!room || !playerId) return null
    return matches.find(
      (m) =>
        m.round_number === room.current_round &&
        (m.player1_id === playerId || m.player2_id === playerId),
    )
  }, [matches, room, playerId])

  const isQuiz = room?.game_mode === 'quiz'
  const questions = useMemo(() => roomId ? getQuizQuestions(roomId) : [], [roomId])

  // Unlock SFX on first touch interaction (JoinForm submit)
  useEffect(() => {
    function handleTouch() { sfx.unlock() }
    document.addEventListener('pointerdown', handleTouch, { once: true })
    return () => document.removeEventListener('pointerdown', handleTouch)
  }, [])

  const phase = useMemo(() => {
    if (roomLoading) return 'loading'
    if (!room) return 'invalid'
    if (room.status === 'finished') {
      return myPlayer?.is_alive ? 'champion' : 'eliminated'
    }
    if (!playerId || !myPlayer) {
      if (room.status !== 'lobby') return 'invalid'
      return 'joining'
    }
    if (room.status === 'lobby') return 'lobby_wait'

    // Quiz mode: playing = quiz_playing, eliminated = eliminated
    if (room.game_mode === 'quiz') {
      if (!myPlayer.is_alive) return 'eliminated'
      return 'quiz_playing'
    }

    // Bracket mode
    if (!myCurrentMatch) return 'lobby_wait'

    if (myCurrentMatch.is_bye) return 'bye'

    const isP1 = myCurrentMatch.player1_id === playerId
    const myChoice = isP1 ? myCurrentMatch.p1_choice : myCurrentMatch.p2_choice

    if (myCurrentMatch.status === 'waiting') {
      return myChoice ? 'choice_locked' : 'picking'
    }

    if (!myPlayer.is_alive) return 'eliminated'
    if (myCurrentMatch.winner_id === playerId) return 'round_won'
    if (myCurrentMatch.winner_id === null) return 'round_draw'

    return 'eliminated'
  }, [roomLoading, room, playerId, myPlayer, myCurrentMatch])

  // ── Rendering ────────────────────────────────────────────────

  const reconnectBanner = isReconnecting && (
    <div
      className="fixed top-0 left-0 right-0 z-50 text-center text-xs font-semibold py-1.5"
      style={{
        background: 'rgba(232,184,74,0.15)',
        color: 'var(--gold-400)',
        borderBottom: '1px solid rgba(232,184,74,0.2)',
      }}
    >
      Reconnecting...
    </div>
  )

  if (phase === 'loading') return <FullScreenMessage emoji="⏳" text="Loading…" />
  if (phase === 'invalid') {
    return (
      <FullScreenMessage
        emoji="🚫"
        text="Room not found or game already started."
        sub="Ask the host for a new room code."
      />
    )
  }
  if (phase === 'joining') return <JoinForm roomId={roomId} onJoined={setPlayerId} />
  if (phase === 'champion') return <>{reconnectBanner}<MobileChampionScreen player={myPlayer} /></>

  // ── Phases that use the Arena (lobby_wait + quiz_playing) ──
  // A SINGLE Arena instance persists across lobby→quiz transition.
  // No unmount/remount = no channel reconnect.
  const showArena = phase === 'lobby_wait' || phase === 'quiz_playing'

  const questionIndex = (room?.current_round ?? 1) - 1
  const question = isQuiz ? (questions[questionIndex] ?? null) : null
  const quizOverlay = phase === 'quiz_playing' ? <QuizZones question={question} revealedAnswer={quizReveal} /> : null

  // In quiz mode, show only alive players; in lobby, show all
  const arenaPlayers = phase === 'quiz_playing' ? players.filter((p) => p.is_alive) : players

  return (
    <div className="sk-bg-fixed flex flex-col items-center justify-center px-5 py-4">
      {reconnectBanner}

      {/* ── Quiz question card (only in quiz_playing) ── */}
      {phase === 'quiz_playing' && question && (
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm mb-2 flex-shrink-0"
        >
          <p className="text-xs font-body mb-1" style={{ color: 'var(--cream-400)' }}>
            Question {room.current_round} / {questions.length}
          </p>
          <p className="text-lg font-bold leading-snug mb-2" style={{ color: 'var(--cream-50)' }}>
            {question.question}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {['a', 'b', 'c', 'd'].map((key) => {
              const color = ZONE_COLORS[key]
              const isCorrect = quizReveal === key
              const isWrong = quizReveal && quizReveal !== key
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all"
                  style={{
                    background: isCorrect ? 'rgba(34,197,94,0.2)' : isWrong ? 'rgba(255,255,255,0.02)' : color.bg,
                    border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.5)' : isWrong ? 'rgba(255,255,255,0.04)' : color.border}`,
                    opacity: isWrong ? 0.4 : 1,
                  }}
                >
                  <span className="font-black text-sm" style={{ color: isCorrect ? '#22c55e' : color.text }}>
                    {key.toUpperCase()}
                  </span>
                  <span className="font-body text-xs" style={{ color: isCorrect ? '#bbf7d0' : 'var(--cream-200)' }}>
                    {question[key]}
                  </span>
                  {isCorrect && <span className="ml-auto text-xs">✅</span>}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Quiz answer banner */}
      <AnimatePresence>
        {phase === 'quiz_playing' && quizReveal && question && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm font-bold mb-1 flex-shrink-0"
            style={{ color: 'var(--water-300)' }}
          >
            Answer: {quizReveal.toUpperCase()} — {question[quizReveal]}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Persistent Arena — same instance for lobby + quiz ── */}
      {showArena && (
        <div
          key={`shake-${shakeSeed}`}
          className={`${phase === 'quiz_playing' ? 'flex-1 min-h-0' : ''} w-full flex items-center justify-center${shakeSeed > 0 ? ' hit-shake' : ''}`}
        >
          <div style={phase === 'quiz_playing' ? { width: '100%', maxWidth: 'calc((100dvh - 220px) * 800 / 450)' } : { width: '100%' }}>
            <Arena
              roomId={roomId}
              playerId={playerId}
              players={arenaPlayers}
              joystickRef={joystickRef}
              quizOverlay={quizOverlay}
              selfPositionRef={myPositionRef}
              frozen={!!quizReveal}
              onSelfHit={handleSelfHit}
            />
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      {showArena && isTouchDevice && !(phase === 'quiz_playing' && quizReveal) && (
        <div className="flex items-center justify-center gap-10 mt-1 flex-shrink-0">
          <Joystick inputRef={joystickRef} />
          {phase === 'lobby_wait' && <ShootButton joystickRef={joystickRef} />}
        </div>
      )}

      {/* ── Arena status text ── */}
      {phase === 'lobby_wait' && (
        <div className="text-center mt-1">
          <p className="text-center font-semibold text-xs mb-1" style={{ color: 'rgba(232,184,74,0.6)' }}>
            {isTouchDevice ? 'Walk around while waiting!' : 'Use W A S D to walk around!'}
          </p>
          <PulseDot text="Waiting for the host to start…" />
        </div>
      )}

      {phase === 'quiz_playing' && (
        <p className="text-center mt-1 text-xs font-body flex-shrink-0" style={{ color: 'var(--cream-400)' }}>
          {quizReveal
            ? 'Waiting for next question...'
            : isTouchDevice ? 'Run to your answer zone!' : 'Use W A S D to move to your answer!'}
        </p>
      )}

      {/* ── Player badge (bracket phases only) ── */}
      {!showArena && myPlayer && (
        <div className="flex items-center gap-3 mb-6 w-full max-w-sm">
          <img
            src={myPlayer.avatar_url}
            alt={myPlayer.name}
            className="w-10 h-10 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(232,184,74,0.25)',
            }}
          />
          <div className="flex-1">
            <p className="text-xs font-body" style={{ color: 'var(--cream-400)' }}>Playing as</p>
            <p className="font-bold" style={{ color: 'var(--cream-50)' }}>{myPlayer.name}</p>
          </div>
        </div>
      )}

      {/* ── Bracket mode phase screens ── */}
      <AnimatePresence mode="wait">
        {phase === 'picking' && (
          <PhaseWrapper key="pick">
            <PickScreen match={myCurrentMatch} playerId={playerId} player={myPlayer} />
          </PhaseWrapper>
        )}

        {phase === 'choice_locked' && (
          <PhaseWrapper key="locked">
            <StatusCard
              emoji={WEAPONS[
                myCurrentMatch?.player1_id === playerId
                  ? myCurrentMatch?.p1_choice
                  : myCurrentMatch?.p2_choice
              ]?.emoji ?? '❓'}
              title="Locked in!"
              subtitle="Waiting for the reveal…"
              sub2={<PulseDot text="Watching the host screen!" />}
            />
          </PhaseWrapper>
        )}

        {phase === 'bye' && (
          <PhaseWrapper key="bye">
            <StatusCard
              emoji="🎫"
              title="You got a Bye!"
              subtitle="Sit back and relax — you auto-advance this round."
              sub2={<PulseDot text="Waiting for next round…" />}
            />
          </PhaseWrapper>
        )}

        {phase === 'round_won' && (
          <PhaseWrapper key="won">
            <StatusCard
              emoji="🎉"
              title="You Won!"
              subtitle="Well played! Get ready for the next round."
              sub2={<PulseDot text="Waiting for others to finish…" />}
              accentColor="var(--water-300)"
            />
          </PhaseWrapper>
        )}

        {phase === 'round_draw' && (
          <PhaseWrapper key="draw">
            <StatusCard
              emoji="⚡"
              title="It's a Draw!"
              subtitle="Sudden death rematch incoming…"
              sub2={<PulseDot text="Get ready to pick again!" />}
              accentColor="var(--gold-400)"
            />
          </PhaseWrapper>
        )}

        {phase === 'eliminated' && (
          <PhaseWrapper key="out">
            <div className="text-center space-y-6">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-8xl"
              >
                💦
              </motion.div>
              <div className="space-y-2">
                <p className="text-3xl font-black" style={{ color: 'var(--cream-50)' }}>
                  You got splashed! 💦
                </p>
                <p className="text-lg font-body" style={{ color: 'var(--cream-400)' }}>
                  Better luck next Songkran!
                </p>
              </div>
              <p className="text-sm font-body" style={{ color: 'rgba(196,168,122,0.4)' }}>
                Watch the tournament on the host screen.
              </p>
            </div>
          </PhaseWrapper>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────

function PhaseWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm"
    >
      {children}
    </motion.div>
  )
}

function StatusCard({ emoji, title, subtitle, sub2, accentColor = 'var(--water-400)' }) {
  return (
    <div className="text-center space-y-5">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-8xl select-none"
      >
        {emoji}
      </motion.div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black" style={{ color: accentColor }}>{title}</h2>
        <p className="text-lg font-semibold" style={{ color: 'var(--cream-100)' }}>{subtitle}</p>
        {sub2 && <div className="pt-1">{sub2}</div>}
      </div>
    </div>
  )
}

function PulseDot({ text }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="animate-pulse text-xs" style={{ color: 'var(--water-400)' }}>●</span>
      <span className="text-sm font-body" style={{ color: 'var(--cream-400)' }}>{text}</span>
    </div>
  )
}

function ShootButton({ joystickRef }) {
  return (
    <button
      className="touch-none select-none rounded-full flex items-center justify-center"
      style={{
        width: 52,
        height: 52,
        flexShrink: 0,
        background: 'radial-gradient(circle, rgba(74,184,212,0.25), rgba(29,116,144,0.15))',
        border: '1.5px solid rgba(74,184,212,0.25)',
        fontSize: 22,
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        sfx.unlock()
        joystickRef.current = { ...(joystickRef.current ?? { dx: 0, dy: 0 }), shoot: true }
      }}
    >
      💧
    </button>
  )
}

function FullScreenMessage({ emoji, text, sub }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh text-center px-8 space-y-4"
      style={{ background: 'var(--twilight-950)' }}
    >
      <div className="text-6xl">{emoji}</div>
      <p className="font-bold text-xl" style={{ color: 'var(--cream-50)' }}>{text}</p>
      {sub && <p className="font-body" style={{ color: 'var(--cream-400)' }}>{sub}</p>}
    </div>
  )
}
