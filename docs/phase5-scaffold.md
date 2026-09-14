# Phase 5 scaffold — Social & Retention Depth

Implementation-ready specs for the five Phase 5 items in the README roadmap, written up
before starting any of it, per the same "scaffold and document first" pattern as
`docs/phase4-scaffold.md`. None of these depend on each other except where noted; pick one
and go.

## Design principle: stay optional, stay light

Phase 4 was about growth — getting people in the door. Phase 5 is about giving them reasons
to come back. That's exactly the territory where a trivia app can quietly turn into a
retention-mechanics app instead, so every item below is held to the same four rules:

1. **The quiz is still the whole point.** Nothing here changes scoring, adds a resource/currency,
   or gates a game mode behind a social action. A player who adds zero friends and never opens
   any of these screens plays an identical game to one who uses all five.
2. **Nothing pushes.** No modals that appear unprompted, no "come back or lose X" framing, no
   badge/unread-count chrome nagging you back to a screen. Toasts stay reserved for the
   player's own actions (an achievement *they* unlocked) — nothing here adds a toast for
   someone else's activity. If a feature has something to show you, it waits on a screen you
   chose to open.
3. **No new mandatory chrome.** Every new screen slots into a tab on a screen that already
   exists (Friends, Achievements) or is reached by a single optional link, never a new
   always-visible nav item competing for attention with Home/Leaderboard/Friends.
4. **Prefer derived over stored.** Where a stat can be computed from data the app already
   records (as several items below can), that beats adding a column or a background job —
   fewer moving parts, and nothing new to keep consistent.

Each section below has its own **Restraint** note spelling out how it holds to these.

## 1. Private challenge links

**Goal**: assemble a custom quiz (category + difficulty) and share a code so a group all
plays the identical question set and compares scores — like a Daily Challenge you can spin up
on demand instead of waiting for tomorrow's.

**Restraint**: this is Classic mode with a locked filter and a shared seed, nothing more —
same scoring, same question count, same time limit. It's invisible unless you click "Create a
Challenge Link" (one secondary button near Start, not a new nav item) or someone hands you a
link. No customization of question count/time limit is exposed — keeping the feature itself
simple is as much a restraint as keeping the UI quiet.

- **Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    category TEXT,
    canon_source TEXT NOT NULL DEFAULT 'combined',
    obscurity_filter TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS challenge_id INTEGER REFERENCES challenges(id);
  ```
  `question_count`/`time_limit_ms` aren't stored per-challenge — every challenge just runs at
  Classic's fixed 10-question/20s config, the same way `duel_id` sessions do.
- **Backend**:
  - `POST /api/challenges` (`requireAuth`) — body `{ category, canon_source, difficulty }`,
    generates a short code the same way `invite_code` does (`crypto.randomBytes(4).toString('hex')`,
    retried on collision), inserts the row, returns `{ code }`.
  - `POST /api/challenges/:code/start` (`requireAuth`) — looks up the challenge, 404s if
    missing, then creates a `game_sessions` row exactly like `POST /sessions` does but with
    `mode: 'challenge'`, `challenge_id` set, and category/canon_source/obscurity_filter copied
    from the challenge row instead of the request body.
  - `GET /api/challenges/:code` — no auth required (same reasoning as leaderboards being
    readable without one): returns the challenge's config plus its leaderboard — every
    completed `game_sessions` row with that `challenge_id`, deduped to each player's best
    attempt (reuse the existing top-score-per-user CTE), ranked by score.
  - `pickNextQuestion`'s deterministic-seed branch (`services/sessionQuestions.js`) gains one
    more case: `session.mode === 'challenge' ? session.challenge_id : ...` — one line, same
    pattern Daily/Duel already use.
  - **Fairness decision**: challenge runs use `mode: 'challenge'`, not `'classic'` — so they
    never mix into the real Classic leaderboard. A group could otherwise pick an easy
    category/tier specifically to put up inflated scores on the segment the rest of the
    playerbase competes on; keeping challenge mode's own `mode` value is what the leaderboard
    segmentation fix earlier this project already established is the right way to prevent that
    kind of intermingling.
- **Frontend**:
  - A "Create a Challenge Link" action on the Start screen, reusing the same category/difficulty
    pickers Classic mode already has, posting to `/api/challenges` and showing the shareable
    `${origin}/?challenge=<code>` link with the same copy-to-clipboard pattern as the invite link.
  - `App.jsx` reads `?challenge=` on mount (same pattern as `?invite=`), and — once the visitor
    is logged in — shows a small "Play this Challenge" screen: the creator's name, the
    category/difficulty, the current leaderboard, and a button that calls
    `POST /api/challenges/:code/start`.
- **Effort**: medium (one new table, three endpoints, one new screen — closely modeled on the
  Daily Challenge and Duel code paths that already exist).

## 2. Activity feed

**Goal**: "Alice just beat her personal best" — make the app feel alive even with a handful of
concurrent players, built entirely from events the app already generates.

**Restraint**: friends-scoped by default (not a firehose of strangers), lives as one more tab
on the existing Friends screen (next to Online Now / All Members / Search) rather than a new
nav item, and is never pushed at anyone — no toast, no badge, no unread count. You see it only
if you open the Friends screen and click the tab. Scope is deliberately narrow for v1 (three
event types) rather than trying to capture everything from day one.

- **Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS activity_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events (created_at DESC);
  ```
