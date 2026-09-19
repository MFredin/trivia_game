# Platform audit — September 2026

A whole-codebase pass after Phase 6 shipped, looking for anything unoptimised, redundant or
dead, with the mobile and accessibility pass folded in. Everything below was measured, not
estimated; where a fix went in, the verification that proves it is named.

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Session routes had no authentication or ownership check | High | Fixed |
| 2 | Seven missing database indexes on the app's hottest access paths | High | Fixed |
| 3 | No keyboard focus ring anywhere in the app | High | Fixed |
| 4 | Nothing ran the tests; the flows that actually break had none | High | Fixed |
| 5 | Whole app shipped as one bundle, re-downloaded in full every release | Medium | Fixed |
| 6 | Touch targets below the WCAG minimum; state exposed only visually | Medium | Fixed |
| 7 | Modals were dialogs in appearance only | Medium | Fixed |
| 8 | `GET /challenges/:code` was open to anyone | Low | Fixed |
| 9 | One 2,375-line stylesheet every feature appended to | Low | Fixed |
| 10 | Dead CSS rules, unused exports, duplicated constants | Low | Fixed |
| 11 | Missing favicon — the app's only console error | Low | Fixed |
| 12 | `App.jsx` holds 30+ pieces of state in 938 lines | Medium | **Left alone — see below** |
| 13 | Railway Config as Code is deprecated | Low | **Left alone — see below** |

## 1. Session routes took the run's id as their only credential

`POST /api/sessions` required a login. The four routes that follow it did not:

    GET  /api/sessions/:id
    POST /api/sessions/:id/next
    POST /api/sessions/:id/lifeline
    POST /api/sessions/:id/answer

Anyone holding a run's UUID could read its score, pull its next question, spend its lifelines
or answer on its behalf — and the resulting score posted to the leaderboard under the owner's
name. A UUID is unguessable, but unguessable is not an authorization check.

All four now require auth and share one `loadOwnedSession` helper that tests `user_id` against
the caller, which also replaced three copies of the same lookup. A run that exists but belongs
to someone else returns the same 404 as one that does not, so the endpoint cannot be used to
discover whether an id is real. Guest preview play is unaffected: it runs through
`/api/preview`, which writes no session rows at all.

*Verified:* integration tests assert 401 unauthenticated and 404 cross-player on every one of
the four routes, plus a full owner-played run.

## 2. Seven missing indexes

The three existing indexes on `game_sessions` all lead with `mode`, so none of them helps a
query that starts from a person, a duel or a challenge — which is most of the app. The profile
screen alone is five scans of `game_sessions` for one player, and every completed run re-reads
the table to decide whether the score is a personal best.

    game_sessions (user_id, status)
    game_sessions (duel_id)         -- partial, WHERE duel_id IS NOT NULL
    game_sessions (challenge_id)    -- partial, WHERE challenge_id IS NOT NULL
    friendships   (friend_user_id, status)
    duels         (created_by, status)
    duels         (opponent_id, status)
    activity_events (user_id, created_at DESC)

Each backs a filter the routes already use; no behaviour changes. `friendships` had a unique
index that serves lookups starting from the requester, but the incoming-requests query starts
from the other end and had nothing. The activity feed is friends-scoped *before* it is ordered,
so the created_at-only index had to read everyone else's rows to find the ones it wanted.

No N+1 query patterns were found: the only `await` inside a loop is the seeder and a two-element
duel participant loop.

## 3–7. Accessibility, measured at 390×844

Run in a real browser across every screen, before and after.

**No focus ring existed at all.** Nothing in the stylesheet defined one, and the app restyles
every control, so the browser's default landed on backgrounds it was never chosen against
(WCAG 2.4.7). There is now one `:focus-visible` rule: a gilt ring that reads on the dark page
over a dark halo that reads on parchment, so one marker survives every surface.

**Targets under the floor.** Nav links measured 27px tall, segmented controls 37px, the slider
thumb 18px, and the colophon link 14px — failing WCAG 2.5.8 outright. All are now at 44px, set
by padding rather than height so nothing is stretched into a different shape.

**State that was only ever visual.** The nav's `on` class, the Friends tabs, the leaderboard
scope and window toggles and the house picker all looked selected and announced nothing. Nav
links now carry `aria-current="page"`; the rest carry `aria-pressed`.

