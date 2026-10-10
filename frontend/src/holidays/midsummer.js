// Midsummer: the midnight sun over the lake
//
// One composition, cropped two ways. It is Midsummer Eve in the north, where the night never gets dark: the sun has dipped to the edge of the lake and
// hangs there, gold and rose, and everything in front of it is a deep teal silhouette edged with its light, except the flowers, which are picked out in
// their own colours. Two clusters stand either side of the page:
//   the birches    a grove of white birches in new leaf, and in front of them a meadow of wildflowers (daisies, cornflowers, buttercups, clover) with a
//                  firefly resting on a daisy
//   the maypole    the sun going down behind a maypole hung with wreaths and garlands and its ribbons, a red cottage with white corners and lit windows,
//                  the lake with a path of sunlight on it
// Between them, the lake with a rowing boat drifting on it with a lantern, and the far shore of dark forest. Swallows cross, and the gutters carry seed
// fluff drifting up out of the meadow.
// On a wide screen the clusters stand in the empty margins either side of the 1040px page, each as wide as its margin; on a phone they stand in the
// corners of the scene at the end of the page, with the same lake between them.
// On every plate: a crown of flowers hanging from a corner, a chain of daisies and cornflowers along the bottom edge, maypole ribbons, and a faint
// sprig of meadow behind the text.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols and gradients; `backdrop` is the
// fixed layer; `dressing` is what sits on each plate's edges; `foot` is the scene at the end of the page. They are strings rather than JSX
// because they are static decoration with no state or events, which React would otherwise reconcile on every render of every plate for nothing.
// Nothing in them ever comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-midsummer.css.
import { rng } from './shared.js';

