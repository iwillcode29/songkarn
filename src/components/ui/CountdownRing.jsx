/**
 * Circular countdown ring with animated stroke + large number.
 * Turns red when <= 5 seconds remain.
 */
export default function CountdownRing({ secondsLeft, total = 15, size = 64 }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const progress = total > 0 ? secondsLeft / total : 0
  const dashoffset = circumference * (1 - progress)

  const urgent = secondsLeft <= 5
  const color = urgent ? 'var(--terra-400)' : 'var(--water-400)'

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s ease' }}
        />
      </svg>
      {/* Number */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.38,
          fontWeight: 900,
          color,
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.3s ease',
        }}
      >
        {secondsLeft}
      </span>
    </div>
  )
}
