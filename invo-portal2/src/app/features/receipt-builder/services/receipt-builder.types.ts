// ── Receipt builder domain types ─────────────────────────────────────────
//
// A `ReceiptTemplate` is an ordered list of print elements that the
// POS feeds through a thermal printer. Two flavours: the customer
// receipt (`recieptType`) and the kitchen ticket (`kitchen`). Both
// share the same element vocabulary; only the source bindings (which
// invoice / order field a given Text or QR pulls from) differ.
//
// The legacy uses a single fat `recieptTemplate: any[]` field with a
// discriminated union via `obj.type`. We keep the same wire shape but
// surface a typed `PrintElement` union so call sites get autocomplete
// without `any` casts. Slice 1 only needs the list summary + the
// template envelope; the full element schemas land in slice 2 (form).
// ──────────────────────────────────────────────────────────────────────────

/**
 * The two template flavours the POS supports. The wire uses these
 * exact strings.
 *   - `recieptType` — customer-facing sales receipt
 *   - `kitchen`     — kitchen ticket sent to back-of-house printers
 *
 * (Yes, the spelling `recieptType` matches the legacy schema. We
 * normalise it to a tagged union here but keep the wire string
 * unchanged so existing rows round-trip cleanly.)
 */
export type TemplateType = 'recieptType' | 'kitchen';

/** Discriminator string the legacy `parseType` switch reads. */
export type PrintElementType =
  | 'SideText'
  | 'Text'
  | 'Line'
  | 'Logo'
  | 'Image'
  | 'Spacer'
  | 'QrCode'
  | 'Barcode'
  | 'Table';

/**
 * Per-element field shapes. Mirrors the legacy
 * `core/models/receipt-builder/*.ts` model classes — fields kept in
 * the same order, with the same wire keys, so existing templates
 * round-trip cleanly. Default values are applied via the factories
 * below (`makeElement(type)`).
 */
export interface PrintElementBase {
  /** Stable key for keyed @for loops; generated locally when an
   *  element has no server id yet. Empty string for new elements. */
  id?: string;
  type: PrintElementType;
  /** Stable client-only id used by CDK drag's `track` and the
   *  selection signal. Set by `makeElement` / `parseElements`. */
  __key?: string;
}

export interface SideTextElement extends PrintElementBase {
  type: 'SideText';
  leftText: string;
  rightText: string;
  leftTextAlign:  'Left' | 'Center' | 'Right';
  rightTextAlign: 'Left' | 'Center' | 'Right';
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle:  'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  visibility: 'Visible' | 'Hidden';
  condition: { data: string; equals: string };
  toggleVisible: string;
}

export interface TextElement extends PrintElementBase {
  type: 'Text';
  value: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle:  'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  alignment: 'Left' | 'Center' | 'Right';
  visibility: 'Visible' | 'Hidden';
  condition: { data: string; equals: string };
  toggleVisible: string;
}

export interface LineElement extends PrintElementBase {
  type: 'Line';
  style: 'solid' | 'dashed' | 'dotted';
  paddingHorizontal: number;
  paddingVertical: number;
}

export interface LogoElement extends PrintElementBase {
  type: 'Logo';
  data: string;
  width: number;
  height: number;
  alignment: 'left' | 'center' | 'right';
  originalWidth: number;
  originalHeight: number;
}

export interface ImageElement extends PrintElementBase {
  type: 'Image';
  data: string;
  width: number;
  height: number;
  alignment: 'left' | 'center' | 'right';
  path: string;
}

export interface SpacerElement extends PrintElementBase {
  type: 'Spacer';
  height: number;
  paddingHorizontal: number;
  paddingVertical: number;
}

export interface QrCodeElement extends PrintElementBase {
  type: 'QrCode';
  value: string;
  size: number;
  visibility: 'Visible' | 'Hidden';
  condition: { data: string; equals: string };
}

export interface BarcodeElement extends PrintElementBase {
  type: 'Barcode';
  value: string;
  height: number;
  visibility: 'Visible' | 'Hidden';
  condition: { data: string; equals: string };
}

