#!/usr/bin/env node
/**
 * i18n gate — run with `npm run i18n:check`.
 *
 * Three failures, all release blockers:
 *
 *  1. Key drift. Every `i18n/en.json` must have a matching `ar.json` with the
 *     same key set. A key present in one and missing in the other renders as a
 *     raw translation path in the UI.
 *
 *  2. Untranslated placeholders. New Arabic strings land as `TODO_AR: <english>`
 *     so nobody mistakes copied English for a translation. This script fails
 *     while any remain — that is the point: it's the thing that stops a half
 *     translated feature reaching an Arabic-speaking user.
 *
 *  3. Dead references. A `SOME.DOTTED.KEY` string literal piped through
 *     `| translate` or passed to `.instant(...)` that doesn't exist in ANY
 *     `en.json` (base or feature) renders as the raw key — the exact bug that
 *     let `COMMON.IMPORT_WIZARD.*` sit undefined despite ~60 live references.
 *     This check only proves the key exists SOMEWHERE, not that the
 *     component's own feature namespace loads it — it catches typos and
 *     deletions, not "loaded from the wrong feature".
 *
 * Exit code 1 on any failure, so it works as a CI step as-is:
 *     - run: npm run i18n:check
 *
 * Deliberately NOT part of `npm test`. It stays red for as long as a feature
 * is waiting on translation, and a test command that is always red is a test
 * command everyone learns to ignore. `npm run verify` runs both.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
/** The app-wide bundles live outside src/, and are just as gate-worthy. */
const EXTRA_DIRS = [join(ROOT, 'public', 'i18n')];
const PLACEHOLDER = 'TODO_AR';

/** Every directory named `i18n` under src/. */
function findI18nDirs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry === 'i18n') out.push(full);
    else findI18nDirs(full, out);
  }
  return out;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

function read(path) {
  try {
    return flatten(JSON.parse(readFileSync(path, 'utf8')));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`${relative(ROOT, path)} is not valid JSON: ${e.message}`);
  }
}

/** Every `.ts`/`.html` file under `dir` (skips `node_modules`, dotfiles). */
function findSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { findSourceFiles(full, out); continue; }
    if (entry.endsWith('.ts') || entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * A plausible dotted i18n key: `SCREAMING_SNAKE.PARTS.LIKE.THIS`, 2+ segments,
 * and not ending in `_` — a trailing underscore is the app's own convention
 * for a dynamic prefix (`'GROUP_' + type`), not a real leaf key.
 */
const KEY_RE = /^[A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)+$/;
const isDynamicPrefix = (key) => key.endsWith('_');
/** `.instant('KEY')` / `.instant("KEY")` — translate.instant, lang.instant, etc. */
const INSTANT_CALL_RE = /\.instant\(\s*(['"`])([^'"`]+)\1/g;
/** `'KEY' | translate` in templates. */
const PIPE_RE = /(['"])([^'"]+)\1\s*\|\s*translate\b/g;

/** Every plausible i18n key literal referenced via `.instant(...)` or `| translate`. */
function findKeyReferences(text) {
  const found = new Set();
  for (const re of [INSTANT_CALL_RE, PIPE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const key = m[2];
      if (KEY_RE.test(key) && !isDynamicPrefix(key)) found.add(key);
    }
  }
  return found;
}

const problems = [];
let placeholders = 0;
let checked = 0;

const dirs = [...findI18nDirs(SRC), ...EXTRA_DIRS.filter((d) => {
  try { return statSync(d).isDirectory(); } catch { return false; }
})];

/** Union of every key defined in any `en.json` across the whole app — see the
 *  module doc's caveat: existence here does not prove the referencing
 *  component's own feature namespace loads it. */
const allDefinedKeys = new Set();

for (const dir of dirs) {
  const en = read(join(dir, 'en.json'));
  const ar = read(join(dir, 'ar.json'));
  const where = relative(ROOT, dir).replace(/\\/g, '/');

  if (!en && !ar) continue;
  if (!en) { problems.push(`${where}: ar.json exists with no en.json`); continue; }
  if (!ar) { problems.push(`${where}: en.json exists with no ar.json`); continue; }
  checked++;

  for (const k of Object.keys(en)) allDefinedKeys.add(k);

  const missing = Object.keys(en).filter((k) => !(k in ar));
  const extra = Object.keys(ar).filter((k) => !(k in en));
  if (missing.length) problems.push(`${where}: ${missing.length} key(s) missing from ar.json — ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
  if (extra.length) problems.push(`${where}: ${extra.length} key(s) in ar.json with no en.json counterpart — ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? ' …' : ''}`);

  const todo = Object.entries(ar).filter(([, v]) => typeof v === 'string' && v.includes(PLACEHOLDER));
  if (todo.length) {
    placeholders += todo.length;
    problems.push(`${where}: ${todo.length} string(s) awaiting Arabic translation (${PLACEHOLDER}) — first: ${todo[0][0]}`);
  }
}

// ── Dead references: keys used in code but defined nowhere ──────────────────
const deadRefs = new Map(); // key -> first file that referenced it
for (const file of findSourceFiles(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const key of findKeyReferences(text)) {
    if (allDefinedKeys.has(key)) continue;
    if (!deadRefs.has(key)) deadRefs.set(key, relative(ROOT, file).replace(/\\/g, '/'));
  }
}
if (deadRefs.size) {
  const entries = [...deadRefs.entries()];
  problems.push(`${entries.length} i18n key(s) referenced in code but defined in no en.json:`);
  for (const [key, file] of entries.slice(0, 20)) problems.push(`  ${key}  (${file})`);
  if (entries.length > 20) problems.push(`  … and ${entries.length - 20} more`);
}

if (problems.length) {
  console.error(`\ni18n check failed (${checked} locale pair(s) scanned):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  if (placeholders) {
    console.error(`\n${placeholders} string(s) still need Arabic. Find them with:`);
    console.error(`  grep -rn "${PLACEHOLDER}" src/app/**/i18n/ar.json\n`);
  }
  process.exit(1);
}

console.log(`i18n check passed — ${checked} locale pair(s), no key drift, no untranslated placeholders.`);
