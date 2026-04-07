import { useRef, useEffect, useState, useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { useArena } from '../../hooks/useArena'
import { WORLD_WIDTH, WORLD_HEIGHT, MAX_HP } from '../../lib/arena/physics'
import Character from './Character'

/**
 * Shared arena renderer — pixel-art Songkran temple courtyard.
 * Scales the logical world (800×450) to fit any container.
 * All scenery uses crisp SVG pixel art — no emoji.
 */
export default function Arena({ roomId, playerId, players, joystickRef, quizOverlay, positionsMapRef, selfPositionRef, frozen, onSelfHit, chatChannelRef, chatBubblesMapRef }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  const { positionsRef, targetsRef, hpRef, projectilesRef, hitSignalsRef, eliminationSignalRef, bottleRef, bottleHealRef, chatBubblesRef, channelRef } = useArena({ roomId, playerId, players, joystickRef, frozen, onSelfHit })

  // Splash popup pool — ephemeral, RAF-driven
  const splashPoolRef = useRef([])
  const splashSeenRef = useRef(new Set())

  useEffect(() => {
    if (positionsMapRef) positionsMapRef.current = positionsRef.current
  })

  // Expose own player's position so parent can read it (e.g. for quiz zone report).
  // Set synchronously (not just in useEffect) so it's available immediately on mount.
  if (selfPositionRef && playerId) {
    selfPositionRef.current = positionsRef.current.get(playerId) ?? null
  }

  // Expose arena channel and chat bubbles map so parent can send chat messages
  if (chatChannelRef) chatChannelRef.current = channelRef.current
  if (chatBubblesMapRef) chatBubblesMapRef.current = chatBubblesRef.current

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / WORLD_WIDTH)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Stable palette index based on join order (not filtered renderList index)
  const playerIndexMap = useMemo(() => new Map(players.map((p, i) => [p.id, i])), [players])

  const now = performance.now()

  const renderList = []
  if (positionsRef.current) {
    for (const p of players) {
      const pos = positionsRef.current.get(p.id)
      if (pos) {
        const chat = chatBubblesRef.current.get(p.id)
        renderList.push({
          id: p.id, name: p.name, ...pos, isSelf: p.id === playerId,
          hp: hpRef.current.get(p.id) ?? MAX_HP,
          hitTime: hitSignalsRef.current.get(p.id)?.time ?? 0,
          stableIndex: playerIndexMap.get(p.id) ?? 0,
          chatText: chat && now - chat.time < 3000 ? chat.text : null,
          chatTime: chat?.time ?? 0,
        })
      }
    }
  }

  // Ingest new splash popups from hit signals
  for (const [id, signal] of hitSignalsRef.current) {
    const key = `${id}-${signal.time}`
    if (now - signal.time < 50 && !splashSeenRef.current.has(key)) {
      splashSeenRef.current.add(key)
      splashPoolRef.current.push({ id: key, x: signal.x, y: signal.y, born: signal.time })
    }
  }
  // GC old splashes + old seen keys (in-place compaction, no allocation)
  if (splashPoolRef.current.length > 0) {
    let w = 0
    for (let i = 0; i < splashPoolRef.current.length; i++) {
      if (now - splashPoolRef.current[i].born < 600) splashPoolRef.current[w++] = splashPoolRef.current[i]
    }
    splashPoolRef.current.length = w
  }
  if (splashSeenRef.current.size > 200) splashSeenRef.current.clear()

  // Host screen shake on elimination only (not on mobile)
  const SHAKE_DURATION = 500
  const elimAge = now - (eliminationSignalRef.current?.time ?? 0)
  const isElimShaking = !playerId && elimAge < SHAKE_DURATION
  const shakeX = isElimShaking ? Math.sin(elimAge * 0.08) * 6 * (1 - elimAge / SHAKE_DURATION) : 0

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
          transform: `translate(${shakeX}px, 0) scale(${scale})`,
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
        {renderList.map(({ id, name, x, y, facing, isMoving, isSelf, hp, hitTime, stableIndex, chatText, chatTime }) => (
          <Character
            key={id}
            name={name}
            x={x}
            y={y}
            facing={facing ?? 'down'}
            isMoving={isMoving ?? false}
            isSelf={isSelf}
            playerIndex={stableIndex}
            hp={hp}
            hitTime={hitTime}
            chatText={chatText}
            chatTime={chatTime}
          />
        ))}

        {/* HP Bottle pickup */}
        {bottleRef.current?.active && (
          <BottlePickup x={bottleRef.current.x} y={bottleRef.current.y} now={now} />
        )}

        {/* Bottle heal popup — +10 floating text */}
        {bottleHealRef.current.time > 0 && now - bottleHealRef.current.time < 800 && (
          <HealPopup x={bottleHealRef.current.x} y={bottleHealRef.current.y} born={bottleHealRef.current.time} now={now} />
        )}

        {/* Projectiles — pixel water drops */}
        {projectilesRef.current.map((proj) => (
          <div
            key={proj.id}
            className="absolute pointer-events-none select-none"
            style={{ top: 0, left: 0, transform: `translate3d(${Math.round(proj.x - 6)}px, ${Math.round(proj.y - 6)}px, 0)`, willChange: 'transform' }}
          >
            <WaterDrop />
          </div>
        ))}

        {/* Splash popups */}
        {splashPoolRef.current.map(s => (
          <SplashPopup key={s.id} x={s.x} y={s.y} born={s.born} now={now} />
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Splash popup — 💦 that floats up and fades ─── */
function SplashPopup({ x, y, born, now }) {
  const age = (now - born) / 600
  const opacity = Math.max(0, 1 - age)
  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${Math.round(x - 12)}px, ${Math.round(y - 12 - 30 * age)}px, 0)`,
        fontSize: 20,
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      💦
    </div>
  )
}

/* ─── Pixel water drop projectile ─── */
const WaterDrop = memo(function WaterDrop() {
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
})

/* ─── Arena border — 3px pixel frame ─── */
const PixelFrame = memo(function PixelFrame() {
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
})

/* ─── Precomputed path edge indices ─── */
const PATH_EDGE_COUNT = Math.ceil(WORLD_WIDTH / 8)
const PATH_EDGES = Array.from({ length: PATH_EDGE_COUNT }, (_, i) => i)

/* ─── Ground — tiled pixel grass with dirt path ─── */
const GroundTexture = memo(function GroundTexture() {
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
        {PATH_EDGES.map(i => (
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
})

/* ─── Pixel water puddles ─── */
const WaterPuddles = memo(function WaterPuddles() {
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
})

const PUDDLES = [
  { x: 80, y: 120, w: 48, h: 16, pw: 12, ph: 4 },
  { x: 350, y: 320, w: 56, h: 20, pw: 14, ph: 5 },
  { x: 600, y: 180, w: 40, h: 12, pw: 10, ph: 3 },
  { x: 180, y: 380, w: 44, h: 16, pw: 11, ph: 4 },
  { x: 520, y: 80, w: 36, h: 12, pw: 9, ph: 3 },
  { x: 700, y: 360, w: 48, h: 16, pw: 12, ph: 4 },
]

/* ─── Pixel scenery props ─── */
const SceneryProps = memo(function SceneryProps() {
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
})

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

/* ─── Heal popup — "+10" that floats up and fades ─── */
function HealPopup({ x, y, born, now }) {
  const age = (now - born) / 800
  const opacity = Math.max(0, 1 - age)
  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${Math.round(x - 14)}px, ${Math.round(y - 16 - 30 * age)}px, 0)`,
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: 'monospace',
        color: '#4ade80',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      +10 HP
    </div>
  )
}

/* ─── Bottle pickup — compound: ground glow + sparkles + bottle ─── */
function BottlePickup({ x, y, now }) {
  const bobY = Math.sin(now * 0.004) * 3
  const pulse = 0.4 + Math.sin(now * 0.005) * 0.25 // 0.15–0.65
  const sparklePhase = now * 0.002

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{ top: 0, left: 0, transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`, willChange: 'transform' }}
    >
      {/* Ground glow — pulsing ellipse */}
      <svg
        width={40} height={16}
        viewBox="0 0 40 16"
        style={{ position: 'absolute', left: -20, top: 4, opacity: pulse }}
      >
        <ellipse cx={20} cy={8} rx={18} ry={7} fill="#4ade80" opacity={0.35} />
        <ellipse cx={20} cy={8} rx={12} ry={5} fill="#4ade80" opacity={0.25} />
        <ellipse cx={20} cy={8} rx={6} ry={3} fill="#86efac" opacity={0.3} />
      </svg>

      {/* Orbiting sparkle pixels */}
      {SPARKLE_OFFSETS.map((s, i) => {
        const angle = sparklePhase + s.phase
        const sx = Math.cos(angle) * s.r
        const sy = Math.sin(angle) * s.r * 0.5 // squashed orbit
        const sparkleOpacity = 0.4 + Math.sin(now * 0.008 + i * 2) * 0.4
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sx - 1,
              top: sy - 16 + bobY - 1,
              width: 3,
              height: 3,
              background: s.color,
              opacity: sparkleOpacity,
              imageRendering: 'pixelated',
            }}
          />
        )
      })}

      {/* Bottle — larger, with bob */}
      <svg
        width={20} height={30}
        viewBox="0 0 8 12"
        shapeRendering="crispEdges"
        style={{
          imageRendering: 'pixelated',
          position: 'absolute',
          left: -10,
          top: -28 + bobY,
        }}
      >
        {/* Cap */}
        <rect x={3} y={0} width={2} height={1} fill="#6b3a1a" />
        {/* Neck */}
        <rect x={3} y={1} width={2} height={1} fill="#c44030" />
        <rect x={3} y={2} width={2} height={1} fill="#b83828" />
        {/* Body top */}
        <rect x={2} y={3} width={4} height={1} fill="#e04838" />
        <rect x={1} y={4} width={6} height={1} fill="#e04838" />
        <rect x={1} y={5} width={6} height={1} fill="#d43830" />
        {/* Label */}
        <rect x={1} y={6} width={6} height={1} fill="#fde68a" />
        <rect x={1} y={7} width={6} height={1} fill="#f59e0b" />
        {/* Body bottom */}
        <rect x={1} y={8} width={6} height={1} fill="#d43830" />
        <rect x={1} y={9} width={6} height={1} fill="#c44030" />
        <rect x={2} y={10} width={4} height={1} fill="#b83828" />
        {/* Base */}
        <rect x={2} y={11} width={4} height={1} fill="#8b2020" />
        {/* Highlight */}
        <rect x={2} y={4} width={1} height={2} fill="#f06858" />
        <rect x={3} y={3} width={1} height={1} fill="#f06858" />
      </svg>

      {/* HP label — pixel tag below bottle */}
      <div
        style={{
          position: 'absolute',
          left: -12,
          top: 6,
          fontSize: 7,
          fontWeight: 'bold',
          fontFamily: 'monospace',
          color: '#4ade80',
          textShadow: '0 0 4px rgba(74,222,128,0.6), 0 1px 1px rgba(0,0,0,0.8)',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
        }}
      >
        +10 HP
      </div>
    </div>
  )
}

const SPARKLE_OFFSETS = [
  { r: 14, phase: 0, color: '#fde68a' },
  { r: 16, phase: Math.PI * 0.66, color: '#86efac' },
  { r: 13, phase: Math.PI * 1.33, color: '#fbbf24' },
  { r: 15, phase: Math.PI * 0.33, color: '#4ade80' },
]

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
