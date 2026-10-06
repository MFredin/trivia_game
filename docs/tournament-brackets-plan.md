# Tournament brackets: plan and scaffold

A knockout tournament among a group of friends, played over a few days. The roadmap describes it as
*multi-round elimination duels among a friend group, run over a few days; cheaper to build now than when first
scoped, since private challenge links already solved "give N players the identical seeded question set"*.
This document turns that into a buildable design, and is deliberately blunt about the one thing that makes it
harder than it sounds: **a match played over two days is not a live duel**, and the anti-cheat story is different.

## As built

This was built after the plan was written. Where the build differs from what follows, the build wins:

- **One decision gate.** `decideMatchIfReady` (`services/tournamentMatches.js`) is the only place a match is decided. A finished
  run, the deadline sweep and an account that has gone all call it. It takes a row lock on the tournament, then the match, so two
  callers queue instead of both advancing a round. The sweep itself is guarded by a Postgres advisory lock.
- **Leaving.** A player can leave only while the tournament is open. Once it is running there is nothing to leave: not playing a
  match is the same as leaving, and the match is decided at its deadline. The plan's "leaving forfeits the next match" was dropped.
- **A run counts if it answered at least one question.** At the deadline a run counts with the answers given so far; opening a
  match and answering nothing is not turning up.
- **Quiet forfeit for blocks** is applied when a match is *made*, as planned, and a join refused because of a block answers the
  same "not found" as a code that does not exist.
- **`bracket_size`** is stored on the tournament (the bracket drawn when it starts, which can be smaller than the capacity chosen).
- **Unranked everywhere, not only on the leaderboards.** A tournament run is also kept out of the House Cup and out of the
  "personal best" entry in the friends' activity feed, so a score cannot leak from either. `UNRANKED_MODES` in `lib/modes.js` is
  the one list. The profile's lifetime stats still count the run, as they count any run.
- **Account deletion** removes the player from an open tournament, cancels one they were hosting, and leaves a running one
  intact: their matches forfeit at the next sweep and they show as "Deleted player".
- **Moderation.** A tournament's name goes through the bio filter. There is no new report type: report the creator, as for anything
  else. A moderator or admin may cancel any tournament.
- **The UI** offers name, capacity, round length and canon. Category and difficulty are supported by the API and left at "any".
- **Not built:** the Tournament Victor achievement and title, a "tournaments won" count on the profile, and a live final. All three are
  small additions once the tournaments have been used.
- **Tested** with two parallel files against one database (`tournamentFlow`, `tournamentOwnership`), a browser test that plays a
  three-player tournament through the real screens with three browsers, and a width sweep of the bracket (320 to 1920px, text at
  100% and 200%) in `tournaments.test.mjs`.

## 1. Goal, and the restraint that goes with it

**Goal.** One player creates a tournament, shares a code, up to 16 players join, and the app runs a single-elimination
bracket. Each match is two players answering **the same ten seeded questions on their own time** within a deadline;
the higher score advances.

The Phase 5 rules apply, and the second one is the one most likely to be broken by accident:
1. **The quiz stays the point.** A match is an ordinary run: same scoring, same 10 questions, same 30 seconds each.
   Nothing about tournaments changes how a question is scored.
2. **Nothing pushes.** No emails, no toasts for someone else's activity, no "you are about to be eliminated"
   countdowns, no unread-count badge on the nav. Your next match is on the Tournaments screen when you choose to
   open it. (Discord can *optionally* mention results in a subscribed channel later; see section 9.)
3. **No new mandatory chrome.** Tournaments live as a tab on the **Community** screen. No new nav item.
4. **Optional all the way down.** A player who never opens it, never joins one, and has Challenges set to Off
   is not affected.

## 2. Decisions to make first

