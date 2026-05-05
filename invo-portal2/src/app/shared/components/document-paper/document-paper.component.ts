import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CompanyService } from '@core/auth/company.service';

import {
  DesignerElement,
  DocumentTemplate,
  DocumentType,
  TextStyle,
  TableColumn,
  DOC_TYPE_TRANSACTIONAL_FIELDS,
  paperHeightCm,
  paperWidthCm,
} from '@features/document-builder/services/document-template.types';
import { resolveTokens, readArray, type DocumentRenderData } from './token-resolve';
import { PAPER_LAYOUT, FIELD_TOKEN, type PaperFieldConfig } from './paper-config';

/** A transactional field — `id` is the field name (e.g. `customerName`),
 *  `style` is the configured TextStyle, `value` is the resolved string
 *  (already token-substituted). Used by the Classic renderer to lay
 *  out the customer / document meta block. */
interface TransactionalField {
  id:    string;
  label: string;
  value: string;
  style: TextStyle;
}

/** A custom-field row for the renderer. Built off `CustomFieldStyle`
 *  entries on the template plus a value resolved from the live
 *  document data. The renderer treats branch and entity CFs the same
 *  way; they only differ in where they're slotted into the layout. */
interface CustomFieldRow {
  abbr:  string;
  name:  string;
  label: string;
  value: string;
  style: TextStyle;
}

/** Page descriptor for the paginated print-preview render path.
 *  `isFirst` controls whether the page emits the document title +
 *  transactional fields above the items table; `isLast` controls
 *  whether the totals / payments / signature / customer-note block
 *  follows the items. Documents that fit on one page have both flags
 *  set to true. */
interface PagePlan {
  index:   number;
  items:   unknown[];
  isFirst: boolean;
  isLast:  boolean;
}

/** Items-table column descriptor. */
interface PaperTableColumn {
  id:     string;
  label:  string;
  width:  number;       // percentage
}

/** Total / payment row descriptor — `style` toggles affect rendering. */
interface PaperTotalRow {
  id:    string;
  label: string;
  value: string;
  style: TextStyle;
}

/** Per-document-type field → which entity field its value comes from
 *  in the sample data. The renderer reads this map once per field id
 *  to compose the value; missing fields fall back to `—`. The keys
 *  match the legacy `transactionalDetailsCustomization` field ids
 *  (typos preserved). */
const FIELD_VALUE_MAP: Record<string, { token: string; label: string }> = {
  // customer
  customerName:        { token: '{{customer.name}}',    label: 'Customer Name' },
  customerPhone:       { token: '{{customer.phone}}',   label: 'Customer Phone' },
  customerAddress:     { token: '{{customer.address}}', label: 'Customer Address' },
  customerVatNumber:   { token: '{{customer.vat}}',     label: 'Customer VAT' },
  vatNumber:           { token: '{{customer.vat}}',     label: 'VAT Number' },
  // supplier
  supplierName:        { token: '{{supplier.name}}',    label: 'Supplier Name' },
  supplierPhone:       { token: '{{supplier.phone}}',   label: 'Supplier Phone' },
  supplierAddress:     { token: '{{supplier.address}}', label: 'Supplier Address' },
  supplierVatNumber:   { token: '{{supplier.vat}}',     label: 'Supplier VAT' },
  // people
  salesPerson:         { token: '{{invoice.salesRep}}', label: 'Sales Person' },
  employeeName:        { token: '{{invoice.salesRep}}', label: 'Employee Name' },
  service:             { token: '{{invoice.service}}',  label: 'Service' },
  uom:                 { token: 'UOM',                  label: 'UOM' },
  // doc numbers
  invNumber:               { token: '{{invoice.number}}', label: 'Invoice No.' },
  estimateNumber:          { token: '{{invoice.number}}', label: 'Estimate No.' },
  creditNoteNumber:        { token: '{{invoice.number}}', label: 'Credit Note No.' },
  purchaseOrderNumber:     { token: '{{invoice.number}}', label: 'PO No.' },
  billNumber:              { token: '{{invoice.number}}', label: 'Bill No.' },
  expenseNumber:           { token: '{{invoice.number}}', label: 'Expense No.' },
  supplierCreditNumber:    { token: '{{invoice.number}}', label: 'Supplier Credit No.' },
  // dates
  invoiceDate:             { token: '{{invoice.date}}',          label: 'Invoice Date' },
  invoiceDueDate:          { token: '{{invoice.dueDate}}',       label: 'Invoice Due Date' },
  estimateDate:            { token: '{{invoice.date}}',          label: 'Estimate Date' },
  estimateExpDate:         { token: '{{invoice.dueDate}}',       label: 'Estimate Expiry' },
  creditNoteDate:          { token: '{{invoice.date}}',          label: 'Credit Note Date' },
  purchaseOrderDate:       { token: '{{invoice.date}}',          label: 'PO Date' },
  purchaseOrderExpiryDate: { token: '{{invoice.dueDate}}',       label: 'PO Expiry' },
  expectedDeliveryDate:    { token: '{{invoice.dueDate}}',       label: 'Expected Delivery' },
  billDate:                { token: '{{invoice.date}}',          label: 'Bill Date' },
  billDueDate:             { token: '{{invoice.dueDate}}',       label: 'Bill Due Date' },
  expenseDate:             { token: '{{invoice.date}}',          label: 'Expense Date' },
  supplierCreditDate:      { token: '{{invoice.date}}',          label: 'Supplier Credit Date' },
  createdDate:             { token: '{{invoice.date}}',          label: 'Created Date' },
  dueDate:                 { token: '{{invoice.dueDate}}',       label: 'Due Date' },
  // refs
  refrence:            { token: '{{invoice.reference}}', label: 'Reference' },
  originalInvoice:     { token: '{{invoice.reference}}', label: 'Original Invoice' },
  originalBill:        { token: '{{invoice.reference}}', label: 'Original Bill' },
  purchaseOrder:       { token: '{{invoice.reference}}', label: 'Purchase Order' },
  vendorBillNumber:    { token: '{{invoice.reference}}', label: 'Vendor Bill #' },
  // expense
  paymentMethodName:   { token: 'Cash',          label: 'Payment Method' },
  paidThrough:         { token: 'Main Account',  label: 'Paid Through' },
};

