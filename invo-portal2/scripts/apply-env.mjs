#!/usr/bin/env node
// Reads .env (and .env.local, which wins if present) at the repo root and
// writes DEV_BACKEND_URL into src/environments/environment.ts before
// `ng serve`/`ng build` (see the `prestart`/`prebuild` npm scripts).
// invo-portal2 has no Node/SSR runtime, so a plain .env file can't be read
// by the browser bundle — this is the build-time substitute, matching the
// sibling `website` project's dotenv config in spirit (edit the file,
// re-run serve/build) without needing a running server process to pick it
// up.
//
// .env is the shared, tracked default (e.g. a shared dev backend);
// .env.local is gitignored and personal — a LAN IP or anything specific to
// one machine — and overrides .env when both define the same key.
//
// Only touches DEV_BACKEND_URL. PROD_BACKEND_URL stays a fixed constant in
// environment.ts — production deploys don't read either file.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const environmentPath = path.join(root, 'src/environments/environment.ts');

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const base  = parseEnvFile(path.join(root, '.env'));
const local = parseEnvFile(path.join(root, '.env.local'));
const env   = { ...base, ...local };

if (Object.keys(env).length === 0) {
  console.log('[apply-env] no .env or .env.local found, skipping (environment.ts left as-is)');
  process.exit(0);
}

const devBackendUrl = env.DEV_BACKEND_URL;
if (!devBackendUrl) {
  console.log('[apply-env] DEV_BACKEND_URL not set, skipping');
  process.exit(0);
}

let source = readFileSync(environmentPath, 'utf8');
const pattern = /const DEV_BACKEND_URL\s*=\s*'[^']*';/;
if (!pattern.test(source)) {
  console.error('[apply-env] could not find DEV_BACKEND_URL constant in environment.ts — leaving it untouched');
  process.exit(1);
}

source = source.replace(pattern, `const DEV_BACKEND_URL    = '${devBackendUrl}';`);
writeFileSync(environmentPath, source);
console.log(`[apply-env] DEV_BACKEND_URL -> ${devBackendUrl}`);
