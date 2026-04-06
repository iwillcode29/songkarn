import { useEffect, useRef, useReducer } from 'react'
import { supabase } from '../lib/supabase'
import { sfx } from '../lib/sfx'
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
 * Module-level arena channel cache. Keeps one Supabase Realtime channel per
 * room alive across Arena remounts (lobby → quiz) so there's zero reconnect
 * gap and broadcasts flow continuously.
 */
const arenaChannels = new Map() // roomId → { channel, refCount, listenersAttached, destroyTimer, refs }

/**
 * Shared mutable refs that survive Arena remounts (lobby → quiz).
 * Broadcast listeners write into these; the RAF loop reads from them.
 */
function createSharedRefs() {
  return {
    positions: new Map(),
    targets: new Map(),
    hp: new Map(),
    projectiles: [],
    hitSignals: new Map(),
    eliminationSignal: { time: 0 },
    initialised: new Set(),
    online: new Set(),
  }
}

function acquireArenaChannel(roomId) {
  const existing = arenaChannels.get(roomId)
  if (existing && existing.channel.state !== 'closed') {
    existing.refCount++
    // Cancel pending destroy if Arena remounts quickly (lobby → quiz)
    if (existing.destroyTimer) {
      clearTimeout(existing.destroyTimer)
      existing.destroyTimer = null
    }
    return existing.channel
  }
  const channel = supabase.channel(`arena:${roomId}`, {
    config: { broadcast: { self: false } },
  })
  arenaChannels.set(roomId, { channel, refCount: 1, listenersAttached: false, destroyTimer: null, refs: createSharedRefs() })
  return channel
}

