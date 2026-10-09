// Yule: the snowbound longest night
//
// One composition, cropped two ways. The lighting is the idea: it is the longest night of the year and the world is blue snow under a thin green
// aurora, and the only warm things in it are the ones people lit: a lantern, a cottage's windows, the lights on a tree, and the Yule fire. Two
// clusters stand either side of the page, pinned to its edges:
//   the pines      three snow-laden firs, a lantern on a post with a snowy owl sitting on it, a stag on the ridge
//   the cottage    a cottage under a deep roof of snow, its windows lit and its chimney smoking, a wreath on the door, a fir strung with lights
//                  and crowned with a star, a stack of firewood
// Between them, on the far hills: the Yule fire in a ring of stones with its sparks going up, a line of far pines, the lit windows of a far village.
// Over everything a sky of stars and snow coming down, and in the margins of a wide screen a curtain of aurora either side of the page.
// On a wide screen the clusters stand in the empty margins either side of the 1040px page, each as wide as its margin; on a phone they stand in the
// corners of the scene at the end of the page, with the same ground and the same fire between them. Nothing differs but where they stand.
// On every plate: frost growing in a corner behind the text, a sprig of holly along the top edge, a hanging star, and a lit candle on the bottom edge.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols and gradients; `backdrop` is the
// fixed layer; `dressing` is what sits on each plate's edges; `foot` is the scene at the end of the page. They are strings rather than JSX
// because they are static decoration with no state or events, which React would otherwise reconcile on every render of every plate for nothing.
// Nothing in them ever comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-yule.css.
import { rng } from './shared.js';

const NEAR = '#12234a';
const MID = '#1c3262';
const FAR = '#34507e';
const PINE = '#08161f';
const COLD = 'rgba(176,208,255,.7)';
const SNOW = '#d9e7f8';
const SNOW_SHADE = '#9db6d8';

