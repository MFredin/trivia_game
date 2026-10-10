// New Year's: midnight over the rooftops
//
// One composition, cropped two ways. The idea is the light: it is a few minutes before midnight in a city on a river, and the only light that
// matters is the fireworks, each burst throwing its colour on the rooftops and the water. Two clusters stand either side of the page:
//   the tower      a clock tower whose clock stands a minute before twelve (its second hand sweeps), and a terrace on the roofs below it with a
//                  champagne bottle on the parapet and a string of lights
//   the rooftops   a block of flats with its windows lit, an aerial with a crystal ball sliding slowly down its pole (the countdown), a terrace
//                  with a string of lights
// Between them on the river: the far skyline, a long reflection of every burst in the water. Over the roofs, rockets climb and burst in gold, rose,
// cyan and white, and their sparks droop and go out. On a wide screen the bursts are in the margins either side of the page, bigger; on a phone they
// are in the scene at the end of the page, where no text can be. Confetti comes down the gutters.
// On every plate: a rosette of firework in a corner, two champagne flutes that touch, a hanging streamer, and rays of light behind the text.
//
// This module is plain data: four HTML strings, built once when it loads. `defs` holds the SVG symbols and gradients; `backdrop` is the
// fixed layer; `dressing` is what sits on each plate's edges; `foot` is the scene at the end of the page. They are strings rather than JSX
// because they are static decoration with no state or events, which React would otherwise reconcile on every render of every plate for nothing.
// Nothing in them ever comes from a user, so there is no escaping to get wrong. Stylesheet: styles/parts/holiday-newyear.css.
import { rng } from './shared.js';

const NEAR = '#0a0b1e';
const MID = '#14153a';
const FAR = '#232256';
const RIM = 'rgba(255,224,150,.7)';
// The colours of a burst: gold, rose, cyan, warm white, violet, green.
const SPARK = ['#ffd36b', '#ff6f9c', '#6fe0ff', '#fff4d0', '#b48cff', '#7dffb0'];

