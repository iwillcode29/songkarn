import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { generateRoomCode } from '../../lib/gameLogic'

/**
 * Landing screen shown on /host before any room exists.
 * Clicking "Create Room" generates a 4-char code, inserts into DB,
 * persists it to localStorage, and calls onRoomCreated(code).
 */
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
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-blue-950 via-cyan-950 to-slate-900 px-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center space-y-10 max-w-lg"
      >
        {/* Hero */}
        <div className="space-y-3">
          <div className="text-9xl animate-float select-none">💦</div>
          <h1 className="text-6xl font-black tracking-tight text-white leading-none">
            Songkran<br />
            <span className="text-cyan-400">Tournament</span>
          </h1>
          <p className="text-slate-400 text-xl">
            The ultimate water battle &nbsp;🔫&nbsp;☂️&nbsp;✂️
          </p>
        </div>

        {/* Create button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreate}
          disabled={loading}
          className="px-14 py-5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-900 font-black text-3xl rounded-3xl shadow-2xl shadow-cyan-500/30 disabled:opacity-50 transition-colors"
        >
          {loading ? '⏳ Creating...' : '🎮 Create Room'}
        </motion.button>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </motion.div>
    </div>
  )
}
