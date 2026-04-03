import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useArena } from '../../hooks/useArena'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../lib/arena/physics'
import Character from './Character'

/**
 * Shared arena renderer — Songkran temple courtyard theme.
 * Scales the logical world (800×450) to fit any container.
 */
export default function Arena({ roomId, playerId, players, joystickRef }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  const { positionsRef } = useArena({ roomId, playerId, players, joystickRef })

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
      if (pos) renderList.push({ player: p, ...pos })
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
        borderRadius: 12,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          background: '#5a7247',
        }}
      >
        {/* Ground layers */}
        <GroundTexture />
        <WaterPuddles />
        <SceneryProps />

        {/* Characters */}
        {renderList.map(({ player, x, y, facing, isMoving }, i) => (
          <Character
            key={player.id}
            player={player}
            x={x}
            y={y}
            facing={facing ?? 'down'}
            isMoving={isMoving ?? false}
            isSelf={player.id === playerId}
            playerIndex={i}
          />
        ))}
      </div>
    </motion.div>
  )
}

/** Layered ground — stone tiles with grass patches */
function GroundTexture() {
  return (
    <>
      {/* Base: warm stone tile pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            // Tile grid lines
            'linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
            'linear-gradient(0deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
            // Subtle colour variation
            'radial-gradient(ellipse 120px 80px at 200px 100px, rgba(139,169,98,0.3), transparent)',
            'radial-gradient(ellipse 100px 100px at 600px 350px, rgba(139,169,98,0.25), transparent)',
            'radial-gradient(ellipse 80px 60px at 400px 250px, rgba(107,142,72,0.2), transparent)',
          ].join(','),
          backgroundSize: '48px 48px, 48px 48px, 100% 100%, 100% 100%, 100% 100%',
        }}
      />
      {/* Dirt path across the middle */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0,
          right: 0,
          top: 190,
          height: 70,
          background: 'linear-gradient(180deg, transparent, rgba(120,100,60,0.15) 30%, rgba(120,100,60,0.15) 70%, transparent)',
        }}
      />
    </>
  )
}

/** Animated water puddles — Songkran aftermath */
function WaterPuddles() {
  return (
    <>
      {PUDDLES.map((p, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.w,
            height: p.h,
            background: 'radial-gradient(ellipse, rgba(96,185,220,0.18) 0%, rgba(96,185,220,0.06) 60%, transparent 100%)',
            animation: `puddle-shimmer ${2.5 + i * 0.4}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </>
  )
}

const PUDDLES = [
  { x: 80, y: 120, w: 60, h: 24 },
  { x: 350, y: 320, w: 70, h: 28 },
  { x: 600, y: 180, w: 50, h: 20 },
  { x: 180, y: 380, w: 55, h: 22 },
  { x: 520, y: 80, w: 45, h: 18 },
  { x: 700, y: 360, w: 60, h: 24 },
]

/** Scene props — trees, lanterns, temple elements, flowers */
function SceneryProps() {
  return (
    <>
      {PROPS.map((p, i) => (
        <div
          key={i}
          className="absolute pointer-events-none select-none"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.size ?? 18,
            opacity: p.opacity ?? 0.7,
            filter: p.blur ? 'blur(1px)' : undefined,
            transform: p.flip ? 'scaleX(-1)' : undefined,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </>
  )
}

const PROPS = [
  // Trees — large, at edges
  { x: 20, y: 8, emoji: '🌳', size: 28, opacity: 0.55 },
  { x: 730, y: 15, emoji: '🌳', size: 26, opacity: 0.5, flip: true },
  { x: 60, y: 370, emoji: '🌿', size: 20, opacity: 0.4 },
  { x: 720, y: 380, emoji: '🌿', size: 18, opacity: 0.35, flip: true },

  // Lanterns — festival atmosphere
  { x: 160, y: 10, emoji: '🏮', size: 22, opacity: 0.8 },
  { x: 450, y: 5, emoji: '🏮', size: 20, opacity: 0.75 },
  { x: 640, y: 12, emoji: '🏮', size: 22, opacity: 0.8 },

  // Water — Songkran splashes
  { x: 300, y: 70, emoji: '💦', size: 14, opacity: 0.35 },
  { x: 550, y: 350, emoji: '💦', size: 12, opacity: 0.3 },
  { x: 130, y: 260, emoji: '💧', size: 11, opacity: 0.25 },

  // Flowers — jasmine & marigold (Songkran flowers)
  { x: 380, y: 400, emoji: '🌼', size: 14, opacity: 0.45 },
  { x: 200, y: 140, emoji: '🌸', size: 12, opacity: 0.35 },
  { x: 680, y: 230, emoji: '🌺', size: 13, opacity: 0.4 },

  // Temple element
  { x: 390, y: 415, emoji: '⛩️', size: 16, opacity: 0.2, blur: true },
]
