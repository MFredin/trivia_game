#!/usr/bin/env node
/**
 * Renders frontend/public/og-image.png — the link-preview card for Open Graph / Twitter
 * Card consumers (Slack, Discord, iMessage, Twitter/X, Facebook).
 *
 * Why a screenshot instead of a hand-authored PNG: CLAUDE.md's design constraint says the
 * app's ornament is drawn with CSS and inline SVG primitives and stays that way — no image
 * files, no licensed art. Most OG/Twitter crawlers don't rasterise SVG for `og:image`
 * though, so this script builds a tiny static HTML page out of the SAME primitives the app
 * already uses (the exact hex values from src/styles/tokens.css, the same corner-bracket
 * geometry as .plate-corner in src/styles/parts/surfaces.css, and the same BrandMark SVG
 * markup as src/components/BrandMark.jsx) and screenshots *that* at the standard 1200x630 OG
 * size with Playwright. The output is still "drawn by this app's own CSS/SVG" — just
 * captured as a raster file instead of hand-authored or sourced externally.
 *
 * The card is deliberately house-neutral: fixed ink (--page) and gilt (--gilt), the same
 * two colours the inline favicon in index.html uses and for the same reason given there — a
 * link preview is generated before any account or house is known, so nothing here should
 * look like it belongs to one house over another.
 *
 * Run with `node scripts/generate-og-image.mjs` (from frontend/), or via `npm run og:image`.
 * Chromium is the one Playwright already depends on (see devDependencies) — in this sandbox
 * it's preinstalled at /opt/pw-browsers/chromium (same lookup frontend/e2e/harness.mjs uses),
 * so this never calls `playwright install`.
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public');
const OUT_FILE = join(OUT_DIR, 'og-image.png');
const TMP_HTML = join(ROOT, 'node_modules', '.og-card.html');

const WIDTH = 1200;
const HEIGHT = 630;

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const EXECUTABLE_PATH = (() => {
  if (process.env.PLAYWRIGHT_CHROMIUM !== undefined) return process.env.PLAYWRIGHT_CHROMIUM || undefined;
  return existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;
})();

// Same noise filter as --paper-grain in tokens.css, just inlined here rather than imported
// (this HTML is never shipped — it exists only for the duration of the screenshot).
const PAPER_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.2  0 0 0 0 0.14  0 0 0 0 0.08  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// The same four-corner bracket-plus-bud shape as BrandMark.jsx's <Bracket>, parameterised
// the same way, just reused here at the card's own outer corners (an oversized .plate-corner)
// instead of inside the small mark.
function bracket(x, y, flipX, flipY, leg, strokeWidth) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  const bud = leg * 0.375;
  return `
    <path d="M${x} ${y + leg * sy} V${y} H${x + leg * sx}" fill="none" stroke="var(--gilt)" stroke-width="${strokeWidth}" stroke-linecap="square"/>
    <path d="M${x + bud * 0.5 * sx} ${y + bud * 0.5 * sy} q0 ${bud * sy} ${bud * sx} ${bud * sy} q0 ${-bud * sy} ${-bud * sx} ${-bud * sy} Z" fill="var(--gilt)"/>
  `;
}

// BrandMark.jsx reproduced 1:1 (same viewBox, same coordinates), just inline instead of a
// React component — this is the app's own mark, not a redrawing of it.
function brandMarkSvg(size) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" focusable="false">
      ${bracket(14, 14, false, false, 16, 4)}
      ${bracket(86, 14, true, false, 16, 4)}
      ${bracket(14, 86, false, true, 16, 4)}
      ${bracket(86, 86, true, true, 16, 4)}
      <text x="50" y="65" font-family="'IM Fell English','Iowan Old Style',Georgia,serif" font-size="52" text-anchor="middle" fill="var(--gilt)">R</text>
    </svg>
  `;
}

const TITLE = 'The Restricted Section';
const KICKER = 'HP TRIVIA';
// Adapted from the existing <meta name="description"> in index.html — same wording, just
// trimmed to a card-length line.
const TAGLINE = 'Timed runs, live duels, house leaderboards, and a weekly challenge.';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<!-- Same Google Fonts the app itself loads in index.html — not a new asset, the app's
     existing webfont dependency. If this fetch is ever unavailable the stack's own named
     fallbacks (Iowan Old Style / Georgia) still render the card correctly. -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap"
  rel="stylesheet"
/>
<style>
  /* Values copied straight from src/styles/tokens.css's default (Gryffindor) binding —
     only the two fixed, house-neutral channels (--page, --gilt) are used here, the same
     pair the inline favicon in index.html is drawn with and for the same stated reason. */
  :root {
    --page: #1a0607;
    --gilt: #d3a625;
    --gilt-rgb: 211, 166, 37;
    --parchment-100: #e6d5ae;
    --ash-300: #b0a488;
    --font-display: 'IM Fell English', 'Iowan Old Style', Georgia, serif;
    --font-body: 'EB Garamond', Georgia, serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    position: relative;
    background:
      radial-gradient(ellipse 760px 460px at 20% 0%, rgba(var(--gilt-rgb), 0.30) 0%, rgba(var(--gilt-rgb), 0) 70%),
      radial-gradient(ellipse 620px 420px at 85% 100%, rgba(var(--gilt-rgb), 0.14) 0%, rgba(var(--gilt-rgb), 0) 70%),
      var(--page);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }
  /* Same faint horizontal ruling as body::before in parts/base.css. */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 4px);
    opacity: 0.6;
  }
  .grain {
    position: absolute;
    inset: 0;
    background-image: ${PAPER_GRAIN};
    opacity: 0.5;
    mix-blend-mode: overlay;
  }
  .corner {
    position: absolute;
    width: 56px;
    height: 56px;
  }
  .card {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    text-align: center;
  }
  .mark { color: var(--gilt); }
  .kicker {
    font-family: var(--font-body);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: var(--gilt);
    text-transform: uppercase;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 74px;
    line-height: 1.05;
    color: var(--parchment-100);
    max-width: 980px;
  }
  .rule {
    width: 220px;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--gilt) 20%, #f1c65a 50%, var(--gilt) 80%, transparent);
    opacity: 0.9;
  }
  .tagline {
    font-family: var(--font-body);
    font-size: 30px;
    color: var(--ash-300);
    max-width: 820px;
  }
