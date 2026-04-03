import { motion } from 'framer-motion'

/**
 * Shown on the winner's phone when room.status === 'finished'
 * and the player is still alive.
 */
export default function MobileChampionScreen({ player }) {
  const drops = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    delay: Math.random() * 2,
    duration: 1.5 + Math.random() * 1.5,
  }))

  return (
    <div className="relative flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-yellow-900 via-orange-950 to-slate-900 overflow-hidden px-6">
      {/* Water drop rain */}
      {drops.map((d) => (
        <motion.div
          key={d.id}
          initial={{ y: -40, x: `${d.x}vw`, opacity: 0.8 }}
          animate={{ y: '110vh', opacity: [0.8, 0.8, 0] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: 'linear' }}
          className="absolute top-0 text-2xl pointer-events-none select-none"
        >
          💧
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 8, delay: 0.2 }}
        className="text-center space-y-6 relative z-10"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-8xl"
        >
          🏆
        </motion.div>

        {player && (
          <img
            src={player.avatar_url}
            alt={player.name}
            className="w-28 h-28 rounded-full mx-auto ring-4 ring-yellow-400 shadow-2xl"
          />
        )}

        <div className="space-y-2">
          <p className="text-yellow-400 font-black text-3xl uppercase tracking-widest">
            {player?.name}
          </p>
          <p className="text-white text-xl font-bold">YOU ARE THE</p>
          <p className="text-yellow-300 font-black text-4xl leading-tight">
            WATER CHAMPION! 🏆
          </p>
        </div>
      </motion.div>
    </div>
  )
}
