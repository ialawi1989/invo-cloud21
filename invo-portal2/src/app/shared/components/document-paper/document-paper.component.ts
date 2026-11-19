import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { resolveLocalizedName } from '@shared/utils/localized-name';
import { CompanyService } from '@core/auth/company.service';

import {
  DesignerElement,
  DocumentTemplate,
  DocumentType,
  MASTER_PAGE_ID,
  TextStyle,
  TableColumn,
  DOC_TYPE_TRANSACTIONAL_FIELDS,
  DEFAULT_TEXT_STYLE,
  paperHeightCm,
  paperWidthCm,
} from '@features/settings/document-builder/services/document-template.types';
import { resolveTokens, readArray, type DocumentRenderData } from './token-resolve';
import { PAPER_LAYOUT, FIELD_TOKEN, type PaperFieldConfig, type TableColumnConfig } from './paper-config';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { CustomFieldsService } from '@features/settings/services/custom-fields.service';
import type { CustomField } from '@features/settings/models/custom-field.types';

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
  /** No saved style: legacy draws a bare `name: value` (branch fields) or nothing (entity / customer fields). */
  bare?: boolean;
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
  /** Table-cell numbers print as the legacy `mynumber` pipe does: the company's decimals, more only when the value has them. */
  private readonly numPipe = new MynumberPipe();
  private readonly curPipe = new MycurrencyPipe();
  private readonly i18n = inject(TranslateService);
  /** Barcode / product-field badge: its own colour, background and font (an unset colour keeps the badge's default green). */
  badgeLook(s: TextStyle | null | undefined): Record<string, string | null> {
    if (!s) return {};
    return { ...this.font(s), color: s.color || null, 'background-color': s.backgroundColor || null };
  }
  /** Legacy text style: font size (pt), weight, style and decoration only. A missing size inherits the paper's text size. */
  font(s: TextStyle | null | undefined): Record<string, string | null> {
    if (!s) return {};
    const size = Number(s.size);
    return {
      'font-size':       size > 0 ? `${size}pt` : null,
      'font-weight':     s.bold ? 'bold' : 'normal',
      'font-style':      s.italic ? 'italic' : 'normal',
      'text-decoration': s.underline ? 'underline' : 'none',
    };
  }
  /** `font()` plus the style's colour on the same element. */
  fontColor(s: TextStyle | null | undefined): Record<string, string | null> {
    return s ? { ...this.font(s), color: s.color || null } : {};
  }
  /** The default colour legacy gives a field's label and value when the template has none. */
  readonly defaultInk = 'rgb(73, 80, 87)';
  /** The service row: `Service: x | Section: y | Table: z`, each part's label in bold. */
  serviceParts(value: string): Array<{ label: string; value: string }> {
    return String(value || '').split(' | ').filter(Boolean).map((p) => {
      const at = p.indexOf(': ');
      return at < 0 ? { label: '', value: p } : { label: p.slice(0, at + 1), value: p.slice(at + 2) };
    });
  }
  /** Legacy shows the tax-type line only when the document says whether its prices include tax. */
  hasTaxType = computed<boolean>(() => (this.data()['invoice'] as Record<string, unknown> | undefined)?.['isInclusiveTax'] !== undefined);

  /** A default label in the active language from the legacy translation keys (`DOCUMENT_PAPER.*`); the English fallback when a key has no text. */
  tr(key: string, fallback: string): string {
    const v = this.i18n.instant(key);
    return v && v !== key ? String(v) : fallback;
  }

  /** A line's product name in the active language (legacy `localizedName`), falling back to the stored name. */
  lineName(ln: Record<string, unknown>): string {
    return resolveLocalizedName({ name: ln['desc'], translation: ln['translation'] as never }, this.i18n.currentLang || this.i18n.defaultLang || 'en') || String(ln['desc'] ?? '');
  }
  /** A money amount in the company's currency and decimals (legacy `mycurrency`), not a fixed 'BHD' with 3 places. */
  money(v: unknown): string { return this.curPipe.transform(v); }
  /** A plain number as the legacy `mynumber` pipe prints it (company decimals, more only when the value has them). */
  num(v: unknown): string { return this.numPipe.transform(v); }
  private readonly cfService = inject(CustomFieldsService);
  /** The company's product custom fields: each is a table column `cf_<id>` (legacy `getProductCustomFieldColumns`). */
  protected readonly productCfs = signal<CustomField[]>([]);
  /** The company's branch / entity custom-field definitions: they drive which rows print (legacy lists every active field). */
  protected readonly branchCfs = signal<CustomField[]>([]);
  protected readonly entityCfs = signal<CustomField[]>([]);
  /** The customer's custom-field definitions (customer-facing documents only) — they share the entity fields' style list and columns. */
  protected readonly customerCfs = signal<CustomField[]>([]);
  constructor() {
    void this.cfService.getByType('branch')
      .then((list) => this.branchCfs.set(list.filter((f) => !f.isDeleted && !!f.id)))
      .catch(() => this.branchCfs.set([]));
    effect(() => {
      const dm = PAPER_LAYOUT[this.template().documentType]?.dataModel;
      const key = dm?.cfEntityType;
      if (dm?.entityType === 'customer') {
        void this.cfService.getByType('customer')
          .then((list) => this.customerCfs.set(list.filter((f) => !f.isDeleted && !!f.id)))
          .catch(() => this.customerCfs.set([]));
      } else this.customerCfs.set([]);
      if (!key) { this.entityCfs.set([]); return; }
      void this.cfService.getByType(key)
        .then((list) => this.entityCfs.set(list.filter((f) => !f.isDeleted && !!f.id)))
        .catch(() => this.entityCfs.set([]));
    });
    void this.cfService.getByType('product')
      .then((list) => this.productCfs.set(list.filter((f) => !f.isDeleted && !!f.id)))
      .catch(() => this.productCfs.set([]));
  }

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
      | { name?: string; vat?: string; vatNumber?: string; address?: string; phone?: string;
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
        vat:     company.vat     || company.vatNumber || (this.companies.settings() as any)?.vatNumber || sampleCompany['vat'] || '',
        address: company.address || sampleCompany['address'] || '',
        phone:   company.phone   || sampleCompany['phone']   || '',
        logo:    realLogo        || sampleCompany['logo']    || '',
        // The company's invoice-options note and terms (Settings > Invoice options), printed in the footer as legacy does.
        note:    (this.companies.settings() as any)?.invoiceOptions?.note ?? sampleCompany['note'] ?? '',
        terms:   (this.companies.settings() as any)?.invoiceOptions?.term ?? sampleCompany['terms'] ?? '',
      },
    };
  });

  /** Force a renderer regardless of `template.renderMode` — useful
   *  in the form's Preview tab where the user might want to see how
   *  the *other* renderer would look without flipping the saved
   *  flag. Defaults to `null` (use template's flag). */
  forceMode = input<'classic' | 'designer' | null>(null);

  /** The builder's live preview shows every configured total row; a real document hides the empty (zero) ones, as the legacy paper does. */
  builderMode = input<boolean>(false);

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

  /** Resolved render mode — honours the `forceMode` override. Falls back to Classic when the
   *  template claims Designer mode but has no elements (an empty/broken Designer template would
   *  otherwise render nothing at all — the `.dp` box sized and styled, with zero content inside). */
  renderMode = computed<'classic' | 'designer'>(() => {
    const force = this.forceMode();
    if (force) return force;
    const t = this.template();
    return t.renderMode === 'designer' && t.designerElements.length > 0 ? 'designer' : 'classic';
  });

  /** Terms & Conditions renders as a second page box (single-paper Classic only — paginated
   *  print-preview keeps its existing per-page behaviour regardless of this setting). */
  /** The page margins the template saved (legacy: the card's padding), cm. */
  classicPadding = computed<string | null>(() => {
    const m = this.template().margins;
    if (!m || this.renderMode() !== 'classic' || this.printPreview()) return null;
    const v = (x: unknown) => (x == null || x === '' || isNaN(Number(x)) ? '0.635' : String(x));
    return `${v(m.top)}cm ${v(m.right)}cm ${v(m.bottom)}cm ${v(m.left)}cm`;
  });

  showTermsAsSeparatePage = computed<boolean>(() =>
    this.renderMode() === 'classic' && !this.printPreview()
    && this.showTerms()
    && this.template().footerCustomization.termAsSeparatePage,
  );

  /** Designer-mode master-page elements — everything with no `pageId` (or `pageId==='master'`).
   *  Mirrors legacy's `Section.pageId ?? MASTER_PAGE_ID` convention exactly, so a template saved
   *  before extra pages existed (no `pageId` on any element) renders unchanged. */
  masterElements = computed<DesignerElement[]>(() =>
    this.template().designerElements.filter((e) => (e.pageId ?? MASTER_PAGE_ID) === MASTER_PAGE_ID),
  );

  /** One extra page's own elements (see `DocumentTemplate.extraPages`). */
  elementsForPage(pageId: string): DesignerElement[] {
    return this.template().designerElements.filter((e) => e.pageId === pageId);
  }

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
    const own = this.template().headerCustomization.title?.label;
    if (own && own.trim()) return own;
    const dynamic = layout.getDynamicTitle?.(this.mergedData());
    if (dynamic && dynamic.trim()) return dynamic;
    return layout.staticTitle;
  });

  /** Style helper for a TextStyle block — same shape both renderers
   *  use. Keeps the inline-style noise out of the template. */
  /** `dd/MM/yyyy HH:mm`, as the legacy paper prints a line's creation time. */
  fmtDateTime(v: unknown): string {
    const d = new Date(v as string);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** The picked items of a package / menu line, with the names of their options. */
  subItemsOf(line: Record<string, unknown>): Array<{ name: string; options: string[] }> {
    const list = line['subItems'];
    if (!Array.isArray(list)) return [];
    return list.map((s: any) => ({
      name: this.lineName({ desc: s?.name, translation: s?.translation }),
      options: Array.isArray(s?.options) ? s.options.map((o: any) => String(o?.name ?? '')).filter(Boolean) : [],
    }));
  }

  /** The barcode badge style of the template (colours, size), as the legacy paper applied it. */
  barcodeCfg(): any { return (this.template() as any).transactionalDetailsCustomization?.['barcode']; }

  textStyle(t: { size?: string | number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; alignment?: string; backgroundColor?: string } | undefined | null) {
    if (!t) return {};
    return {
      // a style with no size of its own takes the template's text size (legacy: the paper's base `textSize`), not a fixed 10pt
      'font-size':        (Number(t.size) || Number(this.template().textSize) || 10) + 'pt',
      'color':            t.color || 'inherit',
      'font-weight':      t.bold      ? '700'       : '400',
      'font-style':       t.italic    ? 'italic'    : 'normal',
      'text-decoration':  t.underline ? 'underline' : 'none',
      'text-align':       t.alignment || 'left',
      'background-color': t.backgroundColor || 'transparent',
      // Preserve manual line breaks in Notes / Company Note / Terms text (and everywhere else
      // this shared style applies) — without it, a plain `<span>`/`<div>` collapses `\n` into a
      // single space and multi-line text reads as one run-on line.
      'white-space':      'pre-wrap',
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
    const style = t.transactionalDetailsCustomization[cfg.styleKey ?? cfg.id] as TextStyle | undefined;
    if (!style || typeof style !== 'object' || !('show' in style)) return null;
    if (!style.show) return null;
    if (cfg.showCondition && !cfg.showCondition(this.mergedData())) return null;
    // the service row carries its own bold labels (Service / Section / Table), so it has no outer label
    const label = cfg.id === 'service' ? '' : ((style.label && style.label.trim()) || this.tr(`DOCUMENT_PAPER.FIELD.${t.documentType}.${cfg.id}`, cfg.label));
    const token = FIELD_TOKEN[cfg.id];
    const value = token ? this.r(token) : '';
    // Legacy `shouldShowField`: on a real document a field with no value is not printed (Reference, Sales Person, Customer VAT…).
    if (!this.builderMode() && (value == null || String(value).trim() === '')) return null;
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
  branchCustomFieldRows = computed<CustomFieldRow[]>(() =>
    this.customFieldRows('branch', this.branchCfs(), this.template().headerCustomization.customFields ?? []));

  entityCustomFieldRows = computed<CustomFieldRow[]>(() => {
    const entries = this.template().transactionalDetailsCustomization.customFields ?? [];
    // entity then customer fields, one shared style list (legacy `customFieldsDisplay`)
    return [
      ...this.customFieldRows('entity', this.entityCfs(), entries),
      ...this.customFieldRows('customer', this.customerCfs(), entries),
    ];
  });

  /** Entity custom fields sit in the first or second column of the details block by their saved `position` (legacy). */
  entityCfFirstColumn  = computed<CustomFieldRow[]>(() => this.entityCustomFieldRows().filter((r) => r.style.position !== 'secondColumn'));
  entityCfSecondColumn = computed<CustomFieldRow[]>(() => this.entityCustomFieldRows().filter((r) => r.style.position === 'secondColumn'));

  /** Legacy lists every active custom field of the scope: its saved style (keyed by the field ID) when there is one, the default
   *  style otherwise. On a real document a field with no value is skipped; in the builder it shows `<name> Value`. */
  private customFieldRows(scope: 'branch' | 'entity' | 'customer', defs: CustomField[], entries: Array<{ abbr: string; name: string; style: TextStyle }>): CustomFieldRow[] {
    const byId = new Map(entries.map((e) => [e.abbr, e]));
    const source = defs.length
      ? defs.map((d) => ({ id: d.id, name: d.name, entry: byId.get(d.id) }))
      : entries.map((e) => ({ id: e.abbr, name: e.name, entry: e }));
    const rows: CustomFieldRow[] = [];
    for (const s of source) {
      if (scope !== 'branch' && !s.entry) continue;
      const style = s.entry?.style ?? DEFAULT_TEXT_STYLE({ size: 12 });
      if (style.show === false) continue;
      const raw = this.cfValueFor(scope, s.id);
      if (!this.builderMode() && raw === '') continue;
      rows.push({
        abbr: s.id, name: s.name, style, bare: !s.entry,
        // legacy prints the field's own name: the template's label / showLabel apply to the built-in fields only
        label: s.name,
        value: raw || `${s.name} Value`,
      });
    }
    return rows;
  }

  private cfValueFor(scope: 'branch' | 'entity' | 'customer', abbr: string): string {
    const map = this.mergedData()['customFieldValues'] as
      { branch?: Record<string, unknown>; entity?: Record<string, unknown>; customer?: Record<string, unknown> } | undefined;
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
    const cfColumns: TableColumnConfig[] = this.productCfs().map((f) => ({ id: 'cf_' + f.id, defaultLabel: f.name, defaultShow: false }));
    for (const cfg of [...layout.tableColumns, ...cfColumns]) {
      const col = tc[cfg.id] as TableColumn | undefined;
      // legacy `shouldShowColumn`: a saved entry decides; with none, the column's `defaultShow` does (Image / Barcode / custom fields: hidden)
      if (col ? col.show === false : cfg.defaultShow === false) continue;
      if (cfg.hideCondition && cfg.hideCondition(data)) continue;
      // legacy `hideCondition: 'allowBillOfEntry'` on the tax columns
      if ((cfg.id === 'tax' || cfg.id === 'taxPercantage') && (data['invoice'] as Record<string, unknown> | undefined)?.['allowBillOfEntry'] === true) continue;
      if (cfg.showCondition && !cfg.showCondition(data)) continue;
      out.push({
        id:    cfg.id,
        label: col?.label || cfg.defaultLabel || cfg.id,
        width: col?.width || 0,
      });
    }
    // The order the client saved in the legacy builder (`columnOrder`); columns it doesn't list keep their place at the end.
    const order = t.columnOrder ?? [];
    if (order.length) {
      const byId = new Map(out.map((c) => [c.id, c]));
      const ordered = order.map((id) => byId.get(id)).filter((c): c is PaperTableColumn => !!c);
      const seen = new Set(ordered.map((c) => c.id));
      out.forEach((c) => { if (!seen.has(c.id)) ordered.push(c); });
      return ordered;
    }
    return out;
  });

  /** Pull a cell value off a sample line for a given column id. */
  cellFor(line: Record<string, unknown>, colId: string): string {
    const get = (k: string) => line[k];
    const num = (v: unknown): string =>
      (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))))
        ? this.numPipe.transform(v)
        : (v == null ? '' : String(v));
    if (colId.startsWith('cf_')) {
      const id = colId.slice(3);
      const v = (line['customFields'] as Record<string, unknown> | undefined)?.[id];
      if (v != null && v !== '') return String(v);
      // the builder's preview has no real product: show the field's name as a sample, like legacy
      return this.builderMode() ? `${this.productCfs().find((f) => f.id === id)?.name ?? ''} Value` : '';
    }
    switch (colId) {
      case 'order':         return '';   // populated by the row index in the template
      case 'description':   return String(get('desc') ?? '');
      case 'product':       return String(get('desc') ?? '');
      case 'qty':           return String(get('qty') ?? '');
      case 'uom':           return String(get('uom') ?? '');
      case 'unitCost':      return num(get('price'));
      case 'price':         return num(get('price'));
      case 'taxPercantage': return String(get('taxRate') ?? '') + ' %';
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
      { id: 'subTotal',      defaultLabel: 'Sub Total',    sourceKey: 'subTotal'   },
      { id: 'discount',      defaultLabel: 'Discount',     sourceKey: 'discount'   },
      { id: 'charge',        defaultLabel: 'Charge',       sourceKey: 'charge'     },
      { id: 'delevary',      defaultLabel: 'Delivery',     sourceKey: 'delivery'   },
      { id: 'roundingTotal', defaultLabel: 'Rounding',     sourceKey: 'rounding'   },
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
      let label = (style.label && style.label.trim()) || this.tr(`DOCUMENT_PAPER.TOTAL.${c.id}`, c.defaultLabel);
      // An empty row is not printed on a real document (legacy `value != null && value !== 0`).
      const raw = totals[c.sourceKey] ?? (c.id === 'subTotal' ? totals['subtotal'] : undefined);
      if (!this.builderMode() && (raw == null || Number(raw) === 0)) continue;
      // An inclusive-tax invoice shows its items total, tax and discount with the tax in them.
      if (this.isInclusiveTax() && this.template().documentType === 'invoice' && ['itemTotal', 'taxTotal', 'discount'].includes(String(c.id))) label += ' (inc)';
      out.push({ id: String(c.id), label, value: this.money(raw), style });
    }
    // Legacy reorders the rows at render time: the discount sits before or after the tax by `applyDiscountBeforeTax`, and an
    // invoice's charge sits before the tax row for `chargeBeforeTax`, right after it otherwise.
    const doc = (this.data()['invoice'] as Record<string, unknown> | undefined) ?? {};
    const move = (id: string, at: (list: PaperTotalRow[]) => number): void => {
      const from = out.findIndex((r) => r.id === id);
      if (from < 0) return;
      const [row] = out.splice(from, 1);
      const to = at(out);
      out.splice(to < 0 ? from : to, 0, row);
    };
    const idx = (id: string) => (list: PaperTotalRow[]) => list.findIndex((r) => r.id === id);
    const taxAt = out.findIndex((r) => r.id === 'taxTotal');
    const discAt = out.findIndex((r) => r.id === 'discount');
    if (taxAt >= 0 && discAt >= 0) {
      if (doc['applyDiscountBeforeTax'] === true) { if (discAt > taxAt) move('discount', idx('taxTotal')); }
      else if (taxAt > discAt) move('taxTotal', idx('discount'));
    }
    if (this.template().documentType === 'invoice' && out.some((r) => r.id === 'charge') && out.some((r) => r.id === 'taxTotal')) {
      move('charge', (list) => {
        const t = list.findIndex((r) => r.id === 'taxTotal');
        return doc['chargeType'] === 'chargeBeforeTax' ? t : t + 1;
      });
    }
    return out;
  });

  visiblePaymentRows = computed<PaperTotalRow[]>(() => {
    const pt = this.template().totalSectionCustomization.paymentTable;
    if (!pt.show) return [];
    const totals = (this.data()['totals'] as Record<string, unknown>) ?? {};
    const candidates: Array<{ id: keyof typeof pt; defaultLabel: string; sourceKey: string }> = [
      { id: 'payments',       defaultLabel: 'Payment Made',  sourceKey: 'paid'    },
      { id: 'paymentMethods', defaultLabel: 'Payment Methods', sourceKey: 'paymentMethods' },
      { id: 'credit',         defaultLabel: 'Credit Applied', sourceKey: 'credit' },
      { id: 'balance',        defaultLabel: 'Balance',         sourceKey: 'balance' },
    ];
    const out: PaperTotalRow[] = [];
    for (const c of candidates) {
      // Legacy prints one row per actual payment (rendered from `paymentEntries()`), never a summary "Payment Methods" line.
      if (c.id === 'paymentMethods') continue;
      const style = pt[c.id] as TextStyle;
      // legacy `shouldShowPaymentField`: shown unless the template says show === false
      if (!style || style.show === false) continue;
      const label = (style.label && style.label.trim()) || this.tr(`DOCUMENT_PAPER.PAYMENT.${c.id}`, c.defaultLabel);
      const raw = totals[c.sourceKey];
      out.push({ id: String(c.id), label, value: this.money(c.id === 'balance' ? Math.max(0, Number(raw) || 0) : raw), style });
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
      // A Repeater's real rendered height (N rows × itemHeight) is usually taller than its
      // design-time box — there's no page-splitting in Designer mode's single-canvas render, so
      // rows must be free to overflow downward rather than getting clipped.
      overflow:        el.type === 'Repeater' ? 'visible' : 'hidden',
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

  /** Rows a Repeater clones one card per (legacy `RepeaterBlock.dataSource`). */
  repeaterRows(el: DesignerElement): unknown[] {
    return readArray(this.data(), String(el.bindTo || 'lines'));
  }

  /** A repeater child's display text, resolved against ITS ROW (not the whole document) — so
   *  `path: 'productName'` reads `row.productName` directly, matching the flat row shape the seed
   *  data (`lines`, etc.) already uses. */
  repeaterChildText(child: DesignerElement, row: unknown): string {
    const ctx = (row && typeof row === 'object') ? row as unknown as DocumentRenderData : ({} as DocumentRenderData);
    if (child.type === 'Data Field' && child.path) {
      return (child.prefix || '') + resolveTokens('{{' + child.path + (child.format ? '|' + child.format : '') + '}}', ctx) + (child.suffix || '');
    }
    return resolveTokens(child.content, ctx);
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
  /** The ribbon colour class of the status, as the legacy `status-ribbon` maps it. */
  ribbonClass(): string {
    switch (this.documentStatus().trim().toLowerCase()) {
      case 'draft': return 'dp__ribbon--draft';
      case 'paid': return 'dp__ribbon--paid';
      case 'partially paid': return 'dp__ribbon--partial';
      case 'partially converted': return 'dp__ribbon--partconv';
      case 'fully converted': return 'dp__ribbon--fullconv';
      case 'void': case 'voided': return 'dp__ribbon--void';
      case 'closed': return 'dp__ribbon--closed';
      case 'writeoff': return 'dp__ribbon--writeoff';
      default: return 'dp__ribbon--open';
    }
  }

  /** The ribbon text in the active language (legacy `status-ribbon` maps the status to its GENERAL.* key). */
  statusText(): string {
    const s = this.documentStatus();
    return this.tr(`DOCUMENT_PAPER.STATUS.${s}`, s);
  }

  documentStatus = computed<string>(() =>
    String((this.data()['invoice'] as Record<string, unknown> | undefined)?.['status'] ?? ''),
  );

  /** Whether tax is inclusive — drives the chip next to the Order
   *  Summary heading. Mirrors legacy `data.isInclusiveTax`. */
  isInclusiveTax = computed<boolean>(() =>
    !!(this.data()['invoice'] as Record<string, unknown> | undefined)?.['isInclusiveTax'],
  );

  /** Promotions: a discount-coupon invoice prints one "discounted by coupon" line above the totals
   *  (legacy `data.couponId && data.couponType === 'DISCOUNT_COUPONS'`). */
  discountedByCouponNote = computed<boolean>(() => {
    const inv = this.data()['invoice'] as Record<string, unknown> | undefined;
    return !!inv?.['couponId'] && inv?.['couponType'] === 'DISCOUNT_COUPONS';
  });

  /** Product / stamp-card coupons mark the discounted LINES instead (legacy `line.discountedByCoupon`). */
  lineCouponNotes = computed<boolean>(() => {
    const t = (this.data()['invoice'] as Record<string, unknown> | undefined)?.['couponType'];
    return t === 'PRODUCTS_COUPONS' || t === 'STAMP_CARDS';
  });

  /** Customer note — yellow band rendered between the payment table
   *  and the company note. Maps to `data.note` in legacy. */
  customerNote = computed<string>(() =>
    String((this.data()['invoice'] as Record<string, unknown> | undefined)?.['customerNote'] ?? ''),
  );

  /** What this document type carries (legacy `config.dataModel.hasTerms / hasCompanyNote / hasCustomerNote`):
   *  an estimate, credit note, PO … print no company note or terms, a credit note no customer note. */
  private readonly docModel = computed(() => PAPER_LAYOUT[this.template().documentType]?.dataModel);
  supportsTerms        = computed<boolean>(() => this.docModel()?.hasTerms ?? false);
  supportsCompanyNote  = computed<boolean>(() => this.docModel()?.hasCompanyNote ?? false);
  supportsCustomerNote = computed<boolean>(() => this.docModel()?.hasCustomerNote ?? false);
  /** The Terms block prints when the type supports it and the company has terms (always in the builder's preview). */
  showTerms = computed<boolean>(() =>
    this.supportsTerms() && this.template().footerCustomization.term.show
    && (this.builderMode() || !!this.r('{{company.terms}}')),
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
  /** Legacy `paymentMethods.show !== false`: whether the per-payment rows print. */
  paymentMethodsOn = computed<boolean>(() => {
    const pm = this.template().totalSectionCustomization.paymentTable.paymentMethods as TextStyle | undefined;
    return pm?.show !== false;
  });
  paymentMethodsStyle = computed<TextStyle | null>(() => (this.template().totalSectionCustomization.paymentTable.paymentMethods as TextStyle | undefined) ?? null);

  hasPayments = computed<boolean>(() =>
    // legacy `hasPaymentTable`: only the types that carry payments (invoice, bill) print the box — never an estimate
    (this.docModel()?.hasPayments ?? false)
    && (this.visiblePaymentRows().length > 0 || (this.paymentMethodsOn() && this.paymentEntries().length > 0)),
  );

  /** Rows for a Designer-mode Payments block (`el.bindTo`, defaults 'invoicePayments') — the same
   *  raw array `paymentEntries()` reads, but with every column the block can show (legacy
   *  `PaymentsBlock`'s fixed catalog: method/reference/date/amount/status/rate). */
  designerPaymentRows(el: DesignerElement): Array<{ method: string; reference: string; date: string; amount: number; status: string; rate: string }> {
    const list = this.data()[String(el.bindTo || 'invoicePayments')] as unknown[] | undefined;
    if (!Array.isArray(list)) return [];
    return list.map((p) => {
      const e = p as Record<string, unknown>;
      return {
        method:    String(e['paymentMethodName'] ?? ''),
        reference: e['referenceNumber'] ? String(e['referenceNumber']) : '',
        date:      e['createdAt'] ? String(e['createdAt']).slice(0, 10) : '',
        amount:    this.asNum(e['amount']),
        status:    String(e['status'] ?? ''),
        rate:      e['rate'] != null ? String(e['rate']) : '',
      };
    });
  }

  /** Column header labels for the Payments block — matches legacy's `PAYMENT_COLUMN_CATALOG`. */
  readonly paymentsColumnLabel: Record<string, string> = {
    method: 'Method', reference: 'Reference', date: 'Date', amount: 'Amount', status: 'Status', rate: 'Rate',
  };

  /** The table-lines style (`invoicLines`, `estimateLines`, ...) — legacy puts its size on the row, colour and background on the cells. */
  linesStyle = computed<TextStyle | null>(() => {
    const f = PAPER_LAYOUT[this.template().documentType]?.dataModel?.tableLinesField;
    return f ? ((this.template().transactionalDetailsCustomization[f] as TextStyle | undefined) ?? null) : null;
  });
  /** The voided-lines style; voided rows print only when its `show` is on (legacy `shouldShowVoidedLines`). */
  voidedStyle = computed<TextStyle | null>(() => {
    const f = PAPER_LAYOUT[this.template().documentType]?.dataModel?.tableVoidedField;
    const s = f ? ((this.template().transactionalDetailsCustomization[f] as TextStyle | undefined) ?? null) : null;
    return s && s.show ? s : null;
  });
  /** Legacy shows a customer note whenever the type supports it and the note has text (always in the builder). */
  showCustomerNote = computed<boolean>(() => this.supportsCustomerNote() && (this.builderMode() || !!this.customerNote()));

  /** The product custom-field badges under a line's name (legacy `getLineCustomFieldBadges`): `name: value` for each field the
   *  template enabled in `lineCustomFieldIds`, styled with the shared `productCustomFieldBadge`; off unless that style's `show` is on. */
  badgeStyle = computed<TextStyle | null>(() => {
    const s = (this.template().transactionalDetailsCustomization as unknown as Record<string, unknown>)['productCustomFieldBadge'] as TextStyle | undefined;
    return s && s.show ? s : null;
  });
  lineCfBadges(ln: Record<string, unknown>): Array<{ name: string; value: string }> {
    if (!this.badgeStyle()) return [];
    const ids = (this.template().transactionalDetailsCustomization as unknown as Record<string, unknown>)['lineCustomFieldIds'];
    if (!Array.isArray(ids) || !ids.length) return [];
    const values = (ln['customFields'] as Record<string, unknown> | undefined) ?? {};
    const out: Array<{ name: string; value: string }> = [];
    for (const id of ids as string[]) {
      const def = this.productCfs().find((f) => f.id === id);
      if (!def) continue;
      const v = values[id];
      if (v === null || v === undefined || v === '') {
        if (this.builderMode()) out.push({ name: def.name, value: `${def.name} Value` });
        continue;
      }
      out.push({ name: def.name, value: String(v) });
    }
    return out;
  }

  /** Voided lines for a given main line — used by the items-table to
   *  render strike-through rows under each item. */
  voidedFor(line: Record<string, unknown>): Array<Record<string, unknown>> {
    const v = line['voidedItems'];
    return Array.isArray(v) ? v as Array<Record<string, unknown>> : [];
  }

  /** Right-aligned columns. Description / Product / UoM align left;
   *  every other column reads as a number, so right-align reads better. */
  isRightAlignedColumn(id: string): boolean {
    return id === 'amount' || id === 'total' || id === 'unitCost';
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
