# Migrating the backend's Railway config to Infrastructure as Code

Railway is deprecating Config as Code (`railway.toml` / `railway.json`) in favor of
Infrastructure as Code (`.railway/railway.ts`), with a hard cutoff of **2026-12-01** after
which `railway.toml`-style files stop being read. This document covers what has already been
prepared in this repo, and the manual steps a human needs to run from their own machine (or a
properly authenticated CI job) to actually carry out the migration against the live Railway
project. Nothing live was changed to produce this document -- see "What was NOT done" below.

## What's already in the repo

- **`.railway/railway.ts`** -- a hand-authored translation of `backend/railway.toml` into the
  documented TypeScript IaC DSL (`railway/iac`). It targets the real Railway project
  (`devoted-nurturing`) and the real service (`trivia_game`, source repo
  `MFredin/trivia_game`, root directory `backend`), confirmed via the Railway API rather than
  guessed. Read the comments in the file itself -- they carry over the "why" behind
  `preDeployCommand`'s idempotency from the original `railway.toml`, and call out two fields
  (`restartPolicyType`/`restartPolicyMaxRetries`, and the `builder` engine selector) that the
  current IaC TypeScript SDK's types do not yet expose at all (confirmed empirically: the SDK's
  own `IntentServiceConfig` type rejects both as unknown properties under `tsc`). Those two
  settings are **not represented** in `.railway/railway.ts` and need separate attention --
  see "Restart policy and builder are not in the new file" below.
- **`.github/workflows/railway-config.yml`** -- the recommended plan-on-PR / apply-on-merge
  workflow via `railwayapp/config@v1`, scoped to `paths: [".railway/**"]` so it only runs when
  the IaC file changes. It needs a `RAILWAY_TOKEN` repository secret to actually run -- see
  below.
- **`package.json` / `package-lock.json` at the repo root** -- added solely so
  `.railway/railway.ts` type-checks (`railway/iac` needs to resolve to something). This is a
  new root-level `devDependencies`-only package, deliberately separate from
  `backend/package.json` and `frontend/package.json`: it is authoring/CI tooling for the IaC
  file, not a runtime dependency of the deployed app. Verified with:
  ```
  npx tsc --noEmit --moduleResolution bundler --module esnext --target es2022 \
    --esModuleInterop --skipLibCheck .railway/railway.ts
  ```
  which exits clean. (There's no `railway` CLI in this sandbox, so this `tsc` check is the
  closest available substitute for `railway config plan` -- it confirms the file imports and
  type-checks against the real SDK, not that Railway will accept every value.)
- **`backend/railway.toml` is untouched.** Do not delete it and do not clear the service's
  Config File Path setting in the Railway dashboard until *after* `railway config apply` has
  succeeded (step 5 below). Railway still reads `railway.toml` for this service's deploys
  right up until the 2026-12-01 cutoff; removing it (or the dashboard setting pointing to it)
  before the IaC file is actually managing the service would be read by Railway as "no
  config," which is a live-deploy risk.

## What was NOT done (and why)

This sandbox has no `railway` CLI installed and no Railway auth, so `railway config migrate`,
`railway config plan`, and `railway config apply` were not run here -- they can't be. More
importantly, `railway config apply` changes a **real, live, deployed** Railway project, and
that step needs a human reviewing the actual plan diff immediately before confirming it, not
an agent running it unattended. Everything above is prep: a best-effort hand translation for a
human to review and run through the real CLI, not a substitute for that review.

No Railway MCP calls that modify anything were made either -- only read-only lookups
(`list-projects`, `list-services`, `get-service-config`, docs search/fetch) to confirm the
project/service names and the current IaC field reference.

## Restart policy and builder are not in the new file

`backend/railway.toml` sets:
```toml
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```
and
```toml
[build]
builder = "NIXPACKS"
```

