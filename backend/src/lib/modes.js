export const MODES = {
  // timingMode 'per_question': time_limit_ms is a countdown per question, restarting each serve.
  // timingMode 'session_total': time_limit_ms is a single countdown for the whole run, measured
  // from session creation; once it's up, the in-flight answer is scored as a timeout and the run ends.
  // maxStrikes: null means wrong answers never end the run early; a number ends the run once that
  // many wrong/timed-out answers have accumulated.
  classic: { questionCount: 10, timeLimitMs: 20000, timingMode: 'per_question', maxStrikes: null },
  daily: { questionCount: 10, timeLimitMs: 20000, timingMode: 'per_question', maxStrikes: null },
  blitz: { questionCount: 300, timeLimitMs: 60000, timingMode: 'session_total', maxStrikes: null },
  survival: { questionCount: 300, timeLimitMs: 20000, timingMode: 'per_question', maxStrikes: 1 },
  gauntlet: { questionCount: 300, timeLimitMs: 20000, timingMode: 'per_question', maxStrikes: 3 },
  duel: { questionCount: 10, timeLimitMs: 20000, timingMode: 'per_question', maxStrikes: null },
  // Every private challenge link runs at Classic's fixed config — no per-challenge
  // customization, kept deliberately simple (see docs/phase5-scaffold.md §1).
  challenge: { questionCount: 10, timeLimitMs: 20000, timingMode: 'per_question', maxStrikes: null },
};