// A holly leaf's outline: pointed lobes along a long oval, on a 40 x 24 box.
const HOLLY = 'M2 12 L8 7 L10 2 L16 6 L20 1 L24 6 L30 2 L32 7 L38 12 L32 17 L30 22 L24 18 L20 23 L16 18 L10 22 L8 17Z';

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  // light
  '<radialGradient id="yu-lamp"><stop offset="0" stop-color="#ffd98a" stop-opacity=".78"/><stop offset=".42" stop-color="#ffb85a" stop-opacity=".24"/><stop offset="1" stop-color="#ff9a38" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="yu-fire"><stop offset="0" stop-color="#ffc060" stop-opacity=".72"/><stop offset=".4" stop-color="#ff8a30" stop-opacity=".26"/><stop offset="1" stop-color="#ff7a20" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="yu-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e0431c"/><stop offset=".5" stop-color="#ff9a30"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>' +
  // a five-pointed star on a 100 x 100 box
  '<symbol id="yu-starsym" viewBox="0 0 100 100"><path fill="currentColor" d="M50 4 L61 37 L96 37 L68 58 L79 92 L50 71 L21 92 L32 58 L4 37 L39 37Z"/></symbol>' +
  // a holly leaf, coloured by whoever uses it
  `<symbol id="yu-holly" viewBox="0 0 40 24"><path fill="currentColor" d="${HOLLY}"/><path d="M4 12 H36" stroke="rgba(0,0,0,.3)" stroke-width="1.3"/></symbol>` +
  // the snowy owl gliding with a parcel in its talons, wings spread, facing us, on a 90 x 60 box: the thing to catch. It is symmetrical, so it
  // crosses either way without a mirror image looking wrong.
  '<symbol id="yu-owl" viewBox="0 0 90 60">' +
  '<path d="M45 24 Q30 12 6 18 Q2 20 3 24 Q8 22 10 27 Q15 24 17 30 Q23 27 26 33 Q36 32 45 36Z" fill="#e6eefa"/>' +
  '<path d="M45 24 Q60 12 84 18 Q88 20 87 24 Q82 22 80 27 Q75 24 73 30 Q67 27 64 33 Q54 32 45 36Z" fill="#e6eefa"/>' +
  '<g fill="#8ea3c4"><circle cx="16" cy="22" r="1.6"/><circle cx="26" cy="25" r="1.5"/><circle cx="34" cy="28" r="1.4"/><circle cx="74" cy="22" r="1.6"/><circle cx="64" cy="25" r="1.5"/><circle cx="56" cy="28" r="1.4"/></g>' +
  '<ellipse cx="45" cy="33" rx="10" ry="14" fill="#f6f9fe"/><circle cx="45" cy="17" r="10" fill="#f6f9fe"/>' +
  '<circle cx="41" cy="16" r="3.2" fill="#f3c21a"/><circle cx="49" cy="16" r="3.2" fill="#f3c21a"/><circle cx="41" cy="16" r="1.4" fill="#111"/><circle cx="49" cy="16" r="1.4" fill="#111"/><path d="M43.4 20 L45 23 L46.6 20Z" fill="#3a3a44"/>' +
  '<path d="M45 47 V51" stroke="#c9a23a" stroke-width="1.4"/><rect x="38" y="51" width="14" height="9" rx="1" fill="#b3222a"/><path d="M45 51 V60 M38 55.5 H52" stroke="#f0cd7a" stroke-width="1.6"/><path d="M45 51 q-4 -4 -6 -1 q3 3 6 1 q4 -4 6 -1 q-3 3 -6 1" fill="#f0cd7a"/>' +
  '</symbol>' +
  // the same owl sitting, front view, on a 40 x 56 box: it is on the lantern post when nothing is flying
  '<symbol id="yu-owl-sit" viewBox="0 0 40 56"><ellipse cx="20" cy="38" rx="13" ry="16" fill="#f1f5fb"/><path d="M8 34 Q6 44 12 52 Q14 46 14 36Z M32 34 Q34 44 28 52 Q26 46 26 36Z" fill="#dbe5f4"/>' +
  '<circle cx="20" cy="18" r="12" fill="#f6f9fe"/><circle cx="15" cy="17" r="4" fill="#f3c21a"/><circle cx="25" cy="17" r="4" fill="#f3c21a"/><circle cx="15" cy="17" r="1.8" fill="#111"/><circle cx="25" cy="17" r="1.8" fill="#111"/><path d="M18 22 L20 26 L22 22Z" fill="#3a3a44"/>' +
  '<g fill="#8ea3c4"><circle cx="14" cy="38" r="1.3"/><circle cx="24" cy="42" r="1.3"/><circle cx="20" cy="34" r="1.2"/><circle cx="27" cy="36" r="1.2"/></g><path d="M14 53 H18 M22 53 H26" stroke="#3a3a44" stroke-width="2.2" stroke-linecap="round"/></symbol>' +
  // the seal that stands where the house device does: a wreath of holly with berries and a red bow, on a 100 x 88 box
  '<symbol id="yu-seal" viewBox="0 0 100 88"><g transform="translate(50 44)">' +
  Array.from({ length: 14 }, (_, i) => `<g transform="rotate(${i * (360 / 14)}) translate(0 -33)"><use href="#yu-holly" x="-14" y="-8" width="28" height="16" transform="rotate(90)" style="color:${i % 2 ? '#2f7a4a' : '#1f5a3a'}"/></g>`).join('') +
  '</g><g fill="#c2252c"><circle cx="34" cy="26" r="4.2"/><circle cx="40" cy="22" r="4.2"/><circle cx="38" cy="30" r="4.2"/><circle cx="66" cy="30" r="4.2"/><circle cx="62" cy="24" r="4.2"/></g><g fill="#c2252c"><path d="M50 70 Q36 58 30 72 Q42 76 50 70 Q58 76 70 72 Q64 58 50 70Z"/></g><circle cx="50" cy="70" r="4" fill="#9b1f2c"/></symbol>' +
  '</defs></svg>';

