import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/trivia_game',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