const DEFS =
  '<svg class="hol-defs" width="0" height="0" focusable="false"><defs>' +
  '<radialGradient id="ny-halo"><stop offset="0" stop-color="#fff0c0" stop-opacity=".6"/><stop offset=".45" stop-color="#ffd98a" stop-opacity=".2"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="ny-ballg" cx=".38" cy=".34" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#bfe6ff"/><stop offset="1" stop-color="#6aa8e8"/></radialGradient>' +
  // a four-pointed sparkle on a 100 x 100 box
  '<symbol id="ny-sparkle" viewBox="0 0 100 100"><path fill="currentColor" d="M50 0 Q54 46 100 50 Q54 54 50 100 Q46 54 0 50 Q46 46 50 0Z"/></symbol>' +
  // the champagne cork, flying left with a trail of fizz behind it, on an 80 x 40 box: the thing to catch
  '<symbol id="ny-cork" viewBox="0 0 80 40"><g transform="rotate(-14 24 20)"><rect x="8" y="11" width="30" height="18" rx="5" fill="#d9b27a"/><path d="M14 11 V29 M22 11 V29 M30 11 V29" stroke="#a8814a" stroke-width="1.4"/><rect x="2" y="8" width="9" height="24" rx="3" fill="#e8d28a"/><path d="M2 14 H11 M2 20 H11 M2 26 H11" stroke="#a08630" stroke-width="1.2"/></g>' +
  '<g fill="#fff4d0"><circle cx="46" cy="14" r="3.4"/><circle cx="55" cy="24" r="2.8"/><circle cx="62" cy="13" r="2.4"/><circle cx="68" cy="22" r="2"/><circle cx="74" cy="15" r="1.6"/><circle cx="52" cy="30" r="1.8" opacity=".7"/></g>' +
  '<g fill="#ffd36b"><path d="M60 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5Z"/></g></symbol>' +
  // the champagne bottle about to pop, upright, on a 30 x 70 box: it is on the terrace's parapet when nothing is flying
  '<symbol id="ny-bottle" viewBox="0 0 30 70"><path d="M12 8 H18 V26 Q26 34 26 46 V66 Q26 70 22 70 H8 Q4 70 4 66 V46 Q4 34 12 26Z" fill="#14402c"/><path d="M12 8 H18 V30 H12Z" fill="#e8d28a"/><path d="M12 14 H18 M12 20 H18" stroke="#a08630" stroke-width="1.2"/><rect x="5" y="44" width="20" height="14" rx="1.5" fill="#f1ebdc"/><circle cx="15" cy="51" r="3.6" fill="none" stroke="#a08630" stroke-width="1.2"/><path d="M8 38 Q7 52 9 66" stroke="rgba(255,255,255,.28)" stroke-width="2" fill="none"/><rect x="12.4" y="1" width="5.2" height="8" rx="1.6" fill="#d9b27a"/><g fill="#fff4d0"><circle cx="9" cy="2" r="1.2"/><circle cx="22" cy="0.5" r="1"/><circle cx="19" cy="-3" r="0.9"/></g></symbol>' +
  // the seal that stands where the house device does: a firework, on a 100 x 88 box
  '<symbol id="ny-seal" viewBox="0 0 100 88"><g transform="translate(50 44)" stroke-linecap="round">' +
  Array.from({ length: 12 }, (_, i) => `<path d="M0 -14 V-${i % 2 ? 26 : 36}" stroke="${SPARK[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2]}" stroke-width="4.4" transform="rotate(${i * 30})"/>`).join('') +
  Array.from({ length: 12 }, (_, i) => `<circle cx="0" cy="-${i % 2 ? 36 : 43}" r="2.6" fill="${SPARK[(i + 3) % 6]}" transform="rotate(${i * 30 + 15})"/>`).join('') +
  '<circle r="9" fill="#fff4d0"/><circle r="4.4" fill="#ffd36b"/></g></symbol>' +
  '</defs></svg>';

// A grid of windows on a building: most dark, some lit, a few of the lit ones breathing. `r` is a seeded generator so a building is always the same.
function windows(r, x, y, cols, rows, w, h, gx, gy, lit) {
  let out = '';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (r() > lit) continue;
      const breathe = r() < 0.28;
      out += `<rect${breathe ? ' class="ny-win" style="--d:-' + (r() * 6).toFixed(1) + 's"' : ''} x="${x + i * (w + gx)}" y="${y + j * (h + gy)}" width="${w}" height="${h}" fill="${r() < 0.2 ? '#ffe9b0' : '#ffc860'}" opacity="${breathe ? 1 : (0.55 + r() * 0.4).toFixed(2)}"/>`;
    }
  }
  return out;
}

