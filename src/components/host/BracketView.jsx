import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WEAPONS } from '../../lib/gameLogic'
import { sfx } from '../../lib/sfx'

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
  onForceRandom,
  isForcing = false,
}) {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]))

  const currentMatches = matches.filter((m) => m.round_number === room.current_round)
  const prevMatches = matches.filter((m) => m.round_number < room.current_round)

  const activeMatches = currentMatches.filter((m) => !m.is_bye && m.status === 'waiting')
  const nonByeTotal = currentMatches.filter((m) => !m.is_bye).length
  const nonByeResolved = currentMatches.filter((m) => !m.is_bye && m.status === 'resolved').length
  const allResolved = nonByeTotal > 0 && nonByeResolved === nonByeTotal

  const drawMatches = currentMatches.filter(
    (m) => !m.is_bye && m.status === 'resolved' && m.winner_id === null,
  )

  const canReveal =
    !isRevealing &&
    activeMatches.length > 0 &&
    activeMatches.every((m) => m.p1_choice && m.p2_choice)

  const needsRematches = allResolved && drawMatches.length > 0
  const canAdvanceRound = allResolved && drawMatches.length === 0

  const waitingCount = activeMatches.filter((m) => !m.p1_choice || !m.p2_choice).length

  const canForceRandom =
    !isRevealing &&
    !isForcing &&
    activeMatches.length > 0 &&
    activeMatches.some((m) => !m.p1_choice || !m.p2_choice)

  // Countdown beeps during reveal animation
  useEffect(() => {
    if (!isRevealing) return
    sfx.countdown(3)
    const t1 = setTimeout(() => sfx.countdown(2), 400)
    const t2 = setTimeout(() => sfx.countdown(1), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isRevealing])

  return (
    <div className="sk-bg p-6 overflow-hidden">
      {/* Flash overlay during reveal — warm gold flash */}
      <AnimatePresence>
        {isRevealing && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0.5, 0] }}
            transition={{ duration: 1, times: [0, 0.1, 0.5, 1] }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: 'radial-gradient(circle at center, rgba(232,184,74,0.4), rgba(212,152,43,0.15))' }}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black" style={{ color: 'var(--cream-50)' }}>
              Round <span className="sk-gold-text">{room.current_round}</span>
            </h2>
            <p className="mt-1 font-body" style={{ color: 'var(--cream-400)' }}>
              {canReveal
                ? 'All picks are in — time to reveal!'
                : allResolved
                ? needsRematches
                  ? `${drawMatches.length} draw(s) — sudden death!`
                  : 'Round complete!'
                : `Waiting for ${waitingCount} more choice${waitingCount !== 1 ? 's' : ''}…`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <AnimatePresence mode="wait">
              {canForceRandom && (
                <ActionButton
                  key="force"
                  onClick={onForceRandom}
                  disabled={isForcing}
                  bg="linear-gradient(135deg, var(--terra-400), var(--terra-600))"
                  color="var(--cream-50)"
                  shadow="rgba(217,119,85,0.2)"
                >
                  {isForcing ? 'Randomising...' : `Force Random (${waitingCount})`}
                </ActionButton>
              )}

              {canReveal && (
                <ActionButton
                  key="reveal"
                  onClick={onReveal}
                  bg="linear-gradient(135deg, var(--gold-400), var(--gold-600))"
                  color="var(--twilight-950)"
                  shadow="rgba(232,184,74,0.25)"
                >
                  REVEAL!
                </ActionButton>
              )}

              {needsRematches && !isRevealing && (
                <ActionButton
                  key="rematch"
                  onClick={onRematches}
                  bg="linear-gradient(135deg, var(--terra-400), var(--terra-600))"
                  color="var(--cream-50)"
                  shadow="rgba(217,119,85,0.2)"
                >
                  Start Rematches!
                </ActionButton>
              )}

              {canAdvanceRound && !isRevealing && (
                <ActionButton
                  key="next"
                  onClick={onNextRound}
                  disabled={isAdvancing}
                  bg="linear-gradient(135deg, var(--water-400), var(--water-600))"
                  color="var(--cream-50)"
                  shadow="rgba(74,184,212,0.2)"
                >
                  {isAdvancing ? 'Starting...' : 'Next Round →'}
                </ActionButton>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Current Round Matches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentMatches.map((match, i) => (
            <MatchCard
              key={match.id}
              match={match}
              playerMap={playerMap}
              pendingResult={pendingResults?.get(match.id)}
              revealDelay={i * 0.15}
            />
          ))}
        </div>

        {/* Previous Rounds */}
        {prevMatches.length > 0 && (
          <details className="sk-surface rounded-2xl p-5">
            <summary
              className="cursor-pointer font-semibold transition-colors"
              style={{ color: 'var(--cream-400)' }}
            >
              Previous rounds ({room.current_round - 1})
            </summary>
            <div className="mt-4 space-y-4">
              {Array.from(
                { length: room.current_round - 1 },
                (_, i) => i + 1,
              ).map((roundNum) => (
                <div key={roundNum}>
                  <p className="font-semibold mb-2 text-sm" style={{ color: 'var(--cream-400)' }}>
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

function ActionButton({ children, onClick, disabled, bg, color, shadow }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={disabled}
      className="px-8 py-4 font-black text-xl rounded-2xl disabled:opacity-60 transition-shadow"
      style={{
        background: bg,
        color,
        boxShadow: `0 8px 24px ${shadow}`,
      }}
    >
      {children}
    </motion.button>
  )
}

function MatchCard({ match, playerMap, pendingResult, revealDelay = 0, compact = false }) {
  const p1 = playerMap[match.player1_id]
  const p2 = match.player2_id ? playerMap[match.player2_id] : null

  const resolved = pendingResult ?? (match.status === 'resolved' ? match : null)
  const winnerId = resolved?.winner_id ?? resolved?.winnerId
  const p1Choice = pendingResult?.p1Choice ?? match.p1_choice
  const p2Choice = pendingResult?.p2Choice ?? match.p2_choice

  const showChoices = !!resolved

  const isDraw = resolved && !winnerId && !match.is_bye
  const isResolved = !!resolved

  let borderColor = 'rgba(232,184,74,0.06)'
  if (isDraw) borderColor = 'rgba(232,184,74,0.3)'
  else if (isResolved && winnerId) borderColor = 'rgba(74,184,212,0.25)'

  let statusLabel = 'Thinking…'
  let statusColor = 'var(--cream-400)'
  if (match.is_bye) {
    statusLabel = 'BYE — Auto Advance'
    statusColor = 'var(--water-400)'
  } else if (isDraw) {
    statusLabel = 'DRAW — Sudden Death!'
    statusColor = 'var(--gold-400)'
  } else if (isResolved && winnerId) {
    const winner = playerMap[winnerId]
    statusLabel = `${winner?.name ?? '?'} wins!`
    statusColor = 'var(--water-300)'
  } else if (p1Choice && p2Choice) {
    statusLabel = 'Ready!'
    statusColor = 'var(--water-400)'
  } else if (p1Choice || p2Choice) {
    statusLabel = 'Waiting for 1 more…'
    statusColor = 'var(--gold-400)'
  }

  return (
    <motion.div
      layout
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${borderColor}`,
      }}
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

      <div className="text-center font-bold text-xs" style={{ color: 'rgba(196,168,122,0.3)' }}>VS</div>

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
        <div className="text-center italic text-sm" style={{ color: 'var(--cream-400)' }}>BYE</div>
      )}

      <div className="text-center text-xs font-semibold" style={{ color: statusColor }}>
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
        ${isLoser ? 'opacity-35' : ''}`}
      style={isWinner ? {
        background: 'rgba(74,184,212,0.1)',
        boxShadow: 'inset 0 0 0 1px rgba(74,184,212,0.2)',
      } : {}}
    >
      <img
        src={player.avatar_url}
        alt={player.name}
        className={`rounded-full flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-11 h-11'}`}
        style={{ background: 'rgba(255,255,255,0.06)' }}
      />
      <span
        className={`flex-1 font-semibold truncate ${compact ? 'text-sm' : 'text-base'}`}
        style={{ color: 'var(--cream-100)' }}
      >
        {player.name}
      </span>

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
