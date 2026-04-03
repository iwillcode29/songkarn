import { useEffect, useRef, useReducer } from 'react'
import { supabase } from '../lib/supabase'
import {
  getSpawnPosition,
  tickPlayer,
  resolveCollisions,
  MAX_HP,
  facingToVelocity,
  tickProjectile,
  isProjectileOutOfBounds,
  checkProjectileHit,
} from '../lib/arena/physics'

const BROADCAST_INTERVAL_MS = 33 // ~30 Hz (was 50ms/20Hz)
const BROADCAST_EVENT = 'pos'
const PROJ_EVENT = 'proj'
const DMG_EVENT = 'dmg'
const LERP_SPEED = 18 // higher = snappier interpolation

/**
 * Linear interpolation helper.
 */
function lerp(a, b, t) {
  return a + (b - a) * Math.min(t, 1)
}

/**
 * Core arena hook — runs the RAF game loop, sends/receives Broadcast positions.
 *
 * Remote players are smoothly interpolated (lerp) toward their broadcast target
 * instead of snapping, which eliminates jitter on the host screen.
 *
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {string|null} opts.playerId  — null on host (read-only)
 * @param {Array} opts.players         — current players list from usePlayers
 * @param {React.MutableRefObject} opts.joystickRef — { dx, dy } written by Joystick
 * @returns {{ positionsRef: React.MutableRefObject<Map>, connectedRef: React.MutableRefObject<boolean> }}
 */