/** One column in a Table row. The legacy class is
 *  `ReceiptTableCell` — we keep the same wire keys verbatim so existing
 *  templates round-trip cleanly.
 *
 *  - `key`        — binding path, e.g. `qty`, `product.name`,
 *                   `total.number()`. Drives the value the renderer reads
 *                   from each invoice line at print time.
 *  - `value`      — display label (header text, or a string template).
 *  - `width`      — percentage 0..100 of the row's width. Hidden cells
 *                   are 0; the row redistributes width across visible
 *                   cells when one is toggled.
 *  - `alignment`  — left / center / right; mixed casing on the wire.
 *  - `isVisible`  — hidden cells are kept in the model so the toggle
 *                   round-trips, but not rendered or counted toward width.
 *  - `isRequired` — cannot be removed from the row (e.g. Qty header).
 */
export interface TableCell {
  key: string;
  value: string;
  width: number;
  alignment: string;
  isVisible: boolean;
  isRequired?: boolean;
  type?: string;
  isSelected?: boolean;
  /** Stable client-only id for CDK drag tracking. Stamped by the
   *  factories / `parseElements` like `__key` on print elements. */
  __key?: string;
}

export interface TableRow {
  cells: TableCell[];
  source?: unknown;
  rowType?: 'static' | 'dynamic';
  /** Stable client-only id for the row card / drop-list pairing. */
  __key?: string;
}

export interface TableGroup {
  rows: TableRow[];
  source?: string;
  __key?: string;
}

/** Toggles specific to an `!invoice.lines` table — what extra
 *  per-line content the POS should print when expanding each line.
 *  Mirrors the legacy `ReceiptTableInvoiceLinesOptions` class on the
 *  wire so existing templates round-trip cleanly. Taxes / payments
 *  tables ignore this block. */
export interface TableInvoiceLinesOptions {
  showOptions?: boolean;
  showPrice?: boolean;
  showKitchenName?: boolean;
  showOptionName?: boolean;
  showOptionSecondaryName?: boolean;
}

/** Tables differentiate at print time by `source` — invoice lines,
 *  taxes, or payments — and the editor surfaces three separate
 *  palette tiles so adding the right one is a single click. All
 *  three serialise with the same `type: 'Table'` on the wire (the
 *  legacy `ReceiptTableInvoiceLines` / `ReceiptTableTaxes` /
 *  `ReceiptTablePayments` classes all set `type = "Table"`). */
export interface TableElement extends PrintElementBase {
  type: 'Table';
  source: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  groups: TableGroup[];
  /** Per-source options. Only `!invoice.lines` tables actually use
   *  this block; the field is optional so taxes/payments templates
   *  don't carry empty objects. */
  options?: TableInvoiceLinesOptions;
}

export type PrintElement =
  | SideTextElement
  | TextElement
  | LineElement
  | LogoElement
  | ImageElement
  | SpacerElement
  | QrCodeElement
  | BarcodeElement
  | TableElement;

/** Catalog used by the palette tray. Order matches the legacy
 *  `items` array. Kept as the underlying *type* list — useful where
 *  callers only need a discriminator string. The form's palette
 *  iterates `PALETTE_ITEMS` instead, which expands `Table` into three
 *  source-specific tiles. */
export const PALETTE_ORDER: PrintElementType[] = [
  'SideText', 'Text', 'Spacer', 'Line', 'Logo', 'Image',
  'QrCode', 'Barcode', 'Table',
];

/**
 * One palette tile in the form's left rail.
 *
 *   - `id`       — unique tile id, used by CDK drag data + tracking.
 *   - `iconId`   — drives the inline-SVG `@switch` in the form
 *                  template; same id may be shared (Logo and Image
 *                  reuse the picture glyph).
 *   - `labelKey` — i18n key relative to `RECEIPT_BUILDER.ELEMENTS.*`.
 *   - `factory`  — produces a fresh element when the tile is clicked
 *                  or dropped onto the canvas.
 *
 * Splitting Table into Lines / Taxes / Payments tiles matches the
 * legacy receipt-builder ergonomics: each variant has its own seeded
 * columns and editor options. All three still serialise as `type:
 * 'Table'`, so existing wire payloads round-trip unchanged.
 */