**Two unlabelled inputs.** Both member search boxes had a placeholder and no label.

**Modals.** Neither announced itself as a dialog, neither could be dismissed from the keyboard,
and opening one left focus on the page underneath. Both now share one `Modal` component — which
also removed the duplicated overlay-and-plate markup they had each written by hand.

*Verified:* zero undersized targets and zero unnamed controls on all six screens; focus ring
present on a real keyboard Tab; dialog semantics and Escape confirmed.

## 4. The tests did not run, and did not cover what breaks

26 tests existed, every one of them on a pure function, and nothing ran them — Railway deploys
straight off main with no gate. The two things that have actually gone wrong in front of a
player (a run that could not be finished; session routes with no ownership check) were covered
by nothing and were both found by playing the game.

A CI workflow now runs the backend suite against a real Postgres service, plus the frontend
build and the contrast audit, on every push to main and every pull request. Four integration
tests cover the answer flow itself, including that `/next` returns the same question with its
original `issued_at` so a retry cannot buy more time.

## 5. One bundle, re-downloaded every release

The whole app shipped as a single 231 kB file, so a player on a phone downloaded the admin
review queue, the suggestion form, the entire Friends panel and the guest preview before they
could read question one — and downloaded all of it again on every release, because one file
means one cache key.

    initial load   231.4 kB -> 194.8 kB   (69.8 -> 62.7 kB gzipped)
    per release     69.8 kB ->  17.4 kB gzipped

Thirteen screens and modals are now fetched on demand and React has its own chunk. Each
deferred screen gets its own Suspense boundary rather than one around the whole shell, so
fetching a chunk cannot blank the nav bar or a run in progress.

## 9. The stylesheet was the repo's worst merge hotspot

One 2,375-line file that every feature appended to. Three of the four Phase 6 features
conflicted here, and one of those resolutions silently cut through a `@media` block and
produced an unparseable stylesheet. Now nineteen files split at the banner comments the
stylesheet already carried, in the order it already had.

*Verified mechanically rather than by reading:* building before and after the split produces a
byte-identical 38,899-byte stylesheet, so the cascade cannot have changed.

## 10. Dead code

Small, and the codebase is otherwise tight — 187 CSS classes with only two genuinely unused,
no untracked build output, no stray files.

- `.rule-gilt` and `.plate--tabbed` (with its corner override): rule sets nothing applied. The
  tabbed treatment they were written for ended up on `.book-spread--tabbed`, which is still used.
- `backend/src/lib/duelReactions.js` carried a full id+label table, but the server only ever
  asks whether an id is one of the six. The labels were a second copy of the frontend's, read by
  nothing and free to drift. `duelReactionLabel` had no callers at all.
- `LIFELINE_TYPES` and `FIFTY_FIFTY_SCORE_MULTIPLIER` were exported but used only inside their
  own module.

## What was deliberately left alone

**12. `App.jsx` is 938 lines holding 30+ `useState` calls.** This is the largest piece of
technical debt in the frontend and it is real: the run's state, the duel's state, the nav's
state and the auth state all live in one component. But it is also the app's entire state
machine, it works, and it is covered by no unit tests — only by playing the game. A rewrite
during an audit would put the core loop at risk to buy readability. The honest recommendation
is to extract the run state (`session`, `question`, `token`, `issuedAt`, `streak`, `strikes`,
`totalScore`, `feedback`, `lifelinesUsed`, `hiddenChoices`) into a `useReducer` as a piece of
work of its own, with the integration tests added in this audit as the safety net.

**13. Railway Config as Code (`railway.toml`) is deprecated** in favour of
`.railway/railway.ts`; existing files keep working until **2026-12-01**. Both services should
migrate before then. Not urgent, and not something to fold into an audit whose other changes
all need to deploy cleanly.

## Checks that came back clean

- No N+1 query patterns.
- No tracked build output, no stray `.log`/`.bak`/`.orig` files; `.gitignore` is correct.
- No unused npm dependencies in either package.
- Every route outside `/api/sessions` and `/api/challenges` already had the auth it needed;
  `duels` and `friends` apply it router-wide, which is the tidier pattern.
- `prefers-reduced-motion` is handled in four places and the timer dial already carried
  `role="timer"` with a live `aria-label`.
- Contrast audit: 260 gated pairings pass, unchanged throughout.