| # | Decision | Recommendation | Why |
|---|---|---|---|
| T1 | Live matches (both online) or asynchronous (a deadline window)? | **Asynchronous** for the first release. | "Over a few days" cannot require two people online at once. Live duels already exist and could be offered for finals later. |
| T2 | Format | **Single elimination**, 4, 8 or 16 players, byes when short. | Simplest to explain and to render. Double elimination and round robin are out of scope. |
| T3 | Who can join? | Anyone with the code, **subject to the same Challenges setting and blocks as a duel invite**, and capped at 16. | Mirrors the existing contact rules; no new privacy surface. |
| T4 | Round deadline | Creator picks **24, 48 or 72 hours**; default 48. | Short enough to finish in a week, long enough for different time zones. |
| T5 | No-shows | The player who played advances; if neither played, the higher seed advances. Marked "no show" in the bracket. | A bracket must always be able to move on. |
| T6 | Ties | Higher score, then **less total time**, then the **seed order**. | Deterministic, explainable, no coin flip. |
| T7 | Is there a prize or a ranking? | **No currency, no ranked ladder.** A tournament-win count on the profile, and optionally one achievement and one earned title. | Matches the "no resource or currency" line in Phase 5. |

## 3. The integrity limitation (read this)

A live duel is safe because both players answer at the same moment. A match played over 48 hours **cannot be**:
the first player to finish can read the questions, and nothing stops them telling the second player the answers.
This is the same limitation the **Daily Challenge** and **private challenge links** already accept, and it is
acceptable for the same reason: a friend group is playing for bragging rights, not for a public ranking.

What we do about it:
- **Tournament runs are their own mode** (`tournament`), excluded from every public leaderboard, so a tournament
  can never pollute a real board. This is the same separation `challenge` already has.
- The existing **anomaly detection** (shadow-flagging bot-speed answers) still runs on every answer, and a flagged
  match run is reported to the organiser as "under review" rather than silently counted.
- Questions are drawn per match, so one match's answers tell you nothing about the next round.
- **Honest labelling**: the create screen says "Matches are played on your own time, so it is a game of trust."
- Later option, not v1: let a creator mark the **final** as a *live duel* using the existing duel machinery, which
  restores the guarantee where it matters most.

This is a product decision rather than a defect to engineer away. If public, ranked tournaments are ever wanted,
that is a different feature with a different anti-cheat design.

## 4. Data model

Append-only and idempotent, in `backend/src/db/schema.sql`, like everything else. New tables, no change to existing
columns other than two additive ones on `game_sessions`.

```sql
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                       -- short join code, same generator as challenge links
  created_by INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                              -- run through checkText() in lib/bioFilter.js
  size INTEGER NOT NULL CHECK (size IN (4, 8, 16)),-- bracket size; byes fill the gap
  category TEXT,
  canon_source TEXT NOT NULL DEFAULT 'combined',
  obscurity_filter TEXT,
  round_hours INTEGER NOT NULL DEFAULT 48 CHECK (round_hours IN (24, 48, 72)),
  status TEXT NOT NULL DEFAULT 'open',             -- open | running | completed | cancelled
  current_round INTEGER NOT NULL DEFAULT 0,        -- 0 while open
  winner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seed INTEGER,                                    -- assigned at start; null while open
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eliminated_in_round INTEGER,                     -- null while still in
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,                          -- 1 = first round
  slot INTEGER NOT NULL,                           -- position within the round, for drawing the bracket
  player_a INTEGER REFERENCES users(id),           -- null until the previous round decides it
  player_b INTEGER REFERENCES users(id),
  is_bye BOOLEAN NOT NULL DEFAULT false,           -- a bye: player_a advances untouched
  deadline TIMESTAMPTZ,                            -- set when the round opens
  status TEXT NOT NULL DEFAULT 'waiting',          -- waiting | open | decided
  winner_id INTEGER REFERENCES users(id),
  decided_by TEXT,                                 -- score | time | seed | no_show | bye | forfeit
  decided_at TIMESTAMPTZ,
  UNIQUE (tournament_id, round, slot)
);

-- A match run is an ordinary game_sessions row, seeded from the match so both players
-- see the identical questions (same mechanism as duel_id and challenge_id).
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS tournament_match_id INTEGER REFERENCES tournament_matches(id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_tournament_match ON game_sessions (tournament_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_user ON tournament_players (user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_open ON tournament_matches (status, deadline);
```

