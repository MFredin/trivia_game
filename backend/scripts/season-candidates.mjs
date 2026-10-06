#!/usr/bin/env node
/**
 * Proposes which existing questions might belong to each season, by keyword. It REPORTS and never edits: a keyword scan
 * has false positives (a question that merely says "feast" is not a Halloween question), so a person confirms each one
 * and adds `"themes": ["halloween"]` to it in the bank JSON. See docs/seasonal-content-plan.md.
 *
 * Usage: node backend/scripts/season-candidates.mjs [season] [path-to-json]
 *   season       halloween | yule (default: both)
 *   path-to-json defaults to backend/src/data/question-bank-full-draft.json
 * Already-tagged questions are marked, so the report doubles as a progress view.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const file = process.argv[3] || path.join(__dirname, '..', 'src', 'data', 'question-bank-full-draft.json');
const questions = JSON.parse(readFileSync(file, 'utf-8')).questions;

// Plain literals, as in question-bank-audit.mjs: this is a throwaway authoring aid, not part of the app's module graph.
const KEYWORDS = {
  halloween: ['halloween', 'pumpkin', 'deathday', 'death day', 'nearly headless', 'mountain troll', 'troll', 'all hallows', 'samhain', 'jack-o', 'ghost', 'feast'],
  yule: ['christmas', 'yule', 'mistletoe', 'snow', 'holiday', 'jumper', 'sweater', 'tinsel', 'present', 'gift', 'winter'],
};

for (const [theme, words] of Object.entries(KEYWORDS)) {
  if (only && only !== theme) continue;
  const hits = questions.filter((q) => {
    const text = `${q.question_text} ${q.correct_answer} ${q.explanation ?? ''}`.toLowerCase();
    return words.some((w) => text.includes(w));
  });
  const tagged = hits.filter((q) => (q.themes ?? []).includes(theme)).length;
  console.log(`\n=== ${theme}: ${hits.length} keyword matches, ${tagged} already tagged ===`);
  for (const q of hits) {
    const mark = (q.themes ?? []).includes(theme) ? '[x]' : '[ ]';
    console.log(`${mark} ${q.id} | ${q.obscurity_tier} | ${q.question_text} -> ${q.correct_answer}`);
  }
}
