CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  friend_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_user_id)
);

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

CREATE INDEX IF NOT EXISTS idx_game_sessions_leaderboard
  ON game_sessions (mode, status, total_score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_daily_session_per_user
  ON game_sessions (user_id, daily_key)
  WHERE daily_key IS NOT NULL;

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
