import { motion } from 'framer-motion'
import { LaiThaiDivider } from '../ThaiDecor'

export default function MobileChampionScreen({ player }) {
  const drops = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    delay: Math.random() * 2,
    duration: 1.5 + Math.random() * 1.5,
  }))

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-dvh overflow-hidden px-6"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(143,91,18,0.2), transparent 70%), linear-gradient(175deg, #1a1033 0%, var(--twilight-950) 50%, #0a0814 100%)',
      }}
    >
      {/* Water drop rain */}
      {drops.map((d) => (
        <motion.div
          key={d.id}
          initial={{ y: -40, x: `${d.x}vw`, opacity: 0.5 }}
          animate={{ y: '110vh', opacity: [0.5, 0.5, 0] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: 'linear' }}
          className="absolute top-0 pointer-events-none select-none"
        >
          <svg width="12" height="17" viewBox="0 0 20 28" fill="none">
            <path
              d="M10 0 C10 0 0 14 0 19 C0 24 4.5 28 10 28 C15.5 28 20 24 20 19 C20 14 10 0 10 0Z"
              fill="var(--water-400)"
              fillOpacity="0.35"
            />
          </svg>
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 8, delay: 0.2 }}
        className="text-center space-y-6 relative z-10"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-8xl relative"
        >
          <span className="relative z-10">🏆</span>
          <div
            className="absolute inset-0 blur-2xl opacity-25"
            style={{ background: 'radial-gradient(circle, var(--gold-400), transparent)' }}
          />
        </motion.div>

        {player && (
          <img
            src={player.avatar_url}
            alt={player.name}
            className="w-28 h-28 rounded-full mx-auto shadow-2xl"
            style={{
              border: '3px solid var(--gold-400)',
              boxShadow: '0 0 30px rgba(232,184,74,0.12)',
            }}
          />
        )}

        <LaiThaiDivider className="mx-auto" />

        <div className="space-y-2">
          <p
            className="font-black text-3xl uppercase tracking-[0.15em]"
            style={{ color: 'var(--gold-400)' }}
          >
            {player?.name}
          </p>
          <p className="text-lg font-bold" style={{ color: 'var(--cream-100)' }}>
            คุณคือ
          </p>
          <p
            className="font-black text-3xl leading-tight"
            style={{ color: 'var(--gold-200)' }}
          >
            WATER CHAMPION! 🏆
          </p>
        </div>
      </motion.div>
    </div>
  )
}
