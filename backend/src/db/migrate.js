// Applies db/schema.sql to the database named by DATABASE_URL, then exits (`npm run db:migrate`).
//
// The schema is written to be run repeatedly: every statement is CREATE ... IF NOT EXISTS or ADD COLUMN IF NOT
// EXISTS, so a new column or table is added by appending to schema.sql and nothing is ever dropped or rewritten.
// Railway runs this before each deploy starts the new code (.railway/railway.ts). It is a deliberate non-framework:
// there is no migration history to keep in step, at the cost that a destructive change has to be done by hand.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('Schema applied.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
