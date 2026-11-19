import type { DocumentType } from '@features/settings/document-builder/services/document-template.types';
import type { DocumentRenderData } from './token-resolve';

/**
 * Per-document-type paper layout config — ports the legacy
 * `document-configs.ts` `firstColumn` / `secondColumn` /
 * `tableColumns` arrays so the paper renders with the same field
 * positions and table chrome as the legacy `unified-paper`.
 *
 * Only the bits the renderer needs at draw-time live here:
 *   - `firstColumn` / `secondColumn` — ordered list of transactional
 *     field ids per side. Maps each id to a label translation key
 *     so the renderer can look it up without per-type branching.
 *   - `tableColumns` — ordered list of column ids the items table
 *     surfaces for that doc type (filters down `tableCustomization`).
 *   - `totalFields` — ordered list of total-table row ids.
 *
 * Field metadata (required / defaultShow / editable / modelPath)
 * isn't carried here — those drove the legacy form builder; the
 * renderer doesn't care.
 */

export interface PaperFieldConfig {
  id:    string;
  /** The `transactionalDetailsCustomization` key this field's style is saved under when it differs from `id` (legacy keeps the
   *  customer / supplier VAT row of invoice, estimate, PO and bill under `vatNumber`). */
  styleKey?: string;
  label: string;       // translation key OR plain English label
  /** When true, the user can't hide the field — the visibility
   *  checkbox in the per-field editor is shown disabled. Document
   *  numbers, document dates, and the entity name are typically
   *  required so the rendered paper has unambiguous identity. */
  required?:      boolean;
  /** Initial visibility for newly-seeded templates. Defaults to
   *  `true` (i.e. fields are visible unless opted out). Existing
   *  saved templates preserve their stored `show` value regardless. */
  defaultShow?:   boolean;
  /** When `false`, the label-text override input is hidden in the
   *  per-field editor — the user can re-style the field but can't
   *  rename it. Useful for legally-prescribed labels. Defaults to
   *  `true`. */
  editable?:      boolean;
  /** Optional predicate evaluated at render time against the live
   *  document data. The renderer hides the field when the predicate
   *  returns `false`, regardless of `style.show`. Lets a doc type
   *  hide a field based on record state (e.g. a "Due Date" line
   *  could disappear once the invoice is fully paid). */
  showCondition?: (data: DocumentRenderData) => boolean;
}

/** Convenience constructor for required fields — more readable than
 *  `F(id, label, { required: true })` at every call site. */
const Fr = (id: string, label: string): PaperFieldConfig =>
  ({ id, label, required: true });

/**
 * Per-column metadata for the items table. Mirrors `PaperFieldConfig`
 * but for table columns: `defaultLabel` is the header text used when
 * the user hasn't overridden it; `defaultShow` is the initial
 * visibility for newly-seeded templates; `editable` controls whether
 * the form lets the user rename the header; `hideCondition` /
 * `showCondition` are render-time predicates for state-driven
 * visibility (e.g. hide "Tax %" when the document is bill-of-entry).
 */
export interface TableColumnConfig {
  id:           string;
  defaultLabel: string;
  defaultShow?: boolean;
  editable?:    boolean;
  showCondition?: (data: DocumentRenderData) => boolean;
  hideCondition?: (data: DocumentRenderData) => boolean;
}

/** Concise column-config constructor. Most columns ship visible and
 *  editable, so the constructor takes only the load-bearing
 *  identifiers; opt out via the second-form constructor below. */
const Tc  = (id: string, defaultLabel: string): TableColumnConfig =>
  ({ id, defaultLabel });

/** Read-only column constructor — header label can't be renamed. */
const TcLocked = (id: string, defaultLabel: string): TableColumnConfig =>
  ({ id, defaultLabel, editable: false });

/**
 * Per-document-type data-model + behaviour flags.
 *
 * Mirrors the legacy `DataModelConfig`. Holds everything that's
 * data-driven about a doc type — which fields name the document
 * number / date / due date, whether the type carries payments, what
 * the entity (customer vs supplier) is — so the rest of the builder
 * doesn't need a per-type `if`/`switch`. Adding a new doc type means
 * adding a config entry; no scattered changes.
 *
 * Most consumers read this via `getDataModel(type)` rather than
 * indexing `PAPER_LAYOUT[type].dataModel` directly.
 */
