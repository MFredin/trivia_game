// Thanksgiving: the golden-hour harvest
//
// One composition, cropped two ways. The lighting is the idea: there is one light, the low amber sun, and everything else is a silhouette
// rimmed with it. It is a harvest farm in the last hour of the day. Two clusters stand either side of the page, pinned to its edges:
//   the maple      a maple in full colour with its leaves coming down, two shocks of corn, a heap of pumpkins with a wild turkey among them
//   the farmstead  the sun going down behind a farmhouse whose windows are lit and whose chimney smokes, a rail fence, round hay bales, a sheaf of wheat
// Between them, on the far hills: a long table laid for the feast under a string of lights, a tree line and furrowed fields, with geese
// crossing a sky of long amber cloud.
// On a wide screen they stand in the empty margins either side of the 1040px page, each as wide as its margin; on a phone they stand in the
// corners of the scene at the end of the page, with the same ground and the same table between them. Nothing differs but where they stand.
// On every plate: a vine of maple leaves and cranberries along the top edge, a pumpkin, a gourd and a sheaf of wheat along the bottom, and a
// line of wheat in a corner behind the text.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols and gradients; `backdrop` is the
// fixed layer; `dressing` is what sits on each plate's edges; `foot` is the scene at the end of the page. They are strings rather than JSX
// because they are static decoration with no state or events, which React would otherwise reconcile on every render of every plate for nothing.
// Nothing in them ever comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-thanksgiving.css.
import { rng } from './shared.js';

