#!/usr/bin/env node
/**
 * Mechanical quality checks for a question-bank JSON file (the shape seed.js reads:
 * { questions: [...] }, one object per row of the `questions` table — see schema.sql).
 *
 * Catches what should never need a human eye:
 *   - exact-duplicate question_text (normalized: lowercased, punctuation stripped, whitespace
 *     collapsed), anywhere in the bank, including across categories
 *   - correct_answer also present among that question's own distractors
 *   - malformed shape: missing/empty required fields, distractors.length !== 3, duplicate
 *     distractors within one question, obscurity_tier/design_tier/canon_tags values outside
 *     the enums this repo actually uses (see lib/difficultyTiers.js, lib/designTiers.js, and
 *     the per-question canon_tags values featuredChallenge.js checks for)
 *   - duplicate ids
 *
 * Deliberately conservative — it reports, it does not edit the file. Near-duplicate wording
 * (same topic, different question) is common and expected in a bank built from templated
 * question families ("which house's mascot is X" x4), so this script does not try to flag
 * that; a jaccard-similarity pass on this bank's actual content produced only false positives
 * and was dropped rather than shipped as a check nobody should trust.
 *
 * Judgment calls this script cannot make — factual correctness, ambiguous phrasing, whether a
 * correct_answer actually answers the question it's attached to — are a human (or a careful
 * read against canon) problem; see docs/question-bank-audit-2026-10.md for that pass.
 *
 * Usage: node backend/scripts/question-bank-audit.mjs [path-to-json] [out.json]
 *   path-to-json defaults to backend/src/data/question-bank-full-draft.json
 *   out.json     defaults to /tmp/question-bank-audit-out.json (full detail dump)
 * Exit code is 0 either way: this is a report to read, not a gate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultInput = path.join(__dirname, '..', 'src', 'data', 'question-bank-full-draft.json');

const inputPath = process.argv[2] || defaultInput;
const outPath = process.argv[3] || '/tmp/question-bank-audit-out.json';

const data = JSON.parse(readFileSync(inputPath, 'utf-8'));
const qs = data.questions;

// Mirrors backend/src/lib/difficultyTiers.js and backend/src/lib/designTiers.js. Kept as plain
// literals here (rather than imported) so this script stays a standalone, zero-dependency
// read of the data file — it's a throwaway auditing tool, not part of the app's module graph.
const OBSCURITY_TIERS = ['First Year', 'O.W.L.', 'N.E.W.T.', 'Order of the Phoenix'];
const DESIGN_TIERS = ['Direct', 'Some distractors', 'Trick phrasing', 'Requires cross-referencing'];
// Per-question canon_tags values actually used/checked across the app (see
// backend/src/lib/featuredChallenge.js, which treats 'both' as satisfying either filter).
// This is distinct from the two-value VALID_CANON_TAGS a *submitted draft* is restricted to
// in backend/src/routes/suggestions.js — that's a narrower, input-side rule, not the bank's.
const CANON_TAG_VALUES = ['book', 'movie', 'both'];
// The seasonal theme tags a question may carry (backend/src/lib/seasons.js). `themes` is optional: most questions have
// none. test/seasonCoverage.test.js is what fails the build if this list and SEASONS drift apart.
const SEASON_THEMES = ['halloween', 'yule'];

const REQUIRED_FIELDS = [
  'id', 'category', 'canon_tags', 'divergence', 'obscurity_tier', 'design_tier',
  'question_text', 'correct_answer', 'distractors', 'explanation', 'source_ref', 'needs_factcheck',
];

function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ') // strip ALL punctuation (apostrophes, quotes, dashes, …)
    .replace(/\s+/g, ' ')
    .trim();
}

const report = {
  source: inputPath,
  total: qs.length,
  duplicateIds: [],
  exactDuplicateQuestionGroups: [],
  answerAsDistractor: [],
  malformed: [],
};

// --- duplicate ids ---
const idCounts = new Map();
for (const q of qs) idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
for (const [id, count] of idCounts) {
  if (count > 1) report.duplicateIds.push({ id, count });
}

// --- exact-duplicate question_text, anywhere in the bank ---
const byNormText = new Map();
for (const q of qs) {
  const key = normText(q.question_text);
  if (!byNormText.has(key)) byNormText.set(key, []);
  byNormText.get(key).push(q);
}
for (const [key, group] of byNormText) {
  if (group.length > 1) {
    report.exactDuplicateQuestionGroups.push({
      normalizedText: key,
      sameCategory: new Set(group.map((q) => q.category)).size === 1,
      sameAnswer: new Set(group.map((q) => normText(q.correct_answer))).size === 1,
      entries: group.map((q) => ({
        id: q.id,
        category: q.category,
        question_text: q.question_text,
        correct_answer: q.correct_answer,
      })),
    });
  }
}

// --- correct_answer also present among its own distractors ---
for (const q of qs) {
  if (!Array.isArray(q.distractors)) continue;
  const correctNorm = normText(q.correct_answer);
  const matchIdx = q.distractors.findIndex((d) => normText(d) === correctNorm);
  if (matchIdx !== -1) {
    report.answerAsDistractor.push({
      id: q.id,
      category: q.category,
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      distractors: q.distractors,
      matchedDistractorIndex: matchIdx,
    });
  }
}

// --- malformed shape ---
for (const q of qs) {
  const issues = [];
  for (const f of REQUIRED_FIELDS) {
    if (!(f in q)) issues.push(`missing field: ${f}`);
  }
  if (typeof q.id !== 'string' || q.id.trim() === '') issues.push('empty/invalid id');
  if (typeof q.category !== 'string' || q.category.trim() === '') issues.push('empty/invalid category');
  if (typeof q.question_text !== 'string' || q.question_text.trim() === '') issues.push('empty/invalid question_text');
  if (typeof q.correct_answer !== 'string' || q.correct_answer.trim() === '') issues.push('empty/invalid correct_answer');

  if (!Array.isArray(q.distractors)) {
    issues.push('distractors not an array');
  } else {
    if (q.distractors.length !== 3) issues.push(`distractors.length === ${q.distractors.length} (expected 3)`);
    if (q.distractors.some((d) => typeof d !== 'string' || d.trim() === '')) {
      issues.push('empty/invalid distractor entry');
    }
    const normDs = q.distractors.map(normText);
    const seen = new Set();
    const dups = [];
    for (const d of normDs) {
      if (seen.has(d)) dups.push(d);
      seen.add(d);
    }
    if (dups.length > 0) issues.push(`duplicate distractors within question: ${JSON.stringify(dups)}`);
  }

  if (!Array.isArray(q.canon_tags) || q.canon_tags.length === 0) {
    issues.push('canon_tags missing/empty');
  } else if (q.canon_tags.some((t) => !CANON_TAG_VALUES.includes(t))) {
    issues.push(`invalid canon_tags value(s): ${JSON.stringify(q.canon_tags)}`);
  }
  if (!OBSCURITY_TIERS.includes(q.obscurity_tier)) issues.push(`invalid obscurity_tier: ${JSON.stringify(q.obscurity_tier)}`);
  if (!DESIGN_TIERS.includes(q.design_tier)) issues.push(`invalid design_tier: ${JSON.stringify(q.design_tier)}`);
  if (typeof q.divergence !== 'boolean') issues.push('divergence not boolean');
  if (typeof q.needs_factcheck !== 'boolean') issues.push('needs_factcheck not boolean');
  if ('themes' in q && (!Array.isArray(q.themes) || q.themes.some((t) => !SEASON_THEMES.includes(t)))) {
    issues.push(`invalid themes: ${JSON.stringify(q.themes)}`);
  }

  if (issues.length > 0) {
    report.malformed.push({ id: q.id, category: q.category, question_text: q.question_text, issues });
  }
}

writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Question bank audit — ${inputPath}`);
console.log(`Total questions: ${report.total}`);
console.log(`Duplicate ids: ${report.duplicateIds.length}`);
console.log(
  `Exact duplicate question_text groups: ${report.exactDuplicateQuestionGroups.length}` +
    ` (questions involved: ${report.exactDuplicateQuestionGroups.reduce((n, g) => n + g.entries.length, 0)})`,
);
console.log(`Correct-answer-as-own-distractor: ${report.answerAsDistractor.length}`);
console.log(`Malformed entries: ${report.malformed.length}`);
for (const theme of SEASON_THEMES) {
  const tagged = qs.filter((q) => Array.isArray(q.themes) && q.themes.includes(theme));
  const byTier = OBSCURITY_TIERS.map((t) => `${t} ${tagged.filter((q) => q.obscurity_tier === t).length}`).join(', ');
  console.log(`Season "${theme}": ${tagged.length} tagged (${byTier})`);
}
console.log(`Full detail written to ${outPath}`);
