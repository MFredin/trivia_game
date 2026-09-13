CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Which house-bound color theme the player has chosen (see frontend/src/constants/houses.js).
-- New accounts default to Monochrome until they pick a house in Settings.
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'monochrome';
ALTER TABLE users ALTER COLUMN theme SET DEFAULT 'monochrome';

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  friend_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_user_id)
);

-- 'pending' (user_id sent a request to friend_user_id, not yet answered) or 'accepted'.
-- A friendship counts as mutual once BOTH directional rows are 'accepted' (see routes/friends.js).
-- NOT NULL DEFAULT 'accepted' both sets new rows correctly and grandfathers every friendship
-- that existed before requests did, with no retroactive friction for existing users.
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requested_by INTEGER REFERENCES users(id);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  canon_tags TEXT[] NOT NULL DEFAULT '{}',
  divergence BOOLEAN NOT NULL DEFAULT false,
  obscurity_tier TEXT NOT NULL,
  design_tier TEXT NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractors TEXT[] NOT NULL,
  explanation TEXT,
  source_ref TEXT,
  needs_factcheck BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL,
  category TEXT,
  canon_source TEXT NOT NULL DEFAULT 'combined',
  question_count INTEGER NOT NULL,
  time_limit_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  streak INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  daily_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Migration for pre-existing databases: schema.sql is re-run as a whole idempotent script
-- (via `npm run db:migrate`), so new columns are added here with ALTER ... ADD COLUMN IF NOT EXISTS
-- rather than by editing the CREATE TABLE above, which no-ops on a table that already exists.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS obscurity_filter TEXT;

-- ISO week key (e.g. "2026-W37") the session was PLAYED in, computed once at creation time —
-- powers the rotating "This Week" leaderboard without any date math in queries later.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS leaderboard_window TEXT;

CREATE TABLE IF NOT EXISTS duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by INTEGER NOT NULL REFERENCES users(id),
  opponent_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT,
  canon_source TEXT NOT NULL DEFAULT 'combined',
  obscurity_filter TEXT,
  question_count INTEGER NOT NULL,
  time_limit_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- A duel's two game_sessions (one per participant) share a duel_id and are seeded from it,
-- so both players get the identical question sequence — the same mechanism Daily Challenge
-- already uses for daily_key, just keyed by duel instead of by day.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS duel_id UUID REFERENCES duels(id);

-- Count of wrong/timed-out answers so far, for strike-limited modes (Survival, Gauntlet).
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS strikes INTEGER NOT NULL DEFAULT 0;

-- Peak streak reached during the run. Unlike `streak` (the streak AT THE MOMENT the run ended,
-- which a final wrong answer resets to 0), this is what streak-based achievements check.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS best_streak INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_game_sessions_leaderboard
  ON game_sessions (mode, status, total_score DESC);

CREATE INDEX IF NOT EXISTS idx_game_sessions_leaderboard_window
  ON game_sessions (mode, status, leaderboard_window, total_score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_daily_session_per_user
  ON game_sessions (user_id, daily_key)
  WHERE daily_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id),
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS session_questions (
  id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id),
  position INTEGER NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  choice_order INTEGER[] NOT NULL,
  correct_choice_index INTEGER NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  chosen_index INTEGER,
  correct BOOLEAN,
  timed_out BOOLEAN NOT NULL DEFAULT false,
  points INTEGER,
  elapsed_ms INTEGER,
  UNIQUE (session_id, question_id),
  UNIQUE (session_id, position)
);
