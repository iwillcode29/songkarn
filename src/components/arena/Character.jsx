import { memo } from 'react'
import { PLAYER_RADIUS } from '../../lib/arena/physics'
import PixelSprite from './PixelSprite'

const SIZE = PLAYER_RADIUS * 2
const SPRITE_SIZE = SIZE * 1.8

/**
 * Arena character — positioned via translate3d for GPU compositing.
 */
const FLASH_DURATION = 300

const Character = memo(function Character({ name, x, y, facing, isMoving, isSelf, playerIndex = 0, hp = 50, hitTime = 0 }) {
  const hpFrac = Math.max(0, hp) / 50
  const barColor = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.2 ? '#fbbf24' : '#f87171'

  // Hit flash — oscillates 3x over 300ms
  const flashAge = hitTime ? performance.now() - hitTime : 0
  const flashCycle = Math.floor(flashAge / 80) % 2
  const isFlashing = hitTime > 0 && flashAge < FLASH_DURATION && flashCycle === 0
  return (
    <div
      className="absolute select-none pointer-events-none"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${Math.round(x - SPRITE_SIZE / 2)}px, ${Math.round(y - SPRITE_SIZE / 2 - 8)}px, 0)`,
        width: SPRITE_SIZE,
        willChange: 'transform',
      }}
    >
      {/* Self indicator — arrow pointing down */}
      {isSelf && (
        <div className="flex justify-center mb-0.5" style={{ animation: 'indicator-bob 1s ease-in-out infinite' }}>
          <svg width="14" height="8" viewBox="0 0 14 8">
            <path d="M7 8L0 0h14z" fill="#fbbf24" />
          </svg>
        </div>
      )}

      {/* HP bar */}
      <div className="flex justify-center mb-0.5">
        <div style={{ width: SPRITE_SIZE * 0.75, height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2 }}>
          <div style={{ width: `${hpFrac * 100}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.1s' }} />
        </div>
      </div>
      <div className="text-center" style={{ fontSize: 7, lineHeight: 1, color: barColor, marginBottom: 1 }}>
        {Math.max(0, hp)}
      </div>

      {/* Shadow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: SIZE * 0.8,
          height: 7,
          bottom: 2,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.3), transparent 70%)',
        }}
      />

      {/* Pixel sprite */}
      <div className="flex justify-center" style={isFlashing ? { filter: 'brightness(10) saturate(0)' } : undefined}>
        <PixelSprite
          facing={facing}
          isMoving={isMoving}
          playerIndex={playerIndex}
          size={SPRITE_SIZE}
        />
      </div>

      {/* Name label */}
      <div className="text-center" style={{ marginTop: 2 }}>
        <span
          className="font-semibold whitespace-nowrap"
          style={{
            fontSize: 9,
            lineHeight: 1,
            color: isSelf ? '#fde68a' : '#e2e8f0',
            textShadow: '0 1px 3px rgba(0,0,0,0.7), 0 0px 1px rgba(0,0,0,0.9)',
            maxWidth: 72,
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  )
})

export default Character