/**
 * DocumentPaperComponent
 * ──────────────────────
 * Unified renderer for `DocumentTemplate` — picks Classic or Designer
 * based on `template.renderMode`. Designed to be drop-in for entity
 * view / print pages; the document-builder form uses it for live
 * preview too.
 *
 *   - **Classic** mode renders a structured layout (header /
 *     title / customer card / meta grid / items table / totals /
 *     footer). Visibility toggles + colours from the template are
 *     honoured.
 *   - **Designer** mode renders the absolute-positioned
 *     `designerElements` and resolves `{{token}}` bindings against
 *     the data — the same renderer the canvas uses, minus the drag
 *     and resize handles.
 *
 * Pure read-only: no mutations, no events, no side effects. The
 * component is intentionally "dumb" so it can be used inside a
 * print iframe / window with predictable behaviour.
 */
@Component({
  selector: 'app-document-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-paper.component.html',
  styleUrl: './document-paper.component.scss',
})
export class DocumentPaperComponent {
  private companies = inject(CompanyService);

  template = input.required<DocumentTemplate>();
  data     = input.required<DocumentRenderData>();

  /** Augment the input data with the real tenant identity — company
   *  name / logo / VAT / address / phone come from `CompanyService`
   *  so previews and printed documents show the user's actual brand
   *  identity, not the sample placeholder. The base data still drives
   *  customer / invoice / lines / totals — only the company block is
   *  overridden. Mirrors the receipt-builder pattern. */
  private mergedData = computed<DocumentRenderData>(() => {
    const base = this.data() ?? {};
    const company = this.companies.currentCompany() as
      | { name?: string; vat?: string; address?: string; phone?: string;
          logo?: string; logoUrl?: string; mediaUrl?: { defaultUrl?: string } }
      | null;
    if (!company) return base;
    const realLogo =
      company.mediaUrl?.defaultUrl
      || company.logoUrl
      || company.logo
      || '';
    const sampleCompany = (base['company'] as Record<string, unknown>) ?? {};
    return {
      ...base,
      company: {
        ...sampleCompany,
        name:    company.name    || sampleCompany['name']    || '',
        vat:     company.vat     || sampleCompany['vat']     || '',
        address: company.address || sampleCompany['address'] || '',
        phone:   company.phone   || sampleCompany['phone']   || '',
        logo:    realLogo        || sampleCompany['logo']    || '',
      },
    };
  });