export interface DataModelConfig {
  // ── Field-name mapping (where business data lives on the record)
  documentNumberField: string;   // e.g. 'invoiceNumber'
  documentDateField:   string;   // e.g. 'invoiceDate'
  dueDateField?:       string;   // e.g. 'dueDate' (optional)
  taxTotalField:       string;   // e.g. 'invoiceTaxTotal'

  // ── Entity (customer-side vs supplier-side)
  entityType:      'customer' | 'supplier';
  entityNameField: string;       // 'customerName' or 'supplierName'
  entityIdField:   string;       // 'customerId'   or 'supplierId'

  // ── Line-shape — customer-facing docs use `price`; vendor docs
  // use `unitCost`. Drives which field the renderer reads from a line.
  linePriceField: 'price' | 'unitCost';

  // ── Behaviour flags
  hasPayments:     boolean;      // Invoice / Bill = true
  hasCredits:      boolean;      // Invoice / Bill / CN / SC = true
  hasTerms:        boolean;
  hasCompanyNote:  boolean;
  hasCustomerNote: boolean;

  // ── Template-side field ids (the table chrome lives in
  // `transactionalDetailsCustomization` keyed by these names).
  tableHeaderField: string;      // 'invoiceTableHeader', …
  tableLinesField:  string;      // 'invoicLines' (legacy typo), …
  tableVoidedField: string;      // 'invoicVoidedLines', …

  // ── Custom-fields service entity-type slug. `null` means the doc
  // type has no entity-CF scope of its own — the builder still shows
  // branch CFs but skips the entity section.
  cfEntityType: string | null;

  // ── For sample / preview data lookup — which top-level key on
  // `DocumentRenderData` carries this doc type's fields (e.g. the
  // dynamic-title hook reads `data[documentDataKey]`).
  documentDataKey: string;       // 'invoice', 'bill', 'estimate', …

  // ── Related document — used by credit-note (links to invoice) and
  // supplier-credit (links to bill). Empty string = no relation.
  relatedDocumentField:       string;
  relatedDocumentNumberField: string;
}

export interface PaperLayoutConfig {
  firstColumn:  PaperFieldConfig[];
  secondColumn: PaperFieldConfig[];
  tableColumns: TableColumnConfig[];
  totalFields:  string[];
  /** Static title shown above the field block (e.g. "TAX INVOICE").
   *  Always present; the dynamic hook below can override it per
   *  record. Plain literal — i18n is the consumer's responsibility. */
  staticTitle:  string;
  /** Optional per-record title override. The renderer calls this with
   *  the live document data and uses the returned string when it's
   *  non-empty. Lets a doc type swap the title based on state — e.g.
   *  "INVOICE — VOIDED" when `invoice.status === 'voided'`. Returning
   *  empty / null falls back to `staticTitle`. */
  getDynamicTitle?: (data: DocumentRenderData) => string | null;
  /** Data-model + behaviour flags. See `DataModelConfig`. */
  dataModel:    DataModelConfig;
}

/** Helper — returns the `DataModelConfig` for a doc type, or `null`
 *  when the type isn't registered. Centralises the lookup so callers
 *  never index `PAPER_LAYOUT[type].dataModel` directly. */
export function getDataModel(type: DocumentType): DataModelConfig | null {
  return PAPER_LAYOUT[type]?.dataModel ?? null;
}

const F = (id: string, label: string): PaperFieldConfig => ({ id, label });

/** Standard total rows (matches legacy `baseTotalFields`). */
const STANDARD_TOTAL_FIELDS = [
  'itemTotal', 'taxTotal', 'discount', 'charge', 'delevary',
  'roundingTotal', 'subTotal', 'Total',
];

/** Item-table columns surfaced for invoice / estimate / credit-note —
 *  the customer-facing trio share the same column set. */
/** Columns the legacy builder lists but hides until a template switches them on (`defaultShow: false`). */
const COL_IMAGE:   TableColumnConfig = { id: 'image',   defaultLabel: 'Image',   defaultShow: false };
const COL_BARCODE: TableColumnConfig = { id: 'barcode', defaultLabel: 'Barcode', defaultShow: false };
const insertAfter = (cols: TableColumnConfig[], afterId: string, ...add: TableColumnConfig[]): TableColumnConfig[] => {
  const at = cols.findIndex((c) => c.id === afterId);
  return at < 0 ? [...cols, ...add] : [...cols.slice(0, at + 1), ...add, ...cols.slice(at + 1)];
};

const SALES_COLUMNS: TableColumnConfig[] = [
  TcLocked('order',     '#'),
  Tc('description',     'Description'),
  Tc('qty',             'Qty'),
  Tc('price',           'Price'),
  Tc('taxPercantage',   'Tax %'),
  Tc('tax',             'Tax'),
  Tc('discount',        'Disc'),
  Tc('amount',          'Amount'),
];

