# The Restricted Section

A competitive Harry Potter trivia game: server-authoritative scoring, real-time head-to-head
duels, friends, achievements and titles, in a book-and-library interface with five selectable
house "bindings".

This is an **unofficial fan project**. It is not affiliated with or endorsed by J.K. Rowling,
Warner Bros., or any rights holder. [`docs/ip-risk-notes.md`](docs/ip-risk-notes.md) sets out
what does and does not go into this build, and it applies to every question and every piece of
artwork.

- [Features](#features)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Tests and checks](#tests-and-checks)
- [Deploying to Railway](#deploying-to-railway)
- [Content pipeline](#content-pipeline)
- [Documentation](#documentation)
- [Roadmap](#roadmap)

## Features

**Game modes**

| Mode | What it is |
|---|---|
| Classic | 10 questions, 30 seconds each, with category, canon and difficulty filters. 50-50 and skip lifelines (one of each per run), Classic only. |
| Daily Challenge | One shared 10-question set per day, the same for every player. One attempt per player per day. |
| Blitz | A 60-second shared budget for the whole run: answer as many as you can. |
| Survival | One wrong answer or timeout ends the run. |
| Gauntlet | Three strikes end the run. |
| Live Duel | Real-time head-to-head over WebSockets against a friend or any member. Both players get the identical seeded set, see each other's score and streak live, and land on a synchronised result screen. Canned reactions only, no free-text chat. |
| Private challenge | A shareable code for a custom quiz (category, difficulty, 10/15/25/30 questions) that a group plays with the identical question set. |
| Weekly challenge | A system-generated challenge that rotates weekly. |

**Questions and fairness**
- Two independent filters: obscurity tier (First Year to Order of the Phoenix) and canon source
  (books, movies, or combined), plus a "Books vs. Movies" category for genuine adaptation
  differences.
- Classic enforces an obscurity-tier floor on a run's first few questions, so the luck of the
  draw moves the leaderboard less.
- Leaderboards by mode, category, canon and difficulty; Today, This Week and All Time windows;
  global and friends scopes; one best run per player per view; ties break on run duration. A
  separate Duel leaderboard ranks Wins, Losses and Win %, and a House Cup totals scores by house.

**Accounts and social**
- Email and password accounts. A password change or reset signs every other session out. Password
  reset by email, and a public account-deletion page that works without being able to log in.
- A 13+ age gate at registration (neutral, and nothing is kept for anyone turned away).
- Friend requests, online presence, and a member-discovery area (Online Now, All Members, Search,
  Activity).
- Profiles with lifetime stats, daily play streaks, pinned achievements and an avatar designer
  (sigils or monogram, style layers).
- **Owl Post**: short messages between players, with a per-player Open / Friends only / Off
  setting and limits on how much a stranger can send.
- Blocking, reporting with conversation evidence, and a moderation queue.
- **Achievements and titles**: more than 40 achievements across nine categories, announced in-app
  as they unlock, and each earned title is hung on one. Admins can also grant system titles.
- Invite links that auto-friend whoever registers through them, and shareable result cards.
- A guest preview that lets a visitor try a few questions before signing up.

**Roles**: player, moderator (reviews reports and acts within limits) and admin (everything,
including bans, the question queue, titles and the team). The role is read fresh from the
account on every request, never from the token.

**Design**
- A rare-book treatment: each house is a different binding of it, with parchment leaves, tooled
  cloth boards, rubricated initials and numerals, a ring-dial timer, book-spine mode selection and
  a stamped seal on every completed run. Typeset in IM Fell English (display) and EB Garamond
  (body).
- Five house bindings (Gryffindor, Hufflepuff, Slytherin, Ravenclaw, Monochrome), chosen in
  Settings and saved to the account. Monochrome is the default for visitors and for accounts that
  have not chosen.
- The house devices (Ember, Furrow, Tide, Gale, Blind Stamp) are original geometric marks drawn by
  element, not by animal. There are no crests, shields, wands, licensed fonts or image files:
  every ornament is CSS or inline SVG. See [`CLAUDE.md`](CLAUDE.md) for the design constraints.
- WCAG contrast is checked against every pairing the app renders, in all five bindings.

## How it works

**Score integrity.** The client never computes a score; it only submits an answer. The server
issues a signed, single-use token bound to the session and question with every question, and
validates elapsed time against its own clock before scoring. Nothing that reveals the right answer
crosses to the client. Runs that look machine-fast are shadow-flagged and held off public
leaderboards for a manual look rather than banned. See
[`docs/anti-cheat-architecture.md`](docs/anti-cheat-architecture.md) and
[`docs/answer-flow.md`](docs/answer-flow.md).

**Stack**
- **Backend** (`backend/`): Node 20, Express 4, Postgres 16, WebSockets (`ws`). The schema is
  append-only and idempotent, in `backend/src/db/schema.sql`.
- **Frontend** (`frontend/`): React 18 and Vite. A reducer-driven `App.jsx` composes per-feature
  hooks and routes screens.

**Layout.** One feature, one file at every layer: a screen brings its own component, stylesheet,
API module and hook; a resource brings its own route and service. Routes stay thin and the rules
live in `lib/` and `services/`, where they can be tested without HTTP. The rules, and why, are in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Quick start

You need Node 20 and a Postgres database.

**Backend**

```bash
cd backend
npm install
cp .env.example .env    # set DATABASE_URL, QUESTION_TOKEN_SECRET, AUTH_TOKEN_SECRET
npm run db:migrate
npm run db:seed
npm run dev             # http://localhost:4000
```

`db:seed` loads a 40-question sample by default. To load the full bank (about 2,900 questions
across 11 categories), set `SEED_FILE`:

```bash
SEED_FILE=question-bank-full-draft.json npm run db:seed
```

It upserts by question `id`, so it is safe to re-run after pulling in new content.

**Frontend**

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api and /ws to the backend
```

## Configuration

Copy `backend/.env.example` to `backend/.env`. Only the first three are needed locally.

**Backend**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. |
| `QUESTION_TOKEN_SECRET` | Yes | Signs the single-use question tokens. |
| `AUTH_TOKEN_SECRET` | Yes | Signs auth tokens. Must differ from the one above. |
| `PORT` | No | Defaults to 4000. |
| `NODE_ENV` | Production | Set to `production` on Railway. |
| `ALLOWED_ORIGIN` | Production | The frontend's public URL, to lock CORS down (comma-separate several). |
| `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` | For email | Password reset and account-deletion emails. Without both the key and sender, nothing is sent and the app hides the reset link. `APP_URL` is the frontend's public address and falls back to `ALLOWED_ORIGIN`. |
| `SENTRY_DSN` | No | Error tracking. Inert when unset. See [`docs/monitoring.md`](docs/monitoring.md). |
| `GITHUB_FEEDBACK_TOKEN`, `GITHUB_FEEDBACK_REPO` | No | Lets the Submit Feedback link file a GitHub issue. Use a fine-grained token with only "Issues: write" on that one repo. Without them the endpoint returns 503. |
| `SEED_FILE` | No | Question file for `db:seed`. |

**Frontend** (baked in at build time, so redeploy after changing them)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | The backend's public URL **plus `/api`**. Leave unset locally. |
| `VITE_PARENT_CONTACT_EMAIL` | A private address shown to anyone under 13 who is turned away at registration. Set one before launch. |
| `VITE_SENTRY_DSN` | Error tracking. Inert when unset. |

## Tests and checks

CI runs all of these on every push to `main` and every pull request
(`.github/workflows/ci.yml`). To run them yourself:

```bash
cd backend  && npm run lint && npm test   # lint, then unit and session-flow integration tests
cd frontend && npm run lint               # includes the React hooks rules
cd frontend && npm run build              # catches anything that will not bundle
cd frontend && npm run audit              # WCAG contrast across all five bindings, plus dead code
cd frontend && npm run e2e                # a real browser: solo run, two-browser duel, a11y, screen sizes
```

- The session-flow tests need a database and read `DATABASE_URL` from `backend/.env`. Without one
  they skip rather than fail.
- `audit:contrast` exits non-zero if any gated pairing falls below its WCAG threshold. Each house
  rebinds the role tokens, so a colour that reads well in one binding can fail in another.
  `audit:dead` is a report to read, not a gate.
- `e2e` needs the API, the dev server and a database running. Registration is rate limited per IP,
  so a rapid re-run is refused, and the suite says so instead of timing out. It expects the app
  at `http://localhost:5175` (CI runs `npx vite --port 5175`); set `E2E_BASE_URL` if yours is
  elsewhere. What the screen-size sweep
  covers, and what it cannot prove, is in [`docs/compatibility.md`](docs/compatibility.md).

How changes are written and shipped is in [`CONTRIBUTING.md`](CONTRIBUTING.md). `main` is
deployed, so nothing lands there without a green pull request.

## Deploying to Railway

This is a two-service monorepo. `backend/` runs the API and the WebSocket server on the same
port, as a persistent Node process. `frontend/` is a static build served by `serve`. Each service
has its own `railway.toml`. Create two Railway services from the same GitHub repo, each with a
different root directory:

1. **Postgres.** Add a Postgres plugin to the project. It provides `DATABASE_URL`.
2. **Backend service**, root directory `backend`:
   - Set `DATABASE_URL` (reference the plugin), `QUESTION_TOKEN_SECRET`, `AUTH_TOKEN_SECRET`
     (two different long random strings; the backend will not start without both) and
     `NODE_ENV=production`. Add the optional variables from [Configuration](#configuration) as
     needed.
   - Every build runs `npm run db:migrate` as a pre-deploy step (set in `railway.toml`). A
     **redeploy** replays the previous snapshot and does not run it, so a schema change needs a
     push or a fresh build.
   - The question bank is not seeded automatically. After a deploy that changes it, run
     `SEED_FILE=question-bank-full-draft.json npm run db:seed` once, from Railway's one-off command
     runner or from a shell with `DATABASE_URL` and `NODE_ENV=production` exported. The backend
     caches the question list per process, so restart the service afterwards.
   - Generate a public domain (Settings, Networking). The frontend needs it.
   - Once you know the frontend's domain, set `ALLOWED_ORIGIN` to it.
3. **Frontend service**, root directory `frontend`:
   - Set `VITE_API_URL` to the backend's public URL plus `/api`
     (for example `https://trivia-backend-production.up.railway.app/api`).
   - Generate a public domain. That is the URL players use.

Both services use `builder = "NIXPACKS"`, which detects the Node app and runs `build` then
`start` with no extra configuration. Uptime checks and error tracking are covered in
[`docs/monitoring.md`](docs/monitoring.md).

## Content pipeline

New questions reach the bank two ways:

1. **Batch generation.** `backend/src/data/question-bank-full-draft.json` holds the bank under a
   `questions` key. Each question has a `needs_factcheck` flag, set by whoever drafted it when they
   were not fully confident in a fact, so a reviewer can filter for it later. New batches are
   validated (schema, duplicate IDs, duplicate `question_text`) and merged into that file before
   seeding.
2. **Community submissions.** A hidden easter egg (type "I solemnly swear that I am up to no
   good" on the Home screen, or tap the wordmark seven times on mobile) opens a "Suggest a
   Question" form for any logged-in player. An admin reviews each one, sets the difficulty and
   design tiers a submitter cannot be expected to calibrate, and may edit anything else. Approved
   questions go live immediately, with no reseed or restart. Rejected ones stay on record with a
   note.

There is no self-serve way to become an admin, by design. Run this against the database:

```sql
UPDATE users SET is_admin = true WHERE email = 'you@example.com';
```

An admin can then appoint moderators and grant titles from the app.

## Documentation

| Document | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Where code goes, and the rules behind it |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How changes are checked and shipped |
| [`CLAUDE.md`](CLAUDE.md) | The short version of both, plus the design constraints, for agents |
| [`docs/anti-cheat-architecture.md`](docs/anti-cheat-architecture.md), [`docs/answer-flow.md`](docs/answer-flow.md) | Score integrity and the answer path |
| [`docs/social-safety.md`](docs/social-safety.md) | Profiles, blocking, reports, Owl Post, titles, age gate, retention, roles |
| [`docs/design-overhaul-concept.md`](docs/design-overhaul-concept.md), [`docs/design-brief-v2.md`](docs/design-brief-v2.md) | The book-and-binding design and the house devices |
| [`docs/contrast-audit-2026-09.md`](docs/contrast-audit-2026-09.md), [`docs/compatibility.md`](docs/compatibility.md) | Colour contrast and screen-size testing |
| [`docs/ip-risk-notes.md`](docs/ip-risk-notes.md) | What is in and out of bounds for content and artwork |
| [`docs/legal/`](docs/legal) | Terms and Privacy drafts (they need an attorney before launch) |
| [`docs/monitoring.md`](docs/monitoring.md) | Uptime checks and Sentry |
| `docs/*-audit-*.md` | Dated audits: platform, stack, design, code, question bank |
| [`docs/phase4-scaffold.md`](docs/phase4-scaffold.md), [`docs/phase5-scaffold.md`](docs/phase5-scaffold.md) | The specs behind the growth and retention phases (both shipped) |

## Roadmap

Phases 4 and 5 (growth, then social and retention depth) and most of Phase 6 have shipped, along
with the Second Edition design overhaul, the social-safety work and the audits listed above. What
is still open is a working plan, not a commitment:

- **Tournament brackets**: multi-round elimination duels among a friend group, run over a few
  days. Private challenge links already solve "give N players the identical seeded set".
- **Seasonal content bundles**: questions timed to book and film anniversaries.
- **Discord bot tie-in**: parked until there are bot credentials.
- **Railway Config as Code**: `railway.toml` is deprecated in favour of `.railway/railway.ts`.
  Existing files keep working until **2026-12-01**.
- **Audit follow-ups**: a report-only frontend Content Security Policy, the Vite 8 upgrade, and a
  pass on real iOS and Android devices (the screen-size test is a Chromium emulation).
- **Before launch**: set the email variables above, have an attorney review `docs/legal/`, and
  decide what to do about accounts created before the age gate existed, which were never asked
  their age.
