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
