// Easter: dawn in the meadow
//
// One composition, cropped two ways. The light is the dawn: the sun is just coming up behind a hill, and everything in front of it is a dark green
// silhouette edged with pink and gold, except the things that are meant to be found, which are the colour of sweets: painted eggs. Two clusters stand either
// side of the page:
//   the blossom    a tree in full blossom with its petals coming down, a woven basket of painted eggs, eggs lying in the grass, tulips
//   the egg tree   the sun coming up behind a tree hung with painted eggs on threads, as they are hung in Germany and Austria, daffodils at its foot
// Between them, a meadow of rolling hills with flowers in the grass and eggs hidden in it, and butterflies drifting over. A rabbit sits by the basket.
// On a wide screen the clusters stand in the empty margins either side of the 1040px page, each as wide as its margin; on a phone they stand in the
// corners of the scene at the end of the page, with the same ground and the same meadow between them.
// On every plate: a sprig of pussy willow with an egg hanging from it, tulips with a chick, an egg hanging from a ribbon, and a thin vine behind the text.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols and gradients; `backdrop` is the
// fixed layer; `dressing` is what sits on each plate's edges; `foot` is the scene at the end of the page. They are strings rather than JSX
// because they are static decoration with no state or events, which React would otherwise reconcile on every render of every plate for nothing.
// Nothing in them ever comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-easter.css.
import { rng } from './shared.js';

const NEAR = '#0f2217';
const MID = '#1f4029';
const FAR = '#3d6a4a';
const TRUNK = '#1a1226';
const RIM = 'rgba(255,196,176,.8)';
// The colours of the eggs: pink, lilac, mint, butter, sky, coral.
const EGG = ['#f4a6c0', '#b79cf0', '#8fe0c0', '#f6dc78', '#8cc8f2', '#ff9c8a'];
const BLOSSOM = ['#d9789f', '#e98fb4', '#f2a6c4', '#f7c6d9', '#fde3ec', '#ffffff'];

let uid = 0;