const NEAR = '#081a1c';
const SHORE = '#1c4a4c';
const WATER = '#1b4650';
const RIM = 'rgba(255,196,150,.8)';
const LEAF = ['#2f7a4a', '#4f9a5a', '#7fc47a', '#b4e08a'];
const COLORS = { daisy: '#fffdf0', corn: '#4f78e8', butter: '#f6d83a', clover: '#e87aa8', lupine: '#9a6ad8' };

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  '<radialGradient id="ms-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff4c8"/><stop offset=".6" stop-color="#ffd08a"/><stop offset="1" stop-color="#ff9c70"/></radialGradient>' +
  '<radialGradient id="ms-halo"><stop offset="0" stop-color="#ffc08a" stop-opacity=".62"/><stop offset=".4" stop-color="#ff9a7a" stop-opacity=".22"/><stop offset="1" stop-color="#ff8a6a" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="ms-glow"><stop offset="0" stop-color="#eaff7a" stop-opacity=".8"/><stop offset=".4" stop-color="#cfff4a" stop-opacity=".26"/><stop offset="1" stop-color="#cfff4a" stop-opacity="0"/></radialGradient>' +
  // the far shore and the water start from nothing at the cluster's inner edge, so no edge shows against the lake beside it
  `<linearGradient id="ms-rise" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${SHORE}" stop-opacity="0"/><stop offset=".3" stop-color="${SHORE}"/></linearGradient>` +
  `<linearGradient id="ms-water" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${WATER}" stop-opacity="0"/><stop offset=".3" stop-color="${WATER}"/></linearGradient>` +
  // a flower seen from the side, on a 30 x 60 box: a stem, two leaves, a head; coloured by whoever uses it
  '<symbol id="ms-daisy" viewBox="0 0 30 60"><path d="M15 58 V22" stroke="#3f8a4a" stroke-width="2.2" fill="none"/><path d="M15 50 Q6 46 5 38 Q12 40 15 46Z M15 44 Q24 40 25 33 Q18 35 15 40Z" fill="#3f8a4a"/><g fill="#fffdf0">' +
  Array.from({ length: 10 }, (_, i) => `<ellipse cx="15" cy="10" rx="2.8" ry="7" transform="rotate(${i * 36} 15 17)"/>`).join('') +
  '</g><circle cx="15" cy="17" r="4.4" fill="#f6c84a"/></symbol>' +
  '<symbol id="ms-corn" viewBox="0 0 30 60"><path d="M15 58 V22" stroke="#3f8a4a" stroke-width="2" fill="none"/><path d="M15 50 Q6 48 4 40 Q12 40 15 46Z" fill="#3f8a4a"/><g fill="#4f78e8">' +
  Array.from({ length: 8 }, (_, i) => `<path d="M15 17 L12.4 4 L15 7 L17.6 4Z" transform="rotate(${i * 45} 15 17)"/>`).join('') +
  '</g><circle cx="15" cy="17" r="3.6" fill="#2a3a9a"/></symbol>' +
  '<symbol id="ms-butter" viewBox="0 0 30 60"><path d="M15 58 V20" stroke="#3f8a4a" stroke-width="2" fill="none"/><path d="M15 52 Q24 48 26 40 Q18 40 15 46Z" fill="#3f8a4a"/><g fill="#f6d83a">' +
  Array.from({ length: 5 }, (_, i) => `<circle cx="15" cy="11" r="5.4" transform="rotate(${i * 72} 15 17)"/>`).join('') +
  '</g><circle cx="15" cy="17" r="3" fill="#f0a020"/></symbol>' +
  '<symbol id="ms-clover" viewBox="0 0 30 60"><path d="M15 58 V24" stroke="#3f8a4a" stroke-width="2" fill="none"/><path d="M15 50 Q5 46 4 38 Q12 40 15 46Z M15 44 Q25 40 26 32 Q18 34 15 40Z" fill="#3f8a4a"/><ellipse cx="15" cy="17" rx="8" ry="9" fill="#e87aa8"/><g fill="#f4a6c8"><circle cx="11" cy="13" r="2.4"/><circle cx="18" cy="12" r="2.4"/><circle cx="14" cy="20" r="2.4"/><circle cx="19" cy="19" r="2.4"/></g></symbol>' +
  // flower heads seen from the front, on a 20 x 20 box, for crowns and chains
  '<symbol id="ms-daisyhead" viewBox="0 0 20 20"><g fill="#fffdf0">' +
  Array.from({ length: 10 }, (_, i) => `<ellipse cx="10" cy="4" rx="2.4" ry="5.4" transform="rotate(${i * 36} 10 10)"/>`).join('') +
  '</g><circle cx="10" cy="10" r="3.4" fill="#f6c84a"/></symbol>' +
  '<symbol id="ms-cornhead" viewBox="0 0 20 20"><g fill="#4f78e8">' +
  Array.from({ length: 8 }, (_, i) => `<path d="M10 10 L7.8 1 L10 3.4 L12.2 1Z" transform="rotate(${i * 45} 10 10)"/>`).join('') +
  '</g><circle cx="10" cy="10" r="2.6" fill="#2a3a9a"/></symbol>' +
  '<symbol id="ms-butterhead" viewBox="0 0 20 20"><g fill="#f6d83a">' +
  Array.from({ length: 5 }, (_, i) => `<circle cx="10" cy="4.6" r="3.8" transform="rotate(${i * 72} 10 10)"/>`).join('') +
  '</g><circle cx="10" cy="10" r="2.4" fill="#f0a020"/></symbol>' +
  // the firefly, facing left, its tail alight, on a 50 x 40 box: the thing to catch
  '<symbol id="ms-firefly" viewBox="0 0 50 40"><circle cx="34" cy="22" r="19" fill="url(#ms-glow)"/><ellipse cx="22" cy="14" rx="9" ry="4.4" transform="rotate(-24 22 14)" fill="#dff4ff" opacity=".7"/><ellipse cx="28" cy="13" rx="9" ry="4" transform="rotate(-10 28 13)" fill="#dff4ff" opacity=".55"/>' +
  '<ellipse cx="26" cy="22" rx="10" ry="4.6" fill="#2a2418"/><ellipse cx="35" cy="23" rx="7.4" ry="5.4" fill="#eaff7a"/><ellipse cx="34" cy="22" rx="4" ry="3" fill="#fbffd0"/><circle cx="15" cy="22" r="4.2" fill="#2a2418"/><path d="M12 19 Q8 12 4 12 M14 18 Q12 10 8 7" stroke="#2a2418" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M20 27 L18 34 M26 27 L26 35 M31 27 L33 34" stroke="#2a2418" stroke-width="1.2" stroke-linecap="round"/></symbol>' +
  // the seal that stands where the house device does: a crown of flowers and leaves, on a 100 x 88 box
  '<symbol id="ms-seal" viewBox="0 0 100 88"><g transform="translate(50 44)">' +
  Array.from({ length: 12 }, (_, i) => `<ellipse cx="0" cy="-30" rx="5" ry="8.5" fill="${LEAF[i % 2]}" transform="rotate(${i * 30 + 15})"/>`).join('') +
  Array.from({ length: 8 }, (_, i) => `<use href="#ms-${['daisyhead', 'cornhead', 'butterhead', 'daisyhead'][i % 4]}" x="-9" y="-41" width="18" height="18" transform="rotate(${i * 45})"/>`).join('') +
  '</g></symbol>' +
  '</defs></svg>';

