/* ═══ Custom Reports v2 API shapes (/v1/app/accounts/reports/v2) ═══ */

export type CatalogFieldType = 'text' | 'number' | 'date' | 'boolean' | 'id' | 'json';

export interface CatalogField {
  key: string;            // "qty", or "@invoiceLineNet" for formulas / custom fields
  label: string;
  type: CatalogFieldType;
  filterable: boolean;
  /** false = hidden by default in pickers (ids, keys) — not forbidden. */
  show: boolean;
  numberFormat?: string;
}

export interface CatalogRelation {
  name: string;           // path segment, e.g. "product"
  entity: string;         // target entity key
  cardinality: 'one' | 'many';
}

export interface CatalogEntity {
  key: string;
  label: string;
  category: string;
  /** Runs are refused without dateRange.from/to. */
  requiresDateRange?: boolean;
  /** Field to preselect for the date range. */
  defaultDate?: string;
  fields: CatalogField[];
  relations: CatalogRelation[];
}

export type SpecAgg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct';
export type SpecDatePart = 'day' | 'week' | 'month' | 'year' | 'yearmonth' | 'yearmonthday' | 'hour';

export interface SpecColumn {
  field?: string;         // may be omitted for count(*)
  agg?: SpecAgg;
  datePart?: SpecDatePart;
  as?: string;
}

export interface SpecRule {
  field: string;
  op: string;
  value?: any;
}

export interface SpecFilterGroup {
  glue: 'and' | 'or';
  rules: Array<SpecRule | SpecFilterGroup>;
}

export interface SpecSort {
  field?: string;
  agg?: SpecAgg;
  datePart?: SpecDatePart;
  dir: 'asc' | 'desc';
}

export interface SpecBucket {
  field: string;
  options: { label: string; values: any[] }[];
  otherLabel?: string;
  as?: string;
}

/**
 * A value worked out from the report's own columns after it runs. Same shape
 * as the builder's CalculatedField, except operands name a column key (the
 * column's `as`, or its default key) or an earlier calculated field's name.
 * The SQL engine ignores these; the builder and the AI tools compute them.
 */
export interface SpecCalculatedField {
  name: string;
  mode: 'math' | 'concat' | 'summary';
  operands: { type: 'field' | 'constant'; value: string | number; operator?: string }[];
  aggFunc?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  separator?: string;
}

export interface ReportSpecV2 {
  version: 2;
  entity: string;
  columns: SpecColumn[];
  dateRange?: { field?: string; from: string; to: string };
  filters?: SpecFilterGroup;
  groupBy?: Array<string | { field: string; datePart?: SpecDatePart }>;
  sort?: SpecSort[];
  limit?: number;
  page?: number;
  displayGroupBy?: string;
  buckets?: SpecBucket[];
  calculatedFields?: SpecCalculatedField[];
  /**
   * Builder-only presentation (sheets, chart types, formats, dashboard).
   * The backend ignores unknown keys on run and stores them verbatim on save.
   */
  ui?: any;
}

export interface RunColumn {
  key: string;
  label: string;
  field?: string;
  agg?: string;
  datePart?: string;
  type: string;
  numberFormat?: string;
}

export interface RunResult {
  columns: RunColumn[];
  rows?: any[];
  groups?: { value: any; count: number; subtotals: { [key: string]: any }; rows: any[] }[];
  hasNext: boolean;
  limit: number | null;
  page: number;
  offset: number;
  fanOut: boolean;
}

export interface ValidateResult {
  ok: boolean;
  columns?: RunColumn[];
  fanOut?: boolean;
  error?: string;
}

export interface SavedSpec {
  id: string;
  name: string;
  spec: ReportSpecV2;
  isShared: boolean;
  createdBy?: string;
  updatedAt?: string;
}

export interface AiHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** The company's AI token allowance for the current month (resets on the 1st, UTC). */
export interface AiUsage {
  usedThisMonth: number;
  monthlyLimit: number;
}

export interface AiBuildResult {
  spec: ReportSpecV2 | null;
  explanation: string;
  usage?: AiUsage;
  preview: {
    columns: { name: string; field?: string; agg?: string; datePart?: string; type?: string }[];
    rows?: any[];
    groups?: { value: any; count: number; rows: any[] }[];
    hasMore: boolean;
    note?: string;
  } | null;
}

export type ReportErrorCode = 'REPORT_INVALID' | 'REPORT_TIMEOUT' | 'REPORT_FAILED';

/** A refused or failed v2 call. `message` is safe to show as is. */
/** `error` of an AI_UNAVAILABLE response from POST v2/ai/build (safe fields only). */
export interface AiUnavailableDetails {
  code: 'AI_UNAVAILABLE';
  message?: string;
  reason: 'rate_limited' | 'auth' | 'model_not_found' | 'bad_request' | 'timeout' | 'unavailable' | 'not_configured';
  failedSource?: 'server' | 'content_ai' | 'both' | 'none';
  contentAiReason?: string;
  model?: string;
  retryAfterSeconds?: number;
  action?: { type: 'open_content_ai_settings' };
}

export class ReportApiError extends Error {
  /** The backend's `error` object (AI_UNAVAILABLE carries reason / retryAfterSeconds / action). */
  details?: AiUnavailableDetails | Record<string, any>;

  constructor(message: string, public code?: ReportErrorCode | string, details?: Record<string, any>) {
    super(message);
    this.name = 'ReportApiError';
    this.details = details;
  }
}
