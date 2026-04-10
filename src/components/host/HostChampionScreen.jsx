import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { LaiThaiDivider } from '../ThaiDecor'
import { sfx } from '../../lib/sfx'

export default function HostChampionScreen({ champion, champions = [], isQuiz = false, onPlayAgain }) {
  useEffect(() => { sfx.fanfare() }, [])
  // Gold & water confetti
  const confetti = Array.from({ length: 35 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2.5,
    emoji: ['💧', '✨', '🏆', '💦', '🪷'][Math.floor(Math.random() * 5)],
    size: 1.2 + Math.random() * 1.2,
  }))

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-dvh overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(143,91,18,0.25), transparent 70%), linear-gradient(175deg, #1a1033 0%, var(--twilight-950) 50%, #0a0814 100%)',
      }}
    >
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
        className="text-center space-y-6 relative z-10 px-8"
      >
        {/* Trophy with glow */}
        <motion.div
          animate={{ rotate: [0, -8, 8, -8, 0] }}
          transition={{ duration: 0.6, delay: 0.8, repeat: 2 }}
          className="text-9xl relative"
        >
          <span className="relative z-10">🏆</span>
          <div
            className="absolute inset-0 blur-3xl opacity-30"
            style={{ background: 'radial-gradient(circle, var(--gold-400), transparent)' }}
          />
        </motion.div>

        <LaiThaiDivider className="mx-auto" />

        <div className="space-y-2">
          <p
            className="font-bold text-xl uppercase tracking-[0.2em]"
            style={{ color: 'var(--gold-400)' }}
          >
            {isQuiz && champions.length > 1 ? 'Tied Champions' : isQuiz && champions.length === 0 ? 'Game Over' : 'Champion'}
          </p>
          {isQuiz && champions.length > 1 ? (
            <h1
              className="text-5xl font-black leading-none"
              style={{ color: 'var(--cream-50)', textShadow: '0 4px 40px rgba(232,184,74,0.15)' }}
            >
              {champions.map((c) => c.name).join(' & ')}
            </h1>
          ) : (
            <h1
              className="text-7xl font-black leading-none"
              style={{ color: 'var(--cream-50)', textShadow: '0 4px 40px rgba(232,184,74,0.15)' }}
            >
              {champion?.name ?? (isQuiz ? 'No correct answers!' : 'Nobody survived!')}
            </h1>
          )}
          <p className="text-xl font-semibold" style={{ color: 'var(--gold-200)' }}>
            {isQuiz
              ? champions.length > 0 ? `${champion?.score ?? 0} point${(champion?.score ?? 0) !== 1 ? 's' : ''} 🎉` : 'Better luck next time! 💦'
              : 'Water Champion! 💦'}
          </p>
        </div>

        {isQuiz && champions.length > 1 ? (
          <div className="flex justify-center gap-4 flex-wrap">
            {champions.map((c, i) => (
              <motion.img
                key={c.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.4 + i * 0.15 }}
                src={c.avatar_url}
                alt={c.name}
                className="w-24 h-24 rounded-full shadow-2xl"
                style={{
                  border: '3px solid var(--gold-400)',
                  boxShadow: '0 0 30px rgba(232,184,74,0.12)',
                }}
              />
            ))}
          </div>
        ) : champion ? (
          <motion.img
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.6 }}
            src={champion.avatar_url}
            alt={champion.name}
            className="w-32 h-32 rounded-full mx-auto shadow-2xl"
            style={{
              border: '3px solid var(--gold-400)',
              boxShadow: '0 0 40px rgba(232,184,74,0.15)',
            }}
          />
        ) : null}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlayAgain}
          className="px-10 py-4 font-bold text-xl rounded-2xl transition-all"
          style={{
            background: 'rgba(232,184,74,0.1)',
            color: 'var(--gold-400)',
            border: '1px solid rgba(232,184,74,0.2)',
          }}
        >
          Play Again
        </motion.button>
      </motion.div>
    </div>
  )
}
