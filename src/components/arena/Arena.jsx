import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useArena } from '../../hooks/useArena'
import { WORLD_WIDTH, WORLD_HEIGHT, MAX_HP } from '../../lib/arena/physics'
import Character from './Character'

/**
 * Shared arena renderer — pixel-art Songkran temple courtyard.
 * Scales the logical world (800×450) to fit any container.
 * All scenery uses crisp SVG pixel art — no emoji.
 */
export default function Arena({ roomId, playerId, players, joystickRef, quizOverlay, positionsMapRef, frozen }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  const { positionsRef, targetsRef, hpRef, projectilesRef } = useArena({ roomId, playerId, players, joystickRef, frozen })

  useEffect(() => {
    // Expose broadcast targets (not lerped positions) so host quiz detection
    // uses the actual position the mobile client reported.
    if (positionsMapRef) positionsMapRef.current = targetsRef.current
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / WORLD_WIDTH)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const renderList = []
  if (positionsRef.current) {
    for (const p of players) {
      const pos = positionsRef.current.get(p.id)
      if (pos) renderList.push({ player: p, ...pos, hp: hpRef.current.get(p.id) ?? MAX_HP })
    }
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full overflow-hidden"
      style={{
        height: WORLD_HEIGHT * scale,
        imageRendering: 'pixelated',
      }}
    >
      <div
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          background: '#4a6b3a',
          imageRendering: 'pixelated',
        }}
      >
        {/* Pixel border frame */}
        <PixelFrame />

        {/* Ground layers */}
        <GroundTexture />
        {!quizOverlay && <WaterPuddles />}
        {!quizOverlay && <SceneryProps />}

        {/* Quiz zone overlay */}
        {quizOverlay}

        {/* Characters */}
        {renderList.map(({ player, x, y, facing, isMoving, hp }, i) => (
          <Character
            key={player.id}
            player={player}
            x={x}
            y={y}
            facing={facing ?? 'down'}
            isMoving={isMoving ?? false}
            isSelf={player.id === playerId}
            playerIndex={i}
            hp={hp}
          />
        ))}

        {/* Projectiles — pixel water drops */}
        {projectilesRef.current.map((proj) => (
          <div
            key={proj.id}
            className="absolute pointer-events-none select-none"
            style={{ left: proj.x - 6, top: proj.y - 6 }}
          >
            <WaterDrop />
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Pixel water drop projectile ─── */
function WaterDrop() {
  return (
    <svg width={12} height={12} viewBox="0 0 8 8" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x={3} y={0} width={2} height={1} fill="#7dd3e8" />
      <rect x={2} y={1} width={4} height={1} fill="#4ab8d4" />
      <rect x={1} y={2} width={6} height={1} fill="#4ab8d4" />
      <rect x={1} y={3} width={6} height={1} fill="#2a95b3" />
      <rect x={1} y={4} width={6} height={1} fill="#2a95b3" />
      <rect x={2} y={5} width={4} height={1} fill="#1d7490" />
      <rect x={3} y={6} width={2} height={1} fill="#1d7490" />
      {/* Highlight */}
      <rect x={2} y={2} width={1} height={1} fill="#a5f3fc" />
      <rect x={3} y={1} width={1} height={1} fill="#cffafe" />
    </svg>
  )
}

/* ─── Arena border — 3px pixel frame ─── */
function PixelFrame() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: '#2d1a0e' }} />
      <div className="absolute left-0 right-0" style={{ top: 1, height: 1, background: '#8b6a3e' }} />
      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: '#2d1a0e' }} />
      <div className="absolute left-0 right-0" style={{ bottom: 1, height: 1, background: '#8b6a3e' }} />
      {/* Left border */}
      <div className="absolute top-0 bottom-0 left-0" style={{ width: 3, background: '#2d1a0e' }} />
      <div className="absolute top-0 bottom-0" style={{ left: 1, width: 1, background: '#8b6a3e' }} />
      {/* Right border */}
      <div className="absolute top-0 bottom-0 right-0" style={{ width: 3, background: '#2d1a0e' }} />
      <div className="absolute top-0 bottom-0" style={{ right: 1, width: 1, background: '#8b6a3e' }} />
      {/* Corner accents — gold pixels */}
      <div className="absolute" style={{ top: 0, left: 0, width: 3, height: 3, background: '#d4982b' }} />
      <div className="absolute" style={{ top: 0, right: 0, width: 3, height: 3, background: '#d4982b' }} />
      <div className="absolute" style={{ bottom: 0, left: 0, width: 3, height: 3, background: '#d4982b' }} />
      <div className="absolute" style={{ bottom: 0, right: 0, width: 3, height: 3, background: '#d4982b' }} />
    </div>
  )
}

