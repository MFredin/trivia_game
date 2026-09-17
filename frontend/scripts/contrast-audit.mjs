#!/usr/bin/env node
/**
 * WCAG contrast audit for every colour pairing the app actually renders, in all five
 * bindings. Run with `npm run audit:contrast` (from frontend/).
 *
 * Why this exists: the design system binds one set of role tokens per house
 * (see src/styles/tokens.css), so a colour that reads perfectly in one binding can
 * silently fail in another — Hufflepuff's gold is a fill in one place and text in
 * another. Eyeballing screenshots missed several of these; computed ratios caught them.
 *
 * Thresholds: 4.5:1 for normal text, 3:1 for large text (>=24px, or >=18.66px bold) and
 * for graphics that carry meaning. Pure ornament (gilt hairlines, corner brackets) is
 * listed but not gated — nothing is lost if a decorative rule is subtle, and forcing it
 * to 3:1 would destroy the one thing it is there to do.
 *
 * Exits non-zero if any gated pairing fails, so it can guard a build.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// ---------- colour maths ----------
const hexrgb = (h) => {
  let s = h.trim().replace('#', '');
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (fg, bg) => {
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg, bg, a) => fg.map((f, i) => Math.round(a * f + (1 - a) * bg[i]));

// ---------- parse tokens.css ----------
const css = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');
const blocks = {};
for (const m of css.matchAll(/:root(?:\[data-house='([a-z]+)'\])?\s*\{([\s\S]*?)\n\}/g)) {
  const house = m[1] ?? 'gryffindor';
  blocks[house] = Object.fromEntries(
    [...m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]),
  );
}
const HOUSES = ['gryffindor', 'hufflepuff', 'slytherin', 'ravenclaw', 'monochrome'];

function tok(house, name) {
  const v = (blocks[house] ?? {})[name] ?? blocks.gryffindor[name];
  if (v === undefined) throw new Error(`token ${name} missing for ${house}`);
  const varRef = v.match(/^var\((--[\w-]+)\)$/);
  if (varRef) return tok(house, varRef[1]);
  if (v.startsWith('#')) return hexrgb(v);
  if (/^[\d\s,]+$/.test(v)) return v.split(',').map((n) => Number(n.trim()));
  throw new Error(`cannot parse ${name}=${v}`);
}

// ---------- parse houses.js ----------
const hj = readFileSync(join(SRC, 'constants', 'houses.js'), 'utf8');
const HOUSE_DATA = {};
for (const m of hj.matchAll(/\{\s*id:\s*'([a-z]+)'[^}]*\}/g)) {
  HOUSE_DATA[m[1]] = Object.fromEntries(
    [...m[0].matchAll(/(\w+):\s*'([^']+)'/g)].map((d) => [d[1], d[2]]),
  );
}

// ---------- the pairings the app renders ----------
function build(house) {
  const t = (n) => tok(house, n);
  const parch = t('--parchment-100');
  const page = t('--page');
  const cloth = t('--cloth');
  const rubric = t('--rubric');
  const onbg = t('--onbg');
  const tooling = t('--tooling');
  const leaf = t('--leaf');
  const leafText = t('--leaf-text');
  const gilt = t('--gilt');
  const ink = t('--text-ink');
  const successInk = t('--success-ink');
  const oxblood = t('--oxblood-600');
  const mutedOnSurface = over(hexrgb('#241b10'), parch, 0.68);
  const correctBg = over(hexrgb('#4e8c7c'), parch, 0.16);
  const wrongBg = over(hexrgb('#5c1a2b'), parch, 0.09);
  const P = [];
  const add = (label, fg, bg, need, note) => P.push({ label, fg, bg, need, note });

  // text and marks on parchment
  add('body text on parchment', ink, parch, 4.5, '.plate / .choice-text');
  add('muted text on parchment', mutedOnSurface, parch, 4.5, '.explanation / field labels');
  add('rubric eyebrow on parchment', rubric, parch, 4.5, '.plate .screen-eyebrow');
  add('choice letter on parchment', rubric, parch, 4.5, '.choice-chip');
  add('question numeral on parchment', rubric, parch, 3.0, '.qcard-margin-numeral, 41.6px');
  add('summary numeral on parchment', rubric, parch, 3.0, '.summary-numeral, 67px');
  add('exlibris house name on parchment', rubric, parch, 4.5, '.exlibris-house');
  add('dial time on parchment', ink, parch, 3.0, 'TimerDial centre text');
  add('dial arc on parchment', rubric, parch, 3.0, 'TimerDial arc — carries the reading');
  add('ledger rank numeral on parchment', mutedOnSurface, parch, 4.5, '.leaderboard-table .rank');

  // text on the dark page
  add('page body text on page', t('--text-on-bg'), page, 4.5, 'body copy on the page');
  add('on-page eyebrow on page', onbg, page, 4.5, '.screen-eyebrow');
  add('screen title on page', hexrgb('#f2e4c4'), page, 3.0, '.screen-title, 32px');
  add('nav link on page', t('--silver-400'), page, 4.5, '.running-nav button');
  add('nav active link on page', t('--silver-200'), page, 4.5, '.running-nav button.on');
  add('wordmark on page', t('--silver-200'), page, 3.0, '.running-title');

  // on cloth (spines, the Ex Libris board, the question spread's spine strip)
  add('spine label on cloth', tooling, cloth, 4.5, '.mode-spine label');
  add('tooling rules on cloth', over(tooling, cloth, 0.85), cloth, 3.0, 'spine rules / board frame');
  add('corner bud on cloth', tooling, cloth, 3.0, 'exlibris .plate-corner::after');
  add('exlibris footer on cloth', tooling, cloth, 4.5, '.exlibris-footer');

  // on the rubric fill
  add('active spine label on rubric', parch, rubric, 4.5, '.mode-spine.is-active');
  add('active segment label on rubric', parch, rubric, 4.5, '.seg.is-active');

  // gold leaf
  for (const stop of ['--leaf-hi', '--leaf', '--leaf-lo']) {
    add(`button label on ${stop.slice(2)}`, leafText, t(stop), 4.5, '.primary-button gradient');
  }
  add('seal ring text on leaf', leafText, leaf, 4.5, 'SealDevice ring text');

  // semantic states
  add('folio check on parchment', successInk, parch, 3.0, 'summary folio pip (meaningful)');
  add('folio cross on parchment', oxblood, parch, 3.0, 'summary folio pip (meaningful)');
  add('correct choice text on tint', ink, correctBg, 4.5, '.is-correct .choice-text');
  add('correct choice letter on tint', successInk, correctBg, 4.5, '.is-correct .choice-chip');
  add('wrong choice text on tint', ink, wrongBg, 4.5, '.is-wrong .choice-text');
  add('wrong choice letter on tint', oxblood, wrongBg, 4.5, '.is-wrong .choice-chip');
  add('muted choice text on tint', mutedOnSurface, over(hexrgb('#ffffff'), parch, 0.12), 4.5, '.is-muted');
  add('strike dot on parchment', oxblood, parch, 3.0, '.strike-dot (meaningful)');
  add('reveal correct heading', t('--verdigris-400'), t('--ink-800'), 4.5, '.result-reveal h2');
  add('reveal incorrect heading', onbg, t('--ink-800'), 4.5, '.result-reveal.is-wrong h2');
  add('reveal points on panel', onbg, t('--ink-800'), 3.0, '.result-reveal .points');
  add('reveal explanation on panel', t('--ash-300'), t('--ink-900'), 4.5, '.result-reveal .explanation');
  add('catalog tab label', over(hexrgb('#12151c'), t('--parchment-200'), 0.68), t('--parchment-200'), 4.5, '.catalog-tab');

  // fixed per-house colours, shown whatever the viewer's own binding is, so both
  // parchment variants are in play
  const hd = HOUSE_DATA[house];
  for (const [pname, p] of [['parchment', hexrgb('#e6d5ae')], ['mono parchment', hexrgb('#e7e3d8')]]) {
    add(`house.ink on ${pname}`, hexrgb(hd.ink), p, 4.5, 'HouseCupBoard / ProfileScreen');
  }
  add('chip device on cover', hexrgb(hd.accent), hexrgb(hd.cover), 3.0, '.house-swatch-device');

  // ornament — listed, never gated
  add('[orn] dial bezel on parchment', gilt, parch, null, 'decorative');
  add('[orn] plate corner on parchment', gilt, parch, null, 'decorative');
  add('[orn] gilt rule on parchment', t('--gilt-deep'), parch, null, 'decorative');
  add('[orn] rubric rule on parchment', rubric, parch, null, 'decorative');
  return P;
}

const fails = [];
const orn = [];
let passes = 0;
for (const house of HOUSES) {
  for (const { label, fg, bg, need, note } of build(house)) {
    const r = ratio(fg, bg);
    if (need === null) orn.push({ house, label, r });
    else if (r + 1e-9 < need) fails.push({ house, label, r, need, note });
    else passes += 1;
  }
}

console.log(`${passes} gated pairings pass, ${fails.length} fail\n`);
for (const f of fails.sort((a, b) => a.r - b.r)) {
  console.log(`  FAIL ${f.house}/${f.label} — ${f.r.toFixed(2)}:1 (needs ${f.need}:1)   ${f.note}`);
}
const ornLabels = [...new Set(orn.map((o) => o.label))];
console.log(`\nOrnament, tracked but not gated (${orn.length} pairings):`);
for (const label of ornLabels) {
  const rs = orn.filter((o) => o.label === label).map((o) => o.r);
  console.log(`  ${label.padEnd(34)} ${Math.min(...rs).toFixed(2)}–${Math.max(...rs).toFixed(2)}:1`);
}
process.exit(fails.length ? 1 : 0);
