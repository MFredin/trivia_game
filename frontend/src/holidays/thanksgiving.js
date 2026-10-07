// Thanksgiving: the harvest table
//
// The page is a table seen from above: wood planks, a leaf garland along the top, tea lights, a place setting, cranberries, a basket and a pie in the margins. On a phone: a leaf-and-berry vine, a falling leaf and gourds on every plate, leaves down the gutters, and a laid table at the end of the page.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols the others `<use>`; `backdrop` is the
// fixed layer (the washes, the margin scene from 1280px up, and the drifters in the two gutters); `dressing` is what sits on each plate's
// edges; `foot` is the scene at the end of the page. They are strings rather than JSX because they are static decoration with no state or
// events and a few hundred nodes, which React would otherwise reconcile on every render of every plate for nothing. Nothing in them ever
// comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-thanksgiving.css (shared rules: holiday-overlay.css).
import { rng } from './shared.js';

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  "<symbol id=\"leafsym\" viewBox=\"0 0 100 100\"><path fill=\"currentColor\" d=\"M50 2 C60 14 64 18 76 20 C74 30 80 34 90 40 C80 46 80 52 86 62 C74 62 68 68 66 80 C58 76 54 80 50 92 C46 80 42 76 34 80 C32 68 26 62 14 62 C20 52 20 46 10 40 C20 34 26 30 24 20 C36 18 40 14 50 2 Z\"/><path d=\"M50 12 L50 99 M50 40 L34 28 M50 40 L66 28 M50 58 L28 46 M50 58 L72 46\" stroke=\"rgba(0,0,0,.3)\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\"/></symbol>" +
  '</defs></svg>';

/* ---------- Thanksgiving pieces ---------- */
function leafUse(x, y, size, rot, color) { return '<use href="#leafsym" x="' + (-size / 2) + '" y="' + (-size / 2) + '" width="' + size + '" height="' + size + '" transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')" style="color:var(--leaf' + color + ')"/>'; }
const rg = rng(7);
let GARLAND = '<div class="hol-vine"></div>';
for (let gi = 0; gi < 22; gi++) { const gx = (gi * 4.6 + 1.2).toFixed(1); GARLAND += '<div class="hol-gl" style="left:' + gx + '%;--c:var(--leaf' + (1 + gi % 4) + ');--d:-' + (rg() * 5).toFixed(1) + 's"><svg viewBox="0 0 100 100" style="transform:rotate(' + Math.round((rg() - .5) * 40) + 'deg)"><use href="#leafsym"/></svg></div>'; if (gi % 3 === 1) GARLAND += '<i class="hol-gberry" style="left:calc(' + gx + '% + 24px)"></i>'; }
function tealight(l, t, d) { return '<div class="tealight hol-margin" style="left:' + l + 'px;top:' + t + 'px;--d:-' + d + 's"><i class="tl-pool"></i><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="var(--brass)"/><circle cx="20" cy="20" r="14.5" fill="var(--linen)" opacity=".92"/><circle cx="20" cy="20" r="8" fill="var(--candle)"/></svg><i class="tl-flame"></i></div>'; }
const PLACE = '<div class="hol-item hol-margin" style="right:6px;top:150px;width:106px"><svg viewBox="0 0 110 92"><rect x="2" y="8" width="26" height="50" rx="2" fill="var(--napkin)"/><circle cx="58" cy="46" r="31" fill="var(--linen)"/><circle cx="58" cy="46" r="23" fill="none" stroke="var(--linen2)" stroke-width="1.6"/><circle cx="58" cy="46" r="15" fill="var(--linen2)" opacity=".45"/>' +
  '<g stroke="var(--brass)" stroke-width="3" stroke-linecap="round" fill="none"><path d="M15 26 L15 84"/><path d="M9 10 L9 28 M15 10 L15 28 M21 10 L21 28"/><path d="M9 28 Q15 34 21 28"/><path d="M103 12 C109 24 109 48 103 60 L103 86"/></g></svg></div>';
