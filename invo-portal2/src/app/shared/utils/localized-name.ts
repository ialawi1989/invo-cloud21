/**
 * Shape shared by every entity that carries a per-language name override —
 * products, categories, departments, branches, menu items, etc. Mirrors the
 * backend's `translation` column: `{ <field>: { <langCode>: <text> } }`,
 * alongside the plain base-language field itself (e.g. `name`).
 */
export interface LocalizableRow {
  translation?: Record<string, Record<string, string> | undefined>;
  /** Some endpoints pre-resolve a display string server-side. */
  displayName?: unknown;
  /** Every other field (the base-language values, e.g. `name`) is read
   *  dynamically via `field` — deliberately untyped here so any concrete
   *  row shape (`{ id, name }`, `BranchOption`, …) is assignable without
   *  also declaring an index signature of its own. */
  [field: string]: any;
}

/**
 * Resolve `raw`'s `field` (default `"name"`) in the active UI `lang`,
 * falling back — in order — to a server-provided `displayName`, the plain
 * `field` value, and (defensively, for rows that carry the translation map
 * directly under `field` instead of under `translation.field`) the first
 * non-empty language value. Returns `''` for a missing/empty row so callers
 * never render `undefined` or `[object Object]`.
 *
 * One implementation instead of each feature growing its own
 * `resolveName`/`flattenName` — see `LocalizedNamePipe` for the template
 * form, and use this function directly wherever a plain string is needed
 * (a `displayWith` adapter, a loader mapping a row before it reaches a
 * component that never gets the active language otherwise).
 */
export function resolveLocalizedName(
  raw: LocalizableRow | null | undefined,
  lang: string | null | undefined,
  field: string = 'name',
): string {
  if (!raw) return '';

  const code = (lang || '').toLowerCase();
  const translated = code ? raw.translation?.[field]?.[code] : undefined;
  if (typeof translated === 'string' && translated.trim() !== '') return translated;

  const dn = raw.displayName;
  if (typeof dn === 'string' && dn.trim()) return dn;

  const base = raw[field];
  if (typeof base === 'string') return base;

  // Defensive: a few endpoints have been seen putting the translation map
  // directly under `field` rather than under `translation.field`.
  if (base && typeof base === 'object') {
    for (const v of Object.values(base as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return '';
}