  /** Force a renderer regardless of `template.renderMode` — useful
   *  in the form's Preview tab where the user might want to see how
   *  the *other* renderer would look without flipping the saved
   *  flag. Defaults to `null` (use template's flag). */
  forceMode = input<'classic' | 'designer' | null>(null);

  /** Render the Classic content as paginated A4 pages — Word/PDF
   *  viewer style. The company header repeats on every page; the
   *  totals / payments / customer-balance / signature / customer-note
   *  / footer-notes block stays atomic on the last page. The browser's
   *  native print uses the same paginated DOM, so what the user
   *  previews is exactly what prints. Designer mode ignores this
   *  flag (its absolute-positioned canvas is intrinsically a single
   *  page). */
  printPreview = input<boolean>(false);

  // ─── Pagination ─────────────────────────────────────────────────────
  // Approximate row capacity per page. Real measurement (ResizeObserver
  // + per-row heights) is a future enhancement; these constants land
  // pages within ±1 row of where they'd fit on real A4 portrait at
  // ~10pt body type. Each page reserves space for the repeating
  // header at the top + the pinned page-footer at the bottom + 1cm
  // padding all around — so the row counts here are the visible
  // rows ONLY, not the total content height.
  private static readonly ITEMS_FIRST_PAGE  = 6;   // first page also carries title + transactional fields + meta
  private static readonly ITEMS_MIDDLE_PAGE = 16;  // middle pages just carry items (header + footer reserve ~25% of height)
  private static readonly ITEMS_LAST_PAGE   = 5;   // last page also carries totals + payments + signature + customer-note + footer notes/terms
  private static readonly ITEMS_SINGLE_PAGE = 8;   // when everything fits on one page (header + meta + items + totals)

  /** Compute page descriptors for the paginated render path. Each
   *  entry carries its slice of items + flags telling the template
   *  which page-specific blocks to emit (title/meta on first,
   *  totals/payments on last). Single-page documents collapse to
   *  one entry with both flags true. */
  pages = computed<PagePlan[]>(() => {
    if (!this.printPreview()) return [];
    const lines = (this.mergedData()['lines'] as unknown[]) ?? [];
    const total = lines.length;

    // Small docs fit on one page.
    if (total <= DocumentPaperComponent.ITEMS_SINGLE_PAGE) {
      return [{ index: 0, items: lines, isFirst: true, isLast: true }];
    }

    const out: PagePlan[] = [];

    // Page 1 — meta + transactional + first slice of items.
    out.push({
      index:   0,
      items:   lines.slice(0, DocumentPaperComponent.ITEMS_FIRST_PAGE),
      isFirst: true,
      isLast:  false,
    });
    let cursor = DocumentPaperComponent.ITEMS_FIRST_PAGE;

    // Reserve `ITEMS_LAST_PAGE` worth of rows for the last page so
    // the totals block doesn't get pushed onto its own page when it
    // could fit alongside a few rows.
    const lastPageReserve = DocumentPaperComponent.ITEMS_LAST_PAGE;

    // Middle pages — pure item slices.
    while (cursor + lastPageReserve < total) {
      out.push({
        index:   out.length,
        items:   lines.slice(cursor, cursor + DocumentPaperComponent.ITEMS_MIDDLE_PAGE),
        isFirst: false,
        isLast:  false,
      });
      cursor += DocumentPaperComponent.ITEMS_MIDDLE_PAGE;
    }

    // Last page — remaining items + totals/payments/signature.
    out.push({
      index:   out.length,
      items:   lines.slice(cursor),
      isFirst: false,
      isLast:  true,
    });

    return out;
  });

  /** Cumulative item count before page `pageIndex` — drives the
   *  paginated render so the row-number `#` column stays continuous
   *  across pages (page 2 starts at 11 instead of resetting to 1). */
  itemsStartIndex(pageIndex: number): number {
    const list = this.pages();
    let sum = 0;
    for (let i = 0; i < pageIndex && i < list.length; i++) {
      sum += list[i].items.length;
    }
    return sum;
  }

