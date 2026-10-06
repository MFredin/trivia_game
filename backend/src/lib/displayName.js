// The name to show for a player in someone else's history: their username, or "Deleted player"
// once the account is deleted (see services/accountDeletion.js). A SQL fragment rather than a
// post-processing step so every query that shows another player's name has one obvious place to
// get it right. `alias` is the users table's alias in that query.
export const DELETED_PLAYER_NAME = 'Deleted player';

export function displayNameSql(alias = 'u') {
  return `CASE WHEN ${alias}.deleted_at IS NOT NULL THEN '${DELETED_PLAYER_NAME}' ELSE ${alias}.username END`;
}
