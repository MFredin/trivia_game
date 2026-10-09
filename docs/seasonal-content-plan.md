# Seasonal content bundles: plan and scaffold

Themed question sets that appear around real-world and in-universe anniversaries: Halloween, the start of term,
a book's publication date. The roadmap describes them as *a good scheduled-retention hook*. They are also the
only one of the three features here with a **calendar deadline**: Halloween is 31 October, and today is 6 October.

**The code for this feature is small. The content is the work.** A keyword scan of the current bank
(2,927 questions) finds roughly 8 questions that mention Halloween, 14 Christmas and 9 Yule, and **none are tagged
as seasonal**, so there is nothing to select today. A bundle needs at least 60 good questions to be worth playing
twice. Most of this document is about producing that content without lowering the bank's quality or its IP discipline.

## As built

This was built after the plan was written. Where the build differs from what follows, the build wins:

- **A card, not a spine.** The season appears as an "In season" card on the Start screen, in the same slot and with the same
  styling as the featured weekly challenge, and opens the same challenge screen. It reuses a flow that already works and
  cannot overflow the mode shelf. The spine and `SeasonSpine.jsx` were not built.
- **Testing in a season** uses `GET /api/challenges/season?force=halloween`, which the server ignores in production
  (`NODE_ENV=production`), not an environment variable. The browser test asks the API for the forced season and has the
  page see that answer where it would ask for today's.
- **One achievement, not one per year.** "Feast Guest" is earned by completing a run of any season (`explorer_season`).
  Per-year stamps and a seasonal title were left for later.
- **The bank.** 66 questions are tagged `halloween` and 63 `yule` (`MIN_SEASON_POOL` is 60), every difficulty represented.
  74 existing questions were retro-tagged by hand and 55 are new (`SEA-HAL-*`, `SEA-YUL-*`); 14 of the new ones and 20 of
  the retro-tagged ones carry `needs_factcheck`, and **every one of those needs a human read before launch.**
  `test/seasonCoverage.test.js` is the gate: it fails if a listed season drops below the minimum.
- **CI seeds the full bank** in the backend and e2e jobs, because the starter bank has no seasonal questions. The flow test
  deliberately inserts none of its own, since test files run in parallel against one database.
- **Not built:** the overflow-matrix state (the card reuses the weekly card's styles and slot, which the matrix already
  covers) and any auto-tagging (`season-candidates.mjs` is a report only, as planned).

## 1. Goal, and the restraint that goes with it

**Goal.** For a few weeks around each occasion, a themed run appears alongside the normal modes. Everyone gets the
same themed questions, there is a board for the occasion, and the occasion earns a small, permanent keepsake.

The Phase 5 rules, with the ones that matter most for seasonal features in bold:
1. **The quiz is still the point.** A seasonal run is an ordinary run: the same scoring, ten questions, 30 seconds.
2. **No fear of missing out.** **Nothing is lost by skipping it, and nothing earned is exclusive forever.** Every
   seasonal reward is obtainable again the next year. No streak depends on it. No countdown nags, and nothing about
   it is pushed.
3. **No new mandatory chrome.** It is one extra spine on the book-spine mode shelf while it is in season, and gone after.
   It must not slow the path from opening the app to answering question one.
4. **Optional all the way down.** The Home screen looks the same for a player who ignores it.

## 2. Decisions to make first

| # | Decision | Recommendation | Why |
|---|---|---|---|
| S1 | How is a seasonal run played? | **As a system challenge**: the same machinery as the featured weekly challenge, keyed by season instead of by week. | The weekly challenge already does everything needed: a deterministic shared set, a lazily created row guarded by a `UNIQUE` key, its own board, its own mode (so it cannot pollute Classic). |
| S2 | Are the seasons stored or defined in code? | **Defined in code** (`lib/seasons.js`), like `featuredChallengeSpec`. | "Prefer derived over stored." Which season is active is a pure function of the date. A new year needs no database edit and nothing to schedule. |
| S3 | How are questions assigned to a season? | A new **`themes TEXT[]`** column on `questions`, tagged in the bank JSON. | A question can belong to a category (Potions) and also a theme (Halloween). Reusing `category` would break the 11-category structure and its pool guarantees. |
| S4 | Attempts | **Repeatable; the best run counts.** | Unlike the Daily, which is one attempt. A bundle is a few weeks of casual play, not a daily ritual. Matches the weekly challenge. |
| S5 | Reward | **A permanent stamp on the profile** ("Halloween Feast 2026") and an achievement for playing one. No currency, no time-limited anything. | Rule 2. |
| S6 | Calendar | See section 4: a small, deliberate list, **dates verified before shipping**. | Real dates are facts to get right; a wrong anniversary is embarrassing. |