export interface PaletteItem {
  id: string;
  iconId: string;
  labelKey: string;
  factory: () => PrintElement;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { id: 'SideText',      iconId: 'SideText',      labelKey: 'SideText',      factory: () => makeElement('SideText') },
  { id: 'Text',          iconId: 'Text',          labelKey: 'Text',          factory: () => makeElement('Text') },
  { id: 'Spacer',        iconId: 'Spacer',        labelKey: 'Spacer',        factory: () => makeElement('Spacer') },
  { id: 'Line',          iconId: 'Line',          labelKey: 'Line',          factory: () => makeElement('Line') },
  { id: 'Logo',          iconId: 'Logo',          labelKey: 'Logo',          factory: () => makeElement('Logo') },
  { id: 'Image',         iconId: 'Image',         labelKey: 'Image',         factory: () => makeElement('Image') },
  { id: 'QrCode',        iconId: 'QrCode',        labelKey: 'QrCode',        factory: () => makeElement('QrCode') },
  { id: 'Barcode',       iconId: 'Barcode',       labelKey: 'Barcode',       factory: () => makeElement('Barcode') },
  { id: 'TableLines',    iconId: 'TableLines',    labelKey: 'TableLines',    factory: makeTableLines },
  { id: 'TableTaxes',    iconId: 'TableTaxes',    labelKey: 'TableTaxes',    factory: makeTableTaxes },
  { id: 'TablePayments', iconId: 'TablePayments', labelKey: 'TablePayments', factory: makeTablePayments },
];

let __keyCounter = 0;
function nextKey(): string { return 'el_' + (++__keyCounter).toString(36); }

/**
 * Factory: build a fresh element of `type` with legacy default
 * values. Stamps a `__key` so CDK drag / template tracking has a
 * stable identity even before the element gets a server id.
 */
export function makeElement(type: PrintElementType): PrintElement {
  switch (type) {
    case 'SideText':
      return { type, __key: nextKey(),
        leftText: '', rightText: '',
        leftTextAlign: 'Left', rightTextAlign: 'Right',
        fontSize: 30, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
        visibility: 'Visible', condition: { data: '', equals: '' }, toggleVisible: '',
      };
    case 'Text':
      return { type, __key: nextKey(),
        value: '', fontSize: 30, fontWeight: 'normal', fontStyle: 'normal',
        textDecoration: 'none', alignment: 'Center',
        visibility: 'Visible', condition: { data: '', equals: '' }, toggleVisible: '',
      };
    case 'Line':
      return { type, __key: nextKey(), style: 'solid', paddingHorizontal: 10, paddingVertical: 10 };
    case 'Logo':
      return { type, __key: nextKey(),
        data: '!preferences.logo', width: 80, height: 80,
        alignment: 'center', originalWidth: 80, originalHeight: 80,
      };
    case 'Image':
      return { type, __key: nextKey(), data: '', width: 80, height: 80, alignment: 'center', path: '' };
    case 'Spacer':
      return { type, __key: nextKey(), height: 20, paddingHorizontal: 10, paddingVertical: 10 };
    case 'QrCode':
      return { type, __key: nextKey(),
        value: 'Qr Code Content', size: 8,
        visibility: 'Visible', condition: { data: '', equals: '' },
      };
    case 'Barcode':
      return { type, __key: nextKey(),
        value: 'Barcode Content', height: 50,
        visibility: 'Visible', condition: { data: '', equals: '' },
      };
    case 'Table':
      return makeTableLines();
  }
}

