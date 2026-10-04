import { pool } from '../db/pool.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { isValidAvatar } from '../lib/avatars.js';
import { AVATAR_UNLOCKS, lockedChoices, normalizeAvatarStyle } from '../lib/avatarStyle.js';
import { checkBio } from '../lib/bioFilter.js';
import { isFavoriteBook, normalizePinned } from '../lib/profileFields.js';
import { getAllQuestions } from '../repo/questions.js';

const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export async function earnedAchievements(userId) {
  const { rows } = await pool.query(
    'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC',
    [userId],
  );
  return rows
    .map((r) => (ACHIEVEMENT_BY_ID[r.achievement_id] ? { ...ACHIEVEMENT_BY_ID[r.achievement_id], unlocked_at: r.unlocked_at } : null))
    .filter(Boolean);
}

export async function categoryNames() {
  return [...new Set((await getAllQuestions()).map((q) => q.category))].sort();
}

/** Every earned-by-play avatar choice, with what it takes and whether this player has it. */
export function describeLocks(earned) {
  const have = new Set(earned.map((a) => a.id));
  return Object.entries(AVATAR_UNLOCKS).map(([key, achievementId]) => ({
    key,
    achievement_id: achievementId,
    achievement_name: ACHIEVEMENT_BY_ID[achievementId]?.name ?? achievementId,
    achievement_description: ACHIEVEMENT_BY_ID[achievementId]?.description ?? '',
    unlocked: have.has(achievementId),
  }));
}

const EDITABLE = ['avatar', 'avatar_style', 'bio', 'favorite_book', 'favorite_subject', 'pinned_achievements'];

const refuse = (error, extra = {}) => ({ error: { status: 400, body: { error, ...extra } } });

/**
 * Validates a partial profile update against everything that can make it invalid — allow-lists,
 * the bio filter, what this player has actually earned — and returns the columns to write, or the
 * error to send back. Nothing here writes; the route does, once the whole request is known to be
 * good, so a bad bio never leaves a half-applied avatar behind.
 */
export async function validateProfileUpdate(userId, current, body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return refuse('invalid_request');
  const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
  if (unknown.length > 0) return refuse('unknown_field', { field: unknown[0] });

  const updates = {};

  if ('avatar' in body) {
    if (!isValidAvatar(body.avatar)) return refuse('invalid_avatar');
    updates.avatar = body.avatar;
  }

  let earned = null;
  const getEarned = async () => (earned ??= await earnedAchievements(userId));

  if ('avatar_style' in body) {
    const style = normalizeAvatarStyle(body.avatar_style);
    if (!style) return refuse('invalid_avatar_style');
    const locked = lockedChoices(style, (await getEarned()).map((a) => a.id), { ...current.avatar_style });
    if (locked.length > 0) return refuse('option_locked', { option: locked[0].key });
    updates.avatar_style = JSON.stringify(style);
  }

  if ('bio' in body) {
    const checked = checkBio(body.bio);
    if (!checked.ok) return refuse(checked.error);
    updates.bio = checked.value === '' ? null : checked.value;
  }

  if ('favorite_book' in body) {
    if (body.favorite_book !== null && !isFavoriteBook(body.favorite_book)) return refuse('invalid_favorite_book');
    updates.favorite_book = body.favorite_book;
  }

  if ('favorite_subject' in body) {
    const subject = body.favorite_subject;
    if (subject !== null && !(typeof subject === 'string' && (await categoryNames()).includes(subject))) {
      return refuse('invalid_favorite_subject');
    }
    updates.favorite_subject = subject;
  }

  if ('pinned_achievements' in body) {
    const pinned = normalizePinned(body.pinned_achievements);
    if (!pinned) return refuse('invalid_pinned_achievements');
    const have = new Set((await getEarned()).map((a) => a.id));
    if (!pinned.every((id) => have.has(id))) return refuse('achievement_not_earned');
    updates.pinned_achievements = pinned;
  }

  return { updates };
}
