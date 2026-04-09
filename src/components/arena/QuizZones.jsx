import { ZONE_COLORS } from '../../lib/quizQuestions'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../lib/arena/physics'

const halfW = WORLD_WIDTH / 2
const halfH = WORLD_HEIGHT / 2

const ZONES = [
  { key: 'a', x: 0, y: 0, w: halfW, h: halfH },
  { key: 'b', x: halfW, y: 0, w: halfW, h: halfH },
  { key: 'c', x: 0, y: halfH, w: halfW, h: halfH },
  { key: 'd', x: halfW, y: halfH, w: halfW, h: halfH },
]

/**
 * Renders 4 colored answer zones as an overlay inside the Arena.
 * @param {object} props
 * @param {object|null} props.question - current question object
 * @param {string|null} props.revealedAnswer - 'a'|'b'|'c'|'d' after host reveals
 */
export default function QuizZones({ question, revealedAnswer }) {
  if (!question) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {ZONES.map(({ key, x, y, w, h }) => {
        const color = ZONE_COLORS[key]
        const optionText = question[key]
        const isCorrect = revealedAnswer === key
        const isWrong = revealedAnswer && revealedAnswer !== key

        return (
          <div
            key={key}
            className="absolute flex flex-col items-center justify-center"
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              background: isCorrect
                ? 'rgba(34,197,94,0.3)'
                : isWrong
                ? 'rgba(239,68,68,0.12)'
                : color.bg,
              borderRight: key === 'a' || key === 'c' ? `2px dashed ${color.border}` : undefined,
              borderBottom: key === 'a' || key === 'b' ? `2px dashed ${color.border}` : undefined,
              borderLeft: key === 'b' || key === 'd' ? `2px dashed ${color.border}` : undefined,
              borderTop: key === 'c' || key === 'd' ? `2px dashed ${color.border}` : undefined,
              transition: 'background 0.4s ease',
            }}
          >
            {/* Zone letter */}
            <span
              className="font-black select-none"
              style={{
                fontSize: 72,
                color: isCorrect ? '#22c55e' : isWrong ? 'rgba(255,255,255,0.15)' : color.text,
                opacity: isWrong ? 0.4 : 0.7,
                lineHeight: 1,
                transition: 'color 0.3s, opacity 0.3s',
              }}
            >
              {key.toUpperCase()}
            </span>
            {/* Option text */}
            <span
              className="font-semibold text-center px-4 select-none"
              style={{
                fontSize: 20,
                color: isCorrect ? '#bbf7d0' : isWrong ? 'rgba(255,255,255,0.15)' : color.text,
                opacity: isWrong ? 0.3 : 0.8,
                maxWidth: w - 30,
                transition: 'color 0.3s, opacity 0.3s',
              }}
            >
              {optionText}
            </span>
            {/* Correct checkmark */}
            {isCorrect && (
              <span style={{ fontSize: 42, marginTop: 3 }}>✅</span>
            )}
          </div>
        )
      })}

      {/* Center divider lines */}
      <div
        className="absolute"
        style={{
          left: halfW - 1,
          top: 0,
          width: 3,
          height: WORLD_HEIGHT,
          background: 'rgba(255,255,255,0.08)',
        }}
      />
      <div
        className="absolute"
        style={{
          left: 0,
          top: halfH - 1,
          width: WORLD_WIDTH,
          height: 3,
          background: 'rgba(255,255,255,0.08)',
        }}
      />
    </div>
  )
}
