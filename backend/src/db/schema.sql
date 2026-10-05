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

-- Gates the question-suggestion review screen and its approve/reject actions. No self-serve
-- promotion flow by design — the first admin (and any others) is granted by running
-- `UPDATE users SET is_admin = true WHERE email = '...';` directly against the database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- A player's own invite link is /?invite=<code> — generated lazily on first request
-- (see routes/auth.js) rather than at registration, so existing accounts get one too.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

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

-- Lifelines, Classic only. Which ones a run has spent, so the server — not the client — is
-- the thing that knows a lifeline is gone. One of each per run.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS lifelines_used TEXT[] NOT NULL DEFAULT '{}';

-- Phase 2 anti-cheat (docs/anti-cheat-architecture.md): a completed run whose own answers look
-- implausible (perfect accuracy at the hardest tier plus near-minimum response times
-- throughout) is shadow-flagged here rather than penalized. A flagged run keeps playing, keeps
-- its score, and still shows up in the player's own history — only the PUBLIC leaderboard query
-- excludes it, pending a human glance. flag_reason is free text for that manual look, not a
-- machine-read code.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS flag_reason TEXT;

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

-- Player-submitted question drafts, reviewed by an admin before ever becoming a live question.
-- obscurity_tier/design_tier are nullable here — a submitter can't be expected to calibrate
-- those against the existing bank, so an admin sets them at approval time, not the submitter.
CREATE TABLE IF NOT EXISTS suggested_questions (
  id SERIAL PRIMARY KEY,
  suggested_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  category TEXT NOT NULL,
  canon_tags TEXT[] NOT NULL DEFAULT '{}',
  divergence BOOLEAN NOT NULL DEFAULT false,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractors TEXT[] NOT NULL,
  explanation TEXT,
  source_ref TEXT,
  obscurity_tier TEXT,
  design_tier TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  approved_question_id TEXT REFERENCES questions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggested_questions_status
  ON suggested_questions (status, created_at);

-- A player-created quiz with a locked category/difficulty and a shared seed — like Daily
-- Challenge, but spun up on demand and shared via a code instead of waiting for tomorrow.
-- time_limit_ms isn't stored here; every challenge runs at Classic's fixed time limit, the
-- same way duel_id sessions do. question_count IS overridable — see the ALTER below.
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  category TEXT,
  canon_source TEXT NOT NULL DEFAULT 'combined',
  obscurity_filter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every player who starts a challenge gets their own game_sessions row, all sharing this
-- challenge_id and seeded from it (same mechanism as daily_key/duel_id) so everyone sees the
-- identical question sequence. Runs under mode = 'challenge', never 'classic' — so a group
-- picking an easy category/tier to inflate scores can't pollute the real Classic leaderboard.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS challenge_id INTEGER REFERENCES challenges(id);

-- The featured weekly challenge is a system-generated challenge, so it has no creator. One
-- row per ISO week, keyed by the same week string the leaderboard windows already use, and
-- created lazily the first time anyone asks for that week. The UNIQUE constraint is what
-- makes that creation safe when two players ask at the same moment.
ALTER TABLE challenges ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS featured_week TEXT UNIQUE;

-- A challenge creator can pick how many questions the link runs (see MODES.challenge's
-- comment in lib/modes.js) — NULL on existing rows and the featured weekly challenge means
-- "use the mode default."
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS question_count INTEGER;

-- "Alice just beat her personal best" — a small, friends-scoped activity feed. Never pushed
-- (no toast, no badge); it's a tab a player opens when they're curious, on the Friends screen.
CREATE TABLE IF NOT EXISTS activity_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events (created_at DESC);

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

-- Which lifeline, if any, was applied to this question: 'fifty_fifty' or 'skip'. Recorded
-- per question rather than only per session because scoring depends on it — a question
-- answered after a 50-50 is worth less, and a skipped one is worth nothing.
ALTER TABLE session_questions ADD COLUMN IF NOT EXISTS lifeline TEXT;

-- ---------------------------------------------------------------------------
-- Access-path indexes (platform audit)
--
-- The three leaderboard indexes above all lead with `mode`, so none of them helps a query
-- that starts from a person, a duel or a challenge — and most of the app does. Every one of
-- these backs a filter that already exists in the routes; they add no behaviour, only a way
-- to answer those filters without reading the whole table as it grows.
-- ---------------------------------------------------------------------------

-- Profile is five separate scans of this table for one player, and every completed run
-- re-reads it to work out whether the score is a personal best.
CREATE INDEX IF NOT EXISTS idx_game_sessions_user
  ON game_sessions (user_id, status);

-- Duel scoring pairs the two runs by duel_id, and does it once per duel row when listing a
-- record, so this is the difference between a lookup and a scan per duel.
CREATE INDEX IF NOT EXISTS idx_game_sessions_duel
  ON game_sessions (duel_id) WHERE duel_id IS NOT NULL;

-- Challenge leaderboards read every completed run for one challenge.
CREATE INDEX IF NOT EXISTS idx_game_sessions_challenge
  ON game_sessions (challenge_id) WHERE challenge_id IS NOT NULL;

-- UNIQUE (user_id, friend_user_id) already serves lookups that start from the requester. The
-- incoming-requests query starts from the other end and had no index at all.
CREATE INDEX IF NOT EXISTS idx_friendships_friend
  ON friendships (friend_user_id, status);

-- Duel lists filter on one of the two participant columns plus status; a single index cannot
-- serve an OR across two columns, so each side gets its own.
CREATE INDEX IF NOT EXISTS idx_duels_created_by ON duels (created_by, status);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON duels (opponent_id, status);

-- The activity feed is friends-scoped before it is ordered, so the existing created_at-only
-- index has to read rows belonging to everyone else to find the ones it wants.
CREATE INDEX IF NOT EXISTS idx_activity_events_user_created
  ON activity_events (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Social profiles
-- ---------------------------------------------------------------------------

-- The sigil a player chose for their avatar (see lib/avatars.js for the allowed ids). NULL is
-- the default and means "draw my initial", so no existing account needs a backfill.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Who may see this player's list of friends on their profile: 'everyone', 'friends' or
-- 'only_me' (see lib/friendsVisibility.js). Defaults to friends-only for every account,
-- existing ones included — the list exposes other people's names, so nobody should have to find
-- the setting before their friends stop being listed to strangers.
ALTER TABLE users ADD COLUMN IF NOT EXISTS friends_visibility TEXT NOT NULL DEFAULT 'friends';

-- A player blocking another. One row per direction a player has chosen; the app treats a block
-- as mutual in effect (neither can see, add, challenge or react to the other — services/blocks.js)
-- but only the blocker's row exists, so only the blocker can lift it and the blocked player
-- cannot tell it is there.
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id),
  blocked_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- The primary key serves "who have I blocked"; "who has blocked me" starts from the other end.
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- Reports on a player, for an admin to read. Free text is capped by the route, and the reason is
-- one of a fixed list (lib/reportReasons.js) so the queue can be scanned rather than read.
-- A report is never shown to the reported player.
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  reported_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ
);

