/**
 * Data context passed to the renderer. The renderer creates a child context
 * for each row/group/page so expressions can reference both outer and inner scope.
 */
export interface BindingContext {
  /** Root document data — usually the invoice. */
  readonly data: Record<string, unknown>;
  /** Page-time variables: current, total, etc. */
  readonly page: PageVariables;
  /** Per-row scope when iterating tables. */
  readonly row?: Record<string, unknown>;
  /** Index of current row, 0-based. */
  readonly rowIndex?: number;
  /** Group scope when inside a grouped table. */
  readonly group?: GroupVariables;
  /** Locale + language for filters. */
  readonly locale: string;
  /** Custom variables provided by the caller (tenant info, user, etc.). */
  readonly vars: Record<string, unknown>;
}

export interface PageVariables {
  current: number;
  total: number;
}

export interface GroupVariables {
  key: unknown;
  rows: unknown[];
  index: number;
}

/**
 * Helpers passed to filters that need to recurse into the binding engine —
 * specifically `each:'<tpl>'` which evaluates a template per array element.
 * Receiving these via a fourth arg (rather than embedding the engine in the
 * BindingContext) keeps the public context type clean.
 */
export interface FilterHelpers {
  /** Replace `{{ … }}` placeholders inside `template` against `ctx`. */
  interpolate(template: string, ctx: BindingContext): string;
  /** Derive a row-scoped context for one element of an iterated array. */
  withRow(ctx: BindingContext, row: Record<string, unknown>, index: number): BindingContext;
}

/**
 * Filter signature: receives the current value, args, full context, and
 * (optionally) recursion helpers. Filters are pure functions registered
 * with the FilterRegistry.
 */
export type Filter = (
  value: unknown,
  args: string[],
  ctx: BindingContext,
  helpers?: FilterHelpers,
) => unknown;

/** Registered filter map. */
export type FilterMap = Record<string, Filter>;
