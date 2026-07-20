/**
 * Field classifier — single source of truth for "is this field a dimension
 * or a measure, and what's its subtype?". Used by the smart-marks suggestion
 * engine and (eventually) by the chart-preview renderer for cell formatting.
 *
 * Decisions are made in this priority order so callers can trust them:
 *
 *   1. Identifier-style name (`barcode`, `sku`, `phone`, …) → dimension/identifier.
 *      Wins over any backend-declared `type` because the user clearly never
 *      wants SUM(barcode).
 *   2. Boolean-style declared type or name (`isWaste`, `hasX`, `enabled`, …)
 *      → dimension/boolean.
 *   3. `numberFormat` set on the field (`currency` / `decimal` / `integer`)
 *      → measure/number.
 *   4. Declared `type === 'date'` or column key carries a date-part prefix
 *      → dimension/date.
 *   5. Declared `type === 'number'` → measure/number, unless the name says
 *      otherwise (covered by #1 / #2).
 *   6. Sample-value inference — if sample values exist, use them: all
 *      numeric → measure/number, all dates → dimension/date, otherwise text.
 *   7. Fallback → dimension/text.
 *
 * Cardinality, when sample values are supplied, is the count of distinct
 * non-empty values seen in the sample. Suggestion logic uses this to avoid
 * dropping a 10k-cardinality field on an x-axis.
 */

import {
  isIdentifierFieldName,
  isBooleanFieldName,
  isIntegerFieldName,
  fieldNameOf,
  datePartPrefixOf,
  aggregationPrefixOf,
} from './field-patterns';

/**
 * Minimal structural shape of a `DataSourceField`. Mirrored here (instead of
 * imported from `../models/custom-report.model`) to keep this helper free of
 * a cycle, since the model uses the classifier in `coerceNumericRows`.
 */
export interface ClassifiableField {
  id?: string;
  type?: string;
  numberFormat?: string;
}

export type FieldRole = 'dimension' | 'measure';
export type FieldSubtype =
  | 'number'
  | 'integer'
  | 'date'
  | 'text'
  | 'boolean'
  | 'identifier';

export interface ClassifiedField {
  role: FieldRole;
  subtype: FieldSubtype;
  /** Distinct non-empty values observed in the supplied sample. */
  cardinality?: number;
  /** Original field name (post-prefix-strip) used for the classification. */
  name?: string;
}

/**
 * Classify a single field. `sampleValues` is optional — pass column values
 * from `reportData` when available so the result has a real cardinality.
 */
export function classifyField(
  field: ClassifiableField,
  sampleValues?: ReadonlyArray<unknown>,
): ClassifiedField {
  const name = field?.id || '';
  const declared = (field?.type || '').toLowerCase();
  const numberFormat = (field?.numberFormat || '').toLowerCase();

  // 1. Identifier-style name beats everything.
  if (isIdentifierFieldName(name)) {
    return finish({ role: 'dimension', subtype: 'identifier', name }, sampleValues);
  }

  // 2. Boolean — declared or name-based.
  if (declared === 'boolean' || isBooleanFieldName(name)) {
    return finish({ role: 'dimension', subtype: 'boolean', name }, sampleValues);
  }

  // 3. Explicit number sub-format.
  if (numberFormat === 'currency' || numberFormat === 'decimal') {
    return finish({ role: 'measure', subtype: 'number', name }, sampleValues);
  }
  if (numberFormat === 'integer' || isIntegerFieldName(name)) {
    return finish({ role: 'measure', subtype: 'integer', name }, sampleValues);
  }

  // 4. Date / date-part.
  if (declared === 'date') {
    return finish({ role: 'dimension', subtype: 'date', name }, sampleValues);
  }

  // 5. Declared number.
  if (declared === 'number') {
    return finish({ role: 'measure', subtype: 'number', name }, sampleValues);
  }

  // 6. Sample inference.
  if (sampleValues && sampleValues.length > 0) {
    const sniffed = sniffFromSamples(sampleValues);
    if (sniffed) return finish({ ...sniffed, name }, sampleValues);
  }

  // 7. Fallback.
  return finish({ role: 'dimension', subtype: 'text', name }, sampleValues);
}

/**
 * Classify a column key (e.g. `sum.SalesView.total` or `year.OrdersView.createdAt`)
 * by resolving the underlying field from `fields` and respecting the prefix.
 *
 * Aggregation prefixes always produce a measure/number. Date-part prefixes
 * always produce a dimension/text (the formatted year / month / yearmonth
 * string is a string).
 */
export function classifyColumnKey(
  key: string,
  fields: ReadonlyArray<ClassifiableField>,
  sampleValues?: ReadonlyArray<unknown>,
): ClassifiedField {
  const agg = aggregationPrefixOf(key);
  const datePart = datePartPrefixOf(key);
  const baseName = fieldNameOf(key);

  if (agg) {
    const baseSubtype: FieldSubtype = agg === 'count' || isIntegerFieldName(baseName)
      ? 'integer'
      : 'number';
    return finish({ role: 'measure', subtype: baseSubtype, name: baseName }, sampleValues);
  }
  if (datePart) {
    return finish({ role: 'dimension', subtype: 'text', name: baseName }, sampleValues);
  }

  // Plain column: look up the field by id-tail and classify it.
  const field = fields.find(f => f.id === baseName);
  if (field) return classifyField(field, sampleValues);

  // Unknown field — fall back to sample inference.
  return classifyField({ id: baseName, type: 'text' }, sampleValues);
}

// ────────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────────

function finish(base: ClassifiedField, sampleValues?: ReadonlyArray<unknown>): ClassifiedField {
  if (!sampleValues) return base;
  return { ...base, cardinality: distinctCount(sampleValues) };
}

function distinctCount(values: ReadonlyArray<unknown>): number {
  const set = new Set<string>();
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    set.add(typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return set.size;
}

/**
 * Inspect up to 50 sample values to guess a role/subtype. Returns null when
 * the sample is empty / all null / inconclusive.
 */
function sniffFromSamples(values: ReadonlyArray<unknown>): { role: FieldRole; subtype: FieldSubtype } | null {
  const sample = values.slice(0, 50).filter(v => v !== null && v !== undefined && v !== '');
  if (sample.length === 0) return null;

  let booleanish = 0;
  let numericish = 0;
  let dateish = 0;

  for (const v of sample) {
    if (typeof v === 'boolean') { booleanish++; continue; }
    if (typeof v === 'number') { numericish++; continue; }
    if (typeof v === 'string') {
      const s = v.trim();
      if (s === 'true' || s === 'false' || s === 'yes' || s === 'no') { booleanish++; continue; }
      if (!isNaN(Number(s))) { numericish++; continue; }
      if (isIsoDateLike(s)) { dateish++; continue; }
    }
  }

  const total = sample.length;
  if (booleanish / total >= 0.8) return { role: 'dimension', subtype: 'boolean' };
  if (dateish / total >= 0.8) return { role: 'dimension', subtype: 'date' };
  if (numericish / total >= 0.8) return { role: 'measure', subtype: 'number' };
  return { role: 'dimension', subtype: 'text' };
}

function isIsoDateLike(s: string): boolean {
  // Accept yyyy-MM-dd, yyyy-MM-ddTHH:mm:..., yyyy/MM/dd, ISO with timezone.
  if (s.length < 8) return false;
  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return false;
  const t = Date.parse(s);
  return !isNaN(t);
}
