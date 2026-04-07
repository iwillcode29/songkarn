import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { LaiThaiDivider } from '../ThaiDecor'
import { sfx } from '../../lib/sfx'

/**
 * Host view for "Random Picker" mode.
 *
 * Shows all players in a grid. The host clicks PICK to start a dramatic
 * spinning animation that cycles through player avatars, slowing down
 * before landing on a winner. Winners are excluded from future picks.
 * Broadcasts winner via `random:${roomId}` channel so mobile clients
 * can show a celebration on the winner's phone.
 */
export default function RandomPickerHostView({ room, players }) {
  const [pickedIds, setPickedIds] = useState(new Set())
  const [spinning, setSpinning] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [winner, setWinner] = useState(null) // player object
  const channelRef = useRef(null)
  const spinCancelRef = useRef(null) // cancel fn for in-flight spin animation

  const eligible = useMemo(
    () => players.filter((p) => !pickedIds.has(p.id)),
    [players, pickedIds],
  )

  // Broadcast channel for notifying mobile clients
  useEffect(() => {
    let destroyed = false
    let ch = null

    function createChannel() {
      ch = supabase.channel(`random:${room.id}`, { config: { broadcast: { self: false } } })
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
      spinCancelRef.current?.()
      if (ch) supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [room.id])

  const handlePick = useCallback(() => {
    if (spinning || eligible.length === 0) return

    setWinner(null)
    setSpinning(true)
    sfx.unlock()

    // Pick the actual winner upfront
    const winnerIdx = Math.floor(Math.random() * eligible.length)
    const chosenPlayer = eligible[winnerIdx]

    // Spin animation: cycle through indices, slowing down
    let tick = 0
    const totalTicks = 20 + Math.floor(Math.random() * 10) // 20-30 ticks
    let current = Math.floor(Math.random() * eligible.length)
    const finalIdx = winnerIdx
    let cancelled = false
    spinCancelRef.current = () => { cancelled = true }

    function step() {
      if (cancelled) return
      if (tick < totalTicks) {
        const progress = tick / totalTicks
        const delay = 40 + progress * progress * 250

        current = tick === totalTicks - 1
          ? finalIdx
          : (current + 1) % eligible.length

        setHighlightIndex(current)
        // Ascending pitch as spin slows: 3→2→1
        sfx.countdown(progress < 0.6 ? 3 : progress < 0.85 ? 2 : 1)

        tick++
        setTimeout(step, delay)
      } else {
        // Landed on winner
        setHighlightIndex(finalIdx)
        setWinner(chosenPlayer)
        setPickedIds((prev) => new Set(prev).add(chosenPlayer.id))
        setSpinning(false)
        sfx.fanfare()

        channelRef.current?.send({
          type: 'broadcast',
          event: 'random-winner',
          payload: { playerId: chosenPlayer.id, name: chosenPlayer.name },
        })
      }
    }

    step()
  }, [spinning, eligible])

  const handleReset = useCallback(() => {
    setPickedIds(new Set())
    setWinner(null)
    setHighlightIndex(-1)
  }, [])

  const handleBackToLobby = useCallback(async () => {
    await supabase.from('players').update({ is_alive: true }).eq('room_id', room.id)
    await supabase
      .from('rooms')
      .update({ status: 'lobby', current_round: 1 })
      .eq('id', room.id)
  }, [room.id])

  // Water splash confetti on winner reveal
  const confetti = useMemo(() => {
    if (!winner) return []
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2 + Math.random() * 2,
      emoji: ['💧', '✨', '🎉', '💦', '🪷'][Math.floor(Math.random() * 5)],
      size: 1 + Math.random() * 1,
    }))
  }, [winner])

  return (
    <div className="sk-bg relative p-6 lg:p-8 overflow-hidden min-h-dvh">
      {/* Confetti on winner */}
      <AnimatePresence>
        {winner && confetti.map((c) => (
          <motion.div
            key={c.id}
            initial={{ y: -40, x: `${c.x}vw`, opacity: 1, rotate: 0 }}
            animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 360 * 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }}
            style={{ fontSize: `${c.size}rem` }}
            className="absolute top-0 pointer-events-none select-none z-0"
          >
            {c.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl lg:text-4xl font-black sk-gold-text">
              Random Pick
            </h2>
            <p className="font-body text-sm mt-1" style={{ color: 'var(--cream-400)' }}>
              {eligible.length} player{eligible.length !== 1 ? 's' : ''} remaining
              {pickedIds.size > 0 && (
                <span style={{ color: 'var(--gold-400)' }}>
                  {' '}· {pickedIds.size} picked
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-3">
            {/* Pick button */}
            <motion.button
              whileHover={eligible.length > 0 && !spinning ? { scale: 1.05 } : {}}
              whileTap={eligible.length > 0 && !spinning ? { scale: 0.95 } : {}}
              onClick={handlePick}
              disabled={spinning || eligible.length === 0}
              className="px-8 py-4 font-black text-xl rounded-2xl disabled:opacity-40 transition-all"
              style={
                !spinning && eligible.length > 0
                  ? {
                      background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))',
                      color: 'var(--twilight-950)',
                      boxShadow: '0 8px 24px rgba(232,184,74,0.25)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(245,237,224,0.25)',
                      cursor: 'not-allowed',
                    }
              }
            >
              {spinning ? 'Picking...' : eligible.length === 0 ? 'All Picked!' : 'PICK!'}
            </motion.button>
          </div>
        </div>

        {/* Winner announcement */}
        <AnimatePresence>
          {winner && !spinning && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              className="sk-surface sk-border-top rounded-2xl p-8 text-center space-y-4"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="text-7xl"
              >
                🎉
              </motion.div>
              <LaiThaiDivider className="mx-auto" />
              <p
                className="font-bold text-sm uppercase tracking-[0.2em]"
                style={{ color: 'var(--gold-400)' }}
              >
                Winner
              </p>
              <div className="flex items-center justify-center gap-4">
                <motion.img
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  src={winner.avatar_url}
                  alt={winner.name}
                  className="w-24 h-24 rounded-full"
                  style={{
                    border: '3px solid var(--gold-400)',
                    boxShadow: '0 0 40px rgba(232,184,74,0.2)',
                  }}
                />
              </div>
              <h3
                className="text-5xl font-black"
                style={{ color: 'var(--cream-50)', textShadow: '0 4px 40px rgba(232,184,74,0.15)' }}
              >
                {winner.name}
              </h3>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {players.map((player, i) => {
            const isPicked = pickedIds.has(player.id)
            const isHighlighted = spinning && eligible[highlightIndex]?.id === player.id
            const isWinner = winner?.id === player.id && !spinning

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: isPicked && !isWinner ? 0.3 : 1,
                  scale: isHighlighted ? 1.15 : isWinner ? 1.1 : 1,
                }}
                transition={{ duration: 0.15 }}
                className="relative flex flex-col items-center gap-2 rounded-xl p-3 transition-all"
                style={{
                  background: isHighlighted
                    ? 'rgba(232,184,74,0.2)'
                    : isWinner
                    ? 'rgba(232,184,74,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: isHighlighted
                    ? '2px solid var(--gold-400)'
                    : isWinner
                    ? '2px solid var(--gold-400)'
                    : '2px solid transparent',
                  boxShadow: isHighlighted
                    ? '0 0 24px rgba(232,184,74,0.3)'
                    : isWinner
                    ? '0 0 30px rgba(232,184,74,0.2)'
                    : 'none',
                }}
              >
                <img
                  src={player.avatar_url}
                  alt={player.name}
                  className="w-14 h-14 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    filter: isPicked && !isWinner ? 'grayscale(1)' : 'none',
                  }}
                />
                <span
                  className="font-medium text-xs text-center truncate w-full"
                  style={{ color: isPicked && !isWinner ? 'rgba(245,237,224,0.3)' : 'var(--cream-100)' }}
                >
                  {player.name}
                </span>
                {isPicked && !isWinner && (
                  <span className="absolute top-1 right-1 text-xs">✓</span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {pickedIds.size > 0 && !spinning && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReset}
              className="px-6 py-3 font-bold text-sm rounded-xl transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--cream-400)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Reset Picks
            </motion.button>
          )}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBackToLobby}
            className="px-6 py-3 font-bold text-sm rounded-xl transition-all"
            style={{
              background: 'rgba(232,184,74,0.08)',
              color: 'var(--gold-400)',
              border: '1px solid rgba(232,184,74,0.15)',
            }}
          >
            Back to Lobby
          </motion.button>
        </div>
      </div>
    </div>
  )
}