// A painted egg of width `w` and height `h`, centred on (x, y): a base colour, a pattern of a second colour clipped to the egg, and a shine. The shape is
// narrower at the top than the bottom, as an egg is.
function egg(x, y, w, h, base, accent, pattern) {
  const id = `ea-c${uid++}`;
  const t = y - h / 2;
  const b = y + h / 2;
  const l = x - w / 2;
  const r = x + w / 2;
  const d = `M${x} ${t} C${x + w * 0.38} ${t} ${r} ${y - h * 0.04} ${r} ${y + h * 0.14} C${r} ${y + h * 0.38} ${x + w * 0.3} ${b} ${x} ${b} C${x - w * 0.3} ${b} ${l} ${y + h * 0.38} ${l} ${y + h * 0.14} C${l} ${y - h * 0.04} ${x - w * 0.38} ${t} ${x} ${t}Z`;
  let paint = '';
  if (pattern === 'stripe') paint = `<rect x="${l}" y="${y - h * 0.18}" width="${w}" height="${h * 0.14}" fill="${accent}"/><rect x="${l}" y="${y + h * 0.1}" width="${w}" height="${h * 0.14}" fill="${accent}"/>`;
  else if (pattern === 'zig') {
    let z = '';
    for (let i = 0; i <= 6; i++) z += `${i ? 'L' : 'M'}${(l + (i * w) / 6).toFixed(1)} ${(y + (i % 2 ? h * 0.02 : h * 0.16)).toFixed(1)} `;
    paint = `<path d="${z}" stroke="${accent}" stroke-width="${(h * 0.07).toFixed(1)}" fill="none"/>`;
  } else if (pattern === 'dots') {
    for (let k = 0; k < 7; k++) paint += `<circle cx="${(x + Math.cos(k * 2.4) * w * 0.28).toFixed(1)}" cy="${(y + Math.sin(k * 2.4) * h * 0.28).toFixed(1)}" r="${(w * 0.07).toFixed(1)}" fill="${accent}"/>`;
  }
  return (
    `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${base}"/><g clip-path="url(#${id})">${paint}<ellipse cx="${x}" cy="${b - h * 0.08}" rx="${w * 0.5}" ry="${h * 0.22}" fill="#000" opacity=".14"/></g>` +
    `<ellipse cx="${(x - w * 0.18).toFixed(1)}" cy="${(y - h * 0.22).toFixed(1)}" rx="${(w * 0.1).toFixed(1)}" ry="${(h * 0.16).toFixed(1)}" fill="#fff" opacity=".5" transform="rotate(-18 ${(x - w * 0.18).toFixed(1)} ${(y - h * 0.22).toFixed(1)})"/>`
  );
}

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  '<radialGradient id="ea-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d0"/><stop offset=".6" stop-color="#ffd2a0"/><stop offset="1" stop-color="#ff9c8a"/></radialGradient>' +
  '<radialGradient id="ea-halo"><stop offset="0" stop-color="#ffb4a0" stop-opacity=".6"/><stop offset=".4" stop-color="#ff9ab0" stop-opacity=".22"/><stop offset="1" stop-color="#ff9ab0" stop-opacity="0"/></radialGradient>' +
  // the rise the egg tree stands on starts from nothing at the cluster's inner edge, so no edge shows against the ground beside it
  `<linearGradient id="ea-rise" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${FAR}" stop-opacity="0"/><stop offset=".3" stop-color="${FAR}"/></linearGradient>` +
  // a tulip, a daffodil and a petal, each coloured by whoever uses it
  '<symbol id="ea-tulip" viewBox="0 0 30 60"><path d="M15 58 V26" stroke="#3f7a4a" stroke-width="2.4" fill="none"/><path d="M15 54 Q4 46 4 30 Q10 40 15 46Z M15 50 Q26 44 26 30 Q20 38 15 44Z" fill="#3f7a4a"/><path d="M6 8 Q6 28 15 30 Q24 28 24 8 L19 14 L15 4 L11 14Z" fill="currentColor"/><path d="M15 4 L15 28" stroke="rgba(0,0,0,.18)" stroke-width="1"/></symbol>' +
  '<symbol id="ea-daffodil" viewBox="0 0 40 60"><path d="M20 58 V28" stroke="#3f7a4a" stroke-width="2.4" fill="none"/><path d="M20 56 Q8 48 6 30 Q14 40 20 48Z" fill="#3f7a4a"/><g fill="#f6dc78">' +
  Array.from({ length: 6 }, (_, i) => `<ellipse cx="20" cy="12" rx="5" ry="11" transform="rotate(${i * 60} 20 24)"/>`).join('') +
  '</g><ellipse cx="20" cy="24" rx="6" ry="5" fill="#ff9c4a"/><ellipse cx="20" cy="22" rx="3.6" ry="2.6" fill="#ffc67a"/></symbol>' +
  // the rabbit, facing left, sitting up with an egg in its paws, on an 80 x 64 box: the thing to catch
  '<symbol id="ea-rabbit" viewBox="0 0 80 64"><ellipse cx="52" cy="46" rx="21" ry="15" fill="#efe6da"/><ellipse cx="44" cy="38" rx="19" ry="16" fill="#f6efe4"/><circle cx="70" cy="46" r="7" fill="#fffaf2"/>' +
  '<ellipse cx="29" cy="7" rx="4.2" ry="13.5" transform="rotate(14 29 20)" fill="#f6efe4"/><ellipse cx="29" cy="8" rx="2" ry="10" transform="rotate(14 29 20)" fill="#f4a6c0"/><ellipse cx="22" cy="9" rx="3.8" ry="12.5" transform="rotate(-8 22 20)" fill="#efe6da"/><ellipse cx="22" cy="10" rx="1.8" ry="9" transform="rotate(-8 22 20)" fill="#f4a6c0"/>' +
  '<circle cx="25" cy="28" r="12" fill="#f6efe4"/><circle cx="20" cy="26" r="1.8" fill="#2a1a22"/><circle cx="19.4" cy="25.4" r=".6" fill="#fff"/><ellipse cx="14" cy="30.5" rx="2.6" ry="2" fill="#f4a6c0"/><path d="M12 31 L4 29 M12 32 L4 33.5" stroke="#bfae98" stroke-width=".9" stroke-linecap="round"/>' +
  '<g transform="translate(0 0)">' + egg(31, 50, 14, 18, EGG[2], '#fff6f0', 'zig') + '</g>' +
  '<ellipse cx="29" cy="50" rx="5" ry="3.4" fill="#efe6da"/><ellipse cx="34" cy="52" rx="4.4" ry="3" fill="#efe6da"/><ellipse cx="46" cy="60" rx="13" ry="3.6" fill="#e2d8c8"/></symbol>' +
  // two painted eggs for the plates' dressing, which is repeated on every plate and so cannot carry ids of its own, on a 20 x 26 box
  `<symbol id="ea-egg1" viewBox="0 0 20 26">${egg(10, 13, 18, 24, EGG[0], '#fff6f0', 'zig').replace(/ea-c\d+/g, 'ea-egg1c')}</symbol>` +
  `<symbol id="ea-egg2" viewBox="0 0 20 26">${egg(10, 13, 18, 24, EGG[4], '#fff6f0', 'stripe').replace(/ea-c\d+/g, 'ea-egg2c')}</symbol>` +
  // the seal that stands where the house device does: a painted egg between two sprigs, on a 100 x 88 box
  '<symbol id="ea-seal" viewBox="0 0 100 88"><path d="M16 74 Q22 50 34 40 M84 74 Q78 50 66 40" stroke="#4f9a5a" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#4f9a5a"><ellipse cx="22" cy="58" rx="7" ry="3.4" transform="rotate(-50 22 58)"/><ellipse cx="78" cy="58" rx="7" ry="3.4" transform="rotate(50 78 58)"/></g>' +
  egg(50, 44, 40, 54, EGG[0], '#fff6f0', 'zig').replace(/ea-c\d+/g, 'ea-sealc') +
  '<path d="M33 44 H67" stroke="#8a4a9a" stroke-width="3.4" opacity=".0"/><g fill="#b79cf0"><circle cx="42" cy="30" r="2.4"/><circle cx="58" cy="30" r="2.4"/><circle cx="50" cy="26" r="2.4"/></g></symbol>' +
  '</defs></svg>';

