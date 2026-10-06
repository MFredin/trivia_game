import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/trivia_game',
  // Railway's Postgres is reached over its private network with a certificate this process has no CA for, so
  // the connection is encrypted but the certificate is not verified. Use a verified connection if the database
  // is ever moved outside that network.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// An idle connection that the database drops (a restart, a failover) emits 'error' on the pool. With no listener
// Node treats that as an uncaught exception and ends the process; with one, the pool discards the connection and
// opens another on the next query.
pool.on('error', (err) => {
  console.error('Unexpected error on an idle database connection:', err.message);
});
