import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { resolveChoice, createBracketPairs } from '../lib/gameLogic'
import { useRoom } from '../hooks/useRoom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatches'
import CreateRoom from '../components/host/CreateRoom'
import Lobby from '../components/host/Lobby'
import BracketView from '../components/host/BracketView'
import HostChampionScreen from '../components/host/HostChampionScreen'
import QuizHostView from '../components/host/QuizHostView'

/**
 * HostPage — orchestrates the entire game lifecycle:
 *
 *  idle  →  (create room)  →  lobby  →  (start game)  →  playing  →  (champion)  →  finished
 *
 * All Supabase writes that advance game state live here so BracketView
 * stays purely a display component.
 */
export default function HostPage() {
  // Persist room across refreshes
  const [roomId, setRoomId] = useState(
    () => localStorage.getItem('songkran_host_room') ?? null,
  )

  // Reveal state: isRevealing blocks double-clicks and triggers flash anim.
  // pendingResults is a Map<matchId, {p1Choice, p2Choice, winnerId, outcome}>
  // used by BracketView to show choices during the animation window BEFORE DB commit.
  const [isRevealing, setIsRevealing] = useState(false)
  const [pendingResults, setPendingResults] = useState(null)
  // Guards handleNextRound against double-taps that would insert duplicate match rows
  const [isAdvancing, setIsAdvancing] = useState(false)

  const { room } = useRoom(roomId)
  const { players } = usePlayers(roomId)
  const { matches } = useMatches(roomId)

  // ── Derived state for current round ──────────────────────────
  const currentMatches = useMemo(
    () => matches.filter((m) => m.round_number === room?.current_round),
    [matches, room?.current_round],
  )

  const activeMatches = useMemo(
    () => currentMatches.filter((m) => !m.is_bye && m.status === 'waiting'),
    [currentMatches],
  )

  const champion = useMemo(
    () => (room?.status === 'finished' ? players.find((p) => p.is_alive) : null),
    [room?.status, players],
  )

  const champions = useMemo(
    () => (room?.status === 'finished' ? players.filter((p) => p.is_alive) : []),
    [room?.status, players],
  )

  // ── Game Actions ──────────────────────────────────────────────

  /**
   * Reveal: compute all match outcomes, play animation, then commit to DB.
   *
   * Key design decision: results are computed locally first and stored in
   * pendingResults so BracketView can animate the "flip" simultaneously for
   * all cards. After the 1.8s animation window, results are committed to DB —
   * which is when mobile clients finally see their outcomes.
   */
  async function handleReveal() {
    const toResolve = activeMatches.filter((m) => m.p1_choice && m.p2_choice)
    if (toResolve.length === 0 || isRevealing) return

    setIsRevealing(true)

    // Build pending results map for BracketView animation
    const results = new Map()
    const loserIds = []
    const dbUpdates = []

    toResolve.forEach((m) => {
      const outcome = resolveChoice(m.p1_choice, m.p2_choice)
      const winnerId =
        outcome === 'p1' ? m.player1_id
        : outcome === 'p2' ? m.player2_id
        : null
      const loserId =
        outcome === 'p1' ? m.player2_id
        : outcome === 'p2' ? m.player1_id
        : null

      results.set(m.id, {
        p1Choice: m.p1_choice,
        p2Choice: m.p2_choice,
        winnerId,
        outcome,
      })

      dbUpdates.push({ id: m.id, winner_id: winnerId, status: 'resolved' })
      if (loserId) loserIds.push(loserId)
    })

    // Trigger animation on host screen immediately
    setPendingResults(results)

    // Let the animation play for 1.8 s before committing
    await new Promise((r) => setTimeout(r, 1800))

    try {
      // ── Commit results to DB ──
      await Promise.all(
        dbUpdates.map((u) =>
          supabase
            .from('matches')
            .update({ status: 'resolved', winner_id: u.winner_id })
            .eq('id', u.id),
        ),
      )

      // Eliminate losers
      if (loserIds.length > 0) {
        await supabase.from('players').update({ is_alive: false }).in('id', loserIds)
      }

      // Check for champion: compare alive count against this round's eliminations.
      // We compute this from the closure's player list minus known losers rather than
      // waiting for the realtime refetch, so the room finishes immediately.
      const alivePlayers = players.filter((p) => p.is_alive && !loserIds.includes(p.id))
      if (alivePlayers.length <= 1) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
      }
    } finally {
      // Always reset — even on network error — so the Reveal button comes back
      setIsRevealing(false)
      setPendingResults(null)
    }
  }

  /**
   * Rematches: reset draw matches in-place so players can pick again.
   * The match record is reused — choices are cleared and status reverts to 'waiting'.
   */
  async function handleRematches() {
    const drawMatches = currentMatches.filter(
      (m) => !m.is_bye && m.status === 'resolved' && m.winner_id === null,
    )
    if (drawMatches.length === 0) return

    await Promise.all(
      drawMatches.map((m) =>
        supabase
          .from('matches')
          .update({ p1_choice: null, p2_choice: null, status: 'waiting', winner_id: null })
          .eq('id', m.id),
      ),
    )
    // Mobile clients' realtime subscriptions will fire → pick screen re-appears
  }

  /**
   * Next Round: shuffle alive players into new bracket, create match records,
   * then increment current_round on the room.
   */
  async function handleNextRound() {
    const alivePlayers = players.filter((p) => p.is_alive)
    if (alivePlayers.length < 2 || isAdvancing) return

    setIsAdvancing(true)
    try {
      const newRound = room.current_round + 1
      const pairs = createBracketPairs(alivePlayers)

      const matchInserts = pairs.map((pair) => ({
        room_id: room.id,
        round_number: newRound,
        player1_id: pair.player1_id,
        player2_id: pair.player2_id,
        is_bye: pair.is_bye,
        status: pair.is_bye ? 'resolved' : 'waiting',
        winner_id: pair.is_bye ? pair.player1_id : null,
      }))

      await supabase.from('matches').insert(matchInserts)
      await supabase.from('rooms').update({ current_round: newRound }).eq('id', room.id)
    } finally {
      setIsAdvancing(false)
    }
  }

  // ── Routing / Screen selection ────────────────────────────────

  // No room in DB yet (or localStorage was cleared)
  if (!roomId || !room) {
    return <CreateRoom onRoomCreated={setRoomId} />
  }

  if (room.status === 'lobby') {
    return (
      <Lobby
        room={room}
        players={players}
        onClearRoom={async () => {
          await supabase.from('rooms').delete().eq('id', room.id)
          localStorage.removeItem('songkran_host_room')
          setRoomId(null)
        }}
      />
    )
  }

  if (room.status === 'finished') {
    return (
      <HostChampionScreen
        champion={champion}
        champions={champions}
        isQuiz={room.game_mode === 'quiz'}
        onPlayAgain={() => {
          localStorage.removeItem('songkran_host_room')
          setRoomId(null)
        }}
      />
    )
  }

  // room.status === 'playing'
  if (room.game_mode === 'quiz') {
    return <QuizHostView room={room} players={players} />
  }

  return (
    <BracketView
      room={room}
      players={players}
      matches={matches}
      isRevealing={isRevealing}
      pendingResults={pendingResults}
      onReveal={handleReveal}
      onRematches={handleRematches}
      onNextRound={handleNextRound}
      isAdvancing={isAdvancing}
    />
  )
}
