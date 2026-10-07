// Halloween: the night landscape
//
// A night sky with a moon, a witch and bats, fog, a tree, gravestones and pumpkins. On a phone: a cobweb, a lowering spider, a hanging bat and a lit jack-o'lantern on every plate, and a graveyard at the end of the page.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols the others `<use>`; `backdrop` is the
// fixed layer (the washes, the margin scene from 1280px up, and the drifters in the two gutters); `dressing` is what sits on each plate's
// edges; `foot` is the scene at the end of the page. They are strings rather than JSX because they are static decoration with no state or
// events and a few hundred nodes, which React would otherwise reconcile on every render of every plate for nothing. Nothing in them ever
// comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-halloween.css (shared rules: holiday-overlay.css).
import { rng } from './shared.js';


/* ===================== the phone-first tiers ===================== */
const rs3 = rng(11);
let HWSTARS = ''; for (let hs = 0; hs < 26; hs++) HWSTARS += '<i class="hw-star" style="left:' + (rs3() * 98).toFixed(1) + '%;top:' + Math.round(rs3() * 200) + 'px;--d:-' + (rs3() * 3.4).toFixed(2) + 's"></i>';
// The cobweb: spokes from the corner and sagging rings between them, from a fixed seed so every web is the same web.
const WEB = (function () {
  let seed = 7; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  const angles = [0, 16, 33, 51, 70, 90].map(function (a) { return a * Math.PI / 180; });
  const radii = [26, 54, 86, 120, 154, 188];
  let d = '';
  angles.forEach(function (a, i) { const R = (i === 0 || i === angles.length - 1) ? 196 : 176 + r() * 18; d += 'M0 0 L' + (Math.cos(a) * R).toFixed(1) + ' ' + (Math.sin(a) * R).toFixed(1) + ' '; });
  radii.forEach(function (rr) { for (let i = 0; i < angles.length - 1; i++) { const r1 = rr * (.96 + r() * .08), r2 = rr * (.96 + r() * .08), mid = (angles[i] + angles[i + 1]) / 2, rc = rr * .8;
    d += 'M' + (Math.cos(angles[i]) * r1).toFixed(1) + ' ' + (Math.sin(angles[i]) * r1).toFixed(1) + ' Q' + (Math.cos(mid) * rc).toFixed(1) + ' ' + (Math.sin(mid) * rc).toFixed(1) + ' ' + (Math.cos(angles[i + 1]) * r2).toFixed(1) + ' ' + (Math.sin(angles[i + 1]) * r2).toFixed(1) + ' '; } });
  return '<symbol id="web" viewBox="0 0 200 200"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="' + d + '"/></symbol>';
})();

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' + WEB +
  "<symbol id=\"spider\" viewBox=\"0 0 60 60\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M26 28 L14 17 L5 23\"/><path d=\"M25 31 L9 28 L3 37\"/><path d=\"M25 34 L11 41 L7 52\"/><path d=\"M27 37 L18 47 L15 57\"/><path d=\"M34 28 L46 17 L55 23\"/><path d=\"M35 31 L51 28 L57 37\"/><path d=\"M35 34 L49 41 L53 52\"/><path d=\"M33 37 L42 47 L45 57\"/></g><ellipse cx=\"30\" cy=\"36\" rx=\"8\" ry=\"10\" fill=\"currentColor\"/><circle cx=\"30\" cy=\"25\" r=\"5\" fill=\"currentColor\"/><path d=\"M30 31 L27.6 36 L30 41 L32.4 36 Z\" fill=\"var(--spider-mark, #b13a1d)\"/><circle cx=\"28\" cy=\"23.6\" r=\"1.2\" fill=\"var(--spider-eye, #ffd27a)\"/><circle cx=\"32\" cy=\"23.6\" r=\"1.2\" fill=\"var(--spider-eye, #ffd27a)\"/></symbol><symbol id=\"pumpkin\" viewBox=\"0 0 100 86\"><ellipse cx=\"29\" cy=\"52\" rx=\"22\" ry=\"29\" fill=\"var(--pumpkin-deep)\"/><ellipse cx=\"71\" cy=\"52\" rx=\"22\" ry=\"29\" fill=\"var(--pumpkin-deep)\"/><ellipse cx=\"50\" cy=\"50\" rx=\"30\" ry=\"32\" fill=\"var(--pumpkin)\"/><path d=\"M36 21 C25 38 25 66 37 80 M64 21 C75 38 75 66 63 80\" fill=\"none\" stroke=\"var(--pumpkin-deep)\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path d=\"M45 21 C45 13 49 8 54 4 L59 8 C56 12 55 16 57 21 Z\" fill=\"var(--stem)\"/><g fill=\"var(--candle)\" stroke=\"var(--candle)\" stroke-linejoin=\"round\"><g stroke-width=\"7\" opacity=\".28\"><path d=\"M31 49 L37 38 L43 49Z\"/><path d=\"M57 49 L63 38 L69 49Z\"/><path d=\"M47 54 L50 48 L53 54Z\"/><path d=\"M29 60 C38 74 62 74 71 60 L66 59 L62 64 L57 60 L50 67 L43 60 L38 64 L34 59Z\"/></g><g stroke-width=\"1.4\"><path d=\"M31 49 L37 38 L43 49Z\"/><path d=\"M57 49 L63 38 L69 49Z\"/><path d=\"M47 54 L50 48 L53 54Z\"/><path d=\"M29 60 C38 74 62 74 71 60 L66 59 L62 64 L57 60 L50 67 L43 60 L38 64 L34 59Z\"/></g></g></symbol><symbol id=\"witch\" viewBox=\"0 -16 200 126\"><g fill=\"currentColor\" stroke=\"var(--witch-rim)\" stroke-width=\"1\" stroke-linejoin=\"round\"><path d=\"M33 77 L9 66 L2 76 L7 87 L16 93 L38 80 Z\"/><path d=\"M96 73 C98 55 112 41 130 37 C141 35 147 43 143 51 C139 59 141 67 151 73 C131 82 110 82 96 73 Z\"/><path d=\"M96 73 C80 71 66 77 54 92 C73 85 90 86 106 82 Z\"/><circle cx=\"136\" cy=\"30\" r=\"9\"/><path d=\"M144 29 L152 33 L144 36 Z\"/><path d=\"M128 32 C116 34 106 41 98 52 C111 47 122 45 131 40 Z\"/><path d=\"M118 74 L111 91 L121 94 L127 77 Z\"/><ellipse cx=\"136\" cy=\"22\" rx=\"20\" ry=\"4.2\" transform=\"rotate(-10 136 22)\"/><path d=\"M124 21 C126 8 118 0 105 -11 C128 -9 139 7 145 21 Z\"/></g><path d=\"M32 78 L190 51\" stroke=\"currentColor\" stroke-width=\"4.2\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M32 78 L190 51\" stroke=\"var(--witch-rim)\" stroke-width=\".7\" fill=\"none\" opacity=\".8\"/><path d=\"M131 44 L152 58\" stroke=\"currentColor\" stroke-width=\"7\" stroke-linecap=\"round\" fill=\"none\"/></symbol><symbol id=\"bat\" viewBox=\"0 0 60 30\"><path fill=\"currentColor\" d=\"M30 13 C26 7 18 3 5 5 C9 9 11 13 10 19 C15 15 19 16 22 21 C25 17 27 16 30 20 C33 16 35 17 38 21 C41 16 45 15 50 19 C49 13 51 9 55 5 C42 3 34 7 30 13Z\"/><ellipse cx=\"30\" cy=\"15\" rx=\"3.2\" ry=\"5.2\" fill=\"currentColor\"/><path d=\"M27.5 10 L26.4 5.6 L29.6 8.6 M32.5 10 L33.6 5.6 L30.4 8.6\" fill=\"currentColor\"/></symbol><symbol id=\"moonface\" viewBox=\"0 0 100 100\"><defs><radialGradient id=\"mshade\" cx=\"40%\" cy=\"38%\" r=\"70%\"><stop offset=\"0\" stop-color=\"#000\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#000\" stop-opacity=\".34\"/></radialGradient></defs><circle cx=\"50\" cy=\"50\" r=\"48\" fill=\"var(--moon)\"/><circle cx=\"50\" cy=\"50\" r=\"48\" fill=\"url(#mshade)\"/><g fill=\"var(--moon-edge)\" opacity=\".42\"><circle cx=\"34\" cy=\"36\" r=\"8\"/><circle cx=\"62\" cy=\"58\" r=\"11\"/><circle cx=\"44\" cy=\"68\" r=\"5\"/><circle cx=\"68\" cy=\"30\" r=\"4\"/></g></symbol><symbol id=\"hills\" viewBox=\"0 0 1280 150\" preserveAspectRatio=\"none\"><path d=\"M0 150 L0 96 C120 62 220 70 330 92 C450 116 520 70 650 64 C790 58 860 98 980 100 C1090 102 1180 66 1280 84 L1280 150 Z\"/></symbol><symbol id=\"treebody\" viewBox=\"0 0 200 330\"><path d=\"M84 330 C88 290 86 250 82 210 C70 190 52 176 30 170 C22 168 18 160 24 156 C46 158 66 168 80 182 C76 150 64 126 40 106 C32 100 36 92 44 96 C66 110 80 130 88 156 C90 120 86 84 70 52 C66 44 74 40 80 48 C94 74 100 108 100 146 C108 118 124 94 150 80 C158 76 162 84 156 90 C132 106 118 130 112 166 C124 150 144 140 170 138 C178 138 178 146 170 148 C146 152 128 164 114 186 C112 230 112 280 118 330 Z\"/></symbol><symbol id=\"gravestone\" viewBox=\"0 0 26 64\"><path d=\"M3 64 L3 26 C3 6 23 6 23 26 L23 64 Z\"/></symbol>" +
  '</defs></svg>';
