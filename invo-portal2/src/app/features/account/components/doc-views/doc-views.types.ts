import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

/** What the board / calendar ask the list page to fetch (it owns search + filters). */
export interface DocFetchOpts {
  /** Restrict to these statuses (intersected with the list's own status filter). */
  status?:   string[];
  /** Inclusive `yyyy-MM-dd` bounds on the document date; override the list's date filter. */
  fromDate?: string;
  toDate?:   string;
  page:      number;
  limit:     number;
}

export interface DocFetchResult {
  list:      any[];
  count:     number;
  pageCount: number;
}

export type DocFetch = (opts: DocFetchOpts) => Promise<DocFetchResult>;

/** One column of the status board. */
export interface DocBoardColumn {
  id:       string;
  /** i18n key of the column title. */
  labelKey: string;
  /** Backend statuses shown in this column. */
  statuses: string[];
  /** Tailwind background class of the column's dot. */
  tone:     string;
}

/** A small extra pill on a card (e.g. the online status of an invoice). */
export interface DocChip { text: string; classes: string; }

/**
 * Everything the board, calendar and card need to know about one document type.
 * A list page builds one of these from its own actions service, so privilege /
 * lock / status rules stay in one place per document.
 */
export interface DocViewAdapter {
  /** Row field holding the document number. */
  numberKey: string;
  /** Row field holding an optional reference shown under the number. */
  refKey?:   string;
  /** Row field holding the customer / supplier name. */
  partyKey:  string;
  /** Row field the calendar places a document on (the date the API filters by). */
  dateKey:   string;
  /** Optional second date shown on the card (due / expiry) and its i18n label key. */
  dueKey?:      string;
  dueLabelKey?: string;
  /** Statuses for which a past due date is NOT a problem (paid, closed, converted…). */
  settledStatuses?: string[];

  /** Board columns. */
  columns: DocBoardColumn[];

  /** The row's status; defaults to `row.status`. */
  statusOf?: (row: any) => string | null;
  /** Translated label of a status. */
  statusLabel: (status: string) => string;
  /** Tailwind classes of a status pill. */
  statusClass: (status: string) => string;
  /** Extra pills (optional). */
  chips?: (row: any) => DocChip[];

  // ── actions (from the document's central actions service) ──
  view(row: any): void;
  edit(row: any): void;
  canEdit(row: any): boolean;
  /** Why Edit is unavailable (an i18n key), or null. */
  editBlockedReason?(row: any): string | null;
  /** Items of the ⋯ menu; `after` must be called once a change may have been made. */
  menu(row: any, after: () => void): DropdownMenuBtnItem[];
}
