import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { generateRoomCode } from '../../lib/gameLogic'
import { LaiThaiDivider, WaterDrops, CornerOrnament } from '../ThaiDecor'

export default function CreateRoom({ onRoomCreated }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    const code = generateRoomCode()

    const { error: dbError } = await supabase
      .from('rooms')
      .insert({ id: code, status: 'lobby', current_round: 1 })

    if (dbError) {
      setError('Could not create room. Check your Supabase config.')
      setLoading(false)
      return
    }

    localStorage.setItem('songkran_host_room', code)
    onRoomCreated(code)
  }

  return (
    <div className="sk-bg-fixed relative flex flex-col items-center justify-center px-6">
      <WaterDrops count={15} />

      <div className="fixed top-4 left-4"><CornerOrnament position="top-left" size={48} /></div>
      <div className="fixed top-4 right-4"><CornerOrnament position="top-right" size={48} /></div>
      <div className="fixed bottom-4 left-4"><CornerOrnament position="bottom-left" size={48} /></div>
      <div className="fixed bottom-4 right-4"><CornerOrnament position="bottom-right" size={48} /></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-center relative z-10 max-w-lg"
      >
        {/* Water splash SVG hero */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-6 select-none"
        >
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mx-auto">
            <path
              d="M60 10 C60 10 25 50 25 72 C25 92 40 108 60 108 C80 108 95 92 95 72 C95 50 60 10 60 10Z"
              fill="url(#waterGrad)"
              opacity="0.9"
            />
            <circle cx="30" cy="85" r="6" fill="#4ab8d4" opacity="0.4" />
            <circle cx="90" cy="80" r="5" fill="#4ab8d4" opacity="0.3" />
            <circle cx="18" cy="70" r="3" fill="#7dd3e8" opacity="0.3" />
            <circle cx="102" cy="68" r="3.5" fill="#7dd3e8" opacity="0.25" />
            <ellipse cx="50" cy="55" rx="8" ry="12" fill="white" opacity="0.15" transform="rotate(-15 50 55)" />
            <defs>
              <linearGradient id="waterGrad" x1="60" y1="10" x2="60" y2="108" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7dd3e8" />
                <stop offset="1" stopColor="#1d7490" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-2 mb-4"
        >
          <p className="text-sm font-light tracking-[0.3em] uppercase" style={{ color: 'var(--gold-400)' }}>
            Songkran Tournament
          </p>
          <h1 className="text-6xl lg:text-7xl font-black tracking-tight leading-[0.9]" style={{ color: 'var(--cream-50)' }}>
            Songkran
          </h1>
          <h2 className="text-3xl lg:text-4xl font-bold" style={{ color: 'var(--gold-400)' }}>
            Tournament
          </h2>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <LaiThaiDivider className="mx-auto mb-6" />
        </motion.div>

        {/* Create button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCreate}
          disabled={loading}
          className="relative px-12 py-5 font-bold text-xl rounded-2xl transition-all disabled:opacity-50 overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
            color: 'var(--twilight-950)',
            boxShadow: '0 8px 32px rgba(212, 152, 43, 0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
          <span className="relative">
            {loading ? 'Creating...' : 'Create Room'}
          </span>
        </motion.button>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm" style={{ color: 'var(--terra-400)' }}>
            {error}
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-xs font-body"
          style={{ color: 'rgba(196, 168, 122, 0.35)' }}
        >
          🎉 สงกรานต์ 🎉
        </motion.p>
      </motion.div>
    </div>
  )
}