const rb = rng(13);
let BERRIES = ''; for (let bi = 0; bi < 26; bi++) { const ba = rb() * Math.PI * 2, br = Math.sqrt(rb()) * 29; BERRIES += '<circle cx="' + (50 + Math.cos(ba) * br).toFixed(1) + '" cy="' + (50 + Math.sin(ba) * br).toFixed(1) + '" r="5.2" fill="var(--berry)"/><circle cx="' + (48.4 + Math.cos(ba) * br).toFixed(1) + '" cy="' + (48.2 + Math.sin(ba) * br).toFixed(1) + '" r="1.4" fill="#fff" opacity=".35"/>'; }
const BOWL = '<div class="hol-item hol-margin" style="right:12px;top:312px;width:96px"><svg viewBox="0 0 100 100"><circle cx="52" cy="54" r="46" fill="#000" opacity=".25"/><circle cx="50" cy="50" r="46" fill="var(--china)"/><circle cx="50" cy="50" r="38" fill="var(--filling)"/>' + BERRIES + '</svg></div>';
const SCATTER = '<div class="hol-item hol-margin" style="left:6px;top:330px;width:120px;height:170px"><svg viewBox="0 0 120 170">' + leafUse(36, 30, 40, -30, 1) + leafUse(86, 62, 34, 50, 2) + leafUse(28, 100, 36, 110, 3) + leafUse(80, 128, 30, -70, 4) + leafUse(56, 156, 28, 20, 1) +
  '<g><ellipse cx="96" cy="22" rx="8" ry="11" fill="#b9873f"/><path d="M87 18 Q96 6 105 18 Z" fill="var(--wicker2)"/><ellipse cx="22" cy="140" rx="8" ry="11" fill="#b9873f" transform="rotate(40 22 140)"/><path d="M13 136 Q22 124 31 136 Z" fill="var(--wicker2)" transform="rotate(40 22 140)"/></g></svg></div>';
const BASKET = '<div class="hol-item hol-margin" style="left:-6px;bottom:16px;width:150px"><svg viewBox="0 0 140 140"><circle cx="72" cy="74" r="62" fill="#000" opacity=".28"/><circle cx="70" cy="70" r="62" fill="var(--wicker2)"/><circle cx="70" cy="70" r="57" fill="var(--wicker)"/>' +
  '<circle cx="70" cy="70" r="51" fill="none" stroke="var(--wicker2)" stroke-width="3" stroke-dasharray="7 5"/><circle cx="70" cy="70" r="45" fill="none" stroke="var(--wicker2)" stroke-width="3" stroke-dasharray="7 5" stroke-dashoffset="6"/><circle cx="70" cy="70" r="39" fill="var(--pit)"/>' +
  '<ellipse cx="55" cy="66" rx="12" ry="25" fill="var(--pumpkin2)"/><ellipse cx="81" cy="66" rx="12" ry="25" fill="var(--pumpkin2)"/><ellipse cx="68" cy="66" rx="15" ry="25" fill="var(--pumpkin)"/><rect x="65.5" y="38" width="5" height="9" rx="2" fill="var(--stem)"/>' +
  '<circle cx="94" cy="50" r="11" fill="var(--apple)"/><circle cx="91" cy="46" r="3" fill="#fff" opacity=".3"/><circle cx="98" cy="80" r="11" fill="var(--apple)"/><circle cx="95" cy="76" r="3" fill="#fff" opacity=".3"/>' +
  '<g fill="var(--grape)"><circle cx="38" cy="88" r="5.4"/><circle cx="47" cy="90" r="5.4"/><circle cx="33" cy="97" r="5.4"/><circle cx="42" cy="99" r="5.4"/><circle cx="51" cy="100" r="5.4"/><circle cx="38" cy="108" r="5.4"/><circle cx="46" cy="110" r="5.4"/></g>' +
  leafUse(118, 36, 30, 30, 2) + leafUse(22, 40, 28, -50, 1) + leafUse(76, 126, 28, 170, 3) + leafUse(30, 126, 26, 120, 4) +
  '<g stroke="var(--wheat)" stroke-width="2" stroke-linecap="round"><path d="M14 82 L62 30"/><path d="M18 90 L68 36"/></g><g fill="var(--wheat)"><ellipse cx="60" cy="32" rx="3" ry="7" transform="rotate(45 60 32)"/><ellipse cx="66" cy="38" rx="3" ry="7" transform="rotate(45 66 38)"/></g></svg></div>';