// ── Table factories per source ─────────────────────────────────────────
// Three palette tiles map to distinct factories. All produce `type:
// 'Table'` on the wire; only `source` (and the seeded columns / options)
// differs. Mirrors the legacy `ReceiptTableInvoiceLines`,
// `ReceiptTableTaxes`, `ReceiptTablePayments` constructors.

/** `!invoice.lines` table — qty / tax / price header + product name +
 *  total body. Carries the `options` block (showPrice / showOptions /
 *  showKitchenName / showOptionName / showOptionSecondaryName). */
export function makeTableLines(): TableElement {
  return {
    type: 'Table', __key: nextKey(),
    source: '!invoice.lines',
    fontSize: 30, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
    groups: [{
      __key: nextKey(),
      rows: [
        { __key: nextKey(), rowType: 'static', cells: [
          { __key: nextKey(), key: 'qty.numberTrim()',        value: 'Qty',             width: 20, alignment: 'Center', isVisible: true, isRequired: true },
          { __key: nextKey(), key: 'taxPercentage',           value: 'Tax %',           width: 20, alignment: 'Center', isVisible: true },
          { __key: nextKey(), key: 'taxTotal.number()',       value: 'Tax total',       width: 20, alignment: 'Center', isVisible: true },
          { __key: nextKey(), key: 'price.number()',          value: 'Price',           width: 40, alignment: 'Center', isVisible: true },
          { __key: nextKey(), key: 'discountAmount.number()', value: 'Discount Amount', width:  0, alignment: 'Center', isVisible: false },
          { __key: nextKey(), key: 'UOM',                     value: 'UOM',             width:  0, alignment: 'Center', isVisible: false },
        ]},
        { __key: nextKey(), rowType: 'static', cells: [
          { __key: nextKey(), key: 'product.name',  value: 'Product Name', width: 60, alignment: 'left',  isVisible: true },
          { __key: nextKey(), key: 'total.number()', value: 'Total',        width: 40, alignment: 'right', isVisible: true },
        ]},
      ],
    }],
    options: {
      showOptions:             true,
      showPrice:               true,
      showKitchenName:         false,
      showOptionName:          false,
      showOptionSecondaryName: false,
    },
  };
}

/** `!invoice.taxes` table — tax name + amount, two columns. The
 *  cell.value labels are readable strings ("Name" / "Total") rather
 *  than the legacy `!name` / `!total.number()` literals (which were
 *  meant to render dynamically but ended up as plain header text in
 *  the editor preview). */
export function makeTableTaxes(): TableElement {
  return {
    type: 'Table', __key: nextKey(),
    source: '!invoice.taxes',
    fontSize: 30, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
    groups: [{
      __key: nextKey(),
      rows: [
        { __key: nextKey(), rowType: 'static', cells: [
          { __key: nextKey(), key: 'name',           value: 'Name',  width: 50, alignment: 'left',  isVisible: true },
          { __key: nextKey(), key: 'total.number()', value: 'Total', width: 50, alignment: 'right', isVisible: true },
        ]},
      ],
    }],
  };
}

/** `!invoice.payments` table — payment-method name + tender amount. */
export function makeTablePayments(): TableElement {
  return {
    type: 'Table', __key: nextKey(),
    source: '!invoice.payments',
    fontSize: 30, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
    groups: [{
      __key: nextKey(),
      rows: [
        { __key: nextKey(), rowType: 'static', cells: [
          { __key: nextKey(), key: 'paymentMethod', value: 'Method', width: 50, alignment: 'left',  isVisible: true, isRequired: true },
          { __key: nextKey(), key: 'tenderAmount',  value: 'Amount', width: 50, alignment: 'right', isVisible: true },
        ]},
      ],
    }],
  };
}

// ── Default templates per type ─────────────────────────────────────────
// When the user creates a new template the legacy receipt-builder
// seeded a long sequence of starter elements so the canvas isn't a
// blank page. We mirror that here — receipts start with the full
// company-header → invoice-info → totals → payment block; kitchen
// tickets start with the section-name → server → lines → reference
// pattern. All elements are produced through the existing factories so
// the wire shape stays identical whether the user added them via the
// palette or got them from the default seed.