## 3. Data model

All additive; none changes existing behaviour.

```sql
-- Which occasions a question suits. A question can have several; most have none.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS themes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_questions_themes ON questions USING GIN (themes);

-- The seasonal run is a system challenge (no creator), keyed by season and year,
-- created lazily on first request. UNIQUE makes two simultaneous requests safe,
-- the same trick as featured_week.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS season_key TEXT UNIQUE;   -- e.g. 'halloween-2026'
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS theme TEXT;               -- the questions.themes tag it draws on

-- Carried onto the session at creation, like category and canon_source, so question
-- selection needs no join.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS theme TEXT;
```

Changes to existing code, each one line or one clause:
- `db/seed.js`: add `themes` to the `INSERT` and the `ON CONFLICT` update (default `[]`).
- `scripts/question-bank-audit.mjs`: validate `themes` values against `lib/seasons.js` (an unknown tag is an error).
- `lib/questionSelection.js` (`selectQuestionSet`): accept an optional `theme` and filter `q.themes.includes(theme)`.
- `services/sessionQuestions.js` (`pickNextQuestion`): pass `session.theme` through. The deterministic key for a
  challenge session is already `challenge_id`, so both the seed and the pool are fixed per season.
- `routes/challenges.js`: a `GET /api/challenges/season` next to `GET /featured`. **Register it before `GET /:code`**,
  for the same reason `/featured` is (Express would read "season" as a challenge code).
- `suggested_questions` and `routes/suggestions.js`: no change in v1. Players cannot propose a seasonal tag; an admin
  adds `themes` when approving, if at all.

**No `season_runs` table, no per-player counters.** The board is the existing challenge board filtered to that
challenge. "Played this season" is a query for a completed session with that `challenge_id`.

## 4. The calendar

Seasons are code constants. A season has a key, a label, a window (month and day, recurring yearly), the theme tag it
draws on, and its copy.

```js
// lib/seasons.js (shape only)
export const SEASONS = [
  { key: 'halloween',  label: 'The Halloween Feast', theme: 'halloween',  start: [10, 17], end: [11, 2]  },
  { key: 'yule',       label: 'The Yule Feast',      theme: 'yule',       start: [12, 18], end: [1, 2]   },
  // ...
];
export function activeSeason(date = new Date()) { /* pure; handles windows that cross New Year */ }
export function seasonKey(season, date) { /* e.g. 'halloween-2026' */ }
```

**Candidate occasions.** Dates are included so the plan is concrete. **Every one needs checking against a primary
source before it ships**; none of them has been verified here.

| Season | Date it marks | Basis | Content pool |
|---|---|---|---|
| The Halloween Feast | 31 October | In-universe (the Halloween feast, the troll in the dungeon) | Thin today: about 8 mentions |
| The Yule Feast | 25 December and the Hogwarts Christmas | In-universe | Thin: about 23 mentions of Christmas and Yule |
| Back to Hogwarts | 1 September | In-universe (the Hogwarts Express) | About 27 mentions of the Hogwarts Express |
| The Birthday | 31 July | In-universe | About 9 mentions of birthdays |
| A publication anniversary | 26 June (first book, 1997, UK) | Real-world | Needs authoring: publication history is a real-world fact set |
| The Battle of Hogwarts | 2 May | In-universe | Needs authoring |

**Recommendation: ship two in year one, Halloween and Yule**, and build the rest only if they are used. Two is
enough to prove the mechanism, and two bundles are what the content budget can honestly cover.

## 5. Producing the content (the real work)

A bundle needs **at least 60 questions** with a spread across the obscurity tiers and both canon sources. The weekly
challenge's guard (`MIN_POOL = 10` in `featuredChallenge.js`) only ensures a run can be fielded at all; a seasonal bundle is
replayable for weeks, so it needs a deeper pool to avoid the same ten questions on every attempt.

**Step 1: retro-tag.** Many existing questions already fit. Add a script,
`backend/scripts/season-candidates.mjs`, that lists questions whose text, answer or explanation mention a season's
keywords, so a human can confirm each and add `"themes": ["halloween"]`. It is a **report that proposes**, never an
auto-tagger, because the scan is keyword-based and will include false positives (a question that merely says "feast" is not a Halloween question). Expect a quarter to a half of the matches to survive.