// A tulip or a daffodil standing on `y`, `h` tall.
const flower = (kind, x, y, h, color, d) =>
  `<g class="ea-sway" style="--d:-${d}s;transform-origin:${x}px ${y}px"><use href="#ea-${kind}" x="${x - h * 0.25}" y="${y - h}" width="${h * 0.5}" height="${h}" style="color:${color}"/></g>`;

// The blossom: a trunk and a crown of pink and white, with petals coming down from it. Standing on the left of its cluster.
function blossom() {
  const r = rng(37);
  const blob = (n, spread, minR, maxR, colors, cx, cy, bias = 0) => {
    let o = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * spread;
      o += `<circle cx="${(cx + Math.cos(a) * d * 1.05 + bias).toFixed(1)}" cy="${(cy + Math.sin(a) * d * 0.8).toFixed(1)}" r="${(minR + r() * (maxR - minR)).toFixed(1)}" fill="${colors[Math.floor(r() * colors.length)]}"/>`;
    }
    return o;
  };
  const crown = blob(22, 58, 13, 21, [BLOSSOM[0], BLOSSOM[1]], 80, 118) + blob(34, 56, 9, 15, [BLOSSOM[1], BLOSSOM[2], BLOSSOM[3]], 80, 116) + blob(32, 44, 6, 11, [BLOSSOM[3], BLOSSOM[4]], 90, 106, 6) + blob(26, 34, 4, 8, [BLOSSOM[4], BLOSSOM[5]], 100, 98, 8);
  const fall = [[56, 150, 0], [90, 158, 2.2], [118, 142, 4.4], [40, 160, 6.6], [100, 170, 8.8], [70, 146, 11]]
    .map(([x, y, d], i) => `<g class="ea-fall hol-mover" style="--x:${i % 2 ? 24 : -20}px;--d:-${d}s;--t:${11 + (i % 3) * 2}s"><ellipse cx="${x}" cy="${y}" rx="4.4" ry="2.8" fill="${BLOSSOM[2 + (i % 3)]}" transform="rotate(${i * 40} ${x} ${y})"/></g>`)
    .join('');
  let petals = '';
  for (let i = 0; i < 16; i++) petals += `<ellipse cx="${(8 + r() * 130).toFixed(1)}" cy="${(298 + r() * 12).toFixed(1)}" rx="3.4" ry="2" fill="${BLOSSOM[2 + Math.floor(r() * 4)]}" transform="rotate(${Math.round(r() * 180)} 0 0)" opacity=".9"/>`;
  return (
    `<path d="M58 304 C66 276 68 250 66 218 L84 218 C82 250 86 276 96 304Z" fill="${TRUNK}"/>` +
    `<g fill="none" stroke="${TRUNK}" stroke-linecap="round"><path d="M72 220 Q58 182 36 152" stroke-width="9"/><path d="M78 218 Q98 184 124 146" stroke-width="8"/><path d="M74 214 Q76 170 80 112" stroke-width="8"/></g>` +
    `<path d="M86 300 C84 272 84 244 82 220" stroke="${RIM}" stroke-width="1.4" fill="none"/>` +
    crown + petals + fall
  );
}