/** Build the default element list for a fresh receipt template — the
 *  long form: logo, branch info, invoice header, line table, totals,
 *  taxes/payments tables, and the trailing "Paid Ticket" badge. Mirrors
 *  the legacy `setNewTemplate('reciept')` payload byte-for-byte. */
export function defaultReceiptElements(): PrintElement[] {
  // Helpers to inline the long literal — every element gets a fresh
  // `__key` and the structure-required defaults from `makeElement` so
  // we don't repeat them.
  const text = (overrides: Partial<TextElement>): TextElement =>
    ({ ...(makeElement('Text') as TextElement), ...overrides });
  const sideText = (overrides: Partial<SideTextElement>): SideTextElement =>
    ({ ...(makeElement('SideText') as SideTextElement), ...overrides });
  const line = (): LineElement => makeElement('Line') as LineElement;
  const spacer = (h = 20): SpacerElement =>
    ({ ...(makeElement('Spacer') as SpacerElement), height: h });
  const logo = (overrides: Partial<LogoElement>): LogoElement =>
    ({ ...(makeElement('Logo') as LogoElement), ...overrides });

  // Cells listed here must exist in the canonical column catalog
  // (LINES_CATALOG in element-editor) so a deleted-then-re-added
  // column round-trips cleanly. The legacy seeded `discountTotal
  // .number()` here even though that key isn't in the legacy
  // `headerCellList()` catalog — we drop it to keep rows ↔ catalog
  // consistent.
  const lines: TableElement = {
    ...makeTableLines(),
    options: { showOptions: true, showPrice: true },
    groups: [{
      __key: nextKey(),
      rows: [
        { __key: nextKey(), rowType: 'static', cells: [
          { __key: nextKey(), key: 'qty.numberTrim()',            value: 'Qty',          width: 13, alignment: 'left',   isVisible: true,  isRequired: true },
          { __key: nextKey(), key: 'product.name',                value: 'Product Name', width: 67, alignment: 'left',   isVisible: true },
          { __key: nextKey(), key: 'subTotalWithoutTax.number()', value: 'Sub Total',    width: 20, alignment: 'right',  isVisible: true },
          { __key: nextKey(), key: 'taxTotal.number()',           value: 'Tax total',    width: 16, alignment: 'Center', isVisible: false },
          { __key: nextKey(), key: 'total.number()',              value: 'Total',        width: 16, alignment: 'right',  isVisible: false },
          { __key: nextKey(), key: 'taxPercentage',               value: 'Tax %',        width: 20, alignment: 'Center', isVisible: false },
          { __key: nextKey(), key: 'price.number()',              value: 'Price',        width: 25, alignment: 'Center', isVisible: false },
        ]},
        { __key: nextKey(), rowType: 'static', cells: [] },
      ],
    }],
  };

  const taxes: TableElement = {
    ...makeTableTaxes(),
    groups: [{
      __key: nextKey(),
      rows: [{ __key: nextKey(), rowType: 'static', cells: [
        { __key: nextKey(), key: 'name',           value: 'Name',  width: 50, alignment: 'left',  isVisible: true },
        { __key: nextKey(), key: 'total.number()', value: 'Total', width: 50, alignment: 'right', isVisible: true },
      ]}],
    }],
  };

  const payments: TableElement = makeTablePayments();

  return [
    logo({ data: '!preferences.logo', width: 100, height: 77.5, originalWidth: 100, originalHeight: 77.5 }),
    text({ value: 'Invoice', fontSize: 45, fontWeight: 'bold' }),
    line(),
    text({ value: '!preferences.name' }),
    text({ value: '!preferences.branchName' }),
    text({ value: '!preferences.branchAddress' }),
    text({ value: '!preferences.phoneNumber',  visibility: 'Hidden', condition: { data: '!preferences.phoneNumber', equals: '' } }),
    spacer(20),
    text({ value: 'VAT !preferences.vatNumber', visibility: 'Hidden', condition: { data: '!preferences.vatNumber', equals: '' } }),
    line(),
    sideText({ leftText: 'Invoice No. !invoice.invoiceNumber', rightText: '!invoice.serviceName' }),
    sideText({ leftText: 'Date !invoice.createdAt.shortDate()', rightText: 'Time !invoice.createdAt.shortTime()' }),
    sideText({ leftText: 'Server: !invoice.employeeName' }),
    text({ value: 'Scheduled at: !invoice.scheduleTime.shortDate() !invoice.scheduleTime.shortTime()',
           fontSize: 32, visibility: 'Hidden', condition: { data: '!invoice.scheduleTime', equals: '' } }),
    text({ value: 'Customer !invoice.customerName ( !invoice.customerContact )',
           alignment: 'Left', visibility: 'Hidden', condition: { data: '!invoice.customerName', equals: '' } }),
    text({ value: 'Address: !invoice.customerAddress',
           alignment: 'Left', visibility: 'Hidden', condition: { data: '!invoice.customerAddress', equals: '' } }),
    text({ value: 'Ref # !invoice.refrenceNumber ' }),
    text({ value: 'Table !invoice.table.name', fontSize: 50,
           visibility: 'Hidden', condition: { data: '!invoice.table', equals: '' } }),
    line(),
    text({ value: '!invoice.note', visibility: 'Hidden', condition: { data: '!invoice.note', equals: '' } }),
    spacer(20),
    lines,
    line(),
    sideText({ leftText: 'Item(s) Sub Total',      rightText: '!invoice.itemSubTotal.currency()',                visibility: 'Hidden' }),
    sideText({ leftText: 'Item(s) Discount Total', rightText: '!invoice.itemDiscountTotal.currency()',           visibility: 'Hidden', condition: { data: '!invoice.itemDiscountTotal', equals: '0' } }),
    sideText({ leftText: 'Item(s) Total',          rightText: '!invoice.itemSubTotalAfterDiscount.currency()',  visibility: 'Hidden', condition: { data: '!invoice.itemDiscountTotal', equals: '0' } }),
    taxes,
    sideText({ leftText: 'Discount Amount (!invoice.discountAmount %) ', rightText: '!invoice.discountTotal.currency()', visibility: 'Hidden', condition: { data: '!invoice.discountTotal', equals: '0' } }),
    sideText({ leftText: 'Charge Total',           rightText: '!invoice.chargeTotal.currency()',           visibility: 'Hidden', condition: { data: '!invoice.chargeTotal',    equals: '0' } }),
    sideText({ leftText: 'Delivery Charge',        rightText: '!invoice.deliveryCharge.currency()',        visibility: 'Hidden', condition: { data: '!invoice.deliveryCharge', equals: '0' } }),
    sideText({ leftText: 'Rounding Total',         rightText: '!invoice.roundingTotal.currency()',         visibility: 'Hidden', condition: { data: '!invoice.roundingTotal',  equals: '0' } }),
    sideText({ leftText: 'Total',                  rightText: '!invoice.total.currency()' }),
    payments,
    sideText({ leftText: 'Balance', rightText: '!invoice.balance.currency()', visibility: 'Hidden', condition: { data: '!invoice.balance', equals: '0' } }),
    sideText({ leftText: 'Change',  rightText: '!invoice.change.currency()',  visibility: 'Hidden', condition: { data: '!invoice.change',  equals: '0' } }),
    spacer(20),
    text({ value: '** Paid Ticket **', fontSize: 50, fontWeight: 'bold',
           condition: { data: '!invoice.isPaid', equals: '1' } }),
  ];
}

