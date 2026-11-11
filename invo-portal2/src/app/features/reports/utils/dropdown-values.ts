/**
 * The ids behind what a `<app-search-dropdown>` hands back through its two-way `value` / `(valueChange)`. That binding carries the
 * selected ITEM objects (only a form control gets the `toValue` result), so a picker that keeps ids must convert: `{ id }`,
 * `{ value }` or a plain id string/number all become an id; empty / null become `[]`.
 */
export function pickIds(v: unknown): string[] {
  const list = Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
  const out: string[] = [];
  for (const x of list) {
    const id = x !== null && typeof x === 'object' ? ((x as any).id ?? (x as any).value) : x;
    if (id !== undefined && id !== null && id !== '') out.push(String(id));
  }
  return out;
}