/** Invoice / estimate: image after the row number, barcode after the description (legacy `tableColumns`). */
const SALES_COLUMNS_FULL: TableColumnConfig[] = insertAfter(insertAfter(SALES_COLUMNS, 'order', COL_IMAGE), 'description', COL_BARCODE);
/** Credit note: barcode after the description. */
const CREDIT_NOTE_COLUMNS: TableColumnConfig[] = insertAfter(SALES_COLUMNS, 'description', COL_BARCODE);

/** Item-table columns for purchase-order — uses `product` and
 *  `unitCost` / `total` per the legacy filter. */
const PURCHASE_COLUMNS: TableColumnConfig[] = [
  TcLocked('order',     '#'),
  Tc('product',         'Product'),
  COL_BARCODE,
  Tc('uom',             'UOM'),
  Tc('qty',             'Qty'),
  Tc('taxPercantage',   'Tax %'),
  Tc('tax',             'Tax'),
  Tc('unitCost',        'Unit Cost'),
  Tc('total',           'Amount'),
];

/** Item-table columns for bill / supplier-credit. */
const BILL_COLUMNS: TableColumnConfig[] = [
  TcLocked('order',     '#'),
  Tc('description',     'Description'),
  COL_BARCODE,
  Tc('uom',             'UOM'),
  Tc('qty',             'Qty'),
  Tc('unitCost',        'Unit Cost'),
  Tc('taxPercantage',   'Tax %'),
  Tc('tax',             'Tax'),
  Tc('discount',        'Disc'),
  Tc('total',           'Amount'),
];

/** Supplier credit (legacy): description, qty, price, tax %, tax, amount — no unit / discount columns. */
const SUPPLIER_CREDIT_COLUMNS: TableColumnConfig[] = [
  TcLocked('order',     '#'),
  Tc('description',     'Description'),
  COL_BARCODE,
  Tc('qty',             'Qty'),
  Tc('price',           'Price'),
  Tc('taxPercantage',   'Tax %'),
  Tc('tax',             'Tax'),
  Tc('amount',          'Amount'),
];