/** Default elements for a fresh kitchen ticket — section name, server,
 *  table, lines table (qty + product name only), reference. Mirrors
 *  the legacy `setNewTemplate('kitchen')` payload. */
export function defaultKitchenElements(): PrintElement[] {
  const text = (overrides: Partial<TextElement>): TextElement =>
    ({ ...(makeElement('Text') as TextElement), ...overrides });
  const sideText = (overrides: Partial<SideTextElement>): SideTextElement =>
    ({ ...(makeElement('SideText') as SideTextElement), ...overrides });
  const line = (): LineElement => makeElement('Line') as LineElement;
  const spacer = (h = 20): SpacerElement =>
    ({ ...(makeElement('Spacer') as SpacerElement), height: h });

  const kitchenLines: TableElement = {
    ...makeTableLines(),
    groups: [{
      __key: nextKey(),
      rows: [
        { __key: nextKey(), rowType: 'static', cells: [
          { __key: nextKey(), key: 'qty.numberTrim()', value: 'Qty',          width: 13, alignment: 'left', isVisible: true, isRequired: true },
          { __key: nextKey(), key: 'product.name',     value: 'Product Name', width: 67, alignment: 'left', isVisible: true },
        ]},
        { __key: nextKey(), rowType: 'static', cells: [] },
      ],
    }],
  };

  return [
    text({ value: '!sectionName', fontSize: 45, fontWeight: 'bold' }),
    spacer(20),
    sideText({ leftText: 'Invoice No. !invoice.invoiceNumber', rightText: '!invoice.serviceName',
               fontSize: 40, fontWeight: 'bold' }),
    sideText({ leftText: 'Server: !invoice.employeeName' }),
    sideText({ leftText: 'Date !invoice.createdAt.shortDate()', rightText: 'Time !invoice.createdAt.shortTime()' }),
    text({ value: 'Table !invoice.tableName', fontSize: 40, fontWeight: 'bold',
           alignment: 'Left', visibility: 'Hidden', condition: { data: '!invoice.table', equals: '' } }),
    line(),
    kitchenLines,
    spacer(30),
    text({ value: 'Reference# !invoice.refrenceNumber ', fontSize: 45, fontWeight: 'bold' }),
    text({ value: 'Printd On !invoice.printTime.longDate()',
           visibility: 'Hidden', condition: { data: '!invoice.note', equals: '' } }),
  ];
}

