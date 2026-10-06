# Contributing

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first — it decides where code goes. This file covers
how changes get written, checked and shipped.

## Before you push

```bash
cd backend  && npm run lint && npm test  # lint, then unit + session-flow integration tests
cd frontend && npm run lint              # lint (React hooks rules included)
cd frontend && npm run build             # catches anything that will not bundle
cd frontend && npm run audit             # contrast, dead code, accessibility
```

A change to what a screen looks like also runs the browser tests (`cd frontend && npm run e2e`,
with the app, the API and a database up — see [`docs/compatibility.md`](docs/compatibility.md) for
the screen-size sweep and what it cannot prove).

CI runs all of these, but a failure found locally costs a minute and a failure found in CI
costs a round trip.

## Writing code

**Comments explain why, not what.** The code says what it does. A comment earns its place by
recording the reason a choice was made, the alternative that was rejected, or the bug that
made it necessary — the things a reader cannot recover from the code. Match the density of the
file you are in.

**Name things after what they are to the player**, not how they are implemented. A player has
a *run*, not a `game_session_record`.

**Handle the failure the user will actually see.** A request that can fail needs a message
saying what failed and what to do about it, rendered somewhere the user is looking. The bug
that started the September 2026 audit was an error state that existed but was rendered only on
a screen the player was not on, so a failed answer looked like a dead button.

**Do not widen a change to fix something nearby.** Note it, finish the change, raise the other
thing separately.

## Tests

**A bug that reached a player gets a test before it gets a fix.** The two defects that have
reached players — a run that could not be finished, and session routes with no ownership check
— were both found by playing the game, because everything under test was a pure function.

| Kind | Where | Needs |
|---|---|---|
| Pure logic: scoring, tokens, selection | `backend/test/*.test.js` | nothing |
| Route behaviour, auth, whole flows | `backend/test/*.test.js` | `DATABASE_URL` (skips without one) |
| What the browser actually does | `frontend/e2e/` | a running dev server |

Integration tests skip rather than fail when `DATABASE_URL` is unset, so the suite still runs
on a machine with no Postgres. CI always provides one, so a skipped test there is a bug.

## Commits and pull requests

One concern per commit. The message says what changed and **why it needed to change** — the
finding, the bug, the measurement. A reader six months out has the diff already; what they do
not have is the reason.

Pull requests need CI green. Do not merge past a red check by re-running it; a flake that
cannot be explained is a failure that has not been understood yet.

## Deploying

Railway deploys `main` automatically, one service per directory. Which means:

1. **`main` is deployed.** Merging is shipping. Nothing lands there without a green PR.
2. **Migrations run before the new code starts.** `preDeploy: "npm run db:migrate"`
   in `.railway/railway.ts`. A schema change and the code that needs it can therefore ship in
   one commit.
3. **A redeploy does not run pre-deploy.** Railway replays the previous deployment's snapshot,
   so a redeploy does not migrate. Forcing a real build is the only way to run a migration that
   was missed — this cost three attempts to learn once already.
4. **Verify the deploy, do not infer it.** The API reports the commit it was built from at
   `/api/health`; compare that to the commit you merged rather than correlating timestamps. The
   frontend no longer prints its build on the page (it was removed from the footer deliberately),
   so confirm it in the Railway dashboard — the deployment's commit and a green build — and by
   loading the app. The build's commit still goes to Sentry as the release name, when Sentry is on.

### After a deploy

Check `/api/health` reports the commit you expect, check the frontend deployment in the Railway
dashboard shows the same commit, load the app, and read the deploy log for errors. If a migration was part of the change, the log should show
`Schema applied.` before the server starts listening.

## Auditing

Run the audits before a release and after any change to colour, layout or a shared component:

```bash
cd frontend && npm run audit:contrast   # WCAG contrast, all five house bindings
cd frontend && npm run audit:dead       # unreferenced CSS classes, unused exports
cd frontend && npm run e2e              # real browser: a run, a duel, accessibility (touch targets,
                                        # names, focus ring), and the screen-size sweep
```

The first two need nothing. The last needs the dev server, the API and a database running.

Findings that are fixed go in the commit that fixes them. Findings that are **not** being fixed
go in a dated write-up under `docs/` with the reason — an audit that only records wins is a
marketing document. See [`docs/platform-audit-2026-09.md`](docs/platform-audit-2026-09.md).
