import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { createBracketPairs } from '../../lib/gameLogic'
import Arena from '../arena/Arena'
import { LaiThaiDivider, CornerOrnament } from '../ThaiDecor'
import { sfx } from '../../lib/sfx'

const GAME_MODES = [
  {
    id: 'bracket',
    emoji: '🔫',
    title: 'Battle',
    desc: 'Rock-Paper-Scissors bracket',
    minPlayers: 2,
  },
  {
    id: 'quiz',
    emoji: '❓',
    title: 'Quiz',
    desc: '10 questions — run to the zone!',
    minPlayers: 1,
  },
]

export default function Lobby({ room, players, onClearRoom }) {
  const [starting, setStarting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const joinUrl = `${window.location.origin}/join/${room.id}`

  // Unlock audio + start lobby BGM on first click
  useEffect(() => {
    function handleClick() {
      sfx.unlock()
      sfx.bgmStart()
    }
    document.addEventListener('pointerdown', handleClick, { once: true })
    return () => {
      document.removeEventListener('pointerdown', handleClick)
      sfx.bgmStop()
    }
  }, [])

  async function handleStartGame(mode) {
    sfx.unlock()
    sfx.bgmStop()
    const minPlayers = GAME_MODES.find((m) => m.id === mode)?.minPlayers ?? 2
    if (players.length < minPlayers || starting) return
    setStarting(true)

    try {
      // Quiz mode: set game_mode and flip to playing
      if (mode === 'quiz') {
        const { error: roomError } = await supabase
          .from('rooms')
          .update({ status: 'playing', game_mode: mode })
          .eq('id', room.id)
        if (roomError) console.error('Failed to start game:', roomError)
        return
      }

      // Bracket mode: create match pairs, then set game_mode + status
      const pairs = createBracketPairs(players)
      const matchInserts = pairs.map((pair) => ({
        room_id: room.id,
        round_number: 1,
        player1_id: pair.player1_id,
        player2_id: pair.player2_id,
        is_bye: pair.is_bye,
        status: pair.is_bye ? 'resolved' : 'waiting',
        winner_id: pair.is_bye ? pair.player1_id : null,
      }))

      const { error: matchError } = await supabase.from('matches').insert(matchInserts)
      if (matchError) {
        console.error('Failed to create matches:', matchError)
        return
      }

      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'playing', game_mode: mode })
        .eq('id', room.id)
      if (roomError) console.error('Failed to start game:', roomError)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="sk-bg relative p-6 lg:p-8 overflow-hidden">
      {/* Corner ornaments */}
      <div className="fixed top-3 left-3 z-20"><CornerOrnament position="top-left" size={40} /></div>
      <div className="fixed top-3 right-3 z-20"><CornerOrnament position="top-right" size={40} /></div>

      <div className="max-w-6xl mx-auto space-y-5 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-baseline gap-3"
        >
          <h1 className="text-3xl lg:text-4xl font-black sk-gold-text">
            Songkran Lobby
          </h1>
          <WaterIcon />
        </motion.div>

        {/* Top row: QR + Players + Start */}
        <div className="grid grid-cols-[1fr_1.2fr] gap-6 items-start">

          {/* QR Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="sk-surface sk-border-top rounded-2xl p-6 text-center space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: 'var(--gold-400)' }}>
                Scan to Join
              </p>
              <button
                onClick={async () => {
                  if (clearing) return
                  setClearing(true)
                  await onClearRoom()
                }}
                disabled={clearing}
                className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
                style={{
                  color: 'var(--cream-400)',
                  background: 'rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--terra-400)'
                  e.currentTarget.style.background = 'rgba(217,119,85,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--cream-400)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
              >
                {clearing ? 'Clearing...' : 'Clear Room'}
              </button>
            </div>

            <div
              className="p-3 rounded-xl inline-block"
              style={{ background: 'var(--cream-50)' }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={160}
                level="H"
                includeMargin={false}
                fgColor="#13102a"
                bgColor="#fdfbf5"
              />
            </div>

            <p className="text-xs font-body" style={{ color: 'rgba(245,237,224,0.3)' }}>
              {joinUrl}
            </p>

            <div
              className="rounded-xl py-3 px-5"
              style={{
                background: 'rgba(232,184,74,0.06)',
                border: '1px solid rgba(232,184,74,0.12)',
              }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--cream-400)' }}>Room Code</p>
              <p
                className="text-4xl lg:text-5xl font-black tracking-[0.2em] sk-gold-text"
              >
                {room.id}
              </p>
            </div>
          </motion.div>

          {/* Player list + Start */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold" style={{ color: 'var(--cream-100)' }}>
                Players
              </h2>
              <span className="text-sm font-bold tabular-nums sk-gold-text">
                {players.length} joined
              </span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              <AnimatePresence>
                {players.map((player, i) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 rounded-lg py-2 px-3 sk-surface"
                  >
                    <img
                      src={player.avatar_url}
                      alt={player.name}
                      className="w-8 h-8 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    />
                    <span className="font-medium text-sm flex-1" style={{ color: 'var(--cream-100)' }}>
                      {player.name}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {players.length === 0 && (
                <p className="text-center py-8 text-sm font-body" style={{ color: 'rgba(245,237,224,0.25)' }}>
                  Waiting for players to scan...
                </p>
              )}
            </div>

            <p className="text-xs font-semibold" style={{ color: 'var(--gold-400)' }}>
              Choose a game to start
            </p>
            <div className="flex gap-2">
              {GAME_MODES.map((m) => {
                const canStart = players.length >= m.minPlayers
                return (
                  <motion.button
                    key={m.id}
                    whileHover={canStart ? { scale: 1.02 } : {}}
                    whileTap={canStart ? { scale: 0.98 } : {}}
                    onClick={() => handleStartGame(m.id)}
                    disabled={!canStart || starting}
                    className="flex-1 py-3 rounded-xl transition-all text-center"
                    style={canStart && !starting ? {
                      background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                      color: 'var(--twilight-950)',
                      boxShadow: '0 4px 16px rgba(212,152,43,0.2)',
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(245,237,224,0.25)',
                      cursor: 'not-allowed',
                    }}
                  >
                    <div className="text-2xl mb-0.5">{m.emoji}</div>
                    <div className="font-bold text-sm">
                      {starting ? 'Starting...' : m.title}
                    </div>
                    <div className="text-xs mt-0.5 opacity-70">
                      {canStart ? m.desc : `Need ${m.minPlayers}+ players`}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            <LaiThaiDivider className="mx-auto mt-2 opacity-30" />
          </motion.div>
        </div>

        {/* Arena */}
        {players.length > 0 && (
          <Arena
            roomId={room.id}
            playerId={null}
            players={players}
            joystickRef={null}
          />
        )}
      </div>
    </div>
  )
}

function WaterIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="inline-block">
      <path
        d="M14 2 C14 2 4 13 4 18 C4 23.5 8.5 28 14 28 C19.5 28 24 23.5 24 18 C24 13 14 2 14 2Z"
        fill="var(--water-400)"
        fillOpacity="0.6"
      />
      <ellipse cx="11" cy="14" rx="2.5" ry="4" fill="white" opacity="0.12" transform="rotate(-10 11 14)" />
    </svg>
  )
}
