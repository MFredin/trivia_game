// Helpers the holiday art modules share. Nothing here knows about a particular holiday.

// A small seeded generator: every holiday's scatter (stars, leaves, flakes, confetti) is the same on every load, so the art never shifts
// when a module is re-evaluated and a screenshot of it is repeatable.
export function rng(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
