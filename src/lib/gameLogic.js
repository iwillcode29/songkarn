// ─────────────────────────────────────────────────
// Weapon definitions for the Songkran theme
// Water Gun (Rock) > Scissors > Umbrella (Paper) > Water Gun
// ─────────────────────────────────────────────────
export const WEAPONS = {
  water_gun: { emoji: '🔫', label: 'Water Gun', beats: 'scissors' },
  umbrella:  { emoji: '☂️',  label: 'Umbrella',  beats: 'water_gun' },
  scissors:  { emoji: '✂️',  label: 'Scissors',  beats: 'umbrella' },
}

/**
 * Resolves the outcome of a single match.
 * @param {string} p1Choice - 'water_gun' | 'umbrella' | 'scissors'
 * @param {string} p2Choice - 'water_gun' | 'umbrella' | 'scissors'
 * @returns {'p1' | 'p2' | 'draw'}
 */
export function resolveChoice(p1Choice, p2Choice) {
  if (p1Choice === p2Choice) return 'draw'
  return WEAPONS[p1Choice].beats === p2Choice ? 'p1' : 'p2'
}

/**
 * Generates a random 4-character uppercase room code.
 * Excludes visually ambiguous characters (I, O, 0, 1).
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

/**
 * Shuffles players randomly and pairs them into match descriptors.
 * If the player count is odd, the last player receives a bye (auto-advance).
 *
 * @param {Array<{id: string}>} players
 * @returns {Array<{player1_id, player2_id, is_bye}>}
 */
export function createBracketPairs(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const pairs = []

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairs.push({
      player1_id: shuffled[i].id,
      player2_id: shuffled[i + 1].id,
      is_bye: false,
    })
  }

  // Odd player out → auto-advance with a bye
  if (shuffled.length % 2 !== 0) {
    pairs.push({
      player1_id: shuffled[shuffled.length - 1].id,
      player2_id: null,
      is_bye: true,
    })
  }

  return pairs
}

/**
 * Returns true when every non-bye, waiting match in the list
 * has both players' choices submitted — i.e., ready to reveal.
 */
export function allMatchesReady(matches) {
  const active = matches.filter(m => !m.is_bye && m.status === 'waiting')
  return active.length > 0 && active.every(m => m.p1_choice && m.p2_choice)
}
