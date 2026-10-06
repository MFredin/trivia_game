import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRACKET_SIZES, bracketSizeFor, roundCount, seedOrder, seedPlayers, buildFirstRound, nextPlacement, isFinal, pairNextRound,
  decideMatch,
} from '../src/lib/bracket.js';

test('a bracket is the smallest of 4, 8 or 16 that holds the players, and three to sixteen can play', () => {
  const expected = { 2: null, 3: 4, 4: 4, 5: 8, 8: 8, 9: 16, 16: 16, 17: null, 0: null, '-1': null };
  for (const [count, size] of Object.entries(expected)) assert.equal(bracketSizeFor(Number(count)), size, `${count} players`);
  assert.equal(bracketSizeFor(5.5), null);
  assert.equal(bracketSizeFor('8'), null);
});

test('rounds: 4 players take two, 8 take three, 16 take four', () => {
  assert.deepEqual(BRACKET_SIZES.map(roundCount), [2, 3, 4]);
});

test('the seeding order is the standard one', () => {
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(seedOrder(16), [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
});

test('every seed appears once, and each first-round pair adds up to one more than the bracket', () => {
  for (const size of BRACKET_SIZES) {
    const order = seedOrder(size);
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i + 1));
    for (let i = 0; i < size; i += 2) assert.equal(order[i] + order[i + 1], size + 1);
  }
});

const ids = (n) => Array.from({ length: n }, (_, i) => 100 + i); // index 0 is seed 1

test('the first round has one match per pair of slots, and every player is in exactly one', () => {
  for (let count = 3; count <= 16; count++) {
    const size = bracketSizeFor(count);
    const matches = buildFirstRound(ids(count));
    assert.equal(matches.length, size / 2, `${count} players`);
    assert.deepEqual(matches.map((m) => m.slot), Array.from({ length: size / 2 }, (_, i) => i + 1));
    const placed = matches.flatMap((m) => [m.playerA, m.playerB]).filter((p) => p !== null);
    assert.deepEqual([...placed].sort((a, b) => a - b), ids(count), `${count} players`);
  }
});

test('byes go to the top seeds, one per missing player', () => {
  for (let count = 3; count <= 16; count++) {
    const size = bracketSizeFor(count);
    const byeMatches = buildFirstRound(ids(count)).filter((m) => m.isBye);
    assert.equal(byeMatches.length, size - count, `${count} players`);
    const byeHolders = byeMatches.map((m) => m.playerA ?? m.playerB).sort((a, b) => a - b);
    assert.deepEqual(byeHolders, ids(size - count), `the byes are not the top ${size - count} seeds of ${count}`);
  }
});

test('too few or too many players is refused, not quietly bracketed', () => {
  assert.throws(() => buildFirstRound(ids(2)), RangeError);
  assert.throws(() => buildFirstRound(ids(17)), RangeError);
});

test('a winner moves to the slot that pairs it with its neighbour, odd slot on the left', () => {
  assert.deepEqual(nextPlacement(1, 1), { round: 2, slot: 1, side: 'playerA' });
  assert.deepEqual(nextPlacement(1, 2), { round: 2, slot: 1, side: 'playerB' });
  assert.deepEqual(nextPlacement(1, 3), { round: 2, slot: 2, side: 'playerA' });
  assert.deepEqual(nextPlacement(2, 4), { round: 3, slot: 2, side: 'playerB' });
});

test('the final is the last round', () => {
  assert.equal(isFinal(2, 4), true);
  assert.equal(isFinal(1, 4), false);
  assert.equal(isFinal(4, 16), true);
});

