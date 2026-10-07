// New Year's: midnight
//
// The turn of the year: a clock a few minutes before twelve, streamers, a party hat, confetti and balloons. From 1280px up, fireworks burst in the margins.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols the others `<use>`; `backdrop` is the
// fixed layer (the washes, the margin scene from 1280px up, and the drifters in the two gutters); `dressing` is what sits on each plate's
// edges; `foot` is the scene at the end of the page. They are strings rather than JSX because they are static decoration with no state or
// events and a few hundred nodes, which React would otherwise reconcile on every render of every plate for nothing. Nothing in them ever
// comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-newyear.css (shared rules: holiday-overlay.css).
import { dustField, gutterOf, rng, scVig } from './shared.js';

const DEFS = '';

/* ===================== New Year's, Easter, Midsummer ===================== */
const NYC = ['var(--gold)', 'var(--silver)', 'var(--coral)', 'var(--teal)'];
function burst(c1, c2, side, pos, d) {
  let rays = '';
  const n = 16;
  for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, ca = Math.cos(a), sa = Math.sin(a), c = i % 2 ? c2 : c1; rays += '<line x1="' + (60 + ca * 14).toFixed(1) + '" y1="' + (60 + sa * 14).toFixed(1) + '" x2="' + (60 + ca * 42).toFixed(1) + '" y2="' + (60 + sa * 42).toFixed(1) + '" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round"/><circle cx="' + (60 + ca * 53).toFixed(1) + '" cy="' + (60 + sa * 53).toFixed(1) + '" r="2.5" fill="' + c + '"/>'; }
  for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4 + .4; rays += '<circle cx="' + (60 + Math.cos(b) * 26).toFixed(1) + '" cy="' + (60 + Math.sin(b) * 26).toFixed(1) + '" r="2" fill="var(--spark, #fff3c4)"/>'; }
  return '<div class="hol-fw hol-margin hol-mover" style="' + side + ':' + pos[0] + 'px;top:' + pos[1] + 'px;--d:-' + d + 's"><svg viewBox="0 0 120 120">' + rays + '</svg></div>';
}
function nyScene() {
  return '<div class="hol-scene ny">' + scVig() + dustField(30, 41, 240) +
    burst('var(--gold)', 'var(--coral)', 'left', [-10, 110], 0) + burst('var(--teal)', 'var(--silver)', 'left', [26, 400], 2.6) + burst('var(--coral)', 'var(--gold)', 'right', [-8, 190], 1.3) + burst('var(--silver)', 'var(--teal)', 'right', [24, 470], 3.9) +
    gutterOf(6, function (r) { return '<i class="gconf hol-mover" style="--gx:' + (1 + Math.round(r() * 9)) + 'px;--c:' + NYC[Math.floor(r() * 4)] + ';--t:' + (9 + Math.round(r() * 8)) + 's;--d:-' + (r() * 14).toFixed(1) + 's"></i>'; }, 43) + '</div>';
}
function balloon(cx, cy, c) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="15" ry="19" fill="' + c + '"/><ellipse cx="' + (cx - 5) + '" cy="' + (cy - 7) + '" rx="3.4" ry="6" fill="#fff" opacity=".32"/><path d="M' + (cx - 2.4) + ' ' + (cy + 19) + ' L' + cx + ' ' + (cy + 23) + ' L' + (cx + 2.4) + ' ' + (cy + 19) + 'Z" fill="' + c + '"/>'; }
function bunch(x, cols, d) {
  return '<div class="ny-bunch" style="--x:' + x + ';--d:-' + d + 's"><svg viewBox="0 0 92 96"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"><path d="M24 54 Q30 72 46 86"/><path d="M46 46 L46 86"/><path d="M68 56 Q62 72 46 86"/></g>' + balloon(24, 32, cols[0]) + balloon(46, 24, cols[1]) + balloon(68, 34, cols[2]) +
    '<path d="M46 86 C38 78 34 88 40 92 C44 94 46 90 46 86Z M46 86 C54 78 58 88 52 92 C48 94 46 90 46 86Z" fill="var(--gold)"/></svg></div>';
}
function nyFoot() {
  const r = rng(47);
  let conf = ''; for (let i = 0; i < 34; i++) conf += '<i class="ny-conf" style="left:' + (r() * 98).toFixed(1) + '%;bottom:' + Math.round(r() * 12) + 'px;--c:' + NYC[Math.floor(r() * 4)] + ';--r:' + Math.round(r() * 160) + 'deg"></i>';
  return '<div class="hol-foot ny-foot"><div class="ny-ground"></div>' + bunch('4%', ['var(--gold)', 'var(--coral)', 'var(--silver)'], 0) + bunch('36%', ['var(--teal)', 'var(--gold)', 'var(--coral)'], 1.6) + bunch('68%', ['var(--silver)', 'var(--teal)', 'var(--gold)'], 3.1) + conf + '</div>';
}
function nyDressing() {
  let tick = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; tick += '<line x1="' + (50 + Math.sin(a) * 31).toFixed(1) + '" y1="' + (62 - Math.cos(a) * 31).toFixed(1) + '" x2="' + (50 + Math.sin(a) * 35).toFixed(1) + '" y2="' + (62 - Math.cos(a) * 35).toFixed(1) + '" stroke="#3a2a10" stroke-width="' + (i % 3 ? 1.4 : 2.6) + '" stroke-linecap="round"/>'; }
  const cf = [['58', '8', 'var(--coral)', 20], ['66', '16', 'var(--teal)', -30], ['72', '6', 'var(--gold)', 50], ['62', '24', 'var(--silver)', 10], ['70', '26', 'var(--coral)', -20]].map(function (c) { return '<rect x="' + c[0] + '" y="' + c[1] + '" width="5" height="3.4" fill="' + c[2] + '" transform="rotate(' + c[3] + ' ' + c[0] + ' ' + c[1] + ')"/>'; }).join('');
  return '<span class="hol-pd hol-prop pd-clock hol-mover"><svg viewBox="0 0 100 130"><path d="M50 0 L50 16" stroke="var(--coral)" stroke-width="3"/><circle cx="50" cy="62" r="45" fill="var(--gold2)"/><circle cx="50" cy="62" r="42" fill="var(--gold)"/><circle cx="50" cy="62" r="37" fill="#f6efdc"/>' + tick +
    '<path d="M50 62 L47 36" stroke="#2a1d0a" stroke-width="3.4" stroke-linecap="round"/><path d="M50 62 L41 28" stroke="#2a1d0a" stroke-width="2.4" stroke-linecap="round"/><line class="sweep" x1="50" y1="62" x2="50" y2="26" stroke="var(--coral)" stroke-width="1.6" stroke-linecap="round"/><circle cx="50" cy="62" r="3.2" fill="#2a1d0a"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-streamer hol-mover"><svg viewBox="0 0 52 40"><path d="M8 0 C0 6 16 10 8 16 C0 22 16 26 8 32 C2 36 10 38 12 40" fill="none" stroke="var(--gold)" stroke-width="3.6" stroke-linecap="round"/><path d="M26 0 C18 6 34 10 26 16 C18 22 34 26 26 32" fill="none" stroke="var(--silver)" stroke-width="3.2" stroke-linecap="round"/><path d="M44 0 C36 6 52 10 44 16 C38 22 48 26 44 30" fill="none" stroke="var(--coral)" stroke-width="3" stroke-linecap="round"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-hat"><svg viewBox="0 0 78 44"><polygon points="12,40 28,6 44,40" fill="var(--coral)"/><polygon points="19,28 28,8 31,12 22,32" fill="var(--gold)"/><polygon points="26,34 30,18 34,22 31,36" fill="var(--gold)" opacity=".85"/><ellipse cx="28" cy="40" rx="17" ry="3.4" fill="var(--gold2)"/><circle cx="28" cy="6" r="4.4" fill="var(--gold)"/>' + cf + '</svg></span>';
}

export default { defs: DEFS, backdrop: nyScene(), dressing: nyDressing(), foot: nyFoot() };
