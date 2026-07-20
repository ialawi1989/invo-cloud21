/**
 * Smart-marks placement suggestions.
 *
 * Given the fields a user has available (joined data sources + their column
 * types) and the active chart type, propose how to fill the columns / rows /
 * marks shelves with sensible defaults. Two entry points:
 *
 *   - `suggestPlacement(fields, chartType, sampleRows?)` — full proposal,
 *     used by the "Choose for me" button. Replaces the active sheet's shelves.
 *
 *   - `suggestLive(sheet, fields, chartType, sampleRows?)` — non-destructive
 *     diff against the current sheet, used by the inline suggestion chips
 *     in the right panel ("Suggested: split by Region [Apply]"). Returns a
 *     small VM the UI can render directly.
 *
 * Both rely on `field-classifier.ts` to decide what's a dimension vs a
 * measure, and on per-field `cardinality` (computed from `sampleRows`) to
 * avoid putting a 10k-cardinality field on an x-axis.
 *
 * The output never mutates the inputs. The caller is expected to do
 * `pushHistory()` and apply the suggestion through its normal immutable
 * sheet update path so the change is a single undo step.
 */

import { ClassifiedField, classifyField } from './field-classifier';

/** Minimal field shape `suggestPlacement` accepts — a `FlatField` from
 *  the builder is the canonical shape but other callers can pass anything
 *  that supplies these properties. */
export interface SuggestableField {
  id: string;
  fullId: string;     // "Table.field"
  table: string;
  type?: string;      // 'text' | 'number' | 'date' | 'boolean' | …
  numberFormat?: string;
  label?: string;
}

/** Minimal report-column shape — mirrors `ReportColumn` without forcing the
 *  caller to import the model. */
export interface SuggestedColumn {
  col: string;        // 'Table.field'
  agg: string;        // 'sum' | 'count' | 'avg' | 'max' | 'min' | ''
  datePart: string;   // 'day' | 'month' | 'year' | 'yearmonth' | 'yearmonthday' | ''
  key: string;
}

/** Minimal mark encoding — only 'color' is consumed by the renderer today. */
export interface SuggestedMark {
  channel: 'color' | 'size' | 'shape' | 'label';
  field: SuggestedColumn;
}

export interface PlacementSuggestion {
  columnsShelf: SuggestedColumn[];
  rowsShelf: SuggestedColumn[];
  marks: SuggestedMark[];
  /** Human-readable reason for the suggestion — used in the UI hint. */
  reason: string;
  /** True when the suggestion engine actually had data to work with. */
  hasContent: boolean;
}

/** Cap for "low cardinality" — fields with more distinct values than this
 *  are unsuitable for an x-axis / color split / pie slice. Tuned by feel.  */
const LOW_CARD_LIMIT = 24;

/** Hard ceiling for an x-axis — never propose a 1000-value field on x. */
const X_AXIS_HARD_LIMIT = 100;

// ────────────────────────────────────────────────────────────────────────
// Entry points
// ────────────────────────────────────────────────────────────────────────

/**
 * Build a full placement proposal for a chart type.
 *
 * `sampleRows` is optional. Pass the rows that are currently in the canvas
 * so cardinality can be computed; otherwise the engine works purely off
 * the field schema (still functional, just less precise).
 */