// A fir: a trunk and tiers of branches, each with snow lying along it, standing on `base` with its tip at base - h. `w` is the width of the lowest tier.
function fir(x, base, h, w, tiers, lit = false) {
  let out = `<rect x="${x - w * 0.06}" y="${base - h * 0.14}" width="${w * 0.12}" height="${h * 0.16}" fill="${PINE}"/>`;
  const tierH = (h * 0.96) / tiers;
  for (let t = 0; t < tiers; t++) {
    const top = base - h + t * tierH * 0.82;
    const bottom = top + tierH * 1.5;
    const tw = (w * (0.34 + (0.66 * (t + 1)) / tiers)) / 2;
    const left = x - tw;
    let edge = '';
    for (let i = 0; i < 3; i++) edge += ` Q${(left + ((i + 0.5) * 2 * tw) / 3).toFixed(1)} ${(bottom + 4).toFixed(1)} ${(left + ((i + 1) * 2 * tw) / 3).toFixed(1)} ${bottom.toFixed(1)}`;
    out += `<path d="M${x} ${top.toFixed(1)} L${left.toFixed(1)} ${bottom.toFixed(1)}${edge}Z" fill="${PINE}"/>`;
    // the snow lying on this tier: a smaller shape on the upper part of it, with a scalloped lower edge
    const sw = tw * 0.66;
    const sb = top + tierH * 0.84;
    out += `<path d="M${x} ${(top - 1).toFixed(1)} L${(x - sw).toFixed(1)} ${sb.toFixed(1)} Q${(x - sw * 0.5).toFixed(1)} ${(sb + 5).toFixed(1)} ${x} ${(sb + 1).toFixed(1)} Q${(x + sw * 0.5).toFixed(1)} ${(sb + 5).toFixed(1)} ${(x + sw).toFixed(1)} ${sb.toFixed(1)}Z" fill="${SNOW}" opacity=".9"/>`;
    out += `<path d="M${x} ${(top - 1).toFixed(1)} L${(x - sw).toFixed(1)} ${sb.toFixed(1)}" stroke="${COLD}" stroke-width="1" fill="none"/>`;
    if (lit) {
      // lights along the tier's edge: warm gold, red and white, each twinkling in its own time
      const colors = ['#ffd27a', '#ff6a5a', '#fff2cc', '#ffd27a'];
      for (let k = 0; k < 3; k++) {
        const fx = -0.8 + k * 0.8;
        const lx = x + fx * tw * 0.9;
        const ly = bottom - 2 - (1 - Math.abs(fx)) * 0;
        out += `<circle class="yu-tl" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.4" fill="${colors[(t + k) % 4]}" style="--d:-${((t * 3 + k) * 0.37).toFixed(2)}s"/>`;
      }
    }
  }
  return out;
}

// A lantern on a post: a lit glass box with a cap and a ring, and the light it throws.
function lantern(x, y, s = 1) {
  return (
    `<circle class="yu-lamp" cx="${x}" cy="${y + 8 * s}" r="${30 * s}" fill="url(#yu-lamp)" style="--d:-.6s"/>` +
    `<path d="M${x - 5 * s} ${y} L${x} ${y - 6 * s} L${x + 5 * s} ${y}Z" fill="#2a2418"/>` +
    `<rect x="${x - 5 * s}" y="${y}" width="${10 * s}" height="${15 * s}" rx="1.2" fill="#ffd98a"/>` +
    `<path d="M${x - 5 * s} ${y + 5 * s} H${x + 5 * s} M${x} ${y} V${y + 15 * s}" stroke="#2a2418" stroke-width="1.1"/>` +
    `<rect x="${x - 6 * s}" y="${y + 15 * s}" width="${12 * s}" height="${2.4 * s}" fill="#2a2418"/>`
  );
}

