// ─────────────────────────────────────────────────
// Arena physics — pure functions, no React / no network
// ─────────────────────────────────────────────────

export const WORLD_WIDTH = 800
export const WORLD_HEIGHT = 450
export const PLAYER_RADIUS = 20
export const MOVE_SPEED = 150 // logical px per second

export const MAX_HP = 50
export const PROJECTILE_SPEED = 300 // logical px per second
export const PROJECTILE_RADIUS = 5
export const BOTTLE_RADIUS = 10
export const BOTTLE_HP = 10
export const BOTTLE_SPAWN_MS = 10000 // 10 seconds

/**
 * Deterministic spawn positions so every client places players identically.
 */
export function getSpawnPosition(index, total) {
  const cols = Math.ceil(Math.sqrt(total))
  const rows = Math.ceil(total / cols)
  const col = index % cols
  const row = Math.floor(index / cols)
  const cellW = WORLD_WIDTH / (cols + 1)
  const cellH = WORLD_HEIGHT / (rows + 1)
  return { x: cellW * (col + 1), y: cellH * (row + 1) }
}

/**
 * Advance a player's position by (dirX, dirY) * speed * dt.
 * Clamps to world bounds. Mutates `pos` in place for performance.
 */
export function tickPlayer(pos, dirX, dirY, deltaMs) {
  const dt = deltaMs / 1000
  const mag = Math.sqrt(dirX * dirX + dirY * dirY)
  if (mag === 0) { pos.isMoving = false; return }

  // Normalize so diagonal isn't faster
  const nx = dirX / mag
  const ny = dirY / mag

  pos.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, pos.x + nx * MOVE_SPEED * dt))
  pos.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, pos.y + ny * MOVE_SPEED * dt))
  pos.facing = directionToFacing(nx, ny)
  pos.isMoving = true
}

/**
 * Circle-based collision: push overlapping players apart equally.
 * Mutates the map values in place for performance.
 * Uses a reusable buffer to avoid allocating a new array every frame.
 */
const _collisionBuf = []
export function resolveCollisions(posMap) {
  _collisionBuf.length = 0
  for (const val of posMap.values()) _collisionBuf.push(val)
  const minDist = PLAYER_RADIUS * 2

  for (let i = 0; i < _collisionBuf.length; i++) {
    for (let j = i + 1; j < _collisionBuf.length; j++) {
      const a = _collisionBuf[i]
      const b = _collisionBuf[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < minDist && dist > 0) {
        const overlap = (minDist - dist) / 2
        const nx = dx / dist
        const ny = dy / dist
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap

        // Re-clamp after push
        a.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, a.x))
        a.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, a.y))
        b.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, b.x))
        b.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, b.y))
      }
    }
  }
}

/**
 * Convert a facing string to a velocity vector for a projectile.
 */
export function facingToVelocity(facing) {
  switch (facing) {
    case 'up':    return { vx: 0,               vy: -PROJECTILE_SPEED }
    case 'down':  return { vx: 0,               vy:  PROJECTILE_SPEED }
    case 'left':  return { vx: -PROJECTILE_SPEED, vy: 0 }
    case 'right': return { vx:  PROJECTILE_SPEED, vy: 0 }
    default:      return { vx: 0,               vy:  PROJECTILE_SPEED }
  }
}

/** Advance a projectile by dt milliseconds. Mutates in place. */
export function tickProjectile(proj, dt) {
  proj.x += proj.vx * dt / 1000
  proj.y += proj.vy * dt / 1000
}

/** True if the projectile has left the world bounds. */
export function isProjectileOutOfBounds(proj) {
  return proj.x < 0 || proj.x > WORLD_WIDTH || proj.y < 0 || proj.y > WORLD_HEIGHT
}

/**
 * Returns the ID of the first player the projectile overlaps, or null.
 * Skips ownerId so the shooter can't hit themselves.
 */
export function checkProjectileHit(proj, posMap, ownerId) {
  const minDist2 = (PLAYER_RADIUS + PROJECTILE_RADIUS) ** 2
  for (const [id, pos] of posMap) {
    if (id === ownerId) continue
    const dx = proj.x - pos.x
    const dy = proj.y - pos.y
    if (dx * dx + dy * dy < minDist2) return id
  }
  return null
}

/**
 * Returns which quiz zone (a/b/c/d) a position falls in.
 * Layout: A=top-left, B=top-right, C=bottom-left, D=bottom-right
 */
export function getZoneForPosition(x, y) {
  const midX = WORLD_WIDTH / 2
  const midY = WORLD_HEIGHT / 2
  if (x < midX && y < midY) return 'a'
  if (x >= midX && y < midY) return 'b'
  if (x < midX && y >= midY) return 'c'
  return 'd'
}

/**
 * Deterministic bottle spawn position from a spawn index.
 * Uses Knuth's multiplicative hash so all clients agree on position.
 */
export function bottlePosition(index) {
  const MARGIN = 40
  let h = ((index + 1) * 2654435761) >>> 0
  const x = MARGIN + (h % (WORLD_WIDTH - MARGIN * 2))
  h = ((h >>> 16) ^ (h * 48271)) >>> 0
  const y = MARGIN + (h % (WORLD_HEIGHT - MARGIN * 2))
  return { x, y }
}

/**
 * Map a direction vector to a 4-direction facing string.
 */
export function directionToFacing(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'down' : 'up'
}