const FLOWERS = ['daisy', 'corn', 'butter', 'clover'];
const flower = (kind, x, y, h, d) =>
  `<g class="ms-sway" style="--d:-${d}s;transform-origin:${x}px ${y}px"><use href="#ms-${kind}" x="${x - h * 0.25}" y="${y - h}" width="${h * 0.5}" height="${h}"/></g>`;

// A birch: a white trunk with its dark marks and a few bare twigs, standing on `base`, `h` tall, with a head of new leaves lit on the side the sun is on.
function birch(r, x, base, h, w, foliage) {
  const top = base - h;
  let marks = '';
  for (let y = base - 20; y > top + 26; y -= 14 + r() * 12) marks += `<rect x="${(x - w / 2 + r() * 1.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(w * (0.4 + r() * 0.5)).toFixed(1)}" height="${(1.6 + r() * 1.6).toFixed(1)}" fill="#2a2a2e"/>`;
  let leaves = '';
  for (let i = 0; i < foliage; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 26;
    leaves += `<circle cx="${(x + Math.cos(a) * d * 0.9 + 4).toFixed(1)}" cy="${(top + 18 + Math.sin(a) * d * 1.1).toFixed(1)}" r="${(4 + r() * 6).toFixed(1)}" fill="${LEAF[Math.floor(r() * 4)]}"/>`;
  }
  return (
    `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${h}" rx="${w / 2}" fill="#e8e2d4"/>` +
    `<path d="M${x + w / 2} ${top + 8} V${base}" stroke="${RIM}" stroke-width="1.2" fill="none"/>` +
    `<path d="M${x - w / 2 + 1} ${top + 6} V${base}" stroke="rgba(0,0,0,.28)" stroke-width="${(w * 0.4).toFixed(1)}" fill="none"/>` +
    marks +
    `<g stroke="#e0d8c8" stroke-width="2" stroke-linecap="round" fill="none"><path d="M${x} ${top + 30} Q${x - 14} ${top + 20} ${x - 20} ${top + 4}"/><path d="M${x} ${top + 24} Q${x + 14} ${top + 12} ${x + 18} ${top - 2}"/></g>` +
    `<g class="ms-leaves" style="transform-origin:${x}px ${top + 30}px">${leaves}</g>`
  );
}

