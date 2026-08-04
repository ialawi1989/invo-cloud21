/**
 * Flat representation of a binding path for the field picker. The list is
 * intentionally pre-flattened (rather than a tree) so the search filter can
 * fuzzy-match across all paths in a single pass.
 */
export interface FlatPath {
  /** Full dotted/bracketed path usable in an expression (e.g. `customer.name`,
   *  `lines[0].productName`). */
  path: string;
  /** Display label — the trailing segment only. */
  label: string;
  /** Nesting depth — drives the indent in the UI. */
  depth: number;
  /** One-liner preview of the value (truncated). Helps authors recognise
   *  what each path resolves to without binding it first. */
  example: string;
  kind: 'scalar' | 'object' | 'array';
}

/**
 * Walk `value` and produce a list of every reachable binding path up to
 * `maxDepth` levels. Arrays are inspected via index `[0]` because every
 * concrete item lives in a row context.
 *
 * Skips fields whose values are `null`/`undefined` from recursion (they
 * still appear as leaves) and caps depth to keep the picker scannable.
 */
export function flattenPaths(value: unknown, opts: { maxDepth?: number } = {}): FlatPath[] {
  const maxDepth = opts.maxDepth ?? 3;
  const out: FlatPath[] = [];
  visit(value, '', 0, out, maxDepth);
  return out;
}

function visit(value: unknown, prefix: string, depth: number, out: FlatPath[], maxDepth: number): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (value.length === 0 || depth >= maxDepth) return;
    // Expose the first element under `[0]` so authors can drill into row shapes.
    const child = `${prefix}[0]`;
    const sample = value[0];
    out.push({
      path: child,
      label: '[0]',
      depth,
      example: previewOf(sample),
      kind: typeof sample === 'object' && sample !== null ? (Array.isArray(sample) ? 'array' : 'object') : 'scalar',
    });
    visit(sample, child, depth + 1, out, maxDepth);
    return;
  }
  if (typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const kind: FlatPath['kind'] = Array.isArray(v) ? 'array' : v !== null && typeof v === 'object' ? 'object' : 'scalar';
    out.push({ path, label: k, depth, example: previewOf(v), kind });
    if (depth < maxDepth && v !== null && typeof v === 'object') {
      visit(v, path, depth + 1, out, maxDepth);
    }
  }
}

function previewOf(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    const trimmed = v.length > 40 ? v.slice(0, 37) + '…' : v;
    return JSON.stringify(trimmed);
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return '{…}';
  return String(v);
}
