# Code and screen-size audit — October 2026

Requested after the Owl Post thread was found to grow the page without limit: check that nothing overflows on
phones (iOS and Android browsers) or desktop, and review the code for cleanliness, comments and best practice.
Findings that were fixed are in the commits named below; findings that were **not** fixed are listed with the reason,
as CONTRIBUTING asks.

## How it was done

- A new browser test, `frontend/e2e/overflow-matrix.test.mjs`, walks the whole app at eleven widths (320–1920 px) with
  worst-case content. See [`compatibility.md`](../compatibility.md).
- ESLint was added to both packages (the repo had none). Backend: recommended rules. Frontend: recommended rules plus
  React's `rules-of-hooks` and `exhaustive-deps`. Both run in CI.
- `npm audit` for both packages; greps for risky patterns (template-literal SQL, `innerHTML`, `eval`, unguarded
  `localStorage`, `console.log`); a read of the app setup, error handling, auth, rate-limiting coverage and the
  routes that name a resource by id.
- Every file that began with no comment (14 backend, 41 frontend) was read and given a header saying what it is for.
  Each claim was checked against the code, which corrected two of them before they were committed.

## Found and fixed

| Finding | Why it mattered | Where |
|---|---|---|
| Owl Post thread was an unbounded list | Every message lengthened the page; the composer sank out of reach | `OwlThread.jsx`, `useFillViewport.js` |
| **A failing async route ended the whole process** | 79 of 82 routes are `async`; Express 4 ignores a rejected promise, and Node 22 ends the process on an unhandled rejection. One database error in a route without its own try/catch would take the service down, and Railway stops restarting after five tries | `lib/asyncErrors.js`, `lib/errors.js` |
| No JSON error handling | Malformed JSON, oversized bodies and unknown API paths answered with HTML (and a stack in development) | `lib/errors.js` |
| Idle database connection errors unhandled | A database restart emits `error` on the pool; with no listener that is an uncaught exception | `db/pool.js` |
| No graceful shutdown | A deploy's SIGTERM cut requests off mid-answer | `index.js` |
| Three duel routes answered 403 to outsiders | Confirms a duel id exists, against the project's own 404 rule | `routes/duels.js` |
| Malformed ids in URLs reached Postgres | A 500 for what is really "no such thing" (duels, runs, suggestions) | `lib/uuid.js` |
| Dialog 440px wide on a 390px phone; a tall dialog lost its top edge | Content cut off at both edges, with nothing to scroll to | `modal.css` |
| Long names widened the page | Home, My profile, Owl Post inbox, Community, report queue (`break-word` does not let text shrink inside a flex row; `anywhere` does) | several `*.css` |
| Every text field under 16px | iOS Safari zooms the page in on focus and does not zoom back | `a11y.css` |
| Tables, segmented controls and the save bar overflowed at 200% text | WCAG reflow | `TableScroll.jsx`, `start.css`, `avatar-designer.css` |
| API had no security headers; frontend host had no headers or caching | `nosniff`, deny-all CSP on the JSON API; `nosniff`, referrer policy, frame denial and long-lived caching for hashed assets on the static host | `lib/securityHeaders.js`, `frontend/public/serve.json` |
| No cap on authenticated writes | A script could flood friend requests, suggestions or runs | `lib/writeLimit.js` (600 a minute per player) |
| `localStorage` unguarded in `useAuth` | Safari with storage blocked throws on access, which would take the app down on load | `lib/storage.js` |
| `npm audit`: `qs` (moderate) in the backend; `fast-uri` (high) in the frontend | Dependency advisories | `npm audit fix`, lockfiles |
| Stale docs | CONTRIBUTING pointed at a script that does not exist and at the removed footer build stamp | `CONTRIBUTING.md` |
| Toast not announced | `AchievementToast` was a bare `div` | `role="status"` |
| Lint findings | An unused prop, an unused import, a useless assignment, stale-closure risks in two callbacks | various |

## Found and not fixed

| Finding | Why not |
|---|---|
| `npm audit`: esbuild/Vite dev-server advisory | Dev tooling only (it concerns the Vite dev server); production serves static files. The fix is Vite 8, a breaking upgrade that deserves its own change |
| No Content-Security-Policy on the frontend | A correct one must name the production API and WebSocket origin, Sentry's ingest host and Google Fonts, and a wrong one blanks the app. Worth doing against the real deployment, with a report-only period first |
| Postgres connection does not verify its certificate in production | Railway's private network gives no CA to verify against; documented in `db/pool.js`. Revisit if the database moves |
| In-memory rate limiter, caches and presence | Correct for one instance, wrong for several. Already stated in the code; needs Redis before scaling out |
| Several components fetch their own data (`FriendsPanel`, `SuggestQuestionScreen`, …) | ARCHITECTURE says data arrives through props. Moving them to hooks is a refactor in its own right (`FriendsPanel` is 450 lines), not something to fold into an audit |
| `App.jsx` is 700 lines | It composes the hooks as intended; its size is the number of screens. Splitting the routing out is possible but not urgent |
| The newer `eslint-plugin-react-hooks` "compiler" rules (state set in effects, refs in render) | They disagree with patterns used on purpose (resetting a draft when a screen opens). Adopt them together with the React compiler, if ever |
| `eslint-plugin-react` | Does not yet support ESLint 10; the one thing needed from it (JSX counts as use) is handled by an ignore pattern |
| No formatter enforced | The code follows one style by convention; adding Prettier would rewrite most files in one noisy commit. Do it as its own change if wanted |
| The "suggest a question" screen is not in the width sweep | It is reached through the Marauder's Map easter egg, which the test cannot trigger cleanly |
| **WebKit and real devices were not tested** | This environment has Chromium only. The sweep reproduces iOS's rules (16px zoom, shrink-to-fit, viewport units) but not its engine, keyboard or address bar. Do a ten-minute pass on a real iPhone and Android phone before relying on it — see `compatibility.md` |

## Re-running it

```
cd backend  && npm run lint && npm test
cd frontend && npm run lint && npm run build && npm run audit
cd frontend && DATABASE_URL=… E2E_BASE_URL=… node --test e2e/overflow-matrix.test.mjs
```