- **Backend**:
  - Three event types, each an `INSERT` at a point that already exists in the code:
    - `personal_best` — in `routes/sessions.js`'s answer handler, when `sessionComplete` and
      `newTotalScore` exceeds the player's previous single-run max `total_score` (any mode).
      Kept deliberately simple: a true per-segment "best at this category+tier" check would mean
      replaying the leaderboard's own segmentation logic on every completion — the feed instead
      flags an all-time personal-best run regardless of mode/filters, which is simpler and still
      means something.
    - `achievement_unlocked` — in `services/achievements.js`'s `evaluateAchievements()`, right
      next to the existing `sendToUser(... 'achievement:unlocked')` call.
    - `duel_win` — in `services/duels.js`'s `maybeFinishDuel()`, for the winning side only.
  - Hobby-scale housekeeping: a `setInterval` sweep at startup (same shape as
    `rateLimiter.js`'s), deleting rows older than 30 days every hour — no cron/job runner needed.
  - `GET /api/activity?scope=friends|self&limit=20` (`requireAuth`) — `friends` (the default)
    joins `friendships` for accepted connections and includes the caller's own events too;
    payload per row carries just enough to render a line (`category`/`score` for personal
    bests, `achievement` id/name, `opponent_username`/scoreline for duel wins).
- **Frontend**: a fourth "Activity" tab on `FriendsPanel`, rendering a plain list —
  `🏆 Alice beat her personal best: 1,450 in Blitz`, `🎖️ Bob unlocked "Speed Demon"`,
  `⚔️ Carol won a duel against Dave, 1200-950`.
- **Effort**: small–medium (one table, three call-sites that already exist, one endpoint, one
  new tab reusing `FriendsPanel`'s existing tab-switching UI).

## 3. Player profile page

**Goal**: a lifetime stats page — accuracy, favorite category, total questions answered — from
data already sitting in `game_sessions`/`session_questions`/`user_achievements`.

**Restraint**: read-only, reached by clicking a username (in Friends, in a leaderboard row, or
your own in the header) — never a screen that asks for anything or nudges you to fill it out.
No new schema at all; this is the purest expression of "prefer derived over stored" in this
phase.

- **No schema changes.**
- **Backend**: `GET /api/profile/:username` (`requireAuth` — viewable by any logged-in player,
  same openness as the existing All Members directory). One aggregate query modeled directly on
  `services/achievements.js`'s `computeStats()`:
  - Total runs completed, total questions answered, overall accuracy % (`correct` / answered
    from `session_questions`).
  - Favorite category — the category with the most completed sessions (ties broken by total
    score in that category).
  - Best single-run score, longest `best_streak`.
  - Duel record (wins–losses) — the same subquery `computeStats()` already runs.
  - Achievement count (unlocked / total) — reuses the existing `user_achievements` count.
  - The player's `theme`, so the profile header can render in their own house colors — free
    personality from a column that already exists.
  - If the day-streak feature (§4) has landed: current streak and longest streak.
- **Frontend**: a new `ProfileScreen.jsx`. Entry points: click a username in `FriendsPanel`'s
  member rows, in any leaderboard row, or the logged-in player's own name in `NavBar` (which
  currently doesn't link anywhere — this gives it a purpose without adding a new nav item).
- **Effort**: small–medium (one aggregate query, one new screen, a few click-throughs wired
  into screens that already list usernames).

## 4. Daily play streaks

**Goal**: a Duolingo-style day-streak, distinct from the existing in-run answer streak — but
without Duolingo's loss-aversion pressure tactics, which are exactly the kind of "overpowering"
this phase is trying to avoid.

**Restraint**: this is the item most likely to tip into nagging if built carelessly, so the
decisions below are deliberate:
- **No schema changes** — current/longest streak are computed on request from the distinct
  calendar days a player has a *completed* session (any mode), by walking that date list in
  JS. Nothing to keep in sync, nothing that can drift from reality.
- **No loss framing.** A missed day doesn't unlock a warning, an email, or a modal — the number
  is simply lower next time you look. There's no "freeze" or "streak insurance" mechanic either
  (that's a monetization pattern this project has no reason to import).
- **No push/email.** We have no notification infrastructure, and this doesn't ask for any —
  the streak is purely a number you see if you go looking, not a mechanism to pull you back.
- **Server-computed, not client-tracked**, so it can't be spoofed and doesn't need any new
  client-side state.
- **Backend**: `GET /api/profile/me/streak` (or folded directly into §3's profile response) —
  `SELECT DISTINCT DATE(completed_at) FROM game_sessions WHERE user_id = $1 AND status = 'completed' ORDER BY 1 DESC`,
  then in JS: current streak = consecutive days counting back from today (or yesterday, if
  today has no session yet); longest streak = the longest run of consecutive dates anywhere in
  the list. Uses UTC calendar days, the same convention `dailyKeyFor()` already uses for Daily
  Challenge — documented as a known, accepted quirk (a session near UTC midnight can land on
  the "wrong" side of a local day) rather than something worth new timezone-handling machinery.
- **Frontend**: shown on the Profile screen (§3), and optionally a small, unobtrusive
  `🔥 5-day streak` line on the Start screen — plain text, no icon badge, no dismiss button
  implying it demands attention.
- **Effort**: small (one query + one JS gaps-and-islands pass over a date list; no new table).

## 5. Achievement expansion

**Goal**: new achievements building on what's already shipped, per the roadmap's own examples
— duel win-streaks, "added 10 friends," and (once they exist) engagement with this phase's own
features.

**Restraint**: this is the cheapest and lowest-risk item in the phase precisely because the
delivery mechanism is already fully built and already follows every rule above — unlocks are
evaluated passively after an action the player took, shown as one toast for *their own* unlock,
and browsable on the existing Achievements screen. This item adds zero new schema, zero new
endpoints, and zero new UI; it only extends two existing files.

- **No schema changes.**
- **New conditions**, added to `lib/achievements.js`'s `ACHIEVEMENTS` array and
  `services/achievements.js`'s `CONDITIONS` map:
  - `social_friends_10` — `friendCount >= 10`. `computeStats()` already computes `friendCount`;
    this is a one-line addition.
  - `duel_win_streak_3` / `duel_win_streak_5` — the longest run of consecutive duel wins.
    Extends the duel subquery `computeStats()` already runs: order the same completed-duel rows
    by `completed_at` and walk them in JS counting consecutive wins, the same gaps-and-islands
    approach as §4's day-streak.
  - Once §1 ships: `social_challenge_creator` (created at least one challenge link) and
    `social_challenge_group` (3+ distinct players have completed one of your challenge codes).
  - Once §4 ships: `consistency_streak_7` / `consistency_streak_30` on the new all-modes
    day-streak. **Naming decision**: deliberately not `dedication_7`/`dedication_30` — those
    ids already exist and mean something different (distinct *Daily Challenge* days played,
    not consecutive calendar days across any mode). Reusing the name would conflate two
    different stats under one badge.
- **Effort**: small, and can land incrementally — the friend-count and duel-streak ones don't
  wait on anything else in this phase; the challenge and streak ones are natural follow-ups
  once §1/§4 exist.

## Suggested order

No hard dependencies, but a sensible sequence: **§4 (day streaks)** and **§3 (profile page)**
pair naturally since the profile is the streak's main display surface — do them together.
**§5 (achievement expansion)** picks up whatever has landed so far, so it's easiest to do last,
or split into a small early pass (friend-count, duel-streak) and a later pass (challenge/streak
ties once §1 and §4 exist). **§2 (activity feed)** and **§1 (challenge links)** are fully
independent of everything else and of each other.
