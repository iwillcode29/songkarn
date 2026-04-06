import { memo } from 'react'

/**
 * Pixel-art RPG character — inline SVG, 16×16 grid.
 * 4 directions × 4 walk frames, 8 Songkran-festival palettes.
 *
 * Every coordinate snaps to the integer grid for crispy pixel rendering.
 * No rounded corners — true pixel art has sharp edges.
 */

const FRAME_W = 16
const FRAME_H = 16

// Songkran festival palettes — vibrant, warm, celebratory
const PALETTES = [
  { body: '#e11d48', bodyDark: '#9f1239', bodyLight: '#fb7185', hair: '#1c1917', hairHi: '#44403c', skin: '#fcd9b6', skinShade: '#e8b88a', acc: '#fbbf24', accDark: '#d97706', outline: '#4a0519' },
  { body: '#2563eb', bodyDark: '#1e3a8a', bodyLight: '#60a5fa', hair: '#fbbf24', hairHi: '#fde68a', skin: '#fcd9b6', skinShade: '#e8b88a', acc: '#38bdf8', accDark: '#0284c7', outline: '#1e1b4b' },
  { body: '#16a34a', bodyDark: '#14532d', bodyLight: '#4ade80', hair: '#78350f', hairHi: '#a16207', skin: '#fde68a', skinShade: '#d4a843', acc: '#fbbf24', accDark: '#d97706', outline: '#052e16' },
  { body: '#d946ef', bodyDark: '#86198f', bodyLight: '#f0abfc', hair: '#1c1917', hairHi: '#44403c', skin: '#fcd9b6', skinShade: '#e8b88a', acc: '#f0abfc', accDark: '#c026d3', outline: '#4a044e' },
  { body: '#ea580c', bodyDark: '#7c2d12', bodyLight: '#fb923c', hair: '#fef3c7', hairHi: '#ffffff', skin: '#fde68a', skinShade: '#d4a843', acc: '#fb923c', accDark: '#c2410c', outline: '#431407' },
  { body: '#7c3aed', bodyDark: '#3b0764', bodyLight: '#a78bfa', hair: '#fbbf24', hairHi: '#fde68a', skin: '#fcd9b6', skinShade: '#e8b88a', acc: '#a78bfa', accDark: '#6d28d9', outline: '#2e1065' },
  { body: '#0891b2', bodyDark: '#164e63', bodyLight: '#22d3ee', hair: '#451a03', hairHi: '#78350f', skin: '#fde68a', skinShade: '#d4a843', acc: '#22d3ee', accDark: '#0e7490', outline: '#083344' },
  { body: '#ca8a04', bodyDark: '#713f12', bodyLight: '#facc15', hair: '#1c1917', hairHi: '#44403c', skin: '#fcd9b6', skinShade: '#e8b88a', acc: '#fde047', accDark: '#a16207', outline: '#422006' },
]

const WALK_FRAMES = [
  [0, 0],
  [-1, 1],
  [0, 0],
  [1, -1],
]

/** Single pixel helper */
function Px({ x, y, fill, opacity }) {
  return <rect x={x} y={y} width={1} height={1} fill={fill} opacity={opacity} />
}

/** Multi-pixel row helper */
function Row({ x, y, w, fill, opacity }) {
  return <rect x={x} y={y} width={w} height={1} fill={fill} opacity={opacity} />
}

/** Multi-pixel block helper */
function Block({ x, y, w, h, fill, opacity }) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} opacity={opacity} />
}