const NEAR = '#1a0b06';
const MID = '#2c150b';
const FAR = '#6a3219';
const RIM = 'rgba(255,196,110,.8)';
// The maple's colours, from the deep red of the shaded inside of the crown to the gold of the leaves the sun comes through.
const LEAF = ['#a82a18', '#c9461a', '#e2691c', '#f08f26', '#f6b93c'];

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  // light
  '<radialGradient id="th-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0c4"/><stop offset=".55" stop-color="#ffc468"/><stop offset="1" stop-color="#f28a2a"/></radialGradient>' +
  '<radialGradient id="th-halo"><stop offset="0" stop-color="#ffb34d" stop-opacity=".62"/><stop offset=".35" stop-color="#ff9a38" stop-opacity=".26"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="th-lamp"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset=".5" stop-color="#ffb04a" stop-opacity=".2"/><stop offset="1" stop-color="#ff9a30" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="th-pkg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9b24f"/><stop offset=".5" stop-color="#e5741c"/><stop offset="1" stop-color="#9c3e0b"/></linearGradient>' +
  '<linearGradient id="th-gourdg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9c75a"/><stop offset=".55" stop-color="#bf9a2a"/><stop offset="1" stop-color="#7a5e14"/></linearGradient>' +
  // the rise the farmhouse stands on starts from nothing at the cluster's inner edge, so no edge shows against the ground beside it
  '<linearGradient id="th-rise" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + FAR + '" stop-opacity="0"/><stop offset=".3" stop-color="' + FAR + '"/></linearGradient>' +
  // a maple leaf, five pointed lobes on a 100 x 100 box: coloured by whoever uses it
  '<symbol id="th-maple" viewBox="0 0 100 100"><path fill="currentColor" d="M50 3 L58 22 L69 15 L66 37 L87 29 L78 47 L97 53 L73 65 L77 80 L56 73 L54 97 L46 97 L44 73 L23 80 L27 65 L3 53 L22 47 L13 29 L34 37 L31 15 L42 22Z"/><path d="M50 12 V96 M50 48 L30 30 M50 48 L70 30 M50 60 L22 56 M50 60 L78 56" stroke="rgba(0,0,0,.28)" stroke-width="2.4" fill="none" stroke-linecap="round"/></symbol>' +
  // a pumpkin: three lobes, creases, a stem and a tendril, on a 100 x 88 box
  '<symbol id="th-pk" viewBox="0 0 100 88"><ellipse cx="27" cy="54" rx="23" ry="31" fill="url(#th-pkg)"/><ellipse cx="73" cy="54" rx="23" ry="31" fill="url(#th-pkg)"/><ellipse cx="50" cy="54" rx="27" ry="33" fill="url(#th-pkg)"/><path d="M38 28 Q36 70 38 86 M62 28 Q64 70 62 86" stroke="rgba(90,30,0,.4)" stroke-width="2.4" fill="none"/><path d="M45 25 Q47 10 53 7 L59 11 Q55 16 55 26Z" fill="#5a6a24"/><path d="M58 14 Q70 4 76 12 Q70 10 66 16" stroke="#6f8a2a" stroke-width="2" fill="none" stroke-linecap="round"/></symbol>' +
  // a gourd: two lumps, a long neck
  '<symbol id="th-gourd" viewBox="0 0 70 80"><ellipse cx="34" cy="56" rx="26" ry="22" fill="url(#th-gourdg)"/><ellipse cx="34" cy="26" rx="14" ry="17" fill="url(#th-gourdg)"/><path d="M33 10 Q34 2 40 1 L41 6 Q38 8 38 14Z" fill="#5a4a14"/><path d="M20 52 Q22 66 30 74 M46 52 Q44 66 38 74" stroke="rgba(60,40,0,.3)" stroke-width="2" fill="none"/></symbol>' +
  // an acorn
  '<symbol id="th-acorn" viewBox="0 0 30 40"><path d="M5 16 Q4 34 15 38 Q26 34 25 16Z" fill="#b97a2e"/><path d="M2 17 Q2 6 15 5 Q28 6 28 17Z" fill="#6f4a1c"/><path d="M15 5 V0" stroke="#5a3a14" stroke-width="3" stroke-linecap="round"/><path d="M6 12 H24 M9 8 H21" stroke="rgba(0,0,0,.25)" stroke-width="1.4"/></symbol>' +
  // an ear of wheat, on a 20 x 100 box
  '<symbol id="th-wheat" viewBox="0 0 20 100"><path d="M10 100 V26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><g fill="currentColor"><ellipse cx="6" cy="22" rx="3.2" ry="7" transform="rotate(-18 6 22)"/><ellipse cx="14" cy="22" rx="3.2" ry="7" transform="rotate(18 14 22)"/><ellipse cx="6" cy="12" rx="3.2" ry="7" transform="rotate(-18 6 12)"/><ellipse cx="14" cy="12" rx="3.2" ry="7" transform="rotate(18 14 12)"/><ellipse cx="10" cy="4" rx="3.2" ry="7"/></g></symbol>' +
  // the wild turkey, a tom strutting with his tail fanned, facing left, on an 80 x 76 box: the thing to catch
  '<symbol id="th-turkey" viewBox="0 0 80 76"><g transform="translate(54 42)">' +
  [[-78, '#7a4318'], [-56, '#a8641f'], [-34, '#d49a3a'], [-12, '#a8641f'], [10, '#7a4318'], [32, '#a8641f']].map(([a, c]) => `<g transform="rotate(${a})"><path d="M0 0 Q-13 -20 0 -46 Q13 -20 0 0Z" fill="${c}"/><path d="M0 -6 Q-3 -20 0 -34" stroke="rgba(30,10,0,.45)" stroke-width="1.6" fill="none"/></g>`).join('') +
  '</g><path d="M24 48 Q22 38 30 33 Q46 26 62 38 Q66 54 52 60 Q36 64 24 56Z" fill="#6b3a1c"/><path d="M30 50 Q42 46 56 52" stroke="#4a2410" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
  '<path d="M26 40 Q18 36 18 24" stroke="#6b3a1c" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="17" cy="21" r="7" fill="#7a4a28"/><path d="M11 21 L3 24 L11 26Z" fill="#e0a02a"/><path d="M12 27 Q9 36 14 38 Q17 34 15 28Z" fill="#c2252c"/><circle cx="16" cy="19" r="1.7" fill="#120804"/>' +
  '<path d="M38 60 L36 72 M46 60 L48 72 M33 72 H40 M45 72 H52" stroke="#c08a2a" stroke-width="2.4" stroke-linecap="round" fill="none"/></symbol>' +
  // the seal that stands where the house device does: a maple leaf with a stem, on a 100 x 88 box
  '<symbol id="th-seal" viewBox="0 0 100 88"><g transform="translate(5 -6) scale(.9)"><use href="#th-maple" style="color:#e2691c"/></g><path d="M50 84 Q50 90 56 92" stroke="#8a4a1a" stroke-width="3" fill="none" stroke-linecap="round" transform="translate(0 -6)"/></symbol>' +
  '</defs></svg>';

