/**
 * Document-builder data model
 * ───────────────────────────
 * Ported from the legacy `InvoCloudFront2` `DocumentTemplate` so saved
 * templates from any tenant continue to load here without migration.
 *
 * Two design rules:
 *  1. **Wire-format parity** — every field name (including legacy
 *     typos like `invoicLines`, `delevary`, `taxPercantage`,
 *     `refrence`) is preserved so existing JSON round-trips. We add
 *     new fields (`renderMode`, `customElements`, `additionalData`)
 *     alongside, never replacing.
 *  2. **Pure data + factory functions** — no classes, no methods on
 *     instances. The legacy model used class methods like
 *     `getTableHeader(documentType)` which were called from view
 *     templates; we surface the same logic as standalone helper
 *     functions (`getTableHeader(template, type)`) so the data
 *     remains plain JSON suitable for signals + change detection.
 */

// ────────────────────────────────────────────────────────────────────
// Document types (covers every entity that uses the builder)
// ────────────────────────────────────────────────────────────────────
export type DocumentType =
  | 'invoice'
  | 'estimate'
  | 'credit-note'
  | 'purchase-order'
  | 'bill'
  | 'expense'
  | 'supplier-credit';

/** Which renderer the view/print page should use for this template.
 *  `'classic'` — structured renderer (legacy default; what every
 *  saved template is until the user opts in).
 *  `'designer'` — absolute-positioned canvas (new, phase 2). Saved
 *  templates default to `'classic'` so existing data is unaffected. */
export type RenderMode = 'classic' | 'designer';

// ────────────────────────────────────────────────────────────────────
// Building blocks — text style / margins / visibility / logo
// ────────────────────────────────────────────────────────────────────
export interface Margins {
  top:    string | number;
  bottom: string | number;
  left:   string | number;
  right:  string | number;
}
export const DEFAULT_MARGINS = (): Margins => ({
  top: '0.635', bottom: '0.635', left: '0.635', right: '0.635',
});

export interface Visibility {
  visible: boolean;
  /** Reserve space when hidden (px). Header default 179, footer 85. */
  height:  number;
}
export const DEFAULT_HEADER_VISIBILITY = (): Visibility =>
  ({ visible: true, height: 179 });
export const DEFAULT_FOOTER_VISIBILITY = (): Visibility =>
  ({ visible: true, height: 85 });

export interface CompanyLogo {
  show:           boolean;
  width:          number;
  height:         number;
  originalWidth:  number;
  originalHeight: number;
  /** Base64 / URL of the logo image (defaults to empty — the renderer
   *  falls back to the company's saved logo). */
  logo:           string;
}
export const DEFAULT_LOGO = (): CompanyLogo => ({
  show: true, width: 122, height: 50,
  originalWidth: 122, originalHeight: 50, logo: '',
});

/** Style for a single text field — show/hide + sizing + colours +
 *  alignment + formatting (bold/italic/underline) + an optional label
 *  override. Same shape as legacy `TextSizeAndColor` so JSON
 *  round-trips. */
export interface TextStyle {
  show:            boolean;
  showLabel:       boolean;
  size:            string | number;
  color:           string;
  labelColor:      string;
  backgroundColor: string;
  position:        string;       // 'firstColumn' | 'secondColumn' (legacy)
  alignment:       string;       // 'left' | 'center' | 'right'
  label:           string;
  bold:            boolean;
  italic:          boolean;
  underline:       boolean;
}
export const DEFAULT_TEXT_STYLE = (overrides: Partial<TextStyle> = {}): TextStyle => ({
  show: true,
  showLabel: true,
  size: '12',
  color: '#495057',
  labelColor: '#495057',
  backgroundColor: '',
  position: 'firstColumn',
  alignment: 'left',
  label: '',
  bold: false,
  italic: false,
  underline: false,
  ...overrides,
});

/** Variant used for footer fields where alignment defaults to centre
 *  and the background carries a value by default. */
export const DEFAULT_TEXT_STYLE_ALIGNED = (overrides: Partial<TextStyle> = {}): TextStyle =>
  DEFAULT_TEXT_STYLE({ alignment: 'center', backgroundColor: 'white', ...overrides });

// ────────────────────────────────────────────────────────────────────
// Custom-field style (per branch / entity custom field)
// ────────────────────────────────────────────────────────────────────
/** Per-CF style entry. Branch CFs land in the header; entity-type
 *  CFs (invoice / estimate / bill / …) land in the transactional
 *  details block. Each row stores the CF's stable key + a copy of
 *  its name (so the form can render even if the CF was deleted on
 *  the backend), plus a full TextStyle. */
export interface CustomFieldStyle {
  /** The custom-field's `abbr` (programmatic key). Stable; survives
   *  rename. Used to look up the value on the live document at
   *  render time. */
  abbr:  string;
  /** The CF's display name at the moment the entry was created.
   *  Acts as the label fallback when `style.label` is empty so the
   *  preview keeps reading correctly even if the CF is later
   *  deleted from the tenant's settings. */
  name:  string;
  /** Visibility + size + colour + alignment + label override.
   *  Re-uses TextStyle so every CF row reads through the same
   *  per-field gear-collapsed editor as the built-in fields. */
  style: TextStyle;
}