/* ─── Ground — tiled pixel grass with dirt path ─── */
function GroundTexture() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Base tile pattern via repeating SVG */}
      <svg
        className="absolute inset-0"
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated' }}
      >
        <defs>
          {/* 16×16 grass tile */}
          <pattern id="grass-tile" x={0} y={0} width={16} height={16} patternUnits="userSpaceOnUse">
            {/* Base green */}
            <rect width={16} height={16} fill="#4a6b3a" />
            {/* Grass detail pixels — scattered lighter/darker tufts */}
            <rect x={2} y={3} width={1} height={1} fill="#5a7d47" />
            <rect x={7} y={1} width={1} height={1} fill="#5a7d47" />
            <rect x={12} y={5} width={1} height={1} fill="#5a7d47" />
            <rect x={4} y={9} width={1} height={1} fill="#3d5c2e" />
            <rect x={10} y={11} width={1} height={1} fill="#5a7d47" />
            <rect x={14} y={2} width={1} height={1} fill="#3d5c2e" />
            <rect x={1} y={13} width={1} height={1} fill="#5a7d47" />
            <rect x={8} y={7} width={1} height={1} fill="#3d5c2e" />
            <rect x={6} y={14} width={1} height={1} fill="#5a7d47" />
            <rect x={13} y={10} width={1} height={1} fill="#3d5c2e" />
            <rect x={0} y={7} width={1} height={1} fill="#557542" />
            <rect x={9} y={14} width={1} height={1} fill="#557542" />
            <rect x={15} y={8} width={1} height={1} fill="#557542" />
            <rect x={3} y={0} width={1} height={1} fill="#557542" />
            <rect x={11} y={4} width={1} height={1} fill="#557542" />
          </pattern>

          {/* 16×16 dirt tile */}
          <pattern id="dirt-tile" x={0} y={0} width={16} height={16} patternUnits="userSpaceOnUse">
            <rect width={16} height={16} fill="#7a6840" />
            <rect x={3} y={2} width={1} height={1} fill="#8b7848" />
            <rect x={9} y={5} width={1} height={1} fill="#6b5a35" />
            <rect x={1} y={10} width={1} height={1} fill="#8b7848" />
            <rect x={14} y={3} width={1} height={1} fill="#6b5a35" />
            <rect x={7} y={12} width={1} height={1} fill="#8b7848" />
            <rect x={5} y={7} width={1} height={1} fill="#6b5a35" />
            <rect x={12} y={14} width={1} height={1} fill="#8b7848" />
            <rect x={0} y={0} width={1} height={1} fill="#6b5a35" />
            <rect x={10} y={9} width={1} height={1} fill="#8b7848" />
          </pattern>

          {/* 16×16 stone tile */}
          <pattern id="stone-tile" x={0} y={0} width={16} height={16} patternUnits="userSpaceOnUse">
            <rect width={16} height={16} fill="#6b6b60" />
            {/* Tile grid lines */}
            <rect x={0} y={0} width={16} height={1} fill="#5a5a52" />
            <rect x={0} y={0} width={1} height={16} fill="#5a5a52" />
            <rect x={8} y={0} width={1} height={16} fill="#5a5a52" />
            <rect x={0} y={8} width={16} height={1} fill="#5a5a52" />
            {/* Highlight */}
            <rect x={1} y={1} width={1} height={1} fill="#7a7a6e" />
            <rect x={9} y={1} width={1} height={1} fill="#7a7a6e" />
            <rect x={1} y={9} width={1} height={1} fill="#7a7a6e" />
            <rect x={9} y={9} width={1} height={1} fill="#7a7a6e" />
          </pattern>
        </defs>

        {/* Grass fill */}
        <rect width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="url(#grass-tile)" />

        {/* Dirt path — horizontal across middle */}
        <rect x={0} y={195} width={WORLD_WIDTH} height={60} fill="url(#dirt-tile)" />
        {/* Path edges — dithered grass/dirt transition */}
        {Array.from({ length: Math.ceil(WORLD_WIDTH / 8) }, (_, i) => (
          <g key={`path-edge-${i}`}>
            <rect x={i * 8} y={193 + (i % 3)} width={4} height={2} fill="#5a7040" />
            <rect x={i * 8 + 4} y={254 - (i % 3)} width={4} height={2} fill="#5a7040" />
          </g>
        ))}

        {/* Stone courtyard — center area */}
        <rect x={300} y={150} width={200} height={150} fill="url(#stone-tile)" />
        {/* Stone edges */}
        <rect x={300} y={150} width={200} height={2} fill="#5a5a4e" />
        <rect x={300} y={298} width={200} height={2} fill="#5a5a4e" />
        <rect x={300} y={150} width={2} height={150} fill="#5a5a4e" />
        <rect x={498} y={150} width={2} height={150} fill="#5a5a4e" />

        {/* Grass color variation patches */}
        <rect x={50} y={60} width={80} height={50} fill="#4f7340" opacity={0.6} />
        <rect x={600} y={320} width={100} height={60} fill="#436333" opacity={0.5} />
        <rect x={150} y={340} width={70} height={40} fill="#4f7340" opacity={0.4} />
      </svg>
    </div>
  )
}

