import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches all players in a room and subscribes to real-time changes.
 * Re-fetches the full list on any INSERT / UPDATE / DELETE so the
 * sorted order stays consistent.
 */
export function usePlayers(roomId) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPlayers = useCallback(async () => {
    if (!roomId) return
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
      if (!error) setPlayers(prev => {
        const next = data ?? []
        if (prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.is_alive === next[i].is_alive && p.score === next[i].score)) return prev
        return next
      })
    } catch (e) {
      console.warn('fetchPlayers error:', e)
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }

    fetchPlayers()

    const channel = supabase
      .channel(`players:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        fetchPlayers, // re-fetch to keep full sorted list in sync
      )
      .subscribe((status) => {
        // Re-fetch once subscribed so we don't miss events that fired
        // between the initial fetch and the subscription being ready.
        if (status === 'SUBSCRIBED') fetchPlayers()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          fetchPlayers()
        }
      })

    // Polling fallback — realtime postgres_changes can silently fail
    // if table replication is misconfigured; poll every 3s as safety net.
    const interval = setInterval(fetchPlayers, 3000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchPlayers])

  return { players, loading, refetch: fetchPlayers }
}
