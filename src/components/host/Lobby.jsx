import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { createBracketPairs } from '../../lib/gameLogic'
import Arena from '../arena/Arena'
import { useVoiceChat } from '../../hooks/useVoiceChat'

export default function Lobby({ room, players, onClearRoom }) {
  const [starting, setStarting] = useState(false)
  const [clearing, setClearing] = useState(false)
  // Host listens to voice (mic off, but receives all players' audio)
  const { activeSpeakers } = useVoiceChat({ roomId: room.id, peerId: `host-${room.id}`, micEnabled: false })
  const joinUrl = `${window.location.origin}/join/${room.id}`
  const canStart = players.length >= 2

  async function handleStartGame() {
    if (!canStart || starting) return
    setStarting(true)

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
      setStarting(false)
      return
    }

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', room.id)
    if (roomError) {
      console.error('Failed to start game:', roomError)
      setStarting(false)
    }
  }

  return (
    <div
      className="min-h-dvh p-6 lg:p-8"
      style={{ background: 'linear-gradient(170deg, #1a1033 0%, #1e1340 40%, #0f1729 100%)' }}
    >
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-baseline gap-3"
        >
          <h1
            className="text-3xl lg:text-4xl font-black"
            style={{ color: '#fbbf24' }}
          >
            Songkran Tournament
          </h1>
          <span className="text-2xl">💦</span>
        </motion.div>

        {/* Top row: QR + Players + Start */}
        <div className="grid grid-cols-[1fr_1.2fr] gap-6 items-start">

          {/* QR Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-6 text-center space-y-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: '#d4a052' }}>Scan to Join</p>
              <button
                onClick={async () => {
                  if (clearing) return
                  setClearing(true)
                  await onClearRoom()
                }}
                disabled={clearing}
                className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444'
                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }}
              >
                {clearing ? 'Clearing...' : 'Clear Room'}
              </button>
            </div>

            <div className="bg-white p-3 rounded-xl inline-block">
              <QRCodeSVG value={joinUrl} size={160} level="H" includeMargin={false} />
            </div>

            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {joinUrl}
            </p>

            <div
              className="rounded-xl py-3 px-5"
              style={{
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.15)',
              }}
            >
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Room Code</p>
              <p
                className="text-4xl lg:text-5xl font-black tracking-[0.2em]"
                style={{ color: '#fbbf24' }}
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
              <h2 className="text-xl font-bold text-white">
                Players
              </h2>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: '#fbbf24' }}
              >
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
                    className="flex items-center gap-3 rounded-lg py-2 px-3"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <img
                      src={player.avatar_url}
                      alt={player.name}
                      className="w-8 h-8 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.1)' }}
                    />
                    <span className="font-medium text-sm text-white/90 flex-1">{player.name}</span>
                    {activeSpeakers.has(player.id) && (
                      <span className="text-xs" style={{ color: '#4ade80' }} title="Mic on">
                        🎙️
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {players.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Waiting for players to scan...
                </p>
              )}
            </div>

            <motion.button
              whileHover={canStart ? { scale: 1.02 } : {}}
              whileTap={canStart ? { scale: 0.98 } : {}}
              onClick={handleStartGame}
              disabled={!canStart || starting}
              className="w-full py-3.5 font-bold text-lg rounded-xl transition-all"
              style={canStart && !starting ? {
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#1c1917',
                boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
              } : {
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'not-allowed',
              }}
            >
              {starting
                ? 'Starting...'
                : canStart
                ? `Start Tournament`
                : 'Need at least 2 players'}
            </motion.button>
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
