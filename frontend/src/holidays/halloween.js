// Halloween: the lantern night
//
// One composition, cropped two ways. The lighting is the idea: there are only two lights, the warm lanterns and the cold moon, and everything
// else is a silhouette lit by one or the other. It is a graveyard on Halloween night. Two clusters stand either side of the page, pinned to its edges:
//   the oak       leaning gravestones and a cross, a bare oak with an owl in it, two lanterns at its foot
//   the gate      the moon, a wrought-iron gate between stone pillars with a black cat on one and a turnip lantern on the other, a hooked
//                 lantern pole, a heap of pumpkins
// Between them, on the far hills: a crypt, headstones, a cross and an obelisk, with a ghost gliding through and cold lights bobbing over the graves.
// On a wide screen they stand in the empty margins either side of the 1040px page; on a phone they stand in the corners of the scene at the
// end of the page, with the same ground and the same far lane of lanterns running between them. Nothing differs but where they stand.
// Over the whole page a sky of stars, thin cloud and a loose stream of bats; on every plate a cobweb, a lowering spider, a hanging bat and a
// small lit lantern, which sit on the plate's edge and add nothing to the layout.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols and gradients; `backdrop` is the
// fixed layer; `dressing` is what sits on each plate's edges; `foot` is the scene at the end of the page. They are strings rather than JSX
// because they are static decoration with no state or events, which React would otherwise reconcile on every render of every plate for nothing.
// Nothing in them ever comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-halloween.css.
import { rng } from './shared.js';

const NEAR = '#090510';
const MID = '#0c0614';
const STONE = '#1c1030';
const RIM = 'rgba(150,126,206,.55)';

// Cobweb: spokes from a corner and sagging rings between them, from a fixed seed so every web is the same web.
const WEB = (function () {
  let seed = 7;
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const angles = [0, 16, 33, 51, 70, 90].map((a) => (a * Math.PI) / 180);
  const radii = [26, 54, 86, 120, 154, 188];
  let d = '';
  angles.forEach((a, i) => {
    const R = i === 0 || i === angles.length - 1 ? 196 : 176 + r() * 18;
    d += `M0 0 L${(Math.cos(a) * R).toFixed(1)} ${(Math.sin(a) * R).toFixed(1)} `;
  });
  radii.forEach((rr) => {
    for (let i = 0; i < angles.length - 1; i++) {
      const r1 = rr * (0.96 + r() * 0.08);
      const r2 = rr * (0.96 + r() * 0.08);
      const mid = (angles[i] + angles[i + 1]) / 2;
      const rc = rr * 0.8;
      d += `M${(Math.cos(angles[i]) * r1).toFixed(1)} ${(Math.sin(angles[i]) * r1).toFixed(1)} Q${(Math.cos(mid) * rc).toFixed(1)} ${(Math.sin(mid) * rc).toFixed(1)} ${(Math.cos(angles[i + 1]) * r2).toFixed(1)} ${(Math.sin(angles[i + 1]) * r2).toFixed(1)} `;
    }
  });
  return `<symbol id="hw-web" viewBox="0 0 200 200"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="${d}"/></symbol>`;
})();