export const PAPER_LAYOUT: Record<DocumentType, PaperLayoutConfig> = {
  invoice: {
    firstColumn: [
      Fr('invNumber',         'Invoice Number'),
      Fr('customerName',      'Bill to'),
      F('customerPhone',      'Customer Phone'),
      F('customerAddress',    'Customer Address'),
      { id: 'customerVatNumber', styleKey: 'vatNumber', label: 'Customer Vat number' },
      F('salesPerson',        'Sales Person'),
    ],
    secondColumn: [
      Fr('invoiceDate',    'Invoice Date'),
      F('invoiceDueDate',  'Invoice Due Date'),
      F('createdDate',     'Created Date'),
      F('refrence',        'Reference'),
      F('service',         'Service'),
    ],
    tableColumns: SALES_COLUMNS_FULL,
    totalFields:  STANDARD_TOTAL_FIELDS,   // legacy: every total row except shipping, Sub Total included
    staticTitle:  'TAX INVOICE',
    // Dynamic title: voided / paid statuses get an explicit suffix so
    // a printed copy can't be mistaken for a live demand for payment.
    // Tax-exclusive invoices also lose the "TAX" prefix so the legal
    // wording matches the actual line treatment.
    getDynamicTitle: (data) => {
      // Legacy: a tax invoice when any line carries a tax, a plain invoice otherwise (the status shows in the ribbon).
      const lines = Array.isArray(data['lines']) ? (data['lines'] as Array<Record<string, unknown>>) : [];
      return lines.some((l) => !!l['taxId']) ? 'Tax Invoice' : 'Invoice';
    },
    dataModel: {
      documentNumberField: 'invoiceNumber',
      documentDateField:   'invoiceDate',
      dueDateField:        'dueDate',
      taxTotalField:       'invoiceTaxTotal',
      entityType:          'customer',
      entityNameField:     'customerName',
      entityIdField:       'customerId',
      linePriceField:      'price',
      hasPayments:         true,
      hasCredits:          true,
      hasTerms:            true,
      hasCompanyNote:      true,
      hasCustomerNote:     true,
      tableHeaderField:    'invoiceTableHeader',
      tableLinesField:     'invoicLines',
      tableVoidedField:    'invoicVoidedLines',
      cfEntityType:        'invoice',
      documentDataKey:     'invoice',
      relatedDocumentField:       '',
      relatedDocumentNumberField: '',
    },
  },

  estimate: {
    firstColumn: [
      Fr('estimateNumber',    'Estimate Number'),
      Fr('customerName',      'Bill to'),
      F('customerAddress',    'Customer Address'),
      { id: 'customerVatNumber', styleKey: 'vatNumber', label: 'Customer Vat number' },
      F('salesPerson',        'Sales Person'),
    ],
    secondColumn: [
      Fr('estimateDate',    'Estimate Date'),
      F('estimateExpDate',  'Estimate Expiry Date'),
      F('createdDate',      'Created Date'),
      F('refrence',         'Reference'),
    ],
    tableColumns: SALES_COLUMNS_FULL,
    // Legacy estimate totals: items, tax, total, charge, delivery, discount, rounding — no separate sub-total row.
    totalFields:  STANDARD_TOTAL_FIELDS.filter((f) => f !== 'subTotal'),
    staticTitle:  'Estimate',
    dataModel: {
      documentNumberField: 'estimateNumber',
      documentDateField:   'estimateDate',
      dueDateField:        'estimateExpDate',
      taxTotalField:       'estimateTaxTotal',
      entityType:          'customer',
      entityNameField:     'customerName',
      entityIdField:       'customerId',
      linePriceField:      'price',
      hasPayments:         false,
      hasCredits:          false,
      hasTerms:            false,
      hasCompanyNote:      false,
      hasCustomerNote:     true,
      tableHeaderField:    'estimateTableHeader',
      tableLinesField:     'estimateLines',
      tableVoidedField:    'estimateVoidedLines',
      cfEntityType:        'estimate',
      documentDataKey:     'estimate',
      relatedDocumentField:       '',
      relatedDocumentNumberField: '',
    },
  },

  'credit-note': {
    firstColumn: [
      Fr('creditNoteNumber',  'Credit Note Number'),
      Fr('customerName',      'Bill to'),
      F('customerPhone',      'Customer Phone'),
      F('customerAddress',    'Customer Address'),
      F('customerVatNumber',  'Customer Vat number'),
      Fr('originalInvoice',   'Original Invoice'),
    ],
    secondColumn: [
      Fr('creditNoteDate', 'Credit Note Date'),
      F('createdDate',     'Created Date'),
      F('refrence',        'Reference'),
    ],
    tableColumns: CREDIT_NOTE_COLUMNS,
    totalFields:  STANDARD_TOTAL_FIELDS,
    staticTitle:  'Credit Note',
    dataModel: {
      documentNumberField: 'creditNoteNumber',
      documentDateField:   'creditNoteDate',
      taxTotalField:       'creditNoteTaxTotal',
      entityType:          'customer',
      entityNameField:     'customerName',
      entityIdField:       'customerId',
      linePriceField:      'price',
      hasPayments:         false,
      hasCredits:          true,
      hasTerms:            false,
      hasCompanyNote:      false,
      hasCustomerNote:     false,
      tableHeaderField:    'creditNoteTableHeader',
      tableLinesField:     'creditNoteLines',
      tableVoidedField:    'creditNoteVoidedLines',
      // Credit notes piggyback on the invoice CF scope in the legacy
      // app — the entity scope of its own isn't exposed by the CF
      // service, so we hide the entity-CF section for this type.
      cfEntityType:        'creditNote',
      documentDataKey:     'creditNote',
      relatedDocumentField:       'invoiceId',
      relatedDocumentNumberField: 'invoiceNumber',
    },
  },

  'purchase-order': {
    firstColumn: [
      Fr('purchaseOrderNumber', 'Purchase Number'),
      Fr('supplierName',        'Supplier Name'),
      { id: 'supplierVatNumber', styleKey: 'vatNumber', label: 'VAT Number' },
    ],
    secondColumn: [
      Fr('purchaseOrderDate',        'Issue Date'),
      F('purchaseOrderExpiryDate',   'Expiry Date'),
      F('createdDate',               'Created Date'),
    ],
    tableColumns: PURCHASE_COLUMNS,
    totalFields:  ['subTotal', 'taxTotal', 'Total'],
    staticTitle:  'Purchase Order',
    dataModel: {
      documentNumberField: 'purchaseOrderNumber',
      documentDateField:   'purchaseOrderDate',
      dueDateField:        'expectedDeliveryDate',
      taxTotalField:       'purchaseTaxTotal',
      entityType:          'supplier',
      entityNameField:     'supplierName',
      entityIdField:       'supplierId',
      linePriceField:      'unitCost',
      hasPayments:         false,
      hasCredits:          false,
      hasTerms:            false,
      hasCompanyNote:      false,
      hasCustomerNote:     false,
      tableHeaderField:    'purchaseTableHeader',
      tableLinesField:     'purchaseLines',
      tableVoidedField:    'purchaseVoidedLines',
      cfEntityType:        'purchaseOrder',
      documentDataKey:     'purchaseOrder',
      relatedDocumentField:       '',
      relatedDocumentNumberField: '',
    },
  },

  bill: {
    firstColumn: [
      Fr('billNumber',        'Bill Number'),
      Fr('supplierName',      'Supplier Name'),
      { id: 'supplierVatNumber', styleKey: 'vatNumber', label: 'VAT Number' },
    ],
    secondColumn: [
      Fr('billDate',        'Issue Date'),
      F('billDueDate',      'Due Date'),
      F('createdDate',      'Created Date'),
      F('refrence',         'Reference'),
    ],
    tableColumns: BILL_COLUMNS,
    totalFields:  ['itemTotal', 'taxTotal', 'discount', 'Total'],
    staticTitle:  'Bill',
    dataModel: {
      documentNumberField: 'billNumber',
      documentDateField:   'billDate',
      dueDateField:        'billDueDate',
      taxTotalField:       'billTaxTotal',
      entityType:          'supplier',
      entityNameField:     'supplierName',
      entityIdField:       'supplierId',
      linePriceField:      'unitCost',
      hasPayments:         true,
      hasCredits:          true,
      hasTerms:            false,
      hasCompanyNote:      false,
      hasCustomerNote:     true,
      tableHeaderField:    'billTableHeader',
      tableLinesField:     'billLines',
      tableVoidedField:    'billVoidedLines',
      cfEntityType:        'bill',
      documentDataKey:     'bill',
      relatedDocumentField:       '',
      relatedDocumentNumberField: '',
    },
  },

  expense: {
    firstColumn: [
      Fr('expenseNumber',    'Expense Number'),
      F('customerName',      'Customer'),
      F('supplierName',      'Supplier Name'),
      F('employeeName',      'Employees'),
      F('paymentMethodName', 'Payment Method'),
    ],
    secondColumn: [
      Fr('expenseDate', 'Expense Date'),
      F('createdDate',  'Created Date'),
    ],
    // Legacy expense table: the expense account, its amount, tax % / tax and the line total.
    tableColumns: [
      Tc('expense',       'Expense'),
      Tc('amount',        'Amount'),
      Tc('taxPercantage', 'Tax %'),
      Tc('tax',           'Tax'),
      Tc('total',         'Total'),
    ],
    totalFields:  ['Total'],
    staticTitle:  'Expense',
    dataModel: {
      documentNumberField: 'expenseNumber',
      documentDateField:   'expenseDate',
      taxTotalField:       'expenseTaxTotal',
      entityType:          'supplier',
      entityNameField:     'supplierName',
      entityIdField:       'supplierId',
      linePriceField:      'unitCost',
      hasPayments:         false,
      hasCredits:          false,
      hasTerms:            false,
      hasCompanyNote:      false,
      hasCustomerNote:     true,
      tableHeaderField:    'expenseTableHeader',
      tableLinesField:     'expenseLines',
      tableVoidedField:    'expenseVoidedLines',
      cfEntityType:        'expense',
      documentDataKey:     'expense',
      relatedDocumentField:       '',
      relatedDocumentNumberField: '',
    },
  },

  'supplier-credit': {
    firstColumn: [
      Fr('supplierCreditNumber', 'Supplier Credit Number'),
      Fr('supplierName',         'Supplier'),
      F('supplierPhone',         'Supplier Phone'),
      F('supplierAddress',       'Supplier Address'),
      F('supplierVatNumber',     'Supplier VAT'),
      Fr('originalBill',         'Original Bill'),
    ],
    secondColumn: [
      Fr('supplierCreditDate', 'Supplier Credit Date'),
      F('refrence',            'Reference'),
    ],
    tableColumns: SUPPLIER_CREDIT_COLUMNS,
    totalFields:  STANDARD_TOTAL_FIELDS,
    staticTitle:  'Supplier Credit',
    dataModel: {
      documentNumberField: 'supplierCreditNumber',
      documentDateField:   'supplierCreditDate',
      taxTotalField:       'supplierCreditTaxTotal',
      entityType:          'supplier',
      entityNameField:     'supplierName',
      entityIdField:       'supplierId',
      linePriceField:      'unitCost',
      hasPayments:         false,
      hasCredits:          true,
      hasTerms:            false,
      hasCompanyNote:      false,
      hasCustomerNote:     false,
      tableHeaderField:    'supplierCreditTableHeader',
      tableLinesField:     'supplierCreditLines',
      tableVoidedField:    'supplierCreditVoidedLines',
      // Supplier credits piggyback on bill in the legacy CF service —
      // no entity scope of its own.
      cfEntityType:        'supplierCredit',
      documentDataKey:     'supplierCredit',
      relatedDocumentField:       'billId',
      relatedDocumentNumberField: 'billNumber',
    },
  },
};

