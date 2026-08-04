import { BlockStyle, ConditionalStyle, HorizontalAlign } from './style.types';

/**
 * Canvas-relative position in millimeters. Top-left origin.
 * For RTL templates the renderer mirrors X automatically.
 */
export interface Position {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
  /** If true, height auto-fits content (text wrap, table rows). */
  autoHeight?: boolean;
}

/** Common fields shared by every block. Use BlockBase as the discriminated-union base. */
export interface BlockBase {
  id: string;
  /** Discriminator — every concrete block narrows on this. */
  type: BlockType;
  position: Position;
  size: Size;
  style?: BlockStyle;
  conditionalStyles?: ConditionalStyle[];
  /** Visibility expression — block hidden when evaluates falsy. */
  visibleWhen?: string;
  /** Z-order. Higher = on top. */
  zIndex?: number;
  /** Lock prevents accidental edits in the designer. */
  locked?: boolean;
  /** Free-form name shown in layers panel. */
  name?: string;
}

export type BlockType =
  | 'text'
  | 'rich-text'
  | 'image'
  | 'table'
  | 'line'
  | 'rectangle'
  | 'qr-code'
  | 'barcode'
  | 'divider'
  | 'signature'
  | 'page-number'
  | 'dynamic-field'
  | 'totals'
  | 'payments'
  | 'group-header'
  | 'group-footer'
  | 'repeater';

// ─── Concrete blocks ────────────────────────────────────────────────

export interface TextBlock extends BlockBase {
  type: 'text';
  /** Plain text with {{binding}} placeholders. */
  text: string;
}

export interface RichTextBlock extends BlockBase {
  type: 'rich-text';
  /** Subset of HTML — sanitized at render. Allowed: b, i, u, br, span, ul, ol, li. */
  html: string;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  /** Either a binding path resolving to a data-url/URL, or a literal src. */
  source: string;
  /** Resolved at render time when source is a binding. */
  binding?: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none';
  alt?: string;
}

export interface LineBlock extends BlockBase {
  type: 'line';
  thickness: number; // pt
  color: string;
  /** vertical or horizontal — derived from size if omitted. */
  orientation?: 'horizontal' | 'vertical';
}

export interface RectangleBlock extends BlockBase {
  type: 'rectangle';
  fill?: string;
  /** Corner radius in mm. 0 / undefined = sharp corners. Applied uniformly
   *  to all four corners (separate per-corner radii aren't supported yet). */
  borderRadius?: number;
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
  thickness?: number;
  color?: string;
  pattern?: 'solid' | 'dashed' | 'dotted';
}

export interface QrCodeBlock extends BlockBase {
  type: 'qr-code';
  /** Either literal value or `{{binding}}`. */
  value: string;
  ecLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
}

export interface BarcodeBlock extends BlockBase {
  type: 'barcode';
  value: string;
  symbology:
    | 'code128'
    | 'code39'
    | 'ean13'
    | 'ean8'
    | 'upca'
    | 'qrcode'
    | 'datamatrix';
  showText?: boolean;
}

export interface SignatureBlock extends BlockBase {
  type: 'signature';
  label?: string;
  /** When provided, embeds image; otherwise renders a signature line. */
  imageBinding?: string;
}

export interface PageNumberBlock extends BlockBase {
  type: 'page-number';
  format: string; // e.g. "Page {{current}} of {{total}}"
}

export interface DynamicFieldBlock extends BlockBase {
  type: 'dynamic-field';
  /** Pure binding expression — no text wrapping. e.g. "invoice.total | currency:BHD" */
  expression: string;
}

// ─── Tables ─────────────────────────────────────────────────────────

export type ColumnWidth =
  | { kind: 'fixed'; mm: number }
  | { kind: 'fraction'; fr: number }
  | { kind: 'auto' };