  // ─── Geometry ───────────────────────────────────────────────────────
  paperWidthPx  = computed<number>(() => paperWidthCm(this.template())  * 37.8);
  paperHeightPx = computed<number>(() => paperHeightCm(this.template()) * 37.8);
  /** Same dimensions in cm — used for the paginated render's
   *  `.dp__page` boxes. Browsers honour cm/mm exactly in print
   *  contexts (1cm = 1 physical centimetre per spec); px units can
   *  be re-interpreted by print engines and cause the page to
   *  scale down to fit, leaving whitespace inside the printed
   *  sheet. Using cm keeps each `.dp__page` exactly one printed
   *  page in size. */
  paperWidthCmValue  = computed<number>(() => paperWidthCm(this.template()));
  paperHeightCmValue = computed<number>(() => paperHeightCm(this.template()));

  /** Resolved render mode — honours the `forceMode` override. */
  renderMode = computed<'classic' | 'designer'>(() => {
    const force = this.forceMode();
    if (force) return force;
    return this.template().renderMode === 'designer' ? 'designer' : 'classic';
  });

  // ─── Classic helpers ────────────────────────────────────────────────
  /** Resolve a string with `{{tokens}}` against the merged data (sample
   *  + real company identity). All renderer call-sites use this so
   *  the `{{company.*}}` tokens read the actual tenant brand. */
  r(input: unknown): string { return resolveTokens(input, this.mergedData()); }

  /** Real company logo URL when available — otherwise empty string.
   *  The template falls back to a styled "LOGO" placeholder when
   *  this is empty. */
  realLogoUrl = computed<string>(() => {
    const c = this.mergedData()['company'] as { logo?: string } | undefined;
    return c?.logo ?? '';
  });

  /** Title shown in the Classic header. The per-type config carries
   *  a `staticTitle` plus an optional `getDynamicTitle(data)` hook;
   *  when the hook returns a non-empty string we use it, otherwise
   *  the static label. The hook lets a doc type append state to the
   *  title (e.g. "INVOICE — VOIDED") so a printed copy can't be
   *  mistaken for live state. */
  titleLabel = computed<string>(() => {
    const layout = PAPER_LAYOUT[this.template().documentType];
    if (!layout) return 'DOCUMENT';
    const dynamic = layout.getDynamicTitle?.(this.mergedData());
    if (dynamic && dynamic.trim()) return dynamic;
    return layout.staticTitle;
  });

  /** Style helper for a TextStyle block — same shape both renderers
   *  use. Keeps the inline-style noise out of the template. */
  textStyle(t: { size?: string | number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; alignment?: string; backgroundColor?: string } | undefined | null) {
    if (!t) return {};
    return {
      'font-size':        (Number(t.size) || 10) + 'pt',
      'color':            t.color || 'inherit',
      'font-weight':      t.bold      ? '700'       : '400',
      'font-style':       t.italic    ? 'italic'    : 'normal',
      'text-decoration':  t.underline ? 'underline' : 'none',
      'text-align':       t.alignment || 'left',
      'background-color': t.backgroundColor || 'transparent',
    };
  }

  // ─── Configured transactional fields ────────────────────────────────
  /** Build a TransactionalField from a config entry — resolves the
   *  field's TextStyle off the template, picks the user's label
   *  override when set, and resolves the token to a value. Returns
   *  null when the field is hidden (so the caller can skip it).
   *
   *  A `showCondition` predicate on the config wins over the user's
   *  `show` toggle: a field that's marked visible but fails its
   *  condition (e.g. "Due Date" on a fully-paid invoice) is still
   *  hidden. The user's `show: false` always wins for the opposite
   *  direction — a hidden field stays hidden regardless of state. */
  private buildField(cfg: PaperFieldConfig): TransactionalField | null {
    const t = this.template();
    const style = t.transactionalDetailsCustomization[cfg.id] as TextStyle | undefined;
    if (!style || typeof style !== 'object' || !('show' in style)) return null;
    if (!style.show) return null;
    if (cfg.showCondition && !cfg.showCondition(this.mergedData())) return null;
    const label = (style.label && style.label.trim()) || cfg.label;
    const token = FIELD_TOKEN[cfg.id];
    const value = token ? this.r(token) : '';
    return { id: cfg.id, label, value, style };
  }

  /** Left-column transactional fields — order driven by the per-type
   *  `PAPER_LAYOUT.firstColumn` so the rendered paper matches the
   *  legacy layout exactly. Hidden fields are skipped. */
  fieldsFirstColumn  = computed<TransactionalField[]>(() => {
    const layout = PAPER_LAYOUT[this.template().documentType];
    if (!layout) return [];
    return layout.firstColumn
      .map((cfg) => this.buildField(cfg))
      .filter((f): f is TransactionalField => f !== null);
  });