/* ─── Pixel water puddles ─── */
function WaterPuddles() {
  return (
    <>
      {PUDDLES.map((p, i) => (
        <svg
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: p.x,
            top: p.y,
            imageRendering: 'pixelated',
            animation: `puddle-shimmer ${2.5 + i * 0.4}s ease-in-out infinite alternate`,
          }}
          width={p.w}
          height={p.h}
          viewBox={`0 0 ${p.pw} ${p.ph}`}
          shapeRendering="crispEdges"
        >
          {/* Puddle body */}
          <rect x={1} y={1} width={p.pw - 2} height={p.ph - 2} fill="#3a8ab0" />
          {/* Edge — darker */}
          <rect x={0} y={1} width={1} height={p.ph - 2} fill="#2a6a88" />
          <rect x={p.pw - 1} y={1} width={1} height={p.ph - 2} fill="#2a6a88" />
          <rect x={1} y={0} width={p.pw - 2} height={1} fill="#2a6a88" />
          <rect x={1} y={p.ph - 1} width={p.pw - 2} height={1} fill="#2a6a88" />
          {/* Highlight shimmer */}
          <rect x={2} y={1} width={2} height={1} fill="#7dd3e8" />
          <rect x={Math.floor(p.pw / 2)} y={2} width={1} height={1} fill="#a5f3fc" />
        </svg>
      ))}
    </>
  )
}

const PUDDLES = [
  { x: 80, y: 120, w: 48, h: 16, pw: 12, ph: 4 },
  { x: 350, y: 320, w: 56, h: 20, pw: 14, ph: 5 },
  { x: 600, y: 180, w: 40, h: 12, pw: 10, ph: 3 },
  { x: 180, y: 380, w: 44, h: 16, pw: 11, ph: 4 },
  { x: 520, y: 80, w: 36, h: 12, pw: 9, ph: 3 },
  { x: 700, y: 360, w: 48, h: 16, pw: 12, ph: 4 },
]

