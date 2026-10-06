export const MODES = {
  // timingMode 'per_question': time_limit_ms is a countdown per question, restarting each serve.
  // timingMode 'session_total': time_limit_ms is a single countdown for the whole run, measured
  // from session creation; once it's up, the in-flight answer is scored as a timeout and the run ends.
  // maxStrikes: null means wrong answers never end the run early; a number ends the run once that
  // many wrong/timed-out answers have accumulated.
  classic: { questionCount: 10, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: null },
  daily: { questionCount: 10, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: null },
  blitz: { questionCount: 300, timeLimitMs: 60000, timingMode: 'session_total', maxStrikes: null },
  survival: { questionCount: 300, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: 1 },
  gauntlet: { questionCount: 300, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: 3 },
  duel: { questionCount: 10, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: null },
  // Every private challenge link runs at Classic's fixed time limit; questionCount here is
  // only the default — a challenge's own row can override it (see routes/challenges.js).
  challenge: { questionCount: 10, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: null },
  // A tournament match: ten questions, seeded from the match so both players see the same set. Not ranked anywhere public.
  tournament: { questionCount: 10, timeLimitMs: 30000, timingMode: 'per_question', maxStrikes: null },
};

// Modes whose runs never appear on a public leaderboard, however it is asked for. A tournament match is for the two
// people in it, so its scores are shown inside the tournament and nowhere else.
export const UNRANKED_MODES = ['tournament'];

// The lengths a challenge creator can pick between. Kept short and round rather than letting
// the length run free, the same way category/difficulty are a fixed menu, not free text.
export const CHALLENGE_QUESTION_COUNT_OPTIONS = [10, 15, 25, 30];
