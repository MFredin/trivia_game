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