/** Stamp a `__key` on every wire element so the form's drag/track
 *  bindings have a stable identity. Idempotent — keeps existing
 *  keys when the wire already supplied one (it shouldn't, but
 *  defence in depth).
 *
 *  Tables get a deeper sweep: every group / row / cell is also
 *  keyed so the column editor's CDK drop-lists pair correctly across
 *  rows and so cell drag-reorder uses object identity instead of
 *  position-based tracking (which would re-mount cells on every move).
 */
export function parseElements(raw: unknown): PrintElement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => {
    const base = { ...(e as PrintElement), __key: (e as PrintElement).__key ?? nextKey() };
    if (base.type === 'Table') {
      const t = base as TableElement;
      t.groups = (Array.isArray(t.groups) ? t.groups : []).map((g) => ({
        ...g,
        __key: g.__key ?? nextKey(),
        rows: (Array.isArray(g.rows) ? g.rows : []).map((r) => ({
          ...r,
          __key: r.__key ?? nextKey(),
          cells: (Array.isArray(r.cells) ? r.cells : []).map((c) => ({
            ...c,
            __key: c.__key ?? nextKey(),
          })),
        })),
      }));
    }
    return base;
  });
}

export interface ReceiptTemplate {
  /** Server id, or empty string for unsaved drafts. */
  id: string;
  companyId: string;
  name: string;
  templateType: TemplateType;
  recieptTemplate: PrintElement[];
  /** ISO timestamp when the template was last saved. */
  updatedDate?: string;
}

/** Row shape for the list page (paginated). */
export interface ReceiptTemplateSummary {
  id: string;
  name: string;
  templateType: TemplateType;
  updatedDate?: string;
  /** Element count — useful colum on the list table. */
  elementsCount: number;
}

export interface ReceiptTemplateListPage {
  list: ReceiptTemplateSummary[];
  total: number;
  pageCount: number;
}

export interface ReceiptTemplateListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' } | null;
}