// ────────────────────────────────────────────────────────────────────
// Header / Footer
// ────────────────────────────────────────────────────────────────────
export interface HeaderCustomization {
  logo:        CompanyLogo;
  companyName: TextStyle;
  vatNumber:   TextStyle;
  title:       TextStyle;
  name:        TextStyle;
  address:     TextStyle;
  phone:       TextStyle;
  visibility:  Visibility;
  /** Branch custom fields styled for the header. Keyed by `abbr`;
   *  the parser preserves entries for CFs that no longer exist on
   *  the backend so undelete restores their styling. */
  customFields: CustomFieldStyle[];
}
export const DEFAULT_HEADER = (): HeaderCustomization => ({
  logo:        DEFAULT_LOGO(),
  companyName: DEFAULT_TEXT_STYLE(),
  vatNumber:   DEFAULT_TEXT_STYLE(),
  // Title default: large, bold, right-aligned — matches the legacy
  // paper where the document title (e.g. "TAX INVOICE") sits as a
  // banner in the header's trailing column next to the logo.
  title:       DEFAULT_TEXT_STYLE({ size: '24', alignment: 'right', bold: true }),
  name:        DEFAULT_TEXT_STYLE(),
  address:     DEFAULT_TEXT_STYLE(),
  phone:       DEFAULT_TEXT_STYLE(),
  visibility:  DEFAULT_HEADER_VISIBILITY(),
  customFields: [],
});

/** Page number configuration. Independent from the document-level
 *  notes/terms footer (which can be pinned to every page in paginated
 *  mode); the page number is a separate decoration the user opts in
 *  to and positions explicitly. */
export interface PageNumberConfig {
  show:     boolean;
  /** Where in the page footer the number appears. Mapped to a flex
   *  align-self so RTL automatically flips left/right. */
  position: 'left' | 'center' | 'right';
}

export interface FooterCustomization {
  noteTitle:    TextStyle;
  note:         TextStyle;
  customerNote: TextStyle;
  term:         TextStyle;
  visibility:   Visibility;
  pageNumber:   PageNumberConfig;
}
export const DEFAULT_FOOTER = (): FooterCustomization => ({
  noteTitle:    DEFAULT_TEXT_STYLE_ALIGNED({ size: 10 }),
  note:         DEFAULT_TEXT_STYLE_ALIGNED({ size: 10 }),
  customerNote: DEFAULT_TEXT_STYLE_ALIGNED({ size: 10 }),
  term:         DEFAULT_TEXT_STYLE_ALIGNED({ size: 10 }),
  visibility:   DEFAULT_FOOTER_VISIBILITY(),
  // Page number: hidden by default (legacy parity — most templates
  // don't show one). User opts in via the Footer panel.
  pageNumber:   { show: false, position: 'right' },
});

// ────────────────────────────────────────────────────────────────────
// Transactional details (per-document-type fields + table headers)
// ────────────────────────────────────────────────────────────────────
/** Open-ended map keyed by field name. Holds every transactional
 *  detail field across all 7 document types — the form filters which
 *  ones are surfaced based on `documentType`. Wire format mirrors the
 *  legacy `TransactionalDetailsCustomization` exactly, including
 *  intentional typos (`invoicLines`, `refrence`). */
export interface TransactionalDetails {
  [field: string]: TextStyle | CustomFieldStyle[] | undefined;
  /** Per-document-type entity custom fields. Keyed by `abbr`. Same
   *  parser semantics as `HeaderCustomization.customFields` —
   *  unknown entries are preserved through round-trips. */
  customFields?: CustomFieldStyle[];
}

/** Common-to-all-types fields. Document-type-specific fields are
 *  added on top via the per-type lists in
 *  `DOC_TYPE_TRANSACTIONAL_FIELDS`. */
const COMMON_TRANSACTIONAL_FIELDS = [
  'tableTitle', 'taxType', 'barcode',
  'refrence', 'createdDate', 'dueDate',
] as const;

/** Per-document-type relevant fields (used for both seeding defaults
 *  and filtering on save). Mirrors legacy `toFilteredJSON` mapping. */