// A leaf of the maple's crown or of the ground, drawn small: a symbol use, coloured and turned.
const leaf = (x, y, size, rot, color) =>
  `<use href="#th-maple" x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size}" height="${size}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" style="color:${color}"/>`;

// The maple: a trunk and a crown of leaf colour, with leaves coming down from it. Standing on the left of the maple cluster.
function maple() {
  const r = rng(31);
  const blob = (n, spread, minR, maxR, colors, cx, cy, bias = 0) => {
    let o = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * spread;
      o += `<circle cx="${(cx + Math.cos(a) * d * 1.05 + bias).toFixed(1)}" cy="${(cy + Math.sin(a) * d * 0.82).toFixed(1)}" r="${(minR + r() * (maxR - minR)).toFixed(1)}" fill="${colors[Math.floor(r() * colors.length)]}"/>`;
    }
    return o;
  };
  const crown =
    // the shaded inside, then the body of the crown, then the leaves the sun comes through
    blob(24, 62, 13, 22, [LEAF[0], LEAF[1]], 74, 118) +
    blob(34, 60, 9, 16, [LEAF[1], LEAF[2]], 74, 116) +
    blob(30, 46, 6, 11, [LEAF[2], LEAF[3]], 86, 104, 6) +
    blob(26, 34, 4, 9, [LEAF[3], LEAF[4]], 98, 96, 8);
  // a few single leaves on the edge of the crown, so its outline is leaves and not circles
  let edge = '';
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    edge += leaf(74 + Math.cos(a) * (58 + r() * 12), 118 + Math.sin(a) * (46 + r() * 10), 11 + r() * 6, Math.round(r() * 360), LEAF[1 + Math.floor(r() * 4)]);
  }
  // leaves coming down: each falls from the crown, sways, turns and fades before it reaches the ground, then begins again
  const fall = [[52, 150, 0], [86, 156, 2.4], [112, 140, 4.8], [38, 160, 7.2], [96, 170, 9.6], [66, 148, 12]]
    .map(([x, y, d], i) => `<g class="th-fall hol-mover" style="--x:${i % 2 ? 26 : -22}px;--d:-${d}s;--t:${12 + (i % 3) * 2}s">${leaf(x, y, 13, i * 50, LEAF[1 + (i % 4)])}</g>`)
    .join('');
  // the leaves that have already come down
  let pile = '';
  for (let i = 0; i < 18; i++) pile += leaf(12 + r() * 120, 296 + r() * 14, 9 + r() * 6, Math.round(r() * 360), LEAF[Math.floor(r() * 5)]);
  return (
    `<path d="M54 304 C62 276 64 246 62 212 L84 212 C82 246 86 276 94 304Z" fill="${NEAR}"/>` +
    `<g fill="none" stroke="${NEAR}" stroke-linecap="round"><path d="M70 214 Q56 180 34 150" stroke-width="9"/><path d="M76 212 Q96 182 118 144" stroke-width="8"/><path d="M72 210 Q74 170 76 116" stroke-width="8"/></g>` +
    `<path d="M84 300 C82 272 82 240 80 216" stroke="${RIM}" stroke-width="1.4" fill="none"/>` +
    crown + edge + pile + fall
  );
}

