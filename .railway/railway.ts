import { defineRailway, project, service } from "railway/iac";

// Hand-translated from backend/railway.toml as part of the Config as Code -> Infrastructure
// as Code migration. Railway stops reading railway.toml-style Config as Code files on
// 2026-12-01. backend/railway.toml is intentionally left in place and unmodified for now --
// Railway still reads it for this service's deploys until a human runs `railway config
// apply` from their own machine (this sandbox has no `railway` CLI / auth) and confirms the
// plan. See docs/railway-iac-migration.md for the exact remaining steps, in order.
//
// Project and service names below were confirmed against the real Railway project via the
// Railway API (list-projects / list-services), not guessed: project "devoted-nurturing",
// service "trivia_game" (source repo MFredin/trivia_game, root directory "backend").
// IMPORTANT -- do not remove this export. Without a named partial, Railway treats this file as
// the definition of the WHOLE project and plans to DELETE every service or database it does
// not list. This project also contains the frontend service ("incredible-blessing") and the
// "Postgres" database, neither of which is declared below. With a named partial, this file
// only ever manages (and can only ever delete) resources it owns, and everything else in the
// project is left alone. See docs/railway-iac-migration.md, "Why this file declares a partial".
export const partial = "trivia_game";

export default defineRailway(() => {
  const backend = service("trivia_game", {
    // `source` is deliberately omitted. This service is already linked to the
    // MFredin/trivia_game GitHub repo (branch `main`, root directory `backend`) from the
    // Railway dashboard, and the documented Config-as-Code -> IaC migration path omits
    // `source` in exactly this situation so the file manages build/deploy settings without
    // re-declaring -- and potentially fighting the dashboard over -- the existing repo link.
    // See https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code.

    // railway.toml's [build] section only sets `builder = "NIXPACKS"` (there is no
    // buildCommand to carry over). The documented IaC `build` field is a build *command*
    // string, not a builder-engine selector, and the Infrastructure as Code Reference
    // (https://docs.railway.com/infrastructure-as-code/reference) does not list any
    // builder-engine field on service() -- there is nothing to set here. Worth noting: the
    // live service already reports builder "RAILPACK", not "NIXPACKS", so the dashboard may
    // have already moved past this toml setting on its own. `railway config plan` will show
    // whatever is actually in effect; this is expected, not a sign the translation is wrong.
    start: "npm run start",

    // Runs after the build, before the container starts, on every deploy. schema.sql is
    // entirely CREATE TABLE IF NOT EXISTS, so applying it each time is a no-op once the
    // tables exist and is what stops production drifting behind the repo. It drifted once:
    // the `challenges` table was never created, so the achievements query threw on every
    // completed run and took the player's final answer down with it (see
    // docs/answer-flow.md).
    //
    // Kept here rather than only in Railway's service settings so it survives the service
    // being recreated from this repo. Config in code overrides the dashboard.
    //
    // Note: a REDEPLOY replays the previous deployment's snapshot and does NOT run this.
    // Only a real build does, so a migration needs a push or a fresh build, not a redeploy.
    preDeploy: "npm run db:migrate",

    healthcheck: "/api/health",
    healthcheckTimeout: 100,

    // railway.toml also sets restartPolicyType = "ON_FAILURE" and restartPolicyMaxRetries = 5.
    // The Infrastructure as Code Reference does not list a restart-policy field on
    // service() anywhere -- as of this writing, restart policy is not yet exposed by the
    // TypeScript (or Python/Go) IaC SDK, the same kind of gap the docs call out explicitly
    // for `tracing` ("Not yet supported by the SDKs"). Deliberately NOT guessing a field
    // name here: an invented field would either be silently dropped by the compiler or
    // rejected outright. Until the SDK adds this, restart policy stays set from the
    // service's Settings page in the dashboard (or re-check with `railway config pull`,
    // which will start round-tripping this field once the SDK supports it) and is not
    // managed by this file. `ON_FAILURE` is Railway's own platform default, so not managing
    // it here is not a behavior change by itself -- only the non-default max-retries value
    // (5, vs. the platform default of 10) needs to be reconfirmed by hand after migrating.
  });

  return project("devoted-nurturing", {
    resources: [backend],
  });
});
