# Stack audit — September 2026

Requested before starting Phase 4 work: a pass over the current backend/frontend logic for
bugs and rough edges, not just new features. This is the scaffold — findings and a proposed
fix plan, written up before any of it gets touched. Nothing in this file has been implemented
yet.

## How this was done

Read through the query and route logic for leaderboards, sessions, duels, achievements, and
friends, cross-checked against what the frontend actually sends, and reasoned about what a
real user session in the dev DB would produce. Confirmed the leaderboard finding directly
against the screenshot that prompted this audit.

## Findings

### 1. Leaderboard "All categories" / "Any difficulty" silently mixes filtered and unfiltered runs — Confirmed, High

**What's happening**: `category` and `obscurity_filter` (difficulty) are the only two run
attributes that can be genuinely `NULL` in `game_sessions` — a player leaves the Category or
Difficulty selector on its default ("All categories" / "Any"). The leaderboard query
(`backend/src/routes/leaderboard.js`) only adds a `WHERE` condition when the incoming filter
is truthy:

```js
if (category) {
  params.push(category);
  conditions.push(`gs.category = $${params.length}`);
}
```

When the viewer selects "All categories," `category` is `null`, the `if` is skipped, and
**no condition is added at all** — so the query matches every row regardless of what category
that individual run was actually for. A run played with "Magical Creatures" selected sits in
the exact same board as a run played with no category filter. The screenshot that started this
audit is exactly this: rows tagged `Magical Creatures` next to rows tagged `All`, all under one
"All categories" view. The identical bug applies to `difficulty` (`obscurity_filter`) for the
same reason — canon source doesn't have this problem, because it's never stored as `NULL`
(`canon_source ?? 'combined'` at session creation means "Any" always resolves to a real,
explicit `'combined'` value).

**Why it matters**: it breaks the segmentation the leaderboard is supposed to provide. A player
who deliberately restricts themselves to N.E.W.T.-tier-only runs is being compared against
players who took the easiest possible spread of questions, on a board that's supposed to be
"Any difficulty."

**Fix options** (pick one, or both):
- **Option A — strict segmentation (recommended baseline)**: make "All categories" /
  "Any difficulty" match `gs.category IS NULL` / `gs.obscurity_filter IS NULL` explicitly,
  instead of omitting the condition. This is the behavior described in the request — a filter
  selection should mean what it says.
- **Option B — add a distinct "Overall" board**: keep an aggregate view that intentionally
  pools every run regardless of category/difficulty, but expose it as its own explicit option
  in the dropdown (e.g. "Overall (all runs combined)") rather than overloading "All categories."
  Cheap to add once Option A's `IS NULL` distinction exists, since it only means going back to
  today's "no condition" behavior for that one specific menu choice.

**Effort**: Option A is a small, contained change — two `if` blocks in one query, matching
frontend copy tweak so "All categories"/"Any" reads clearly, and a decision on what a
freshly-recalibrated leaderboard should show for existing historical data (old rows don't
change meaning, they just sort into the segment they actually belong to).

### 2. No protection against duplicate pending duel invites — Confirmed, Low

`duels` has no uniqueness constraint on `(created_by, opponent_id)` while `status = 'pending'`,
and `POST /api/duels` doesn't check for an existing pending invite before inserting a new row.
A player (or a UI double-click) can stack up multiple simultaneous pending challenges to the
same opponent. Not exploitable for cheating — each duel session is independently scored — but
it clutters the recipient's invite banner/Friends screen with repeats. Fix is a simple
existing-pending-duel check before insert, or a partial unique index
(`WHERE status = 'pending'`) mirroring the pattern already used for
`idx_one_daily_session_per_user`.

### 3. Friends list online-dot goes stale between manual refreshes — Confirmed, Low

The **Online Now** tab polls `/api/friends/online` every 15s (`ONLINE_POLL_MS` in
`FriendsPanel.jsx`), but the plain **Friends** list at the bottom of the same screen only
fetches presence once, on mount (`refresh()`, called from `useEffect(refresh, [token])`), and
after specific actions (accept/decline/remove). A friend's dot can sit stale — showing offline
after they've come online, or vice versa — until something else happens to trigger a refetch.
Inconsistent with the Online Now tab sitting right above it. Fix: either fold the friends list
into the same polling interval, or drop the per-friend dot in favor of a shared "online" badge
sourced from one polled list.

### 4. Achievement unlock can double-fire under concurrent evaluation — Confirmed, Low, edge case

`evaluateAchievements(userId)` (`backend/src/services/achievements.js`) computes
`newlyUnlocked` from a fresh `computeStats()` read, then inserts and pushes a WS toast for each.
The DB insert is idempotent (`ON CONFLICT DO NOTHING`), so no duplicate rows are possible — but
if two calls for the *same user* race (e.g., two browser tabs finishing a session moments
apart), both can read "not yet unlocked" before either insert lands, and the player sees the
same "Achievement Unlocked!" toast twice. Cosmetic, not a scoring or security issue. Fix, if
worth doing: an `INSERT ... ON CONFLICT DO NOTHING RETURNING id` and only push the toast for
rows that actually inserted.

### 5. Known, accepted (no action needed, listed so it isn't "rediscovered")

- `GET /api/sessions/:id` and `POST /api/sessions/:id/answer` have no `requireAuth` — by
  design, the signed per-question token is the authorization, not caller identity (see
  `docs/anti-cheat-architecture.md`). Already covered in the earlier security review.
- The shared leaderboard cache (`leaderboardCache.js`, 15s TTL) isn't invalidated when a
  friendship changes, so a friends-scope board can be up to 15s stale after adding a friend.
  Self-heals on the next natural cache expiry; already observed and accepted during Duel
  leaderboard testing.
- In-memory question cache, leaderboard cache, and presence registry all reset on a backend
  restart and don't share state across multiple instances. Fine at current single-instance
  Railway scale; would need a real store (Redis, or a DB-backed presence table) before ever
  running more than one backend instance.

## Proposed fix plan

Ordered by impact vs. effort, pending sign-off — nothing here has been started:

1. **Fix #1 (leaderboard segmentation)** — the one that actually affects what players see every
   time they check a board. Recommend Option A now; revisit Option B (an explicit "Overall"
   board) only if there's real demand for it once segmentation is correct.
2. **Fix #3 (friends-list presence staleness)** — small, improves an inconsistency a player can
   notice within a single session.
3. **Fix #2 (duplicate duel invites)** — small, purely cosmetic/annoyance-level.
4. **Fix #4 (duplicate achievement toast)** — smallest, only matters for the multi-tab edge case.

None of these require a schema migration except optionally #2, if a partial unique index is
preferred over an application-level check.