/* ─── Pixel scenery props ─── */
function SceneryProps() {
  return (
    <>
      {/* Trees */}
      <PixelTree x={15} y={5} size={36} variant="round" />
      <PixelTree x={725} y={10} size={32} variant="round" flip />
      <PixelTree x={55} y={355} size={28} variant="bush" />
      <PixelTree x={715} y={365} size={24} variant="bush" flip />

      {/* Lanterns */}
      <PixelLantern x={160} y={6} size={26} />
      <PixelLantern x={450} y={3} size={24} />
      <PixelLantern x={640} y={8} size={26} />

      {/* Flowers — jasmine & marigold */}
      <PixelFlower x={380} y={395} color="#fde68a" size={14} />
      <PixelFlower x={200} y={135} color="#f9a8d4" size={12} />
      <PixelFlower x={680} y={225} color="#fb923c" size={13} />
      <PixelFlower x={120} y={75} color="#fde68a" size={11} />
      <PixelFlower x={560} y={375} color="#f9a8d4" size={12} />

      {/* Water splashes — decorative */}
      <PixelSplash x={300} y={65} size={16} />
      <PixelSplash x={550} y={345} size={14} />
      <PixelSplash x={130} y={255} size={12} />

      {/* Temple gate — background element */}
      <PixelTempleGate x={365} y={410} size={70} />
    </>
  )
}

/* ─── Pixel tree — SVG inline ─── */
function PixelTree({ x, y, size, variant = 'round', flip }) {
  const isRound = variant === 'round'
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : undefined,
        opacity: 0.8,
      }}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
    >
      {isRound ? (
        <>
          {/* Round tree canopy */}
          <rect x={4} y={0} width={8} height={1} fill="#2d5a1e" />
          <rect x={3} y={1} width={10} height={1} fill="#3a7028" />
          <rect x={2} y={2} width={12} height={1} fill="#3a7028" />
          <rect x={2} y={3} width={12} height={1} fill="#4a8535" />
          <rect x={2} y={4} width={12} height={1} fill="#4a8535" />
          <rect x={2} y={5} width={12} height={1} fill="#3a7028" />
          <rect x={3} y={6} width={10} height={1} fill="#3a7028" />
          <rect x={4} y={7} width={8} height={1} fill="#2d5a1e" />
          {/* Canopy highlights */}
          <rect x={5} y={1} width={2} height={1} fill="#5a9d42" />
          <rect x={4} y={3} width={1} height={1} fill="#5a9d42" />
          <rect x={8} y={2} width={2} height={1} fill="#5a9d42" />
          {/* Trunk */}
          <rect x={7} y={8} width={2} height={5} fill="#6b4a28" />
          <rect x={7} y={8} width={1} height={5} fill="#7a5a35" />
          {/* Trunk base */}
          <rect x={6} y={13} width={4} height={1} fill="#5a3a1a" />
        </>
      ) : (
        <>
          {/* Bush / shrub */}
          <rect x={3} y={5} width={10} height={1} fill="#2d5a1e" />
          <rect x={2} y={6} width={12} height={1} fill="#3a7028" />
          <rect x={1} y={7} width={14} height={1} fill="#4a8535" />
          <rect x={1} y={8} width={14} height={1} fill="#4a8535" />
          <rect x={1} y={9} width={14} height={1} fill="#3a7028" />
          <rect x={2} y={10} width={12} height={1} fill="#3a7028" />
          <rect x={3} y={11} width={10} height={1} fill="#2d5a1e" />
          {/* Bush highlights */}
          <rect x={4} y={6} width={2} height={1} fill="#5a9d42" />
          <rect x={9} y={7} width={2} height={1} fill="#5a9d42" />
          {/* Ground line */}
          <rect x={2} y={12} width={12} height={1} fill="#3d5c2e" />
        </>
      )}
    </svg>
  )
}

