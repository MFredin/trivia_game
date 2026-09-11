# Score Integrity & Anti-Cheat — Phase 1 Design

## The core rule
**The client never computes a score. It only submits an answer.** Every point on the leaderboard is calculated server-side from data the server itself generated and timestamped. If this rule is followed strictly, most cheap cheating (editing JS variables, replaying network requests, scripting fast answers) stops working by construction.

## Flow
1. **Session start**: server creates a `game_session` (id, user_id, mode, category/difficulty/canon filters) and selects the question set server-side. Nothing about correct answers ever leaves the server at this point.
2. **Serving a question**: server sends only: question text, the (server-shuffled) answer choices, and a signed **question token** — an HMAC over `{session_id, question_id, issued_at}` using a server-held secret. The token is opaque to the client.
3. **Client answers**: submits `{session_id, question_id, chosen_index, token}`. It may also send its own elapsed-time reading, but that's for UI display only — **never trusted for scoring**.
4. **Server validates on receipt**:
   - Token signature is valid and matches this session/question (prevents forged or replayed submissions).
   - Token hasn't already been redeemed (prevents answering the same question twice for double points).
   - `now - issued_at` is within the mode's time limit (server clock only — a modified client claiming "I answered in 0.2s" is irrelevant; the server's own receipt time is truth).
   - Looks up the correct answer server-side and compares.
5. **Server computes and stores the score** (base points by difficulty tier + canon-source rarity + streak multiplier + time-remaining bonus, all using server-held config, not anything the client sent).

## Why this closes the obvious holes
- **Can't edit score in devtools** — score is never client-computed or client-submitted.
- **Can't scrape the answer key** — the client only ever receives the current question's choices, never the full bank or an answer field.
- **Can't replay a fast "correct" response** — tokens are single-use and session/question-bound.
- **Can't fake speed bonuses** — timing is measured from server receipt against the server-issued token timestamp, not from anything the client reports.

## What this doesn't fully solve — and the second layer
A determined cheater can still automate *legitimate* requests (a bot that fetches the question, looks up the answer in a scraped copy of Wikipedia/fan wikis, and submits fast). No token scheme stops "a very fast correct answer submitted through the real API." For that, add lightweight anomaly detection rather than trying to make it impossible:

- Flag sessions with implausible patterns: perfect accuracy at the hardest tier combined with near-minimum response times across an entire run, identical timing fingerprints across "different" accounts, or many accounts from one IP/device in a short window.
- **Shadow-flag, don't auto-ban**: flagged runs are excluded from public leaderboards pending a quick manual look, rather than instantly penalizing a legitimately fast, knowledgeable player (false positives are a real risk with any pure speed-based heuristic).
- Reserve stronger friction (e.g. a re-auth or challenge step) for score submissions that would newly qualify for a top-N leaderboard spot — most players never hit that path, so it doesn't add friction to casual play.

## Minimal implementation sketch (Express-style pseudocode)
```js
// POST /session/:id/answer
app.post('/session/:id/answer', async (req, res) => {
  const { question_id, chosen_index, token } = req.body;
  const session = await getSession(req.params.id);

  const payload = verifyHmac(token, SERVER_SECRET); // throws if invalid/tampered
  if (payload.session_id !== session.id || payload.question_id !== question_id) {
    return res.status(400).json({ error: 'token_mismatch' });
  }
  if (await tokenAlreadyRedeemed(token)) {
    return res.status(409).json({ error: 'already_answered' });
  }

  const elapsedMs = Date.now() - payload.issued_at; // server clock, not client-reported
  if (elapsedMs > session.mode.timeLimitMs) {
    return recordTimeout(session, question_id);
  }

  const question = await getQuestionWithAnswer(question_id); // server-only field
  const correct = chosen_index === question.correct_index;

  const points = computeScore({ correct, elapsedMs, tier: question.tier, streak: session.streak });
  await recordAnswer(session, question_id, { correct, points, token });
  return res.json({ correct, points, running_total: session.total + points });
});
```

## Phase 1 vs. later phases
This full design (tokens + server scoring + basic anomaly flags) is scoped as a **Phase 1 requirement**, not a nice-to-have — it's cheap to build correctly from the start and expensive to retrofit once a leaderboard already has disputed scores on it. The heavier anomaly-detection tooling (device fingerprinting, ML-based pattern detection) is reasonable to defer to Phase 2 once you can see what real cheating attempts (if any) actually look like on your traffic.