  /** Right-column transactional fields. */
  fieldsSecondColumn = computed<TransactionalField[]>(() => {
    const layout = PAPER_LAYOUT[this.template().documentType];
    if (!layout) return [];
    return layout.secondColumn
      .map((cfg) => this.buildField(cfg))
      .filter((f): f is TransactionalField => f !== null);
  });

  // ─── Custom-field rows ───────────────────────────────────────────────
  // Branch CFs render in the header company block; entity CFs render
  // below the configured firstColumn/secondColumn fields. Each row
  // resolves its value from `customFieldValues.<scope>[<abbr>]` on
  // the data object — when absent, the field's own name is shown in
  // brackets as a placeholder so the preview stays informative.
  branchCustomFieldRows = computed<CustomFieldRow[]>(() => {
    const list = this.template().headerCustomization.customFields ?? [];
    return list
      .filter((e) => e.style.show !== false)
      .map((e) => this.buildCustomFieldRow('branch', e));
  });

  entityCustomFieldRows = computed<CustomFieldRow[]>(() => {
    const list = this.template().transactionalDetailsCustomization.customFields ?? [];
    return list
      .filter((e) => e.style.show !== false)
      .map((e) => this.buildCustomFieldRow('entity', e));
  });

  private buildCustomFieldRow(scope: 'branch' | 'entity', e: { abbr: string; name: string; style: TextStyle }): CustomFieldRow {
    return {
      abbr:  e.abbr,
      name:  e.name,
      style: e.style,
      label: (e.style.label && e.style.label.trim()) || e.name,
      value: this.cfValueFor(scope, e.abbr) || `[${e.name}]`,
    };
  }

  private cfValueFor(scope: 'branch' | 'entity', abbr: string): string {
    const map = this.mergedData()['customFieldValues'] as
      { branch?: Record<string, unknown>; entity?: Record<string, unknown> } | undefined;
    const v = map?.[scope]?.[abbr];
    if (v === null || v === undefined) return '';
    return String(v);
  }

  // ─── Configured items-table columns ─────────────────────────────────
  /** Per-type column allow-list — only columns relevant to the current
   *  document type are surfaced (matches legacy filter). The user's
   *  `tableCustomization.show` toggle still applies on top, plus any
   *  `showCondition` / `hideCondition` predicates the column config
   *  carries (e.g. hide "Tax %" on bill-of-entry documents). The
   *  rendered header label falls back to the column's `defaultLabel`
   *  when the user hasn't overridden it. */
  visibleColumns = computed<PaperTableColumn[]>(() => {
    const t      = this.template();
    const layout = PAPER_LAYOUT[t.documentType];
    if (!layout) return [];
    const tc   = t.tableCustomization;
    const data = this.mergedData();
    const out: PaperTableColumn[] = [];
    for (const cfg of layout.tableColumns) {
      const col = tc[cfg.id] as TableColumn | undefined;
      if (col && col.show === false) continue;
      if (cfg.hideCondition && cfg.hideCondition(data)) continue;
      if (cfg.showCondition && !cfg.showCondition(data)) continue;
      out.push({
        id:    cfg.id,
        label: col?.label || cfg.defaultLabel || cfg.id,
        width: col?.width || 0,
      });
    }
    return out;
  });

  /** Pull a cell value off a sample line for a given column id. */
  cellFor(line: Record<string, unknown>, colId: string): string {
    const get = (k: string) => line[k];
    const num = (v: unknown): string =>
      typeof v === 'number' ? v.toFixed(3) : (v == null ? '' : String(v));
    switch (colId) {
      case 'order':         return '';   // populated by the row index in the template
      case 'description':   return String(get('desc') ?? '');
      case 'product':       return String(get('desc') ?? '');
      case 'qty':           return String(get('qty') ?? '');
      case 'uom':           return String(get('uom') ?? '');
      case 'unitCost':      return num(get('price'));
      case 'price':         return num(get('price'));
      case 'taxPercantage': return String(get('taxRate') ?? '10') + ' %';
      case 'tax':           return num(get('tax'));
      case 'discount':      return num(get('discount'));
      case 'amount':        return num(get('total'));
      case 'total':         return num(get('total'));
      case 'expense':       return num(get('total'));
      default:              return String(get(colId) ?? '');
    }
  }

