import { pool } from './pool.js';

/**
 * Runs `work(client)` in one transaction: committed if it returns, rolled back if it throws. For the few places where
 * several statements must succeed or fail together and a lock has to be held across them (a tournament round advancing).
 */
export async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