function steamCurl(x, d) { return '<div class="hol-steam hol-margin hol-mover" style="left:' + x + 'px;top:-30px;--d:-' + d + 's"><svg viewBox="0 0 18 40"><path d="M9 38 C0 28 16 22 9 12 C5 6 10 2 9 0" fill="none" stroke="rgba(var(--steam-rgb), .7)" stroke-width="2.4" stroke-linecap="round"/></svg></div>'; }
const PIE = '<div class="hol-item hol-margin" style="right:8px;bottom:22px;width:104px"><svg viewBox="0 0 100 100"><defs><clipPath id="pieclip"><circle cx="50" cy="50" r="35"/></clipPath></defs><ellipse cx="53" cy="55" rx="46" ry="44" fill="#000" opacity=".3"/><circle cx="50" cy="50" r="45" fill="var(--crust)"/><circle cx="50" cy="50" r="43" fill="none" stroke="var(--crust2)" stroke-width="4" stroke-dasharray="3.4 3.4"/><circle cx="50" cy="50" r="36" fill="var(--filling)"/>' +
  '<g clip-path="url(#pieclip)" stroke="var(--crust)" stroke-width="5.5"><g><path d="M-10 22 L110 22 M-10 36 L110 36 M-10 50 L110 50 M-10 64 L110 64 M-10 78 L110 78"/></g><g transform="rotate(90 50 50)"><path d="M-10 22 L110 22 M-10 36 L110 36 M-10 50 L110 50 M-10 64 L110 64 M-10 78 L110 78"/></g></g></svg>' +
  steamCurl(24, 0) + steamCurl(44, 2.2) + steamCurl(64, 4.3) + '</div>';
function thScene() { return '<div class="hol-scene th"><div class="hol-planks"></div><div class="warm-vig"></div>' + GARLAND + tealight(26, 118, 0) + tealight(76, 96, 1.1) + tealight(54, 168, 2.2) + PLACE + BOWL + SCATTER + BASKET + PIE + GLEAVES + '</div>'; }
const rl = rng(19);
let GLEAVES = '';
[['l', 3], ['r', 3]].forEach(function (g) { let s = ''; for (let i = 0; i < g[1]; i++) s += '<div class="gleaf hol-mover" style="left:' + (g[0] === 'l' ? 1 : 2) + 'px;--c:var(--leaf' + (1 + (i + (g[0] === 'l' ? 0 : 2)) % 4) + ');--t:' + (13 + Math.round(rl() * 8)) + 's;--d:-' + (rl() * 14).toFixed(1) + 's"><svg viewBox="0 0 100 100"><use href="#leafsym"/></svg></div>'; GLEAVES += '<div class="hol-gut ' + g[0] + '">' + s + '</div>'; });