  // ─── Configured total / payment / balance rows ──────────────────────
  visibleTotalRows = computed<PaperTotalRow[]>(() => {
    const tt     = this.template().totalSectionCustomization.totalTable;
    const totals = (this.data()['totals'] as Record<string, unknown>) ?? {};
    const layout = PAPER_LAYOUT[this.template().documentType];
    const allow  = new Set(layout?.totalFields ?? []);
    const num = (v: unknown): string =>
      typeof v === 'number' ? v.toFixed(3) : '0.000';
    const candidates: Array<{ id: keyof typeof tt; defaultLabel: string; sourceKey: string }> = [
      { id: 'itemTotal',     defaultLabel: 'Items Total',  sourceKey: 'subtotal'   },
      { id: 'taxTotal',      defaultLabel: 'Tax Total',    sourceKey: 'vat'        },
      { id: 'discount',      defaultLabel: 'Discount',     sourceKey: 'discount'   },
      { id: 'charge',        defaultLabel: 'Charge',       sourceKey: 'charge'     },
      { id: 'delevary',      defaultLabel: 'Delivery',     sourceKey: 'delivery'   },
      { id: 'roundingTotal', defaultLabel: 'Rounding',     sourceKey: 'rounding'   },
      { id: 'subTotal',      defaultLabel: 'Subtotal',     sourceKey: 'subtotal'   },
      { id: 'Total',         defaultLabel: 'Total',        sourceKey: 'grandTotal' },
    ];
    const out: PaperTotalRow[] = [];
    for (const c of candidates) {
      // Per-type allow list filters out rows that don't apply to the
      // current document type (e.g. estimate hides nothing,
      // purchase-order shows only subTotal/taxTotal/Total).
      if (allow.size > 0 && !allow.has(String(c.id))) continue;
      const style = tt[c.id] as TextStyle;
      if (!style || !style.show) continue;
      const label = (style.label && style.label.trim()) || c.defaultLabel;
      out.push({ id: String(c.id), label, value: 'BHD ' + num(totals[c.sourceKey]), style });
    }
    return out;
  });

  visiblePaymentRows = computed<PaperTotalRow[]>(() => {
    const pt = this.template().totalSectionCustomization.paymentTable;
    if (!pt.show) return [];
    const totals = (this.data()['totals'] as Record<string, unknown>) ?? {};
    const num = (v: unknown): string =>
      typeof v === 'number' ? v.toFixed(3) : '0.000';
    const candidates: Array<{ id: keyof typeof pt; defaultLabel: string; sourceKey: string }> = [
      { id: 'payments',       defaultLabel: 'Payment Made',  sourceKey: 'paid'    },
      { id: 'paymentMethods', defaultLabel: 'Payment Methods', sourceKey: 'paymentMethods' },
      { id: 'credit',         defaultLabel: 'Credit Applied', sourceKey: 'credit' },
      { id: 'balance',        defaultLabel: 'Balance',         sourceKey: 'balance' },
    ];
    const out: PaperTotalRow[] = [];
    for (const c of candidates) {
      const style = pt[c.id] as TextStyle;
      if (!style || !style.show) continue;
      const label = (style.label && style.label.trim()) || c.defaultLabel;
      out.push({ id: String(c.id), label, value: 'BHD ' + num(totals[c.sourceKey]), style });
    }
    return out;
  });

  /** Items-table header style — sourced from the per-type
   *  `<type>TableHeader` field so the user's chosen header colour
   *  applies automatically. */
  tableHeaderStyle = computed<TextStyle | null>(() => {
    const t = this.template();
    const map: Record<DocumentType, string> = {
      'invoice':         'invoiceTableHeader',
      'estimate':        'estimateTableHeader',
      'credit-note':     'creditNoteTableHeader',
      'purchase-order':  'purchaseTableHeader',
      'bill':            'billTableHeader',
      'expense':         'expenseTableHeader',
      'supplier-credit': 'supplierCreditTableHeader',
    };
    return (t.transactionalDetailsCustomization[map[t.documentType]] as TextStyle | undefined) ?? null;
  });

