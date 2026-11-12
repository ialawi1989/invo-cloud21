import { InvoiceLine } from '../../models/invoice.model';

/** What a column edits. `item` is the product / free-text cell; the rest map to a line field. */
export type DocColumnType = 'item' | 'qty' | 'money' | 'discount' | 'tax' | 'amount' | 'text' | 'account';

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
  /** Largest allowed qty of a line (credit note lines can't exceed what the invoice still allows). */
  max?: (line: InvoiceLine) => number | null;
  decimal?: boolean;
  /** A serialized product may still have any quantity here (purchases bring many units in). */
  freeQty?: boolean;
  /** Small line under a money cell; returns an i18n key (or null for none) - e.g. where a purchase cost came from. */
  hint?: (line: InvoiceLine) => string | null;
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
  /** The lines come from a source document (credit note ← invoice): no add / blank trailing row, only the listed cells are edited. */
  fixedLines?: boolean;
  /** Shows the Inclusive / Exclusive tax toggle in the header: `editable` switches the document's tax type, `locked` only displays it (credit notes follow their invoice). It also locks once a line has been returned. */
  taxType?: 'editable' | 'locked';

  /** Typeahead source for the item cell (page 1 only). `filter` carries the item filter (tags). */
  itemSearch: (term: string, filter?: DocItemFilter) => Promise<DocItemPage>;
  /** Enables the item filter button in the item cell; loads the tags to pick from. */
  itemFilterTags?: (p: { page: number; pageSize: number; search: string }) => Promise<{ items: { label: string; value: string }[]; hasMore: boolean }>;
  /** Barcode / scan lookup; enables the Scan Item bar when provided. */
  barcodeLookup?: (term: string) => Promise<any | null>;
  /** Enables "Add Items in Bulk" (uses `itemSearch` + `barcodeLookup`). */
  bulkItems?: boolean;
  /** Enables "Import" (CSV / XLSX by barcode): resolves the barcodes to product records. */
  searchByBarcodes?: (barcodes: string[]) => Promise<any[]>;
  /** Replaces the whole import flow (purchase orders import cost + supplier code and keep unmatched rows as notes). */
  customImport?: () => Promise<void>;
  /** Serialized / batch products on a bill: opens the dialog that enters the serial numbers / batches (qty + cost follow from them). */
  splitEditor?: (line: InvoiceLine) => Promise<void>;
  /** Short text under the item ("3 serials", "2 batches") for a line that has been split. */
  splitSummary?: (line: InvoiceLine) => string;
  /** Enables the per-row "Select an account" strip and bulk account update. */
  accounts?: boolean;
  /** Own rule for a row nobody has filled in yet (default: no product and no note) - a row without products, like an expense line, needs one. */
  isBlank?: (line: InvoiceLine) => boolean;
  /** Extra "Bulk Actions" on the ticked lines (a bill of entry sets the custom duty of many lines at once). */
  bulkActions?: DocBulkAction[];

  /** Product types hidden from the item typeahead and scan. */
  excludeTypes?: string[];
  /** Product types that can't be added through bulk / import (they need a per-line picker). */
  bulkExcludeTypes?: string[];
  /** Enable the "Select serials…" / "Select batchs…" picker on serialized / batch lines. */
  serialsLookup?: (productId: string) => Promise<any[]>;
  batchesLookup?: (productId: string) => Promise<any[]>;
  /** Package / menu selection / menu item lines: the popup that picks their sub items (and options) opens before the line is filled. */
  subItems?: { branchId: () => string };
  /** Blocks the item picker (e.g. no branch chosen yet). */
  itemsDisabled?: () => boolean;

  isLocked?: (line: InvoiceLine) => boolean;
  canRemove?: (line: InvoiceLine, ctx: DocLinesContext) => boolean;
  /** Runs after a line was removed (`voided` = a saved line kept and flagged): invoices ask whether the removal was waste. */
  afterRemove?: (line: InvoiceLine, outcome: 'removed' | 'voided') => Promise<void>;
  canEditProduct?: (line: InvoiceLine, ctx: DocLinesContext) => boolean;

  /** Extra line-level validation; return i18n keys of what is wrong. */
  validate?: (line: InvoiceLine) => string[];
}

/** One extra bulk action: its button label (i18n key) and what it does to the ticked lines. */
export interface DocBulkAction { label: string; run: (lines: InvoiceLine[]) => Promise<void> | void; }

export interface DocItemFilter { tags: string[]; /** 1-based page (default 1). */ page?: number; }
/** One page of `itemSearch` results; `hasNext` comes from the API (it fetches limit + 1). */
export interface DocItemPage { list: any[]; hasNext: boolean; }
/** Items per page requested by `itemSearch`. */
export const DOC_ITEMS_PAGE = 20;

/** Validation result of one line — keys are column keys (or `item`). */
export type DocLineErrors = Record<string, string>;