**Step 2: author the gap.** For each season, the gap is the difference between 60 and the confirmed retro-tags. Draft
the rest in the same pipeline the bank has always used: drafted in batches, flagged `needs_factcheck: true` wherever
the drafter was not certain, validated by `question-bank-audit.mjs` (schema, duplicates, answer in its own distractors),
then a human pass for factual correctness (see [`question-bank-audit-2026-10.md`](audits/question-bank-audit-2026-10.md)).
Seasonal questions must not be **excluded** from the normal bank: they enter it like any other, with a tag. Out of
season they simply appear in ordinary runs as before.

**Step 3: coverage gate.** Extend the audit so CI fails if a season that is *in the code* has fewer than 60 tagged
questions, or fewer than 10 in any obscurity tier that the run could draw. A season cannot be listed in `SEASONS`
until it can field a run. This is the same reasoning as the MIN_POOL guard in `featuredChallengeSpec`.

**IP discipline** (CONTRIBUTING.md, "Content and artwork"). Seasonal questions are where the temptation to quote is
highest (a feast menu, a famous line). The standing rule applies unchanged: describe events in original language and
never reproduce prose beyond an unavoidable short phrase. Real-world anniversary questions (publication dates, premieres)
state facts, which are not protectable, but each needs a `source_ref`.

**Rough volume.** Two seasons is on the order of 120 tagged questions in total, of which perhaps 40 to 60 are
retro-tagged and 60 to 80 are new. At the pace of the earlier content batches this is a few days of drafting plus a
factual review, and it **is the critical path to a Halloween launch**.

## 6. Behaviour

- `GET /api/challenges/season` returns the active season's challenge, creating it on first request, or `{ season: null }`
  outside any window. Open to anyone, like `/featured`: the set is the same for everyone and holds no private data.
- Starting the run and reading the board **reuse the existing challenge routes unchanged**: `POST /api/challenges/:code/start`
  begins it and `GET /api/challenges/:code` returns the board (best run per player). `/season` only has to hand back the code.
- The run is a `challenge` mode session, so it **cannot touch Classic leaderboards**, and the anti-cheat answer flow is
  unchanged. Its board is the challenge's own, the same code path the weekly challenge's board uses.
- **Out of season the bundle is gone**, but its board and each player's stamp remain, readable under that year's key.
  Nothing about a past season is deleted.
- A season that crosses New Year (Yule) is keyed by the year it **starts** in, so a Boxing Day run and a 1 January run
  are the same challenge.
- Time zone: windows are evaluated in **UTC**, the same as the weekly key, which keeps the active season identical for
  everyone and testable. It means a window may begin up to a day early or late locally. That is acceptable for a
  weeks-long window and is documented in the code.

## 7. Files (one feature, one file, per [`ARCHITECTURE.md`](../ARCHITECTURE.md))

```
backend/src/
  lib/seasons.js                   PURE: SEASONS, activeSeason(date), seasonKey(season, date)
  lib/seasonalChallenge.js         PURE: the spec for a season (theme, pool check), the sibling of featuredChallenge.js
  routes/challenges.js             + GET /season (one new handler beside /featured)
backend/scripts/
  season-candidates.mjs            report: questions that look like they belong to each season
  question-bank-audit.mjs          + validate themes, + coverage gate per season
backend/test/
  seasons.test.js                  windows, year boundaries, UTC, leap years, "no season" gaps
  seasonalChallenge.test.js        spec respects the pool; refuses a season it cannot field
  seasonalFlow.test.js             integration: first request creates, second returns the same, both seeded identically
frontend/src/
  api/challenges.js                + season()
  components/SeasonSpine.jsx       the extra spine on the mode shelf while a season is active
  features/run/                    start-a-run wiring for the season (small addition to the existing hook)
  styles/parts/season.css
frontend/e2e/season.test.mjs       forced into a season: the spine appears, a run completes, it is gone outside the window
```

Testing the date logic needs a clock the tests control: every function in `lib/seasons.js` takes the date as an argument,
exactly as `currentLeaderboardWindow(date)` does. An e2e test can set the season with a query override that only exists
outside production, or by seeding a challenge row directly. **Decide which before building** (see open questions).

## 8. Frontend

- **The spine.** The mode shelf already draws one book spine per mode. While a season is active, one more spine
  appears at the end, with the season's label set vertically like the others. Out of season, the shelf is exactly as today.
  Choosing it shows the usual detail panel: a two-line description of the occasion, "Counts toward the Halloween Feast
  board", and the existing **Begin** button. It adds no step to the path to question one.
- **Colour and ornament.** The spine uses the existing role tokens (`--cloth`, `--tooling`, `--leaf-*`); a season does not
  bring its own palette, since colour goes through role tokens (CLAUDE.md) and the contrast audit gates it. Any season
  ornament is **CSS or inline SVG only**: no image files, no crests or licensed art. Add the spine's pairings to
  `scripts/contrast-audit.mjs` and run `npm run audit:contrast`.