// The tower: a clock tower with a clock at a minute before twelve and a lit belfry, and the terrace on the roofs beside it. Drawn on 260 x 330, on the
// left edge.
function towerCluster() {
  const r = rng(61);
  let ticks = '';
  for (let i = 0; i < 12; i++) ticks += `<path d="M178 ${134 - 17} V${134 - (i % 3 ? 15 : 13)}" stroke="#6a5420" stroke-width="${i % 3 ? 1 : 1.8}" transform="rotate(${i * 30} 178 134)"/>`;
  let posts = '';
  for (let x = 34; x <= 136; x += 12) posts += `M${x} 232 V220 `;
  const lights = [34, 46, 58, 70, 82, 94, 106, 118, 130]
    .map((x, i) => `<circle class="ny-bulb" cx="${x}" cy="${216 + Math.round(3 * Math.sin(i))}" r="2.4" fill="#ffe08a" style="--d:-${(i * 0.37).toFixed(2)}s"/>`)
    .join('');
  return (
    '<svg class="hol-cl hol-cl-l ny-tower" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V280H260V330Z" fill="${NEAR}"/><path d="M0 280H260" stroke="${RIM}" stroke-width="1.2" opacity=".6"/>` +
    // the clock's glow first, then the tower
    '<circle class="ny-halo" cx="178" cy="134" r="50" fill="url(#ny-halo)"/>' +
    `<g fill="${NEAR}"><rect x="152" y="100" width="52" height="180"/><rect x="146" y="94" width="64" height="8"/><rect x="150" y="66" width="56" height="30"/><path d="M146 66 L178 10 L210 66Z"/><rect x="176.6" y="-2" width="2.8" height="14"/></g>` +
    `<path d="M204 100 V280 M210 66 L178 10" stroke="${RIM}" stroke-width="1.2" fill="none"/>` +
    '<g fill="#ffd98a"><path d="M156 90 V80 Q156 74 162 74 Q168 74 168 80 V90Z"/><path d="M172 90 V80 Q172 74 178 74 Q184 74 184 80 V90Z"/><path d="M188 90 V80 Q188 74 194 74 Q200 74 200 80 V90Z"/></g>' +
    '<use class="ny-star" href="#ny-sparkle" x="170" y="-12" width="16" height="16" style="color:#fff0c0"/>' +
    // the clock: a face, twelve ticks, an hour hand and a minute hand a hair before twelve, and a second hand that goes round
    '<circle cx="178" cy="134" r="22" fill="#fff0c0"/><circle cx="178" cy="134" r="22" fill="none" stroke="#a08630" stroke-width="2.4"/>' +
    ticks +
    '<path d="M178 134 L177 120" stroke="#2a1d0a" stroke-width="3" stroke-linecap="round"/><path d="M178 134 L178.4 116" stroke="#2a1d0a" stroke-width="2" stroke-linecap="round"/>' +
    '<g class="ny-sweep"><path d="M178 134 V117" stroke="#c2185b" stroke-width="1.4" stroke-linecap="round"/></g><circle cx="178" cy="134" r="2.6" fill="#2a1d0a"/>' +
    '<g fill="#ffc860"><rect x="166" y="172" width="10" height="14"/><rect x="182" y="172" width="10" height="14"/><rect x="166" y="204" width="10" height="14"/><rect x="182" y="204" width="10" height="14"/><rect x="166" y="236" width="10" height="14"/></g>' +
    // the roofs: a block with a few windows, and the terrace
    `<g fill="${NEAR}"><rect x="0" y="196" width="32" height="86"/><rect x="30" y="232" width="112" height="50"/><rect x="132" y="250" width="22" height="32"/><rect x="8" y="188" width="6" height="10"/></g>` +
    `<path d="M0 196 H32 M30 232 H142" stroke="${RIM}" stroke-width="1.1" fill="none"/>` +
    windows(r, 5, 206, 2, 4, 8, 10, 4, 8, 0.7) + windows(r, 40, 244, 7, 2, 8, 10, 6, 6, 0.6) +
    // the terrace: a railing, a string of lights, and the table the bottle stands on
    `<path d="${posts}" stroke="${NEAR}" stroke-width="2" fill="none"/><path d="M34 220 H136" stroke="${NEAR}" stroke-width="2.4"/>` +
    `<path d="M34 216 Q86 226 136 216" stroke="${NEAR}" stroke-width="1.2" fill="none"/>` + lights +
    '</svg>'
  );
}

