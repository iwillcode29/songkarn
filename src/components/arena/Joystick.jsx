import { useRef, useEffect, useCallback } from 'react'

const BASE_RADIUS = 56
const KNOB_RADIUS = 22

/**
 * Virtual joystick — pointer events, water-ripple aesthetic.
 */
/**
 * @param {boolean} landscape — true when parent is CSS-rotated 90deg for landscape.
 *   Swaps pointer axes so the joystick matches the visual direction.
 */
export default function Joystick({ inputRef, landscape }) {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const anchorRef = useRef(null)

  const updateKnob = useCallback((dx, dy) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx * BASE_RADIUS}px, ${dy * BASE_RADIUS}px)`
    }
  }, [])

  useEffect(() => {
    const base = baseRef.current
    if (!base) return

    function onDown(e) {
      e.preventDefault()
      base.setPointerCapture(e.pointerId)
      const rect = base.getBoundingClientRect()
      anchorRef.current = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
      }
    }

    function onMove(e) {
      if (!anchorRef.current) return
      const { cx, cy } = anchorRef.current
      let vx = (e.clientX - cx) / BASE_RADIUS
      let vy = (e.clientY - cy) / BASE_RADIUS
      const mag = Math.sqrt(vx * vx + vy * vy)
      if (mag > 1) { vx /= mag; vy /= mag }
      // When CSS-rotated 90deg, swap axes to match visual direction
      const dx = landscape ? vy : vx
      const dy = landscape ? -vx : vy
      inputRef.current = { ...(inputRef.current ?? {}), dx, dy }
      updateKnob(dx, dy)
    }

    function onUp() {
      anchorRef.current = null
      inputRef.current = { ...(inputRef.current ?? {}), dx: 0, dy: 0 }
      updateKnob(0, 0)
    }

    base.addEventListener('pointerdown', onDown, { passive: false })
    base.addEventListener('pointermove', onMove, { passive: true })
    base.addEventListener('pointerup', onUp)
    base.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)

    return () => {
      base.removeEventListener('pointerdown', onDown)
      base.removeEventListener('pointermove', onMove)
      base.removeEventListener('pointerup', onUp)
      base.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [inputRef, updateKnob, landscape])

  return (
    <div className="flex items-center justify-center pt-3 pb-5">
      <div
        ref={baseRef}
        className="relative rounded-full touch-none select-none"
        style={{
          width: BASE_RADIUS * 2,
          height: BASE_RADIUS * 2,
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)',
          border: '1.5px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Direction indicators */}
        {['0%', '25%', '50%', '75%'].map((rot, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              transform: `rotate(${i * 90}deg) translateY(-${BASE_RADIUS - 8}px) translate(-50%, -50%)`,
            }}
          />
        ))}

        {/* Knob */}
        <div
          ref={knobRef}
          className="absolute rounded-full"
          style={{
            width: KNOB_RADIUS * 2,
            height: KNOB_RADIUS * 2,
            top: BASE_RADIUS - KNOB_RADIUS,
            left: BASE_RADIUS - KNOB_RADIUS,
            background: 'radial-gradient(circle at 40% 35%, rgba(251,191,36,0.9), rgba(217,119,6,0.8))',
            boxShadow: '0 2px 8px rgba(217,119,6,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            willChange: 'transform',
          }}
        />
      </div>
    </div>
  )
}
