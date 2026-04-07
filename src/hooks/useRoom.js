import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches a room record and subscribes to real-time changes.
 * Returns null while loading.
 */
export function useRoom(roomId) {
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchRoom = useCallback(async () => {
    if (!roomId) return
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()
    if (!error) setRoom(prev => {
      if (prev && data && prev.status === data.status && prev.current_round === data.current_round && prev.game_mode === data.game_mode) return prev
      return data
    })
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }

    fetchRoom()

    // Subscribe to any change on this specific room row
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        // Re-fetch the full row instead of using payload.new — Supabase Realtime
        // may return a partial object when REPLICA IDENTITY is not set to FULL.
        () => fetchRoom(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchRoom()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Channel died — poll faster until next successful subscribe
          fetchRoom()
        }
      })

    // Polling fallback — 3s keeps state fresh if realtime silently fails
    const interval = setInterval(fetchRoom, 3000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchRoom])

  return { room, loading, refetch: fetchRoom }
}