// The stag standing on the ridge, facing the cottage: a body, a long neck, a head that turns, and a rack of antlers.
function stag(x, y, k) {
  const g = `translate(${x} ${y}) scale(${k})`;
  return (
    `<g transform="${g}" fill="${PINE}" stroke="${PINE}" stroke-linecap="round" stroke-linejoin="round">` +
    '<ellipse cx="46" cy="52" rx="27" ry="14" stroke-width="0"/>' +
    '<path d="M34 60 L33 93 M44 63 L45 93 M62 62 L63 93 M72 58 L75 93" stroke-width="4.6" fill="none"/>' +
    '<path d="M64 46 Q74 38 76 22 L84 24 Q82 44 72 54Z" stroke-width="0"/>' +
    '<path d="M22 48 Q16 50 14 56" stroke-width="3" fill="none"/>' +
    '<g class="yu-head"><ellipse cx="82" cy="20" rx="8" ry="5.4" transform="rotate(-18 82 20)" stroke-width="0"/><path d="M88 22 L98 27 L90 27Z" stroke-width="0"/>' +
    '<path d="M80 15 Q76 2 66 -4 M76 10 Q72 6 70 -2 M78 12 Q80 0 74 -8 M82 14 Q86 2 82 -10 M84 15 Q92 6 90 -6" stroke-width="2.2" fill="none"/></g>' +
    '</g>' +
    `<path d="M${x + 36 * k} ${y + 40 * k} Q${x + 60 * k} ${y + 36 * k} ${x + 70 * k} ${y + 44 * k}" stroke="${COLD}" stroke-width="1" fill="none"/>`
  );
}

// The cluster of pines. Drawn on 260 x 330, standing on the left edge.
function pineCluster() {
  return (
    '<svg class="hol-cl hol-cl-l yu-pines" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V298Q60 282 120 296T260 300V330Z" fill="${NEAR}"/>` +
    `<path d="M0 298Q60 282 120 296T260 300" stroke="${COLD}" stroke-width="1.3" fill="none" opacity=".7"/>` +
    // the ridge the stag stands on
    `<path d="M120 300Q160 262 214 268T260 318V330H120Z" fill="${MID}"/><path d="M120 300Q160 262 214 268T260 318" stroke="${COLD}" stroke-width="1.2" fill="none" opacity=".6"/>` +
    stag(150, 188, 0.92) +
    fir(52, 304, 250, 98, 6) +
    fir(18, 310, 130, 60, 4) +
    // the lantern post with its hooked arm, the lantern, and the snow along the arm; the owl sits on the cap
    `<path d="M118 306 L118 172" stroke="${PINE}" stroke-width="6" stroke-linecap="round"/><path d="M118 176 Q118 160 136 160" stroke="${PINE}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
    `<path d="M112 172 H124" stroke="${PINE}" stroke-width="5" stroke-linecap="round"/><path d="M113 170 Q118 167 123 170" stroke="${SNOW}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    `<path d="M136 160 V168" stroke="${PINE}" stroke-width="1.6"/>` + lantern(136, 168, 1.1) +
    `<path d="M0 330V306Q50 296 100 308T200 304T260 308V330Z" fill="${NEAR}"/>` +
    '</svg>'
  );
}