  /** Pull additional-data fields by position — used to render
   *  template-level extras (legal disclaimer, regional notes). */
  additionalAt(position: 'header' | 'meta' | 'footer') {
    return this.template().additionalData.filter(
      (a) => a.show !== false && a.position === position,
    );
  }

  // ─── Designer helpers ───────────────────────────────────────────────
  /** Inline style for a designer element. Pure read-only — the
   *  component never mutates the input. */
  designerStyle(el: DesignerElement): Record<string, string> {
    const justify = el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start');
    const isShape = el.type === 'Shape';
    const isQR    = el.type === 'QR Code';

    return {
      position:        'absolute',
      left:            el.x + 'px',
      top:             el.y + 'px',
      width:           el.w + 'px',
      height:          el.h + 'px',
      background:      (el.bg && el.bg !== 'transparent') ? el.bg : 'transparent',
      color:           el.color || '#1f2937',
      'font-weight':   el.bold      ? '700'       : '400',
      'font-style':    el.italic    ? 'italic'    : 'normal',
      'text-decoration':el.underline ? 'underline' : 'none',
      'font-size':     el.size ? el.size + 'pt' : 'inherit',
      'text-align':    el.align || 'left',
      display:         'flex',
      'align-items':   'flex-start',
      'justify-content':justify,
      padding:         (isShape || isQR) ? '0' : '2px 4px',
      overflow:        'hidden',
      opacity:         (el.opacity ?? 1).toString(),
      'border-radius': isShape && el.shapeKind === 'circle'
                          ? '50%'
                          : (isShape && el.radius != null ? el.radius + 'px' : '0'),
      border:          isShape && el.stroke && el.stroke !== 'none'
                          ? `${el.strokeWidth || 1}px solid ${el.stroke}`
                          : '0',
      transform:       el.rotation ? `rotate(${el.rotation}deg)` : 'none',
    };
  }

  /** Designer Page-# format — pulled to TS so the template doesn't
   *  chain `.replace()` calls. */
  pageNumberText(el: DesignerElement): string {
    const fmt = (el.content || 'Page {X} of {Y}');
    return fmt
      .replace(/\{X\}/g, String(el.current ?? 1))
      .replace(/\{Y\}/g, String(el.total   ?? 1));
  }

  /** Designer Data-Field text — composes prefix + resolved token + suffix. */
  dataFieldText(el: DesignerElement): string {
    if (!el.path) return '';
    return (el.prefix || '')
         + this.r('{{' + el.path + (el.format ? '|' + el.format : '') + '}}')
         + (el.suffix || '');
  }

  /** Resolve a Designer table's rows — if `bindTo` is set, project
   *  the data array; otherwise return the static rows. */
  designerTableRows(el: DesignerElement): string[][] {
    if (el.bindTo) {
      const arr = readArray(this.data(), el.bindTo);
      // Pick fields in declaration order — the user sets the column
      // order via headers; we map the array items into the same
      // visual order using `Object.values`.
      return arr.map((item) =>
        item == null
          ? ['']
          : (typeof item === 'object'
              ? Object.values(item as Record<string, unknown>).map((v) => v == null ? '' : String(v))
              : [String(item)]));
    }
    return (el.rows ?? []).map((row) => row.map((c) => this.r(c)));
  }

  /** Static QR pattern (matches the canvas component for visual
   *  continuity). */
  readonly qrPattern: [number, number][] = [
    [0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],
    [4,0],[6,0],[8,0],[9,0],[4,1],[7,1],[9,1],[5,2],[6,2],[8,2],
    [4,3],[5,3],[7,3],[9,3],[0,4],[2,4],[3,4],[5,4],[7,4],[8,4],[9,4],
    [1,5],[4,5],[6,5],[8,5],[0,6],[2,6],[5,6],[7,6],[9,6],
    [3,7],[4,7],[6,7],[8,7],[0,8],[1,8],[2,8],[3,8],[5,8],[7,8],[9,8],
    [0,9],[2,9],[6,9],[8,9],[9,9],
  ];

  /** Bar widths for the dummy barcode. */
  readonly barcodeBars: number[] = [
    0.5, 0.5, 1, 0.5, 1.5, 0.5, 1, 0.5, 0.5, 1, 1.5, 0.5, 0.5, 1, 0.5,
    0.5, 0.5, 1, 0.5, 1.5, 0.5, 1, 0.5, 0.5, 1, 1.5, 0.5, 0.5, 1, 0.5,
    0.5, 0.5, 1, 0.5, 1.5, 0.5, 1, 0.5, 0.5, 1, 1.5, 0.5, 0.5, 1, 0.5,
    0.5, 0.5, 1, 0.5, 1.5,
  ];

