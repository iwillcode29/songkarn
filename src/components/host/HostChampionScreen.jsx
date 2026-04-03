import { motion } from 'framer-motion'

/**
 * Full-screen celebration shown on the host when the tournament ends.
 */
export default function HostChampionScreen({ champion, onPlayAgain }) {
  // Generate ~40 confetti particles with random properties
  const confetti = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    emoji: ['💧', '🌊', '✨', '🎉', '🏆', '💦'][Math.floor(Math.random() * 6)],
    size: 1.2 + Math.random() * 1.5,
  }))

  return (
    <div className="relative flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-yellow-900 via-orange-950 to-slate-900 overflow-hidden">
      {/* Confetti */}
      {confetti.map((c) => (
        <motion.div
          key={c.id}
          initial={{ y: -60, x: `${c.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 360 * 3 }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ fontSize: `${c.size}rem` }}
          className="absolute top-0 pointer-events-none select-none"
        >
          {c.emoji}
        </motion.div>
      ))}

      {/* Champion announcement */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 10, delay: 0.3 }}
        className="text-center space-y-8 relative z-10 px-8"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.6, delay: 0.8, repeat: 2 }}
          className="text-9xl"
        >
          🏆
        </motion.div>

        <div className="space-y-2">
          <p className="text-yellow-400 font-bold text-2xl uppercase tracking-widest">
            Champion
          </p>
          <h1 className="text-7xl font-black text-white drop-shadow-2xl">
            {champion?.name ?? '???'}
          </h1>
          <p className="text-yellow-300 text-2xl font-semibold">
            is the Water Champion! 💦
          </p>
        </div>

        {champion && (
          <motion.img
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.6 }}
            src={champion.avatar_url}
            alt={champion.name}
            className="w-32 h-32 rounded-full mx-auto ring-4 ring-yellow-400 shadow-2xl"
          />
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlayAgain}
          className="px-10 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xl rounded-2xl border border-white/20 transition-colors"
        >
          🎮 Play Again
        </motion.button>
      </motion.div>
    </div>
  )
}