export interface TableColumn {
  id: string;
  /** Header label — supports bindings. */
  header: string;
  /** Cell expression evaluated per row. e.g. "row.qty" or "row.price | currency".
   *  For an `image` column this should evaluate to a URL or data-URL. */
  expression: string;
  width: ColumnWidth;
  align?: HorizontalAlign;
  cellStyle?: BlockStyle;
  headerStyle?: BlockStyle;
  /** Conditional cell styling. */
  conditionalStyles?: ConditionalStyle[];
  /** Optional footer aggregator. */
  footer?: TableColumnFooter;
  /** How to render each cell. Defaults to 'text'. Use 'image' for product
   *  thumbnails — the column's `expression` then resolves to an image URL. */
  cellType?: 'text' | 'image';
  /** When cellType === 'image', max image height in mm (defaults to rowMinHeight). */
  imageHeightMm?: number;
}

export type AggregateKind = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'custom';
export interface TableColumnFooter {
  kind: AggregateKind;
  /** Used when kind === 'custom'. */
  expression?: string;
  format?: string; // pipe chain like "currency:BHD"
}

export interface TableGroup {
  /** Path used as group key. e.g. "row.category" */
  by: string;
  headerExpression?: string; // e.g. "Category: {{group.key}}"
  footerExpression?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showSubtotals?: boolean;
}

export interface TableBlock extends BlockBase {
  type: 'table';
  /** Path to array in data context, e.g. "invoice.items". */
  dataSource: string;
  columns: TableColumn[];
  showHeader?: boolean;
  showFooter?: boolean;
  /** Repeat header on each page. */
  repeatHeader?: boolean;
  /** Repeat footer on each page. */
  repeatFooter?: boolean;
  /** Allows the table to break across pages. */
  pageBreak?: boolean;
  groups?: TableGroup[];
  /** Zebra striping. */
  zebra?: boolean;
  zebraColor?: string;
  rowMinHeight?: number; // mm
  /** Per-row filter expression. Evaluated against each row's binding context
   *  (so `row.x` is available). Falsy → row is skipped, including in footer
   *  aggregates. Independent of the block-level `visibleWhen` which toggles
   *  the entire table. */
  rowVisibleWhen?: string;
}

// ─── Totals / group ───────────────────────────────────────────────

export interface TotalsRow {
  label: string;
  expression: string;
  format?: string;
  bold?: boolean;
}

export interface TotalsBlock extends BlockBase {
  type: 'totals';
  rows: TotalsRow[];
  labelWidth?: number; // mm
}

// ─── Payments ─────────────────────────────────────────────────────

/**
 * Catalog of columns supported by the PaymentsBlock. The block stores only
 * the ordered list of column IDs — labels, expressions, alignment, and width
 * weight come from this catalog so the renderers stay simple and the data
 * shape (`invoicePayments[]`) is enforced by a single source of truth.
 */
export type PaymentColumnId =
  | 'method'
  | 'reference'
  | 'date'
  | 'amount'
  | 'status'
  | 'rate';

export interface PaymentColumnDef {
  id: PaymentColumnId;
  label: string;
  align: 'left' | 'right';
  /** Flex weight when distributing the table's usable width. */
  weight: number;
  /** Binding expression evaluated per row (relative to the row context). */
  expression: string;
  /** True for the Amount column — the renderer appends `currency:<code>`
   *  using the block's `currency` field at render time. */
  isAmount?: boolean;
}

export const PAYMENT_COLUMN_CATALOG: readonly PaymentColumnDef[] = [
  { id: 'method',    label: 'Method',    align: 'left',  weight: 2, expression: 'row.paymentMethodName' },
  { id: 'reference', label: 'Reference', align: 'left',  weight: 3, expression: 'row.referenceNumber' },
  { id: 'date',      label: 'Date',      align: 'left',  weight: 3, expression: 'row.createdAt' },
  { id: 'amount',    label: 'Amount',    align: 'right', weight: 2, expression: 'row.amount', isAmount: true },
  { id: 'status',    label: 'Status',    align: 'left',  weight: 2, expression: 'row.status' },
  { id: 'rate',      label: 'Rate',      align: 'right', weight: 1, expression: 'row.rate' },
];