  trackEl   = (_: number, e: DesignerElement) => e.id;
  trackLine = (_: number, l: { desc?: unknown; qty?: unknown; price?: unknown; total?: unknown }) =>
    String(l?.desc ?? '') + '|' + String(l?.qty ?? '') + '|' + String(l?.price ?? '');

  /** Read a line value safely. Used in the items-table to format
   *  `qty * price` without index-signature TS errors. */
  lineTotal(l: Record<string, unknown>): number {
    if (typeof l['total'] === 'number') return l['total'];
    const qty   = Number(l['qty'])   || 0;
    const price = Number(l['price']) || 0;
    return qty * price;
  }

  asNum(v: unknown, fb = 0): number {
    if (v == null) return fb;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
  }

  // ─── Legacy parity helpers ──────────────────────────────────────────
  /** Document status (`Issued` / `Paid` / `Voided` / …) — drives the
   *  status ribbon in the top-right corner. Matches legacy
   *  `data.status`. */
  documentStatus = computed<string>(() =>
    String((this.data()['invoice'] as Record<string, unknown> | undefined)?.['status'] ?? ''),
  );

  /** Whether tax is inclusive — drives the chip next to the Order
   *  Summary heading. Mirrors legacy `data.isInclusiveTax`. */
  isInclusiveTax = computed<boolean>(() =>
    !!(this.data()['invoice'] as Record<string, unknown> | undefined)?.['isInclusiveTax'],
  );

  /** Customer note — yellow band rendered between the payment table
   *  and the company note. Maps to `data.note` in legacy. */
  customerNote = computed<string>(() =>
    String((this.data()['invoice'] as Record<string, unknown> | undefined)?.['customerNote'] ?? ''),
  );

  /** Customer signature — image URL surfaced in the right-half card
   *  next to the totals when present. Maps to legacy
   *  `data.customerSignature`. */
  customerSignature = computed<string>(() =>
    String((this.data()['invoice'] as Record<string, unknown> | undefined)?.['customerSignature'] ?? ''),
  );

  /** Per-payment-method rows — renders inside the orange payments
   *  box, one row per `SUCCESS` payment with its method name +
   *  amount. Mirrors legacy `data.invoicePayments` / `billingPayments`. */
  paymentEntries = computed<Array<{ method: string; amount: number; ref?: string }>>(() => {
    const list = (this.data()['invoicePayments'] as unknown[] | undefined)
              ?? (this.data()['billingPayments'] as unknown[] | undefined)
              ?? [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => (p as Record<string, unknown>)?.['status'] === 'SUCCESS')
      .map((p) => {
        const e = p as Record<string, unknown>;
        return {
          method: String(e['paymentMethodName'] ?? ''),
          amount: this.asNum(e['amount']),
          ref:    e['referenceNumber'] ? String(e['referenceNumber']) : undefined,
        };
      });
  });

  /** Whether the payments-block has anything to render — used to
   *  decide if the orange box appears at all. */
  hasPayments = computed<boolean>(() =>
    this.visiblePaymentRows().length > 0 || this.paymentEntries().length > 0,
  );

  /** Voided lines for a given main line — used by the items-table to
   *  render strike-through rows under each item. */
  voidedFor(line: Record<string, unknown>): Array<Record<string, unknown>> {
    const v = line['voidedItems'];
    return Array.isArray(v) ? v as Array<Record<string, unknown>> : [];
  }

  /** Right-aligned columns. Description / Product / UoM align left;
   *  every other column reads as a number, so right-align reads better. */
  isRightAlignedColumn(id: string): boolean {
    return id !== 'description' && id !== 'product' && id !== 'uom';
  }

  /** Read a TextStyle off `transactionalDetailsCustomization` by id —
   *  narrows the loose `TextStyle | unknown[] | undefined` union the
   *  parent map exposes to a usable `TextStyle | null`. */
  txStyle(id: string): TextStyle | null {
    const v = this.template().transactionalDetailsCustomization[id];
    if (v && typeof v === 'object' && !Array.isArray(v) && 'show' in v) {
      return v as TextStyle;
    }
    return null;
  }
}
