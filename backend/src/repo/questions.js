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
