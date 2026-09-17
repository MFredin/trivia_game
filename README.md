# The Restricted Section — Harry Potter Trivia

A competitive HP trivia game with server-authoritative scoring, real-time head-to-head duels,
friends and achievements, and a book/library-themed interface with five selectable house
bindings. An unofficial fan project — see `docs/ip-risk-notes.md` for the IP-exposure read
that guides what does and doesn't go into this build. See `docs/` for the original design
brief and anti-cheat architecture this build started from.

## Stack

- **Backend**: Node/Express + Postgres + WebSockets (`backend/`)
- **Frontend**: React + Vite (`frontend/`)

## Score integrity

The client never computes a score — it only submits an answer. The server issues a signed,
single-use, session/question-bound token with every question and validates elapsed time against
its own clock before scoring. See `docs/anti-cheat-architecture.md`.

## What's implemented

**Game modes**
- **Classic Quiz** — 10 questions, per-question timer, category/canon/difficulty filters
- **Daily Challenge** — one shared 10-question set per day (same seed for every player), one
  attempt per player per day
- **Blitz** — 60-second shared time budget, race through as many questions as possible
- **Survival** — one wrong answer or timeout ends the run
- **Gauntlet** — three strikes end the run (a middle ground between Classic and Survival)
- **Live Duel** — real-time head-to-head against a friend (or anyone — duels don't require an
  existing friendship) over WebSockets: both players get the identical seeded question set, see
  each other's live score/streak while playing, and land on a synchronized result screen when
  both finish

**Difficulty, canon, and fairness**
- Two independent filters: obscurity tier (First Year → Order of the Phoenix) and canon source
  (books / movies / combined), plus a "Books vs. Movies" category dedicated to genuine
  book/film adaptation differences
- Classic mode forces an obscurity-tier floor on a run's first few questions to reduce
  leaderboard variance from random easy/hard draws
- Leaderboards rotate on "This Week" / "Today" windows alongside an "All Time" Hall of Fame, so
  a high early score doesn't lock out everyone who plays later in the period; ties break on run
  duration
- Each leaderboard view shows a player's own best run only — repeat attempts don't crowd out
  other players' single entries
- A dedicated **Duel leaderboard** ranks players by Wins / Losses / Win %, with the same
  global/friends scope toggle as the score leaderboards

**Accounts & social**
- Email/password accounts (scrypt-hashed, signed auth tokens)
- Mutual friend requests (send, accept, decline) with online-presence indicators, kept live via
  the same 15s poll across both the friends list and the Online Now tab
- A member-discovery area on the Friends screen with four tabs: **Online Now** (everyone
  currently active), **All Members** (the full paginated player directory), **Search**
  (find anyone by partial username), and **Activity** (a friends-scoped feed of personal bests,
  achievement unlocks, and duel wins — opt-in, never pushed) — each discovery tab with inline
  Add / Accept / Challenge actions
- Global and friends-scoped leaderboards, segmented by mode/category/canon/difficulty
- **Player profile pages** — lifetime stats (accuracy, favorite category, best score, duel
  record, achievement count, day streak) for any player, all derived from existing session data,
  reachable by clicking a username anywhere it appears
- **Daily play streaks** — a Duolingo-style day-streak (any mode counts, distinct from the
  existing in-run answer streak), computed on request from actual play history rather than a
  counter that could drift; shown quietly on the profile and the Start screen once it's 2+ days
- **Invite-a-friend links** and **private challenge links** — a lazily-generated personal invite
  code that auto-friends whoever registers through it, and a shareable code for a custom
  category/difficulty quiz that a group all plays with the identical question set

**Achievements**
- 32 achievements across 8 categories (Milestones, Mastery, Streak, Endurance, Speed, Explorer,
  Dedication, Social), evaluated after each session/friend-request/duel/challenge event and
  pushed live as an in-app toast the moment one unlocks

