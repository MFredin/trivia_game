// The one shape a signed-in player's own account takes on the wire, and the columns that feed it.
// Kept in one place because five routes return it and they had begun to disagree about which
// fields it carried.
export const USER_COLUMNS = 'id, username, email, theme, is_admin, avatar';

export function userView(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    theme: row.theme,
    is_admin: row.is_admin,
    avatar: row.avatar ?? null,
  };
}