export function suggestPlacement(
  fields: ReadonlyArray<SuggestableField>,
  chartType: string,
  sampleRows?: ReadonlyArray<Record<string, unknown>>,
): PlacementSuggestion {
  const tagged = tagFields(fields, sampleRows);
  const dimensions = tagged.filter(t => t.classified.role === 'dimension');
  const measures   = tagged.filter(t => t.classified.role === 'measure');

  // KPI: one measure, no dimension.
  if (chartType === 'kpi') {
    const m = pickFirstMeasure(measures);
    if (!m) return empty('KPI needs at least one numeric measure on the rows shelf.');
    return {
      columnsShelf: [],
      rowsShelf: [toColumn(m, { defaultAgg: 'sum' })],
      marks: [],
      reason: `Show the total ${labelOf(m)} as a KPI value.`,
      hasContent: true,
    };
  }

  // Table: dimensions to columns, measures to rows. No aggregation.
  if (chartType === 'table') {
    if (tagged.length === 0) return empty('Add a field to the table.');
    return {
      columnsShelf: dimensions.slice(0, 6).map(d => toColumn(d, { defaultAgg: '' })),
      rowsShelf:    measures.slice(0, 4).map(m => toColumn(m, { defaultAgg: '' })),
      marks: [],
      reason: 'Display raw rows. Add aggregations to summarise.',
      hasContent: true,
    };
  }

  // Pie / Donut: one dimension on columns, one measure on rows. No color split.
  if (chartType === 'pie' || chartType === 'donut') {
    const d = pickAxisDimension(dimensions);
    const m = pickFirstMeasure(measures);
    if (!d || !m) {
      return empty(`A ${chartType} chart needs one category (columns) and one measure (rows).`);
    }
    return {
      columnsShelf: [toColumn(d, { defaultAgg: '' })],
      rowsShelf:    [toColumn(m, { defaultAgg: 'sum' })],
      marks: [],
      reason: `Show share of ${labelOf(m)} across ${labelOf(d)}.`,
      hasContent: true,
    };
  }

  // Bar / H-Bar / Line / Area: one low-card dimension on x, one measure on y.
  // If a second low-card dimension exists, propose it as Color.
  const axisDim = pickAxisDimension(dimensions);
  const measure = pickFirstMeasure(measures);
  if (!axisDim || !measure) {
    return empty(`${labelForChart(chartType)} needs one category (columns) and one numeric measure (rows).`);
  }

  const colorDim = pickColorDimension(dimensions, axisDim);
  const marks: SuggestedMark[] = colorDim
    ? [{ channel: 'color', field: toColumn(colorDim, { defaultAgg: '' }) }]
    : [];

  const reason = colorDim
    ? `Plot ${labelOf(measure)} by ${labelOf(axisDim)}, split by ${labelOf(colorDim)}.`
    : `Plot ${labelOf(measure)} by ${labelOf(axisDim)}.`;

  return {
    columnsShelf: [toColumn(axisDim, { defaultAgg: '' })],
    rowsShelf:    [toColumn(measure, { defaultAgg: 'sum' })],
    marks,
    reason,
    hasContent: true,
  };
}

/** Suggestion view-model used by the inline chips next to the chart. */
export interface LiveSuggestion {
  /**
   * A new color split that's not yet on the sheet. UI shows
   * "Suggested: split by Region [Apply]".
   */
  suggestedColorField?: SuggestedColumn;
  /** True when the current shelves don't fit the chart type. */
  placementMismatch?: boolean;
  /** Human-readable explanation; safe to drop straight into a chip. */
  reason: string;
}

/**
 * Diff the current sheet against `suggestPlacement` and emit a small VM
 * for the right-panel chips. Never returns a fully-replaced placement —
 * use `suggestPlacement` for that. Pure / safe to call every change.
 */
