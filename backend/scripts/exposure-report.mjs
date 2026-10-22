// Prints the exposure report (services/exposureReport.js): who can act as an admin or a moderator, what they have done lately, and how many accounts
// are new. Read-only. Needs DATABASE_URL. `--days N` sets how far back "lately" goes (default 30).
import { pool } from '../src/db/pool.js';
import { exposureReport } from '../src/services/exposureReport.js';

const at = process.argv.indexOf('--days');
const days = at > -1 ? Number(process.argv[at + 1]) : 30;
if (!Number.isInteger(days) || days < 1) {
  console.error('--days must be a whole number of days');
  process.exit(1);
}
const report = await exposureReport(pool, { days });
console.log(`Privileged accounts (${report.privileged.length}):`);
for (const p of report.privileged) console.log(`  #${p.id} ${p.username}  ${p.role}  created ${new Date(p.created).toISOString().slice(0, 10)}${p.deleted ? '  DELETED' : ''}${p.banned ? '  BANNED' : ''}`);
console.log(`\nModeration in the last ${days} days:`);
if (!report.moderation.length) console.log('  none');
for (const m of report.moderation) console.log(`  #${m.adminId}: ${m.actions} actions on ${m.users} players, ${new Date(m.first).toISOString().slice(0, 10)} to ${new Date(m.last).toISOString().slice(0, 10)}`);
console.log(`\nAccounts created in the last ${days} days: ${report.newAccounts}`);
await pool.end();
