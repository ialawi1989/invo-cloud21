/**
 * Product spreadsheet import & export (v2): `POST product/import`,
 * `POST product/export` and the column registry `GET product/import/columns`.
 * Header-driven: only the columns present in the file are touched, and cells
 * carry names (category, tax, brand…) rather than ids.
 */

export interface ProductSheetColumn {
  key: string;
  /** What the export writes and what users see. */
  header: string;
  /** Other headers the import accepts (old export headers, keys…). */
  aliases: string[];
  group: string;
  /** `branch` columns apply to the branches chosen in the import step. */
  target: 'product' | 'branch';
  kind: string;
  /** Product types the column applies to; ignored on other types. */
  types: 'all' | string[];
  requiredOnCreate: boolean;
  /** Only used when the import creates the product. */
  createOnly: boolean;
  clearable: boolean;
}

export interface ProductSheetPreset { key: string; name: string; columns: string[]; }

export interface ProductSheetRegistry {
  columns: ProductSheetColumn[];
  groups: string[];
  presets: ProductSheetPreset[];
  alwaysExported: string[];
  productTypes: string[];
  clearToken: string;
}

export type OnExisting = 'update' | 'skip';
export type EmptyCells = 'keep' | 'clear';
export type SheetRowData = Record<string, unknown>;

export interface ProductSheetImportOptions {
  dryRun: boolean;
  onExisting: OnExisting;
  emptyCells: EmptyCells;
  /** Omitted means every branch. */
  branchIds?: string[];
  stockBranchId?: string;
  ignoreColumns: string[];
  /** File header → column key; `""` ignores the header. */
  columnMapping: Record<string, string>;
}

export interface ProductSheetImportRequest { rows: SheetRowData[]; options: ProductSheetImportOptions; }

export type RowStatus = 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';
export interface RowMessage { column?: string; message: string; }

export interface RowReport {
  /** Spreadsheet row number; the header is row 1. */
  row: number;
  barcode?: string;
  name?: string;
  status: RowStatus;
  productId?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  errors?: RowMessage[];
  warnings?: RowMessage[];
}

export interface WillCreate {
  departments?: string[];
  categories?: string[];
  brands?: string[];
  locations?: { branchId: string; branch: string; name: string }[];
  [other: string]: unknown;
}

export interface ImportSummary {
  rows: number; created: number; updated: number; unchanged: number; skipped: number; failed: number; warnings: number;
}

export interface ProductSheetReport {
  dryRun: boolean;
  summary: ImportSummary;
  columns: { used: string[]; ignored: string[]; unknownColumns: string[] };
  willCreate?: WillCreate;
  created?: WillCreate;
  clears?: Record<string, number>;
  rows: RowReport[];
}

export interface ProductSheetImportResponse { success: boolean; msg: string; data?: ProductSheetReport; }

/** The server refuses more than this per request. */
export const MAX_SHEET_ROWS = 20000;

export type SheetFormat = 'xlsx' | 'csv';

export interface ProductSheetExportRequest {
  preset?: string;
  columns?: string[];
  branchId?: string;
  format: SheetFormat;
}

// ── Catalog export (`GET product/exportCatalogProducts`) ───────────────────
export type CatalogExportFormat = 'json' | 'csv' | 'xlsx';

export interface CatalogExportQuery {
  format?: CatalogExportFormat;
  q?: string; vendor?: string; type?: string; tag?: string; sku?: string; id?: string;
  branchId?: string;
  /** Comma separated standalone product types. */
  types?: string;
  /** JSON only. */
  page?: number;
  /** JSON only, max 250. */
  limit?: number;
}

export interface CatalogExportEnvelope {
  generatedAt: string; total: number; page: number; limit: number; pages: number; products: any[];
}
