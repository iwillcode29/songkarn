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

const BROADCAST_MIN_MS = 33   // ~30 Hz cap (small rooms)
const BROADCAST_MAX_MS = 100  // ~10 Hz floor (large rooms)
const BROADCAST_SCALE_AT = 6  // start scaling down above this player count
const BROADCAST_DELTA_PX = 1  // min position change to trigger a send
const BROADCAST_EVENT = 'pos'
const PROJ_EVENT = 'proj'
const DMG_EVENT = 'dmg'
const LERP_SPEED = 18 // higher = snappier interpolation
const IDLE_HEARTBEAT_MS = 1000 // send a keepalive once per second when stationary

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
    seq: 0,        // broadcast sequence — survives remounts
    projSeq: 0,    // projectile sequence — survives remounts
  }
}

function acquireArenaChannel(roomId) {
  const existing = arenaChannels.get(roomId)
  if (existing?.channel && existing.channel.state !== 'closed' && existing.channel.state !== 'leaving') {
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
  if (existing) {
    // Entry was pre-created by the hook body — attach the channel, keep existing refs
    existing.channel = channel
    existing.refCount = 1
    existing.listenersAttached = false
  } else {
    arenaChannels.set(roomId, { channel, refCount: 1, listenersAttached: false, destroyTimer: null, refs: createSharedRefs() })
  }
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
  // Pre-create the refs entry (without acquiring the channel) so spawn effects
  // on the first render write into the same Maps that the channel effect will
  // later attach broadcast listeners to.
  if (roomId && !arenaChannels.has(roomId)) {
    arenaChannels.set(roomId, { channel: null, refCount: 0, listenersAttached: false, destroyTimer: null, refs: createSharedRefs() })
  }
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

  const [, forceRender] = useReducer((x) => x + 1, 0)
  const channelRef = useRef(null)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const lastBroadcastRef = useRef(0)
  const connectedRef = useRef(false)
  const lastShootRef = useRef(0)
  const SHOOT_COOLDOWN_MS = 200 // max ~5 shots/sec to avoid flooding the channel
  const lastSentPosRef = useRef(null) // { x, y, facing } of last broadcast

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
              // Guard: channel may have been released during the delay
              const entry = arenaChannels.get(roomId)
              if (!entry || entry.channel.state === 'closed' || entry.channel.state === 'leaving') return
              const currentState = entry.channel.presenceState()
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
            }, 30000) // 30s grace — mobile WiFi can drop for 10-20s in party venues
          }
        })
        .subscribe(async (status) => {
          connectedRef.current = status === 'SUBSCRIBED'
          if (status === 'SUBSCRIBED' && playerId) {
            await channel.track({ playerId })
            // Immediately broadcast current position on (re)connect so
            // other clients unfreeze this player without waiting for the
            // next RAF tick.
            const pos = positionsRef.current.get(playerId)
            if (pos) {
              shared.seq++
              channel.send({
                type: 'broadcast',
                event: BROADCAST_EVENT,
                payload: { playerId, x: pos.x, y: pos.y, facing: pos.facing, isMoving: pos.isMoving, seq: shared.seq },
              })
            }
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
  // Uses requestAnimationFrame when the tab is focused for smooth 60fps,
  // but falls back to setInterval when unfocused so broadcasts and
  // rendering continue (browsers throttle/pause RAF in background tabs).
  useEffect(() => {
    const intervalRef = { id: null }
    let usingInterval = false

    function tick(now) {
      if (!usingInterval) rafRef.current = requestAnimationFrame(tick)

      if (!now) now = performance.now()
      const dt = lastTimeRef.current ? now - lastTimeRef.current : 16
      lastTimeRef.current = now
      const lerpT = LERP_SPEED * (dt / 1000) // frame-rate independent lerp factor

      // 1. Move own player from joystick input (mobile only)
      if (playerId && joystickRef?.current) {
        const { dx, dy } = frozenRef.current ? { dx: 0, dy: 0 } : joystickRef.current
        const prev = positionsRef.current.get(playerId)
        if (prev) {
          tickPlayer(prev, dx, dy, dt)
          // Sync target to own position (no lerp for self)
          const t = targetsRef.current.get(playerId)
          if (t) { t.x = prev.x; t.y = prev.y; t.facing = prev.facing; t.isMoving = prev.isMoving }
          else targetsRef.current.set(playerId, { x: prev.x, y: prev.y, facing: prev.facing, isMoving: prev.isMoving, _seq: prev._seq })
        }
      }

      // 2. Lerp remote players toward their broadcast targets (mutate in place)
      for (const [id, target] of targetsRef.current) {
        if (id === playerId) continue // skip self — already handled above
        const current = positionsRef.current.get(id)
        if (!current) {
          // First time seeing this player — snap to target
          positionsRef.current.set(id, { x: target.x, y: target.y, facing: target.facing, isMoving: target.isMoving, _seq: target._seq })
          continue
        }
        current.x = lerp(current.x, target.x, lerpT)
        current.y = lerp(current.y, target.y, lerpT)
        current.facing = target.facing
        current.isMoving = target.isMoving
        current._seq = target._seq
      }

      // 3. Collision only on mobile (host just displays)
      if (playerId) {
        resolveCollisions(positionsRef.current)
      }

      // 3.5. Shoot — triggered by space bar or mobile shoot button
      // Cooldown prevents flooding the broadcast channel on rapid input
      if (playerId && !frozenRef.current && joystickRef?.current?.shoot) {
        joystickRef.current = { ...joystickRef.current, shoot: false }
        const pos = positionsRef.current.get(playerId)
        if (pos && now - lastShootRef.current >= SHOOT_COOLDOWN_MS) {
          lastShootRef.current = now
          const { vx, vy } = facingToVelocity(pos.facing)
          const proj = {
            id: `${playerId}-${++shared.projSeq}`,
            x: pos.x,
            y: pos.y,
            vx,
            vy,
            ownerId: playerId,
          }
          projectilesRef.current.push(proj)
          sfx.shoot()
          if (channelRef.current?.state === 'joined') {
            channelRef.current.send({ type: 'broadcast', event: PROJ_EVENT, payload: proj })
          }
        }
      }

      // 3.6. Tick projectiles — owner checks hits, everyone moves them
      // In-place compaction: no intermediate array, no spread
      {
        const projs = projectilesRef.current
        let writeIdx = 0
        for (let i = 0; i < projs.length; i++) {
          const proj = projs[i]
          tickProjectile(proj, dt) // mutates in place
          if (isProjectileOutOfBounds(proj)) continue

          // Only the shooter detects hits (avoids duplicate damage broadcasts)
          if (playerId && proj.ownerId === playerId) {
            const hitId = checkProjectileHit(proj, positionsRef.current, playerId)
            if (hitId) {
              const cur = hpRef.current.get(hitId) ?? MAX_HP
              const newHp = Math.max(0, cur - 1)
              hpRef.current.set(hitId, newHp)
              hitSignalsRef.current.set(hitId, { time: performance.now(), x: proj.x, y: proj.y })
              if (newHp === 0) eliminationSignalRef.current.time = performance.now()
              if (channelRef.current?.state === 'joined') {
                channelRef.current.send({ type: 'broadcast', event: DMG_EVENT, payload: { targetId: hitId } })
              }
              continue // projectile consumed on hit
            }
          }

          projs[writeIdx++] = proj
        }
        projs.length = writeIdx
      }

      // 4. Broadcast own position — adaptive rate + delta suppression
      if (playerId) {
        // Adaptive interval: 30Hz for ≤6 players, linearly down to 10Hz at 20+
        const playerCount = playersRef.current?.length ?? 1
        const broadcastMs = playerCount <= BROADCAST_SCALE_AT
          ? BROADCAST_MIN_MS
          : Math.min(BROADCAST_MIN_MS + (playerCount - BROADCAST_SCALE_AT) * 5, BROADCAST_MAX_MS)

        if (now - lastBroadcastRef.current >= broadcastMs) {
          const pos = positionsRef.current.get(playerId)
          if (pos && channelRef.current?.state === 'joined') {
            const last = lastSentPosRef.current
            const dx = last ? Math.abs(pos.x - last.x) : Infinity
            const dy = last ? Math.abs(pos.y - last.y) : Infinity
            const facingChanged = !last || pos.facing !== last.facing
            const moved = dx > BROADCAST_DELTA_PX || dy > BROADCAST_DELTA_PX || facingChanged
            const idleTooLong = now - lastBroadcastRef.current >= IDLE_HEARTBEAT_MS

            if (moved || idleTooLong) {
              lastBroadcastRef.current = now
              lastSentPosRef.current = { x: pos.x, y: pos.y, facing: pos.facing }
              shared.seq++
              channelRef.current.send({
                type: 'broadcast',
                event: BROADCAST_EVENT,
                payload: {
                  playerId,
                  x: pos.x,
                  y: pos.y,
                  facing: pos.facing,
                  isMoving: pos.isMoving,
                  seq: shared.seq,
                },
              })
            }
          }
        }
      }

      forceRender()
    }

    function startRAF() {
      usingInterval = false
      if (intervalRef.id) { clearInterval(intervalRef.id); intervalRef.id = null }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null // reset so first tick gets a clean dt
      rafRef.current = requestAnimationFrame(tick)
    }

    function startInterval() {
      usingInterval = true
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      if (intervalRef.id) clearInterval(intervalRef.id)
      lastTimeRef.current = null // reset so first tick gets a clean dt
      intervalRef.id = setInterval(() => tick(performance.now()), 100) // 10fps fallback
    }

    // Switch to interval fallback when window is hidden OR loses focus.
    // Browsers throttle RAF in unfocused windows (even if visible on screen),
    // so we need both visibilitychange AND blur/focus to handle all cases.
    function onVisibility() {
      if (document.visibilityState === 'visible' && document.hasFocus()) startRAF()
      else startInterval()
    }
    function onFocus() { startRAF() }
    function onBlur() { startInterval() }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    // Start with the appropriate mode
    if (document.visibilityState === 'visible' && document.hasFocus()) startRAF()
    else startInterval()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (intervalRef.id) clearInterval(intervalRef.id)
      lastTimeRef.current = null
    }
  }, [playerId, joystickRef])

  return { positionsRef, targetsRef, connectedRef, hpRef, projectilesRef, hitSignalsRef, eliminationSignalRef }
}
