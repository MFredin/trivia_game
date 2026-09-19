#!/usr/bin/env node
/**
 * Finds code nothing references: CSS classes no markup uses, and exports nothing imports.
 *
 * Deliberately conservative — it reports, it does not delete. Both checks are textual, so a
 * class assembled at runtime (`btn-${variant}`) or an export used only through a dynamic
 * import will show up as unused. The ALLOWED lists below are for exactly those cases, and
 * every entry says why. Anything not listed is a finding to look at, not to trust blindly.
 *
 * Exit code is 0 either way: this is a report to read, not a gate. The gate is
 * `npm run audit:contrast`, which is mechanical enough to be trusted.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// Entry points and scripts are run, not imported, so nothing importing them is expected.
const ALLOWED_UNIMPORTED = ['src/main.jsx'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = walk(join(root, 'src'));
const css = files.filter((f) => f.endsWith('.css'));
const code = files.filter((f) => /\.(jsx?|tsx?)$/.test(f));
const markup = [...code, join(root, 'index.html')];

// Comments and url() payloads are stripped first: a data-URI SVG contains "www.w3.org", and
// the selector scan would otherwise report `.org` and `.w3` as unused classes forever.
const cssText = css
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/url\(([^)]*)\)/g, 'url()')
  // @import paths end in .css, which the selector scan would read as a class named `css`.
  .replace(/@import[^;]*;/g, '');
const markupText = markup.map((f) => readFileSync(f, 'utf8')).join('\n');

// --- CSS classes nothing applies -------------------------------------------------------
const classes = new Set();
for (const m of cssText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(m[1]);

const unusedClasses = [...classes].sort().filter((c) => {
  // Whole-token match: `.plate` must not be satisfied by the word "plated" in a comment.
  const token = c.replace(/-/g, '\\-');
  return !new RegExp(`(^|[\\s"'\`{}:,(\\[])${token}($|[\\s"'\`{},)\\]])`).test(markupText);
});

// --- exports nothing imports ------------------------------------------------------------
const sources = code.map((f) => [f, readFileSync(f, 'utf8')]);
const unusedExports = [];
const unimported = [];

for (const [file, text] of sources) {
  const others = sources.filter(([f]) => f !== file).map(([, t]) => t).join('\n');
  const names = new Set();
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(m[1]);
  }
  for (const name of names) {
    if (!new RegExp(`\\b${name}\\b`).test(others)) unusedExports.push(`${relative(root, file)}: ${name}`);
  }

  const rel = relative(root, file);
  if (ALLOWED_UNIMPORTED.includes(rel)) continue;
  const base = rel.split('/').pop().replace(/\.(jsx?|tsx?)$/, '');
  if (!new RegExp(`['"\`][^'"\`]*\\b${base}\\.(js|jsx)['"\`]`).test(others)) unimported.push(rel);
}

const section = (title, items, note) => {
  console.log(`\n${title}: ${items.length}`);
  if (note && items.length) console.log(`  (${note})`);
  for (const i of items) console.log(`  ${i}`);
};

console.log(`Scanned ${css.length} stylesheets and ${code.length} modules.`);
section('CSS classes nothing applies', unusedClasses, 'check for runtime-assembled names before deleting');
section('Exports nothing imports', unusedExports, 'narrow to a module-local const, or remove');
section('Modules nothing imports', unimported);

const total = unusedClasses.length + unusedExports.length + unimported.length;
console.log(`\n${total === 0 ? 'Nothing unreferenced.' : `${total} thing${total === 1 ? '' : 's'} to look at.`}`);