**Design**
- A book/library-themed interface — parchment "leaf" cards with gilt corner brackets, a printed
  running header instead of a web app nav bar, a two-page book-spread layout (with a real
  binding-groove shadow) on the Start and Question screens, and a page-turn transition between
  questions (skipped in Blitz, where it would eat into the run's time budget)
- Typeset in Cormorant Garamond (display) and EB Garamond (body) — one Garamond lineage
  throughout, instead of mismatched display/body faces
- Five selectable house color bindings (Gryffindor, Hufflepuff, Slytherin, Ravenclaw, Monochrome),
  calibrated against the canonical house-color reference rather than eyeballed, via a Settings
  screen; the choice persists to the player's account. Monochrome is the default for logged-out
  visitors and any account that hasn't picked a house yet
- Navigation chrome (running header, page links, filter pills) stays a fixed silver across every
  house binding — house color is reserved for the game surface itself (plates, buttons, corner
  brackets), so the app's own UI never clashes with whichever house is active

**Content**
- 2,927+ questions across 11 categories, with every (category × difficulty × canon-source)
  combination holding 60+ questions in both the books-pool and movies-pool
- **Community submissions**: a hidden easter egg (type "I solemnly swear that I am up to no
  good" anywhere on the Home screen, or tap the "The Restricted Section" wordmark 7 times —
  the mobile-friendly equivalent) reveals a "Suggest a Question" form any logged-in player can
  use. Every submission is reviewed by an admin — who sets the two fields a submitter can't be
  expected to calibrate (difficulty tier, design tier) and can edit anything else — before it's
  ever inserted into the live question bank. Rejected submissions stay on record with a note;
  approved ones go live immediately (no restart needed). See "Content pipeline" below for how
  to grant admin access.

**Anti-cheat**
- Server-issued HMAC question tokens; single-use, session/question-bound, server-clock timing
- Server-side scoring: obscurity tier + design-tier difficulty + divergence rarity + streak +
  time-remaining bonus

## Roadmap

Grouped by theme and rough sequencing. Not commitments — a working plan, revised as priorities
shift. "Category" marks the kind of value each item adds; "Phase" is when it's currently
expected to land. See `docs/phase4-scaffold.md` and `docs/phase5-scaffold.md` (both shipped) for
implementation-ready specs, and `docs/stack-audit-2026-09.md` / `docs/design-audit-2026-09.md`
for the two hardening passes that ran alongside Phase 5.

The **Second Edition design overhaul** (`docs/design-overhaul-concept.md`) shipped in six
phases on top of Phase 5: the app is now presented as a rare book, each house a different
*binding* of it, with rubricated initials and numerals, gold-leaf moments, tooled cloth
boards, a ring-dial timer, book-spine mode selection and a stamped seal on every completed
run. Colour is verified rather than eyeballed — `cd frontend && npm run audit:contrast`
checks 210 real colour pairings across all five bindings and fails the build on a
regression (findings: `docs/contrast-audit-2026-09.md`).

| Phase | Theme | Focus |
|---|---|---|
| **Phase 4** | Growth & Quick Wins | Make it easy for people to hear about this and start playing — ✅ shipped |
| **Phase 5** | Social & Retention Depth | Give players reasons to come back, and to come back together — ✅ shipped |
| **Phase 6** | Bigger Swings | Larger gameplay and content investments |

### Phase 4 — Growth & Quick Wins ✅ shipped

| Feature | Category | Why |
|---|---|---|
| Shareable result cards | Growth | A shareable summary after any run/duel is the cheapest, highest-leverage growth lever available — the same mechanic that made Wordle spread |
| Invite-a-friend links | Growth | Turns the friend/member features already shipped into an actual growth engine instead of a closed loop |
| Guest preview mode | Growth | Let a visitor play a few sample questions before hitting the signup wall — every bit of signup friction costs casual traffic |
| House Cup leaderboard | Gameplay | Aggregate every player's scores by chosen house into a standing inter-house board — nearly free to build on existing house data, and very on-theme |
| Auth rate limiting | Technical | `/auth/login` and `/auth/register` have no throttling yet — cheap hardening before real traffic arrives |

### Phase 5 — Social & Retention Depth ✅ shipped

Every item held to a "stay optional, stay light" rule: the quiz stays the whole point, nothing
pushes a notification for someone else's activity, and every new screen is reached by an
existing tab or a single optional link rather than new mandatory nav chrome.

| Feature | Category | Why |
|---|---|---|
| Private challenge links | Gameplay | Assemble a custom quiz (category/difficulty) and share a code so a group all plays the identical set and compares scores, without the Daily Challenge's fixed daily seed |
| Activity feed | Social | "Alice just beat her high score in Potions" — makes the app feel alive with few concurrent users, built from events already emitted on session completion |
| Player profile page | Retention | Lifetime stats — accuracy, favorite category, total questions answered — from data already stored per session |
| Daily login/play streaks | Retention | A Duolingo-style day-streak, distinct from the existing in-run answer streak |
| Achievement expansion | Retention | New achievements building on what's shipped — duel win-streaks, "10 friends," and (once challenge links shipped) challenge-creator/challenge-group achievements |

**Hardening alongside Phase 5**: three stack-audit findings that had been documented but never
actually fixed (duplicate pending duel invites, stale friends-list presence, a double-fire
achievement toast under concurrent evaluation), plus a full design/UX audit that found and fixed
two root-cause contrast bugs (a nav-tab component styled only for the dark page background, used
inside a light card on the Friends screen; a house accent color applied directly to text on the
dark page) and two mobile-only layout bugs. See `docs/stack-audit-2026-09.md` and
`docs/design-audit-2026-09.md` for the full findings.

### Phase 6 — Bigger Swings

| Feature | Category | Why |
|---|---|---|
| Tournament brackets | Gameplay | Multi-round elimination duels among a friend group, run over a few days — cheaper to build now than when first scoped, since private challenge links already solved "give N players the identical seeded question set" |
| Lifelines (50-50, skip) | Gameplay | Adds strategic depth to Classic mode; needs server-side handling to keep the anti-cheat model intact |
| Canned duel reactions | Social | Lightweight reactions during a live duel, without the moderation burden of free-text chat |
| Seasonal content bundles | Content | Timed to real-world anniversaries (book/film release dates) — a good scheduled-retention hook |
| Mobile & accessibility pass | Technical | The design audit caught two mobile-only layout bugs by sampling a handful of screens at phone width, not an exhaustive pass — most casual trivia traffic is mobile, and this still warrants a dedicated pass across every screen and real device testing, not just a viewport-width screenshot check |
| Achievement showcase on profile | Retention | The profile page currently shows only an "X / 32 unlocked" count — surfacing a few actual unlocked badges would tie the profile and achievements systems together for near-zero new backend work (the data's already there) |
| Featured weekly challenge | Retention | A system-generated private challenge (reusing that infra directly) auto-rotated weekly, giving a lighter-weight, fresher-content sibling to the fixed-forever Daily Challenge without the full Seasonal Content investment |

### Carried over, not yet scheduled

- **Discord bot tie-in** — dropped for now, needs bot credentials to revisit
- **Anomaly-detection shadow-flagging** — for bot-speed-but-legitimate answers slipping past the
  token-based anti-cheat

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL, QUESTION_TOKEN_SECRET, AUTH_TOKEN_SECRET
npm run db:migrate
npm run db:seed
npm run dev             # http://localhost:4000
```

`db:seed` loads `src/data/question-bank-starter.json` (a small 40-question sample) by default.
To seed the full 2,927-question bank, set `SEED_FILE`:

```bash
SEED_FILE=question-bank-full-draft.json npm run db:seed
```

`db:seed` upserts by question `id`, so it's safe to re-run after pulling in new content — it
won't duplicate existing questions.

### Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api and /ws to the backend
```

## Deploying to Railway

This repo is a two-service monorepo: `backend/` runs the API (including the WebSocket server,
on the same port — no extra Railway config needed since it's a persistent Node process, not
serverless), `frontend/` runs a static build served by `serve`. Each service ships its own
`railway.toml`. Create two Railway services from the same GitHub repo, pointing each at a
different root directory:

1. **Postgres**: in your Railway project, add a Postgres plugin — it provides `DATABASE_URL`.
2. **Backend service** — root directory `backend`:
   - Variables: `DATABASE_URL` (reference the Postgres plugin), `QUESTION_TOKEN_SECRET` and
     `AUTH_TOKEN_SECRET` (two different long random strings — the backend won't start without
     both), `NODE_ENV=production`.
   - After a deploy that changes the schema or question bank, run `npm run db:migrate` and/or
     `SEED_FILE=question-bank-full-draft.json npm run db:seed` once (Railway's one-off command
     runner, under the service's "Deploy" tab, or from a Codespace with `DATABASE_URL` and
     `NODE_ENV=production` exported).
   - The backend caches the question list in memory per process, so after seeding new
     questions, restart (or redeploy) the service for it to pick them up.
   - Note its public URL (Settings → Networking → Generate Domain) — the frontend needs it.
   - Once you know the frontend's domain, set `ALLOWED_ORIGIN` on this service to that URL to
     lock CORS down (comma-separate if you have more than one).
3. **Frontend service** — root directory `frontend`:
   - Variables: `VITE_API_URL` set to the backend's public URL **plus `/api`**
     (e.g. `https://trivia-backend-production.up.railway.app/api`). Vite bakes this in at build
     time, so redeploy the frontend if you ever change the backend's URL.
   - Generate a public domain for this service too — that's the URL players use.

Both `railway.toml` files set `builder = "NIXPACKS"`, which auto-detects the Node app in each
root directory and runs its `package.json` scripts (`build` then `start`) with no extra config.

## Content pipeline

Two ways new questions reach the bank:

1. **Batch generation** — `backend/src/data/question-bank-full-draft.json` (an array of question
   objects under a `questions` key). Each question carries a `needs_factcheck` flag — set by
   whoever drafted it whenever they weren't fully confident in a fact rather than guessing — so
   a human reviewer can filter for it later without re-checking everything. New batches are
   generated, validated (schema, duplicate IDs, duplicate `question_text`), and merged into that
   file before being seeded; see recent commit history for the process.
2. **Community submissions** — any player can submit one via the "Suggest a Question" easter egg
   (see "What's implemented" above); an admin reviews it and, on approval, it's inserted straight
   into the live `questions` table (no reseed or restart needed — the in-memory question cache
   is invalidated immediately). To make an account an admin, there's no self-serve flow by
   design — run this directly against the database:
   ```sql
   UPDATE users SET is_admin = true WHERE email = 'you@example.com';
   ```

See `docs/ip-risk-notes.md` for what's in and out of bounds when drafting new questions,
however they arrive.
