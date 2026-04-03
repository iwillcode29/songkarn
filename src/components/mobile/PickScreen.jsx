import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { WEAPONS } from '../../lib/gameLogic'

const WEAPON_LIST = Object.entries(WEAPONS).map(([id, w]) => ({ id, ...w }))

/**
 * The 3-weapon pick screen shown to mobile players during the battle phase.
 *
 * On tap:
 *  1. Haptic vibration
 *  2. Lock animation
 *  3. Write choice to the correct column (p1_choice or p2_choice) in the match row
 */
export default function PickScreen({ match, playerId, player }) {
  const [chosen, setChosen] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const isP1 = match.player1_id === playerId
  const existingChoice = isP1 ? match.p1_choice : match.p2_choice

  // If already chosen (e.g. page reload), reflect that
  const locked = chosen ?? existingChoice

  async function handlePick(weaponId) {
    if (locked || submitting) return

    // Haptic feedback
    navigator.vibrate?.(50)

    setChosen(weaponId)
    setSubmitting(true)

    const column = isP1 ? 'p1_choice' : 'p2_choice'
    await supabase.from('matches').update({ [column]: weaponId }).eq('id', match.id)

    setSubmitting(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-blue-950 via-cyan-950 to-slate-900 px-6 py-10">
      {/* Player info */}
      <div className="flex items-center gap-3 mb-8">
        <img
          src={player?.avatar_url}
          alt={player?.name}
          className="w-14 h-14 rounded-full bg-white/20 ring-2 ring-cyan-500"
        />
        <div>
          <p className="text-slate-400 text-sm">You are</p>
          <p className="text-white font-bold text-xl">{player?.name}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!locked ? (
          <motion.div
            key="picking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm space-y-5 text-center"
          >
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white">Pick Your Weapon!</h2>
              <p className="text-slate-400">Tap to lock in your choice</p>
            </div>

            {WEAPON_LIST.map((weapon, i) => (
              <motion.button
                key={weapon.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => handlePick(weapon.id)}
                className="w-full py-7 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 rounded-3xl flex items-center justify-center gap-4 text-white font-black text-3xl no-select transition-colors"
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
            className="text-center space-y-6"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ duration: 0.5, delay: 0.2, repeat: 2 }}
              className="text-8xl"
            >
              {WEAPONS[locked]?.emoji}
            </motion.div>
            <div className="space-y-1">
              <p className="text-white font-black text-3xl">{WEAPONS[locked]?.label}</p>
              <p className="text-slate-400 text-lg">Locked in! ✅</p>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="animate-pulse text-cyan-500">●</span>
              <span>Waiting for opponent…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
