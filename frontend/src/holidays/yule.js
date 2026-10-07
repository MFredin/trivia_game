// Yule: the frosted window
//
// The page is a window on the longest night: a dark casing, frost growing in from the corners, icicles, candles on the sill and a wreath. On a phone: icicles, frost, a hanging wreath and a holly sprig on every plate, snow down the gutters, and a windowsill of candles at the end of the page.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols the others `<use>`; `backdrop` is the
// fixed layer (the washes, the margin scene from 1280px up, and the drifters in the two gutters); `dressing` is what sits on each plate's
// edges; `foot` is the scene at the end of the page. They are strings rather than JSX because they are static decoration with no state or
// events and a few hundred nodes, which React would otherwise reconcile on every render of every plate for nothing. Nothing in them ever
// comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-yule.css (shared rules: holiday-overlay.css).
import { rng } from './shared.js';

const DEFS = '';

// The frost fern: a spine with side branches, each branching again, drawn into one path string.
let fd = '';
function branch(x, y, ang, len, depth) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  fd += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1);
  if (depth <= 0) return;
  const n = Math.max(2, Math.round(len / 13));
  for (let i = 1; i <= n; i++) { const t = i / (n + 1); const bx = x + (x2 - x) * t, by = y + (y2 - y) * t, bl = len * 0.44 * (1 - t * 0.55); branch(bx, by, ang + 0.95, bl, depth - 1); branch(bx, by, ang - 0.95, bl, depth - 1); }
}
branch(3, 3, Math.PI / 4, 118, 2); branch(3, 3, Math.PI / 4 - 0.66, 78, 2); branch(3, 3, Math.PI / 4 + 0.66, 78, 2);
const FD2 = fd; fd = ''; branch(3, 3, Math.PI / 4, 118, 1); branch(3, 3, Math.PI / 4 - 0.66, 80, 1); branch(3, 3, Math.PI / 4 + 0.66, 80, 1); const FD1 = fd; fd = FD2;
function frostc(c, d, glints) { return '<div class="frostc ' + c + ' hol-margin" style="--d:-' + d + 's"><i class="glaze"></i><svg viewBox="0 0 132 132"><path d="' + fd + '"/></svg>' + glints + '</div>'; }
function glint(x, y, d) { return '<i class="hol-glint" style="left:' + x + 'px;top:' + y + 'px;--d:-' + d + 's"></i>'; }
const ric = rng(31);
let ICICLES = '';
for (let ii = 0; ii < 34; ii++) ICICLES += '<i class="hol-icicle" style="--x:' + (ii * 2.95 + ric() * 1.2).toFixed(1) + '%;--w:' + (7 + Math.round(ric() * 7)) + 'px;--h:' + (8 + Math.round(ric() * 8)) + 'px"></i>';
// the wreath: needles round a ring, holly and berries, a bow, and a ribbon to hang it by
const rw = rng(3);
let nd = '';
for (let wi = 0; wi < 52; wi++) { const a = wi / 52 * Math.PI * 2, r = 35 + (wi % 2 ? 4 : -2), cx = 60 + Math.cos(a) * r, cy = 78 + Math.sin(a) * r; nd += '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="3.4" ry="11" transform="rotate(' + (a * 180 / Math.PI + 90 + Math.round((rw() - .5) * 34)) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')" fill="var(--pine' + (wi % 3 ? 1 : 2) + ')"/>'; }
function holly(deg) { const a = deg * Math.PI / 180, x = 60 + Math.cos(a) * 36, y = 78 + Math.sin(a) * 36; return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (deg + 90) + ')"><path d="M0 0 C-9 -4 -16 -12 -10 -18 C-5 -14 -2 -8 0 0Z" fill="var(--pine2)"/><path d="M0 0 C9 -4 16 -12 10 -18 C5 -14 2 -8 0 0Z" fill="var(--pine2)"/><circle cx="-3" cy="3" r="3.3" fill="var(--berry)"/><circle cx="3" cy="4" r="3.3" fill="var(--berry)"/><circle cx="0" cy="-3" r="3.3" fill="var(--berry)"/></g>'; }
const WREATH_SVG_PLACEHOLDER = 1; const WREATH = '<div class="hol-wreath hol-margin hol-mover"><svg viewBox="0 0 120 170"><path d="M60 0 L60 24" stroke="var(--ribbon)" stroke-width="3.4"/><path d="M52 24 C52 14 68 14 68 24" fill="none" stroke="var(--ribbon)" stroke-width="3"/>' + nd + holly(-40) + holly(60) + holly(160) + holly(250) +
  '<path d="M60 118 C40 100 26 112 31 126 C36 138 52 130 60 118 Z" fill="var(--ribbon)"/><path d="M60 118 C80 100 94 112 89 126 C84 138 68 130 60 118 Z" fill="var(--ribbon)"/><path d="M57 120 L46 156 L55 150 L60 164 L63 120 Z" fill="var(--ribbon2)"/><path d="M63 120 L74 156 L65 150 L60 164 L57 120 Z" fill="var(--ribbon2)"/><circle cx="60" cy="120" r="5.4" fill="var(--ribbon2)"/></svg></div>';