export const DOC_TYPE_TRANSACTIONAL_FIELDS: Record<DocumentType, string[]> = {
  'invoice': [
    'invoiceTableHeader', 'invoicLines', 'invoicVoidedLines',
    'customerName', 'customerPhone', 'customerAddress', 'customerVatNumber',
    'vatNumber', 'salesPerson', 'employeeName',
    'invNumber', 'invoiceDate', 'invoiceDueDate',
    'service',
  ],
  'estimate': [
    'estimateTableHeader', 'estimateLines', 'estimateVoidedLines',
    'customerName', 'customerPhone', 'customerAddress', 'customerVatNumber',
    'vatNumber', 'salesPerson', 'employeeName',
    'estimateNumber', 'estimateDate', 'estimateExpDate',
  ],
  'credit-note': [
    'creditNoteTableHeader', 'creditNoteLines', 'creditNoteVoidedLines',
    'customerName', 'customerPhone', 'customerAddress', 'customerVatNumber',
    'vatNumber', 'salesPerson', 'employeeName',
    'creditNoteNumber', 'creditNoteDate', 'originalInvoice',
  ],
  'purchase-order': [
    'purchaseTableHeader', 'purchaseLines', 'purchaseVoidedLines',
    'supplierName', 'supplierPhone', 'supplierAddress', 'supplierVatNumber',
    'employeeName',
    'purchaseOrderNumber', 'purchaseOrderDate', 'purchaseOrderExpiryDate', 'expectedDeliveryDate',
  ],
  'bill': [
    'billTableHeader', 'billLines', 'billVoidedLines',
    'supplierName', 'supplierPhone', 'supplierAddress', 'supplierVatNumber',
    'employeeName', 'uom',
    'billNumber', 'billDate', 'billDueDate', 'purchaseOrder', 'vendorBillNumber',
  ],
  'expense': [
    'expenseTableHeader', 'expenseLines', 'expenseVoidedLines',
    'supplierName', 'supplierPhone', 'supplierAddress', 'supplierVatNumber',
    'employeeName',
    'expenseNumber', 'expenseDate', 'paymentMethodName', 'paidThrough',
  ],
  'supplier-credit': [
    'supplierCreditTableHeader', 'supplierCreditLines', 'supplierCreditVoidedLines',
    'supplierName', 'supplierPhone', 'supplierAddress', 'supplierVatNumber',
    'employeeName',
    'supplierCreditNumber', 'supplierCreditDate', 'originalBill',
  ],
};

/** Field ids that render in the right-hand "second column" of the
 *  transactional details block (Invoice Date, Due Date, Created
 *  Date, Reference, …). They default to right-aligned text so the
 *  values line up against the right edge of the column — matching
 *  the legacy paper layout. CSS logical alignment in the renderer
 *  flips this in RTL automatically.
 *
 *  Kept in sync with `PAPER_LAYOUT[type].secondColumn` ids — adding
 *  a new second-column field needs a matching entry here. */
const SECOND_COLUMN_FIELD_IDS: ReadonlyArray<string> = [
  // shared / common
  'createdDate', 'refrence', 'service',
  // invoice
  'invoiceDate', 'invoiceDueDate',
  // estimate
  'estimateDate', 'estimateExpDate',
  // credit-note
  'creditNoteDate', 'originalInvoice',
  // purchase-order
  'purchaseOrderDate', 'purchaseOrderExpiryDate', 'expectedDeliveryDate',
  // bill
  'billDate', 'billDueDate', 'vendorBillNumber', 'purchaseOrder',
  // expense
  'expenseDate', 'paymentMethodName', 'paidThrough',
  // supplier-credit
  'supplierCreditDate', 'originalBill',
];

/** Default styling overrides for specific transactional fields. Most
 *  fields default to the standard `DEFAULT_TEXT_STYLE`; these get
 *  bespoke seed values matching the legacy constructor. */
const TRANSACTIONAL_FIELD_OVERRIDES: Record<string, Partial<TextStyle>> = {
  // Table header chrome — dark on white text
  invoiceTableHeader:        { color: '#fff', backgroundColor: '#3c3d3a' },
  estimateTableHeader:       { color: '#fff', backgroundColor: '#3c3d3a' },
  creditNoteTableHeader:     { color: '#fff', backgroundColor: '#3c3d3a' },
  purchaseTableHeader:       { color: '#fff', backgroundColor: '#3c3d3a' },
  billTableHeader:           { color: '#fff', backgroundColor: '#3c3d3a' },
  expenseTableHeader:        { color: '#fff', backgroundColor: '#3c3d3a' },
  supplierCreditTableHeader: { color: '#fff', backgroundColor: '#3c3d3a' },
  // Barcode — green default
  barcode:                   { color: '#fff', backgroundColor: '#74b72e' },
  // POS service — hidden by default so existing templates don't
  // suddenly start showing a "Service" line. Right-aligned because
  // it's a second-column field.
  service:                   { size: 10, show: false, alignment: 'right' },
  // Second-column fields — right-aligned by default. Iterating the
  // list keeps the per-field overrides minimal.
  ...Object.fromEntries(
    SECOND_COLUMN_FIELD_IDS
      .filter((id) => id !== 'service')
      .map((id) => [id, { alignment: 'right' } as Partial<TextStyle>]),
  ),
};

export const DEFAULT_TRANSACTIONAL = (documentType: DocumentType): TransactionalDetails => {
  const out: TransactionalDetails = {};
  const allFields = new Set([
    ...COMMON_TRANSACTIONAL_FIELDS,
    ...DOC_TYPE_TRANSACTIONAL_FIELDS[documentType],
  ]);
  // Also seed every other type's fields so templates can be saved
  // round-trip even when the user toggles document-type fields they
  // haven't touched. The save-time filter strips irrelevant ones.
  Object.values(DOC_TYPE_TRANSACTIONAL_FIELDS).flat().forEach((f) => allFields.add(f));

  for (const f of allFields) {
    out[f] = DEFAULT_TEXT_STYLE({ size: 10, ...TRANSACTIONAL_FIELD_OVERRIDES[f] });
  }
  out.customFields = [];
  return out;
};

