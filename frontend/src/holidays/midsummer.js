// Midsummer: the longest day
//
// The sun that does not set: a flower festoon, a bee, a posy, fireflies, a maypole, a bonfire and birches under a golden horizon. From 1280px up, a low sun and a tall birch.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols the others `<use>`; `backdrop` is the
// fixed layer (the washes, the margin scene from 1280px up, and the drifters in the two gutters); `dressing` is what sits on each plate's
// edges; `foot` is the scene at the end of the page. They are strings rather than JSX because they are static decoration with no state or
// events and a few hundred nodes, which React would otherwise reconcile on every render of every plate for nothing. Nothing in them ever
// comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-midsummer.css (shared rules: holiday-overlay.css).
import { gutterOf, scVig } from './shared.js';

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  "<symbol id=\"hills\" viewBox=\"0 0 1280 150\" preserveAspectRatio=\"none\"><path d=\"M0 150 L0 96 C120 62 220 70 330 92 C450 116 520 70 650 64 C790 58 860 98 980 100 C1090 102 1180 66 1280 84 L1280 150 Z\"/></symbol>" +
  '</defs></svg>';

function msFlower(kind, x, y, r) {
  x = +x; y = +y;
  if (kind === 'daisy') { let p = ''; for (let i = 0; i < 8; i++) p += '<ellipse cx="' + x + '" cy="' + (y - r * .62) + '" rx="' + (r * .26) + '" ry="' + (r * .5) + '" fill="var(--daisy)" transform="rotate(' + i * 45 + ' ' + x + ' ' + y + ')"/>'; return p + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * .3) + '" fill="var(--gold)"/>'; }
  if (kind === 'corn') { let q = ''; for (let j = 0; j < 5; j++) q += '<ellipse cx="' + x + '" cy="' + (y - r * .6) + '" rx="' + (r * .28) + '" ry="' + (r * .52) + '" fill="var(--corn)" transform="rotate(' + j * 72 + ' ' + x + ' ' + y + ')"/>'; return q + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * .2) + '" fill="#23336a"/>'; }
  return '<circle cx="' + (x - r * .34) + '" cy="' + (y - r * .2) + '" r="' + (r * .52) + '" fill="var(--poppy)"/><circle cx="' + (x + r * .34) + '" cy="' + (y - r * .2) + '" r="' + (r * .52) + '" fill="var(--poppy)"/><circle cx="' + (x - r * .2) + '" cy="' + (y + r * .3) + '" r="' + (r * .5) + '" fill="var(--poppy)"/><circle cx="' + (x + r * .2) + '" cy="' + (y + r * .3) + '" r="' + (r * .5) + '" fill="var(--poppy)"/><circle cx="' + x + '" cy="' + y + '" r="' + (r * .2) + '" fill="#2a1410"/>';
}
function msScene() {
  const tree = '<svg class="ms-tree hol-margin" viewBox="0 0 118 380"><path d="M20 380 C22 300 18 220 24 130 C26 90 30 50 28 6" fill="none" stroke="var(--birch)" stroke-width="12" stroke-linecap="round"/><g stroke="#3a3a30" stroke-width="2.2" stroke-linecap="round"><path d="M16 340 L24 340 M17 290 L25 291 M16 238 L23 237 M18 180 L26 181 M19 130 L26 130 M20 80 L27 79"/></g><path d="M26 120 C50 100 70 96 96 92 M24 190 C54 176 78 176 104 168 M26 60 C50 44 70 40 92 38" fill="none" stroke="var(--birch)" stroke-width="5" stroke-linecap="round"/>' +
    [[96, 92, 0], [104, 168, 1], [92, 38, 2], [60, 104, 3], [70, 182, 4]].map(function (l) { return '<g class="lv" style="animation-delay:-' + l[2] * .9 + 's"><ellipse cx="' + l[0] + '" cy="' + (l[1] + 12) + '" rx="9" ry="16" fill="var(--leaf)"/><ellipse cx="' + (l[0] - 10) + '" cy="' + (l[1] + 8) + '" rx="7" ry="13" fill="var(--leaf2)"/><ellipse cx="' + (l[0] + 8) + '" cy="' + (l[1] + 20) + '" rx="6" ry="11" fill="var(--leaf)"/></g>'; }).join('') + '</svg>';
  return '<div class="hol-scene ms">' + scVig() + '<div class="ms-sun hol-margin"></div>' + tree +
    gutterOf(6, function (r) { return '<i class="gfire hol-mover" style="--gx:' + (1 + Math.round(r() * 9)) + 'px;--wx:' + (Math.round(r() * 8) - 4) + 'px;--t:' + (12 + Math.round(r() * 8)) + 's;--d:-' + (r() * 16).toFixed(1) + 's"></i>'; }, 61) + '</div>';
}
function msDressing() {
  let fest = '';
  const pts = [[.14, 'daisy', 7.5], [.28, 'corn', 7], [.42, 'poppy', 8], [.56, 'daisy', 7.5], [.7, 'corn', 7], [.84, 'poppy', 7.5]];
  function bez(t) { const x0 = 130, y0 = 3, x1 = 108, y1 = 46, x2 = 42, y2 = 50, x3 = 4, y3 = 8, m = 1 - t; return [m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3, m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3]; }
  for (let i = 1; i <= 9; i++) { const b = bez(i / 10); fest += '<ellipse cx="' + b[0].toFixed(1) + '" cy="' + (b[1] + 5).toFixed(1) + '" rx="6.4" ry="3" fill="var(--leaf)" transform="rotate(' + (i % 2 ? 40 : -40) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + ')"/>'; }
  pts.forEach(function (p) { const b = bez(p[0]); fest += msFlower(p[1], b[0].toFixed(1), b[1].toFixed(1), p[2]); });
  let posy = ''; [['daisy', 12, 16, 7], ['corn', 22, 7, 6], ['poppy', 34, 6, 6.5], ['daisy', 46, 16, 7], ['corn', 29, 19, 6], ['poppy', 18, 28, 6], ['daisy', 40, 28, 6.5]].forEach(function (f) { posy += '<path d="M' + f[1] + ' ' + f[2] + ' L29 46" stroke="var(--leaf2)" stroke-width="1.6"/>'; });
  [['daisy', 12, 16, 7], ['corn', 22, 7, 6], ['poppy', 34, 6, 6.5], ['daisy', 46, 16, 7], ['corn', 29, 19, 6], ['poppy', 18, 28, 6], ['daisy', 40, 28, 6.5]].forEach(function (f) { posy += msFlower(f[0], f[1], f[2], f[3]); });
  return '<span class="hol-pd hol-prop pd-festoon"><svg viewBox="0 0 134 58"><path d="M130 3 C108 46 42 50 4 8" fill="none" stroke="var(--leaf2)" stroke-width="3.2" stroke-linecap="round"/>' + fest + '<path d="M130 3 C124 22 132 34 126 54" fill="none" stroke="var(--rose)" stroke-width="3" stroke-linecap="round"/><path d="M128 4 C136 20 128 36 133 52" fill="none" stroke="var(--daisy)" stroke-width="2.4" stroke-linecap="round"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-bee hol-mover"><svg viewBox="0 0 22 16"><ellipse class="wing" cx="9" cy="4.4" rx="4.4" ry="3.2" fill="#fff" opacity=".75"/><ellipse class="wing" cx="14.4" cy="4.4" rx="4.4" ry="3.2" fill="#fff" opacity=".75"/><ellipse cx="11" cy="10" rx="7" ry="4.8" fill="var(--gold)"/><path d="M8 6 L8 14 M12 5.6 L12 14.4 M16 6.4 L16 13.6" stroke="#2a1d0a" stroke-width="2"/><path d="M18 10 L21 10" stroke="#2a1d0a" stroke-width="1.4"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-posy"><svg viewBox="0 0 58 56">' + posy + '<path d="M29 46 C20 40 16 50 22 54 C26 56 28 50 29 46Z M29 46 C38 40 42 50 36 54 C32 56 30 50 29 46Z" fill="var(--rose)"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-daisies"><svg viewBox="0 0 62 30"><path d="M12 30 L12 10 M30 30 L30 8 M50 30 L50 11" stroke="var(--leaf2)" stroke-width="2" stroke-linecap="round"/>' + msFlower('daisy', 12, 8, 6.5) + msFlower('corn', 30, 6, 6.5) + msFlower('daisy', 50, 9, 6.5) + '</svg></span>';
}
function msFoot() {
  const birch = function (x, h) { return '<div class="ms-birch" style="left:' + x + ';height:' + h + 'px"><svg viewBox="0 0 26 90" height="' + h + '" preserveAspectRatio="xMidYMax meet"><rect x="9" y="14" width="8" height="76" fill="var(--birch)"/><path d="M9 30 L14 30 M12 46 L17 46 M9 62 L14 62 M11 78 L17 78" stroke="#3a3a30" stroke-width="1.8"/><ellipse cx="13" cy="10" rx="9" ry="11" fill="var(--leaf2)"/><ellipse cx="8" cy="18" rx="6" ry="8" fill="var(--leaf)"/><ellipse cx="19" cy="17" rx="5.6" ry="7" fill="var(--leaf)"/></svg></div>'; };
  const fl = [[8, 'var(--daisy)'], [14, 'var(--rose)'], [26, 'var(--corn)'], [34, 'var(--poppy)'], [44, 'var(--gold)'], [52, 'var(--daisy)'], [70, 'var(--rose)'], [78, 'var(--corn)'], [86, 'var(--daisy)'], [90, 'var(--poppy)']].map(function (f, i) { return '<i class="ms-fl" style="left:' + f[0] + '%;bottom:' + (6 + (i * 5) % 12) + 'px;--c:' + f[1] + '"></i>'; }).join('');
  const pole = '<div class="ms-pole"><svg viewBox="0 0 72 96"><rect x="33.5" y="14" width="5" height="82" fill="var(--birch)"/><g fill="var(--leaf)"><ellipse cx="30" cy="34" rx="5" ry="2.6"/><ellipse cx="42" cy="38" rx="5" ry="2.6"/><ellipse cx="30" cy="52" rx="5" ry="2.6"/><ellipse cx="42" cy="56" rx="5" ry="2.6"/><ellipse cx="30" cy="70" rx="5" ry="2.6"/><ellipse cx="42" cy="74" rx="5" ry="2.6"/></g><rect x="8" y="26" width="56" height="4" rx="2" fill="var(--birch)"/>' +
    '<circle cx="10" cy="40" r="7.5" fill="none" stroke="var(--leaf2)" stroke-width="3.4"/><circle cx="62" cy="40" r="7.5" fill="none" stroke="var(--leaf2)" stroke-width="3.4"/><circle cx="36" cy="10" r="6" fill="none" stroke="var(--leaf2)" stroke-width="3.2"/><circle cx="36" cy="10" r="2.4" fill="var(--gold)"/><circle cx="10" cy="32.6" r="2" fill="var(--daisy)"/><circle cx="62" cy="32.6" r="2" fill="var(--rose)"/><circle cx="4" cy="42" r="2" fill="var(--poppy)"/><circle cx="68" cy="42" r="2" fill="var(--corn)"/>' +
    '<g class="rib"><path d="M8 30 C2 46 14 58 8 82" fill="none" stroke="var(--rose)" stroke-width="2.6" stroke-linecap="round"/></g><g class="rib" style="animation-delay:-1.6s"><path d="M64 30 C70 46 58 58 64 82" fill="none" stroke="var(--corn)" stroke-width="2.6" stroke-linecap="round"/></g></svg></div>';
  const fire = '<div class="ms-fire"><i class="sc-pool" style="top:40%"></i><svg viewBox="0 0 44 44"><path d="M4 42 L38 32" stroke="#4a2c14" stroke-width="5" stroke-linecap="round"/><path d="M6 32 L40 42" stroke="#5a3718" stroke-width="5" stroke-linecap="round"/><path class="fl" d="M22 4 C34 16 36 28 22 38 C8 28 10 16 22 4Z" fill="var(--fire)"/><path class="fl" style="animation-delay:-.7s" d="M22 14 C29 22 30 30 22 36 C14 30 15 22 22 14Z" fill="var(--sun)"/><circle class="sp" cx="14" cy="14" r="1.6" fill="var(--sun)"/><circle class="sp" style="--sx:-6px;animation-delay:-1.1s" cx="28" cy="12" r="1.4" fill="var(--fire)"/><circle class="sp" style="--sx:8px;animation-delay:-2s" cx="22" cy="8" r="1.4" fill="var(--sun)"/></svg></div>';
  return '<div class="hol-foot ms-foot"><svg class="ms-hill" viewBox="0 0 1280 150" preserveAspectRatio="none"><use href="#hills"/></svg>' + birch('2%', 84) + birch('92%', 76) + fl + fire + pole + '</div>';
}

export default { defs: DEFS, backdrop: msScene(), dressing: msDressing(), foot: msFoot() };
