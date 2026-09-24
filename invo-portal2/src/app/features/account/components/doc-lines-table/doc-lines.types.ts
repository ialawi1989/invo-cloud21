import { InvoiceLine } from '../../models/invoice.model';

/** What a column edits. `item` is the product / free-text cell; the rest map to a line field. */
export type DocColumnType = 'item' | 'qty' | 'money' | 'discount' | 'tax' | 'amount';

export interface DocLineColumn {
  key: string;
  type: DocColumnType;
  /** i18n key of the header. */
  label: string;
  /** Line property the column edits (defaults: qty → `qty`, money → `price`, discount → `discountAmount`). */
  field?: string;
  width?: string;
  /** Rendered when it returns false is skipped; omitted = always shown. */
  visible?: (ctx: DocLinesContext) => boolean;
  /** Per-line read-only rule on top of the table-level lock. */
  disabled?: (line: InvoiceLine, ctx: DocLinesContext) => boolean;
  /** Must hold a value (money/qty/tax); the item column is always required (product or note). */
  required?: boolean;
  /** Smallest allowed value for qty / money. */
  min?: number;
  decimal?: boolean;
}

export interface DocLinesContext {
  formStatus: string;
  status: string;
  hasScope: boolean;
}

/**
 * Everything that differs between documents (invoice, estimate, credit note, bill, PO …).
 * The table itself is document-agnostic; each form supplies its own columns and data sources.
 */
export interface DocLinesConfig {
  columns: DocLineColumn[];

  /** Typeahead source for the item cell (page 1 only). */
  itemSearch: (term: string) => Promise<any[]>;
  /** Barcode / scan lookup; enables the Scan Item bar when provided. */
  barcodeLookup?: (term: string) => Promise<any | null>;
  /** Enables "Add Items in Bulk" (uses `itemSearch` + `barcodeLookup`). */
  bulkItems?: boolean;
  /** Enables the per-row "Select an account" strip and bulk account update. */
  accounts?: boolean;

  /** Product types that can't be picked yet (e.g. serial / batch need their own picker). */
  excludeTypes?: string[];
  /** Blocks the item picker (e.g. no branch chosen yet). */
  itemsDisabled?: () => boolean;

  isLocked?: (line: InvoiceLine) => boolean;
  canRemove?: (line: InvoiceLine, ctx: DocLinesContext) => boolean;
  canEditProduct?: (line: InvoiceLine, ctx: DocLinesContext) => boolean;

  /** Extra line-level validation; return i18n keys of what is wrong. */
  validate?: (line: InvoiceLine) => string[];
}

/** Validation result of one line — keys are column keys (or `item`). */
export type DocLineErrors = Record<string, string>;
