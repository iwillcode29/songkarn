-- ============================================================
-- Songkran Tournament — Supabase Migration
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rooms (
  id            TEXT        PRIMARY KEY,            -- 4-char code, e.g. "WTRG"
  status        TEXT        NOT NULL DEFAULT 'lobby',  -- lobby | playing | finished
  current_round INT         NOT NULL DEFAULT 1,
  game_mode     TEXT        NOT NULL DEFAULT 'bracket', -- bracket | quiz
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.players (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    TEXT        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  avatar_url TEXT        NOT NULL,
  is_alive   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- matches.p2_id is NULL for bye entries
-- winner_id is NULL for unresolved or draw
CREATE TABLE IF NOT EXISTS public.matches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      TEXT        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number INT         NOT NULL,
  player1_id   UUID        REFERENCES public.players(id),
  player2_id   UUID        REFERENCES public.players(id),
  p1_choice    TEXT,       -- water_gun | umbrella | scissors
  p2_choice    TEXT,       -- water_gun | umbrella | scissors
  status       TEXT        NOT NULL DEFAULT 'waiting', -- waiting | resolved
  winner_id    UUID        REFERENCES public.players(id),
  is_bye       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- Open policies for anonymous party game — no auth required.
-- ────────────────────────────────────────

ALTER TABLE public.rooms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_rooms"
  ON public.rooms FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_players"
  ON public.players FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_matches"
  ON public.matches FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- ────────────────────────────────────────
-- 3. ENABLE REALTIME
-- Broadcasts INSERT / UPDATE / DELETE to subscribers.
-- ────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- ────────────────────────────────────────
-- 4. QUIZ MODE (run this if upgrading from bracket-only schema)
-- Adds game_mode column to rooms table.
-- ────────────────────────────────────────

-- ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'bracket';

-- ────────────────────────────────────────
-- 5. QUIZ SEED + COUNTDOWN (run this if upgrading)
-- quiz_seed: per-game seed so replaying quiz gives different questions.
-- question_started_at: countdown anchor — both host and players derive timer from this.
-- ────────────────────────────────────────

-- ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS quiz_seed BIGINT DEFAULT NULL;
-- ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ;

-- ────────────────────────────────────────
-- 6. QUIZ CATEGORY (run this if upgrading)
-- quiz_category: selected category for quiz mode (null = all categories).
-- ────────────────────────────────────────

-- ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS quiz_category TEXT DEFAULT NULL;

-- ────────────────────────────────────────
-- 7. QUIZ SCORE (run this if upgrading)
-- score: per-player score for quiz mode (incremented on correct answers).
-- ────────────────────────────────────────

-- ALTER TABLE public.players ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 0;

-- Atomic score increment function for quiz mode (avoids read-modify-write races).
-- CREATE OR REPLACE FUNCTION public.increment_score(player_ids UUID[])
-- RETURNS void AS $$
--   UPDATE public.players SET score = score + 1 WHERE id = ANY(player_ids);
-- $$ LANGUAGE sql VOLATILE;