// The cluster of the cottage. Drawn on 260 x 330, standing on the right edge.
function cottageCluster() {
  // firewood: logs stacked three rows deep, each an end-on circle with its rings, snow on top
  let logs = '';
  [[236, 294], [248, 294], [230, 283], [242, 283], [254, 283], [236, 272], [248, 272]].forEach(([lx, ly], i) => {
    logs += `<circle cx="${lx}" cy="${ly}" r="6.2" fill="${i % 2 ? '#3a2a1c' : '#4a3422'}"/><circle cx="${lx}" cy="${ly}" r="3.2" fill="none" stroke="#6a4c2a" stroke-width="1"/>`;
  });
  const puff = (d) => `<g class="yu-smoke hol-mover" style="--d:-${d}s"><ellipse cx="196" cy="190" rx="5.5" ry="4.2" fill="#a9b7d0" fill-opacity=".4"/></g>`;
  return (
    '<svg class="hol-cl hol-cl-r yu-cottage" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V300Q60 284 130 296T260 292V330Z" fill="${NEAR}"/>` +
    `<path d="M0 300Q60 284 130 296T260 292" stroke="${COLD}" stroke-width="1.3" fill="none" opacity=".7"/>` +
    // the fir strung with lights, and its star
    fir(58, 304, 200, 84, 6, true) +
    '<circle class="yu-halo" cx="58" cy="100" r="30" fill="url(#yu-lamp)"/><use class="yu-star" href="#yu-starsym" x="48" y="90" width="20" height="20" style="color:#ffd98a"/>' +
    // the cottage: its glow first, then the walls, the roof with the snow lying thick on it, the chimney, the lit windows, the door and its wreath
    '<circle class="yu-lamp" cx="150" cy="262" r="64" fill="url(#yu-lamp)" style="--d:-.2s"/>' +
    `<rect x="106" y="234" width="104" height="60" fill="#0d1228"/><path d="M96 238 L158 192 L220 238Z" fill="#0d1228"/><rect x="190" y="196" width="14" height="28" fill="#0d1228"/>` +
    `<path d="M92 242 L158 188 L224 242 Q214 246 206 242 Q196 248 186 242 Q172 250 160 242 Q146 250 134 242 Q122 248 112 242 Q100 248 92 242Z" fill="${SNOW}"/>` +
    `<path d="M92 242 L158 188" stroke="${COLD}" stroke-width="1.2" fill="none"/><path d="M96 244 Q158 214 220 244" stroke="${SNOW_SHADE}" stroke-width="2" fill="none" opacity=".6"/>` +
    `<path d="M187 198 Q197 190 207 198Z" fill="${SNOW}"/>` +
    '<g fill="#ffd27a"><rect class="yu-win" x="120" y="250" width="22" height="20" style="--d:-.3s"/><rect class="yu-win" x="174" y="250" width="22" height="20" style="--d:-2s"/></g>' +
    '<path d="M131 250 V270 M120 260 H142 M185 250 V270 M174 260 H196" stroke="#0d1228" stroke-width="2"/>' +
    `<path d="M118 272 H144 M172 272 H198" stroke="${SNOW}" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="149" y="262" width="18" height="32" rx="2" fill="#2a1a12"/><circle cx="158" cy="274" r="7.5" fill="none" stroke="#1f6a3e" stroke-width="3.4"/><circle cx="155" cy="269" r="1.5" fill="#c2252c"/><circle cx="162" cy="270" r="1.5" fill="#c2252c"/><circle cx="158" cy="281" r="1.5" fill="#c2252c"/><path d="M158 281 l-3 3 M158 281 l3 3" stroke="#c2252c" stroke-width="2"/>` +
    puff(0) + puff(3.3) + puff(6.6) +
    // the stack of firewood, with snow on top
    logs + `<path d="M226 266 Q240 258 258 266 Q256 270 248 268 Q240 272 232 268 Q228 270 226 266Z" fill="${SNOW}"/>` +
    `<path d="M0 330V310Q50 300 110 310T190 306T260 310V330Z" fill="${NEAR}"/>` +
    '</svg>'
  );
}

