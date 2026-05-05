/**
 * Token resolver for the document-paper renderer.
 *
 * Replaces `{{path.to.value|format}}` tokens in a string with values
 * pulled from the data object. Supports a small filter pipeline
 * (matches the React mockup's resolver):
 *
 *   {{customer.name}}                 → "XYZ Enterprises"
 *   {{totals.subtotal|currency}}      → "336.250"
 *   {{invoice.number|upper}}          → "INV-2026-001287"
 *   {{customer.country|lower}}        → "bahrain"
 *   {{totals.lineCount|int}}          → "4"
 *   {{customer.phone|fallback:N/A}}   → "N/A" (when phone is empty)
 *
 * Multiple filters chain: `{{x|currency|upper}}`. Unknown filters are
 * silently dropped — the goal is to never throw on a malformed token,
 * because templates are user data and we'd rather render an empty
 * string than crash a print job.
 *
 * Pure function — no DOM, no Angular. Used by both Classic and
 * Designer renderers + the form's preview surface, plus any future
 * entity view page that wants to drive the same shape.
 */

/** Sentinel chars for the open/close tags. Mirrors the legacy
 *  receipt-builder convention (no escape-hatch needed). */
const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

export type DocumentRenderData = Record<string, unknown>;

/** Resolve every `{{…}}` in `input` against `data`. Non-string inputs
 *  pass through unchanged (the renderer also calls this on cell
 *  values which may already be numeric). */
export function resolveTokens(
  input: unknown,
  data: DocumentRenderData,
): string {
  if (typeof input !== 'string') return input == null ? '' : String(input);
  return input.replace(TOKEN_RE, (_, expr: string) => {
    // Split on `|` so "path|filter1|filter2:arg" yields the right pieces.
    const parts = expr.split('|').map((s) => s.trim());
    const path  = parts.shift() ?? '';
    let value: unknown = readPath(data, path);
    for (const filter of parts) {
      value = applyFilter(value, filter);
    }
    return value == null ? '' : String(value);
  });
}

/** Read a dotted path (`a.b.c`) off an object, tolerant of nullish
 *  intermediates. Falls back to `undefined` on missing keys. */
function readPath(data: DocumentRenderData, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>(
    (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]),
    data,
  );
}

/** Apply a single filter to a value. */
function applyFilter(value: unknown, filter: string): unknown {
  // `name:arg1:arg2` → split off the head + a colon-separated arg list.
  const [name, ...args] = filter.split(':').map((s) => s.trim());
  switch (name) {
    case 'currency':  return formatCurrency(value);
    case 'int':       return formatInt(value);
    case 'upper':     return value == null ? '' : String(value).toUpperCase();
    case 'lower':     return value == null ? '' : String(value).toLowerCase();
    case 'fallback':  return (value == null || value === '') ? (args.join(':') || '') : value;
    case 'truncate':  return truncate(value, parseInt(args[0] ?? '40', 10));
    default:          return value;     // unknown filter — silently no-op
  }
}

function formatCurrency(value: unknown): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : String(value);
}

function formatInt(value: unknown): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n).toString() : String(value);
}

function truncate(value: unknown, max: number): string {
  if (value == null) return '';
  const s = String(value);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Read an array off a dotted path — used by table elements with
 *  `bindTo`. Returns `[]` when the path doesn't resolve to an array. */
export function readArray(data: DocumentRenderData, path: string): unknown[] {
  const v = readPath(data, path);
  return Array.isArray(v) ? v : [];
}
