import { pool } from '../db/pool.js';
import { getSockets } from '../lib/presenceRegistry.js';
import { signAuthToken } from '../lib/authTokens.js';

/**
 * End every sign-in the account has, everywhere: raise its token generation so each token issued so far fails
 * on its next request, and drop the sockets that were opened with them. Returns a fresh token for whoever
 * asked, so the device that changed the password stays signed in while all the others are put out.
 *
 * Used when a password changes or is reset: someone who had the old password, or a stolen token, should not
 * keep a session for the thirty days a token would otherwise last.
 */
export async function revokeSessions(userId) {
  const { rows } = await pool.query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
    [userId],
  );
  for (const ws of getSockets(userId)) ws.close();
  return rows[0] ? signAuthToken(userId, rows[0].token_version) : null;
}