// The carved faces. Each is the lit part only (the flame showing through), drawn on a 100 x 88 pumpkin.
const FACES = [
  // 1: the classic: triangle eyes, a nose, a toothy zigzag grin
  '<path d="M27 40 L43 40 L35 54Z M57 40 L73 40 L65 54Z M50 54 L45 63 L55 63Z M24 64 L34 73 L41 66 L50 75 L59 66 L66 73 L76 64 L72 78 L58 83 L42 83 L28 78Z"/>',
  // 2: round eyes and a wide smile
  '<circle cx="36" cy="46" r="6.5"/><circle cx="64" cy="46" r="6.5"/><path d="M26 62 Q50 90 74 62 Q50 74 26 62Z"/>',
  // 3: surprised: tall oval eyes, an open mouth
  '<ellipse cx="36" cy="46" rx="5" ry="8"/><ellipse cx="64" cy="46" rx="5" ry="8"/><ellipse cx="50" cy="69" rx="9" ry="10"/>',
  // 4: sly: slanted eyes, a crooked grin with two fangs
  '<path d="M24 38 L44 46 L40 53 L26 48Z M76 38 L56 46 L60 53 L74 48Z M26 63 Q50 84 76 60 L70 70 L63 66 L60 78 L54 70 L46 70 L40 78 L37 66 L30 71Z"/>',
];

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  // light
  '<radialGradient id="hw-pool"><stop offset="0" stop-color="#ffb04a" stop-opacity=".62"/><stop offset=".4" stop-color="#ff9a2e" stop-opacity=".22"/><stop offset="1" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="hw-halo"><stop offset=".45" stop-color="#cdb8f0" stop-opacity=".26"/><stop offset="1" stop-color="#8a6cc4" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="hw-moon" cx=".38" cy=".34" r=".8"><stop offset="0" stop-color="#fbf4dc"/><stop offset=".62" stop-color="#e9dcb8"/><stop offset="1" stop-color="#c7b98f"/></radialGradient>' +
  '<linearGradient id="hw-pk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6a23c"/><stop offset=".55" stop-color="#e4741a"/><stop offset="1" stop-color="#a9440a"/></linearGradient>' +
  '<linearGradient id="hw-pkdim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4a1a"/><stop offset="1" stop-color="#4a230a"/></linearGradient>' +
  '<radialGradient id="hw-flame" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#fff6c2"/><stop offset=".6" stop-color="#ffd36b"/><stop offset="1" stop-color="#ffab3a"/></radialGradient>' +
  // a pumpkin, three lobes and a stem, on a 100 x 88 box
  '<symbol id="hw-pkb" viewBox="0 0 100 88"><ellipse cx="27" cy="54" rx="23" ry="31" fill="url(#hw-pk)"/><ellipse cx="73" cy="54" rx="23" ry="31" fill="url(#hw-pk)"/><ellipse cx="50" cy="54" rx="27" ry="33" fill="url(#hw-pk)"/><path d="M38 28 Q36 70 38 86 M62 28 Q64 70 62 86" fill="none" stroke="#8a3a08" stroke-opacity=".45" stroke-width="2.4"/><path d="M45 25 Q47 10 58 7 Q55 16 56 25Z" fill="#33210e"/></symbol>' +
  '<symbol id="hw-pkd" viewBox="0 0 100 88"><ellipse cx="27" cy="54" rx="23" ry="31" fill="url(#hw-pkdim)"/><ellipse cx="73" cy="54" rx="23" ry="31" fill="url(#hw-pkdim)"/><ellipse cx="50" cy="54" rx="27" ry="33" fill="url(#hw-pkdim)"/><path d="M45 25 Q47 10 58 7 Q55 16 56 25Z" fill="#24160a"/></symbol>' +
  FACES.map((f, i) => `<symbol id="hw-f${i + 1}" viewBox="0 0 100 88"><g fill="url(#hw-flame)">${f}</g></symbol>`).join('') +
  // a turnip lantern: the older kind, pale, with a small face and a root tail
  '<symbol id="hw-tn" viewBox="0 0 60 72"><path d="M30 70 Q29 62 30 58" stroke="#b9ae8c" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="36" rx="25" ry="24" fill="#d9cfae"/><path d="M26 12 Q28 3 36 2 Q34 8 34 13Z" fill="#6f6a46"/><g fill="#ffe08a"><path d="M18 28 L26 28 L22 36Z M34 28 L42 28 L38 36Z"/><path d="M19 42 Q30 54 41 42 L38 48 L30 50 L22 48Z"/></g></symbol>' +
  // a bat, wings spread, for the sky (it is drawn lighter than the ground so it can be seen against it)
  '<symbol id="hw-bat" viewBox="0 0 60 30"><path fill="currentColor" d="M30 15 Q26 6 18 4 Q10 2 2 10 Q8 10 11 14 Q14 12 17 15 Q22 12 26 18 Q28 24 30 24 Q32 24 34 18 Q38 12 43 15 Q46 12 49 14 Q52 10 58 10 Q50 2 42 4 Q34 6 30 15Z"/><path fill="currentColor" d="M27 12 L28 5 L31 11 L34 5 L35 12Z"/></symbol>' +
  '<symbol id="hw-spider" viewBox="0 0 60 60"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M26 28 L14 17 L5 23"/><path d="M25 31 L9 28 L3 37"/><path d="M25 34 L10 42 L6 54"/><path d="M27 36 L18 50 L17 58"/><path d="M34 28 L46 17 L55 23"/><path d="M35 31 L51 28 L57 37"/><path d="M35 34 L50 42 L54 54"/><path d="M33 36 L42 50 L43 58"/></g><ellipse cx="30" cy="38" rx="7.5" ry="9.5" fill="currentColor"/><circle cx="30" cy="26" r="5" fill="currentColor"/></symbol>' +
  WEB +
  '</defs></svg>';