// The birch cluster. Drawn on 260 x 330, standing on the left edge.
function birchCluster() {
  const r = rng(71);
  let tall = '';
  for (let i = 0; i < 34; i++) {
    const x = 6 + r() * 248;
    tall += `<path d="M${x.toFixed(1)} 308 Q${(x + (r() - 0.5) * 6).toFixed(1)} ${(296 - r() * 14).toFixed(1)} ${(x + (r() - 0.5) * 10).toFixed(1)} ${(284 - r() * 16).toFixed(1)}" stroke="#2a6a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  // the meadow's flowers: the smaller ones behind, the larger in front
  const row = [[16, 306, 34], [34, 310, 44], [58, 304, 30], [150, 308, 40], [170, 304, 32], [188, 310, 46], [206, 306, 34], [228, 310, 42], [246, 305, 30], [74, 312, 48], [100, 306, 36], [124, 310, 42]]
    .map(([x, y, h], i) => flower(FLOWERS[(i * 3 + 1) % 4], x, y, h, (i * 0.7) % 4))
    .join('');
  return (
    '<svg class="hol-cl hol-cl-l ms-birches" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V296Q60 284 130 296T260 302V330Z" fill="${NEAR}"/><path d="M0 296Q60 284 130 296T260 302" stroke="${RIM}" stroke-width="1.2" fill="none" opacity=".6"/>` +
    birch(r, 40, 300, 250, 8, 26) + birch(r, 84, 302, 292, 9, 30) + birch(r, 122, 300, 218, 7, 22) + birch(r, 12, 300, 190, 6, 16) +
    tall + row +
    // the tallest daisy of all, with the firefly's place at its head
    flower('daisy', 138, 308, 66, 0) +
    '</svg>'
  );
}