// A shock of corn: stalks leaning in to a point, tied with twine, their blades curling out, an ear or two at the waist. `x` is its middle, `base` its foot.
function shock(x, base, h, w) {
  const top = base - h;
  let stalks = '';
  for (let k = -3; k <= 3; k++) stalks += `M${x} ${top} L${(x + k * (w / 3)).toFixed(1)} ${base} `;
  const blades = [-1, 1]
    .map((s) => `M${x} ${top + 4} Q${x + s * w * 0.7} ${top - 4} ${x + s * w * 0.95} ${top + h * 0.3}`)
    .join(' ');
  return (
    `<path d="${stalks}" stroke="#5a3916" stroke-width="6" stroke-linecap="round" fill="none"/>` +
    `<path d="M${x + w * 0.34} ${base} L${x} ${top}" stroke="${RIM}" stroke-width="1.6" opacity=".85" fill="none"/><path d="M${x + w * 0.12} ${base} L${x} ${top}" stroke="#2c1808" stroke-width="2" opacity=".6" fill="none"/>` +
    `<path d="${blades}" stroke="#6a4a1e" stroke-width="3.6" stroke-linecap="round" fill="none"/>` +
    `<path d="M${x - w * 0.46} ${base - h * 0.42} Q${x} ${base - h * 0.34} ${x + w * 0.46} ${base - h * 0.42}" stroke="#9a7228" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M${x + 3} ${base - h * 0.34} q9 8 4 24 q-9 -4 -4 -24Z" fill="#d6a63a"/><path d="M${x - 3} ${base - h * 0.32} q-9 8 -4 22 q9 -4 4 -22Z" fill="#b88a2c"/>`
  );
}

// The maple cluster. Drawn on 260 x 330, standing on the left edge.
function mapleCluster() {
  return (
    '<svg class="hol-cl hol-cl-l th-maple" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V292Q60 276 130 290T260 300V330Z" fill="${NEAR}"/>` +
    `<path d="M0 292Q60 276 130 290T260 300" stroke="${RIM}" stroke-width="1.2" fill="none" opacity=".6"/>` +
    maple() +
    shock(170, 304, 120, 54) +
    shock(216, 308, 92, 42) +
    // the heap of pumpkins, lit on the side that faces the sun
    '<use href="#th-pk" x="92" y="258" width="62" height="55"/>' +
    '<use href="#th-pk" x="146" y="278" width="44" height="39"/>' +
    '<use href="#th-pk" x="66" y="286" width="36" height="32" style="filter:brightness(.8)"/>' +
    '<use href="#th-gourd" x="196" y="284" width="30" height="34"/>' +
    '<use href="#th-acorn" x="150" y="304" width="12" height="16"/><use href="#th-acorn" x="136" y="310" width="10" height="13"/>' +
    '</svg>'
  );
}