// A lit pumpkin: a pool of light, the body, the face. `d` staggers the lighting so the lanterns come on one after another.
function pumpkin(x, y, w, face, d, tail = '') {
  const h = (w * 0.88).toFixed(1);
  return (
    `<circle class="hw-pool" cx="${(x + w / 2).toFixed(1)}" cy="${(y + h * 0.6).toFixed(1)}" r="${(w * 1.55).toFixed(1)}" fill="url(#hw-pool)" style="--d:${d}s"/>` +
    `<use href="#hw-pkb" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
    `<use class="hw-face" href="#hw-f${face}" x="${x}" y="${y}" width="${w}" height="${h}" style="--d:${d}s"/>${tail}`
  );
}

// The oak: trunk, branches, owl, stooks, two lanterns. Drawn on 260 x 330, standing on the left edge.
function oak() {
  return (
    '<svg class="hw-cl hw-oak" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V298Q56 280 118 292T260 286V330Z" fill="${NEAR}"/>` +
    // three graves, moonlit along their edges: a leaning cross, a rounded stone, a slab
    `<g fill="${STONE}" stroke="${RIM}" stroke-width="1.1"><path d="M30 308 V270 Q30 254 42 254 Q54 254 54 270 V308Z"/><path d="M60 308 L64 276 L86 280 L84 308Z"/></g>` +
    `<path d="M38 276 H46 M36 284 H48" stroke="${RIM}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<g transform="rotate(-7 14 308)"><path d="M14 308 V246 M2 262 H26" stroke="${STONE}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M14 308 V246 M2 262 H26" stroke="${RIM}" stroke-width="1" stroke-linecap="round" fill="none" transform="translate(-2.4 0)"/></g>` +
    // the trunk and its roots
    `<path d="M92 310 C106 288 108 264 104 238 C100 214 108 192 106 168 L122 168 C126 192 134 214 130 240 C128 264 132 288 150 310Z" fill="${NEAR}"/>` +
    `<g fill="none" stroke="${NEAR}" stroke-linecap="round" stroke-width="8"><path d="M114 176 Q84 154 60 130"/><path d="M116 172 Q96 138 90 100"/><path d="M114 182 Q150 160 184 152 Q206 146 226 124"/><path d="M178 154 Q190 130 186 102"/><path d="M110 170 Q134 140 146 112"/></g>` +
    `<g fill="none" stroke="${NEAR}" stroke-linecap="round" stroke-width="3.6"><path d="M60 130 Q46 120 40 102 M60 130 Q68 118 70 100"/><path d="M90 100 Q82 88 84 74 M90 100 Q100 90 106 82"/><path d="M226 124 Q238 118 248 104 M226 124 Q240 130 254 128"/><path d="M186 102 Q194 92 204 90"/><path d="M146 112 Q140 100 142 86 M146 112 Q156 104 164 106"/><path d="M118 150 Q104 142 98 128"/></g>` +
    // the owl on the long branch: a body, ear tufts, two eyes that open and close
    `<g transform="translate(168 150)"><ellipse cx="0" cy="-17" rx="12" ry="18" fill="${NEAR}"/><g class="hw-ohead"><circle cx="0" cy="-39" r="11" fill="${NEAR}"/><path d="M-10 -45 L-8 -57 L-2 -48Z M10 -45 L8 -57 L2 -48Z" fill="${NEAR}"/><g class="hw-eyes"><circle cx="-4.6" cy="-39" r="3.2" fill="#ffd36b"/><circle cx="4.6" cy="-39" r="3.2" fill="#ffd36b"/><circle cx="-4.6" cy="-39" r="1.2" fill="${NEAR}"/><circle cx="4.6" cy="-39" r="1.2" fill="${NEAR}"/></g></g></g>` +
    pumpkin(138, 268, 56, 1, 0.5) +
    pumpkin(200, 282, 36, 3, 1.1) +
    '</svg>'
  );
}

