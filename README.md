# Harry Potter Trivia — Phase 1

A competitive HP trivia game with canon-source (books/movies/combined) filtering, two-axis
difficulty, and server-authoritative scoring. See `docs/` for the design brief and anti-cheat
architecture this build follows.

## Stack

- **Backend**: Node/Express + Postgres (`backend/`)
- **Frontend**: React + Vite (`frontend/`)

## Score integrity

The client never computes a score — it only submits an answer. The server issues a signed,
single-use, session/question-bound token with every question and validates elapsed time against
its own clock before scoring. See `docs/anti-cheat-architecture.md`.

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL and QUESTION_TOKEN_SECRET
npm run db:migrate
npm run db:seed
npm run dev             # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api to the backend
```

## Deploying to Railway

This repo is a two-service monorepo: `backend/` runs the API, `frontend/` runs a static build
served by `serve`. Each service ships its own `railway.toml`. Create two Railway services from
the same GitHub repo, pointing each at a different root directory:

1. **Postgres**: in your Railway project, add a Postgres plugin — it provides `DATABASE_URL`.
2. **Backend service** — root directory `backend`:
   - Variables: `DATABASE_URL` (reference the Postgres plugin), `QUESTION_TOKEN_SECRET` (a long
     random string), `NODE_ENV=production`.
   - After the first deploy, run `npm run db:migrate` then `npm run db:seed` once (Railway's
     one-off command runner, under the service's "Deploy" tab).
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

## What's implemented (Phase 1 pilot slice)

- Classic Quiz and Daily Challenge modes, category + canon-source filtering
- Combined canon-source mode up-weights books-vs-movies divergence questions
- Server-issued HMAC question tokens; single-use, session/question-bound, server-clock timing
- Server-side scoring: obscurity tier + design-tier difficulty + divergence rarity + streak +
  time-remaining bonus
- Global leaderboard per mode; one Daily Challenge attempt per player per day
- 40-question starter bank across the 4 pilot categories

## Not yet built

- Real accounts (Discord OAuth / email) — currently just a display name, no auth
- Anomaly-detection shadow-flagging for bot-speed-but-legitimate answers
- Blitz/Survival modes, per-category/per-difficulty leaderboard segmentation (Phase 2)
