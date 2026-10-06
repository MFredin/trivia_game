// The shape of a single-elimination bracket (docs/tournament-brackets-plan.md). Pure: no database, no clock, no
// randomness other than a seed the caller supplies, so every rule here is tested without HTTP.
//
// Players are numbered by SEED, 1 being the strongest slot. Nothing here knows a user id's meaning; ids are carried
// through opaquely. A bracket is `size` slots (4, 8 or 16); with fewer players the highest seeds are absent, and in the
// standard seeding order those are exactly the opponents of the top seeds, so byes go to the top seeds.

import { mulberry32, seedFromString, shuffle } from './questionSelection.js';

export const BRACKET_SIZES = [4, 8, 16];
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 16;

/** The smallest bracket that holds `playerCount` players, or null if that is too few or too many. */
export function bracketSizeFor(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) return null;
  return BRACKET_SIZES.find((size) => size >= playerCount);
}

/** How many rounds a bracket of `size` takes: 4 -> 2, 8 -> 3, 16 -> 4. */
export function roundCount(size) {
  return Math.log2(size);
}

/**
 * The standard seeding order for a bracket: the seeds as they sit from the top of the draw to the bottom, so that
 * seed 1 meets seed `size` first, and the two strongest seeds cannot meet before the final.
 * 4 -> [1, 4, 2, 3]; 8 -> [1, 8, 4, 5, 2, 7, 3, 6].
 */
export function seedOrder(size) {
  let seeds = [1];
  while (seeds.length < size) {
    const total = seeds.length * 2;
    seeds = seeds.flatMap((seed) => [seed, total + 1 - seed]);
  }
  return seeds;
}

/**
 * Assigns seeds: a shuffle that depends only on the tournament, so the same tournament always seeds the same way and
 * nobody can be advantaged by who created it or who joined first. Returns the ids, index 0 being seed 1.
 */
export function seedPlayers(playerIds, tournamentId) {
  const rng = mulberry32(seedFromString(`tournament:${tournamentId}`));
  // Sorted first so the result does not depend on the order the database happened to return the rows in.
  return shuffle([...playerIds].sort((a, b) => a - b), rng);
}

/**
 * The first round. `seededIds` is the players in seed order (index 0 = seed 1). Each match is
 * { round: 1, slot, playerA, playerB, isBye }; a bye has one player and `playerB` null.
 */
export function buildFirstRound(seededIds) {
  const size = bracketSizeFor(seededIds.length);
  if (size === null) throw new RangeError(`a bracket needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players, got ${seededIds.length}`);
  const order = seedOrder(size);
  const playerAt = (seed) => seededIds[seed - 1] ?? null;
  const matches = [];
  for (let slot = 1; slot <= size / 2; slot++) {
    const playerA = playerAt(order[(slot - 1) * 2]);
    const playerB = playerAt(order[(slot - 1) * 2 + 1]);
    matches.push({ round: 1, slot, playerA, playerB, isBye: playerA === null || playerB === null });
  }
  return matches;
}

/**
 * Where a match's winner goes: the next round, the slot that pairs this one with its neighbour, and which side of it.
 * Slots 1 and 2 feed slot 1, slots 3 and 4 feed slot 2, and so on; the odd one is `playerA`.
 */
export function nextPlacement(round, slot) {
  return { round: round + 1, slot: Math.ceil(slot / 2), side: slot % 2 === 1 ? 'playerA' : 'playerB' };
}

/** Whether a match is the last one of a bracket of `size`. */
export function isFinal(round, size) {
  return round === roundCount(size);
}

/**
 * The next round's matches, given the decided matches of one round (each with `slot` and `winnerId`). A match with no
 * second slot to pair with does not arise in a power-of-two bracket, so every winner is placed.
 */
export function pairNextRound(decided) {
  const round = decided[0].round + 1;
  const next = new Map();
  for (const match of decided) {
    const { slot, side } = nextPlacement(match.round, match.slot);
    const entry = next.get(slot) ?? { round, slot, playerA: null, playerB: null };
    entry[side] = match.winnerId;
    next.set(slot, entry);
  }
  return [...next.values()].sort((x, y) => x.slot - y.slot).map((m) => ({ ...m, isBye: false }));
}

/**
 * Decides a match from the two players' results. A result is `{ score, totalMs }` once a player has finished their run,
 * or null if they did not play. Returns `{ winner: 'a' | 'b', decidedBy }`:
 *   - one played and one did not: the one who played advances ('no_show')
 *   - neither played: the better seed advances ('no_show')
 *   - both played: the higher score ('score'), then the faster total time ('time'), then the better seed ('seed')
 * `seedA` and `seedB` are seed numbers; the lower number is the better seed.
 */
export function decideMatch({ resultA, resultB, seedA, seedB }) {
  const betterSeed = seedA <= seedB ? 'a' : 'b';
  if (!resultA && !resultB) return { winner: betterSeed, decidedBy: 'no_show' };
  if (!resultA) return { winner: 'b', decidedBy: 'no_show' };
  if (!resultB) return { winner: 'a', decidedBy: 'no_show' };
  if (resultA.score !== resultB.score) return { winner: resultA.score > resultB.score ? 'a' : 'b', decidedBy: 'score' };
  if (resultA.totalMs !== resultB.totalMs) return { winner: resultA.totalMs < resultB.totalMs ? 'a' : 'b', decidedBy: 'time' };
  return { winner: betterSeed, decidedBy: 'seed' };
}
