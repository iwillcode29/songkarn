import { useEffect, useState, useCallback } from 'react'

/**
 * Fires `onReconnect` when the tab becomes visible or the network comes back online.
 * Returns `isReconnecting` — true while the async callback is in flight.
 */
export function useReconnect(onReconnect) {
  const [isReconnecting, setIsReconnecting] = useState(false)

  const trigger = useCallback(async () => {
    setIsReconnecting(true)
    try {
      await onReconnect()
    } finally {
      setIsReconnecting(false)
    }
  }, [onReconnect])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        // Immediate fetch + delayed second fetch to catch events
        // that arrive while channels are still resubscribing
        trigger()
        setTimeout(trigger, 1500)
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', trigger)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', trigger)
    }
  }, [trigger])

  return { isReconnecting }
}