/** Lookup helper — returns the table-header style for a document type. */
export function getTableHeader(t: DocumentTemplate, type: DocumentType): TextStyle {
  const map: Record<DocumentType, string> = {
    'invoice':         'invoiceTableHeader',
    'estimate':        'estimateTableHeader',
    'credit-note':     'creditNoteTableHeader',
    'purchase-order':  'purchaseTableHeader',
    'bill':            'billTableHeader',
    'expense':         'expenseTableHeader',
    'supplier-credit': 'supplierCreditTableHeader',
  };
  return (t.transactionalDetailsCustomization[map[type]] as TextStyle | undefined)
       ?? (t.transactionalDetailsCustomization['invoiceTableHeader'] as TextStyle);
}

export function getTableLines(t: DocumentTemplate, type: DocumentType): TextStyle {
  const map: Record<DocumentType, string> = {
    'invoice':         'invoicLines',
    'estimate':        'estimateLines',
    'credit-note':     'creditNoteLines',
    'purchase-order':  'purchaseLines',
    'bill':            'billLines',
    'expense':         'expenseLines',
    'supplier-credit': 'supplierCreditLines',
  };
  return (t.transactionalDetailsCustomization[map[type]] as TextStyle | undefined)
       ?? (t.transactionalDetailsCustomization['invoicLines'] as TextStyle);
}

// ────────────────────────────────────────────────────────────────────
// Table columns
// ────────────────────────────────────────────────────────────────────
export interface TableColumn {
  show:        boolean;
  width:       number;
  label:       string;
  /** Translation lives on the wire as `{ ar, en }` — kept loose so
   *  the legacy `Translation` class round-trips without coupling to
   *  the i18n module here. */
  translation: { ar?: string; en?: string; [k: string]: string | undefined };
}
export const DEFAULT_TABLE_COLUMN = (overrides: Partial<TableColumn> = {}): TableColumn => ({
  show: true, width: 0, label: '', translation: {}, ...overrides,
});

export interface TableCustomization {
  order:           TableColumn;
  description:     TableColumn;
  product:         TableColumn;
  qty:             TableColumn;
  price:           TableColumn;
  taxPercantage:   TableColumn;        // legacy typo
  tax:             TableColumn;
  discount:        TableColumn;
  amount:          TableColumn;
  total:           TableColumn;
  expense:         TableColumn;
  uom:             TableColumn;
  unitCost:        TableColumn;
  [key: string]:   TableColumn;
}
export const DEFAULT_TABLE = (): TableCustomization => ({
  order:         DEFAULT_TABLE_COLUMN({ width: 5,  label: '#'           }),
  description:   DEFAULT_TABLE_COLUMN({ width: 30, label: 'Description' }),
  product:       DEFAULT_TABLE_COLUMN(),
  qty:           DEFAULT_TABLE_COLUMN({ width: 10, label: 'Qty'         }),
  price:         DEFAULT_TABLE_COLUMN({ width: 10, label: 'Price'       }),
  taxPercantage: DEFAULT_TABLE_COLUMN({ width: 10, label: 'Tax %'       }),
  tax:           DEFAULT_TABLE_COLUMN({ width: 10, label: 'Tax'         }),
  discount:      DEFAULT_TABLE_COLUMN({ width: 10, label: 'Discount'    }),
  amount:        DEFAULT_TABLE_COLUMN({ width: 10, label: 'Amount'      }),
  total:         DEFAULT_TABLE_COLUMN(),
  expense:       DEFAULT_TABLE_COLUMN(),
  uom:           DEFAULT_TABLE_COLUMN(),
  unitCost:      DEFAULT_TABLE_COLUMN(),
});

// ────────────────────────────────────────────────────────────────────
// Total section
// ────────────────────────────────────────────────────────────────────
export interface TotalTable {
  show:            boolean;
  backgroundColor: string;
  itemTotal:       TextStyle;
  taxTotal:        TextStyle;
  discount:        TextStyle;
  charge:          TextStyle;
  delevary:        TextStyle;     // legacy typo — keep
  Total:           TextStyle;     // intentional capital-T
  subTotal:        TextStyle;
  roundingTotal:   TextStyle;
}
export const DEFAULT_TOTAL_TABLE = (): TotalTable => ({
  show: true, backgroundColor: 'white',
  itemTotal:     DEFAULT_TEXT_STYLE({ size: 10 }),
  taxTotal:      DEFAULT_TEXT_STYLE({ size: 10 }),
  discount:      DEFAULT_TEXT_STYLE({ size: 10 }),
  charge:        DEFAULT_TEXT_STYLE({ size: 10 }),
  delevary:      DEFAULT_TEXT_STYLE({ size: 10 }),
  Total:         DEFAULT_TEXT_STYLE({ size: 10, bold: true }),
  subTotal:      DEFAULT_TEXT_STYLE({ size: 10, show: false }),
  roundingTotal: DEFAULT_TEXT_STYLE({ size: 10 }),
});

