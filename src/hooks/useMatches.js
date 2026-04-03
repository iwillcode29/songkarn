import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches ALL matches for a room and subscribes to real-time changes.
 * Components filter by round_number as needed.
 * Re-fetches on any change to keep ordered list consistent.
 */
export function useMatches(roomId) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMatches = useCallback(async () => {
    if (!roomId) return
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    setMatches(data ?? [])
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }

    fetchMatches()

    const channel = supabase
      .channel(`matches:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `room_id=eq.${roomId}`,
        },
        fetchMatches,
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [roomId, fetchMatches])

  return { matches, loading }
}