</style>
</head>
<body>
  <div class="grain"></div>
  <svg class="corner" style="top: 26px; left: 26px;" viewBox="0 0 56 56">${bracket(2, 2, false, false, 32, 6)}</svg>
  <svg class="corner" style="top: 26px; right: 26px;" viewBox="0 0 56 56">${bracket(54, 2, true, false, 32, 6)}</svg>
  <svg class="corner" style="bottom: 26px; left: 26px;" viewBox="0 0 56 56">${bracket(2, 54, false, true, 32, 6)}</svg>
  <svg class="corner" style="bottom: 26px; right: 26px;" viewBox="0 0 56 56">${bracket(54, 54, true, true, 32, 6)}</svg>
  <div class="card">
    <div class="mark">${brandMarkSvg(110)}</div>
    <div class="kicker">${KICKER}</div>
    <h1 class="title">${TITLE}</h1>
    <div class="rule"></div>
    <p class="tagline">${TAGLINE}</p>
  </div>
</body>
</html>`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(TMP_HTML), { recursive: true });
  writeFileSync(TMP_HTML, html, 'utf8');

  const browser = await chromium.launch({
    ...(EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {}),
    args: ['--ignore-certificate-errors'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    await page.goto(`file://${TMP_HTML}`, { waitUntil: 'networkidle' });
    // The page has no network dependency at runtime (fonts fall back to Georgia if a
    // Google Fonts fetch is ever blocked), but give webfonts a moment to apply when they do
    // load, so the card matches the app's actual typography rather than its fallback.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.screenshot({ path: OUT_FILE });
  } finally {
    await browser.close();
    rmSync(TMP_HTML, { force: true });
  }
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
