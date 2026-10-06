import { defineRailway, github, preserve, project, service } from "railway/iac";

// Railway stops reading railway.toml-style Config as Code files on 2026-12-01. This file replaces
// backend/railway.toml and frontend/railway.toml, which were removed in the same change. The
// runbook, and the order the steps have to run in, is docs/railway-iac-migration.md.
//
// Names below match the live project: project "devoted-nurturing", services "trivia_game" (the
// API, root directory `backend`) and "incredible-blessing" (the web app, root directory
// `frontend`). The Postgres database in the same project is deliberately NOT declared.

// IMPORTANT -- do not remove this export. Without a named partial, Railway treats this file as the
// definition of the WHOLE project and plans to DELETE every service or database it does not list,
// and the "Postgres" database is not listed. With a named partial the file can only ever change or
// delete resources it owns. See docs/railway-iac-migration.md, "Why this file declares a partial".
export const partial = "trivia_game";

export default defineRailway(() => {
  const backend = service("trivia_game", {
    // `source` MUST be declared, with exactly the values the dashboard already has. The docs say a
    // migrated file may omit it, but the CLI's plan reads an omitted `source` as "remove it": the
    // first real plan showed source.repo, source.rootDirectory and source.type all going to null,
    // which would have disconnected both services from GitHub and ended auto-deploys. Declared
    // like this, the plan shows no source changes. If a plan ever lists a `source.*` line, do not
    // apply it.
    source: github("MFredin/trivia_game", { branch: "main", rootDirectory: "backend" }),
    start: "npm run start",

    // Runs after the build and before the container starts, on every real build. schema.sql is
    // entirely CREATE ... IF NOT EXISTS, so applying it each time is a no-op once the tables exist,
    // and it is what stops production drifting behind the repo. It drifted once: the `challenges`
    // table was never created, so the achievements query threw on every completed run and took the
    // player's final answer down with it (see docs/answer-flow.md).
    //
    // A REDEPLOY replays the previous deployment's snapshot and does NOT run this. Only a fresh
    // build does, so a missed migration needs a push, not a redeploy.
    preDeploy: "npm run db:migrate",

    healthcheck: "/api/health",
    healthcheckTimeout: 100,

    // The retry limit the old railway.toml set (restartPolicyMaxRetries = 5), kept at the value the
    // service has today. It must be declared: the first plan after the apply proposed 5 -> null on
    // both services, because a field the file leaves out is read as "unset it". The restart policy
    // TYPE is not declared; the live value is unset (Railway's default, ON_FAILURE), and declaring
    // it would show up as a change. This nested `deploy` block merges with the shorthand fields
    // above (the SDK spreads it first and lets the shorthand win), so the two do not conflict.
    deploy: { restartPolicyMaxRetries: 5 },

    // Every variable that exists today, kept as it is. `preserve()` means "keep whatever value is
    // already set in Railway", so no value is written into the repo and a plan cannot propose
    // deleting one. These are NAMES only; the file never held, and must never hold, a value.
    // When a variable is added in the dashboard, add its name here too, or the next plan will
    // show it as a deletion.
    env: {
      AUTH_TOKEN_SECRET: preserve(),
      DATABASE_URL: preserve(),
      GITHUB_FEEDBACK_REPO: preserve(),
      GITHUB_FEEDBACK_TOKEN: preserve(),
      NODE_ENV: preserve(),
      QUESTION_TOKEN_SECRET: preserve(),
    },
  });

  const frontend = service("incredible-blessing", {
    // Declared for the same reason as the backend's. Note the leading slash: it is how this
    // service's root directory is stored in Railway, and the plan compares the strings exactly.
    source: github("MFredin/trivia_game", { branch: "main", rootDirectory: "/frontend" }),

    // The static build is served by `serve`; the start script is defined in frontend/package.json.
    start: "npm run start",

    // Same retry limit as the backend, for the same reason.
    deploy: { restartPolicyMaxRetries: 5 },

    // The API's public URL, baked into the bundle at build time.
    env: {
      VITE_API_URL: preserve(),
    },
  });

  // Not expressible yet: the builder. The old files set `builder = "NIXPACKS"` and the IaC reference
  // has no field for it. The live builder already reports RAILPACK, so the old setting was not in
  // effect. (The restart policy WAS expressible, in the nested `deploy` block, which an earlier
  // version of this comment wrongly said it was not: only the top-level shorthand was tried.)

  return project("devoted-nurturing", {
    resources: [backend, frontend],
  });
});
