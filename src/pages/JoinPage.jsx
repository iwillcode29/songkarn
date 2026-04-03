import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRoom } from '../hooks/useRoom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import { WEAPONS } from '../lib/gameLogic'
import JoinForm from '../components/mobile/JoinForm'
import PickScreen from '../components/mobile/PickScreen'
import MobileChampionScreen from '../components/mobile/MobileChampionScreen'
import Arena from '../components/arena/Arena'
import Joystick from '../components/arena/Joystick'
import MicButton from '../components/arena/MicButton'
import { useKeyboard } from '../hooks/useKeyboard'
import { useVoiceChat } from '../hooks/useVoiceChat'

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

  // Persisted across page loads: player UUID for this room
  const [playerId, setPlayerId] = useState(
    () => localStorage.getItem(`songkran_player_${roomId}`) ?? null,
  )

  // Shared input ref — written by Joystick (touch) or useKeyboard (WASD), read by useArena
  const joystickRef = useRef({ dx: 0, dy: 0 })
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // WASD / arrow keys for desktop users
  useKeyboard(joystickRef)

  // Voice chat — send mic + receive others' audio
  const [micEnabled, setMicEnabled] = useState(false)
  useVoiceChat({ roomId, peerId: playerId, micEnabled })

  const { room, loading: roomLoading } = useRoom(roomId)
  const { players } = usePlayers(roomId)
  const { matches } = useMatches(roomId)

  const myPlayer = useMemo(
    () => players.find((p) => p.id === playerId),
    [players, playerId],
  )

  // Find this player's match in the current round.
  // Only one match per player per round at any given time
  // (rematch reuses the same record, so this is stable).
  const myCurrentMatch = useMemo(() => {
    if (!room || !playerId) return null
    return matches.find(
      (m) =>
        m.round_number === room.current_round &&
        (m.player1_id === playerId || m.player2_id === playerId),
    )
  }, [matches, room, playerId])

  // ── Phase derivation ─────────────────────────────────────────
  const phase = useMemo(() => {
    if (roomLoading) return 'loading'
    if (!room) return 'invalid'
    if (room.status === 'finished') {
      return myPlayer?.is_alive ? 'champion' : 'eliminated'
    }
    if (!playerId || !myPlayer) {
      // Block latecomers from joining a game already in progress
      if (room.status !== 'lobby') return 'invalid'
      return 'joining'
    }
    if (room.status === 'lobby') return 'lobby_wait'

    // room.status === 'playing'
    if (!myCurrentMatch) return 'lobby_wait' // edge case: match not yet created

    if (myCurrentMatch.is_bye) return 'bye'

    const isP1 = myCurrentMatch.player1_id === playerId
    const myChoice = isP1 ? myCurrentMatch.p1_choice : myCurrentMatch.p2_choice

    if (myCurrentMatch.status === 'waiting') {
      return myChoice ? 'choice_locked' : 'picking'
    }

    // match resolved
    if (!myPlayer.is_alive) return 'eliminated'
    if (myCurrentMatch.winner_id === playerId) return 'round_won'
    if (myCurrentMatch.winner_id === null) return 'round_draw'

    // Shouldn't reach here, but safe fallback
    return 'eliminated'
  }, [roomLoading, room, playerId, myPlayer, myCurrentMatch])

  // ── Rendering ────────────────────────────────────────────────

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
  if (phase === 'champion') return <MobileChampionScreen player={myPlayer} />

  // All other phases share the mobile shell
  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh px-5 py-8"
      style={{ background: 'linear-gradient(170deg, #1a1033 0%, #1e1340 40%, #0f1729 100%)' }}
    >
      {/* Player badge + mic */}
      {myPlayer && (
        <div className="flex items-center gap-3 mb-6 w-full max-w-sm">
          <img
            src={myPlayer.avatar_url}
            alt={myPlayer.name}
            className="w-10 h-10 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(251,191,36,0.4)' }}
          />
          <div className="flex-1">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Playing as</p>
            <p className="text-white font-bold">{myPlayer.name}</p>
          </div>
          {phase === 'lobby_wait' && (
            <MicButton active={micEnabled} onToggle={() => setMicEnabled((v) => !v)} />
          )}
        </div>
      )}

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

        {phase === 'lobby_wait' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full flex flex-col"
          >
            <p className="text-center font-semibold text-xs mb-2" style={{ color: 'rgba(251,191,36,0.7)' }}>
              {isTouchDevice ? 'Walk around while waiting!' : 'Use W A S D to walk around!'}
            </p>
            <Arena
              roomId={roomId}
              playerId={playerId}
              players={players}
              joystickRef={joystickRef}
            />
            {isTouchDevice && <Joystick inputRef={joystickRef} />}
            <div className="text-center mt-1">
              <PulseDot text="Waiting for the host to start…" />
            </div>
          </motion.div>
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
              accent="text-green-400"
            />
          </PhaseWrapper>
        )}

        {phase === 'round_draw' && (
          <PhaseWrapper key="draw">
            <StatusCard
              emoji="⚡"
              title="It's a Draw!"
              subtitle="Sudden death rematch incoming…"
              sub2={<PulseDot text="Get ready to pick again!" color="text-orange-400" />}
              accent="text-yellow-400"
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
                <p className="text-3xl font-black text-white">You got splashed! 💦</p>
                <p className="text-slate-400 text-lg">Better luck next Songkran!</p>
              </div>
              <p className="text-slate-500 text-sm">
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

function StatusCard({ emoji, title, subtitle, sub2, accent = 'text-cyan-400' }) {
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
        <h2 className={`text-3xl font-black ${accent}`}>{title}</h2>
        <p className="text-white text-lg font-semibold">{subtitle}</p>
        {sub2 && <div className="pt-1">{sub2}</div>}
      </div>
    </div>
  )
}

function PulseDot({ text, color = 'text-slate-400' }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${color}`}>
      <span className="animate-pulse text-cyan-500 text-xs">●</span>
      <span className="text-sm">{text}</span>
    </div>
  )
}

function FullScreenMessage({ emoji, text, sub }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-slate-900 text-center px-8 space-y-4">
      <div className="text-6xl">{emoji}</div>
      <p className="text-white font-bold text-xl">{text}</p>
      {sub && <p className="text-slate-500">{sub}</p>}
    </div>
  )
}