// The blossom cluster. Drawn on 260 x 330, standing on the left edge.
function blossomCluster() {
  // the basket: a woven body, a rim, a handle, and eggs heaped in it
  const basket =
    '<path d="M122 266 Q150 244 178 266" stroke="#5a3a1c" stroke-width="4" fill="none"/>' +
    egg(134, 268, 18, 23, EGG[0], '#fff6f0', 'stripe') + egg(150, 264, 18, 23, EGG[3], '#ff9c8a', 'zig') + egg(166, 268, 18, 23, EGG[4], '#fff6f0', 'dots') + egg(142, 276, 18, 23, EGG[1], '#fff6f0', 'dots') + egg(158, 276, 18, 23, EGG[2], '#fff6f0', 'stripe') +
    '<path d="M118 272 H182 L174 302 Q150 308 126 302Z" fill="#7a5230"/><path d="M121 280 H179 M123 288 H177 M125 296 H175" stroke="#4a2c14" stroke-width="1.6" fill="none"/><path d="M130 272 L134 302 M142 272 L144 305 M154 272 L154 306 M166 272 L164 305 M178 272 L174 302" stroke="#4a2c14" stroke-width="1.2"/>' +
    '<path d="M118 272 H182" stroke="#a0703c" stroke-width="3" stroke-linecap="round"/>';
  return (
    '<svg class="hol-cl hol-cl-l ea-blossom" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V294Q60 280 130 292T260 300V330Z" fill="${NEAR}"/><path d="M0 294Q60 280 130 292T260 300" stroke="${RIM}" stroke-width="1.2" fill="none" opacity=".6"/>` +
    blossom() + basket +
    egg(26, 300, 14, 18, EGG[5], '#fff6f0', 'zig') + egg(204, 302, 14, 18, EGG[2], '#fff6f0', 'dots') + egg(232, 306, 14, 18, EGG[1], '#fff6f0', 'stripe') +
    flower('tulip', 192, 300, 38, EGG[0], 0.4) + flower('tulip', 206, 302, 30, EGG[3], 1.6) + flower('tulip', 14, 306, 32, EGG[1], 2.8) +
    '</svg>'
  );
}

