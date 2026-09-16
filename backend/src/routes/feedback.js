import express from 'express';
import { pool } from '../db/pool.js';
import { optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';

const router = express.Router();

const CATEGORIES = ['bug', 'idea', 'other'];
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

// Unauthenticated-friendly (feedback is useful from a visitor who hasn't registered) but files
// a real GitHub issue per submission, so it gets the same throttle as the other unauthenticated
// write endpoints in this app.
const feedbackRateLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post('/', feedbackRateLimit, optionalAuth, async (req, res) => {
  const { message, category, page } = req.body ?? {};
  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'invalid_message' });
  }
  const trimmed = message.trim();
  if (trimmed.length < MESSAGE_MIN || trimmed.length > MESSAGE_MAX) {
    return res.status(400).json({ error: 'invalid_message' });
  }
  const safeCategory = CATEGORIES.includes(category) ? category : 'other';

  let username = 'a guest';
  if (req.userId) {
    const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);
    username = rows[0]?.username ?? 'a since-deleted account';
  }

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO; // "owner/repo"
  if (!token || !repo) {
    // Never silently drop feedback — log it so it's at least visible in the deploy's own logs
    // even if the GitHub wiring isn't configured yet.
    console.error('[feedback] GITHUB_FEEDBACK_TOKEN/GITHUB_FEEDBACK_REPO not set — feedback not filed:', {
      username,
      category: safeCategory,
      message: trimmed,
    });
    return res.status(503).json({ error: 'feedback_not_configured' });
  }

  const titleSnippet = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
  const title = `[Player Feedback] ${safeCategory}: ${titleSnippet}`;
  const body = [
    trimmed,
    '',
    '---',
    `Category: ${safeCategory}`,
    `From: ${username}`,
    typeof page === 'string' && page ? `Page: ${page}` : null,
    `Submitted: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body }),
    });
    if (!ghRes.ok) {
      console.error('[feedback] GitHub issue creation failed:', ghRes.status, await ghRes.text());
      return res.status(502).json({ error: 'feedback_delivery_failed' });
    }
    const issue = await ghRes.json();
    return res.status(201).json({ issue_number: issue.number, issue_url: issue.html_url });
  } catch (err) {
    console.error('[feedback] GitHub issue creation error:', err);
    return res.status(502).json({ error: 'feedback_delivery_failed' });
  }
});

export default router;