// The farmstead: the sun going down behind a farmhouse, a rail fence, round bales and a sheaf of wheat. Drawn on 260 x 330, standing on the right edge.
function farmstead() {
  // the fence: posts and two rails, leaning a little, running off to the left
  let posts = '';
  for (let i = 0; i < 6; i++) posts += `<path d="M${14 + i * 21} 304 L${15 + i * 21 + (i % 2 ? 1 : -1)} 270" stroke="${NEAR}" stroke-width="5" stroke-linecap="round"/>`;
  // the sheaf: a bundle of wheat tied at the waist, standing at the edge
  let wheat = '';
  const ears = [-18, -12, -6, 0, 6, 12, 18];
  ears.forEach((a, i) => {
    wheat += `<g transform="rotate(${a} 236 306)"><use href="#th-wheat" x="${226 + (i % 2) * 2}" y="214" width="20" height="96" style="color:#2a1409"/></g>`;
  });
  return (
    '<svg class="hol-cl hol-cl-r th-farm" viewBox="0 0 260 330" aria-hidden="true">' +
    // the sun, low, with its halo, and the hill it is going down behind
    '<circle class="th-halo" cx="150" cy="200" r="170" fill="url(#th-halo)"/>' +
    '<circle class="th-sun" cx="150" cy="200" r="46" fill="url(#th-sun)"/>' +
    `<path d="M0 330V304Q36 300 76 272Q116 244 152 252T260 246V330Z" fill="url(#th-rise)"/>` +
    // the house, black against the sun, its roof rimmed with it
    `<g fill="${NEAR}"><rect x="116" y="228" width="78" height="38"/><path d="M106 231 L155 197 L204 231Z"/><rect x="193" y="240" width="32" height="26"/><path d="M190 242 L209 228 L229 242Z"/><rect x="172" y="203" width="10" height="24"/></g>` +
    `<path d="M106 231 L155 197 L204 231" stroke="${RIM}" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M172 203 V226" stroke="${RIM}" stroke-width="1.2"/>` +
    // two lit windows and the lit doorway of the side wing, each with its glow behind it
    '<circle class="th-lamp" cx="134" cy="246" r="26" fill="url(#th-lamp)" style="--d:-.4s"/><circle class="th-lamp" cx="172" cy="246" r="26" fill="url(#th-lamp)" style="--d:-1.9s"/>' +
    '<g fill="#ffd27a"><rect class="th-win" x="128" y="239" width="12" height="14" style="--d:-.4s"/><rect class="th-win" x="166" y="239" width="12" height="14" style="--d:-1.9s"/><rect class="th-win" x="206" y="248" width="9" height="12" style="--d:-3.1s"/></g>' +
    `<path d="M134 239 V253 M128 246 H140 M172 239 V253 M166 246 H178" stroke="${NEAR}" stroke-width="1.4"/>` +
    // smoke from the chimney
    '<g class="th-smoke hol-mover" style="--d:0s"><ellipse cx="177" cy="196" rx="5" ry="4" fill="#c9a27a" fill-opacity=".38"/></g>' +
    '<g class="th-smoke hol-mover" style="--d:-3.3s"><ellipse cx="177" cy="196" rx="5" ry="4" fill="#c9a27a" fill-opacity=".38"/></g>' +
    '<g class="th-smoke hol-mover" style="--d:-6.6s"><ellipse cx="177" cy="196" rx="5" ry="4" fill="#c9a27a" fill-opacity=".38"/></g>' +
    `<path d="M0 330V300Q70 284 150 294T260 290V330Z" fill="${NEAR}"/>` +
    `<path d="M0 300Q70 284 150 294T260 290" stroke="${RIM}" stroke-width="1.1" fill="none" opacity=".55"/>` +
    // the fence, two bales and the sheaf in front
    posts + `<path d="M8 281 L128 276 M8 293 L128 290" stroke="${NEAR}" stroke-width="4" stroke-linecap="round"/>` +
    '<g class="th-bale"><circle cx="172" cy="300" r="19" fill="#7a4d18"/><circle cx="172" cy="300" r="12" fill="none" stroke="#4a2c0c" stroke-width="2"/><circle cx="172" cy="300" r="5" fill="none" stroke="#4a2c0c" stroke-width="2"/><path d="M155 292 A19 19 0 0 1 188 290" stroke="' + RIM + '" stroke-width="1.4" fill="none"/></g>' +
    '<g class="th-bale"><circle cx="205" cy="308" r="15" fill="#6a4214"/><circle cx="205" cy="308" r="9" fill="none" stroke="#3e2408" stroke-width="2"/><path d="M192 302 A15 15 0 0 1 218 300" stroke="' + RIM + '" stroke-width="1.3" fill="none"/></g>' +
    `<g class="th-sway" style="--s:3.2s">${wheat}</g>` +
    '</svg>'
  );
}