// The ground between the clusters: the far hills with a line of far pines and the lit windows of a far village, the Yule fire in its ring of stones with
// its sparks, and low mist. Percentages are of the band, so the same ground fits a phone's gap and a wide screen's.
function ground() {
  const r = rng(3);
  let farPines = '';
  for (let x = 6; x < 1000; x += 17 + Math.round(r() * 9)) {
    const h = 14 + r() * 16;
    farPines += `M${x} 40 L${x - 6} 40 L${x} ${40 - h} L${x + 6} 40Z `;
  }
  const village = [[12, 63], [17, 61], [23, 64], [61, 62], [68, 64], [74, 61], [83, 63]]
    .map(([x, b], i) => `<i class="yu-vwin" style="left:${x}%;bottom:${b}%;--d:-${(i * 1.3).toFixed(1)}s"></i>`)
    .join('');
  const sparks = [0, 1, 2, 3, 4, 5]
    .map((i) => `<i class="yu-spark hol-mover" style="left:${42 + i * 3}%;--d:-${(i * 1.1).toFixed(1)}s;--x:${i % 2 ? 9 : -8}px"></i>`)
    .join('');
  return (
    '<div class="hol-ground yu-ground">' +
    `<svg class="hol-hill hol-hill-far" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V96Q90 62 190 88T380 74T580 94T780 70T1000 90V200Z" fill="${FAR}"/><path d="${farPines}" fill="${PINE}" opacity=".85" transform="translate(0 52) scale(1 1.5)"/></svg>` +
    village +
    `<svg class="hol-hill hol-hill-mid" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V120Q120 96 260 118T520 108T760 122T1000 104V200Z" fill="${MID}"/></svg>` +
    '<i class="yu-mist"></i>' +
    // the fire: a glow, a ring of stones, crossed logs and three tongues of flame
    '<div class="yu-fire"><i class="yu-firepool"></i><svg viewBox="0 0 50 46"><ellipse cx="25" cy="38" rx="21" ry="6.5" fill="#0a1224"/>' +
    '<g fill="#5b6b8a"><ellipse cx="8" cy="36" rx="4.4" ry="3"/><ellipse cx="15" cy="41" rx="4.6" ry="3"/><ellipse cx="25" cy="43" rx="4.8" ry="3"/><ellipse cx="35" cy="41" rx="4.6" ry="3"/><ellipse cx="42" cy="36" rx="4.4" ry="3"/></g>' +
    '<path d="M10 38 L40 30 M12 30 L40 38" stroke="#3a2418" stroke-width="5" stroke-linecap="round"/>' +
    '<path class="yu-fl yu-fl1" d="M25 36 C14 30 20 20 25 8 C30 20 36 30 25 36Z" fill="url(#yu-flame)" style="--d:-.2s"/>' +
    '<path class="yu-fl yu-fl2" d="M17 36 C10 32 14 26 17 18 C21 26 24 32 17 36Z" fill="url(#yu-flame)" opacity=".85" style="--d:-1.1s"/>' +
    '<path class="yu-fl yu-fl3" d="M33 36 C26 32 30 26 33 20 C37 26 40 32 33 36Z" fill="url(#yu-flame)" opacity=".85" style="--d:-.7s"/></svg>' + sparks + '</div>' +
    `<svg class="hol-hill hol-hill-near" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V150Q140 132 300 148T620 140T1000 150V200Z" fill="${NEAR}"/></svg>` +
    '</div>'
  );
}

// The whole horizon: the ground, then the two clusters.
function band() {
  return ground() + pineCluster() + cottageCluster();
}

// The sky: stars, a curtain of aurora in each margin, and snow coming down at three depths.
function sky() {
  const r = rng(17);
  let stars = '';
  for (let i = 0; i < 30; i++) stars += `<i class="${i % 6 === 0 ? 'yu-star-dot yu-star-big' : 'yu-star-dot'}" style="left:${(r() * 98).toFixed(1)}%;top:${(r() * 58).toFixed(1)}%;--d:-${(r() * 4).toFixed(2)}s"></i>`;
  let snow = '';
  for (let i = 0; i < 34; i++) {
    const size = 2 + Math.round(r() * 2);
    snow += `<i class="yu-flake hol-mover" style="left:${(r() * 99).toFixed(1)}%;width:${size}px;height:${size}px;--t:${(9 + r() * 9).toFixed(1)}s;--d:-${(r() * 18).toFixed(1)}s;--x:${Math.round((r() - 0.5) * 50)}px;opacity:${(0.35 + size * 0.1).toFixed(2)}"></i>`;
  }
  return `<div class="yu-sky"><i class="yu-haze"></i><i class="yu-aurora hol-margin"></i><i class="yu-aurora yu-aurora-r hol-margin"></i>${stars}${snow}</div>`;
}

