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

// The four washes the newer holidays share: a vignette, a haze along the top, a mist along the foot and a glow on the horizon.
export function scVig() { return '<div class="sc-vig"></div><div class="sc-haze"></div><i class="sc-mist"></i><div class="sc-glow"></div>'; }
// A field of small twinkling points across the top of the sky.
export function dustField(n, seed, maxTop) { const r = rng(seed); let o = ''; for (let i = 0; i < n; i++) o += '<i class="sc-dust" style="left:' + (r() * 98).toFixed(1) + '%;top:' + Math.round(r() * maxTop) + 'px;--d:-' + (r() * 3.6).toFixed(2) + 's"></i>'; return o; }
// The drifters for the two 16px gutters, one list per side. `make(r, side, i)` returns one drifter's markup.
export function gutterOf(count, make, seed) { const r = rng(seed); let o = ''; ['l', 'r'].forEach(function (sd) { let s = ''; for (let i = 0; i < count; i++) s += make(r, sd, i); o += '<div class="hol-gut ' + sd + '">' + s + '</div>'; }); return o; }
