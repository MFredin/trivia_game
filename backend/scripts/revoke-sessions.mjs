// Ends every sign-in and every emailed link at once (docs/secret-rotation.md). Needs DATABASE_URL; run it against production with the connection
// string from the host and nothing else set. Asks for nothing and cannot be undone, so it only runs with --yes.
import { pool } from '../src/db/pool.js';
import { revokeSessions } from '../src/services/sessionRevocation.js';

if (!process.argv.includes('--yes')) {
  console.error('This signs every player out and removes every password-reset and account-deletion link. Run it again with --yes to do it.');
  process.exit(1);
}
const report = await revokeSessions(pool);
console.log(`Signed out ${report.accounts} accounts; removed ${report.emailLinks} emailed links.`);
await pool.end();