// The egg tree and the sunrise behind it. Drawn on 260 x 330, standing on the right edge.
function eggTreeCluster() {
  // the branches, and where each egg hangs from: [x on the branch, y on the branch, thread length, width, height, colour, pattern, accent]
  const hang = [
    [100, 124, 26, 18, 23, 0, 'stripe', '#fff6f0'], [124, 142, 22, 18, 23, 3, 'zig', '#ff9c8a'], [150, 104, 30, 19, 24, 4, 'dots', '#fff6f0'],
    [206, 100, 28, 18, 23, 1, 'zig', '#fff6f0'], [228, 140, 24, 18, 23, 2, 'stripe', '#fff6f0'], [178, 150, 34, 20, 25, 5, 'dots', '#fff6f0'],
    [244, 114, 22, 16, 21, 3, 'stripe', '#8a4a9a'], [80, 150, 24, 16, 21, 4, 'zig', '#fff6f0'], [160, 190, 26, 18, 23, 1, 'stripe', '#fff6f0'],
  ]
    .map(([x, y, len, w, h, c, pat, acc], i) => `<g class="ea-egg" style="--d:-${(i * 0.9).toFixed(1)}s;transform-origin:${x}px ${y}px"><path d="M${x} ${y} V${y + len}" stroke="#c9b8a0" stroke-width="1"/>${egg(x, y + len + h / 2, w, h, EGG[c], acc, pat)}</g>`)
    .join('');
  return (
    '<svg class="hol-cl hol-cl-r ea-tree" viewBox="0 0 260 330" aria-hidden="true">' +
    // the sun, coming up, with its halo, and the hill it comes up behind
    '<circle class="ea-halo" cx="150" cy="238" r="170" fill="url(#ea-halo)"/><circle class="ea-sun" cx="150" cy="238" r="46" fill="url(#ea-sun)"/>' +
    `<path d="M0 330V306Q36 302 76 276Q116 252 152 258T260 252V330Z" fill="url(#ea-rise)"/>` +
    // the tree, black against the dawn, with buds on its twigs
    `<g fill="none" stroke="${TRUNK}" stroke-linecap="round"><path d="M176 304 C174 270 176 240 176 190 L176 120" stroke-width="9"/><path d="M176 220 Q140 170 100 124" stroke-width="6"/><path d="M176 196 Q212 160 250 112" stroke-width="6"/><path d="M176 170 Q158 134 150 104" stroke-width="5"/><path d="M176 160 Q196 128 206 100" stroke-width="5"/><path d="M100 124 Q92 138 80 150 M228 140 Q240 126 244 114 M126 144 Q116 150 112 160" stroke-width="3"/></g>` +
    `<path d="M180 300 C178 262 180 232 180 190" stroke="${RIM}" stroke-width="1.3" fill="none"/>` +
    '<g fill="#f2a6c4"><circle cx="100" cy="124" r="2.6"/><circle cx="150" cy="104" r="2.6"/><circle cx="206" cy="100" r="2.6"/><circle cx="250" cy="112" r="2.6"/><circle cx="176" cy="120" r="2.6"/></g>' +
    hang +
    `<path d="M0 330V302Q70 290 150 300T260 296V330Z" fill="${NEAR}"/><path d="M0 302Q70 290 150 300T260 296" stroke="${RIM}" stroke-width="1.1" fill="none" opacity=".55"/>` +
    flower('daffodil', 30, 308, 40, '', 0.2) + flower('daffodil', 52, 304, 34, '', 1.7) + flower('daffodil', 74, 308, 42, '', 3.1) + flower('daffodil', 232, 308, 36, '', 2.3) +
    flower('tulip', 112, 306, 34, EGG[1], 0.9) + flower('tulip', 126, 308, 28, EGG[0], 2.5) +
    '</svg>'
  );
}