// The maypole cluster. Drawn on 260 x 330, standing on the right edge.
function maypoleCluster() {
  // a wreath: a thick ring of leaves with flowers in it, hanging from the arm
  const wreath = (cx, cy) => {
    let o = `<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="#1f5a32" stroke-width="6"/>`;
    for (let i = 0; i < 10; i++) {
      const a = (i * 36 * Math.PI) / 180;
      o += `<circle cx="${(cx + Math.cos(a) * 14).toFixed(1)}" cy="${(cy + Math.sin(a) * 14).toFixed(1)}" r="2.8" fill="${[COLORS.daisy, COLORS.corn, COLORS.butter, COLORS.clover][i % 4]}"/>`;
    }
    return o;
  };
  // the garland winding up the pole
  let garland = '';
  for (let i = 0; i < 12; i++) {
    const y = 296 - i * 18;
    garland += `<circle cx="${150 + (i % 2 ? 6 : -6)}" cy="${y}" r="3.2" fill="${[COLORS.daisy, COLORS.corn, COLORS.butter][i % 3]}"/>`;
  }
  const ribbon = (x, c, d) => `<g class="ms-ribbon" style="--d:-${d}s;transform-origin:${x}px 118px"><path d="M${x} 118 Q${x + 5} 150 ${x - 2} 184" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
  return (
    '<svg class="hol-cl hol-cl-r ms-maypole" viewBox="0 0 260 330" aria-hidden="true">' +
    // the sun, low on the lake, with its halo, then the far shore and the water with the path of sunlight on it
    '<circle class="ms-halo" cx="150" cy="256" r="170" fill="url(#ms-halo)"/><circle class="ms-sun" cx="150" cy="256" r="44" fill="url(#ms-sun)"/>' +
    `<path d="M0 330V270Q50 266 100 262Q150 258 200 264T260 262V330Z" fill="url(#ms-rise)"/>` +
    '<rect x="0" y="266" width="260" height="60" fill="url(#ms-water)"/>' +
    '<g class="ms-glitter" fill="#ffd9a0">' +
    Array.from({ length: 10 }, (_, i) => `<rect class="ms-gl" x="${150 - 28 + (i % 3) * 8 - i * 1.4}" y="${270 + i * 4.4}" width="${56 - i * 3.2}" height="1.8" rx="1" style="--d:-${(i * 0.45).toFixed(2)}s"/>`).join('') +
    '</g>' +
    // the maypole, black against the sun: the pole, two arms, wreaths hanging from the lower one, ribbons, a pennant, and the garland up the pole
    `<g fill="#14100e"><rect x="147.5" y="58" width="5" height="244"/><rect x="118" y="86" width="64" height="3"/><rect x="96" y="116" width="108" height="3.4"/><circle cx="150" cy="54" r="4.4"/></g>` +
    `<path d="M152 52 L172 58 L152 64Z" fill="#4f78e8"/><path d="M152 58 L172 58" stroke="#f6d83a" stroke-width="2"/>` +
    '<path d="M147 70 V300" stroke="rgba(255,196,150,.7)" stroke-width="1" fill="none"/>' +
    wreath(110, 138) + wreath(190, 138) + wreath(150, 104) +
    ribbon(98, '#4f78e8', 0) + ribbon(104, '#f6d83a', 1.2) + ribbon(196, '#f6d83a', 0.6) + ribbon(202, '#4f78e8', 1.8) +
    garland +
    // the red cottage with white corners, its windows lit, beside the pole
    '<g class="ms-cottage"><rect x="196" y="262" width="58" height="36" fill="#5a1a1c"/><path d="M190 264 L225 240 L260 264Z" fill="#150f12"/><rect x="238" y="244" width="8" height="16" fill="#150f12"/>' +
    '<rect x="196" y="262" width="3" height="36" fill="#e8dfc8"/><rect x="251" y="262" width="3" height="36" fill="#e8dfc8"/><path d="M190 264 L225 240 L260 264" stroke="#e8dfc8" stroke-width="1.6" fill="none"/>' +
    '<rect class="ms-win" x="205" y="270" width="13" height="13" fill="#ffd27a" stroke="#e8dfc8" stroke-width="1.6"/><rect class="ms-win" x="228" y="270" width="13" height="13" fill="#ffd27a" stroke="#e8dfc8" stroke-width="1.6" style="--d:-2s"/>' +
    '<rect x="217" y="284" width="10" height="14" fill="#2a1612" stroke="#e8dfc8" stroke-width="1.4"/></g>' +
    `<path d="M0 330V316Q50 308 110 316T190 300Q226 294 260 298V330Z" fill="${NEAR}"/><path d="M0 316Q50 308 110 316T190 300Q226 294 260 298" stroke="${RIM}" stroke-width="1.1" fill="none" opacity=".55"/>` +
    flower('daisy', 20, 322, 34, 0.4) + flower('corn', 44, 320, 28, 1.7) + flower('butter', 70, 322, 36, 3) + flower('daisy', 200, 306, 28, 2.3) + flower('corn', 232, 312, 36, 0.9) +
    '</svg>'
  );
}

// The ground between the clusters: the far shore of forest, the lake with a boat and a lantern on it, and the near bank. Percentages are of the band, so the
// same lake fits a phone's gap and a wide screen's.
function ground() {
  const forest = (function () {
    const r = rng(17);
    let d = 'M0 40 L0 28';
    for (let x = 0; x <= 1000; x += 11) {
      const h = 8 + r() * 12;
      d += ` L${x + 3} ${28 - h} L${x + 6} 28`;
    }
    return d + ' L1000 40Z';
  })();
  const swallow = (x, y, d, dur) =>
    `<div class="ms-swallow hol-mover" style="left:${x}%;bottom:${y}%;--d:-${d}s;--dur:${dur}s"><svg viewBox="0 0 30 12"><path d="M1 3 Q8 11 15 6 Q22 11 29 3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  return (
    '<div class="hol-ground ms-ground">' +
    `<svg class="hol-hill hol-hill-far" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V96Q90 62 190 88T380 74T580 94T780 70T1000 90V200Z" fill="${SHORE}"/><path d="${forest}" fill="#0f2e30" transform="translate(0 40) scale(1 1.7)" opacity=".9"/></svg>` +
    '<div class="ms-lake">' +
    '<div class="ms-boat hol-mover"><svg viewBox="0 0 44 22"><circle cx="9" cy="8" r="9" fill="url(#ms-glow)"/><path d="M2 12 H42 Q38 20 30 20 H12 Q5 20 2 12Z" fill="#14100e"/><path d="M2 12 H42" stroke="rgba(255,196,150,.7)" stroke-width="1"/><path d="M9 4 V12" stroke="#14100e" stroke-width="1.4"/><rect x="6.4" y="3" width="5.2" height="6" rx="1" fill="#ffd27a"/><path d="M18 11 L34 6" stroke="#14100e" stroke-width="1.4" stroke-linecap="round"/></svg></div></div>' +
    swallow(26, 62, 0, 22) + swallow(52, 70, 7, 30) + swallow(70, 56, 13, 26) +
    `<svg class="hol-hill hol-hill-near" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V150Q140 132 300 148T620 140T1000 150V200Z" fill="${NEAR}"/></svg>` +
    '</div>'
  );
}

