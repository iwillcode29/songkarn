import { useState, useEffect, useRef } from 'react'

/**
 * Countdown hook driven by an absolute start timestamp.
 * Both host and players read `room.question_started_at` from DB,
 * so the countdown is naturally synced without any broadcast.
 *
 * @param {string|null} startedAt — ISO 8601 timestamp, or null (timer inactive)
 * @param {number} durationSeconds — total countdown duration (default 15)
 * @returns {{ secondsLeft: number, isExpired: boolean }}
 */
export function useCountdown(startedAt, durationSeconds = 15) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (!startedAt) {
      setSecondsLeft(durationSeconds)
      return
    }

    const startMs = new Date(startedAt).getTime()

    function tick() {
      const elapsed = Date.now() - startMs
      const remaining = Math.max(0, Math.ceil((durationSeconds * 1000 - elapsed) / 1000))
      setSecondsLeft(remaining)
    }

    tick() // immediate first tick
    intervalRef.current = setInterval(tick, 250)

    return () => clearInterval(intervalRef.current)
  }, [startedAt, durationSeconds])

  return { secondsLeft, isExpired: secondsLeft === 0 && startedAt != null }
}
