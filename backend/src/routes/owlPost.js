import { titleView } from '../lib/titles.js';
import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { isOnline } from '../lib/presenceRegistry.js';
import { USER_COLUMNS, userView } from '../lib/userView.js';
import { checkMessage, checkSubject } from '../lib/owlPost.js';
import { CONTACT_MODES, contactAllowed } from '../lib/contactModes.js';
import {
  deleteForMe,
  inbox,
  markRead,
  recentlySent,
  unansweredCount,
  resolveConversation,
  resolveRecipient,
  storeMessage,
  thread,
  unreadCount,
} from '../services/owlPost.js';

const router = express.Router();

router.use(requireAuth);

// Two ceilings on sending, both per player: a burst limit (a person types, a script floods) and a
// daily one. Neither is near what a real conversation needs.
const burstLimit = rateLimit({ max: 20, windowMs: 60 * 1000, keyFn: (req) => `owl:${req.userId}` });
const dailyLimit = rateLimit({ max: 300, windowMs: 24 * 60 * 60 * 1000, keyFn: (req) => `owl-day:${req.userId}` });

router.get('/inbox', async (req, res) => {
  const rows = await inbox(req.userId);
  return res.json({
    conversations: rows.map((r) => ({
      username: r.username,
      avatar: r.avatar ?? null,
      avatar_style: r.avatar_style ?? {},
      theme: r.theme,
      title: titleView(r.title),
      online: isOnline(r.other_id),
      is_friend: r.is_friend,
      last: { body: r.body, subject: r.subject, created_at: r.created_at, from_me: r.from_me },
      unread: Number(r.unread),
    })),
  });
});

router.get('/unread', async (req, res) => res.json({ count: await unreadCount(req.userId) }));

router.patch('/settings', async (req, res) => {
  const { mode } = req.body ?? {};
  if (!CONTACT_MODES.includes(mode)) return res.status(400).json({ error: 'invalid_mode' });
  const { rows } = await pool.query(`UPDATE users SET owl_post = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}`, [mode, req.userId]);
  return res.json({ user: userView(rows[0]) });
});

// "Delete for me" — and only for the player asking. A message in someone else's conversation is
// the same 404 as one that does not exist.
router.delete('/messages/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !(await deleteForMe(req.userId, Number(req.params.id)))) {
    return res.status(404).json({ error: 'message_not_found' });
  }
  return res.status(204).end();
});

router.get('/with/:username', async (req, res) => {
  const found = await resolveConversation(req.userId, req.params.username);
  if (found.error) return res.status(found.error.status).json(found.error.body);

  const before = /^\d+$/.test(String(req.query.before ?? '')) ? Number(req.query.before) : undefined;
  const page = await thread(req.userId, found.other.id, { before });
  const isFriend = found.other.is_friend;
  return res.json({
    with: {
      username: found.other.username,
      avatar: found.other.avatar ?? null,
      avatar_style: found.other.avatar_style ?? {},
      theme: found.other.theme,
      title: titleView(found.other.title),
      online: isOnline(found.other.id),
      is_friend: isFriend,
      // Whether an owl can be sent, so the screen can say so instead of letting a send fail: their
      // setting allows it, and, for someone who is not a friend, the one-until-they-answer limit.
      accepts_owls: contactAllowed(found.other.owl_post, isFriend),
      awaiting_reply: !isFriend && (await unansweredCount(req.userId, found.other.id)) > 0,
    },
    messages: page.messages,
    has_more: page.hasMore,
  });
});

router.post('/with/:username', burstLimit, dailyLimit, async (req, res) => {
  const found = await resolveRecipient(req.userId, req.params.username);
  if (found.error) return res.status(found.error.status).json(found.error.body);

  const checked = checkMessage(req.body?.body);
  if (!checked.ok) return res.status(400).json({ error: checked.error });
  const subject = checkSubject(req.body?.subject);
  if (!subject.ok) return res.status(400).json({ error: subject.error });
  if (await recentlySent(req.userId, found.other.id, checked.value)) {
    return res.status(409).json({ error: 'duplicate_message' });
  }

  const { rows } = await pool.query('SELECT id, username FROM users WHERE id = $1', [req.userId]);
  const message = await storeMessage(rows[0], found.other.id, checked.value, subject.value);
  return res.status(201).json({
    message: { id: Number(message.id), body: message.body, subject: message.subject, created_at: message.created_at, from_me: true },
  });
});

router.post('/with/:username/read', async (req, res) => {
  const found = await resolveConversation(req.userId, req.params.username);
  if (found.error) return res.status(found.error.status).json(found.error.body);
  await markRead(req.userId, found.other.id);
  return res.status(204).end();
});

export default router;