export interface PaymentTable {
  show:            boolean;
  backgroundColor: string;
  payments:        TextStyle;
  paymentMethods:  TextStyle;
  credit:          TextStyle;
  balance:         TextStyle;
}
export const DEFAULT_PAYMENT_TABLE = (): PaymentTable => ({
  show: true, backgroundColor: '#f1b44c',
  payments:       DEFAULT_TEXT_STYLE({ size: 10 }),
  paymentMethods: DEFAULT_TEXT_STYLE({ size: 10 }),
  credit:         DEFAULT_TEXT_STYLE({ size: 10 }),
  balance:        DEFAULT_TEXT_STYLE({ size: 10 }),
});

export interface CustomerBalance {
  show:            boolean;
  backgroundColor: string;
  balance:         TextStyle;
}
export const DEFAULT_CUSTOMER_BALANCE = (): CustomerBalance => ({
  show: true, backgroundColor: '#f1b44c',
  balance: DEFAULT_TEXT_STYLE({ size: 10 }),
});

export interface TotalSectionCustomization {
  totalTable:      TotalTable;
  paymentTable:    PaymentTable;
  customerBalance: CustomerBalance;
}
export const DEFAULT_TOTAL_SECTION = (): TotalSectionCustomization => ({
  totalTable:      DEFAULT_TOTAL_TABLE(),
  paymentTable:    DEFAULT_PAYMENT_TABLE(),
  customerBalance: DEFAULT_CUSTOMER_BALANCE(),
});

// ────────────────────────────────────────────────────────────────────
// New (phase 2) — Designer + additional data + custom elements
// ────────────────────────────────────────────────────────────────────
/** Template-level extras not tied to a record (legal disclaimers,
 *  regional notes, alternate-language boilerplate). Available in the
 *  Designer data picker as `{{additional.<key>}}`. */
export interface AdditionalDataField {
  key:      string;
  label:    string;
  value:    string;
  show:     boolean;
  position: 'header' | 'meta' | 'footer';
}

/** Custom inline element added from the Classic palette ("Add
 *  Element" tab) — supplements the structured Classic sections.
 *  Phase 1 stores the array as-is; the Classic renderer in phase 1
 *  ignores it (legacy paper component doesn't know about it).
 *  Phase 2's Classic renderer will project these into the right
 *  position. */
export interface CustomElement {
  id:        string;
  type:      string;            // 'Text' | 'Data Field' | 'Image' | …
  position:  'header' | 'meta' | 'body' | 'footer';
  [key: string]: unknown;
}

/** A single absolute-positioned designer element. The shape covers
 *  every type in the palette (Text / Data Field / Image / Table /
 *  Shape / Barcode / QR Code / Signature / Page #). Most properties
 *  are optional and per-type; the canvas renderer & inspector check
 *  `type` and only surface the relevant ones.
 *
 *  Coordinates / dimensions are in CSS pixels relative to the paper.
 *  `1cm = 37.8px` at 96 DPI — the canvas converts on the way out. */
export interface DesignerElement {
  id:           number | string;
  type:         string;
  x:            number;
  y:            number;
  w:            number;
  h:            number;
  rotation?:    number;
  opacity?:     number;
  hidden?:      boolean;
  locked?:      boolean;
  // Text / Data Field / Page # / Barcode / Signature / Image-label
  content?:     string;
  color?:       string;
  size?:        number;
  bold?:        boolean;
  italic?:      boolean;
  underline?:   boolean;
  align?:       'left' | 'center' | 'right';
  // Data Field
  path?:        string;
  format?:      string;
  prefix?:      string;
  suffix?:      string;
  // Shape
  shapeKind?:   'rect' | 'circle' | 'hline' | 'vline';
  bg?:          string;
  stroke?:      string;
  strokeWidth?: number;
  radius?:      number;
  // Image
  src?:         string;
  // Table
  headers?:     string[];
  rows?:        string[][];
  headerBg?:    string;
  headerColor?: string;
  striped?:     boolean;
  bindTo?:      string;        // bind to a data array (e.g. 'lines')
  // Page #
  current?:     number;
  total?:       number;
  // Allow any forward-compat extras
  [key: string]: unknown;
}

// ────────────────────────────────────────────────────────────────────
// Top-level template
// ────────────────────────────────────────────────────────────────────
export interface DocumentTemplate {
  /** Server id (empty for new templates). */
  id:                                 string;
  templateName:                       string;
  documentType:                       DocumentType;
  selectedPaperOrientation:           string;     // 'portrait' | 'landscape'
  selectedPaperSize:                  string;     // 'A4' | 'A5' | 'Letter'
  textColor:                          string;
  textSize:                           number;
  BackgroundColor:                    string;     // legacy capital-B
  margins:                            Margins;
  headerCustomization:                HeaderCustomization;
  footerCustomization:                FooterCustomization;
  transactionalDetailsCustomization:  TransactionalDetails;
  tableCustomization:                 TableCustomization;
  totalSectionCustomization:          TotalSectionCustomization;