Two additions elsewhere, both one-line:
- `lib/modes.js`: `tournament: { questionCount: 10, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: null }`
- `services/sessionQuestions.js`, `pickNextQuestion`: add `session.mode === 'tournament' ? session.tournament_match_id` to the
  deterministic-key chain, so both players of a match are seeded identically (that function is the single place
  this is decided today).

**Derived over stored.** The bracket tree is **not** stored as a tree. `tournament_matches` holds only the rows
that exist; a round's later matches are created when the earlier round is decided. Standings, "who is still in",
and a player's tournament wins are queries over these three tables, never counters.

## 5. Behaviour

### Lifecycle

```
open ──(creator starts, ≥ 3 players)──▶ running ──(final decided)──▶ completed
  └──(creator cancels, or empty)──────────────────────────────────▶ cancelled
```

- **Open**: players join with the code. Creator can remove a player and can cancel. Capacity is `size`.
- **Start**: seeds are assigned by a **seeded shuffle of the tournament id** (deterministic, not "creator's friends first"),
  byes go to the top seeds, and round 1 matches are created with `deadline = now + round_hours`.
  A bracket of 4 needs at least 3 players (one bye). Fewer than 3 cannot start.
- **Match open**: either player presses *Play*; it creates a `tournament` session seeded from the match id.
  A player can start their run **once**. A page refresh resumes it, never restarts it (the same rule as every run).
- **Match decided**: when both runs are completed, or the deadline passes. Resolution order is T6, then the no-show rule T5.
- **Round complete**: when every match in the round is decided, the next round's matches are created and opened.
- **Completed**: the final is decided; `winner_id` is set and one activity event is recorded.

### The deadline sweep

A periodic job decides matches whose deadline has passed. The repo has no job runner, and does not need one at this
scale: use the same `setInterval(...).unref()` pattern as `retention.js` and `activity.js`, every minute, **guarded by
a Postgres advisory lock** (`pg_try_advisory_lock`) so two instances during a deploy cannot both advance a round.
The sweep and the "last run completed" path both call **one** function, `decideMatchIfReady(matchId)`, which runs in
a transaction with `SELECT ... FOR UPDATE` on the match row and is idempotent. That is the lesson of the duplicate
pending duels and double achievement toast bugs: advancing state needs one gate, not two code paths that each think
they are first.

### Rules that fall out of the existing app

- **Blocks.** Refusing a join because someone already in the tournament has blocked you would leak who has blocked
  whom, which the rest of the app goes to some trouble not to do. Instead, **block checks apply when a match is
  created.** If two players who have blocked each other would be paired, the match resolves as a `forfeit` to the
  higher seed, and nothing tells the other player why. It is a rare case, and a quiet forfeit is better than a leak.
- **Challenges setting.** Joining by code respects `contactAllowed(users.challenges, isFriend)` against the creator;
  a player whose Challenges is Off cannot join and the creator cannot invite them.
- **Suspended, banned or deleted accounts.** A match involving one resolves as a `forfeit` at the next sweep. Account
  deletion anonymises the player; their row stays so the bracket keeps its shape, shown as "a former player".
- **Moderation.** A tournament name is user-generated, so run it through `checkText(name, max)` in
  `lib/bioFilter.js` (the same filter bios use) and refuse a name that fails. The existing report flow targets
  a **player** (`reports.reported_id`), not a piece of content, so an offensive tournament is reported by reporting its
  creator; no change to `reports` is needed. A moderator can cancel a tournament, which is the one new moderation action.
- **Age and privacy.** No new data about anyone. Display names follow the same rules as everywhere.
- **Anti-cheat.** Runs go through the unchanged answer flow. Flagged runs are held and surfaced as "under review";
  the organiser (not the moderator queue) decides whether to re-run, by cancelling the match, which lets both replay.

## 6. API

