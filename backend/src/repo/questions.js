// The question bank, read once and kept in memory. The bank changes only when a player's suggestion is approved
// (which calls invalidateQuestionCache) or when it is re-seeded and the server restarted, and every run needs it, so
// reading it from the database for each request would be pure cost. The cache is per process: with more than one
// server instance each would need to be told to invalidate.

import { pool } from '../db/pool.js';

let cache = null;

export async function getAllQuestions() {
  if (!cache) {
    const { rows } = await pool.query('SELECT * FROM questions');
    cache = rows;
  }
  return cache;
}

export function invalidateQuestionCache() {
  cache = null;
}