function band() {
  return ground() + birchCluster() + maypoleCluster();
}

function sky() {
  const r = rng(5);
  let motes = '';
  for (let i = 0; i < 12; i++) motes += `<i class="ms-mote" style="left:${(r() * 98).toFixed(1)}%;top:${(r() * 56).toFixed(1)}%;--d:-${(r() * 5).toFixed(2)}s"></i>`;
  return `<div class="ms-sky"><i class="ms-haze"></i>${motes}</div>`;
}

// The gutters: the 16px strips beside the page. Nothing the app draws ever enters them, so seed fluff may drift up them however pale.
function gutters() {
  const r = rng(43);
  const side = (cls, sideCss) => {
    let s = '';
    for (let i = 0; i < 6; i++) s += `<i class="ms-gseed hol-mover" style="${sideCss}:${1 + (i % 3) * 4}px;--t:${(14 + r() * 10).toFixed(1)}s;--d:-${(r() * 18).toFixed(1)}s"></i>`;
    return `<div class="hol-gut ${cls}">${s}</div>`;
  };
  return side('l', 'left') + side('r', 'right');
}

// What sits on each plate's edge: a sprig of meadow behind the text, a crown of flowers hanging from a corner, maypole ribbons, and a chain of daisies and
// cornflowers along the bottom edge. All positioned absolutely, so none of it takes a place in the plate's layout.
function dressing() {
  let crown = '<circle cx="24" cy="24" r="15" fill="none" stroke="#1f5a32" stroke-width="5"/>';
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 * Math.PI) / 180;
    crown += `<use href="#ms-${['daisyhead', 'cornhead', 'butterhead', 'daisyhead', 'cornhead'][i % 5]}" x="${(24 + Math.cos(a) * 15 - 5.5).toFixed(1)}" y="${(24 + Math.sin(a) * 15 - 5.5).toFixed(1)}" width="11" height="11"/>`;
  }
  const chain = Array.from({ length: 8 }, (_, i) => `<use href="#ms-${['daisyhead', 'cornhead', 'butterhead', 'daisyhead'][i % 4]}" x="${i * 13}" y="${i % 2 ? 6 : 3}" width="13" height="13"/>`).join('');
  return (
    '<span class="hol-pd hol-line pd-meadow"><svg viewBox="0 0 100 80"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 80 Q12 56 8 38 M26 80 Q28 50 36 30 M44 80 Q42 58 52 44 M60 80 Q62 64 72 56"/></g><g fill="currentColor"><circle cx="8" cy="36" r="3"/><circle cx="36" cy="28" r="3.4"/><circle cx="52" cy="42" r="3"/><circle cx="72" cy="54" r="2.6"/></g></svg></span>' +
    `<span class="hol-pd hol-prop pd-crown"><svg viewBox="0 0 48 48">${crown}</svg></span>` +
    '<span class="hol-pd hol-prop pd-ribbons"><svg viewBox="0 0 56 50"><path d="M10 0 C2 10 18 16 10 28 C4 36 14 44 12 50" fill="none" stroke="#4f78e8" stroke-width="3.2" stroke-linecap="round"/><path d="M28 0 C20 10 36 16 28 28 C22 36 32 44 30 48" fill="none" stroke="#f6d83a" stroke-width="3" stroke-linecap="round"/><path d="M46 0 C38 10 54 16 46 26" fill="none" stroke="#e87aa8" stroke-width="3" stroke-linecap="round"/></svg></span>' +
    `<span class="hol-pd hol-prop pd-chain"><svg viewBox="0 0 104 20"><path d="M2 8 Q52 22 102 8" fill="none" stroke="#2f7a4a" stroke-width="2"/>${chain}</svg></span>`
  );
}

const backdrop = `<div class="hol-scene ms">${sky()}<div class="hol-band ms-band hol-wings hol-margin">${band()}</div>${gutters()}</div>`;
const foot = `<div class="hol-foot hol-footband"><div class="hol-band ms-band">${band()}</div></div>`;

export default { defs: DEFS, backdrop, dressing: dressing(), foot };
