import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guard: the generic entity-selector must own NO domain concepts. This test
 * greps every source file in this folder (excluding specs) and fails loudly if
 * a domain word leaks in — the whole point of the extraction.
 */
const ROOT = dirname(fileURLToPath(import.meta.url));
const DOMAIN = /branch|online/i;
const SOURCE_EXT = new Set(['.ts', '.html', '.scss']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (entry.endsWith('.spec.ts')) continue;
    if (SOURCE_EXT.has(extname(entry))) out.push(full);
  }
  return out;
}

describe('entity-selector — no domain-word leak', () => {
  it('contains no "branch" / "online" in any source file', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const text = readFileSync(file, 'utf8');
      text.split(/\r?\n/).forEach((line: string, i: number) => {
        if (DOMAIN.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, `Domain words leaked into the generic core:\n${offenders.join('\n')}`).toEqual([]);
  });
});
