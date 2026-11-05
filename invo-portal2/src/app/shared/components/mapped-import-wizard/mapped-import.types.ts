// Public types for `<app-mapped-import-wizard>` — a Configure → Map Fields → Preview import in which the
// user maps the uploaded file's own headers onto the target's fields (unlike `<app-import-wizard>`, whose
// file has to follow a fixed column order).

/** One row of the file, keyed by `MappedImportField.key`. Dates are already normalised to `yyyy-MM-dd`. */
export type MappedRow = Record<string, string>;

export interface MappedImportField {
  key: string;
  /** i18n key of the field name shown in the Map Fields table. */
  label: string;
  /** i18n key of the section the field is listed under (fields are grouped in config order). */
  group: string;
  required?: boolean;
  /** `date` fields get a format picker next to the header picker. */
  type?: 'text' | 'number' | 'date';
  /** Extra header spellings (case-insensitive) used for the auto-match, besides the label's translation. */
  aliases?: string[];
}

export interface MappedImportOption {
  key: string;
  /** i18n keys. */
  label: string;
  description?: string;
  default?: boolean;
}

export interface MappedImportIssue {
  /** 1-based row of the file (the header is row 1). */
  row: number;
  ref: string;
  reason: string;
  /** When set, the preview offers a picker so the user can correct `field` for this record (`ref`) in place. */
  fix?: { field: string; options: { value: string; label: string }[] };
  /** UI only: the value the user picked for `fix.field`; the row stays listed, marked as corrected. */
  fixedTo?: string;
}

export interface MappedImportPreview {
  /** Records that will be (or were) imported. */
  ready: number;
  /** Records in the file. */
  total: number;
  skipped: MappedImportIssue[];
  failed: MappedImportIssue[];
  /** Set by a real run only. */
  imported?: number;
}

export type MappedImportRun = (
  rows: MappedRow[],
  opts: { dryRun: boolean; options: Record<string, boolean> },
) => Promise<MappedImportPreview>;

export interface MappedImportConfig {
  /** i18n key of the modal title ("Import Invoices"). */
  title: string;
  /** i18n key of the plural record name, used in the preview summary ("Invoices"). */
  recordsLabel: string;
  fields: MappedImportField[];
  /** Field whose value identifies a record across rows (invoice number) — what a per-record fix is keyed on. */
  recordKey?: string;
  /** First row is the header, as in `<app-import-wizard>`. */
  templateRows: (string | number)[][];
  templateName: string;
  options?: MappedImportOption[];
  /** i18n keys of the "Page Tips" bullets. */
  tips?: string[];
  /** Local check behind the Preview step (no request). Without it the preview is a `run` with `dryRun: true`. */
  preview?: (rows: MappedRow[], opts: { options: Record<string, boolean> }) => MappedImportPreview;
  /** The real import — called only from the Preview step's Import button. */
  run: MappedImportRun;
}

export type MappedImportStep = 'configure' | 'map' | 'preview';
