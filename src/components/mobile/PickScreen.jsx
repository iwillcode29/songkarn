import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { WEAPONS } from '../../lib/gameLogic'

const WEAPON_LIST = Object.entries(WEAPONS).map(([id, w]) => ({ id, ...w }))

export default function PickScreen({ match, playerId, player }) {
  const [chosen, setChosen] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const isP1 = match.player1_id === playerId
  const existingChoice = isP1 ? match.p1_choice : match.p2_choice

  const locked = chosen ?? existingChoice

  async function handlePick(weaponId) {
    if (locked || submitting) return

    navigator.vibrate?.(50)

    setChosen(weaponId)
    setSubmitting(true)

    const column = isP1 ? 'p1_choice' : 'p2_choice'
    const { error } = await supabase.from('matches').update({ [column]: weaponId }).eq('id', match.id)

    if (error) {
      // DB write failed — reset so player can retry
      setChosen(null)
    }
    setSubmitting(false)
  }

  return (
    <div className="sk-bg-fixed flex flex-col items-center justify-center px-6 py-6">
      {/* Player info */}
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <img
          src={player?.avatar_url}
          alt={player?.name}
          className="w-14 h-14 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '2px solid rgba(232,184,74,0.25)',
          }}
        />
        <div>
          <p className="text-sm font-body" style={{ color: 'var(--cream-400)' }}>You are</p>
          <p className="font-bold text-xl" style={{ color: 'var(--cream-50)' }}>{player?.name}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!locked ? (
          <motion.div
            key="picking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm space-y-5 text-center relative z-10"
          >
            <div className="space-y-1">
              <h2 className="text-3xl font-black" style={{ color: 'var(--cream-50)' }}>
                Pick Your Weapon!
              </h2>
              <p className="font-body text-sm" style={{ color: 'var(--cream-400)' }}>
                Tap to lock in your choice
              </p>
            </div>

            {WEAPON_LIST.map((weapon, i) => (
              <motion.button
                key={weapon.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => handlePick(weapon.id)}
                className="w-full py-7 rounded-2xl flex items-center justify-center gap-4 font-black text-3xl no-select transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(232,184,74,0.08)',
                  color: 'var(--cream-100)',
                }}
                onPointerDown={(e) => {
                  e.currentTarget.style.background = 'rgba(232,184,74,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(232,184,74,0.2)'
                }}
                onPointerUp={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = 'rgba(232,184,74,0.08)'
                }}
                onPointerCancel={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = 'rgba(232,184,74,0.08)'
                }}
              >
                <span className="text-5xl">{weapon.emoji}</span>
                <span>{weapon.label}</span>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="locked"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="text-center space-y-6 relative z-10"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ duration: 0.5, delay: 0.2, repeat: 2 }}
              className="text-8xl"
            >
              {WEAPONS[locked]?.emoji}
            </motion.div>
            <div className="space-y-1">
              <p className="font-black text-3xl" style={{ color: 'var(--cream-50)' }}>
                {WEAPONS[locked]?.label}
              </p>
              <p className="text-lg" style={{ color: 'var(--gold-400)' }}>Locked in! ✅</p>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <span className="animate-pulse text-xs" style={{ color: 'var(--water-400)' }}>●</span>
              <span className="font-body" style={{ color: 'var(--cream-400)' }}>Waiting for opponent…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