-- One open report per reporter per player: pressing Report twice must not put two rows in the
-- queue, and repeating a report is not a way to make it louder.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_report_per_pair
  ON reports (reporter_id, reported_id) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at);

-- Set when a player deletes their account (services/accountDeletion.js). The row is KEPT, with
-- every piece of personal data on it removed, because other players' history points at it —
-- the other side of a duel, a challenge leaderboard, the question they once suggested. Anywhere
-- that history is shown, a row with this set is displayed as "Deleted player".
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Profile customisation
-- ---------------------------------------------------------------------------

-- How the player's avatar is dressed: shape, colour, pattern, frame, corner mark (see
-- lib/avatarStyle.js). '{}' means all defaults, so no existing account needs a backfill and an
-- avatar from before this column looks exactly as it did.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_style JSONB NOT NULL DEFAULT '{}';

-- What a player says about themselves. bio is the one free-text field in the app that other
-- players read, so it is length-capped and filtered (lib/bioFilter.js) before it is stored; the
-- rest are picked from lists. pinned_achievements is up to three achievement ids shown on the
-- profile in place of the most recent unlocks.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_book TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_subject TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_achievements TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

-- A suspension is a date, a ban is a timestamp, and both are checked on every authenticated
-- request (repo/users.js), so lifting one takes effect at once. must_rename is set by a moderator
-- and cleared when the player chooses a new name (routes/account.js).
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_rename BOOLEAN NOT NULL DEFAULT false;

