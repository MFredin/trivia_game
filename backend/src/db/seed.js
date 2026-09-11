import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const fileName = process.env.SEED_FILE || 'question-bank-starter.json';
  const raw = readFileSync(path.join(__dirname, '..', 'data', fileName), 'utf-8');
  const { questions } = JSON.parse(raw);

  for (const q of questions) {
    await pool.query(
      `INSERT INTO questions
        (id, category, canon_tags, divergence, obscurity_tier, design_tier,
         question_text, correct_answer, distractors, explanation, source_ref, needs_factcheck)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         category = EXCLUDED.category,
         canon_tags = EXCLUDED.canon_tags,
         divergence = EXCLUDED.divergence,
         obscurity_tier = EXCLUDED.obscurity_tier,
         design_tier = EXCLUDED.design_tier,
         question_text = EXCLUDED.question_text,
         correct_answer = EXCLUDED.correct_answer,
         distractors = EXCLUDED.distractors,
         explanation = EXCLUDED.explanation,
         source_ref = EXCLUDED.source_ref,
         needs_factcheck = EXCLUDED.needs_factcheck`,
      [
        q.id,
        q.category,
        q.canon_tags,
        q.divergence,
        q.obscurity_tier,
        q.design_tier,
        q.question_text,
        q.correct_answer,
        q.distractors,
        q.explanation ?? null,
        q.source_ref ?? null,
        q.needs_factcheck ?? false,
      ],
    );
  }

  console.log(`Seeded ${questions.length} questions from ${fileName}.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
