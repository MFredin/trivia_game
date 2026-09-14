# Phase 4 scaffold

Implementation-ready specs for the Phase 4 items still open (see README's Roadmap table for
the full picture — the easter egg and community-submission pipeline that were originally
floated alongside these have already shipped). Written up before starting any of it, per the
same "scaffold and document first" pattern as `docs/stack-audit-2026-09.md`. Pick one and go;
none of these depend on each other.

## 1. Shareable result cards

**Goal**: after any completed run or duel, let a player get a shareable summary — the
single highest-leverage growth lever on the list.

- **No schema changes.** Everything needed (`mode`, `category`, `canon_source`, `difficulty`,
  `totalScore`, `streak`) is already in `SessionSummary`/`DuelSummaryScreen`'s existing props.
- **MVP**: a "Copy result to share" button that builds a templated string client-side (e.g.
  `Scored 1,400 on Classic Quiz (First Year tier) in The Restricted Section — beat that?`) and
  calls `navigator.clipboard.writeText()`. Fall back to a selectable `<textarea>` for browsers
  without Clipboard API access (older Safari, some in-app browsers).
- **v2 (optional, bigger)**: render an actual image card via `<canvas>` client-side (house-color
  themed, parchment background, the score in the display font) and offer it as a PNG download —
  closer to the Wordle-grid effect, meaningfully more polish work for meaningfully more shareability.
- **Effort**: MVP is small (a few hours); the canvas version is medium.

## 2. Invite-a-friend links

**Goal**: a link that, when used to register, auto-friends the inviter — turns the
friend/member features already shipped into an actual acquisition channel.

- **Schema**: `ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;` — generated
  lazily (on first request) rather than at registration, so existing accounts get one too.
- **Backend**:
  - `GET /api/auth/invite-code` (`requireAuth`) — returns the caller's code, generating and
    persisting a short random one (e.g. `crypto.randomBytes(4).toString('hex')`, retried on the
    rare unique-collision) if they don't have one yet.
  - `POST /api/auth/register` — accept an optional `invite_code` field. If it resolves to a real
    user, insert both directional `'accepted'` friendship rows after creating the new account —
    reuse the exact pattern `routes/friends.js`'s mutual-accept branch already uses. An unknown
    or missing code is silently ignored; it never blocks registration.
- **Frontend**:
  - Settings screen: "Your invite link" — `${window.location.origin}/?invite=<code>` behind a
    copy button, fetched via the new endpoint.
  - `AuthScreen`: read `?invite=` from `window.location.search` on mount, hold it in state so it
    survives toggling between the login/register views, and include it in the register call.
- **Decisions already made**: only applies on registration, never on login; invalid codes fail
  silently rather than erroring, so a stale or mistyped link never blocks signup.
- **Effort**: small–medium.

## 3. Guest preview mode

**Goal**: let a visitor try a handful of questions before hitting the signup wall.

- **No schema changes** — the preview path deliberately never writes a `game_sessions` row, so
  nothing about it touches leaderboards, achievements, or anti-cheat scoring state.
- **Backend**: two new unauthenticated endpoints (own route file, e.g. `routes/preview.js`):
  - `POST /api/preview/start` — picks one random question (unfiltered, or a curated
    "First Year only" pool so a stranger's first taste isn't a N.E.W.T.-tier stumper), returns
    it plus a signed token from the existing `signQuestionToken()` keyed by a fresh, throwaway
    UUID instead of a real `session.id` — nothing about the token scheme requires a persisted
    session, only that sign and verify use the same key.
  - `POST /api/preview/answer` — verifies the token (`verifyQuestionToken()`, already stateless),
    returns correct/incorrect + explanation, and (client-tracked count) the next preview
    question via the same `start` logic.
- **Frontend**: a "Try it now" link on `AuthScreen` opening a lightweight `PreviewScreen` that
  reuses `QuestionCard`'s presentational pieces wired to `/preview/*` instead of `/sessions/*`,
  capped at 5 questions (tracked client-side — nothing to cheat since no score is ever saved),
  ending on a "Create an account to save your progress" CTA back to `AuthScreen`.
- **Depends on #5** (rate limiting) landing first, or at least alongside — these are the two
  unauthenticated POST endpoints most worth throttling, precisely because they need no account.
- **Effort**: medium (new stateless routes + a new screen), no migration.

## 4. House Cup leaderboard

**Goal**: aggregate every player's scores by their chosen house into a standing board —
almost free, since `users.theme` and `game_sessions.total_score` already exist.

- **No schema changes.**
- **Backend**: `GET /api/leaderboard/house-cup`. For fairness, reuse the same
  "rank each user's own runs, keep only their best" CTE the main leaderboard fix just
  introduced (`docs/stack-audit-2026-09.md` finding #1) — sum *deduped* top scores per user into
  each house's total, not every raw run, so one prolific grinder can't inflate their house by
  volume alone. Exclude `theme = 'monochrome'` from the ranked standings (it's "no house
  chosen," not a sixth competing house); optionally still surface it as an unranked "Unsorted"
  row for transparency.
- **Frontend**: a "House Cup" tab alongside the existing Leaderboard mode dropdown (same
  `nav-btn`/table pattern `DuelLeaderboard.jsx` already established), each row tinted in that
  house's own `--brass-*`/`--metal-*` colors — a nice payoff for the color system already built.
- **Effort**: small–medium (one aggregate query + one screen, closely modeled on
  `DuelLeaderboard.jsx`).

## 5. Auth rate limiting

**Goal**: throttle `/api/auth/login` and `/api/auth/register` (and, once built, `/api/preview/*`)
against brute-force and credential stuffing — flagged as a gap in the stack audit, not urgent
at current traffic but cheap to close before it matters.

- **No schema changes.** In-memory sliding-window counter, matching the project's existing
  "hobby-scale, in-memory is fine" pattern already used for the leaderboard cache and presence
  registry (`backend/src/lib/rateLimiter.js`): key by IP, cap at something like 10 attempts per
  15 minutes, return `429` past the cap.
- **Apply narrowly** — as middleware on the specific login/register (and later, preview) routes,
  not globally; normal gameplay traffic must stay unaffected.
- **One real deployment detail to verify**: Railway sits behind a proxy, so `req.ip` needs
  `app.set('trust proxy', 1)` (or reading `x-forwarded-for` directly) to see the real client IP
  rather than the proxy's — test this against the actual Railway deployment, not just locally.
- **Effort**: small (well under an hour).
