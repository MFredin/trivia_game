# Railway configuration as code

Railway stops reading `railway.toml` / `railway.json` on **2026-12-01** (a hard cutoff) and
replaces them with Infrastructure as Code: one file, `.railway/railway.ts`. This repo's two
`railway.toml` files have been replaced by it. This page says what changed, the steps that remain
(they need the Railway CLI and a login, so a person runs them), and how to work with the file
afterwards.

**Status: the file is in the repo; it has not been applied to Railway yet.** Until step 4 below, the
services run on the settings stored in the Railway dashboard, which cover the pre-deploy migration
but not the health check (see "What the dashboard has to hold").

## What is in the repo

| File | What it is |
| --- | --- |
| `.railway/railway.ts` | Both services (`trivia_game`, the API, and `incredible-blessing`, the web app) as TypeScript. It declares the start command, the pre-deploy migration and the health check, and lists every existing variable by **name** only. |
| `.github/workflows/railway-config.yml` | Plans on every PR that touches `.railway/**` and applies when it merges. Skips itself until the `RAILWAY_TOKEN` secret exists (step 5). |
| `package.json` (repo root) | Tooling only, so the file can be type-checked. The deployed apps' dependencies stay in `backend/` and `frontend/`. |
| `backend/railway.toml`, `frontend/railway.toml` | **Deleted.** See "Why they were deleted first". |

Type-check the file locally with `npm ci` then
`npx tsc --noEmit --moduleResolution bundler --module esnext --target es2022 --esModuleInterop --skipLibCheck .railway/railway.ts`.
That proves the file is well-formed against the SDK's types. Only `railway config plan` proves
Railway will accept it.

## Why they were deleted first

Railway will not plan a service that is still managed by a `railway.toml`: "A service cannot be
managed by both systems at the same time." An earlier version of this page ran `plan` first and
removed the toml afterwards, which would have stopped at step one. So the files go in the same
change that adds the new one, and the first plan runs after the next deploy has gone out without
them.

## The steps that remain

1. **Merge the PR and let both services deploy.** Watch both deploys finish in Railway. Without the
   toml files they run on the dashboard's settings. The backend's pre-deploy migration still runs,
   because the dashboard stores the same command: confirm "Schema applied." in the backend's deploy
   log.
2. **Install the Railway CLI, version 5.42.1 or newer** (the IaC engine ships in the CLI, not the npm
   package), then `railway login` and `railway link` from the repo root. Choose project
   `devoted-nurturing` and environment `production`.
3. **`railway config plan`.** Read it before doing anything else. The expected plan is small:
   `trivia_game` gains `start`, `preDeploy`, `healthcheck` and `healthcheckTimeout`;
   `incredible-blessing` gains `start`. Stop and do not apply if it shows **any** of:
   - a `Delete` line, or a destroy count above 0 (the `Postgres` database must never appear);
   - a variable being removed or changed (they are all `preserve()`d, so none should be);
   - an error that a service is still managed by `railway.toml`. If that happens, trigger one fresh
     build of that service (a push, not a redeploy, since a redeploy replays the old snapshot),
     then plan again.
   If it differs from the above, send the plan output back and adjust `.railway/railway.ts` until
   it matches. `--show-values` is not needed and should not be used: the file holds no values.
4. **`railway config apply`**, then confirm the plan once more. Afterwards `railway config plan`
   should say the configuration is already up to date (`--detailed-exit-code` returns 0).
5. **Add the `RAILWAY_TOKEN` repository secret.** Create a project token for the production
   environment in Railway (project Settings, Tokens) and add it under the repo's Settings, Secrets
   and variables, Actions. **Only after step 4 succeeded:** once the secret exists, merging any
   change under `.railway/` applies it automatically ("merging is the approval"), so the first
   apply should be the one a person watched.
6. **Re-check the restart policy** on both services (Settings, Deploy). It is not in the file; see
   below.

## Why this file declares a partial

A Railway IaC file with no `partial` export is read as the whole project, and anything it does not
list is planned for deletion. The project holds three things and the file declares two:

| In the project | In `.railway/railway.ts`? | Managed by |
| --- | --- | --- |
| `trivia_game` (API) | Yes | This file |
| `incredible-blessing` (web app) | Yes | This file |
| `Postgres` (production database) | **No** | The dashboard |

`export const partial = "trivia_game"` limits the file to resources it owns, so it can never delete
the database. **Do not remove that export.** If the plan ever lists a delete for `Postgres`, the
export is missing or was not picked up; stop.

## What the file does not manage

The old toml files also set `restartPolicyType = "ON_FAILURE"`, `restartPolicyMaxRetries = 5` and
`builder = "NIXPACKS"`. The IaC reference has no field for any of them (checked against the SDK's
own types), so they stay as set in each service's Settings page.

- **Restart policy:** `ON_FAILURE` is Railway's default. Only the retry limit of 5 (default 10) is
  non-default. Set it by hand if it matters, and re-check after `railway config pull` in case a later
  SDK manages it.
- **Builder:** the live services already report `RAILPACK`, so the old `NIXPACKS` line was not in
  effect.
- **Variables' values:** the file lists names only and never holds a value.

## What the dashboard has to hold

Checked against the live service before the toml files were removed: the dashboard stores the
backend's pre-deploy command (`npm run db:migrate`), and nothing else from the old files. Start
commands are detected from each `package.json`'s `start` script, which is the same `npm run start`.
The health check path (`/api/health`, timeout 100s) exists only in the old toml and, from now on,
in `.railway/railway.ts`. So a deploy between the merge and the apply runs without a health check,
and Railway marks it live as soon as the process starts. Nothing breaks, and the apply restores it.

## Working with the file afterwards

- **A configuration change is a PR.** Edit `.railway/railway.ts`; the workflow comments the plan on
  the PR, and merging applies it.
- **Add a variable in the dashboard, add its name to the file too**, as `NAME: preserve()`. A name
  that is missing from the file shows up in the next plan as a deletion.
- **Config in code overrides the dashboard.** This was true of the toml files (a dashboard edit to
  the pre-deploy command was silently ignored while one existed) and is true of this file. Change
  the file, not the setting.
- **A redeploy does not run pre-deploy.** Unchanged from before; see `CONTRIBUTING.md`.
- **Check for drift** with `railway config plan --detailed-exit-code` (0 means in step, 2 means
  changes pending).

## If something goes wrong

Before the apply, reverting the merge commit restores both toml files and the old behaviour, which
Railway keeps reading until 2026-12-01. After the apply, revert the PR that changed the file, or
fix forward in a new PR; `railway config plan` always shows exactly what differs.