function dressing() {
  return '<span class="hol-pd hol-prop pd-leaf"><svg viewBox="0 0 100 100">' + '<use href="#leafsym" width="100" height="100" style="color:var(--leaf1)"/></svg></span>' +
      '<span class="hol-pd hol-prop pd-sprig"><svg viewBox="0 0 100 52"><path d="M98 8 C80 4 62 14 48 24 C36 32 22 34 8 28" fill="none" stroke="var(--vine)" stroke-width="2.4" stroke-linecap="round"/>' +
      leafUse(80, 8, 20, 20, 2) + leafUse(64, 20, 20, 150, 3) + leafUse(48, 28, 20, 30, 1) + leafUse(32, 38, 20, 170, 4) + leafUse(16, 30, 18, 60, 2) +
      '<circle cx="72" cy="14" r="3.4" fill="var(--berry)"/><circle cx="56" cy="30" r="3.4" fill="var(--berry)"/><circle cx="40" cy="22" r="3.4" fill="var(--berry)"/></svg></span>' +
      '<span class="hol-pd hol-prop pd-gourds"><svg viewBox="0 0 104 38"><g stroke="var(--wheat)" stroke-width="1.8" stroke-linecap="round"><path d="M12 36 L26 6"/><path d="M18 36 L34 8"/></g><g fill="var(--wheat)"><ellipse cx="26" cy="7" rx="2.6" ry="6" transform="rotate(25 26 7)"/><ellipse cx="34" cy="9" rx="2.6" ry="6" transform="rotate(30 34 9)"/></g>' +
      '<ellipse cx="52" cy="26" rx="14" ry="11" fill="var(--pumpkin2)"/><ellipse cx="52" cy="26" rx="10" ry="11" fill="var(--pumpkin)"/><rect x="50" y="12" width="4" height="6" rx="1.5" fill="var(--stem)"/>' +
      '<ellipse cx="78" cy="29" rx="14" ry="8" fill="var(--gourd2-d)"/><ellipse cx="78" cy="28" rx="12" ry="8" fill="var(--gourd2)"/><rect x="76.5" y="18" width="3" height="5" rx="1" fill="var(--stem)"/>' +
      '<circle cx="96" cy="31" r="6" fill="var(--pumpkin2)"/><circle cx="96" cy="30" r="5" fill="var(--pumpkin)"/></svg></span>';
}

function foot() {
  const plateSvg = '<svg viewBox="0 0 110 92"><rect x="2" y="12" width="20" height="44" rx="2" fill="var(--napkin)"/><circle cx="58" cy="46" r="31" fill="var(--linen)"/><circle cx="58" cy="46" r="23" fill="none" stroke="var(--linen2)" stroke-width="1.6"/><circle cx="58" cy="46" r="15" fill="var(--linen2)" opacity=".45"/><g stroke="var(--brass)" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M12 24 L12 80"/><path d="M6 12 L6 26 M12 12 L12 26 M18 12 L18 26"/><path d="M104 14 C110 26 110 48 104 60 L104 84"/></g></svg>';
  const tl = function (x, d) { return '<div class="th-ftl" style="left:' + x + '"><i class="tl-pool" style="--d:-' + d + 's"></i><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="var(--brass)"/><circle cx="20" cy="20" r="14.5" fill="var(--linen)" opacity=".92"/><circle cx="20" cy="20" r="8" fill="var(--candle)"/></svg><i class="tl-flame" style="--d:-' + d + 's"></i></div>'; };
  return '<div class="hol-foot th-foot"><div class="th-runner"></div><div class="th-fplate" style="left:3%">' + plateSvg + '</div>' + tl('30%', 0) + '<div class="th-fplate" style="left:35%">' + plateSvg + '</div>' + tl('64%', 1.4) +
    '<div class="th-fplate" style="left:68%">' + plateSvg + '</div><svg style="position:absolute;right:4px;top:22px;width:34px" viewBox="0 0 100 86"><ellipse cx="29" cy="52" rx="22" ry="29" fill="var(--pumpkin2)"/><ellipse cx="71" cy="52" rx="22" ry="29" fill="var(--pumpkin2)"/><ellipse cx="50" cy="50" rx="30" ry="32" fill="var(--pumpkin)"/><rect x="46" y="12" width="9" height="14" rx="3" fill="var(--stem)"/></svg></div>';
}

export default { defs: DEFS, backdrop: thScene(), dressing: dressing(), foot: foot() };
