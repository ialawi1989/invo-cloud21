/**
 * Lightweight ID generator. We avoid the `uuid` package at runtime to keep the
 * engine library-independent — tenants who want RFC4122-strict IDs can swap
 * in `uuid` via the optional `idGenerator` injection token in the designer
 * shell.
 *
 * Format: `{prefix}_{base36-time}{base36-rand}` — short, sortable-ish, unique
 * enough for in-document references.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function makeId(prefix = 'b'): string {
  const t = Date.now().toString(36);
  let r = '';
  for (let i = 0; i < 6; i++) {
    r += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${t}${r}`;
}

export function makeBlockId(): string {
  return makeId('b');
}
export function makeSectionId(): string {
  return makeId('s');
}
export function makeTemplateId(): string {
  return makeId('tpl');
}