  // ─── Phase 2 additions (always present, default-empty) ─────────
  /** Which renderer the view/print page should use. Defaults to
   *  `'classic'` so existing templates render unchanged. */
  renderMode:                         RenderMode;
  /** Template-level extras (legal disclaimer, regional note, …). */
  additionalData:                     AdditionalDataField[];
  /** Shared TextStyle applied to every `additionalData` row when
   *  rendered. The Other-Details panel's Layout sub-tab edits this
   *  one style; per-row overrides aren't supported (simpler model
   *  + matches the legacy `ov` view). */
  additionalDataStyle:                TextStyle;
  /** Custom inline elements added from the Classic Add Element tab. */
  customElements:                     CustomElement[];
  /** Absolute-positioned designer elements (phase 2). Empty for
   *  Classic templates. */
  designerElements:                   DesignerElement[];
  /** Whether this template is the default for its `documentType`.
   *  Exactly one default per `(company, type)`; all entity view /
   *  print pages render the default unless the user explicitly picks
   *  another template. */
  isDefault:                          boolean;
}

export const DEFAULT_TEMPLATE = (documentType: DocumentType = 'invoice'): DocumentTemplate => ({
  id:                                '',
  templateName:                      '',
  documentType,
  selectedPaperOrientation:          'portrait',
  selectedPaperSize:                 'A4',
  textColor:                         '#495057',
  textSize:                          10,
  BackgroundColor:                   '#ffffff',
  margins:                           DEFAULT_MARGINS(),
  headerCustomization:               DEFAULT_HEADER(),
  footerCustomization:               DEFAULT_FOOTER(),
  transactionalDetailsCustomization: DEFAULT_TRANSACTIONAL(documentType),
  tableCustomization:                DEFAULT_TABLE(),
  totalSectionCustomization:         DEFAULT_TOTAL_SECTION(),
  renderMode:                        'classic',
  additionalData:                    [],
  additionalDataStyle:               DEFAULT_TEXT_STYLE({ size: 10 }),
  customElements:                    [],
  designerElements:                  [],
  isDefault:                         false,
});

// ────────────────────────────────────────────────────────────────────
// Parser — round-trip with the legacy `ParseJson` so existing saved
// templates load identically.
// ────────────────────────────────────────────────────────────────────
type AnyJson = Record<string, unknown>;

const isObj = (v: unknown): v is AnyJson =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function mergeText(into: TextStyle, raw: unknown): TextStyle {
  if (!isObj(raw)) return into;
  const out = { ...into };
  for (const k of Object.keys(raw)) {
    if (k in out) (out as unknown as AnyJson)[k] = raw[k];
  }
  return out;
}

/** Coerce a raw JSON entry into a `CustomFieldStyle`. Returns null
 *  for shapes that aren't recoverable (e.g. missing `abbr`). The
 *  parser uses this to be tolerant of legacy shapes — older saves
 *  may have stored the entry as a flat TextStyle keyed by name. */
function coerceCustomFieldStyle(raw: unknown): CustomFieldStyle | null {
  if (!isObj(raw)) return null;
  const abbr = typeof raw['abbr'] === 'string' ? raw['abbr'] :
               typeof raw['key']  === 'string' ? raw['key']  : null;
  if (!abbr) return null;
  const name = typeof raw['name'] === 'string' ? raw['name'] : abbr;
  // Style may live nested under `style`, or splatted at the top
  // level — accept either to round-trip both shapes.
  const styleRaw = isObj(raw['style']) ? raw['style'] : raw;
  const style = mergeText(DEFAULT_TEXT_STYLE({ size: 10 }), styleRaw);
  return { abbr, name, style };
}

function mergeColumn(into: TableColumn, raw: unknown): TableColumn {
  if (!isObj(raw)) return into;
  const out = { ...into };
  for (const k of Object.keys(raw)) {
    if (k === 'translation' && isObj(raw[k])) {
      out.translation = { ...out.translation, ...(raw[k] as AnyJson) } as TableColumn['translation'];
    } else if (k in out) {
      (out as unknown as AnyJson)[k] = raw[k];
    }
  }
  return out;
}

/** Deserialize a server JSON blob into a `DocumentTemplate`. Unknown
 *  fields in `raw` are dropped; missing fields fall back to defaults
 *  for the given document type. */