// The gate: the moon, a wrought-iron gate between two stone pillars (a black cat on one, a turnip lantern on the other), the lantern pole, a heap of pumpkins.
// Drawn on 260 x 330, standing on the right edge.
function gate() {
  // The iron bars: a spear point on each, standing at an even spacing, rising into an arch between the pillars.
  let bars = '';
  for (let x = 62; x <= 138; x += 8) {
    const top = 240 - 20 * Math.sin((Math.PI * (x - 56)) / 90);
    bars += `M${x} 272 V${top.toFixed(1)} l-2.6 -2 l2.6 -7 l2.6 7 l-2.6 2 `;
  }
  for (let x = 158; x <= 206; x += 8) bars += `M${x} 274 V240 l-2.6 -2 l2.6 -7 l2.6 7 l-2.6 2 `;
  return (
    '<svg class="hw-cl hw-gate" viewBox="0 0 260 330" aria-hidden="true">' +
    '<circle class="hw-halo" cx="140" cy="150" r="104" fill="url(#hw-halo)"/>' +
    '<circle cx="140" cy="150" r="56" fill="url(#hw-moon)" fill-opacity=".94"/>' +
    '<g fill="#b8a97c" fill-opacity=".45"><circle cx="122" cy="132" r="9"/><circle cx="156" cy="170" r="7"/><circle cx="162" cy="128" r="4.5"/><circle cx="128" cy="172" r="4"/></g>' +
    `<path d="M0 330V268Q70 248 150 262T260 254V330Z" fill="${NEAR}"/>` +
    // the gate: iron bars and rails, then the two stone pillars with ball finials
    `<g fill="${NEAR}" stroke="${NEAR}" stroke-width="2.4" stroke-linejoin="round"><path d="${bars}"/></g>` +
    `<path d="M56 262 Q101 240 146 262 M56 248 Q101 224 146 248 M150 262 H208 M150 248 H208" stroke="${NEAR}" stroke-width="3.4" fill="none"/>` +
    `<g fill="${STONE}" stroke="${RIM}" stroke-width="1"><path d="M34 274 V222 H54 V274Z"/><path d="M136 274 V222 H156 V274Z"/><path d="M31 222 H57 V216 H31Z"/><path d="M133 222 H159 V216 H133Z"/><circle cx="44" cy="210" r="6.5"/><circle cx="146" cy="210" r="6.5"/></g>` +
    // the cat on the right pillar: sitting, facing us, against the moon; its tail swishes
    `<g transform="translate(146 204)"><path d="M-17 0 Q-21 -26 -10 -40 Q0 -50 10 -40 Q21 -26 17 0Z" fill="${NEAR}"/><circle cx="0" cy="-48" r="11" fill="${NEAR}"/><path d="M-10 -54 L-11.5 -70 L-2 -58Z M10 -54 L11.5 -70 L2 -58Z" fill="${NEAR}"/><path class="hw-tail" d="M13 -2 Q36 0 33 -22 Q32 -34 25 -34" stroke="${NEAR}" stroke-width="6" stroke-linecap="round" fill="none"/><g class="hw-eyes"><ellipse cx="-4.6" cy="-49" rx="2.3" ry="3.3" fill="#ffe08a"/><ellipse cx="4.6" cy="-49" rx="2.3" ry="3.3" fill="#ffe08a"/></g></g>` +
    // a turnip lantern on the left pillar
    `<circle class="hw-pool hw-soft" cx="44" cy="188" r="40" fill="url(#hw-pool)" style="--d:1.7s"/><use href="#hw-tn" x="33" y="170" width="22" height="26"/>` +
    // the lantern pole: a post, a hooked arm, and a lit pumpkin on a chain that swings
    `<path d="M236 272 L237 92 Q237 74 218 74" stroke="${NEAR}" stroke-width="7" stroke-linecap="round" fill="none"/>` +
    `<g class="hw-swing"><path d="M218 74 V86" stroke="${NEAR}" stroke-width="2" fill="none"/>${pumpkin(200, 84, 36, 4, 0.9)}</g>` +
    pumpkin(158, 268, 70, 2, 1.4) +
    `<use href="#hw-pkd" x="128" y="288" width="34" height="30"/>` +
    pumpkin(222, 284, 38, 1, 2) +
    '</svg>'
  );
}

