# Monitoring: uptime checks and error tracking

Right now a production failure is silent until a player happens to report it. This doc covers
the two pieces that close that gap: an external uptime monitor (a one-time account-setup task,
not code) and Sentry error tracking (code already scaffolded in this repo, inert until you add
a key). Neither is required for the app to run — both are purely additive.

## Uptime monitoring

This isn't something that can be set up from inside the repo: it's an external synthetic-check
service hitting the deployed app from outside, which needs its own account. Nothing here fakes
that integration — it's a setup task for whoever owns the Railway deployment.

**Endpoint to monitor:** `https://<production-host>/api/health`

This is the same path Railway's own `healthcheckPath` already polls (see `.railway/railway.ts`),
so there is nothing new to add to the backend. A healthy response is:

```
200 OK
{
  "ok": true,
  "commit": "a1b2c3d",
  "commit_full": "a1b2c3d4e5f6...",
  "branch": "main",
  "started_at": "2026-10-04T12:00:00.000Z"
}
```

Point the monitor at a plain `GET` and check for a `200` status; checking that the body parses
as JSON with `"ok": true` is a reasonable second assertion if the service supports one, but
status code alone is enough to know the process is up and answering requests.

**Recommended service:** [UptimeRobot](https://uptimerobot.com) — free tier covers a 5-minute
check interval, which is plenty for a project this size, plus email/SMS/webhook alerting on a
state change. [Better Uptime](https://betteruptime.com) (now part of Better Stack) is a solid
alternative with a similar free tier and a nicer incident timeline if you outgrow UptimeRobot's.
Railway also has its own basic uptime/restart visibility built into the dashboard already (it's
what drives the service's `ON_FAILURE` restart policy), but that only tells you the
*process* is alive, not that `/api/health` is actually reachable from outside — an external
monitor is what catches a DNS, TLS, proxy or Railway-platform problem that a healthy process
can't see from the inside.

Setup, either service: create a free account, add a new HTTP(S) monitor pointed at the URL
above, set the interval (5 minutes on the free tier), and give it somewhere to alert (email is
enough to start). That's the whole task — there's nothing to wire up in this repo for it.

## Error tracking (Sentry)

The backend (`backend/src/app.js`, via `backend/src/lib/sentry.js`) and frontend
(`frontend/src/main.jsx`, via `frontend/src/lib/sentry.js`) are both wired for
[Sentry](https://sentry.io) already. Both halves are gated behind an environment variable and
are a complete no-op without it — no Sentry account, no network calls, no console output, no
change to any existing behavior, until that variable is set:

- Backend: `SENTRY_DSN` — gates `backend/src/lib/sentry.js`. Unset, `Sentry.init` is never
  called. Set, unhandled exceptions and any 5xx response (including the ones routes already
  catch and answer themselves — see `CONTRIBUTING.md` on this codebase's error-handling
  convention) are reported to Sentry *in addition to* whatever the route already sends the
  client; nothing about the client-facing response changes.
- Frontend: `VITE_SENTRY_DSN` — gates `frontend/src/lib/sentry.js`, called once from
  `main.jsx`. Unset, `Sentry.init` is never called and `AppErrorBoundary` (also wrapping the
  app in `main.jsx`) still catches a render crash and shows a reload screen instead of a white
  screen — it just doesn't phone anything home. Set, the same crash is also reported.

### Getting a DSN

1. Create a free account at [sentry.io](https://sentry.io) (the free tier is generous enough
   for a project this size).
2. Create two projects — one Node.js, one React — or one project of each platform if your org
   structure prefers that. Each project page shows a DSN (a URL like
   `https://<key>@<org>.ingest.sentry.io/<project>`) under Settings → Client Keys (DSN).

### Where to set each variable

- **`SENTRY_DSN`** (backend): Railway dashboard → the backend service → **Variables** tab —
  the same place `ALLOWED_ORIGIN` and the other production-only vars listed in
  `backend/.env.example` are already set. This is read at runtime (`process.env.SENTRY_DSN`),
  so setting it takes effect on the next deploy or restart — no rebuild required.
- **`VITE_SENTRY_DSN`** (frontend): wherever the frontend's other `VITE_`-prefixed build-time
  vars are set — that's Railway dashboard → the frontend service → **Variables** tab, matching
  exactly how `VITE_API_URL` is already configured there (see `frontend/.env.example` and
  `frontend/vite.config.js`). Vite only bakes `VITE_`-prefixed vars into the build at *build*
  time, not runtime, so this one only takes effect on the **next build** — a plain restart of
  an already-built deploy won't pick it up; push a commit or trigger a rebuild.

Neither variable is required. Leave both unset and nothing changes or breaks — that's the
behavior this was explicitly built to guarantee, not just assumed: the backend was started
locally with no `SENTRY_DSN` set and `/api/health` served its normal response with no new
console output, and `npm test` / `npm run build` both stayed green with the Sentry packages
installed and wired in but inactive.