/** `(docType, fieldId)` → token used to resolve the field's value
 *  against the sample data. Values are flat — same shape entity view
 *  pages produce when they project their record into
 *  `DocumentRenderData`. */
export const FIELD_TOKEN: Record<string, string> = {
  // doc numbers
  invNumber:               '{{invoice.number}}',
  estimateNumber:          '{{invoice.number}}',
  creditNoteNumber:        '{{invoice.number}}',
  purchaseOrderNumber:     '{{invoice.number}}',
  billNumber:              '{{invoice.number}}',
  expenseNumber:           '{{invoice.number}}',
  supplierCreditNumber:    '{{invoice.number}}',
  // dates
  invoiceDate:             '{{invoice.date}}',
  invoiceDueDate:          '{{invoice.dueDate}}',
  estimateDate:            '{{invoice.date}}',
  estimateExpDate:         '{{invoice.dueDate}}',
  creditNoteDate:          '{{invoice.date}}',
  purchaseOrderDate:       '{{invoice.date}}',
  purchaseOrderExpiryDate: '{{invoice.dueDate}}',
  expectedDeliveryDate:    '{{invoice.dueDate}}',
  billDate:                '{{invoice.date}}',
  billDueDate:             '{{invoice.dueDate}}',
  expenseDate:             '{{invoice.date}}',
  supplierCreditDate:      '{{invoice.date}}',
  createdDate:             '{{invoice.createdDate}}',
  // refs
  refrence:                '{{invoice.reference}}',
  originalInvoice:         '{{invoice.original}}',
  originalBill:            '{{invoice.original}}',
  purchaseOrder:           '{{invoice.reference}}',
  vendorBillNumber:        '{{invoice.reference}}',
  // customer
  customerName:            '{{customer.name}}',
  customerPhone:           '{{customer.phone}}',
  customerAddress:         '{{customer.address}}',
  customerVatNumber:       '{{customer.vat}}',
  vatNumber:               '{{customer.vat}}',
  // supplier
  supplierName:            '{{supplier.name}}',
  supplierPhone:           '{{supplier.phone}}',
  supplierAddress:         '{{supplier.address}}',
  supplierVatNumber:       '{{supplier.vat}}',
  // people
  salesPerson:             '{{invoice.salesRep}}',
  employeeName:            '{{invoice.salesRep}}',
  service:                 '{{invoice.service}}',
  // expense
  paymentMethodName:       '{{invoice.paymentMethod}}',
  paidThrough:             'Main Account',
};

/** Look up a field's `PaperFieldConfig` for a given doc type. Searches
 *  `firstColumn` then `secondColumn`. Returns `null` for fields that
 *  aren't laid out in either column — typically table chrome ids
 *  (`*TableHeader`, `*Lines`, `*VoidedLines`) which live on the same
 *  TextStyle map but aren't rendered as configurable fields.
 *  Both the form (for `required` / `editable` semantics) and the
 *  renderer (for `showCondition`) read through this helper. */
export function getFieldConfig(type: DocumentType, id: string): PaperFieldConfig | null {
  const layout = PAPER_LAYOUT[type];
  if (!layout) return null;
  const all = [...layout.firstColumn, ...layout.secondColumn];
  return all.find((f) => (f.styleKey ?? f.id) === id) ?? all.find((f) => f.id === id) ?? null;
}

/** Look up a table-column's `TableColumnConfig` for a given doc type.
 *  The form and the renderer both read this for `defaultLabel`,
 *  `editable`, and the `show`/`hideCondition` predicates. */
export function getColumnConfig(type: DocumentType, id: string): TableColumnConfig | null {
  return PAPER_LAYOUT[type]?.tableColumns.find((c) => c.id === id) ?? null;
}