All under `/api/tournaments`, `requireAuth`. Every route that names a tournament proves the caller is a participant
or the creator and **answers 404, not 403, for anyone else**, per CLAUDE.md. (A tournament is discoverable only by its
code; the code is the capability, like a challenge link.)

| Method and path | Purpose |
|---|---|
| `POST /` | Create: `{ name, size, category, canon_source, difficulty, round_hours }`. Returns the code. |
| `POST /join` | Join by `{ code }`. Respects capacity, status `open`, Challenges setting, blocks. |
| `GET /mine` | Tournaments I created or joined, newest first, with my next action ("Play your match by Friday 18:00"). |
| `GET /:code` | One tournament: players, rounds, matches, standings. Participants and creator only. |
| `POST /:code/start` | Creator only. Seeds and opens round 1. |
| `POST /:code/leave` | Leave while `open`. After start, leaving is a forfeit of the next match. |
| `POST /:code/cancel` | Creator, or a moderator. |
| `DELETE /:code/players/:userId` | Creator removes a player while `open`. |
| `POST /matches/:id/play` | Start my run for this match: returns the usual session payload. Idempotent. |

`POST /matches/:id/play` reuses the session-creation code in `routes/sessions.js` rather than duplicating it: add
`tournament` to its list of modes that carry a shared key, set `tournament_match_id`, and refuse unless the caller is
`player_a` or `player_b`, the match is `open`, and the caller has no completed run for it.

## 7. Files (one feature, one file, per [`ARCHITECTURE.md`](../ARCHITECTURE.md))

```
backend/src/
  lib/bracket.js                 PURE: seeding, byes, round sizes, next-round pairings, tie-break. No database.
  lib/tournamentRules.js         PURE: sizes, deadlines, status transitions, can-join, can-start
  routes/tournaments.js          the routes above; thin
  services/tournaments.js        create / join / start / leave / cancel
  services/tournamentMatches.js  decideMatchIfReady (the one gate), the sweep, forfeit logic
backend/test/
  bracket.test.js                sizes 3..16, byes land on top seeds, pairings, deterministic seeding
  tournamentRules.test.js        transitions, tie-break order, no-show rule
  tournamentFlow.test.js         integration: 4 players, play every match, correct winner (needs a database)
  tournamentOwnership.test.js    outsiders get 404 on every route that names a tournament or match
  tournamentSweep.test.js        a past-deadline match is decided once, even if the sweep runs twice
frontend/src/
  api/tournaments.js
  features/tournaments/useTournaments.js
  components/TournamentsTab.jsx        list + create + join
  components/TournamentView.jsx        one tournament
  components/TournamentBracket.jsx     the bracket drawing
  styles/parts/tournaments.css
frontend/e2e/tournaments.test.mjs      create, join with a second browser, play, advance
```

`lib/bracket.js` carries nearly all of the difficulty and **has no I/O**, so it is the first thing built and the thing
tested hardest.

## 8. Frontend

- **Where.** A **Tournaments** tab on the Community screen, next to Online Now, All Members, Search and Activity. The
  tab shows my tournaments, "Create a tournament", and a field for a join code. Nothing is added to the nav.
- **Create** is a small plate: name, size (4, 8, 16), category and canon and difficulty (reuse the controls from the
  challenge-link creator), round length. A single sentence about playing on your own time.
- **The bracket is the one hard drawing.** Requirements from the overflow lessons in
  [`compatibility.md`](compatibility.md):
  - At **900px and wider** draw the classic tree, inside a horizontal scroll container with its own
    `overflow-x: auto` (the same `TableScroll` idea), never letting the page itself scroll sideways.
  - **Below that, render rounds as stacked lists** ("Round 1", "Semi-finals", "Final"), not a squeezed tree. It
    is the same data, so one component with two layouts.
  - Player names can be 40 characters with no break: `overflow-wrap: anywhere` and `min-width: 0` on flex children.
  - Colour is never the only signal: a winner has a "Advanced" label and a mark, a loser is struck, a bye reads "Bye",
    and a no-show reads "No show".
  - Draw with CSS and inline SVG only; no image files (CLAUDE.md).
  - Run `npm run audit:contrast` after adding any pairing, and add the bracket's pairings to the audit.
