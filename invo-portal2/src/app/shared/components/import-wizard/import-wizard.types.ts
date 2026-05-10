// ────────────────────────────────────────────────────────────────────
// Public types for `<app-import-wizard>`.
//
// A wizard instance is configured at open-time by the calling feature
// — the wizard owns the UI (upload → preview → options? → importing
// → complete), and the feature provides:
//
//   • the column schema (drives the CSV parser + preview table)
//   • the per-row validator
//   • optional import-mode radios for the Options step
//   • the submit fn (called with the rows that passed validation)
//
// Keeping the contract narrow makes this re-usable for any "paste/CSV
// → review → import" flow in the app.
// ────────────────────────────────────────────────────────────────────

/** Cell map keyed by `column.key`, all values trimmed. CSV is string-
 *  only at the wire — coerce inside `validate` / `submit`. */
export type ImportRow = Record<string, string>;

export interface ImportColumn {
  /** Stable key — also used as the CSV column name when the user
   *  uploads a file with a header row. */
  key:   string;
  /** Localised header shown in the preview table. Also accepted as
   *  a header-row match. */
  label: string;
}

export interface ImportMode {
  value:       string;
  label:       string;
  description: string;
  /** Renders a small warning chip next to the radio. Use for
   *  destructive modes ("override / replace all"). */
  warn?:       boolean;
}

export interface ImportSummaryCounts {
  total:      number;
  successful: number;
  failed:     number;
  skipped:    number;
}

export interface ImportSubmitResult {
  ok:    boolean;
  /** Inline error to surface on the Importing step. */
  msg?:  string;
  /** Counts shown on the Complete step. If omitted, the wizard
   *  derives them from the rows it sent. */
  result?: ImportSummaryCounts;
}

export interface ImportWizardConfig {
  /** Modal title. Leave undefined to fall back to a generic
   *  "Import" header. */
  title?: string;
  /** Optional one-line intro shown above the upload zone. */
  hint?:  string;
  /** Optional pill: "Importing into <name>". */
  scope?: { label: string; value: string };

  /** Column schema. Order = preview table column order and CSV
   *  cell index. */
  columns: ImportColumn[];

  /** Sample rows for the downloadable templates. First entry is
   *  treated as the header row and is also reused for both the
   *  CSV and XLSX downloads. */
  templateRows: (string | number)[][];
  /** Filename stem (no extension) for the downloaded templates. */
  templateName: string;

  /** Per-row validator. Return an `errors` array; non-empty
   *  flags the row as invalid (it won't be sent to `submit`). */
  validate?: (cells: ImportRow) => { errors: string[] };
  /** Returns a stable key per row used to detect duplicates.
   *  Default: the first column's value. Return `''` (or omit
   *  the column from `columns`) to disable dedup. */
  duplicateKey?: (cells: ImportRow) => string;

  /** Optional import-mode radio set. If empty/undefined, the
   *  Options step is skipped and submit runs directly. */
  modes?:       ImportMode[];
  defaultMode?: string;

  /** Called once before `submit`. Return a non-empty string to
   *  abort with that message (e.g. "an import is already in
   *  progress for this label"). */
  preflight?: () => Promise<string | null>;

  /** Final submit. Receives the rows that passed validation
   *  (and weren't skipped as duplicates). */
  submit: (
    rows: ImportRow[],
    opts: { mode: string; skipDuplicates: boolean },
  ) => Promise<ImportSubmitResult>;

  /** Optional Guidelines block rendered at the bottom of the
   *  Upload step. Each section is a titled bullet list (i18n
   *  keys); `tip` renders as a single blue tip box below. */
  notes?: {
    /** "Import Guidelines" header — i18n key. Defaults to a
     *  generic "Import Guidelines" if omitted. */
    title?:    string;
    sections?: { title: string; items: string[] }[];
    tip?:      string;
  };
}

/** Internal — what the wizard tracks per parsed row. */
export interface AnnotatedRow {
  cells:   ImportRow;
  /** 1-based line number in the source paste, for "row 5: Missing
   *  barcode" style error messages. */
  line:    number;
  status:  'valid' | 'invalid' | 'duplicate';
  errors:  string[];
}