function releaseArenaChannel(roomId) {
  const entry = arenaChannels.get(roomId)
  if (!entry) return
  entry.refCount--
  if (entry.refCount <= 0) {
    // Delay destroy by 1s so lobby→quiz remount can reuse the same channel.
    // React unmounts old Arena before mounting new one — without this delay
    // the channel would be destroyed in the gap between unmount and mount.
    entry.destroyTimer = setTimeout(() => {
      const current = arenaChannels.get(roomId)
      if (current && current.refCount <= 0) {
        current.channel.untrack()
        supabase.removeChannel(current.channel)
        arenaChannels.delete(roomId)
      }
    }, 1000)
  }
}

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
export function useArena({ roomId, playerId, players, joystickRef, frozen, onSelfHit }) {
  // Shared refs survive Arena remounts (lobby → quiz) via the module-level
  // channel cache, so broadcast listeners always write to the same Maps that
  // the current RAF loop reads from.
  const entry = arenaChannels.get(roomId)
  const shared = entry?.refs ?? createSharedRefs()

  const positionsRef = useRef(shared.positions)
  const targetsRef = useRef(shared.targets)
  const hpRef = useRef(shared.hp)
  const projectilesRef = useRef(shared.projectiles)
  const hitSignalsRef = useRef(shared.hitSignals)
  const eliminationSignalRef = useRef(shared.eliminationSignal)
  const initialisedRef = useRef(shared.initialised)
  const onlineRef = useRef(shared.online)

  // Keep refs pointing to the shared objects (handles hot-path where entry
  // exists before first render but ref.current was initialised with a stale copy)
  positionsRef.current = shared.positions
  targetsRef.current = shared.targets
  hpRef.current = shared.hp
  projectilesRef.current = shared.projectiles
  hitSignalsRef.current = shared.hitSignals
  eliminationSignalRef.current = shared.eliminationSignal
  initialisedRef.current = shared.initialised
  onlineRef.current = shared.online

  const projSeqRef = useRef(0)

  const [, forceRender] = useReducer((x) => x + 1, 0)
  const channelRef = useRef(null)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const lastBroadcastRef = useRef(0)
  const seqRef = useRef(0)
  const connectedRef = useRef(false)

  const frozenRef = useRef(frozen)
  frozenRef.current = frozen

  const playerIdRef = useRef(playerId)
  useEffect(() => { playerIdRef.current = playerId }, [playerId])

  const onSelfHitRef = useRef(onSelfHit)
  useEffect(() => { onSelfHitRef.current = onSelfHit })

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
  // Uses a module-level channel cache so the same WebSocket channel survives
  // Arena remounts (lobby → quiz). No reconnect gap, no lost broadcasts.
  useEffect(() => {
    if (!roomId) return

    const channel = acquireArenaChannel(roomId)
    const entry = arenaChannels.get(roomId)
    const isNew = channel.state !== 'joined' && channel.state !== 'joining'

    // Attach broadcast listeners ONLY ONCE per channel lifetime to prevent
    // duplicate handlers stacking up on Arena remount (lobby → quiz).
    // Handlers use refs to access current values (playerId, onSelfHit).
    // Attach broadcast listeners ONLY ONCE per channel lifetime.
    // Listeners read from entry.refs (the shared objects) so they stay
    // valid across Arena remounts — no stale closure refs.
    if (entry && !entry.listenersAttached) {
      entry.listenersAttached = true
      const r = entry.refs
      channel
        .on('broadcast', { event: PROJ_EVENT }, ({ payload }) => {
          if (!payload) return
          r.projectiles.push(payload)
        })
        .on('broadcast', { event: DMG_EVENT }, ({ payload }) => {
          if (!payload) return
          const cur = r.hp.get(payload.targetId) ?? MAX_HP
          const newHp = Math.max(0, cur - 1)
          r.hp.set(payload.targetId, newHp)
          // Hit signal for flash + splash
          const pos = r.positions.get(payload.targetId)
          if (pos) {
            r.hitSignals.set(payload.targetId, { time: performance.now(), x: pos.x, y: pos.y })
          }
          // Elimination signal for host screen shake — mutate in place so
          // the ref.current pointer stays valid between renders
          if (newHp === 0) {
            r.eliminationSignal.time = performance.now()
          }
          // Self-hit feedback (vibrate + screen shake on mobile)
          if (payload.targetId === playerIdRef.current) {
            sfx.hit()
            onSelfHitRef.current?.()
          }
        })
        .on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
          if (!payload) return
          const prev = r.targets.get(payload.playerId)
          if (prev && payload.seq <= (prev._seq ?? 0)) return

          r.targets.set(payload.playerId, {
            x: payload.x,
            y: payload.y,
            facing: payload.facing,
            isMoving: payload.isMoving,
            _seq: payload.seq,
          })
        })
    }

    // Only attach presence + subscribe on a fresh channel (not already joined)
    if (isNew) {
      channel
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
          onlineRef.current.clear()
          for (const id of nowOnline) onlineRef.current.add(id)

          if (!playerId && leftIds.length > 0) {
            setTimeout(() => {
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
    } else {
      // Channel already connected — mark as connected and track presence
      connectedRef.current = true
      if (playerId) channel.track({ playerId })
    }

    channelRef.current = channel
    return () => {
      channelRef.current = null
      connectedRef.current = false
      releaseArenaChannel(roomId)
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
        const { dx, dy } = frozenRef.current ? { dx: 0, dy: 0 } : joystickRef.current
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
      if (playerId && !frozenRef.current && joystickRef?.current?.shoot) {
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
          sfx.shoot()
          if (connectedRef.current) {
            channelRef.current?.send({ type: 'broadcast', event: PROJ_EVENT, payload: proj })
          }
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
              const newHp = Math.max(0, cur - 1)
              hpRef.current.set(hitId, newHp)
              // Hit signal for flash + splash (shooter sees it immediately)
              hitSignalsRef.current.set(hitId, { time: performance.now(), x: moved.x, y: moved.y })
              if (newHp === 0) eliminationSignalRef.current.time = performance.now()
              if (connectedRef.current) {
                channelRef.current?.send({ type: 'broadcast', event: DMG_EVENT, payload: { targetId: hitId } })
              }
              continue // projectile consumed on hit
            }
          }

          surviving.push(moved)
        }
        // Mutate the shared array in place so the broadcast listener's
        // reference (r.projectiles) stays valid.
        projectilesRef.current.length = 0
        projectilesRef.current.push(...surviving)
      }

      // 4. Broadcast own position at ~30 Hz
      if (playerId && now - lastBroadcastRef.current >= BROADCAST_INTERVAL_MS) {
        lastBroadcastRef.current = now
        const pos = positionsRef.current.get(playerId)
        if (pos && channelRef.current && connectedRef.current) {
          seqRef.current++
          channelRef.current.send({
            type: 'broadcast',
            event: BROADCAST_EVENT,
            payload: {
              playerId,
              x: pos.x,
              y: pos.y,
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

  return { positionsRef, targetsRef, connectedRef, hpRef, projectilesRef, hitSignalsRef, eliminationSignalRef }
}
