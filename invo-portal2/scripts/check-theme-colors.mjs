#!/usr/bin/env node
/**
 * Theme drift check: flags hard-coded colours in component styles.
 *
 * Why: dark mode works because component styles read --ui-* tokens (src/styles/_dark.scss).
 * A literal like `#fff` or `rgb(15 23 42)` keeps its light value in dark mode, so it shows up as a
 * bright patch or unreadable text.
 *
 * What it scans: *.scss, the `styles: [`...`]` blocks of *.ts components, and inline `style="..."` /
 * `[style.x]="..."` in *.html. Existing literals are recorded per file in scripts/theme-colors.baseline.json;
 * the check FAILS when a file has more literals than its baseline (or a new file has any), so the count can
 * only go down.
 *
 *   npm run lint:colors            check (exit 1 on drift)
 *   npm run lint:colors:update     rewrite the baseline after converting colours to tokens (it can only shrink
 *                                  unless you pass --allow-growth)
 *
 * Opt out on purpose: put `theme-ok` in a comment on the same line (e.g. brand artwork, QR codes, signature pads).
 * Document paper, PDF code, print styles, the guided tour and the theme file itself are never scanned.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const baselinePath = join(root, 'scripts', 'theme-colors.baseline.json');
const update = process.argv.includes('--update');
const allowGrowth = process.argv.includes('--allow-growth');

const EXCLUDE = [
  'document-paper', 'designer-paper', 'designer-canvas', 'document-builder', 'pdf', 'print', 'guided-tour',
  'styles/_dark.scss', '.spec.ts', 'environments/', 'receipt-builder', 'label-builder', 'signature-pad', 'qrcode',
];
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const FUNC = /\b(?:rgba?|hsla?)\(\s*[\d.]/g; // rgb(var(--x)) and rgb(from ...) are fine; literal numbers are not
const NAMED = /(?:^|[\s:;,(])(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|fill|stroke)\s*:\s*(?:white|black)\b/gi;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function stripComments(text, isStyleText) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  if (isStyleText) out = out.replace(/(^|[^:"'(])\/\/[^\n]*/g, (m, a) => a);
  return out;
}

function countIn(text, isStyleText) {
  const lines = stripComments(text, isStyleText).split('\n');
  const raw = text.split('\n');
  const found = [];
  lines.forEach((line, i) => {
    if ((raw[i] || '').includes('theme-ok')) return;
    const n = (line.match(HEX) || []).length + (line.match(FUNC) || []).length + (line.match(NAMED) || []).length;
    if (n) found.push({ line: i + 1, n, text: line.trim().slice(0, 110) });
  });
  return found;
}

const results = {};
for (const file of walk(srcDir)) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (EXCLUDE.some(x => rel.includes(x))) continue;
  const text = readFileSync(file, 'utf8');
  let found = [];
  if (file.endsWith('.scss')) found = countIn(text, true);
  else if (file.endsWith('.ts')) {
    for (const m of text.matchAll(/styles\s*:\s*\[?\s*`((?:[^`\\]|\\.)*)`/g)) {
      const offset = text.slice(0, m.index).split('\n').length - 1;
      found.push(...countIn(m[1], true).map(f => ({ ...f, line: f.line + offset })));
    }
  } else if (file.endsWith('.html')) {
    for (const m of text.matchAll(/(?:\[style\.[\w-]+\]|\bstyle)\s*=\s*("[^"]*"|'[^']*')/g)) {
      const offset = text.slice(0, m.index).split('\n').length - 1;
      found.push(...countIn(m[1], false).map(f => ({ ...f, line: f.line + offset })));
    }
  } else continue;
  if (found.length) results[rel] = found;
}

const counts = Object.fromEntries(Object.entries(results).map(([f, v]) => [f, v.reduce((a, b) => a + b.n, 0)]));
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null;

if (update || !baseline) {
  const next = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  if (baseline && !allowGrowth) {
    const grew = Object.entries(next).filter(([f, n]) => n > (baseline[f] ?? 0));
    if (grew.length) {
      console.error('Refusing to raise the baseline (use --allow-growth if that is intended):');
      grew.forEach(([f, n]) => console.error(`  ${f}: ${baseline[f] ?? 0} -> ${n}`));
      process.exit(1);
    }
  }
  writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n');
  console.log(`Baseline written: ${total} hard-coded colour value(s) in ${Object.keys(next).length} file(s).`);
  process.exit(0);
}

const drift = [];
for (const [f, n] of Object.entries(counts)) if (n > (baseline[f] ?? 0)) drift.push([f, baseline[f] ?? 0, n]);
const improved = Object.entries(baseline).filter(([f, n]) => (counts[f] ?? 0) < n).length;

if (drift.length) {
  console.error('\nHard-coded colours added in component styles (they will not follow dark mode):\n');
  for (const [f, was, now] of drift) {
    console.error(`  ${f}  (${was} -> ${now})`);
    const baseCount = was;
    let shown = 0;
    // show the last lines of the file's hits: the newest ones are usually the offenders
    for (const hit of results[f].slice(-Math.max(1, now - baseCount))) {
      console.error(`      line ${hit.line}: ${hit.text}`);
      if (++shown >= 5) break;
    }
  }
  console.error('\nUse a token instead, e.g. var(--ui-surface), var(--ui-text), var(--ui-line), var(--ui-brand-soft), var(--ui-red-text)');
  console.error('(full list: src/styles/_dark.scss). For intentional literals add `theme-ok` in a comment on that line.\n');
  process.exit(1);
}
console.log(`Theme colours OK: ${total} legacy literal(s) remain across ${Object.keys(counts).length} file(s)` + (improved ? `; ${improved} file(s) improved — run "npm run lint:colors:update" to lock that in.` : '.'));