export function useArena({ roomId, playerId, players, joystickRef }) {
  // Rendered positions — what Arena reads every frame
  const positionsRef = useRef(new Map())
  // Target positions for remote players — set by Broadcast, lerped toward in RAF
  const targetsRef = useRef(new Map())
  // HP for each player (seeded at MAX_HP on spawn)
  const hpRef = useRef(new Map())
  // Active projectiles (all clients track all projectiles locally)
  const projectilesRef = useRef([])
  const projSeqRef = useRef(0)

  const [, forceRender] = useReducer((x) => x + 1, 0)
  const channelRef = useRef(null)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const lastBroadcastRef = useRef(0)
  const seqRef = useRef(0)
  const connectedRef = useRef(false)

  const initialisedRef = useRef(new Set())
  const onlineRef = useRef(new Set())

  const playersRef = useRef(players)
  useEffect(() => {
    playersRef.current = players
  }, [players])

  // Seed spawn positions for new players
  useEffect(() => {
    const total = players.length
    players.forEach((p, i) => {
      if (!initialisedRef.current.has(p.id)) {
        const spawn = getSpawnPosition(i, total)
        const initial = { x: spawn.x, y: spawn.y, facing: 'down', isMoving: false }
        positionsRef.current.set(p.id, { ...initial })
        targetsRef.current.set(p.id, { ...initial })
        hpRef.current.set(p.id, MAX_HP)
        initialisedRef.current.add(p.id)
      }
    })
  }, [players])

  // ── Broadcast channel ──
  useEffect(() => {
    if (!roomId) return

    const channel = supabase.channel(`arena:${roomId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: PROJ_EVENT }, ({ payload }) => {
        if (!payload) return
        projectilesRef.current.push(payload)
      })
      .on('broadcast', { event: DMG_EVENT }, ({ payload }) => {
        if (!payload) return
        const cur = hpRef.current.get(payload.targetId) ?? MAX_HP
        hpRef.current.set(payload.targetId, Math.max(0, cur - 1))
      })
      .on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
        if (!payload) return
        const prev = targetsRef.current.get(payload.playerId)
        if (prev && payload.seq <= (prev._seq ?? 0)) return

        // Write to targets — the RAF loop will lerp rendered positions toward this
        targetsRef.current.set(payload.playerId, {
          x: payload.x,
          y: payload.y,
          facing: payload.facing,
          isMoving: payload.isMoving,
          _seq: payload.seq,
        })
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const nowOnline = new Set()
        for (const key of Object.keys(state)) {
          for (const p of state[key]) {
            if (p.playerId) nowOnline.add(p.playerId)
          }
        }
        const leftIds = []
        for (const id of onlineRef.current) {
          if (!nowOnline.has(id)) {
            positionsRef.current.delete(id)
            targetsRef.current.delete(id)
            hpRef.current.delete(id)
            initialisedRef.current.delete(id)
            leftIds.push(id)
          }
        }
        onlineRef.current = nowOnline

        // Host deletes disconnected players from DB after a grace period.
        // This gives players who are rejoining (page refresh, name re-entry)
        // time to re-track their presence before being removed.
        if (!playerId && leftIds.length > 0) {
          setTimeout(() => {
            // Re-check: only delete players still absent after the grace period
            const currentState = channel.presenceState()
            const stillOnline = new Set()
            for (const key of Object.keys(currentState)) {
              for (const p of currentState[key]) {
                if (p.playerId) stillOnline.add(p.playerId)
              }
            }
            const confirmedLeft = leftIds.filter((id) => !stillOnline.has(id))
            if (confirmedLeft.length > 0) {
              supabase.from('players').delete().in('id', confirmedLeft)
            }
          }, 5000)
        }
      })
      .subscribe(async (status) => {
        connectedRef.current = status === 'SUBSCRIBED'
        if (status === 'SUBSCRIBED' && playerId) {
          await channel.track({ playerId })
        }
      })

    channelRef.current = channel
    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
      connectedRef.current = false
    }
  }, [roomId, playerId])

  // ── RAF game loop ──
  useEffect(() => {
    function tick(now) {
      rafRef.current = requestAnimationFrame(tick)

      const dt = lastTimeRef.current ? now - lastTimeRef.current : 16
      lastTimeRef.current = now
      const lerpT = LERP_SPEED * (dt / 1000) // frame-rate independent lerp factor

      // 1. Move own player from joystick input (mobile only)
      if (playerId && joystickRef?.current) {
        const { dx, dy } = joystickRef.current
        const prev = positionsRef.current.get(playerId)
        if (prev) {
          const next = tickPlayer(prev, dx, dy, dt)
          positionsRef.current.set(playerId, { ...next, _seq: prev._seq })
          // Own target = own position (no lerp for self)
          targetsRef.current.set(playerId, { ...next, _seq: prev._seq })
        }
      }

      // 2. Lerp remote players toward their broadcast targets
      for (const [id, target] of targetsRef.current) {
        if (id === playerId) continue // skip self — already handled above
        const current = positionsRef.current.get(id)
        if (!current) {
          // First time seeing this player — snap to target
          positionsRef.current.set(id, { ...target })
          continue
        }
        positionsRef.current.set(id, {
          x: lerp(current.x, target.x, lerpT),
          y: lerp(current.y, target.y, lerpT),
          facing: target.facing,
          isMoving: target.isMoving,
          _seq: target._seq,
        })
      }

      // 3. Collision only on mobile (host just displays)
      if (playerId) {
        resolveCollisions(positionsRef.current)
      }

      // 3.5. Shoot — triggered by space bar or mobile shoot button
      if (playerId && joystickRef?.current?.shoot) {
        joystickRef.current = { ...joystickRef.current, shoot: false }
        const pos = positionsRef.current.get(playerId)
        if (pos) {
          const { vx, vy } = facingToVelocity(pos.facing)
          const proj = {
            id: `${playerId}-${++projSeqRef.current}`,
            x: pos.x,
            y: pos.y,
            vx,
            vy,
            ownerId: playerId,
          }
          projectilesRef.current.push(proj)
          channelRef.current?.send({ type: 'broadcast', event: PROJ_EVENT, payload: proj })
        }
      }

      // 3.6. Tick projectiles — owner checks hits, everyone moves them
      if (projectilesRef.current.length > 0) {
        const surviving = []
        for (const proj of projectilesRef.current) {
          const moved = tickProjectile(proj, dt)
          if (isProjectileOutOfBounds(moved)) continue

          // Only the shooter detects hits (avoids duplicate damage broadcasts)
          if (playerId && moved.ownerId === playerId) {
            const hitId = checkProjectileHit(moved, positionsRef.current, playerId)
            if (hitId) {
              const cur = hpRef.current.get(hitId) ?? MAX_HP
              hpRef.current.set(hitId, Math.max(0, cur - 1))
              channelRef.current?.send({ type: 'broadcast', event: DMG_EVENT, payload: { targetId: hitId } })
              continue // projectile consumed on hit
            }
          }

          surviving.push(moved)
        }
        projectilesRef.current = surviving
      }

      // 4. Broadcast own position at ~30 Hz
      if (playerId && now - lastBroadcastRef.current >= BROADCAST_INTERVAL_MS) {
        lastBroadcastRef.current = now
        const pos = positionsRef.current.get(playerId)
        if (pos && channelRef.current) {
          seqRef.current++
          channelRef.current.send({
            type: 'broadcast',
            event: BROADCAST_EVENT,
            payload: {
              playerId,
              x: Math.round(pos.x),
              y: Math.round(pos.y),
              facing: pos.facing,
              isMoving: pos.isMoving,
              seq: seqRef.current,
            },
          })
        }
      }

      forceRender()
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
    }
  }, [playerId, joystickRef])

  return { positionsRef, connectedRef, hpRef, projectilesRef }
}