/* ─── Pixel lantern ─── */
function PixelLantern({ x, y, size }) {
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        imageRendering: 'pixelated',
        animation: 'float-gentle 3s ease-in-out infinite',
      }}
      width={size}
      height={size}
      viewBox="0 0 10 16"
      shapeRendering="crispEdges"
    >
      {/* Hanging string */}
      <rect x={4} y={0} width={1} height={3} fill="#8b6a3e" />
      {/* Top cap */}
      <rect x={3} y={3} width={4} height={1} fill="#d4982b" />
      {/* Lantern body */}
      <rect x={2} y={4} width={6} height={1} fill="#c44030" />
      <rect x={1} y={5} width={8} height={1} fill="#e04838" />
      <rect x={1} y={6} width={8} height={1} fill="#e04838" />
      <rect x={1} y={7} width={8} height={1} fill="#e04838" />
      <rect x={1} y={8} width={8} height={1} fill="#e04838" />
      <rect x={2} y={9} width={6} height={1} fill="#c44030" />
      {/* Lantern highlight */}
      <rect x={2} y={5} width={1} height={3} fill="#f06858" />
      {/* Gold bands */}
      <rect x={1} y={6} width={8} height={1} fill="#d4982b" opacity={0.6} />
      {/* Bottom fringe */}
      <rect x={3} y={10} width={4} height={1} fill="#d4982b" />
      <rect x={3} y={11} width={1} height={1} fill="#e8b84a" />
      <rect x={5} y={11} width={1} height={1} fill="#e8b84a" />
      {/* Glow underneath */}
      <rect x={2} y={12} width={6} height={1} fill="#e04838" opacity={0.2} />
    </svg>
  )
}

/* ─── Pixel flower ─── */
function PixelFlower({ x, y, color, size }) {
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: x, top: y, imageRendering: 'pixelated', opacity: 0.7 }}
      width={size}
      height={size}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
    >
      {/* Petals */}
      <rect x={3} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={2} width={1} height={1} fill={color} />
      <rect x={5} y={2} width={1} height={1} fill={color} />
      <rect x={2} y={4} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      {/* Center */}
      <rect x={3} y={2} width={1} height={1} fill="#fbbf24" />
      {/* Stem */}
      <rect x={3} y={5} width={1} height={2} fill="#4a8535" />
    </svg>
  )
}

/* ─── Pixel water splash ─── */
function PixelSplash({ x, y, size }) {
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: x, top: y, imageRendering: 'pixelated', opacity: 0.35 }}
      width={size}
      height={size}
      viewBox="0 0 8 6"
      shapeRendering="crispEdges"
    >
      {/* Splash drops */}
      <rect x={1} y={0} width={1} height={1} fill="#7dd3e8" />
      <rect x={5} y={0} width={1} height={1} fill="#7dd3e8" />
      <rect x={0} y={2} width={1} height={1} fill="#4ab8d4" />
      <rect x={3} y={1} width={2} height={1} fill="#4ab8d4" />
      <rect x={7} y={1} width={1} height={1} fill="#4ab8d4" />
      {/* Base puddle */}
      <rect x={2} y={3} width={4} height={1} fill="#2a95b3" />
      <rect x={1} y={4} width={6} height={1} fill="#2a95b3" />
      {/* Highlight */}
      <rect x={3} y={3} width={1} height={1} fill="#a5f3fc" />
    </svg>
  )
}

/* ─── Pixel temple gate — background prop ─── */
function PixelTempleGate({ x, y, size }) {
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: x, top: y, imageRendering: 'pixelated', opacity: 0.2 }}
      width={size}
      height={size * 0.75}
      viewBox="0 0 20 15"
      shapeRendering="crispEdges"
    >
      {/* Pillars */}
      <rect x={2} y={4} width={3} height={11} fill="#8b6a3e" />
      <rect x={15} y={4} width={3} height={11} fill="#8b6a3e" />
      {/* Pillar highlights */}
      <rect x={2} y={4} width={1} height={11} fill="#a37d4a" />
      <rect x={15} y={4} width={1} height={11} fill="#a37d4a" />
      {/* Roof — tiered */}
      <rect x={0} y={3} width={20} height={1} fill="#c44030" />
      <rect x={1} y={2} width={18} height={1} fill="#e04838" />
      <rect x={3} y={1} width={14} height={1} fill="#c44030" />
      <rect x={6} y={0} width={8} height={1} fill="#e04838" />
      {/* Roof tips */}
      <rect x={0} y={2} width={1} height={1} fill="#d4982b" />
      <rect x={19} y={2} width={1} height={1} fill="#d4982b" />
      {/* Gold ornament on top */}
      <rect x={9} y={0} width={2} height={1} fill="#d4982b" />
    </svg>
  )
}
