/**
 * Reusable Thai decorative elements for the Songkran theme.
 */

/**
 * Lai Thai ornamental divider — a stylized golden lotus line.
 */
export function LaiThaiDivider({ className = '' }) {
  return (
    <svg
      viewBox="0 0 400 24"
      fill="none"
      className={`w-full max-w-xs ${className}`}
      style={{ opacity: 0.5 }}
    >
      {/* Center lotus */}
      <path
        d="M200 2 L208 12 L200 22 L192 12 Z"
        fill="#e8b84a"
      />
      <circle cx="200" cy="12" r="3" fill="#d4982b" />
      {/* Left arm */}
      <path
        d="M192 12 Q170 6 148 12 Q130 6 112 12 Q94 6 76 12 Q58 8 40 12 Q20 10 0 12"
        stroke="#e8b84a"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="148" cy="11" r="2" fill="#e8b84a" />
      <circle cx="76" cy="11.5" r="1.5" fill="#d4982b" />
      {/* Right arm */}
      <path
        d="M208 12 Q230 6 252 12 Q270 6 288 12 Q306 6 324 12 Q342 8 360 12 Q380 10 400 12"
        stroke="#e8b84a"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="252" cy="11" r="2" fill="#e8b84a" />
      <circle cx="324" cy="11.5" r="1.5" fill="#d4982b" />
    </svg>
  )
}

/**
 * Floating water drops — gentle falling animation.
 * Uses CSS animation rather than framer-motion for performance.
 */
export function WaterDrops({ count = 12 }) {
  const drops = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${5 + Math.random() * 90}%`,
    delay: `${Math.random() * 6}s`,
    duration: `${4 + Math.random() * 4}s`,
    size: 10 + Math.random() * 14,
    opacity: 0.15 + Math.random() * 0.25,
  }))

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {drops.map((d) => (
        <div
          key={d.id}
          className="absolute animate-drift"
          style={{
            left: d.left,
            top: -40,
            animationDelay: d.delay,
            animationDuration: d.duration,
          }}
        >
          <svg width={d.size} height={d.size * 1.4} viewBox="0 0 20 28" fill="none">
            <path
              d="M10 0 C10 0 0 14 0 19 C0 24 4.5 28 10 28 C15.5 28 20 24 20 19 C20 14 10 0 10 0Z"
              fill="#4ab8d4"
              fillOpacity={d.opacity}
            />
          </svg>
        </div>
      ))}
    </div>
  )
}

/**
 * Corner ornament — Lai Thai inspired corner bracket.
 */
export function CornerOrnament({ position = 'top-left', size = 60 }) {
  const transforms = {
    'top-left': '',
    'top-right': 'scaleX(-1)',
    'bottom-left': 'scaleY(-1)',
    'bottom-right': 'scale(-1)',
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      style={{ transform: transforms[position] }}
      className="opacity-20"
    >
      <path
        d="M0 0 L20 0 Q12 8 12 20 L12 28 Q8 20 0 20 Z"
        fill="#e8b84a"
      />
      <path
        d="M0 0 Q8 12 20 12 L28 12 Q20 8 20 0"
        stroke="#d4982b"
        strokeWidth="1"
        fill="none"
      />
      <circle cx="8" cy="8" r="2" fill="#d4982b" opacity="0.6" />
    </svg>
  )
}