// The rooftops: a tall block with its windows lit and an aerial with the crystal ball on its pole, and lower blocks with a terrace of lights.
// Drawn on 260 x 330, on the right edge.
function roofCluster() {
  const r = rng(73);
  const terraceLights = [102, 111, 120, 129, 138, 147]
    .map((x, i) => `<circle class="ny-bulb" cx="${x}" cy="${142 + Math.round(2 * Math.sin(i * 1.4))}" r="2.2" fill="#ffe08a" style="--d:-${(i * 0.5).toFixed(2)}s"/>`)
    .join('');
  return (
    '<svg class="hol-cl hol-cl-r ny-roofs" viewBox="0 0 260 330" aria-hidden="true">' +
    `<path d="M0 330V280H260V330Z" fill="${NEAR}"/><path d="M0 280H260" stroke="${RIM}" stroke-width="1.2" opacity=".6"/>` +
    `<g fill="${NEAR}"><rect x="150" y="62" width="76" height="220"/><rect x="96" y="148" width="60" height="134"/><rect x="44" y="196" width="58" height="86"/><rect x="226" y="176" width="34" height="106"/><rect x="104" y="124" width="16" height="16"/><path d="M104 140 V148 M120 140 V148" stroke="${NEAR}" stroke-width="3"/><rect x="186" y="22" width="2.6" height="42"/></g>` +
    `<path d="M150 62 H226 M96 148 H156 M44 196 H102 M226 176 H260" stroke="${RIM}" stroke-width="1.1" fill="none"/>` +
    windows(r, 156, 72, 7, 14, 6, 8, 4, 7, 0.62) + windows(r, 102, 158, 5, 8, 6, 8, 4, 7, 0.6) + windows(r, 50, 206, 5, 6, 7, 9, 4, 6, 0.6) + windows(r, 232, 186, 3, 8, 5, 8, 3, 6, 0.55) +
    // the terrace's string of lights, and the aerial's red lamp
    `<path d="M98 142 Q124 152 152 142" stroke="${NEAR}" stroke-width="1.2" fill="none"/>` + terraceLights +
    '<circle class="ny-lamp" cx="187.3" cy="20" r="3" fill="#ff4a5a"/>' +
    // the countdown: a crystal ball that slides slowly down the aerial's pole, and then the glitter of it
    '<g class="ny-ball"><circle cx="187.3" cy="30" r="14" fill="url(#ny-halo)"/><circle cx="187.3" cy="30" r="6.4" fill="url(#ny-ballg)"/><path d="M181 30 H193.6 M187.3 23.6 V36.4 M183 25.6 L191.6 34.4 M191.6 25.6 L183 34.4" stroke="rgba(120,160,220,.55)" stroke-width=".7"/></g>' +
    '</svg>'
  );
}

// A firework: a rocket that climbs, then a burst of an outer ring and an inner one whose sparks droop and go out. `box` is where it is put and `k`
// how big it is; all of the timing is on the stylesheet's side, with `d` (the delay) and `dur` (the length of its cycle) varying it.
function firework(box, colors, k, d, dur) {
  const outer = 18;
  const inner = 10;
  let parts = '';
  for (let i = 0; i < outer; i++) parts += `<i class="ny-p" style="--a:${Math.round((i * 360) / outer)}deg;--c:${colors[i % 2]}"></i>`;
  for (let i = 0; i < inner; i++) parts += `<i class="ny-p ny-p2" style="--a:${Math.round((i * 360) / inner + 18)}deg;--c:${colors[2 % colors.length]}"></i>`;
  return `<div class="ny-fw hol-mover" style="${box};--k:${k};--d:-${d}s;--dur:${dur}s"><i class="ny-rocket"></i><div class="ny-burst">${parts}</div></div>`;
}

// The far skyline is a strip drawn once and tiled along the river, so its windows stay small however wide the screen is.
const SKYLINE = (function () {
  const r = rng(83);
  let body = '';
  let x = 0;
  while (x < 240) {
    const w = 14 + Math.round(r() * 16);
    const h = 22 + Math.round(r() * 44);
    body += `<rect x="${x}" y="${80 - h}" width="${w}" height="${h}" fill="${FAR}"/>`;
    for (let wy = 80 - h + 5; wy < 76; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (r() < 0.32) body += `<rect x="${wx}" y="${wy}" width="2.4" height="3.2" fill="#ffd98a" opacity=".7"/>`;
    x += w;
  }
  return 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">${body}</svg>`) + '")';
})();