// The meadow between the clusters: the far hills with a wood on them, a strip of grass and flowers tiled along the near hill, eggs hidden in it, and
// butterflies drifting over. Percentages are of the band, so the same meadow fits a phone's gap and a wide screen's.
const MEADOW = (function () {
  const r = rng(53);
  let body = '';
  for (let i = 0; i < 34; i++) {
    const x = (i * 160) / 34 + r() * 3;
    const h = 8 + r() * 12;
    body += `<path d="M${x.toFixed(1)} 50 Q${(x + 1.4).toFixed(1)} ${(50 - h * 0.6).toFixed(1)} ${(x + (r() - 0.5) * 6).toFixed(1)} ${(50 - h).toFixed(1)}" stroke="#2f6a3a" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 12; i++) {
    const x = r() * 156;
    const y = 18 + r() * 26;
    const c = ['#fff6f0', '#f6dc78', '#f4a6c0', '#b79cf0'][Math.floor(r() * 4)];
    body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.3 + r() * 1.1).toFixed(1)}" fill="${c}"/>`;
  }
  return 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50">${body}</svg>`) + '")';
})();

function ground() {
  const hidden = [[40, 5, 0, 'zig'], [47, 9, 2, 'dots'], [57, 3, 1, 'stripe'], [34, 11, 3, 'stripe'], [63, 8, 4, 'zig'], [43, 2, 5, 'dots']]
    .map(([x, b, c, pat]) => `<svg class="ea-hid" style="left:${x}%;bottom:${b}%" viewBox="-9 -12 18 24">${egg(0, 0, 14, 18, EGG[c], '#fff6f0', pat)}</svg>`)
    .join('');
  const trees = (function () {
    const r = rng(9);
    let d = 'M0 40 L0 30';
    for (let x = 0; x <= 1000; x += 12) d += ` Q${x + 3} ${14 + r() * 14} ${x + 7} 30`;
    return d + ' L1000 40Z';
  })();
  const butterflies = [[34, 52, 0, EGG[0]], [48, 40, 2.6, EGG[3]], [58, 58, 5.1, EGG[4]]]
    .map(([x, b, d, c]) => `<div class="ea-bf hol-mover" style="left:${x}%;bottom:${b}%;--d:-${d}s;--c:${c}"><svg viewBox="0 0 24 18"><g class="ea-wing"><path d="M12 9 Q4 -2 1 4 Q-1 11 12 9Z M12 9 Q4 20 3 15 Q4 12 12 9Z" fill="currentColor"/></g><g class="ea-wing ea-wing-r"><path d="M12 9 Q20 -2 23 4 Q25 11 12 9Z M12 9 Q20 20 21 15 Q20 12 12 9Z" fill="currentColor"/></g></svg></div>`)
    .join('');
  return (
    '<div class="hol-ground ea-ground">' +
    `<svg class="hol-hill hol-hill-far" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V96Q90 62 190 88T380 74T580 94T780 70T1000 90V200Z" fill="${FAR}"/><path d="${trees}" fill="#2c5238" opacity=".85" transform="translate(0 38) scale(1 1.5)"/></svg>` +
    '<i class="ea-cloud" style="bottom:72%;left:14%;width:30%"></i><i class="ea-cloud ea-cloud2" style="bottom:62%;left:46%;width:36%"></i>' +
    `<svg class="hol-hill hol-hill-mid" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V120Q120 96 260 118T520 108T760 122T1000 104V200Z" fill="${MID}"/></svg>` +
    '<i class="ea-mist"></i>' +
    `<svg class="hol-hill hol-hill-near" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V150Q140 132 300 148T620 140T1000 150V200Z" fill="${NEAR}"/></svg>` +
    `<i class="ea-meadow" style="background-image:${MEADOW}"></i>` + hidden + butterflies +
    '</div>'
  );
}

function band() {
  return ground() + blossomCluster() + eggTreeCluster();
}

function sky() {
  const r = rng(13);
  let stars = '';
  for (let i = 0; i < 14; i++) stars += `<i class="ea-star" style="left:${(r() * 98).toFixed(1)}%;top:${(r() * 40).toFixed(1)}%;--d:-${(r() * 4).toFixed(2)}s"></i>`;
  return `<div class="ea-sky"><i class="ea-haze"></i>${stars}</div>`;
}

