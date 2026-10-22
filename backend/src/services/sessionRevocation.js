// Ends every sign-in at once. A sign-in token carries the number of its account's token_version when it was signed, and is good only while that is still
// the account's number (repo/users.js getAccountAccess); raising every account's number therefore ends every token ever issued, on the very next
// request, without a deploy and without the signing secret changing. The links sent by email (password reset, account deletion) are removed too, because
// each is a way into an account that a stolen database or a read mailbox would have kept alive.
//
// Players sign in again with their password and carry on. Nothing about an account other than its number is touched. A WebSocket that is already open
// stays open until it reconnects or the server restarts, which a deploy does.

/**
 * `only`, when given, is a list of account ids to end the sessions of instead of everyone's: the rest of the program has no use for it, but a test that
 * ended everyone's would sign out the players of every other test running against the same database.
 * @returns {Promise<{ accounts: number, emailLinks: number }>} how many accounts were raised and how many email links removed.
 */
export async function revokeSessions(db, { only } = {}) {
  const scoped = Array.isArray(only);
  const raised = scoped
    ? await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ANY($1::int[])', [only])
    : await db.query('UPDATE users SET token_version = token_version + 1');
  const links = scoped ? await db.query('DELETE FROM email_tokens WHERE user_id = ANY($1::int[])', [only]) : await db.query('DELETE FROM email_tokens');
  return { accounts: raised.rowCount, emailLinks: links.rowCount };
}