function hwScene() {
  const bats = '<div class="hw-bats hol-margin hol-mover">' + [['0', '30', '0'], ['44', '0', '-.7'], ['70', '54', '-1.4'], ['112', '18', '-.3']].map(function (b) { return '<div class="hw-bat" style="left:' + b[0] + 'px;top:' + b[1] + 'px;animation-delay:' + b[2] + 's"><svg viewBox="0 0 60 30"><use href="#bat"/></svg></div>'; }).join('') + '</div>';
  function pk(c) { return '<div class="hw-pk ' + c + ' hol-margin"><i class="hw-pool"></i><svg viewBox="0 0 100 86"><use href="#pumpkin"/></svg></div>'; }
  return '<div class="hol-scene hw"><div class="hw-vig"></div><div class="hw-haze"></div>' + HWSTARS + '<i class="hw-mist"></i><i class="hw-mist m2"></i>' +
    '<div class="hw-moonbox"><i class="hw-moonglow"></i><svg viewBox="0 0 100 100"><use href="#moonface"/></svg></div>' +
    '<div class="hw-witch hol-margin hol-mover"><svg viewBox="0 -16 200 126"><use href="#witch"/></svg></div>' + bats +
    '<div class="hw-eyes hol-margin" style="left:38px;top:69%;--d:-3s"><i></i><i></i></div><div class="hw-eyes hol-margin" style="right:80px;top:64%;--d:-8s"><i></i><i></i></div>' +
    '<svg class="hw-tree hol-margin" viewBox="0 0 200 330"><use href="#treebody"/></svg><div class="hw-ground"><svg viewBox="0 0 1280 150" preserveAspectRatio="none"><use href="#hills"/></svg></div>' +
    '<svg class="hw-grave g1 hol-margin" viewBox="0 0 26 64"><use href="#gravestone"/></svg><svg class="hw-grave g3 hol-margin" viewBox="0 0 26 64"><use href="#gravestone"/></svg>' + pk('a') + pk('b') + pk('c') + pk('d') +
    '<div class="hol-gut l"><div class="gspider hol-mover" style="--len:340px;--d:0s"><i class="gthread"></i><svg viewBox="0 0 60 60"><use href="#spider"/></svg></div></div>' +
    '<div class="hol-gut r">' + [['86%', -2], ['70%', -7], ['52%', -11], ['36%', -4]].map(function (w) { return '<i class="gwisp hol-mover" style="right:5px;top:' + w[0] + ';--d:' + w[1] + 's"></i>'; }).join('') + '</div></div>';
}
function dressing() {
  return '<span class="hol-pd hol-line pd-web"><svg viewBox="0 0 200 200"><use href="#web"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-bat hol-mover"><svg viewBox="0 0 60 30"><use href="#bat"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-spider hol-mover"><i class="hol-thread"></i><svg viewBox="0 0 60 60"><use href="#spider"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-pk"><i class="hw-pool"></i><svg viewBox="0 0 100 86"><use href="#pumpkin"/></svg></span>';
}

function foot() {
  const g = (l, w, h) => '<svg class="hw-fgrave" style="left:' + l + ';width:' + w + 'px;height:' + h + 'px" viewBox="0 0 26 64"><use href="#gravestone"/></svg>';
  const p = (x, w, d) => '<div class="hw-fpk" style="--x:' + x + ';--w:' + w + 'px"><i class="hw-pool" style="--d:' + d + 's"></i><svg viewBox="0 0 100 86"><use href="#pumpkin"/></svg></div>';
  return '<div class="hol-foot hw-foot"><svg class="hw-fhill" viewBox="0 0 1280 150" preserveAspectRatio="none"><use href="#hills"/></svg><svg class="hw-ftree" viewBox="0 0 200 330"><use href="#treebody"/></svg>' +
    g('26%', 14, 34) + g('47%', 17, 40) + g('79%', 15, 36) + p('9%', 36, -0.4) + p('19%', 24, -1.3) + p('60%', 40, -0.7) + p('70%', 26, -2.1) + p('90%', 32, -1.8) +
    '<div class="hw-fbat hol-mover"><svg viewBox="0 0 60 30"><use href="#bat"/></svg></div></div>';
}

export default { defs: DEFS, backdrop: hwScene(), dressing: dressing(), foot: foot() };