// The ground between the clusters: the far hills with a tree line, the long table laid for the feast under a string of lights, long clouds of sunset, and
// geese. Percentages are of the band, so the same ground fits a phone's gap and a wide screen's.
function ground() {
  const trees = (function () {
    const r = rng(5);
    let d = 'M0 40 L0 28';
    for (let x = 0; x <= 1000; x += 14) d += ` Q${x + 4} ${12 + r() * 14} ${x + 9} 28`;
    return d + ' L1000 40Z';
  })();
  const bulbs = [26, 31, 36, 41, 46, 51, 56, 61, 66]
    .map((x, i) => `<i class="th-bulb" style="left:${x}%;bottom:${58 - Math.round(7 * Math.sin((Math.PI * (x - 24)) / 44))}%;--d:${(0.2 + i * 0.28).toFixed(2)}s"></i>`)
    .join('');
  return (
    '<div class="hol-ground th-ground">' +
    `<svg class="hol-hill hol-hill-far" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V96Q90 62 190 88T380 74T580 94T780 70T1000 90V200Z" fill="${FAR}"/><path d="${trees}" fill="#4a2312" transform="translate(0 40) scale(1 1.6)" opacity=".8"/></svg>` +
    '<i class="th-cloud" style="bottom:70%;left:18%;width:34%"></i><i class="th-cloud th-cloud2" style="bottom:62%;left:40%;width:42%"></i>' +
    // the table: a long board with a white cloth, two candles, a pumpkin and a bowl, and a bench along each side
    '<div class="th-table"><svg viewBox="0 0 100 40"><path d="M2 36 H98" stroke="' + NEAR + '" stroke-width="3"/><rect x="6" y="14" width="88" height="5" fill="#f1dcb4"/><path d="M6 19 V30 M94 19 V30 M50 19 V28" stroke="#d8c08c" stroke-width="2"/>' +
    `<rect x="4" y="30" width="92" height="3" fill="${NEAR}"/><path d="M10 33 V38 M90 33 V38" stroke="${NEAR}" stroke-width="2.4"/>` +
    '<use href="#th-pk" x="40" y="3" width="16" height="14"/><circle cx="68" cy="12" r="4.4" fill="#8c2332"/><path d="M64 14 H72" stroke="#5a1220" stroke-width="1.4"/>' +
    '<rect x="22" y="6" width="2.6" height="9" fill="#f6e8c8"/><rect x="80" y="6" width="2.6" height="9" fill="#f6e8c8"/>' +
    '<ellipse class="th-cflame" cx="23.3" cy="3.6" rx="1.8" ry="3.4" fill="#ffd27a" style="--d:-.3s"/><ellipse class="th-cflame" cx="81.3" cy="3.6" rx="1.8" ry="3.4" fill="#ffd27a" style="--d:-1.4s"/></svg></div>' +
    '<svg class="th-wire" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M24 14 Q45 34 68 16" stroke="#2a1409" stroke-width="1.2" fill="none" vector-effect="non-scaling-stroke"/></svg>' + bulbs +
    `<svg class="hol-hill hol-hill-mid" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V120Q120 96 260 118T520 108T760 122T1000 104V200Z" fill="${MID}"/></svg>` +
    '<i class="th-mist"></i>' +
    `<svg class="hol-hill hol-hill-near" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V150Q140 132 300 148T620 140T1000 150V200Z" fill="${NEAR}"/></svg>` +
    '</div>'
  );
}

// The whole horizon: the ground, then the two clusters.
function band() {
  return ground() + mapleCluster() + farmstead();
}