export function parseTemplate(raw: AnyJson, fallbackType: DocumentType = 'invoice'): DocumentTemplate {
  const documentType = (raw['documentType'] as DocumentType) || fallbackType;
  const out = DEFAULT_TEMPLATE(documentType);

  // Top-level scalars
  for (const k of [
    'id', 'templateName', 'selectedPaperOrientation', 'selectedPaperSize',
    'textColor', 'textSize', 'BackgroundColor', 'renderMode',
  ] as const) {
    if (raw[k] !== undefined) (out as unknown as AnyJson)[k] = raw[k];
  }

  // Margins
  if (isObj(raw['margins'])) {
    out.margins = { ...out.margins, ...(raw['margins'] as AnyJson) } as Margins;
  }

  // Header
  if (isObj(raw['headerCustomization'])) {
    const h = raw['headerCustomization'] as AnyJson;
    if (isObj(h['logo']))       out.headerCustomization.logo       = { ...out.headerCustomization.logo,       ...(h['logo']       as AnyJson) } as CompanyLogo;
    if (isObj(h['visibility'])) out.headerCustomization.visibility = { ...out.headerCustomization.visibility, ...(h['visibility'] as AnyJson) } as Visibility;
    for (const k of ['companyName', 'vatNumber', 'title', 'name', 'address', 'phone'] as const) {
      out.headerCustomization[k] = mergeText(out.headerCustomization[k], h[k]);
    }
    if (Array.isArray(h['customFields'])) {
      out.headerCustomization.customFields = (h['customFields'] as AnyJson[])
        .map((e) => coerceCustomFieldStyle(e))
        .filter((e): e is CustomFieldStyle => e !== null);
    }
  }

  // Footer
  if (isObj(raw['footerCustomization'])) {
    const f = raw['footerCustomization'] as AnyJson;
    if (isObj(f['visibility'])) out.footerCustomization.visibility = { ...out.footerCustomization.visibility, ...(f['visibility'] as AnyJson) } as Visibility;
    for (const k of ['noteTitle', 'note', 'customerNote', 'term'] as const) {
      out.footerCustomization[k] = mergeText(out.footerCustomization[k], f[k]);
    }
    if (isObj(f['pageNumber'])) {
      const pn = f['pageNumber'] as AnyJson;
      out.footerCustomization.pageNumber = {
        show:     pn['show'] === true,
        position: (pn['position'] === 'left' || pn['position'] === 'center' || pn['position'] === 'right')
                    ? pn['position']
                    : 'right',
      };
    }
  }

  // Transactional — merge each TextStyle field by name. Unknown keys
  // are kept verbatim (forward-compatible with new fields shipped
  // server-side ahead of the client).
  if (isObj(raw['transactionalDetailsCustomization'])) {
    const td = raw['transactionalDetailsCustomization'] as AnyJson;
    for (const k of Object.keys(td)) {
      if (k === 'customFields') {
        if (Array.isArray(td[k])) {
          out.transactionalDetailsCustomization.customFields = (td[k] as AnyJson[])
            .map((e) => coerceCustomFieldStyle(e))
            .filter((e): e is CustomFieldStyle => e !== null);
        }
        continue;
      }
      const existing = out.transactionalDetailsCustomization[k] as TextStyle | undefined;
      if (existing && typeof existing === 'object' && 'show' in existing) {
        out.transactionalDetailsCustomization[k] = mergeText(existing, td[k]);
      } else if (isObj(td[k])) {
        // Field not pre-seeded — accept it as a raw TextStyle.
        out.transactionalDetailsCustomization[k] = mergeText(DEFAULT_TEXT_STYLE({ size: 10 }), td[k]);
      }
    }
  }

  // Table columns
  if (isObj(raw['tableCustomization'])) {
    const tc = raw['tableCustomization'] as AnyJson;
    for (const k of Object.keys(out.tableCustomization)) {
      out.tableCustomization[k] = mergeColumn(out.tableCustomization[k], tc[k]);
    }
    // Unknown columns ship verbatim
    for (const k of Object.keys(tc)) {
      if (!(k in out.tableCustomization) && isObj(tc[k])) {
        out.tableCustomization[k] = mergeColumn(DEFAULT_TABLE_COLUMN(), tc[k]);
      }
    }
  }

  // Total section
  if (isObj(raw['totalSectionCustomization'])) {
    const ts = raw['totalSectionCustomization'] as AnyJson;
    if (isObj(ts['totalTable'])) {
      const tt = ts['totalTable'] as AnyJson;
      out.totalSectionCustomization.totalTable.show            = (tt['show']            as boolean) ?? out.totalSectionCustomization.totalTable.show;
      out.totalSectionCustomization.totalTable.backgroundColor = (tt['backgroundColor'] as string)  ?? out.totalSectionCustomization.totalTable.backgroundColor;
      for (const k of ['itemTotal', 'taxTotal', 'discount', 'charge', 'delevary', 'Total', 'subTotal', 'roundingTotal'] as const) {
        out.totalSectionCustomization.totalTable[k] = mergeText(out.totalSectionCustomization.totalTable[k], tt[k]);
      }
    }
    if (isObj(ts['paymentTable'])) {
      const pt = ts['paymentTable'] as AnyJson;
      out.totalSectionCustomization.paymentTable.show            = (pt['show']            as boolean) ?? out.totalSectionCustomization.paymentTable.show;
      out.totalSectionCustomization.paymentTable.backgroundColor = (pt['backgroundColor'] as string)  ?? out.totalSectionCustomization.paymentTable.backgroundColor;
      for (const k of ['payments', 'paymentMethods', 'credit', 'balance'] as const) {
        out.totalSectionCustomization.paymentTable[k] = mergeText(out.totalSectionCustomization.paymentTable[k], pt[k]);
      }
    }
    if (isObj(ts['customerBalance'])) {
      const cb = ts['customerBalance'] as AnyJson;
      out.totalSectionCustomization.customerBalance.show            = (cb['show']            as boolean) ?? out.totalSectionCustomization.customerBalance.show;
      out.totalSectionCustomization.customerBalance.backgroundColor = (cb['backgroundColor'] as string)  ?? out.totalSectionCustomization.customerBalance.backgroundColor;
      out.totalSectionCustomization.customerBalance.balance         = mergeText(out.totalSectionCustomization.customerBalance.balance, cb['balance']);
    }
  }

  // Phase 2 fields — accept as-is when present. Defaults already
  // provided by `DEFAULT_TEMPLATE`.
  if (Array.isArray(raw['additionalData']))   out.additionalData   = raw['additionalData']   as AdditionalDataField[];
  if (isObj(raw['additionalDataStyle']))      out.additionalDataStyle = mergeText(out.additionalDataStyle, raw['additionalDataStyle']);
  if (Array.isArray(raw['customElements']))   out.customElements   = raw['customElements']   as CustomElement[];
  if (Array.isArray(raw['designerElements'])) out.designerElements = raw['designerElements'] as DesignerElement[];
  if (raw['renderMode'] === 'designer' || raw['renderMode'] === 'classic') {
    out.renderMode = raw['renderMode'];
  }
  if (typeof raw['isDefault'] === 'boolean') out.isDefault = raw['isDefault'];

  return out;
}

