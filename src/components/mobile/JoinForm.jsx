import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

/**
 * Name entry form for new mobile players.
 * On submit: creates a player row in DB, saves their UUID to localStorage.
 */
export default function JoinForm({ roomId, onJoined }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim().slice(0, 20)
    if (!trimmed) return

    setLoading(true)
    setError(null)

    const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(trimmed)}`

    const { data, error: dbError } = await supabase
      .from('players')
      .insert({ room_id: roomId, name: trimmed, avatar_url: avatarUrl })
      .select()
      .single()

    if (dbError) {
      setError('Could not join. Make sure the room code is correct.')
      setLoading(false)
      return
    }

    localStorage.setItem(`songkran_player_${roomId}`, data.id)
    onJoined(data.id)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-blue-950 to-slate-900 px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div className="space-y-2">
          <div className="text-7xl animate-float select-none">💦</div>
          <h1 className="text-4xl font-black text-white">Join the Battle!</h1>
          <p className="text-slate-400">Room <span className="text-cyan-400 font-bold">{roomId}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            autoFocus
            className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-xl font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />

          {/* Live avatar preview */}
          {name.trim() && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3"
            >
              <img
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name.trim())}`}
                alt="Your avatar"
                className="w-12 h-12 rounded-full bg-white/20"
              />
              <span className="text-white font-semibold">{name.trim()}</span>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full py-5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-black text-2xl rounded-2xl transition-colors"
          >
            {loading ? '⏳ Joining...' : "Let's Go! 🔫"}
          </motion.button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
      </motion.div>
    </div>
  )
}