// The gutters: the 16px strips beside the page. Nothing the app draws ever enters them, so flakes may come down them however pale.
function gutters() {
  const r = rng(23);
  const side = (cls, sideCss) => {
    let s = '';
    for (let i = 0; i < 6; i++) s += `<i class="yu-gflake hol-mover" style="${sideCss}:${1 + (i % 3) * 4}px;--t:${(11 + r() * 8).toFixed(1)}s;--d:-${(r() * 16).toFixed(1)}s"></i>`;
    return `<div class="hol-gut ${cls}">${s}</div>`;
  };
  return side('l', 'left') + side('r', 'right');
}

// Frost: a fern of ice growing from a corner, drawn once as a symbol-free path with a fixed seed so every plate's frost is the same frost.
const FROST = (function () {
  const r = rng(41);
  let d = '';
  const branch = (x, y, a, len, depth) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    d += `M${x.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
    if (depth > 0) {
      branch(x + Math.cos(a) * len * 0.45, y + Math.sin(a) * len * 0.45, a - 0.7, len * 0.46, depth - 1);
      branch(x + Math.cos(a) * len * 0.45, y + Math.sin(a) * len * 0.45, a + 0.7, len * 0.46, depth - 1);
      branch(x2, y2, a + (r() - 0.5) * 0.3, len * 0.5, depth - 1);
    }
  };
  [0.2, 0.55, 0.9, 1.25].forEach((a) => branch(0, 0, a, 78 + r() * 22, 3));
  return `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`;
})();

// What sits on each plate's edge: frost in a corner behind the text, a sprig of holly along the top edge, a star hanging from the top edge, and a lit
// candle on the bottom edge. All positioned absolutely, so none of it takes a place in the plate's layout.
function dressing() {
  const holly =
    '<path d="M98 10 C80 6 62 14 46 24 C34 32 20 32 6 26" fill="none" stroke="#1f5a3a" stroke-width="2.2" stroke-linecap="round"/>' +
    [[84, 8, 22, 15, '#2f7a4a'], [66, 18, 22, 160, '#1f5a3a'], [50, 26, 22, 25, '#2f7a4a'], [34, 34, 22, 170, '#1f5a3a'], [18, 28, 20, 50, '#2f7a4a']]
      .map(([x, y, w, rot, c]) => `<use href="#yu-holly" x="${x - w / 2}" y="${y - w * 0.3}" width="${w}" height="${w * 0.6}" transform="rotate(${rot} ${x} ${y})" style="color:${c}"/>`)
      .join('') +
    '<circle cx="74" cy="16" r="3.6" fill="#c2252c"/><circle cx="78" cy="21" r="3.6" fill="#c2252c"/><circle cx="56" cy="30" r="3.6" fill="#c2252c"/><circle cx="60" cy="25" r="3.6" fill="#c2252c"/><circle cx="38" cy="22" r="3.6" fill="#c2252c"/>';
  return (
    `<span class="hol-pd hol-line pd-frost"><svg viewBox="0 0 120 120">${FROST}</svg></span>` +
    `<span class="hol-pd hol-prop pd-holly"><svg viewBox="0 0 100 52">${holly}</svg></span>` +
    '<span class="hol-pd hol-prop pd-hang"><i class="hol-thread"></i><svg viewBox="0 0 40 40"><use href="#yu-starsym" x="4" y="4" width="32" height="32" style="color:#e9c46a"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-candle"><i class="yu-cpool"></i><svg viewBox="0 0 30 50"><rect x="9" y="22" width="12" height="22" rx="1.4" fill="#f3ead2"/><path d="M5 44 H25 L23 49 H7Z" fill="#b8903a"/><path d="M15 22 V18" stroke="#2a2418" stroke-width="1.2"/><ellipse class="yu-cflame" cx="15" cy="12" rx="3.4" ry="6.4" fill="url(#yu-flame)"/></svg></span>'
  );
}

const backdrop = `<div class="hol-scene yu">${sky()}<div class="hol-band yu-band hol-wings hol-margin">${band()}</div>${gutters()}</div>`;
const foot = `<div class="hol-foot hol-footband"><div class="hol-band yu-band">${band()}</div></div>`;

export default { defs: DEFS, backdrop, dressing: dressing(), foot };