// The river and the far bank, with a reflection of each burst under it. In the foot (a phone's) there are bursts over the river, put by percentages of
// the band; in the wings (a wide screen's) the bursts are in the margins instead, so there are none here.
function ground(foot) {
  const bursts = foot
    ? firework('left:30%;top:20%', [SPARK[0], SPARK[1], SPARK[3]], 0.82, 0, 8) +
      firework('left:50%;top:6%', [SPARK[2], SPARK[3], SPARK[0]], 1, 3.1, 9.5) +
      firework('left:66%;top:26%', [SPARK[1], SPARK[4], SPARK[3]], 0.7, 5.6, 7) +
      firework('left:42%;top:34%', [SPARK[5], SPARK[0], SPARK[3]], 0.55, 1.9, 6.4)
    : '';
  const refl = [[30, SPARK[0]], [50, SPARK[2]], [66, SPARK[1]], [42, SPARK[5]]]
    .map(([x, c], i) => `<i class="ny-refl" style="left:${x}%;--c:${c};--d:-${(i * 1.7).toFixed(1)}s"></i>`)
    .join('');
  return (
    '<div class="hol-ground ny-ground">' +
    bursts +
    `<i class="ny-skyline" style="background-image:${SKYLINE}"></i>` +
    `<div class="ny-water"><i class="ny-bank"></i>${refl}</div>` +
    '</div>'
  );
}

function band(foot) {
  return ground(foot) + towerCluster() + roofCluster();
}

// The fireworks in the margins of a wide screen: each margin is a box as wide as the margin, and a burst is put by percentages of it and sized by it.
function marginBursts() {
  const left =
    firework('left:50%;top:14%', [SPARK[0], SPARK[1], SPARK[3]], 1, 0, 9) +
    firework('left:40%;top:34%', [SPARK[2], SPARK[4], SPARK[3]], 0.8, 4.1, 7.5) +
    firework('left:60%;top:52%', [SPARK[5], SPARK[0], SPARK[3]], 0.65, 6.3, 6.5);
  const right =
    firework('left:46%;top:20%', [SPARK[4], SPARK[2], SPARK[3]], 0.9, 2.2, 8.5) +
    firework('left:56%;top:40%', [SPARK[1], SPARK[0], SPARK[3]], 1, 5.4, 10) +
    firework('left:42%;top:58%', [SPARK[3], SPARK[5], SPARK[0]], 0.6, 1.1, 6);
  return `<div class="ny-mbox ny-mbox-l">${left}</div><div class="ny-mbox ny-mbox-r">${right}</div>`;
}

function sky() {
  const r = rng(11);
  let stars = '';
  for (let i = 0; i < 32; i++) stars += `<i class="ny-star-dot" style="left:${(r() * 98).toFixed(1)}%;top:${(r() * 60).toFixed(1)}%;--d:-${(r() * 4).toFixed(2)}s"></i>`;
  return `<div class="ny-sky"><i class="ny-haze"></i>${stars}</div>`;
}

// The gutters: the 16px strips beside the page. Nothing the app draws ever enters them, so confetti may come down them however bright.
function gutters() {
  const r = rng(29);
  const side = (cls, sideCss) => {
    let s = '';
    for (let i = 0; i < 7; i++) s += `<i class="ny-gconf hol-mover" style="${sideCss}:${1 + (i % 3) * 4}px;--c:${SPARK[Math.floor(r() * 6)]};--t:${(8 + r() * 8).toFixed(1)}s;--d:-${(r() * 14).toFixed(1)}s"></i>`;
    return `<div class="hol-gut ${cls}">${s}</div>`;
  };
  return side('l', 'left') + side('r', 'right');
}