- **My next match** is a single line at the top of the tournament: who, the deadline in the player's own time, and a
  **Play** button. If there is nothing to do, it says so.
- **Accessibility.** The bracket is a nested list in the DOM (`<ol>` per round), so a screen reader reads it in order;
  the visual tree is a layout of that list, not a separate structure.
- **Tests.** The overflow-matrix test gains the Tournaments tab and a populated bracket at the usual eleven widths with
  worst-case names; `popover.test.mjs`-style coverage is added for anything that opens (a "remove player" menu).

## 9. Connections to the other features

- **Discord**: an optional line in the weekly post or a `/tournament` command later. Both are out of scope here;
  nothing in this feature depends on Discord.
- **Achievements and titles**: optionally **Tournament Victor** (win one) and one earned title hung on it. Per the
  titles rules, a test fails if a title requires an achievement that does not exist, so add them together.
- **Activity feed**: one event per tournament won (`tournament_win`), friends-scoped like the others.
- **Profile**: a "Tournaments won" count, derived from `tournaments.winner_id`.

## 10. Delivery: PRs, sizes, acceptance

Sizes are rough: S under a day, M one to two, L three to five.

| PR | Contents | Size | Acceptance |
|---|---|---|---|
| **T-1** | `lib/bracket.js` and `lib/tournamentRules.js` with exhaustive tests. No database, no routes. | M | Every size from 3 to 16 produces a valid bracket; byes go to top seeds; tie-break order is tested; seeding is deterministic. |
| **T-2** | Schema, `modes.js` and `pickNextQuestion` changes, create / join / start / cancel / leave routes, ownership tests | M | Outsiders get 404 everywhere; Challenges setting and blocks respected; schema applies twice with no error. |
| **T-3** | Match play, `decideMatchIfReady`, the sweep, forfeits, the full-flow integration test | L | A 4-player and an 8-player tournament run to a winner in tests; running the sweep twice decides each match once; a past-deadline no-show advances the right player. |
| **T-4** | Frontend: tab, create, join, tournament view, bracket (both layouts), contrast audit entries | L | Overflow matrix passes with the tab and a populated bracket at all widths; keyboard and screen-reader order correct. |
| **T-5** | e2e: two browsers play a 4-person tournament to a winner; achievement, title, activity event, profile count, README and docs | M | Green in CI. |

T-1 can start today and has no dependencies, which makes it a good first PR for this whole batch.

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Players share answers across the match window | Certain, at some rate | Section 3: its own mode, off all public boards, labelled honestly, anomaly flagging on, optional live final later. |
| Two code paths both advance a round (a race) | High if built naively | One gate, `decideMatchIfReady`, in a transaction with a row lock; a test that runs it twice. |
| An organiser abandons a tournament, leaving players waiting | Medium | Auto-cancel an `open` tournament after 7 days; a `running` one finishes on its own because the sweep decides every match. |
| The bracket overflows on a phone (the repo's most repeated bug) | High without care | Two layouts, scroll container, worst-case-name test at all widths, written into the acceptance criteria. |
| Name abuse | Medium | The bio filter on the name; report the creator through the existing flow; moderators can cancel. |
| Leaking who has blocked whom | Low | Block conflicts resolve as a quiet forfeit; no message names the reason. |
| Scope creep (double elimination, ranked ladders, prizes) | Medium | T2 and T7: out of scope, and the doc says so. |

## 12. Open questions for you

1. Is **asynchronous only** acceptable for v1, with an optional live final later?
2. Sizes 4, 8 and 16: enough, or should the creator be able to pick any number from 3 to 16 (more byes, more complexity)?
3. Should a tournament win earn an **achievement and a title** now, or wait until it has been used?
4. Is the deadline default of **48 hours** right for your friend group?
