import { pool } from '../db/pool.js';
import { sendToUser } from '../lib/wsServer.js';
import { INBOX_LIMIT, RETENTION_DAYS, THREAD_PAGE_SIZE } from '../lib/owlPost.js';
import { notBlockedSql } from './blocks.js';

// Housekeeping sweep, the same shape as the activity feed's: no job runner at hobby scale, just a
// periodic DELETE of anything past retention.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export async function sweepOldMessages() {
  const { rowCount } = await pool.query(`DELETE FROM messages WHERE created_at < now() - make_interval(days => $1)`, [
    RETENTION_DAYS,
  ]);
  return rowCount;
}

setInterval(() => sweepOldMessages().catch(() => {}), SWEEP_INTERVAL_MS).unref();

const refuse = (status, error, extra = {}) => ({ error: { status, body: { error, ...extra } } });

async function findFriend(userId, username) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.avatar, u.avatar_style, u.theme, u.owl_post,
            EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $1 AND f.friend_user_id = u.id AND f.status = 'accepted') AS is_friend,
            ${notBlockedSql('$1', 'u.id')} AS not_blocked
     FROM users u WHERE u.username = $2 AND u.deleted_at IS NULL`,
    [userId, username],
  );
  const row = rows[0];
  if (!row || row.id === userId) return null;
  return row;
}

/**
 * Who a player may read a conversation with: a friend they have not blocked and who has not blocked
 * them. Everything else — a stranger, a blocked player, an unknown name — is the same 404, so the
 * routes cannot be used to find out who has blocked you or who has an account.
 */
export async function resolveConversation(userId, username) {
  const other = await findFriend(userId, username);
  if (!other || !other.is_friend || !other.not_blocked) return refuse(404, 'user_not_found');
  return { other };
}

/**
 * Whether the signed-in player may SEND to this friend: everything reading needs, plus the
 * recipient having Owl Post on, and the sender having it on and not being muted. Whether the
 * recipient is switched off looks like no such player, for the same reason; the sender's own state
 * is theirs to be told about.
 */
export async function resolveRecipient(userId, username) {
  const found = await resolveConversation(userId, username);
  if (found.error) return found;
  if (found.other.owl_post === 'off') return refuse(404, 'user_not_found');

  const { rows } = await pool.query('SELECT owl_post, muted_until FROM users WHERE id = $1', [userId]);
  if (rows[0].owl_post === 'off') return refuse(403, 'owl_post_off');
  if (rows[0].muted_until && rows[0].muted_until > new Date()) {
    return refuse(403, 'owl_post_muted', { until: rows[0].muted_until });
  }
  return found;
}

export async function recentlySent(senderId, recipientId, body) {
  const { rows } = await pool.query(
    `SELECT 1 FROM messages WHERE sender_id = $1 AND recipient_id = $2 AND body = $3 AND created_at > now() - interval '60 seconds'`,
    [senderId, recipientId, body],
  );
  return rows.length > 0;
}

export async function storeMessage(sender, recipientId, body) {
  const { rows } = await pool.query(
    `INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at`,
    [sender.id, recipientId, body],
  );
  const message = rows[0];
  // Live to the recipient if they are connected; otherwise they find it in the inbox.
  sendToUser(recipientId, {
    type: 'owlpost:message',
    message: { id: Number(message.id), from_username: sender.username, body: message.body, created_at: message.created_at },
  });
  return message;
}

export async function inbox(userId) {
  const { rows } = await pool.query(
    `WITH mine AS (
       SELECT m.*, CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS other_id
       FROM messages m
       WHERE (m.sender_id = $1 AND NOT m.deleted_by_sender) OR (m.recipient_id = $1 AND NOT m.deleted_by_recipient)
     ),
     latest AS (SELECT DISTINCT ON (other_id) * FROM mine ORDER BY other_id, id DESC)
     SELECT u.id AS other_id, u.username, u.avatar, u.avatar_style, u.theme,
            l.body, l.created_at, (l.sender_id = $1) AS from_me,
            (SELECT count(*) FROM messages x
             WHERE x.sender_id = l.other_id AND x.recipient_id = $1 AND x.read_at IS NULL AND NOT x.deleted_by_recipient) AS unread
     FROM latest l
     JOIN users u ON u.id = l.other_id
     WHERE u.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $1 AND f.friend_user_id = u.id AND f.status = 'accepted')
       AND ${notBlockedSql('$1', 'u.id')}
     ORDER BY l.created_at DESC
     LIMIT ${INBOX_LIMIT}`,
    [userId],
  );
  return rows;
}

export async function unreadCount(userId) {
  const { rows } = await pool.query(
    `SELECT count(*) AS n FROM messages m
     JOIN friendships f ON f.user_id = $1 AND f.friend_user_id = m.sender_id AND f.status = 'accepted'
     WHERE m.recipient_id = $1 AND m.read_at IS NULL AND NOT m.deleted_by_recipient`,
    [userId],
  );
  return Number(rows[0].n);
}

/** One page of a conversation, oldest first, ending just before `before` (a message id) if given. */
export async function thread(userId, otherId, { before, limit = THREAD_PAGE_SIZE } = {}) {
  const { rows } = await pool.query(
    `SELECT m.id, m.body, m.created_at, m.read_at, (m.sender_id = $1) AS from_me
     FROM messages m
     WHERE ((m.sender_id = $1 AND m.recipient_id = $2 AND NOT m.deleted_by_sender)
         OR (m.sender_id = $2 AND m.recipient_id = $1 AND NOT m.deleted_by_recipient))
       AND ($3::bigint IS NULL OR m.id < $3)
     ORDER BY m.id DESC
     LIMIT $4`,
    [userId, otherId, before ?? null, limit + 1],
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return { messages: page.map((r) => ({ ...r, id: Number(r.id) })), hasMore };
}

export async function markRead(userId, otherId) {
  const { rowCount } = await pool.query(
    `UPDATE messages SET read_at = now() WHERE sender_id = $2 AND recipient_id = $1 AND read_at IS NULL`,
    [userId, otherId],
  );
  return rowCount;
}

/** "Delete for me": hides the message from this player only. 404 for anyone who is not in it. */
export async function deleteForMe(userId, messageId) {
  const { rowCount } = await pool.query(
    `UPDATE messages SET
       deleted_by_sender = deleted_by_sender OR sender_id = $2,
       deleted_by_recipient = deleted_by_recipient OR recipient_id = $2
     WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)`,
    [messageId, userId],
  );
  return rowCount > 0;
}

/**
 * The recent messages of a conversation, as they stand now, for a report made from inside it.
 * Both sides are included whatever either has deleted for themselves: evidence is the conversation,
 * not one person's tidied view of it.
 */
export async function snapshotConversation(reporterId, reportedId, limit) {
  const { rows } = await pool.query(
    `SELECT s.username AS sender_username, m.body, m.created_at
     FROM messages m JOIN users s ON s.id = m.sender_id
     WHERE (m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1)
     ORDER BY m.id DESC LIMIT $3`,
    [reporterId, reportedId, limit],
  );
  return rows.reverse();
}
