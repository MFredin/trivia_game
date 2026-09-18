# The answer flow, and the dead run it used to produce

A player reported that Classic Quiz would reach its last question and then refuse to go
anywhere: the four answers looked completely normal, tapping them did nothing, and the
summary never came. This is what was wrong and what the flow looks like now.

## What made the run unrecoverable

`handleSubmit` caught a failed answer submission and wrote the message into `startError`.
That state is handed to exactly one component, `StartScreen`, which only renders on the
start screen. During a run it is not on the page at all.

So a failed answer produced no error, no result panel and no summary. `feedback` stayed
null, which meant the choices stayed enabled and undimmed — they looked live because
nothing had told them otherwise. Every further tap fired another request that failed the
same silent way.

Two failure shapes, both reproduced against the production bundle on a phone viewport:

| Shape | What the server sees | What the player got |
|---|---|---|
| Request never arrives | nothing | frozen run, no message |
| Response is lost in flight | the answer lands, the run completes | frozen run, and the finished run is on the leaderboard without them ever seeing it |

The second is why the last question was where it bit. A lost response there means the
session is already `completed`, so every retry returns 409 and dies just as quietly.

## The clock was making that failure likelier

`POST /sessions/:id/answer` used to serve the *next* question in the same response, and
`serveQuestion` stamps `issued_at` at serve time. The next question's countdown therefore
started the instant you submitted the previous answer, and every second spent reading the
explanation came out of it.

Measured at eight seconds of reading per explanation, before the change:

| Question | Clock when the player first sees it |
|---|---|
| 1 | 0:19 |
| 2 and after | 0:10 |

Read one explanation for more than about nineteen seconds and the next question arrived
already expired, which fired an automatic timeout submission the moment it appeared. On a
phone that is a normal amount of reading.

## The flow now

1. `POST /sessions/:id/answer` scores the answer and reports `session_complete`. It no
   longer serves anything, and no longer returns a `next` object.
2. `POST /sessions/:id/next` hands over the next question and is what starts its clock. The
   client calls it when the player dismisses the result, not before.

`/next` is idempotent by design. If the session already has a served, unanswered question it
comes back unchanged, keeping its original `issued_at`. Asking twice can never buy a fresh
twenty seconds, so the call is safe to retry after a dropped response.

The timeout test also carries `TIMEOUT_GRACE_MS` (1.5s) of slack, covering the handover
round trip and the page-turn animation, so an answer that was on time on the player's own
dial is not scored as a timeout. It only widens the timeout test; the speed bonus already
clamps at zero remaining time.

After the change, every question starts at 0:19 no matter how long the previous explanation
was read.

## What the player sees when something fails now

- A panel on the question screen saying what happened, with **Try again** and **Leave this
  run**.
- A "Sending your answer…" line while a submission is in flight, because a slow connection
  used to be indistinguishable from a dead button.
- On a 409, automatic recovery instead of a dead end: the client reads the session, and
  either goes to the summary if the run is already complete, or picks up the next question
  if it is still going.

The summary no longer depends on the leaderboard loading, either. That fetch is a courtesy
and its failure must never be what stands between a finished run and its result.

## Two smaller correctness fixes that came with it

- The submit lock is a ref, not state. The countdown's own timeout submission fires from a
  closure captured before a state update commits, and sailed straight past a `submitting`
  state check.
- `QuestionCard` reads `onSubmit` through a ref so the countdown effect no longer lists it
  as a dependency. It used to, and since the parent rebuilt that function on every render,
  the effect tore itself down constantly — clearing `hasTimedOutRef`, the one guard against
  a second timeout submission for the same question. `handleSubmit` is also wrapped in
  `useCallback` now.

## Modes

All five were re-checked end to end through the two-step flow.

| Mode | Timing | Result |
|---|---|---|
| classic | per question | 10 answers, completes |
| daily | per question | 10 answers, completes |
| survival | per question | ends on the first miss |
| gauntlet | per question | ends on the third miss |
| blitz | session total | runs on until the shared clock expires |

Blitz is the one mode the extra round trip costs anything, since it races a single 60-second
budget. Its per-question `issued_at` is irrelevant there, so pre-serving would be safe for
Blitz alone, but it is not worth a second code path unless the latency proves to matter.

## Follow-up: the failure the error panel exposed

Once failed answers became visible, one showed up on the last question of a real run with
eleven seconds still on the clock. The panel had done its job; the underlying failure was
still there.

The completion bookkeeping ran **before** the response was sent:

```
UPDATE game_sessions ... status = 'completed'   <- the run is over, score recorded
invalidateLeaderboardCache()
await evaluateAchievements(...)                 <- ~10 queries + WebSocket sends
await recordActivity('personal_best', ...)
await maybeFinishDuel(...)
res.json(...)                                   <- only now does the player hear anything
```

A throw anywhere in that block returned 500 for an answer that was already written against a
session already marked `completed`. Confirmed by injecting a fault into
`evaluateAchievements`:

| | Before | After |
|---|---|---|
| Final answer | HTTP 500 | HTTP 200 |
| Session row | `completed`, score recorded | `completed`, score recorded |
| Retrying that answer | 409 `session_not_active` | not needed |
| Player sees | an error on a run that actually finished | the summary |

The response is now sent as soon as the answer and the session row are settled. The
bookkeeping runs after, in its own catch, and a failure is logged rather than thrown at the
player. Nothing is lost by deferring it: achievements recompute their aggregates from scratch
on the next completion, so a miss heals itself.

This was never a recent regression. No backend file changed on `main` in the day before the
report; the design overhaul was frontend-only. The coupling dates to the achievements work
(2026-09-11) and the activity feed (2026-09-14), and was simply invisible until failed
answers started being shown.

### Client hardening that came with it

- **Transient failures are retried** (two backoffs, 400ms and 1200ms) before anything reaches
  the screen, within a 20 second budget so a hung request cannot leave "Sending..." up for a
  minute. A 4xx is never retried; the server understood and said no.
- **Requests carry a 15 second timeout.** Without one, a request that never settles leaves the
  caller stuck forever with no way to tell that from a slow one.
- **Errors say what actually happened.** The client used to call `res.json()` straight away, so
  a proxy's HTML 502 threw a parse error that hid the status behind "we couldn't reach the
  server". The body is now read as text first, and the message distinguishes an unreachable
  server, a timeout, a 5xx and a 429.

Verified against four injected failures on the final answer:

| Injected | Result |
|---|---|
| One dropped request | absorbed by the retry, no error shown, run continues |
| Three dropped requests | "We couldn't reach the server while recording that answer." |
| Three HTTP 500s | "The server hit an error recording that answer." |
| Three HTML 502s | same, correctly read as a server error rather than a parse crash |

In every case Try again reached the result and the run completed.
