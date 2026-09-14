import express from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getAllQuestions, invalidateQuestionCache } from '../repo/questions.js';
import { OBSCURITY_TIERS } from '../lib/difficultyTiers.js';
import { DESIGN_TIERS } from '../lib/designTiers.js';

const router = express.Router();

const VALID_CANON_TAGS = ['book', 'movie'];

function suggestionView(row) {
  return {
    id: row.id,
    status: row.status,
    category: row.category,
    canon_tags: row.canon_tags,
    divergence: row.divergence,
    question_text: row.question_text,
    correct_answer: row.correct_answer,
    distractors: row.distractors,
    explanation: row.explanation,
    source_ref: row.source_ref,
    obscurity_tier: row.obscurity_tier,
    design_tier: row.design_tier,
    review_note: row.review_note,
    approved_question_id: row.approved_question_id,
    created_at: row.created_at,
    submitted_by: row.submitted_by_username ?? undefined,
  };
}

function validateDraft(body) {
  const { category, question_text, correct_answer, distractors, canon_tags, divergence, explanation, source_ref } =
    body ?? {};

  if (typeof category !== 'string' || category.trim().length === 0) return 'invalid_category';
  if (typeof question_text !== 'string' || question_text.trim().length < 10 || question_text.length > 500) {
    return 'invalid_question_text';
  }
  if (typeof correct_answer !== 'string' || correct_answer.trim().length === 0 || correct_answer.length > 200) {
    return 'invalid_correct_answer';
  }
  if (
    !Array.isArray(distractors) ||
    distractors.length !== 3 ||
    distractors.some((d) => typeof d !== 'string' || d.trim().length === 0 || d.length > 200)
  ) {
    return 'invalid_distractors';
  }
  const tags = canon_tags ?? ['book', 'movie'];
  if (!Array.isArray(tags) || tags.length === 0 || tags.some((t) => !VALID_CANON_TAGS.includes(t))) {
    return 'invalid_canon_tags';
  }
  if (divergence !== undefined && typeof divergence !== 'boolean') return 'invalid_divergence';
  if (explanation !== undefined && explanation !== null && typeof explanation !== 'string') return 'invalid_explanation';
  if (source_ref !== undefined && source_ref !== null && typeof source_ref !== 'string') return 'invalid_source_ref';
  return null;
}

// Any logged-in player can submit a draft question — this is the destination the Marauder's
// Map easter egg points to, not a publicly-linked feature.
router.post('/', requireAuth, async (req, res) => {
  const error = validateDraft(req.body);
  if (error) return res.status(400).json({ error });

  const { category, question_text, correct_answer, distractors, canon_tags, divergence, explanation, source_ref } =
    req.body;

  const { rows } = await pool.query(
    `INSERT INTO suggested_questions
      (suggested_by, category, canon_tags, divergence, question_text, correct_answer, distractors, explanation, source_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      req.userId,
      category.trim(),
      canon_tags ?? ['book', 'movie'],
      divergence ?? false,
      question_text.trim(),
      correct_answer.trim(),
      distractors.map((d) => d.trim()),
      explanation?.trim() || null,
      source_ref?.trim() || null,
    ],
  );
  return res.status(201).json({ suggestion: suggestionView(rows[0]) });
});

// A submitter's own drafts and their review outcome — no visibility into anyone else's.
router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM suggested_questions WHERE suggested_by = $1 ORDER BY created_at DESC`,
    [req.userId],
  );
  return res.json({ suggestions: rows.map(suggestionView) });
});

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const { rows } = await pool.query(
    `SELECT sq.*, u.username AS submitted_by_username
     FROM suggested_questions sq
     JOIN users u ON u.id = sq.suggested_by
     WHERE sq.status = $1
     ORDER BY sq.created_at ASC`,
    [status],
  );
  return res.json({ suggestions: rows.map(suggestionView) });
});

