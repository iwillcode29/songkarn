/**
 * Pixel-art RPG character — inline SVG, 16×16 grid.
 * 4 directions × 4 walk frames, 8 Songkran-festival palettes.
 */

const FRAME_W = 16
const FRAME_H = 16

// Songkran festival palettes — vibrant, warm, celebratory
const PALETTES = [
  { body: '#e11d48', bodyDark: '#be123c', hair: '#1c1917', skin: '#fcd9b6', acc: '#fbbf24' }, // rose + gold
  { body: '#2563eb', bodyDark: '#1d4ed8', hair: '#fbbf24', skin: '#fcd9b6', acc: '#38bdf8' }, // royal blue
  { body: '#16a34a', bodyDark: '#15803d', hair: '#78350f', skin: '#fde68a', acc: '#fbbf24' }, // forest green
  { body: '#d946ef', bodyDark: '#c026d3', hair: '#1c1917', skin: '#fcd9b6', acc: '#f0abfc' }, // magenta
  { body: '#ea580c', bodyDark: '#c2410c', hair: '#fef3c7', skin: '#fde68a', acc: '#fb923c' }, // burnt orange
  { body: '#7c3aed', bodyDark: '#6d28d9', hair: '#fbbf24', skin: '#fcd9b6', acc: '#a78bfa' }, // violet
  { body: '#0891b2', bodyDark: '#0e7490', hair: '#451a03', skin: '#fde68a', acc: '#22d3ee' }, // teal
  { body: '#ca8a04', bodyDark: '#a16207', hair: '#1c1917', skin: '#fcd9b6', acc: '#fde047' }, // gold
]

const WALK_FRAMES = [
  [0, 0],
  [-1, 1],
  [0, 0],
  [1, -1],
]

function SpriteFrame({ facing, frame, palette, size }) {
  const [ldy, rdy] = WALK_FRAMES[frame]
  const showFront = facing === 'down'
  const showBack = facing === 'up'
  const armSwing = frame === 1 ? 1 : frame === 3 ? -1 : 0

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Shadow */}
      <ellipse cx={8} cy={15} rx={4} ry={1.5} fill="rgba(0,0,0,0.25)" />

      {/* Legs */}
      <rect x={5} y={11 + ldy} width={2} height={3} fill={palette.bodyDark} />
      <rect x={9} y={11 + rdy} width={2} height={3} fill={palette.bodyDark} />
      {/* Shoes */}
      <rect x={5} y={13 + ldy} width={2} height={1} rx={0.5} fill="#44403c" />
      <rect x={9} y={13 + rdy} width={2} height={1} rx={0.5} fill="#44403c" />

      {/* Body */}
      <rect x={4} y={6} width={8} height={6} rx={1} fill={palette.body} />
      {/* Shirt accent stripe */}
      <rect x={4} y={10} width={8} height={1} fill={palette.bodyDark} opacity={0.5} />

      {/* Arms */}
      <rect x={2} y={7 + armSwing} width={2} height={4} rx={1} fill={palette.body} />
      <rect x={12} y={7 - armSwing} width={2} height={4} rx={1} fill={palette.body} />
      {/* Hands */}
      <rect x={2} y={10 + armSwing} width={2} height={1} rx={0.5} fill={palette.skin} />
      <rect x={12} y={10 - armSwing} width={2} height={1} rx={0.5} fill={palette.skin} />

      {/* Head */}
      <rect x={4} y={1} width={8} height={6} rx={2} fill={palette.skin} />

      {/* Hair */}
      {showBack ? (
        <rect x={4} y={0.5} width={8} height={4.5} rx={2} fill={palette.hair} />
      ) : (
        <>
          <rect x={4} y={0.5} width={8} height={3} rx={2} fill={palette.hair} />
          {/* Side bangs */}
          <rect x={3.5} y={2} width={1.5} height={2} rx={0.5} fill={palette.hair} />
          <rect x={11} y={2} width={1.5} height={2} rx={0.5} fill={palette.hair} />
        </>
      )}

      {/* Eyes */}
      {showFront && (
        <>
          <rect x={5.5} y={4} width={1.5} height={1.5} rx={0.5} fill="#1c1917" />
          <rect x={9} y={4} width={1.5} height={1.5} rx={0.5} fill="#1c1917" />
          {/* Eye highlights */}
          <rect x={6.2} y={4} width={0.6} height={0.6} rx={0.3} fill="#fefce8" opacity={0.8} />
          <rect x={9.7} y={4} width={0.6} height={0.6} rx={0.3} fill="#fefce8" opacity={0.8} />
          {/* Mouth */}
          <rect x={7} y={5.8} width={2} height={0.5} rx={0.25} fill="#b91c1c" opacity={0.4} />
        </>
      )}
      {facing === 'left' && (
        <>
          <rect x={4.5} y={4} width={1.5} height={1.5} rx={0.5} fill="#1c1917" />
          <rect x={5.2} y={4} width={0.6} height={0.6} rx={0.3} fill="#fefce8" opacity={0.8} />
        </>
      )}
      {facing === 'right' && (
        <>
          <rect x={10} y={4} width={1.5} height={1.5} rx={0.5} fill="#1c1917" />
          <rect x={10.7} y={4} width={0.6} height={0.6} rx={0.3} fill="#fefce8" opacity={0.8} />
        </>
      )}

      {/* Headband / accessory — festival flair */}
      <rect x={4} y={3} width={8} height={0.8} rx={0.3} fill={palette.acc} opacity={0.7} />
    </svg>
  )
}

export default function PixelSprite({ facing = 'down', isMoving = false, playerIndex = 0, size = 40 }) {
  const palette = PALETTES[playerIndex % PALETTES.length]

  if (!isMoving) {
    return <SpriteFrame facing={facing} frame={0} palette={palette} size={size} />
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {WALK_FRAMES.map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 sprite-walk-frame"
          style={{ animationDelay: `${-i * 150}ms` }}
        >
          <SpriteFrame facing={facing} frame={i} palette={palette} size={size} />
        </div>
      ))}
    </div>
  )
}

export { PALETTES }