/** Serialize a template for save — strips transactional fields that
 *  don't apply to the current document type so the wire stays small.
 *  Mirrors legacy `toFilteredJSON()`. */
export function serializeTemplate(t: DocumentTemplate): AnyJson {
  // Filter transactional fields by document type
  const allowed = new Set<string>([
    ...COMMON_TRANSACTIONAL_FIELDS,
    ...DOC_TYPE_TRANSACTIONAL_FIELDS[t.documentType],
  ]);
  const filteredTransactional: TransactionalDetails = {};
  for (const k of Object.keys(t.transactionalDetailsCustomization)) {
    if (allowed.has(k) || k === 'customFields') {
      filteredTransactional[k] = t.transactionalDetailsCustomization[k];
    }
  }

  return {
    id:                                 t.id,
    templateName:                       t.templateName,
    documentType:                       t.documentType,
    selectedPaperOrientation:           t.selectedPaperOrientation,
    selectedPaperSize:                  t.selectedPaperSize,
    textColor:                          t.textColor,
    textSize:                           t.textSize,
    BackgroundColor:                    t.BackgroundColor,
    margins:                            t.margins,
    headerCustomization:                t.headerCustomization,
    footerCustomization:                t.footerCustomization,
    transactionalDetailsCustomization:  filteredTransactional,
    tableCustomization:                 t.tableCustomization,
    totalSectionCustomization:          t.totalSectionCustomization,
    // New fields go on the wire alongside — server should accept any
    // unknown JSON blob (the customizations endpoint is schemaless).
    renderMode:                         t.renderMode,
    additionalData:                     t.additionalData,
    additionalDataStyle:                t.additionalDataStyle,
    customElements:                     t.customElements,
    designerElements:                   t.designerElements,
    isDefault:                          t.isDefault,
  };
}

// ────────────────────────────────────────────────────────────────────
// List page summary (lighter than the full template)
// ────────────────────────────────────────────────────────────────────
export interface DocumentTemplateSummary {
  id:           string;
  name:         string;
  documentType: DocumentType;
  renderMode:   RenderMode;
  /** Whether this template is the default for its document type.
   *  Exactly one template per `(company, type)` can be default. The
   *  view / print pages of entities use the default unless the user
   *  explicitly picks another template. */
  isDefault:    boolean;
  updatedDate?: string;
}

// ────────────────────────────────────────────────────────────────────
// Paper-size helpers (cm)
// ────────────────────────────────────────────────────────────────────
export const PAPER_SIZES: Record<string, { portrait: [number, number]; landscape: [number, number] }> = {
  A4:     { portrait: [21,    29.7],   landscape: [29.7,  21]    },
  A5:     { portrait: [14.8,  21],     landscape: [21,    14.8]  },
  Letter: { portrait: [21.59, 27.94],  landscape: [27.94, 21.59] },
};

export function paperWidthCm(t: DocumentTemplate): number {
  const sz = PAPER_SIZES[t.selectedPaperSize] ?? PAPER_SIZES['A4'];
  return (t.selectedPaperOrientation === 'landscape' ? sz.landscape : sz.portrait)[0];
}
export function paperHeightCm(t: DocumentTemplate): number {
  const sz = PAPER_SIZES[t.selectedPaperSize] ?? PAPER_SIZES['A4'];
  return (t.selectedPaperOrientation === 'landscape' ? sz.landscape : sz.portrait)[1];
}
