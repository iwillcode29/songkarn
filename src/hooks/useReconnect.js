import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Fires `onReconnect` when the tab becomes visible or the network comes back online.
 * Returns `isReconnecting` — true while any async callback is in flight.
 */
export function useReconnect(onReconnect) {
  const [isReconnecting, setIsReconnecting] = useState(false)
  const inflightRef = useRef(0)

  const trigger = useCallback(async () => {
    inflightRef.current++
    setIsReconnecting(true)
    try {
      await onReconnect()
    } finally {
      inflightRef.current--
      if (inflightRef.current <= 0) {
        inflightRef.current = 0
        setIsReconnecting(false)
      }
    }
  }, [onReconnect])

  useEffect(() => {
    let delayTimer = null

    function onVisible() {
      if (document.visibilityState === 'visible') {
        // Clear any pending delayed trigger from a previous visibility toggle
        if (delayTimer) clearTimeout(delayTimer)
        // Immediate fetch + delayed second fetch to catch events
        // that arrive while channels are still resubscribing
        trigger()
        delayTimer = setTimeout(trigger, 1500)
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', trigger)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', trigger)
      if (delayTimer) clearTimeout(delayTimer)
    }
  }, [trigger])

  return { isReconnecting }
}