// The ground between the clusters: three ranges of hills, the graveyard on the furthest (a crypt, headstones, a cross, an obelisk) with a lane of small
// lanterns among them, two drifts of mist, a ghost gliding through, and cold lights bobbing over the graves.
const GRAVE_SHAPES = {
  // each is drawn on a 40 x 60 box and stood on its bottom edge
  round: `<path d="M8 60 V26 Q8 8 20 8 Q32 8 32 26 V60Z" fill="${STONE}" stroke="${RIM}" stroke-width="1.6"/>`,
  cross: `<path d="M20 60 V6 M6 22 H34" stroke="${STONE}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M20 60 V6 M6 22 H34" stroke="${RIM}" stroke-width="1.2" stroke-linecap="round" fill="none" transform="translate(-2.6 0)"/>`,
  obelisk: `<path d="M12 60 V52 L16 8 L24 8 L28 52 V60Z" fill="${STONE}" stroke="${RIM}" stroke-width="1.6"/>`,
  slab: `<path d="M6 60 L10 24 L34 28 L32 60Z" fill="${STONE}" stroke="${RIM}" stroke-width="1.6"/>`,
  // a small crypt: a pediment, two columns, a door with a light inside
  crypt: `<path d="M2 60 V30 L20 10 L38 30 V60Z" fill="${STONE}" stroke="${RIM}" stroke-width="1.6"/><path d="M14 60 V38 Q14 33 20 33 Q26 33 26 38 V60Z" fill="#ffb04a" fill-opacity=".85"/>`,
};

function grave(kind, left, bottom, h, flip = false) {
  return `<svg class="hw-grv" style="left:${left}%;bottom:${bottom}%;height:${h}%${flip ? ';transform:scaleX(-1)' : ''}" viewBox="0 0 40 60" preserveAspectRatio="xMidYMax meet">${GRAVE_SHAPES[kind]}</svg>`;
}

function ground() {
  const lane = [7, 17, 27, 37, 47, 57, 67, 77, 87]
    .map((x, i) => `<i class="hw-ln" style="left:${x}%;bottom:${47 + ((i * 7) % 9)}%;--d:${(0.15 + i * 0.24).toFixed(2)}s"></i>`)
    .join('');
  const graves =
    grave('crypt', 46, 40, 17) + grave('round', 22, 43, 11) + grave('cross', 31, 42, 13) + grave('obelisk', 60, 41, 15) + grave('slab', 70, 42, 10) +
    grave('round', 78, 40, 12, true) + grave('cross', 13, 40, 11) + grave('slab', 54, 33, 9, true) + grave('round', 39, 33, 8);
  // cold lights over the graves, in the moon's colour: they bob and brighten at their own pace
  const orbs = [[19, 56], [34, 62], [52, 58], [66, 64], [82, 57]]
    .map(([x, y], i) => `<i class="hw-orb hol-mover" style="left:${x}%;bottom:${y}%;--d:-${(i * 1.7).toFixed(1)}s"></i>`)
    .join('');
  return (
    '<div class="hw-ground">' +
    `<svg class="hw-hill hw-hill-far" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V96Q90 62 190 88T380 74T580 94T780 70T1000 90V200Z" fill="#0f0719"/></svg>` +
    graves + lane + orbs +
    `<svg class="hw-hill hw-hill-mid" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V120Q120 96 260 118T520 108T760 122T1000 104V200Z" fill="${MID}"/></svg>` +
    '<i class="hw-mist"></i><i class="hw-mist hw-mist2"></i>' +
    '<div class="hw-ghost hol-mover"><svg viewBox="0 0 40 52"><path d="M20 2 C9 2 4 11 4 22 V50 L10 44 L15 50 L20 44 L25 50 L30 44 L36 50 V22 C36 11 31 2 20 2Z" fill="currentColor"/><ellipse cx="14" cy="21" rx="3.4" ry="4.6" fill="#0c0614"/><ellipse cx="26" cy="21" rx="3.4" ry="4.6" fill="#0c0614"/><ellipse cx="20" cy="32" rx="3" ry="4" fill="#0c0614"/></svg></div>' +
    `<svg class="hw-hill hw-hill-near" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V150Q140 132 300 148T620 140T1000 150V200Z" fill="${NEAR}"/></svg>` +
    '</div>'
  );
}