function SpriteFrame({ facing, frame, palette, size }) {
  const [ldy, rdy] = WALK_FRAMES[frame]
  const showFront = facing === 'down'
  const showBack = facing === 'up'
  const showLeft = facing === 'left'
  const showRight = facing === 'right'
  const armSwing = frame === 1 ? 1 : frame === 3 ? -1 : 0

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      style={{ imageRendering: 'pixelated' }}
      shapeRendering="crispEdges"
    >
      {/* Ground shadow */}
      <Row x={5} y={15} w={6} fill="#000" opacity={0.2} />
      <Row x={4} y={14} w={8} fill="#000" opacity={0.12} />

      {/* === LEGS === */}
      {/* Left leg */}
      <Block x={5} y={11 + ldy} w={2} h={3} fill={palette.bodyDark} />
      <Px x={5} y={11 + ldy} fill={palette.body} />
      {/* Right leg */}
      <Block x={9} y={11 + rdy} w={2} h={3} fill={palette.bodyDark} />
      <Px x={10} y={11 + rdy} fill={palette.body} />

      {/* Shoes — dark with highlight */}
      <Row x={5} y={13 + ldy} w={2} fill="#292524" />
      <Px x={5} y={13 + ldy} fill="#44403c" />
      <Row x={9} y={13 + rdy} w={2} fill="#292524" />
      <Px x={10} y={13 + rdy} fill="#44403c" />

      {/* === BODY === */}
      {/* Shirt main */}
      <Block x={4} y={7} w={8} h={4} fill={palette.body} />
      {/* Shirt shading — left edge darker */}
      <Block x={4} y={7} w={1} h={4} fill={palette.bodyDark} />
      {/* Shirt highlight — right side */}
      <Px x={11} y={7} fill={palette.bodyLight} />
      <Px x={11} y={8} fill={palette.bodyLight} />
      {/* Belt / hem accent */}
      <Row x={4} y={10} w={8} fill={palette.bodyDark} />
      {/* Collar */}
      <Row x={5} y={7} w={6} fill={palette.bodyLight} />

      {/* Songkran sash — diagonal accent across shirt */}
      {showFront && (
        <>
          <Px x={5} y={7} fill={palette.acc} />
          <Px x={6} y={8} fill={palette.acc} />
          <Px x={7} y={9} fill={palette.acc} />
          <Px x={8} y={10} fill={palette.acc} />
        </>
      )}

      {/* === ARMS === */}
      {/* Left arm */}
      <Block x={3} y={7 + armSwing} w={1} h={4} fill={palette.body} />
      <Px x={3} y={7 + armSwing} fill={palette.bodyDark} />
      {/* Left hand */}
      <Px x={3} y={10 + armSwing} fill={palette.skin} />

      {/* Right arm */}
      <Block x={12} y={7 - armSwing} w={1} h={4} fill={palette.body} />
      <Px x={12} y={7 - armSwing} fill={palette.bodyLight} />
      {/* Right hand */}
      <Px x={12} y={10 - armSwing} fill={palette.skin} />

      {/* === HEAD === */}
      {/* Head base — 8px wide, 5px tall */}
      <Block x={4} y={2} w={8} h={5} fill={palette.skin} />
      {/* Cheek shading */}
      <Px x={4} y={4} fill={palette.skinShade} />
      <Px x={11} y={4} fill={palette.skinShade} />
      {/* Chin shading */}
      <Row x={5} y={6} w={6} fill={palette.skinShade} />
      {/* Forehead highlight */}
      <Row x={6} y={2} w={4} fill="#fef3c7" opacity={0.3} />

      {/* Ears */}
      <Px x={3} y={4} fill={palette.skin} />
      <Px x={12} y={4} fill={palette.skinShade} />

      {/* === HAIR === */}
      {showBack ? (
        /* Back view — full hair coverage */
        <>
          <Block x={4} y={0} w={8} h={5} fill={palette.hair} />
          <Row x={5} y={0} w={6} fill={palette.hairHi} />
          <Px x={3} y={2} fill={palette.hair} />
          <Px x={12} y={2} fill={palette.hair} />
          {/* Hair shine */}
          <Px x={6} y={1} fill={palette.hairHi} />
          <Px x={7} y={1} fill={palette.hairHi} />
        </>
      ) : (
        /* Front/side view — top hair + bangs */
        <>
          <Block x={4} y={0} w={8} h={3} fill={palette.hair} />
          <Row x={5} y={0} w={6} fill={palette.hairHi} />
          {/* Side tufts */}
          <Block x={3} y={1} w={1} h={3} fill={palette.hair} />
          <Block x={12} y={1} w={1} h={3} fill={palette.hair} />
          {/* Hair shine */}
          <Px x={6} y={0} fill={palette.hairHi} />
          <Px x={7} y={0} fill={palette.hairHi} />
          {/* Bangs fringe */}
          <Px x={5} y={2} fill={palette.hair} />
          <Px x={10} y={2} fill={palette.hair} />
        </>
      )}

      {/* === HEADBAND / FESTIVAL GARLAND === */}
      <Row x={3} y={2} w={10} fill={palette.acc} />
      {/* Garland knot/flower detail */}
      <Px x={3} y={2} fill={palette.accDark} />
      <Px x={12} y={2} fill={palette.accDark} />
      {/* Center flower on headband */}
      <Px x={7} y={1} fill={palette.acc} />
      <Px x={8} y={1} fill={palette.acc} />

      {/* === FACE === */}
      {showFront && (
        <>
          {/* Eyes — 2px wide each for expressiveness */}
          <Row x={5} y={4} w={2} fill="#1c1917" />
          <Row x={9} y={4} w={2} fill="#1c1917" />
          {/* Eye whites / highlights — top-left pixel */}
          <Px x={5} y={4} fill="#fefce8" />
          <Px x={9} y={4} fill="#fefce8" />
          {/* Blush marks */}
          <Px x={4} y={5} fill="#fca5a5" opacity={0.5} />
          <Px x={11} y={5} fill="#fca5a5" opacity={0.5} />
          {/* Mouth — happy smile */}
          <Px x={7} y={5} fill="#b91c1c" opacity={0.6} />
          <Px x={8} y={5} fill="#b91c1c" opacity={0.6} />
        </>
      )}
      {showLeft && (
        <>
          {/* Side-facing eye */}
          <Row x={5} y={4} w={2} fill="#1c1917" />
          <Px x={5} y={4} fill="#fefce8" />
          {/* Side mouth hint */}
          <Px x={6} y={5} fill="#b91c1c" opacity={0.4} />
        </>
      )}
      {showRight && (
        <>
          <Row x={9} y={4} w={2} fill="#1c1917" />
          <Px x={10} y={4} fill="#fefce8" />
          <Px x={9} y={5} fill="#b91c1c" opacity={0.4} />
        </>
      )}

      {/* === WATER GUN === */}
      {/* Classic Super Soaker — green body, orange pump, blue nozzle */}
      {showFront && (
        <>
          {/* Gun body — extends right from hand */}
          <Row x={13} y={9 - armSwing} w={2} fill="#22c55e" />
          {/* Pump / tank top */}
          <Px x={13} y={8 - armSwing} fill="#f97316" />
          {/* Nozzle */}
          <Px x={15} y={9 - armSwing} fill="#38bdf8" />
          {/* Grip shadow */}
          <Px x={13} y={10 - armSwing} fill="#15803d" />
        </>
      )}
      {showBack && (
        <>
          <Row x={13} y={9 - armSwing} w={2} fill="#22c55e" />
          <Px x={13} y={8 - armSwing} fill="#f97316" />
          <Px x={15} y={9 - armSwing} fill="#38bdf8" />
          <Px x={13} y={10 - armSwing} fill="#15803d" />
        </>
      )}
      {showRight && (
        <>
          {/* Gun points right — longer barrel visible */}
          <Row x={13} y={9 - armSwing} w={3} fill="#22c55e" />
          <Px x={13} y={8 - armSwing} fill="#f97316" />
          <Px x={14} y={8 - armSwing} fill="#f97316" />
          {/* Nozzle tip with water drip */}
          <Px x={15} y={8 - armSwing} fill="#38bdf8" />
          <Px x={15} y={10 - armSwing} fill="#15803d" />
        </>
      )}
      {showLeft && (
        <>
          {/* Gun in left hand, points left */}
          <Row x={0} y={9 + armSwing} w={3} fill="#22c55e" />
          <Px x={1} y={8 + armSwing} fill="#f97316" />
          <Px x={2} y={8 + armSwing} fill="#f97316" />
          {/* Nozzle */}
          <Px x={0} y={8 + armSwing} fill="#38bdf8" />
          <Px x={0} y={10 + armSwing} fill="#15803d" />
        </>
      )}

      {/* === OUTLINE (subtle dark border for definition) === */}
      {/* Head outline — top */}
      <Row x={4} y={0} w={8} fill={palette.outline} opacity={0.25} />
      {/* Body outline — sides */}
      <Block x={3} y={7} w={1} h={4} fill={palette.outline} opacity={0.15} />
      <Block x={12} y={7} w={1} h={4} fill={palette.outline} opacity={0.15} />
    </svg>
  )
}

const PixelSprite = memo(function PixelSprite({ facing = 'down', isMoving = false, playerIndex = 0, size = 40 }) {
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
})

export default PixelSprite
export { PALETTES }
