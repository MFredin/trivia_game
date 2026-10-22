// What to look at after a credential may have been seen: who can act as an admin or a moderator, what they have done lately, and whether accounts
// are being made in a rush. It only reads, and it carries no email address, no hash and no message text, so it is safe to paste into a conversation.
// It cannot show that nothing happened (there is no log of role changes, which are made by hand in the database), but an admin nobody remembers
// appointing, or a moderator whose account was made last week, is what it is there to show.

/**
 * @param db     a pg pool or client
 * @param days   how far back "lately" goes
 */
export async function exposureReport(db, { days = 30 } = {}) {
  const privileged = await db.query(
    `SELECT id, username, created_at, deleted_at, banned_at,
            CASE WHEN is_admin THEN 'admin' ELSE 'moderator' END AS role
       FROM users
      WHERE is_admin OR is_moderator
      ORDER BY is_admin DESC, created_at`,
  );
  const moderation = await db.query(
    `SELECT admin_id, count(*)::int AS actions, count(DISTINCT user_id)::int AS users, min(created_at) AS first, max(created_at) AS last
       FROM moderation_actions
      WHERE created_at > now() - make_interval(days => $1)
      GROUP BY admin_id
      ORDER BY actions DESC`,
    [days],
  );
  const fresh = await db.query(`SELECT count(*)::int AS n FROM users WHERE created_at > now() - make_interval(days => $1)`, [days]);
  return {
    days,
    privileged: privileged.rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      created: r.created_at,
      deleted: Boolean(r.deleted_at),
      banned: Boolean(r.banned_at),
    })),
    moderation: moderation.rows.map((r) => ({ adminId: r.admin_id, actions: r.actions, users: r.users, first: r.first, last: r.last })),
    newAccounts: fresh.rows[0].n,
  };
}