Neither has a field in the documented IaC TypeScript reference
(https://docs.railway.com/infrastructure-as-code/reference), and compiling a test file that
sets `restartPolicyType`, `restartPolicyMaxRetries`, or `builder` on `service()` fails under
`tsc` with "does not exist in type ... IntentServiceConfig". This is the same kind of gap the
Railway docs call out explicitly for `tracing` ("Not yet supported by the SDKs") -- the
underlying platform feature exists, but the current SDK doesn't expose it yet.

Practically, this means:

- **Restart policy**: `ON_FAILURE` is Railway's own platform default, so losing this file's
  management of *that part* isn't a behavior change. The non-default part -- `maxRetries: 5`
  instead of the platform default of 10 -- will need to be reconfirmed by hand in the
  service's Settings page after migrating, and periodically rechecked (e.g. after `railway
  config pull`) in case a future SDK version starts managing it.
- **Builder**: there's no `buildCommand` in the current `railway.toml` to carry over either way
  -- it only pins the builder engine. Worth noting: `get-service-config` shows the *live*
  service's builder as `RAILPACK`, not `NIXPACKS`, so the dashboard may have already moved off
  this toml setting on its own, independent of this migration. `railway config plan` will show
  whatever is actually in effect; don't be surprised if it reports no `builder`-related change
  at all, or something unrelated to this file.

If `railway config plan` (step 4 below) shows a way to express either of these that isn't in
the docs as fetched here, trust the CLI's plan output over this document -- it's talking to
the real, current SDK.

## Remaining manual steps (run these yourself, in order)

These need the real `railway` CLI, authenticated against the real account, which this sandbox
doesn't have. Run them from your own machine or a CI job that has both.

1. **Install the Railway CLI** (if you don't already have it) --
   see https://docs.railway.com/guides/cli for the current install command for your platform.

2. **`railway login`** -- authenticate the CLI to your Railway account.

3. **`railway link`** -- link the CLI to the correct project and environment. You want
   project **`devoted-nurturing`**, service **`trivia_game`**, environment **`production`**
   (these are the real names, confirmed via the Railway API while preparing this migration --
   not placeholders). Run this from the repo root, since that's where `.railway/railway.ts`
   lives.

4. **`railway config plan`** -- preview the plan against the `.railway/railway.ts` drafted
   here. Expect some differences from this hand-translation -- that's normal and fine; this
   file was written by reading the docs and the live service config, not by running the real
   planner. In particular, expect it to say something about `builder`/`restartPolicy` (see
   above) and possibly about `source` (this file deliberately omits `source` since the service
   is already linked via the dashboard -- confirm the plan doesn't try to unlink or relink it).
   Review the full diff carefully. Adjust `.railway/railway.ts` and re-run `plan` until the
   diff is exactly what you intend.

5. **`railway config apply`** -- only once the plan from step 4 looks right. **This changes
   live infrastructure for the deployed backend.** Read the plan output one more time
   immediately before confirming. Do this during a window where a brief service hiccup (if any
   setting change triggers a redeploy) is acceptable.

6. **Clear the Config File path** in the Railway dashboard's service settings (Settings ->
   Config as Code, on the `trivia_game` service), so Railway stops reading
   `backend/railway.toml` and relies on `.railway/railway.ts` going forward. Only do this after
   step 5 has succeeded -- clearing it first, or deleting the toml file first, risks Railway
   reading "no config" for a deploy in between.

7. **Optionally delete `backend/railway.toml`** once step 6 is done and you've confirmed a
   normal deploy still works end to end. It's no longer required at that point, but there's no
   urgency -- Railway won't read it anymore once the Config File path is cleared, and it does
   no harm sitting unused in the repo until you get to it.

8. **Add the `RAILWAY_TOKEN` repository secret** (GitHub repo Settings -> Secrets and
   variables -> Actions) so `.github/workflows/railway-config.yml` can run on future PRs that
   touch `.railway/**`. This needs to be a Railway **project token** scoped to the
   `devoted-nurturing` project's `production` environment. Only you can create this (it's tied
   to your Railway account) -- generate it from the Railway dashboard under the project's
   Settings -> Tokens, or with `railway login` + the project linked, however the CLI/dashboard
   currently exposes project tokens. Until this secret exists, both jobs in the workflow will
   fail when triggered; that's expected and not a sign anything else is broken.

After step 8, the loop is closed: a future change to `.railway/railway.ts` gets a `plan`
comment-equivalent on its PR (via the `railwayapp/config@v1` action) and an automatic `apply`
once that PR merges to `main` -- consistent with this repo's "`main` is deployed" rule in
`CLAUDE.md`.