// IDs follow the bank's existing "PREFIX-NNN" convention (see question-bank-full-draft.json).
// Derived from data rather than a hardcoded category->prefix table, so a category added later
// doesn't need a code change here.
async function nextQuestionId(category) {
  const { rows } = await pool.query('SELECT id FROM questions WHERE category = $1', [category]);

  const prefixCounts = new Map();
  for (const { id } of rows) {
    const m = id.match(/^([A-Za-z]+)-(\d+)$/);
    if (m) prefixCounts.set(m[1], (prefixCounts.get(m[1]) ?? 0) + 1);
  }
  const prefix = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? category.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
    ?? 'QST';

  let maxNum = 0;
  const numberPattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const { id } of rows) {
    const m = id.match(numberPattern);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return { prefix, nextNum: maxNum + 1 };
}

router.post('/admin/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { rows: draftRows } = await pool.query('SELECT * FROM suggested_questions WHERE id = $1', [req.params.id]);
  const draft = draftRows[0];
  if (!draft) return res.status(404).json({ error: 'suggestion_not_found' });
  if (draft.status !== 'pending') return res.status(409).json({ error: 'already_reviewed' });

  // The admin can adjust anything before it goes live; anything omitted falls back to the
  // submitter's original draft. obscurity_tier/design_tier have no draft value to fall back on
  // — they're the two fields only an admin, calibrating against the existing bank, should set.
  const final = { ...draft, ...req.body };
  const error = validateDraft(final);
  if (error) return res.status(400).json({ error });
  if (!OBSCURITY_TIERS.includes(final.obscurity_tier)) return res.status(400).json({ error: 'invalid_obscurity_tier' });
  if (!DESIGN_TIERS.includes(final.design_tier)) return res.status(400).json({ error: 'invalid_design_tier' });

  let inserted = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    // Re-queried fresh on every attempt, so a retry after a collision already sees the row
    // that caused it and naturally computes the next free number instead of colliding again.
    const { prefix, nextNum } = await nextQuestionId(final.category.trim());
    const id = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    try {
      const { rows } = await pool.query(
        `INSERT INTO questions
          (id, category, canon_tags, divergence, obscurity_tier, design_tier, question_text, correct_answer, distractors, explanation, source_ref, needs_factcheck)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
         RETURNING *`,
        [
          id,
          final.category.trim(),
          final.canon_tags,
          final.divergence,
          final.obscurity_tier,
          final.design_tier,
          final.question_text.trim(),
          final.correct_answer.trim(),
          final.distractors.map((d) => d.trim()),
          final.explanation?.trim() || null,
          final.source_ref?.trim() || null,
        ],
      );
      inserted = rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
      lastErr = err; // id collision (concurrent approval in the same category) — retry with the next number
    }
  }
  if (!inserted) throw lastErr;

  const { rows: updatedRows } = await pool.query(
    `UPDATE suggested_questions
     SET status = 'approved', reviewed_by = $1, reviewed_at = now(), approved_question_id = $2,
         category = $3, canon_tags = $4, divergence = $5, question_text = $6, correct_answer = $7,
         distractors = $8, explanation = $9, source_ref = $10, obscurity_tier = $11, design_tier = $12
     WHERE id = $13
     RETURNING *`,
    [
      req.userId,
      inserted.id,
      final.category.trim(),
      final.canon_tags,
      final.divergence,
      final.question_text.trim(),
      final.correct_answer.trim(),
      final.distractors.map((d) => d.trim()),
      final.explanation?.trim() || null,
      final.source_ref?.trim() || null,
      final.obscurity_tier,
      final.design_tier,
      draft.id,
    ],
  );
  invalidateQuestionCache();
  await getAllQuestions(); // repopulate immediately rather than lazily on the next player's request

  return res.json({ question: inserted, suggestion: suggestionView(updatedRows[0]) });
});

router.post('/admin/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { review_note } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE suggested_questions
     SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), review_note = $2
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [req.userId, review_note?.trim() || null, req.params.id],
  );
  if (rows.length === 0) return res.status(409).json({ error: 'already_reviewed_or_not_found' });
  return res.json({ suggestion: suggestionView(rows[0]) });
});

export default router;
