// The rules around a tournament that are not about the shape of the bracket (docs/tournament-brackets-plan.md):
// what a creator may ask for, who may join, when it may start, and how a match's deadline is set. Pure, like
// lib/bracket.js, so they are tested without a database.

import { BRACKET_SIZES, MAX_PLAYERS, MIN_PLAYERS } from './bracket.js';
import { OBSCURITY_TIERS } from './difficultyTiers.js';
import { checkText } from './bioFilter.js';

export const ROUND_HOUR_OPTIONS = [24, 48, 72];
export const DEFAULT_ROUND_HOURS = 48;
export const NAME_MAX_LENGTH = 40;
export const CANON_SOURCES = ['books', 'movies', 'combined'];

// A tournament nobody ever started is swept away after this long, so an abandoned lobby does not sit there for good.
export const OPEN_LOBBY_DAYS = 7;

export const STATUSES = ['open', 'running', 'completed', 'cancelled'];
const TRANSITIONS = { open: ['running', 'cancelled'], running: ['completed', 'cancelled'], completed: [], cancelled: [] };

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Checks what a creator asked for. Returns `{ value }` with the settings as they should be stored, or `{ error }` with a
 * code the route sends back. The name goes through the same text rules as a bio, since other players will read it.
 */
export function validateCreate(body = {}) {
  const name = checkText(body.name, NAME_MAX_LENGTH);
  if (!name.ok) return { error: name.reason === 'too_long' ? 'name_too_long' : 'invalid_name' };
  if (name.value === '') return { error: 'invalid_name' };

  // The capacity: how many may join. The bracket itself is sized to who actually joins, when it starts.
  const size = body.size ?? 8;
  if (!BRACKET_SIZES.includes(size)) return { error: 'invalid_size' };

  const roundHours = body.round_hours ?? DEFAULT_ROUND_HOURS;
  if (!ROUND_HOUR_OPTIONS.includes(roundHours)) return { error: 'invalid_round_hours' };

  const canonSource = body.canon_source ?? 'combined';
  if (!CANON_SOURCES.includes(canonSource)) return { error: 'invalid_canon_source' };

  if (body.difficulty && !OBSCURITY_TIERS.includes(body.difficulty)) return { error: 'invalid_difficulty' };
  if (body.category != null && (typeof body.category !== 'string' || body.category.length > 60)) return { error: 'invalid_category' };

  return {
    value: {
      name: name.value,
      size,
      roundHours,
      canonSource,
      category: body.category || null,
      difficulty: body.difficulty || null,
    },
  };
}

/** Whether a player may join. `reason` is a code the route sends back. */
export function joinCheck({ status, size, playerCount, alreadyIn }) {
  if (status !== 'open') return { ok: false, reason: 'not_open' };
  if (alreadyIn) return { ok: false, reason: 'already_joined' };
  if (playerCount >= size) return { ok: false, reason: 'full' };
  return { ok: true };
}

/** Whether the creator may start it now. */
export function startCheck({ status, playerCount }) {
  if (status !== 'open') return { ok: false, reason: 'not_open' };
  if (playerCount < MIN_PLAYERS) return { ok: false, reason: 'too_few_players' };
  if (playerCount > MAX_PLAYERS) return { ok: false, reason: 'too_many_players' };
  return { ok: true };
}

/** When a round that opens at `now` closes. */
export function deadlineFrom(now, roundHours) {
  return new Date(now.getTime() + roundHours * 60 * 60 * 1000);
}

/** Whether an open lobby is old enough to be swept away. */
export function lobbyExpired(createdAt, now) {
  return now.getTime() - createdAt.getTime() > OPEN_LOBBY_DAYS * 24 * 60 * 60 * 1000;
}

/** Whether a match has passed its deadline and is still undecided. */
export function overdue(match, now) {
  return match.status === 'open' && match.deadline !== null && match.deadline.getTime() <= now.getTime();
}