const WREATH_SVG = WREATH.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
function candle(side, off, w, h, wax, d) { return '<div class="yc hol-margin" style="' + side + ':' + off + 'px;--w:' + w + 'px;--h:' + h + 'px;--cw:var(--wax' + wax + ')"><i class="yflame" style="--d:-' + d + 's"></i></div>'; }
function yuScene() {
  return '<div class="hol-scene yu"><div class="hol-hearth"></div><div class="hol-frame"></div><div class="hol-sill"></div>' + ICICLES +
    frostc('tl', 0, glint(34, 40, 0.4) + glint(78, 70, 2.1) + glint(18, 96, 3.4)) + frostc('tr', 6, glint(40, 30, 1.2) + glint(86, 84, 3) + glint(22, 70, 0.1)) +
    '<i class="ypool hol-margin" style="left:-50px;--d:0s"></i><i class="ypool hol-margin" style="right:-50px;--d:-2.3s"></i>' +
    candle('left', 16, 16, 70, 1, 0) + candle('left', 46, 18, 104, 2, 1.1) + candle('left', 80, 15, 56, 3, 2.1) +
    candle('right', 14, 15, 60, 1, 0.6) + candle('right', 42, 18, 98, 3, 1.7) + candle('right', 76, 16, 72, 2, 2.6) + WREATH + GFLAKES + '</div>';
}
const rl = rng(23);
let GFLAKES = '';
[['l', 6], ['r', 6]].forEach(function (g) { let s = ''; for (let i = 0; i < g[1]; i++) { const sz = [3, 4, 5, 6][Math.floor(rl() * 4)]; s += '<i class="gflake hol-mover" style="--gx:' + (2 + Math.round(rl() * 9)) + 'px;--s:' + sz + 'px;--t:' + (10 + Math.round(rl() * 9)) + 's;--d:-' + (rl() * 14).toFixed(1) + 's"></i>'; } GFLAKES += '<div class="hol-gut ' + g[0] + '">' + s + '</div>'; });

function dressing() {
  let ic = ''; for (let i = 0; i < 16; i++) ic += '<i class="picicle" style="--x:' + (3 + i * 5.9 + (i % 3) * 1.1).toFixed(1) + '%;--w:' + (6 + (i * 5) % 6) + 'px;--h:' + (8 + (i * 7) % 9) + 'px"></i>';
  return ic + '<span class="hol-pd hol-line pd-fern"><svg viewBox="0 0 132 132"><path d="' + FD1 + '"/></svg></span>' + '<span class="hol-pd hol-prop pd-mwreath hol-mover">' + WREATH_SVG + '</span>' + '<span class="hol-pd hol-prop pd-holly"><svg viewBox="0 0 90 36"><path d="M2 30 C20 20 40 24 60 18 C72 14 80 10 88 4" fill="none" stroke="var(--pine1)" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M30 26 C24 14 14 14 12 20 C16 26 24 28 30 26Z" fill="var(--pine2)"/><path d="M44 22 C40 10 30 8 26 14 C30 20 38 24 44 22Z" fill="var(--pine2)"/><path d="M58 18 C58 6 48 2 44 8 C46 16 52 20 58 18Z" fill="var(--pine1)"/><circle cx="60" cy="24" r="3.4" fill="var(--berry)"/><circle cx="66" cy="21" r="3.4" fill="var(--berry)"/><circle cx="63" cy="16" r="3.4" fill="var(--berry)"/>' +
    '<path d="M76 6 C70 -2 80 -6 84 0 C88 -6 98 -2 92 6 Z" fill="var(--ribbon)"/></svg></span>';
}

function foot() {
  const cand = function (x, w, h, wax, d) { return '<i class="yf-pool" style="--x:' + x + ';--d:-' + d + 's"></i><div class="yf-c" style="--x:' + x + ';--w:' + w + 'px;--h:' + h + 'px;--cw:var(--wax' + wax + ')"><i class="yflame" style="--d:-' + d + 's"></i></div>'; };
  const cone = function (x) { return '<svg class="yf-cone" style="--x:' + x + '" viewBox="0 0 24 32"><ellipse cx="12" cy="18" rx="8.5" ry="13" fill="#5a3b22"/><path d="M5 12 Q12 8 19 12 M4 18 Q12 14 20 18 M5 24 Q12 20 19 24" stroke="#3a2412" stroke-width="1.6" fill="none"/></svg>'; };
  return '<div class="hol-foot yu-foot"><div class="yf-sill"></div>' + cand('12%', 14, 44, 1, 0) + cand('22%', 16, 62, 2, 1.2) + cand('33%', 13, 36, 3, 2.2) + cone('41%') + cand('58%', 15, 52, 3, 0.7) + cand('69%', 17, 66, 1, 1.8) + cand('80%', 14, 40, 2, 2.9) + cone('89%') + '</div>';
}

export default { defs: DEFS, backdrop: yuScene(), dressing: dressing(), foot: foot() };