// Plays a whole bracket, with the better seed winning every match, and returns what happened.
function playOut(count) {
  const seeded = ids(count);
  const seedOf = (id) => seeded.indexOf(id) + 1;
  const size = bracketSizeFor(count);
  let round = buildFirstRound(seeded);
  const played = [];
  const finalists = [];
  for (let r = 1; r <= roundCount(size); r++) {
    const decided = round.map((m) => {
      if (m.isBye) return { ...m, winnerId: m.playerA ?? m.playerB };
      const outcome = decideMatch({ resultA: { score: 1, totalMs: 1 }, resultB: { score: 1, totalMs: 1 }, seedA: seedOf(m.playerA), seedB: seedOf(m.playerB) });
      played.push(m);
      return { ...m, winnerId: outcome.winner === 'a' ? m.playerA : m.playerB };
    });
    if (r === roundCount(size)) {
      finalists.push(decided[0].playerA, decided[0].playerB);
      return { champion: decided[0].winnerId, played, finalists };
    }
    round = pairNextRound(decided);
  }
  return null;
}

test('with the better seed winning every match, seed 1 wins and the finalists are seeds 1 and 2', () => {
  for (let count = 3; count <= 16; count++) {
    const { champion, finalists } = playOut(count);
    assert.equal(champion, ids(count)[0], `${count} players`);
    assert.deepEqual([...finalists].sort((a, b) => a - b), ids(count).slice(0, 2), `${count} players: the top two met too soon`);
  }
});

test('a knockout of n players plays exactly n - 1 real matches', () => {
  for (let count = 3; count <= 16; count++) assert.equal(playOut(count).played.length, count - 1, `${count} players`);
});

test('seeding depends only on the tournament, not on the order the players are listed in', () => {
  const players = [40, 7, 19, 3, 88, 21];
  const a = seedPlayers(players, 12);
  assert.deepEqual(seedPlayers([...players].reverse(), 12), a);
  assert.deepEqual([...a].sort((x, y) => x - y), [...players].sort((x, y) => x - y), 'nobody is lost or added');
  assert.notDeepEqual(seedPlayers(players, 13), a, 'a different tournament seeds differently');
});

test('seeding is not simply the order of joining or of id', () => {
  const players = Array.from({ length: 16 }, (_, i) => i + 1);
  const seeds = new Set();
  for (let t = 1; t <= 20; t++) seeds.add(seedPlayers(players, t)[0]);
  assert.ok(seeds.size > 5, 'seed 1 is always the same player');
});

const r = (score, totalMs) => ({ score, totalMs });

test('a match goes to the higher score, then the faster time, then the better seed', () => {
  assert.deepEqual(decideMatch({ resultA: r(900, 5000), resultB: r(800, 1000), seedA: 2, seedB: 1 }), { winner: 'a', decidedBy: 'score' });
  assert.deepEqual(decideMatch({ resultA: r(700, 5000), resultB: r(800, 9000), seedA: 1, seedB: 2 }), { winner: 'b', decidedBy: 'score' });
  assert.deepEqual(decideMatch({ resultA: r(800, 9000), resultB: r(800, 7000), seedA: 1, seedB: 2 }), { winner: 'b', decidedBy: 'time' });
  assert.deepEqual(decideMatch({ resultA: r(800, 7000), resultB: r(800, 7000), seedA: 3, seedB: 2 }), { winner: 'b', decidedBy: 'seed' });
});

test('a no-show loses to a player who played, and two no-shows go to the better seed', () => {
  assert.deepEqual(decideMatch({ resultA: null, resultB: r(0, 30000), seedA: 1, seedB: 2 }), { winner: 'b', decidedBy: 'no_show' });
  assert.deepEqual(decideMatch({ resultA: r(0, 30000), resultB: null, seedA: 2, seedB: 1 }), { winner: 'a', decidedBy: 'no_show' });
  assert.deepEqual(decideMatch({ resultA: null, resultB: null, seedA: 4, seedB: 2 }), { winner: 'b', decidedBy: 'no_show' });
  assert.deepEqual(decideMatch({ resultA: null, resultB: null, seedA: 2, seedB: 4 }), { winner: 'a', decidedBy: 'no_show' });
});

test('a player who played and scored nothing still beats one who did not play', () => {
  assert.equal(decideMatch({ resultA: r(0, 1), resultB: null, seedA: 9, seedB: 1 }).winner, 'a');
});