export function suggestLive(
  current: { columnsShelf: SuggestedColumn[]; rowsShelf: SuggestedColumn[]; marks: SuggestedMark[] },
  fields: ReadonlyArray<SuggestableField>,
  chartType: string,
  sampleRows?: ReadonlyArray<Record<string, unknown>>,
): LiveSuggestion | null {
  if (!current || (!current.columnsShelf?.length && !current.rowsShelf?.length)) {
    return null; // empty sheet — let "Choose for me" handle it.
  }

  // 1. Placement mismatch: chart needs dim+meas but the sheet doesn't have
  // both. Tell the user to switch type or run "Choose for me".
  const needsDimAndMeas = ['vertical-bar', 'horizontal-bar', 'line', 'area', 'donut', 'pie'].includes(chartType);
  if (needsDimAndMeas) {
    const hasDim = current.columnsShelf.length > 0;
    const hasMeas = current.rowsShelf.some(c => !!c.agg);
    if (!hasDim || !hasMeas) {
      return {
        placementMismatch: true,
        reason: 'This chart needs one dimension on columns and one aggregated measure on rows. Try "Choose for me".',
      };
    }
  }

  // 2. Color-split suggestion: only for the chart types that benefit.
  if (!['vertical-bar', 'horizontal-bar', 'line', 'area'].includes(chartType)) return null;
  if (current.marks.some(m => m.channel === 'color')) return null;

  const tagged = tagFields(fields, sampleRows);
  const dimensions = tagged.filter(t => t.classified.role === 'dimension');
  // Don't propose a field that's already on a shelf.
  const onShelf = new Set<string>([
    ...current.columnsShelf.map(c => c.col),
    ...current.rowsShelf.map(c => c.col),
  ]);
  const candidates = dimensions.filter(d => !onShelf.has(d.field.fullId));
  // Pick the lowest-cardinality, non-identifier, non-date.
  const sorted = candidates
    .filter(d => d.classified.subtype !== 'identifier' && d.classified.subtype !== 'date')
    .filter(d => (d.classified.cardinality ?? 999) <= LOW_CARD_LIMIT)
    .sort((a, b) => (a.classified.cardinality ?? 999) - (b.classified.cardinality ?? 999));
  if (!sorted.length) return null;
  const pick = sorted[0];
  return {
    suggestedColorField: toColumn(pick, { defaultAgg: '' }),
    reason: `Split by ${labelOf(pick)} to compare series.`,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────────

interface TaggedField {
  field: SuggestableField;
  classified: ClassifiedField;
}

function tagFields(
  fields: ReadonlyArray<SuggestableField>,
  sampleRows?: ReadonlyArray<Record<string, unknown>>,
): TaggedField[] {
  return fields.map(f => {
    const samples = sampleRows
      ? sampleRows.map(r => r[f.fullId]).filter(v => v !== null && v !== undefined && v !== '')
      : undefined;
    return { field: f, classified: classifyField(f, samples) };
  });
}

function pickFirstMeasure(list: TaggedField[]): TaggedField | undefined {
  if (!list.length) return undefined;
  // Prefer currency / decimal first, then integer (counts), then anything else.
  const ordered = [...list].sort((a, b) => measureScore(a) - measureScore(b));
  return ordered[0];
}

function measureScore(t: TaggedField): number {
  const nf = (t.field.numberFormat || '').toLowerCase();
  if (nf === 'currency') return 0;
  if (nf === 'decimal')  return 1;
  if (t.classified.subtype === 'number') return 2;
  if (nf === 'integer')  return 3;
  if (t.classified.subtype === 'integer') return 4;
  return 9;
}


/**
 * Pick a dimension suitable for an x-axis: prefer date, then lowest-card
 * non-identifier. Skip identifier-style fields entirely — they look like
 * numbers and have huge cardinality.
 */
function pickAxisDimension(list: TaggedField[]): TaggedField | undefined {
  if (!list.length) return undefined;
  const usable = list.filter(t =>
    t.classified.subtype !== 'identifier' &&
    (t.classified.cardinality ?? 0) <= X_AXIS_HARD_LIMIT
  );
  if (!usable.length) return undefined;
  // Date > low-cardinality categorical > anything else.
  const byPriority = [...usable].sort((a, b) => axisScore(a) - axisScore(b));
  return byPriority[0];
}

function axisScore(t: TaggedField): number {
  if (t.classified.subtype === 'date') return 0;
  const card = t.classified.cardinality ?? 999;
  if (card === 0) return 100;       // no data → de-prioritise
  if (card <= LOW_CARD_LIMIT) return 1 + card / 1000;
  return 50 + card / 1000;
}

/**
 * Pick a SECOND dimension to put on Color — must be different from the
 * x-axis dim, low cardinality, and ideally categorical.
 */
function pickColorDimension(list: TaggedField[], axisDim: TaggedField): TaggedField | undefined {
  const usable = list.filter(t =>
    t !== axisDim &&
    t.classified.subtype !== 'identifier' &&
    t.classified.subtype !== 'date' &&
    (t.classified.cardinality ?? 999) <= LOW_CARD_LIMIT
  );
  if (!usable.length) return undefined;
  return [...usable].sort((a, b) =>
    (a.classified.cardinality ?? 999) - (b.classified.cardinality ?? 999)
  )[0];
}

function toColumn(t: TaggedField, opts: { defaultAgg: string }): SuggestedColumn {
  const isMeasure = t.classified.role === 'measure';
  const isDate = t.classified.subtype === 'date';
  return {
    col: t.field.fullId,
    agg: isMeasure ? opts.defaultAgg : '',
    datePart: isDate ? 'yearmonth' : '',
    key: `suggest-${t.field.fullId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
}

function labelOf(t: TaggedField): string {
  return t.field.label || t.field.id || t.field.fullId;
}

function labelForChart(chartType: string): string {
  switch (chartType) {
    case 'vertical-bar':   return 'A bar chart';
    case 'horizontal-bar': return 'A horizontal-bar chart';
    case 'line':           return 'A line chart';
    case 'area':           return 'An area chart';
    case 'donut':          return 'A donut chart';
    case 'pie':            return 'A pie chart';
    case 'kpi':            return 'A KPI';
    case 'table':          return 'A table';
    default:               return 'This chart';
  }
}

function empty(reason: string): PlacementSuggestion {
  return { columnsShelf: [], rowsShelf: [], marks: [], reason, hasContent: false };
}
