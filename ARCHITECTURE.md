# Architecture

How this repo is laid out, and the rules that decide where new code goes. These are not
aspirations — they are the rules the codebase follows today, and a change that breaks one
should either fix the code or change this document, not quietly diverge.

## The rule: one feature, one file

A feature owns a file at every layer it touches. A screen brings its own component, its own
stylesheet, its own API module and its own hook; a resource brings its own route file and its
own service. Nothing is appended to a shared file that every feature also appends to.

This is not tidiness for its own sake. The repo learned it the expensive way: one 2,375-line
`global.css` that every feature appended to caused merge conflicts on three of four Phase 6
features, and one of those resolutions silently cut through a `@media` block and shipped an
unparseable stylesheet. A shared append-target is a guaranteed conflict and an invitation to
resolve it wrong.

The test for "is this a feature": would it ship, or be reverted, on its own? Lifelines are a
feature. A button is not.

### What this buys

- Two features in flight touch disjoint files, so they do not conflict.
- A feature can be reverted by deleting its files and one import line.
- The file tree is the feature list. Finding the code for a thing does not require grep.

### Where the shared files still are, and why

Three files are legitimately shared, and each is an *index* rather than an append-target — new
entries are one line, and two features adding entries conflict on adjacent lines at worst:

| File | Holds |
|---|---|
| `frontend/src/styles/index.css` | The `@import` list, in cascade order |
| `frontend/src/App.jsx` | Screen routing and composition of the feature hooks |
| `backend/src/app.js` | The `app.use('/api/...', router)` mounts |

`frontend/src/styles/tokens.css` is also shared, deliberately: it is the design system's single
source of colour, and a token redefined per feature is how a design system dies.

## Frontend

```
frontend/src/
  api/              one module per resource; request.js holds the shared fetch core
  components/       one component per file, presentational where it can be
  features/         one directory per feature: its hook, and anything only it uses
  constants/        shared values with no behaviour
  hooks/            hooks used by more than one feature
  lib/              pure helpers, no React
  styles/
    index.css       the @import list, in cascade order
    tokens.css      design tokens, per house binding
    parts/          one stylesheet per feature
  scripts/          audits that run in CI
```

**State lives in a feature hook, not in `App.jsx`.** `App.jsx` composes hooks and routes
screens. It does not hold a feature's state. Before this rule, it held 30-plus `useState` calls
across auth, the run, duels, the leaderboard and navigation, and carried **four** hand-written
copies of the same fourteen-line "reset the run" block — one each for starting a run, starting
a challenge, accepting a duel, and a duel starting over the socket. Any of the four could drift
from the others, and a new piece of run state had to be remembered in all four.

A feature hook owns its own state and returns a small API. When one feature needs another, it
takes a callback rather than reaching into its state — `useDuels` calls `run.begin(...)`, it
does not set the run's fifteen pieces of state itself.

**A component gets its data through props.** A component that fetches its own data cannot be
rendered anywhere else, and cannot be tested without a server.

**Screens not on the path to playing a quiz are lazily imported.** The shell, the entry screens
and the run itself load eagerly; everything else is `lazy()` with its own `<Suspense>` boundary,
so a chunk in flight cannot blank the nav or a run in progress.

## Backend

```
backend/src/
  routes/       one file per resource; HTTP in, HTTP out
  services/     logic that spans more than one query, or that a route should not inline
  lib/          pure functions: scoring, tokens, selection rules
  repo/         data access that is cached or shared
  middleware/   auth and rate limiting
  db/           schema.sql, migrate, seed
```

**Routes are thin.** A route parses the request, calls a service or a lib, and shapes the
response. Business rules — what scores what, which question comes next, when an achievement
unlocks — live in `lib/` or `services/` where they can be unit-tested without HTTP.

**Auth is on the router where every route needs it.** `router.use(requireAuth)` states the rule
once; per-route middleware is for routers with a genuinely mixed public and private surface.

**Every route that names a resource by id proves ownership.** Not because an id is guessable,
but because an id is not a credential. A resource that exists but is not yours returns the same
404 as one that does not exist, so the endpoint cannot be used to discover which ids are real.

**The schema is append-only and idempotent.** `schema.sql` is replayed on every deploy, so
changes are `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` rather than edits to a
`CREATE TABLE` that no-ops on an existing table.

## Anti-cheat boundary

The client is handed a shuffled list of answers and never told which is right. Everything that
would reveal it stays on the server: which choices a 50-50 hides, what an answer scores, when a
question was issued. A per-question token signed with the session id and issue time is what
makes an answer attributable to one question at one moment. Nothing in a feature may move a
decision across that line for convenience.

See [`docs/anti-cheat-architecture.md`](docs/anti-cheat-architecture.md).
