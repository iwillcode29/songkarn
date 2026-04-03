import { motion, AnimatePresence } from 'framer-motion'
import { WEAPONS } from '../../lib/gameLogic'

/**
 * Displays the current round's match cards.
 * Accepts pendingResults (Map<matchId, {p1Choice, p2Choice, winnerId, outcome}>)
 * which are used during the reveal animation window — before the DB is updated.
 *
 * Props:
 *   room            - Room record
 *   players         - All players
 *   matches         - All matches for this room
 *   isRevealing     - true during the reveal animation
 *   pendingResults  - Map of computed results shown during animation
 *   onReveal        - called when host clicks REVEAL
 *   onRematches     - called when host clicks Start Rematches
 *   onNextRound     - called when host clicks Next Round
 */
export default function BracketView({
  room,
  players,
  matches,
  isRevealing,
  pendingResults,
  onReveal,
  onRematches,
  onNextRound,
  isAdvancing = false,
}) {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  const currentMatches = matches.filter((m) => m.round_number === room.current_round)
  const prevMatches = matches.filter((m) => m.round_number < room.current_round)

  // Active = non-bye, waiting for choices
  const activeMatches = currentMatches.filter((m) => !m.is_bye && m.status === 'waiting')
  const nonByeTotal = currentMatches.filter((m) => !m.is_bye).length
  const nonByeResolved = currentMatches.filter((m) => !m.is_bye && m.status === 'resolved').length
  const allResolved = nonByeTotal > 0 && nonByeResolved === nonByeTotal

  // Draws are resolved matches without a winner_id
  const drawMatches = currentMatches.filter(
    (m) => !m.is_bye && m.status === 'resolved' && m.winner_id === null,
  )

  const canReveal =
    !isRevealing &&
    activeMatches.length > 0 &&
    activeMatches.every((m) => m.p1_choice && m.p2_choice)

  const needsRematches = allResolved && drawMatches.length > 0
  const canAdvanceRound = allResolved && drawMatches.length === 0

  // Waiting count for status label
  const waitingCount = activeMatches.filter((m) => !m.p1_choice || !m.p2_choice).length

  return (
    <div className="min-h-dvh bg-gradient-to-b from-blue-950 via-cyan-950 to-slate-900 p-6">
      {/* Flash overlay during reveal */}
      <AnimatePresence>
        {isRevealing && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.6, 0] }}
            transition={{ duration: 1, times: [0, 0.1, 0.5, 1] }}
            className="fixed inset-0 bg-yellow-400/40 pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-white">
              Round <span className="text-cyan-400">{room.current_round}</span>
            </h2>
            <p className="text-slate-400 mt-1">
              {canReveal
                ? '🎉 All picks are in — time to reveal!'
                : allResolved
                ? needsRematches
                  ? `⚡ ${drawMatches.length} draw(s) — sudden death!`
                  : '✅ Round complete!'
                : `Waiting for ${waitingCount} more choice${waitingCount !== 1 ? 's' : ''}…`}
            </p>
          </div>

          {/* Action buttons — only one visible at a time */}
          <div className="flex gap-3">
            <AnimatePresence mode="wait">
              {canReveal && (
                <motion.button
                  key="reveal"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onReveal}
                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black text-xl rounded-2xl shadow-2xl shadow-yellow-400/30"
                >
                  💥 REVEAL!
                </motion.button>
              )}

              {needsRematches && !isRevealing && (
                <motion.button
                  key="rematch"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onRematches}
                  className="px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-black text-xl rounded-2xl shadow-xl"
                >
                  ⚡ Start Rematches!
                </motion.button>
              )}

              {canAdvanceRound && !isRevealing && (
                <motion.button
                  key="next"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={!isAdvancing ? { scale: 1.05 } : {}}
                  whileTap={!isAdvancing ? { scale: 0.95 } : {}}
                  onClick={onNextRound}
                  disabled={isAdvancing}
                  className="px-8 py-4 bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white font-black text-xl rounded-2xl shadow-xl"
                >
                  {isAdvancing ? '⏳ Starting...' : 'Next Round ➜'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Current Round Matches ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentMatches.map((match, i) => (
            <MatchCard
              key={match.id}
              match={match}
              playerMap={playerMap}
              pendingResult={pendingResults?.get(match.id)}
              revealDelay={i * 0.15} // staggered reveal animation
            />
          ))}
        </div>

        {/* ── Previous Rounds (collapsed) ── */}
        {prevMatches.length > 0 && (
          <details className="bg-white/5 rounded-2xl p-5">
            <summary className="text-slate-400 cursor-pointer font-semibold hover:text-slate-300 transition-colors">
              Previous rounds ({room.current_round - 1})
            </summary>
            <div className="mt-4 space-y-4">
              {Array.from(
                { length: room.current_round - 1 },
                (_, i) => i + 1,
              ).map((roundNum) => (
                <div key={roundNum}>
                  <p className="text-slate-500 font-semibold mb-2 text-sm">
                    Round {roundNum}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {prevMatches
                      .filter((m) => m.round_number === roundNum)
                      .map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          playerMap={playerMap}
                          compact
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// MatchCard — individual match display with reveal anim
// ─────────────────────────────────────────────────────
function MatchCard({ match, playerMap, pendingResult, revealDelay = 0, compact = false }) {
  const p1 = playerMap[match.player1_id]
  const p2 = match.player2_id ? playerMap[match.player2_id] : null

  // Use pendingResult during animation; fall back to DB state
  const resolved = pendingResult ?? (match.status === 'resolved' ? match : null)
  const winnerId = resolved?.winner_id ?? resolved?.winnerId
  const p1Choice = pendingResult?.p1Choice ?? match.p1_choice
  const p2Choice = pendingResult?.p2Choice ?? match.p2_choice

  // Only reveal weapon icons during/after the reveal animation — not before
  const showChoices = !!resolved

  const isDraw = resolved && !winnerId && !match.is_bye
  const isResolved = !!resolved

  let borderClass = 'border-white/10'
  if (isDraw) borderClass = 'border-yellow-500/60'
  else if (isResolved && winnerId) borderClass = 'border-green-500/40'

  // Status label
  let statusLabel = '🤔 Thinking…'
  let statusColor = 'text-slate-500'
  if (match.is_bye) {
    statusLabel = '🎫 BYE — Auto Advance'
    statusColor = 'text-cyan-400'
  } else if (isDraw) {
    statusLabel = '🤝 DRAW — Sudden Death!'
    statusColor = 'text-yellow-400'
  } else if (isResolved && winnerId) {
    const winner = playerMap[winnerId]
    statusLabel = `🏆 ${winner?.name ?? '?'} wins!`
    statusColor = 'text-green-400'
  } else if (p1Choice && p2Choice) {
    statusLabel = '✅ Ready!'
    statusColor = 'text-cyan-400'
  } else if (p1Choice || p2Choice) {
    statusLabel = '⏳ Waiting for 1 more…'
    statusColor = 'text-yellow-500'
  }

  return (
    <motion.div
      layout
      className={`bg-white/10 border ${borderClass} rounded-2xl p-4 space-y-3`}
    >
      <PlayerRow
        player={p1}
        choice={showChoices ? p1Choice : null}
        hasChosen={!!match.p1_choice}
        isWinner={isResolved && winnerId === match.player1_id}
        isLoser={isResolved && !!winnerId && winnerId !== match.player1_id}
        revealDelay={revealDelay}
        compact={compact}
      />

      <div className="text-center text-slate-600 font-bold text-xs">VS</div>

      {p2 ? (
        <PlayerRow
          player={p2}
          choice={showChoices ? p2Choice : null}
          hasChosen={!!match.p2_choice}
          isWinner={isResolved && winnerId === match.player2_id}
          isLoser={isResolved && !!winnerId && winnerId !== match.player2_id}
          revealDelay={revealDelay + 0.08}
          compact={compact}
        />
      ) : (
        <div className="text-center text-slate-600 italic text-sm">BYE</div>
      )}

      <div className={`text-center text-xs font-semibold ${statusColor}`}>
        {statusLabel}
      </div>
    </motion.div>
  )
}

function PlayerRow({ player, choice, hasChosen = false, isWinner, isLoser, revealDelay = 0, compact = false }) {
  if (!player) return null
  const weapon = choice ? WEAPONS[choice] : null

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300
        ${isWinner ? 'bg-green-500/20 ring-1 ring-green-500/40' : ''}
        ${isLoser ? 'opacity-35' : ''}`}
    >
      <img
        src={player.avatar_url}
        alt={player.name}
        className={`rounded-full bg-white/10 flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-11 h-11'}`}
      />
      <span className={`flex-1 font-semibold text-white truncate ${compact ? 'text-sm' : 'text-base'}`}>
        {player.name}
      </span>

      {/* Choice area:
            - Before reveal: show ✅ if chosen, ❓ if not
            - After reveal: show actual weapon emoji with spin-in animation */}
      <AnimatePresence mode="wait">
        {weapon ? (
          <motion.span
            key={choice}
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 12, delay: revealDelay }}
            className={compact ? 'text-xl' : 'text-3xl'}
            title={weapon.label}
          >
            {weapon.emoji}
          </motion.span>
        ) : hasChosen ? (
          <motion.span
            key="chosen"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={compact ? 'text-base' : 'text-xl'}
          >
            ✅
          </motion.span>
        ) : (
          <motion.span
            key="hidden"
            className={`opacity-20 ${compact ? 'text-xl' : 'text-3xl'}`}
          >
            ❓
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
