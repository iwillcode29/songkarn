import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { WaterDrops } from '../ThaiDecor'

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
    <div className="sk-bg-fixed relative flex flex-col items-center justify-center px-6">
      <WaterDrops count={8} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-8 text-center relative z-10"
      >
        {/* Water drop icon */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="select-none"
        >
          <svg width="72" height="96" viewBox="0 0 72 96" fill="none" className="mx-auto">
            <path
              d="M36 4 C36 4 6 42 6 60 C6 78 19 92 36 92 C53 92 66 78 66 60 C66 42 36 4 36 4Z"
              fill="url(#joinWater)"
            />
            <ellipse cx="28" cy="48" rx="6" ry="10" fill="white" opacity="0.1" transform="rotate(-12 28 48)" />
            <defs>
              <linearGradient id="joinWater" x1="36" y1="4" x2="36" y2="92" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7dd3e8" stopOpacity="0.9" />
                <stop offset="1" stopColor="#1d7490" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black" style={{ color: 'var(--cream-50)' }}>
            Join the Battle!
          </h1>
          <p className="font-body text-sm" style={{ color: 'var(--cream-400)' }}>
            Room <span className="font-bold sk-gold-text">{roomId}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            autoFocus
            className="w-full px-5 py-4 rounded-2xl text-lg font-semibold placeholder:text-sm focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(232,184,74,0.12)',
              color: 'var(--cream-50)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(232,184,74,0.3)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,184,74,0.08)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(232,184,74,0.12)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />

          {/* Live avatar preview */}
          {name.trim() && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 sk-surface"
            >
              <img
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name.trim())}`}
                alt="Your avatar"
                className="w-12 h-12 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              />
              <span className="font-semibold" style={{ color: 'var(--cream-100)' }}>
                {name.trim()}
              </span>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full py-5 font-black text-xl rounded-2xl transition-all disabled:opacity-40"
            style={name.trim() && !loading ? {
              background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
              color: 'var(--twilight-950)',
              boxShadow: '0 8px 24px rgba(212,152,43,0.2)',
            } : {
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(245,237,224,0.2)',
            }}
          >
            {loading ? 'Joining...' : "Let's Go!"}
          </motion.button>

          {error && (
            <p className="text-sm" style={{ color: 'var(--terra-400)' }}>{error}</p>
          )}
        </form>
      </motion.div>
    </div>
  )
}