// The gutters: the 16px strips beside the page. Nothing the app draws ever enters them, so petals may drift down them however pale.
function gutters() {
  const r = rng(31);
  const side = (cls, sideCss) => {
    let s = '';
    for (let i = 0; i < 6; i++) s += `<i class="ea-gpetal hol-mover" style="${sideCss}:${1 + (i % 3) * 4}px;--c:${BLOSSOM[2 + (i % 4)]};--t:${(11 + r() * 8).toFixed(1)}s;--d:-${(r() * 16).toFixed(1)}s"></i>`;
    return `<div class="hol-gut ${cls}">${s}</div>`;
  };
  return side('l', 'left') + side('r', 'right');
}

// What sits on each plate's edge: a thin vine behind the text, a sprig of pussy willow with an egg on it, tulips with a chick, and an egg hanging from a
// ribbon. All positioned absolutely, so none of it takes a place in the plate's layout.
function dressing() {
  const catkins = [[30, 20, 8], [48, 12, -14], [66, 20, 22], [84, 10, -6]].map(([x, y, rot]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="6.4" fill="#b8b2a8" transform="rotate(${rot} ${x} ${y})"/><ellipse cx="${x - 1}" cy="${y - 1.4}" rx="1.4" ry="2.4" fill="#e8e2d8" transform="rotate(${rot} ${x} ${y})"/>`).join('');
  return (
    '<span class="hol-pd hol-line pd-vine"><svg viewBox="0 0 120 80"><path d="M0 70 C20 66 28 44 50 40 C70 36 80 18 118 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g fill="currentColor"><ellipse cx="22" cy="58" rx="7" ry="3" transform="rotate(-40 22 58)"/><ellipse cx="44" cy="44" rx="7" ry="3" transform="rotate(30 44 44)"/><ellipse cx="66" cy="34" rx="7" ry="3" transform="rotate(-36 66 34)"/><ellipse cx="90" cy="20" rx="7" ry="3" transform="rotate(26 90 20)"/><circle cx="32" cy="52" r="2.4"/><circle cx="76" cy="26" r="2.4"/></g></svg></span>' +
    `<span class="hol-pd hol-prop pd-willow"><svg viewBox="0 0 100 64"><path d="M98 6 C80 4 62 14 46 24 C34 32 20 32 6 26" fill="none" stroke="#6a4a3a" stroke-width="2.2" stroke-linecap="round"/>${catkins}<g class="ea-egg" style="transform-origin:58px 24px"><path d="M58 24 V36" stroke="#c9b8a0" stroke-width="1"/><use href="#ea-egg1" x="50" y="36" width="16" height="21"/></g></svg></span>` +
    '<span class="hol-pd hol-prop pd-spring"><svg viewBox="0 0 110 44"><use href="#ea-tulip" x="6" y="0" width="20" height="44" style="color:#f4a6c0"/><use href="#ea-tulip" x="26" y="6" width="18" height="38" style="color:#f6dc78"/><use href="#ea-tulip" x="44" y="2" width="20" height="42" style="color:#b79cf0"/>' +
    '<g transform="translate(76 18)"><ellipse cx="14" cy="14" rx="12" ry="10" fill="#f6dc78"/><circle cx="8" cy="6" r="7" fill="#f6dc78"/><circle cx="6" cy="5" r="1.2" fill="#2a1a22"/><path d="M1 8 L-4 9.4 L1 11Z" fill="#ff9c4a"/><path d="M12 24 V28 M17 24 V28" stroke="#ff9c4a" stroke-width="1.4"/></g></svg></span>' +
    `<span class="hol-pd hol-prop pd-egghang"><i class="hol-thread"></i><svg viewBox="0 0 30 40"><use href="#ea-egg2" x="5" y="7" width="20" height="26"/></svg></span>`
  );
}

const backdrop = `<div class="hol-scene ea">${sky()}<div class="hol-band ea-band hol-wings hol-margin">${band()}</div>${gutters()}</div>`;
const foot = `<div class="hol-foot hol-footband"><div class="hol-band ea-band">${band()}</div></div>`;

export default { defs: DEFS, backdrop, dressing: dressing(), foot };