export const DEFAULT_PAYMENT_COLUMNS: readonly PaymentColumnId[] = [
  'method', 'reference', 'date', 'amount',
];

/**
 * Renders a configurable table of payment records from `dataSource`
 * (defaults to `invoicePayments`). Column set is picked from
 * `PAYMENT_COLUMN_CATALOG` so the block stays self-contained against the
 * standard Invo POS payload — for arbitrary shapes use a regular Table block.
 */
export interface PaymentsBlock extends BlockBase {
  type: 'payments';
  /** Path to a payments array on the data context. */
  dataSource: string;
  /** Ordered column IDs. Falls back to DEFAULT_PAYMENT_COLUMNS when omitted. */
  columns?: PaymentColumnId[];
  showHeader?: boolean;
  /** Toggle the internal cell-grid borders. The block's outer border stays
   *  controlled by `style.border`. Default true. */
  showBorder?: boolean;
  zebra?: boolean;
  zebraColor?: string;
  rowMinHeight?: number; // mm
  /** Currency code passed to the Amount column's `currency:` pipe. */
  currency?: string;
  /** Per-row filter expression — same semantics as TableBlock.rowVisibleWhen.
   *  Example: `row.status == 'SUCCESS'` to drop voided/failed payments. */
  rowVisibleWhen?: string;
}

export interface GroupHeaderBlock extends BlockBase {
  type: 'group-header';
  /** Group key path. */
  groupBy: string;
  template: string; // e.g. "{{group.key}}"
}
export interface GroupFooterBlock extends BlockBase {
  type: 'group-footer';
  groupBy: string;
  template: string;
}

// ─── Discriminated union ──────────────────────────────────────────

/**
 * Repeater (a.k.a. card list) — clones its `items[]` once per element in
 * `dataSource`, stacking each clone vertically. Children inside `items[]`
 * store positions RELATIVE to the card's top-left, so binding expressions
 * like `row.x` resolve against each row exactly like a table cell does.
 *
 * Use cases: product cards with image + features list (e.g. activefitnessstore
 * quotation), invoice-line cards, statement rows that don't fit a table.
 */
export interface RepeaterBlock extends BlockBase {
  type: 'repeater';
  /** Binding path resolving to an array. Each element becomes one card. */
  dataSource: string;
  /** Optional per-row filter — rows where this evaluates falsy are skipped. */
  rowVisibleWhen?: string;
  /** Designed height (mm) of one card. The renderer uses this to position
   *  successive cards vertically. */
  itemHeight: number;
  /** Optional gap (mm) between cards. Defaults to 0. */
  itemSpacing?: number;
  /** Split cards across pages if the block runs past the available height. */
  pageBreak?: boolean;
  /** Direction the cards repeat. Defaults to 'vertical'. */
  direction?: 'vertical' | 'horizontal';
  /** Child blocks rendered once per row. Their `position` is relative to
   *  the card's top-left corner, not the page. */
  items: Block[];
  /** Corner radius in mm applied to EACH card (not the whole list). The
   *  HTML renderer rounds the per-card wrapper; the PDF renderer rounds
   *  a background rect drawn behind each card when the repeater has a
   *  fill or border, since pdfmake has no per-cell radius primitive. */
  borderRadius?: number;
}

export type Block =
  | TextBlock
  | RichTextBlock
  | ImageBlock
  | TableBlock
  | LineBlock
  | RectangleBlock
  | DividerBlock
  | QrCodeBlock
  | BarcodeBlock
  | SignatureBlock
  | PageNumberBlock
  | DynamicFieldBlock
  | TotalsBlock
  | PaymentsBlock
  | GroupHeaderBlock
  | GroupFooterBlock
  | RepeaterBlock;

/**
 * Type guard helper. Use:
 *   if (isBlockOfType(b, 'table')) { b.columns ... }
 */
export function isBlockOfType<T extends BlockType>(
  block: Block,
  type: T,
): block is Extract<Block, { type: T }> {
  return block.type === type;
}
