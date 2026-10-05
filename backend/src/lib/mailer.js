// Sending mail, for the two things the app emails: a password reset link and an account-deletion link.
// Nothing else is sent, and nothing here is marketing.
//
// Three ways, picked from the environment (`chooseProvider`):
//   resend — a real send through Resend's HTTP API, when RESEND_API_KEY and MAIL_FROM are both set.
//   log    — outside production, with no provider: the message goes to an in-memory outbox (and the
//            console), which is how development and the tests read the link without sending anything.
//            MAIL_OUTBOX_FILE, when set, also appends each message as a JSON line to that file, so a browser
//            test in another process can read the link. Never used in production (there is no log provider).
//   null   — in production with no provider: nothing is sent and nothing is faked, and the app says so
//            (`GET /api/auth/options`), so a screen does not promise an email that will never arrive.

import { appendFileSync } from 'node:fs';

export const outbox = [];
export const clearOutbox = () => {
  outbox.length = 0;
};

export function chooseProvider(env = process.env) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return 'resend';
  if (env.NODE_ENV === 'production') return null;
  return 'log';
}

export const mailEnabled = () => chooseProvider() !== null;

/** Where links in a message point: the public address of the app (the frontend). */
export function appUrl() {
  return (process.env.APP_URL || process.env.ALLOWED_ORIGIN || 'http://localhost:5175').replace(/\/+$/, '');
}

export async function sendMail({ to, subject, text }) {
  const provider = chooseProvider();
  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`mail provider answered ${res.status}`);
    return;
  }
  if (provider === 'log') {
    outbox.push({ to, subject, text });
    if (process.env.MAIL_OUTBOX_FILE) appendFileSync(process.env.MAIL_OUTBOX_FILE, `${JSON.stringify({ to, subject, text })}\n`);
    if (!process.env.NODE_TEST_CONTEXT) console.log(`[mail] to ${to}: ${subject}\n${text}`);
  }
}
