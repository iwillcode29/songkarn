# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server (hot reload)
- `npm run build` — production build
- `npm run preview` — preview production build locally

No test framework or linter is configured.

## Environment

Requires a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). Deployed on Vercel.

## What This Is

A Songkran-themed party game. One host displays the game on a TV/laptop (`/host`), players join on their phones by scanning a QR code (`/join/:roomId`). Three game modes: **bracket** (RPS tournament), **quiz** (run-to-zone trivia), and **random** (random picker).

## Architecture

**Two-screen model.** HostPage and JoinPage are the only pages. They share no components — host renders to a big screen, JoinPage renders to a phone. State is synced via Supabase Realtime (postgres_changes for DB rows, broadcast for arena positions).

**Room lifecycle:** `idle → lobby → playing → finished`. HostPage orchestrates all DB writes that advance game state. JoinPage is read-heavy — it only writes the player's own choice/join.

**Supabase tables:** `rooms`, `players`, `matches`. All three have Realtime hooks (`useRoom`, `usePlayers`, `useMatches`) that subscribe to postgres_changes AND poll every 3s as a fallback for silent Realtime failures.

**Arena system** (`useArena` hook + `Arena` component):
- RAF game loop at 60fps (falls back to 10fps setInterval when tab is unfocused)
- Player positions broadcast via Supabase Realtime broadcast channel (`arena:{roomId}`)
- Remote players interpolated via lerp + dead reckoning between broadcasts
- Module-level channel cache (`arenaChannels` Map) survives Arena remounts during lobby-to-quiz transitions — no reconnect gap
- Adaptive broadcast rate: 30Hz for ≤6 players, scaling down to 10Hz at 20+ players
- Projectile hit detection runs only on the shooter's client to avoid duplicate damage
- Physics is pure functions in `lib/arena/physics.js` (no React, no network)

**Quiz mode** uses a seeded PRNG (`mulberry32`) so host and all players derive the same questions from the same seed — no need to broadcast question data. Host writes `question_started_at` to DB; all clients derive the countdown from that timestamp.

**Quiz zone position reporting:** On reveal, mobile clients report their exact position back to the host via broadcast (`quiz-pos` event). Host uses reported positions with fallback to its own interpolated view. Players with no position data are NOT eliminated.

## Key Patterns

- **CSS-rotated landscape on mobile:** `.arena-landscape` rotates portrait phones to landscape via `transform: rotate(90deg)` with `@media (orientation: landscape)` undoing it. The joystick axis swaps accordingly (tracked via `isPortrait` state).
- **Reconnect resilience:** `useReconnect` hook triggers data refetch on visibility change and network online events. Supabase client configured with aggressive reconnect (200ms-5s backoff).
- **Player cleanup on disconnect:** 30-second grace period before deleting disconnected players (party WiFi can drop for 10-20s). Presence sync confirms departure before delete.
- **All rendering uses `transform: translate3d()` for positioning** — never `left`/`top` — to avoid layout thrash in the arena.
- **No external sprite assets.** All pixel art is inline SVG with `shapeRendering="crispEdges"` and `imageRendering: pixelated`.
- **Sound effects** (`lib/sfx.js`) require a user gesture to unlock (`sfx.unlock()` on first pointerdown).
- **Room ID persisted in localStorage** (`songkran_host_room` for host, `songkran_player_{roomId}` for players) to survive page refreshes.

## Supabase Realtime Constraints

- Broadcast channel rate limits are a concern at scale. The codebase uses adaptive throttling, delta suppression, and idle heartbeats to stay under limits.
- `useRoom`/`usePlayers`/`useMatches` all re-fetch full rows on change events rather than trusting `payload.new` (Supabase may return partial objects without REPLICA IDENTITY FULL).