// Geese, a V of them crossing the sky now and then, at the height they fly and the speed they go.
function sky() {
  const r = rng(11);
  let dust = '';
  for (let i = 0; i < 16; i++) dust += `<i class="th-mote" style="left:${(r() * 98).toFixed(1)}%;top:${(r() * 60).toFixed(1)}%;--d:-${(r() * 5).toFixed(2)}s"></i>`;
  const goose = (x, y, d) => `<svg class="th-goose" viewBox="0 0 30 12" style="left:${x}px;top:${y}px;--f:${(0.5 + d * 0.07).toFixed(2)}s"><path d="M1 9 Q8 0 15 8 Q22 0 29 9" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const vee = (top, dur, delay, scale) =>
    `<div class="th-vee hol-mover" style="top:${top}%;--dur:${dur}s;--d:${delay}s;--k:${scale}">` +
    [[0, 0], [-22, 12], [-22, -12], [-44, 24], [-44, -24], [-66, 36], [-66, -36]].map(([x, y], i) => goose(x + 70, y + 40, i)).join('') +
    '</div>';
  return `<div class="th-sky"><i class="th-haze"></i>${dust}${vee(14, 70, 0, 1)}${vee(30, 96, -34, 0.7)}${vee(8, 120, -70, 0.55)}</div>`;
}

// The gutters: the 16px strips beside the page. Nothing the app draws ever enters them, so leaves may come down them however pale.
function gutters() {
  const r = rng(19);
  const side = (cls, sideCss) => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      s += `<div class="th-gleaf hol-mover" style="${sideCss}:${1 + (i % 2) * 3}px;--c:${LEAF[1 + ((i + (cls === 'r' ? 2 : 0)) % 4)]};--t:${14 + Math.round(r() * 8)}s;--d:-${(r() * 16).toFixed(1)}s"><svg viewBox="0 0 100 100"><use href="#th-maple"/></svg></div>`;
    }
    return `<div class="hol-gut ${cls}">${s}</div>`;
  };
  return side('l', 'left') + side('r', 'right');
}

// What sits on each plate's edge: a line of wheat in a corner behind the text, a vine of maple leaves and cranberries along the top edge, and a
// pumpkin, a gourd, acorns and a sheaf of wheat along the bottom. All positioned absolutely, so none of it takes a place in the plate's layout.
function dressing() {
  const vine =
    '<path d="M98 8 C80 4 62 14 48 24 C36 32 22 34 8 28" fill="none" stroke="#5a3a14" stroke-width="2.4" stroke-linecap="round"/>' +
    leaf(80, 8, 20, 20, LEAF[2]) + leaf(64, 20, 20, 150, LEAF[1]) + leaf(48, 28, 20, 30, LEAF[3]) + leaf(32, 38, 20, 170, LEAF[0]) + leaf(16, 30, 18, 60, LEAF[2]) +
    '<circle cx="72" cy="14" r="3.4" fill="#a3202e"/><circle cx="56" cy="30" r="3.4" fill="#a3202e"/><circle cx="40" cy="22" r="3.4" fill="#a3202e"/>';
  return (
    `<span class="hol-pd hol-line pd-wheat"><svg viewBox="0 0 120 120"><g transform="rotate(-18 60 110)"><use href="#th-wheat" x="20" y="0" width="14" height="110"/><use href="#th-wheat" x="52" y="-8" width="14" height="116"/><use href="#th-wheat" x="84" y="0" width="14" height="110"/></g></svg></span>` +
    `<span class="hol-pd hol-prop pd-vine"><svg viewBox="0 0 100 52">${vine}</svg></span>` +
    '<span class="hol-pd hol-prop pd-harvest"><svg viewBox="0 0 120 44"><g style="color:#c8a23a"><use href="#th-wheat" x="4" y="0" width="12" height="44"/><use href="#th-wheat" x="14" y="4" width="12" height="40" transform="rotate(10 20 44)"/></g>' +
    '<use href="#th-pk" x="30" y="10" width="34" height="30"/><use href="#th-gourd" x="68" y="8" width="22" height="30"/><use href="#th-acorn" x="94" y="26" width="10" height="13"/><use href="#th-acorn" x="104" y="29" width="9" height="12"/></svg></span>'
  );
}

const backdrop = `<div class="hol-scene th">${sky()}<div class="hol-band th-band hol-wings hol-margin">${band()}</div>${gutters()}</div>`;
const foot = `<div class="hol-foot hol-footband"><div class="hol-band th-band">${band()}</div></div>`;

export default { defs: DEFS, backdrop, dressing: dressing(), foot };
