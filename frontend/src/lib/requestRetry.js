// A dropped request on a phone is common and usually momentary. Riding out a couple of them
// is the difference between a run that carries on and a run the player has to rescue by hand,
// so transient failures (no response, 5xx, 429) are retried before anything reaches the screen.
// A 4xx is never retried: the server understood and said no, and asking again cannot change it.
const RETRY_DELAYS_MS = [400, 1200];

// Retrying is only worth doing while the player would still rather wait than be told. Past
// this, silence is worse than a message, so whatever went wrong gets reported instead of
// retried again — three hung requests in a row would otherwise mean a minute of "Sending...".
const RETRY_BUDGET_MS = 20000;

export async function withRetries(attempt) {
  const startedAt = Date.now();
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      const spent = Date.now() - startedAt;
      if (!err?.transient || i >= RETRY_DELAYS_MS.length || spent > RETRY_BUDGET_MS) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
    }
  }
}

// What went wrong, in words, and while doing what. `doing` completes the sentence: it reads
// as "The server took too long recording that answer."
export function describeFailure(err, doing) {
  if (err?.code === 'network_unreachable') {
    return err.timedOut ? `The server took too long ${doing}.` : `We couldn't reach the server while ${doing}.`;
  }
  if (err?.status >= 500) return `The server hit an error ${doing}.`;
  if (err?.status === 429) return `The server is busy. It couldn't keep up ${doing}.`;
  return `Something went wrong ${doing}.`;
}
