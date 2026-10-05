import express from 'express';
import { pool } from '../db/pool.js';
import { hashPassword } from '../lib/passwords.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { appUrl, mailEnabled, sendMail } from '../lib/mailer.js';
import { deleteAccount } from '../services/accountDeletion.js';
import { PURPOSES, consumeToken, createToken, logSend, peekToken, recentlySentCount } from '../services/emailTokens.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_ADDRESS_PER_DAY = 3;

// Asking for a link is throttled per address, so one cannot be used to send someone a flood, and
// confirming is throttled like logging in. RECOVERY_RATE_LIMIT_MAX is for tests; production leaves it unset.
const requestLimit = rateLimit({ max: Number(process.env.RECOVERY_RATE_LIMIT_MAX) || 10, windowMs: 60 * 60 * 1000, keyFn: (req) => `recovery:${req.ip}` });
const confirmLimit = rateLimit({ max: Number(process.env.RECOVERY_RATE_LIMIT_MAX) || 20, windowMs: 15 * 60 * 1000, keyFn: (req) => `recovery-confirm:${req.ip}` });

// Whether the app can send mail at all, so the screens offer "forgot your password" only if it will work.
router.get('/options', (req, res) => res.json({ mail_enabled: mailEnabled() }));

const MESSAGES = {
  reset: {
    subject: 'Reset your Restricted Section password',
    param: 'reset',
    body: (link) =>
      `Someone asked to reset the password for this account. To choose a new one, open this link within the hour:\n\n${link}\n\n` +
      'If you did not ask for this, ignore this message: nothing has changed and your password still works.',
  },
  deletion: {
    subject: 'Confirm deleting your Restricted Section account',
    param: 'delete',
    body: (link) =>
      `Someone asked to delete the account for this address. To go on, open this link within the hour and confirm:\n\n${link}\n\n` +
      'Deleting removes your name, email, friends, messages and achievements; your scores stay without your name.\n' +
      'If you did not ask for this, ignore this message: nothing has been deleted.',
  },
};

// The same answer whether or not the address has an account (nothing here tells you who is a player),
// and no more than three messages a day to any one address, silently.
async function sendLink(kind, rawEmail) {
  const email = rawEmail.toLowerCase().trim();
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
  const user = rows[0];
  if (!user || !mailEnabled()) return;
  if ((await recentlySentCount(user.id)) >= PER_ADDRESS_PER_DAY) return;

  const token = await createToken(user.id, PURPOSES[kind]);
  await logSend(user.id);
  const link = `${appUrl()}/?${MESSAGES[kind].param}=${encodeURIComponent(token)}`;
  try {
    await sendMail({ to: email, subject: MESSAGES[kind].subject, text: MESSAGES[kind].body(link) });
  } catch (err) {
    // A failed send is the operator's to see, and not something to tell a stranger.
    console.error('mail failed:', err.message);
  }
}

function requestRoute(kind) {
  return async (req, res) => {
    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' });
    await sendLink(kind, email);
    return res.json({ ok: true });
  };
}

router.post('/password-reset/request', requestLimit, requestRoute('reset'));
router.post('/account-deletion/request', requestLimit, requestRoute('deletion'));

router.post('/password-reset/confirm', confirmLimit, async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'password_too_short' });
  // Checked before the token is used, so a refused password does not use the link up.
  if (!(await peekToken(token, PURPOSES.reset))) return res.status(400).json({ error: 'invalid_token' });
  const userId = await consumeToken(token, PURPOSES.reset);
  if (!userId) return res.status(400).json({ error: 'invalid_token' });
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1 AND deleted_at IS NULL', [userId, hashPassword(password)]);
  return res.status(204).end();
});

// Whose account a deletion link is for, so the page can say before it asks. Looking does not delete.
router.get('/account-deletion/preview', confirmLimit, async (req, res) => {
  const userId = await peekToken(String(req.query.token ?? ''), PURPOSES.deletion);
  if (!userId) return res.status(400).json({ error: 'invalid_token' });
  const { rows } = await pool.query('SELECT username FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
  if (!rows[0]) return res.status(400).json({ error: 'invalid_token' });
  return res.json({ username: rows[0].username });
});

router.post('/account-deletion/confirm', confirmLimit, async (req, res) => {
  const userId = await consumeToken(req.body?.token, PURPOSES.deletion);
  if (!userId) return res.status(400).json({ error: 'invalid_token' });
  await deleteAccount(userId);
  return res.status(204).end();
});

export default router;