// The whole horizon: ground, then the two clusters, then a wisp of cloud crossing the moon.
function band() {
  return ground() + oak() + gate() + '<i class="hw-wisp hol-mover"></i><i class="hw-wisp hw-wisp2 hol-mover"></i>';
}

function sky() {
  const r = rng(11);
  let stars = '';
  for (let i = 0; i < 34; i++) {
    stars += `<i class="${i % 7 === 0 ? 'hw-star hw-star-big' : 'hw-star'}" style="left:${(r() * 98).toFixed(1)}%;top:${(r() * 62).toFixed(1)}%;--d:-${(r() * 4).toFixed(2)}s"></i>`;
  }
  // A loose stream of bats crossing, each at its own height and speed; the flap is the inner element, so the drift and the wingbeat are separate.
  const bats = [
    [16, 0, 26, 30],
    [27, -7, 22, 24],
    [11, -14, 30, 36],
    [34, -19, 24, 20],
    [22, -9, 28, 28],
    [43, -4, 32, 22],
    [8, -22, 25, 18],
  ]
    .map(([top, delay, dur, w]) => `<div class="hw-bat hol-mover" style="top:${top}%;--dur:${dur}s;--d:${delay}s;--w:${w}px"><svg viewBox="0 0 60 30" style="--f:${(0.38 + (w % 5) * 0.05).toFixed(2)}s"><use href="#hw-bat"/></svg></div>`)
    .join('');
  return `<div class="hw-sky"><i class="hw-haze"></i>${stars}${bats}</div>`;
}

// The gutters: the 16px strips beside the page. Nothing the app draws ever enters them, so a lantern-wisp may rise through them however pale.
function gutters() {
  const wisp = (side, top, d) => `<i class="hw-gwisp hol-mover" style="${side}:5px;top:${top}%;--d:${d}s"></i>`;
  return (
    '<div class="hol-gut l">' + [88, 71, 54, 37, 20].map((t, i) => wisp('left', t, -(i * 3.1))).join('') + '</div>' +
    '<div class="hol-gut r">' + [82, 66, 49, 33, 16].map((t, i) => wisp('right', t, -(i * 2.7 + 1))).join('') + '</div>'
  );
}

// What sits on each plate's edge: a cobweb (thin line art behind the text), a spider lowering on its thread, a bat hanging from the top edge,
// and a small lit lantern on the bottom edge. All positioned absolutely, so none of it takes a place in the plate's layout.
function dressing() {
  return (
    '<span class="hol-pd hol-line pd-web"><svg viewBox="0 0 200 200"><use href="#hw-web"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-bat hol-mover"><svg viewBox="0 0 60 30"><use href="#hw-bat"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-spider hol-mover"><i class="hol-thread"></i><svg viewBox="0 0 60 60"><use href="#hw-spider"/></svg></span>' +
    '<span class="hol-pd hol-prop pd-pk"><i class="hw-ppool"></i><svg viewBox="0 0 100 88"><use href="#hw-pkb"/><use class="hw-face" href="#hw-f1"/></svg></span>'
  );
}

const backdrop = `<div class="hol-scene hw">${sky()}<div class="hw-band hw-wings hol-margin">${band()}</div>${gutters()}</div>`;
const foot = `<div class="hol-foot hw-foot"><div class="hw-band">${band()}</div></div>`;

export default { defs: DEFS, backdrop, dressing: dressing(), foot };
