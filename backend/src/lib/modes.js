export const MODES = {
  // timingMode 'per_question': time_limit_ms is a countdown per question, restarting each serve.
  // timingMode 'session_total': time_limit_ms is a single countdown for the whole run, measured
  // from session creation; once it's up, the in-flight answer is scored as a timeout and the run ends.
  classic: { questionCount: 10, timeLimitMs: 20000, timingMode: 'per_question', endOnFirstMiss: false },
  daily: { questionCount: 10, timeLimitMs: 20000, timingMode: 'per_question', endOnFirstMiss: false },
  blitz: { questionCount: 300, timeLimitMs: 60000, timingMode: 'session_total', endOnFirstMiss: false },
  survival: { questionCount: 300, timeLimitMs: 20000, timingMode: 'per_question', endOnFirstMiss: true },
};