- **The stamp.** On the profile, a small row of earned seasonal stamps ("Halloween Feast 2026"), drawn as a text
  bookplate in the existing style. Tracked as an **achievement** (below), not a new table.
- **Seasonal board.** The challenge's own leaderboard view, reached from the detail panel and from the result screen.
- **Overflow.** The spine label is short and fixed, but the e2e overflow matrix should include a season-active state at the
  eleven widths, because a sixth or seventh spine is exactly the kind of addition that pushes a shelf past a 320px screen.

## 9. Achievements, titles and stamps

- **One achievement per season**, earned by completing a seasonal run ("Attended the Halloween Feast"). The achievement
  is **permanent and tied to the year** ("2026"), and playing next year earns that year's. The 44 existing achievements
  are in `lib/achievements.js` and evaluated in `services/achievements.js`; the achievement count in the README and the
  profile's "X of N" will change, so avoid hard-coding it.
- **No seasonal title in v1.** The titles rules fail a test if a title requires an achievement that does not exist; a
  per-year achievement does not fit a fixed title list. If wanted, one title ("Feast Guest") that any seasonal
  achievement earns can be added later.
- **Activity feed**: no event. A friend finishing a seasonal run is not news.

## 10. Connections to the other features

- **Discord**: `/weekly` can mention the active season. The weekly post could add one line. Both are later and optional.
- **Tournaments**: a creator choosing a theme for a tournament's questions is a natural extension (`theme` already exists
  on sessions after this feature), and is deliberately not in v1 of either.

## 11. Delivery: PRs, sizes, acceptance

Sizes are rough: S under a day, M one to two, L three to five. **The content tasks run in parallel with the code and
gate the launch.**

| PR | Contents | Size | Acceptance |
|---|---|---|---|
| **C-1 (content)** | `themes` column, seed and audit changes, `season-candidates.mjs`, a first retro-tagging pass over the bank | M | Schema applies twice; the audit rejects an unknown tag; the report lists candidates per season. |
| **C-2 (content)** | Draft and review the Halloween bundle to 60+ with tier spread | L | Passes the audit and coverage gate; a human has fact-checked every `needs_factcheck` item. |
| **C-3 (content)** | The same for Yule | L | Same. |
| **S-1** | `lib/seasons.js`, `lib/seasonalChallenge.js` with tests; `selectQuestionSet` takes a theme | S | Pure functions fully tested, including New Year and leap-day edges. |
| **S-2** | `GET /api/challenges/season`, session theme, board, flow test | M | First request creates, the second returns the same row; a run is seeded identically for two players; Classic boards unaffected. |
| **S-3** | Frontend spine, detail panel, result and board links, contrast audit entries, overflow matrix state | M | Overflow matrix passes with the spine at all widths; contrast audit green. |
| **S-4** | Achievement, profile stamp row, e2e, README and docs | S | Green in CI. |

**To launch Halloween on 17 October** (the start of the suggested window) means S-1 to S-3 and C-1/C-2 merged by about
14 October. That is tight but realistic if content drafting starts immediately; **a Halloween launch the following
week, with the window shortened to 24 to 31 October, is the safer plan**, and Yule leaves comfortable time.

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Not enough good questions by the deadline | High | The coverage gate refuses to list a season it cannot field; the window can start late; Yule has more runway. |
| A factual error in a real-world anniversary question | Medium | `source_ref` on every one; human fact-check; `needs_factcheck` honoured. |
| A themed set feels repetitive on repeat plays | Medium | The 60-question minimum, with the run drawing ten. |
| Time-zone edge cases at the window boundary | Low | UTC, documented, tested. |
| Retro-tagging by keyword mislabels questions | Medium | A report that proposes, a human that confirms; never auto-tag. |
| FOMO creep (exclusive rewards, countdowns) | Medium over time | Rule 2 is written into the acceptance criteria; every reward returns next year. |
| The shelf overflows on a small screen with one more spine | Medium | The overflow matrix gets a season-active state. |
| `season_key` is created twice by a race | Low | `UNIQUE`, and the raced insert re-reads, exactly like `featured_week`. |

## 13. Open questions for you

1. **Launch date.** Halloween this year, with a shortened window, or start with Yule and give the content more time?
2. **Which occasions** beyond Halloween and Yule, if any, and are the dates in section 4 the ones you want?
3. **Content help.** The drafting follows the earlier batches (drafted by agents, reviewed by you). Is that still the process?
4. **Testing in a season.** A development-only override of "today's date", or seeding a challenge row in tests?
5. **A title for seasonal players**, or only the achievement and stamp?