-- Everything a moderator does to a player, one row per action. Actions taken together on one
-- report share a batch_id and a note, so the player sees one notice, not three. `note` is what
-- the player is told; it is written for them. acknowledged_at is how a warning stays on screen
-- until it has been read; suspend and ban are created acknowledged, because the player cannot
-- sign in to read anything — they see the note at the login screen instead.
CREATE TABLE IF NOT EXISTS moderation_actions (
  id SERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  report_id INTEGER REFERENCES reports(id),
  admin_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  note TEXT NOT NULL,
  days INTEGER,
  expires_at TIMESTAMPTZ,
  email_hash TEXT,
  acknowledged_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  lifted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_user ON moderation_actions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_batch ON moderation_actions (batch_id);

-- What a report ended in, in words, for the resolved list ("Warned; suspended 7 days").
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution TEXT;

-- A banned player could otherwise delete the account and register again with the same email.
-- Only a hash of the email is kept, only for a banned account, and it outlives the account's
-- deletion on purpose: that is the whole point of it. Removed if the ban is lifted.
CREATE TABLE IF NOT EXISTS banned_emails (
  email_hash TEXT PRIMARY KEY,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Owl Post: messages between friends
-- ---------------------------------------------------------------------------

-- 'friends' (the default: friends may send this player owls) or 'off' (no one may, and they may not
-- send). muted_until is set by a moderator (lib/moderation.js): a muted player can read but not send.
ALTER TABLE users ADD COLUMN IF NOT EXISTS owl_post TEXT NOT NULL DEFAULT 'friends';
ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;

-- One row per message, between two players. "Delete for me" sets the matching flag rather than
-- removing the row, because the other player still has their copy; the row itself goes after the
-- retention period (services/owlPost.js) or when either account is deleted.
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  deleted_by_sender BOOLEAN NOT NULL DEFAULT false,
  deleted_by_recipient BOOLEAN NOT NULL DEFAULT false,
  CHECK (sender_id <> recipient_id)
);

-- A conversation is the pair, whichever way round: both directions read from one index.
CREATE INDEX IF NOT EXISTS idx_messages_pair
  ON messages (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (recipient_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);

-- When a report is made from inside a conversation, the recent messages are copied here at that
-- moment: what a moderator is shown, so they never have to read anyone's inbox, and so the evidence
-- cannot be tidied away by deleting the messages afterwards.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence JSONB;

-- A message may carry a short subject, chosen when composing a new owl. Optional, plain text, and
-- held to the same filter as the message itself.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT;

-- Who may send this player an owl, and who may challenge them to a duel: 'open' (anyone, the default
-- for a new account), 'friends' or 'off' (lib/contactModes.js). Existing accounts keep what they had:
-- owl_post stays 'friends' for them, and everyone could already be challenged, so challenges is 'open'.
ALTER TABLE users ALTER COLUMN owl_post SET DEFAULT 'open';
ALTER TABLE users ADD COLUMN IF NOT EXISTS challenges TEXT NOT NULL DEFAULT 'open';

-- ---------------------------------------------------------------------------
-- Titles (lib/titles.js)
-- ---------------------------------------------------------------------------

-- The title a player is wearing, by id. Earned titles are not stored: a player has one while they hold
-- the achievement it hangs on. This column is only what they chose to show, and is cleared when a
-- granted title is revoked.
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;

-- System titles an admin has granted to a person. Nothing else grants one.
CREATE TABLE IF NOT EXISTS user_titles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);

-- When a new account passed the age check at registration (lib/ageGate.js). Only that it was passed:
-- the birth date asked for at the time is not stored. Accounts that pre-date the check have none.
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Moderators (lib/roles.js)
-- ---------------------------------------------------------------------------

-- A moderator reviews reports and acts on them within limits; an admin (is_admin) can do everything.
-- Made and unmade by an admin from the Team screen. Promoting an admin still has no route, by design.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT false;

-- A moderator who finds a report needs more than they may do (a ban, a longer suspension) escalates it:
-- it stays open, goes to the top of the admins' queue, and carries who sent it up and why.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS escalated_by INTEGER REFERENCES users(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS escalation_note TEXT;

-- ---------------------------------------------------------------------------
-- Links sent by email: password reset, account deletion (services/emailTokens.js)
-- ---------------------------------------------------------------------------

-- Only the hash of the token is kept; the token itself exists only in the message. One live token per
-- account and purpose. Used and expired rows are swept after a day.
CREATE TABLE IF NOT EXISTS email_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- A count of messages sent per account, so one address cannot be sent a flood by asking repeatedly.
-- No address is kept here, and it is swept after two days.
CREATE TABLE IF NOT EXISTS email_token_log (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_token_log_user ON email_token_log (user_id, created_at);