// A champagne flute: a bowl, a stem, a foot, on a 20 x 50 box, drawn upright with the wine in it.
const FLUTE = '<path d="M3 2 H17 L15.4 26 Q10 32 4.6 26Z" fill="rgba(255,255,255,.22)" stroke="#f1ebdc" stroke-width="1.3"/><path d="M4.2 12 H15.8 L15 26 Q10 31 5 26Z" fill="#f1d27a"/><path d="M10 31 V45" stroke="#f1ebdc" stroke-width="1.6"/><path d="M4 48 Q10 44 16 48 Z" fill="#f1ebdc"/><g fill="#fff"><circle cx="8" cy="22" r="1"/><circle cx="12" cy="18" r="0.9"/><circle cx="10" cy="26" r="0.8"/></g>';

// What sits on each plate's edge: rays behind the text, a rosette of firework, two flutes that touch, and a hanging streamer. All positioned
// absolutely, so none of it takes a place in the plate's layout.
function dressing() {
  let rays = '';
  for (let i = 0; i < 9; i++) rays += `<path d="M0 0 L${(Math.cos((i * 10 + 5) * (Math.PI / 180)) * 110).toFixed(1)} ${(Math.sin((i * 10 + 5) * (Math.PI / 180)) * 110).toFixed(1)}" stroke="currentColor" stroke-width="${i % 2 ? 1 : 1.8}" stroke-linecap="round"/>`;
  let rosette = '';
  for (let i = 0; i < 14; i++) {
    const a = (i * 360) / 14;
    rosette += `<path d="M0 -8 V-${i % 2 ? 14 : 20}" stroke="${SPARK[i % 3]}" stroke-width="2.4" stroke-linecap="round" transform="rotate(${a})"/><circle cx="0" cy="-${i % 2 ? 22 : 26}" r="1.5" fill="${SPARK[(i + 2) % 6]}" transform="rotate(${a})"/>`;
  }
  return (
    `<span class="hol-pd hol-line pd-rays"><svg viewBox="0 0 120 120">${rays}</svg></span>` +
    `<span class="hol-pd hol-prop pd-rosette"><svg viewBox="-30 -30 60 60"><g class="ny-rosette">${rosette}<circle r="3.6" fill="#fff4d0"/></g></svg></span>` +
    `<span class="hol-pd hol-prop pd-flutes"><svg viewBox="0 0 64 56"><g transform="translate(6 6) rotate(14 10 48)"><g class="ny-fl ny-fl-l">${FLUTE}</g></g><g transform="translate(36 6) rotate(-14 10 48)"><g class="ny-fl ny-fl-r">${FLUTE}</g></g><use class="ny-clinkspark" href="#ny-sparkle" x="24" y="-2" width="14" height="14" style="color:#fff4d0"/></svg></span>` +
    '<span class="hol-pd hol-prop pd-streamer"><svg viewBox="0 0 52 44"><path d="M8 0 C0 6 16 10 8 16 C0 22 16 26 8 32 C2 36 10 40 12 44" fill="none" stroke="#ffd36b" stroke-width="3.4" stroke-linecap="round"/><path d="M26 0 C18 6 34 10 26 16 C18 22 34 26 26 32 C20 36 28 40 30 42" fill="none" stroke="#ff6f9c" stroke-width="3" stroke-linecap="round"/><path d="M44 0 C36 6 52 10 44 16 C38 22 48 26 44 30" fill="none" stroke="#6fe0ff" stroke-width="3" stroke-linecap="round"/></svg></span>'
  );
}

const backdrop = `<div class="hol-scene ny">${sky()}<div class="ny-margins hol-margin">${marginBursts()}</div><div class="hol-band ny-band hol-wings hol-margin">${band(false)}</div>${gutters()}</div>`;
const foot = `<div class="hol-foot hol-footband"><div class="hol-band ny-band">${band(true)}</div></div>`;

export default { defs: DEFS, backdrop, dressing: dressing(), foot };
