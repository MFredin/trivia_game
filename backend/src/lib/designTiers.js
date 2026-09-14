// Mirrors the design_tier values actually used across the question bank (see
// backend/src/data/question-bank-full-draft.json) — kept as a real constant here so the
// admin approval form and its server-side validation share one source of truth.
export const DESIGN_TIERS = ['Direct', 'Some distractors', 'Trick phrasing', 'Requires cross-referencing'];
