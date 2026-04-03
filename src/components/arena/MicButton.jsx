import { motion } from 'framer-motion'

/**
 * Mic toggle button for mobile players.
 */
export default function MicButton({ active, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onToggle}
      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
      style={active ? {
        background: 'rgba(239,68,68,0.15)',
        color: '#fca5a5',
        border: '1px solid rgba(239,68,68,0.25)',
      } : {
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <MicIcon active={active} />
      {active ? 'Mic On' : 'Mic Off'}
    </motion.button>
  )
}

function MicIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {active ? (
        <>
          <rect x="5.5" y="1" width="5" height="9" rx="2.5" fill="currentColor" />
          <path d="M3 7.5a5 5 0 0010 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="5.5" y="1" width="5" height="9" rx="2.5" fill="currentColor" opacity="0.4" />
          <path d="M3 7.5a5 5 0 0010 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
          <line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
