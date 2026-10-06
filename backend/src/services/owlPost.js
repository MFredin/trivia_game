import { pool } from '../db/pool.js';
import { sendToUser } from '../lib/wsServer.js';
import {
  INBOX_LIMIT,
  NEW_CONTACTS_PER_DAY,
  RETENTION_DAYS,
  THREAD_PAGE_SIZE,
  UNANSWERED_NON_FRIEND_OWLS,
} from '../lib/owlPost.js';
import { contactAllowed } from '../lib/contactModes.js';
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

async function findPlayer(userId, username) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.avatar, u.avatar_style, u.theme, u.title, u.owl_post,
            EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $1 AND f.friend_user_id = u.id AND f.status = 'accepted') AS is_friend,
            EXISTS (SELECT 1 FROM messages m WHERE (m.sender_id = $1 AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = $1)) AS has_history,
            ${notBlockedSql('$1', 'u.id')} AS not_blocked
     FROM users u WHERE u.username = $2 AND u.deleted_at IS NULL`,
    [userId, username],
  );
  const row = rows[0];
  if (!row || row.id === userId) return null;
  return row;
}

/**
 * How many owls this player has sent that the other has not answered — counted over every message,
 * deleted or not, so tidying a conversation does not start the allowance over.
 */
export async function unansweredCount(senderId, otherId) {
  const { rows } = await pool.query(
    `SELECT count(*) AS n FROM messages
     WHERE sender_id = $1 AND recipient_id = $2
       AND id > COALESCE((SELECT max(id) FROM messages WHERE sender_id = $2 AND recipient_id = $1), 0)`,
    [senderId, otherId],
  );
  return Number(rows[0].n);
}

/** How many players who are not friends this player has first written to in the last day. */
async function newContactsToday(userId) {
  const { rows } = await pool.query(
    `SELECT count(*) AS n FROM (
       SELECT m.recipient_id FROM messages m
       WHERE m.sender_id = $1
       GROUP BY m.recipient_id
       HAVING min(m.created_at) > now() - interval '24 hours'
     ) first_contacts
     WHERE NOT EXISTS (
       SELECT 1 FROM friendships f WHERE f.user_id = $1 AND f.friend_user_id = first_contacts.recipient_id AND f.status = 'accepted'
     )`,
    [userId],
  );
  return Number(rows[0].n);
}

/**
 * Who a player may read a conversation with: someone they have not blocked and who has not blocked
 * them, and either a friend or someone they have already exchanged owls with (an old conversation
 * stays readable after a friendship ends or a setting changes). Everything else — a blocked player,
 * an unknown name, a stranger with no history — is the same 404, so the routes cannot be used to
 * find out who has blocked you or who has an account.
 */
export async function resolveConversation(userId, username) {
  const other = await findPlayer(userId, username);
  if (!other || !other.not_blocked || !(other.is_friend || other.has_history)) return refuse(404, 'user_not_found');
  return { other };
}

/**
 * Whether the signed-in player may SEND to this player. Blocked or unknown is the same 404 as ever.
 * Then the sender's own state (switched off, muted), which is theirs to be told about; then the
 * recipient's setting, which is public on their profile and so is said plainly; then, for someone
 * who is not a friend, the two limits on strangers.
 */
export async function resolveRecipient(userId, username) {
  const other = await findPlayer(userId, username);
  if (!other || !other.not_blocked) return refuse(404, 'user_not_found');

  const { rows } = await pool.query('SELECT owl_post, muted_until FROM users WHERE id = $1', [userId]);
  if (rows[0].owl_post === 'off') return refuse(403, 'owl_post_off');
  if (rows[0].muted_until && rows[0].muted_until > new Date()) {
    return refuse(403, 'owl_post_muted', { until: rows[0].muted_until });
  }

  if (!contactAllowed(other.owl_post, other.is_friend)) return refuse(403, 'not_accepting_owls');

  if (!other.is_friend) {
    if ((await unansweredCount(userId, other.id)) >= UNANSWERED_NON_FRIEND_OWLS) return refuse(403, 'awaiting_reply');
    if (!other.has_history && (await newContactsToday(userId)) >= NEW_CONTACTS_PER_DAY) {
      return refuse(429, 'too_many_new_contacts');
    }
  }
  return { other };
}

export async function recentlySent(senderId, recipientId, body) {
  const { rows } = await pool.query(
    `SELECT 1 FROM messages WHERE sender_id = $1 AND recipient_id = $2 AND body = $3 AND created_at > now() - interval '60 seconds'`,
    [senderId, recipientId, body],
  );
  return rows.length > 0;
}

export async function storeMessage(sender, recipientId, body, subject = null) {
  const { rows } = await pool.query(
    `INSERT INTO messages (sender_id, recipient_id, body, subject) VALUES ($1, $2, $3, $4) RETURNING id, body, subject, created_at`,
    [sender.id, recipientId, body, subject],
  );
  const message = rows[0];
  // Live to the recipient if they are connected; otherwise they find it in the inbox.
  sendToUser(recipientId, {
    type: 'owlpost:message',
    message: {
      id: Number(message.id),
      from_username: sender.username,
      body: message.body,
      subject: message.subject,
      created_at: message.created_at,
    },
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
     SELECT u.id AS other_id, u.username, u.avatar, u.avatar_style, u.theme, u.title,
            EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $1 AND f.friend_user_id = u.id AND f.status = 'accepted') AS is_friend,
            l.body, l.subject, l.created_at, (l.sender_id = $1) AS from_me,
            (SELECT count(*) FROM messages x
             WHERE x.sender_id = l.other_id AND x.recipient_id = $1 AND x.read_at IS NULL AND NOT x.deleted_by_recipient) AS unread
     FROM latest l
     JOIN users u ON u.id = l.other_id
     WHERE u.deleted_at IS NULL
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
     WHERE m.recipient_id = $1 AND m.read_at IS NULL AND NOT m.deleted_by_recipient
       AND ${notBlockedSql('$1', 'm.sender_id')}`,
    [userId],
  );
  return Number(rows[0].n);
}

/** One page of a conversation, oldest first, ending just before `before` (a message id) if given. */
export async function thread(userId, otherId, { before, limit = THREAD_PAGE_SIZE } = {}) {
  const { rows } = await pool.query(
    `SELECT m.id, m.body, m.subject, m.created_at, m.read_at, (m.sender_id = $1) AS from_me
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
    `SELECT s.username AS sender_username, m.subject, m.body, m.created_at
     FROM messages m JOIN users s ON s.id = m.sender_id
     WHERE (m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1)
     ORDER BY m.id DESC LIMIT $3`,
    [reporterId, reportedId, limit],
  );
  return rows.reverse();
}
