// The one shape a signed-in player's own account takes on the wire, and the columns that feed it.
// Kept in one place because five routes return it and they had begun to disagree about which
// fields it carried.
export const USER_COLUMNS = 'id, username, email, theme, is_admin, avatar, avatar_style, friends_visibility, bio, favorite_book, favorite_subject, pinned_achievements, must_rename, owl_post, challenges, muted_until';

export function userView(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    theme: row.theme,
    is_admin: row.is_admin,
    avatar: row.avatar ?? null,
    avatar_style: row.avatar_style ?? {},
    bio: row.bio ?? null,
    favorite_book: row.favorite_book ?? null,
    favorite_subject: row.favorite_subject ?? null,
    pinned_achievements: row.pinned_achievements ?? [],
    must_rename: row.must_rename ?? false,
    owl_post: row.owl_post ?? 'open',
    challenges: row.challenges ?? 'open',
    // Only while it is in force; an expired mute is no mute.
    muted_until: row.muted_until && row.muted_until > new Date() ? row.muted_until : null,
    friends_visibility: row.friends_visibility,
  };
}
