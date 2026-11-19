import { resolveTokens, readArray, type DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { PAPER_LAYOUT, FIELD_TOKEN, type PaperFieldConfig } from '@shared/components/document-paper/paper-config';
import { DocumentTemplate, TextStyle, paperHeightCm, paperWidthCm } from './document-template.types';

/** `documentType` → the field name its table-header style lives under in
 *  `transactionalDetailsCustomization` — mirrors `tableHeaderStyle()` exactly. */
const TABLE_HEADER_FIELD: Record<string, string> = {
  invoice: 'invoiceTableHeader', estimate: 'estimateTableHeader', 'credit-note': 'creditNoteTableHeader',
  'purchase-order': 'purchaseTableHeader', bill: 'billTableHeader', expense: 'expenseTableHeader',
  'supplier-credit': 'supplierCreditTableHeader',
};

/** Maps a template `TextStyle` to pdfmake's text-node properties — mirrors `textStyle()`'s CSS
 *  output 1:1 (same fields, same defaults) so every styled block in this renderer (title, company
 *  info, field labels, table header, …) actually reflects what the user configured instead of a
 *  guessed/hardcoded look. */
function pdfTextStyle(style: TextStyle | null | undefined): Record<string, unknown> {
  if (!style) return {};
  return {
    fontSize: Number(style.size) || 10,
    color: style.color || undefined,
    bold: !!style.bold,
    italics: !!style.italic,
    decoration: style.underline ? 'underline' : undefined,
    alignment: (style.alignment as any) || 'left',
  };
}

/**
 * Client-side pdfmake export for CLASSIC-mode templates — the "Print"/"Export PDF" action in the
 * builder previously relied on `window.print()` (browser print-to-PDF), which is inconsistent
 * across browsers/printers. This mirrors `document-paper.component.ts`'s own Classic renderer
 * (same `PAPER_LAYOUT`/`FIELD_TOKEN` config, so field positions/labels/columns match exactly) but
 * emits a pdfmake docDefinition instead of DOM, matching the Designer-mode export this sits
 * alongside (`pdfmake-renderer.ts`). Same scope note applies: this is a builder preview/test
 * export, not the real invoice/estimate PDF (still server-generated).
 */
const CM_TO_PT = 28.3465;

/** One transactional field resolved to display — mirrors `buildField()` exactly: skipped when its
 *  configured style is missing/hidden, real label override, real per-field style (size/color/
 *  bold/italic/underline/alignment/show-label), not a hardcoded guess. */
function buildField(cfg: PaperFieldConfig, template: DocumentTemplate, data: DocumentRenderData): { label: string; value: string; style: TextStyle } | null {
  const style = (template.transactionalDetailsCustomization as any)[cfg.id] as TextStyle | undefined;
  if (!style || typeof style !== 'object' || !('show' in style) || !style.show) return null;
  const label = (style.label && String(style.label).trim()) || cfg.label;
  const token = FIELD_TOKEN[cfg.id];
  const value = token ? resolveTokens(token, data) : '';
  return { label, value, style };
}

function fieldColumn(fields: PaperFieldConfig[], template: DocumentTemplate, data: DocumentRenderData): any {
  const resolved = fields.map((cfg) => buildField(cfg, template, data)).filter((f): f is NonNullable<typeof f> => f !== null);
  return {
    width: '*',
    stack: resolved.map((f) => ({
      text: f.style.showLabel !== false
        ? [{ text: f.label + ': ', bold: true }, { text: f.value }]
        : [{ text: f.value }],
      margin: [0, 0, 0, 4],
      ...pdfTextStyle(f.style),
    })),
  };
}

/** Relative weight per column id for the all-auto layout — same values as the server PDF's
 *  `COLUMN_WEIGHT` (utilts/pdf/columnWidths.ts): description widest, row number narrowest. */
const COLUMN_WEIGHT: Record<string, number> = { order: 1, image: 2, description: 6, product: 5 };
const DEFAULT_COLUMN_WEIGHT = 2;

/** Port of the server's `normalizeColumnWidths()`: returns one `%` per column, always totalling 100. */
function normalizeColumnWidthPcts(columns: { id: string; pct: number }[]): number[] {
  if (columns.length === 0) return [];
  const numericSum = columns.reduce((sum, c) => sum + c.pct, 0);
  if (numericSum <= 0) {
    const weightOf = (c: { id: string }) => COLUMN_WEIGHT[c.id.toLowerCase()] ?? DEFAULT_COLUMN_WEIGHT;
    const weightSum = columns.reduce((sum, c) => sum + weightOf(c), 0);
    return columns.map((c) => (weightOf(c) / weightSum) * 100);
  }
  const autoCount = columns.filter((c) => c.pct === 0).length;
  if (autoCount > 0) {
    const numericTarget = Math.min(numericSum, 100);
    const autoEach = Math.max(0, 100 - numericTarget) / autoCount;
    return columns.map((c) => (c.pct > 0 ? (c.pct / numericSum) * numericTarget : autoEach));
  }
  return columns.map((c) => (c.pct / numericSum) * 100);
}

/** Mirrors `document-paper.component.ts`'s `cellFor()` exactly — same column-id → line-field map. */
function cellFor(line: Record<string, unknown>, colId: string): string {
  const get = (k: string) => line[k];
  const num = (v: unknown): string => typeof v === 'number' ? v.toFixed(3) : (v == null ? '' : String(v));
  switch (colId) {
    case 'qty': return String(get('qty') ?? '');
    case 'uom': return String(get('uom') ?? '');
    case 'unitCost': case 'price': return num(get('price'));
    case 'taxPercantage': return String(get('taxRate') ?? '10') + ' %';
    case 'tax': return num(get('tax'));
    case 'discount': return num(get('discount'));
    case 'amount': case 'total': case 'expense': return num(get('total'));
    default: return String(get(colId) ?? '');
  }
}

/** Rich item-description cell — name + barcode/uom/options/note, matching
 *  `classicItemsTableTpl`'s `.dp__line-desc` (as readable inline text; pdfmake has no chip/pill
 *  styling primitive, so this trades the on-screen badge look for plain, still-informative text). */
function descriptionCell(line: Record<string, unknown>): any {
  const runs: any[] = [{ text: String(line['desc'] ?? ''), bold: false }];
  const bits: string[] = [];
  if (line['barcode']) bits.push(String(line['barcode']));
  if (line['uom']) bits.push(String(line['uom']));
  if (bits.length) runs.push({ text: '  (' + bits.join(' · ') + ')', fontSize: 7.5, color: '#64748b' });
  const options = line['options'];
  if (Array.isArray(options) && options.length) {
    for (const opt of options as Record<string, unknown>[]) {
      const price = Number(opt['price']) || 0;
      runs.push({ text: `\n  + ${opt['name']}${price > 0 ? ` (${price.toFixed(3)})` : ''}`, fontSize: 7.5, italics: true, color: '#334155' });
    }
  }
  if (line['note']) runs.push({ text: '\n  ' + line['note'], fontSize: 7.5, italics: true, color: '#94a3b8' });
  return { text: runs };
}

/** Mirrors `document-paper.component.ts`'s `visibleTotalRows()` candidate list exactly. */
const TOTAL_CANDIDATES = [
  { id: 'itemTotal', defaultLabel: 'Items Total', sourceKey: 'subtotal' },
  { id: 'taxTotal', defaultLabel: 'Tax Total', sourceKey: 'vat' },
  { id: 'discount', defaultLabel: 'Discount', sourceKey: 'discount' },
  { id: 'charge', defaultLabel: 'Charge', sourceKey: 'charge' },
  { id: 'delevary', defaultLabel: 'Delivery', sourceKey: 'delivery' },
  { id: 'roundingTotal', defaultLabel: 'Rounding', sourceKey: 'rounding' },
  { id: 'subTotal', defaultLabel: 'Subtotal', sourceKey: 'subtotal' },
  { id: 'Total', defaultLabel: 'Total', sourceKey: 'grandTotal' },
] as const;

/** Rasterizes an SVG blob to a PNG data URI via an offscreen canvas — pdfmake can only embed
 *  JPEG/PNG, not SVG (embedding it raw is what produced a blank output/crash before this
 *  conversion existed), and a company logo is commonly SVG. Returns `null` on failure. */
async function svgToPngDataUri(blob: Blob): Promise<string | null> {
  try {
    const svgUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = svgUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 300;
      canvas.height = img.naturalHeight || 150;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    return null;
  }
}

/** Fetches an image URL and returns it as a data URI — pdfmake's `image` content can't fetch
 *  remote URLs itself (browser-only client, no server round trip), only data URIs. Returns `null`
 *  on any failure (missing/blocked/CORS) so the caller can fall back to no logo rather than throw. */
async function toDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (/^image\/svg/i.test(blob.type) || url.toLowerCase().endsWith('.svg')) {
      return await svgToPngDataUri(blob);
    }
    // pdfmake only supports JPEG/PNG directly — anything else (other than the SVG case handled
    // above) falls back to no logo rather than silently breaking PDF generation.
    if (!/^image\/(png|jpe?g)$/i.test(blob.type)) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildClassicPdfDocDefinition(template: DocumentTemplate, data: DocumentRenderData): Promise<any> {
  const layout = PAPER_LAYOUT[template.documentType];
  const widthPt = paperWidthCm(template) * CM_TO_PT;
  const heightPt = paperHeightCm(template) * CM_TO_PT;
  const margins = template.margins ?? { top: 0.635, right: 0.635, bottom: 0.635, left: 0.635 };
  const pageMargins: [number, number, number, number] = [
    (Number(margins.left) || 0.635) * CM_TO_PT, (Number(margins.top) || 0.635) * CM_TO_PT,
    (Number(margins.right) || 0.635) * CM_TO_PT, (Number(margins.bottom) || 0.635) * CM_TO_PT,
  ];

  const content: any[] = [];

  // ── Header: logo + company info block + title ───────────────────────
  // Matches `document-paper.component.html`'s `.dp__company` block: name, VAT, branch, address,
  // phone — each independently toggleable via `headerCustomization`.
  if (template.headerCustomization.visibility.visible) {
    const hc = template.headerCustomization;
    const logoUrl = (data['company'] as Record<string, unknown> | undefined)?.['logo'];
    const logoDataUri = hc.logo.show ? await toDataUri(String(logoUrl ?? '')) : null;

    // Each line uses its OWN configured TextStyle (size/color/bold/italic/underline/alignment) via
    // `pdfTextStyle`, matching `textStyle(headerCustomization.<field>)` on-screen exactly — not a
    // hardcoded font size/weight guess.
    const companyStack: any[] = [];
    if (hc.companyName?.show) companyStack.push({ text: resolveTokens('{{company.name}}', data), margin: [0, 0, 0, 2], ...pdfTextStyle(hc.companyName) });
    if (hc.vatNumber?.show) {
      const label = (hc.vatNumber.label && hc.vatNumber.label.trim()) || 'VAT';
      companyStack.push({ text: [{ text: label + ': ', bold: true }, { text: resolveTokens('{{company.vat}}', data) }], ...pdfTextStyle(hc.vatNumber) });
    }
    if (hc.name?.show) {
      const label = (hc.name.label && hc.name.label.trim()) || 'Branch';
      const branch = resolveTokens('{{branch.name}}', data) || resolveTokens('{{company.name}}', data);
      companyStack.push({ text: [{ text: label + ': ', bold: true }, { text: branch }], ...pdfTextStyle(hc.name) });
    }
    if (hc.address?.show) companyStack.push({ text: resolveTokens('{{company.address}}', data), ...pdfTextStyle(hc.address) });
    if (hc.phone?.show) {
      const label = (hc.phone.label && hc.phone.label.trim()) || 'Tel';
      companyStack.push({ text: [{ text: label + ': ', bold: true }, { text: resolveTokens('{{company.phone}}', data) }], ...pdfTextStyle(hc.phone) });
    }

    // Logo sits BESIDE the company info block (two sibling columns), not stacked above it —
    // matches `.dp__header-left` (logo) + `.dp__company` (text) as siblings on-screen.
    const left: any = logoDataUri
      ? { width: '*', columns: [{ width: 90, image: logoDataUri, fit: [90, 50] }, { width: '*', stack: companyStack }] }
      : { width: '*', stack: companyStack.length ? companyStack : [{ text: '' }] };
    const titleNode = hc.title?.show !== false
      ? { width: 'auto', text: layout?.getDynamicTitle?.(data) || layout?.staticTitle || '', ...pdfTextStyle(hc.title), fontSize: Number(hc.title?.size) || 18 }
      : { width: 'auto', text: '' };
    content.push({
      columns: [left, titleNode],
      margin: [0, 0, 0, 14],
    });
  }

  // ── Two-column identity fields ──────────────────────────────────────
  if (layout) {
    content.push({
      columns: [fieldColumn(layout.firstColumn, template, data), fieldColumn(layout.secondColumn, template, data)],
      columnGap: 20,
      margin: [0, 0, 0, 14],
    });
  }

  // ── "Order summary" heading + tax-mode chip — matches `.dp__items-heading` exactly (a fixed
  // literal label, not user-configurable, same as the on-screen renderer). ─────────────────────
  if (layout) {
    const isInclusiveTax = !!(data['invoice'] as Record<string, unknown> | undefined)?.['isInclusiveTax'];
    content.push({
      columns: [
        { width: '*', text: 'Order summary', bold: true, fontSize: 10 },
        { width: 'auto', text: isInclusiveTax ? 'Inclusive Tax' : 'Exclusive Tax', fontSize: 9, color: '#64748b' },
      ],
      margin: [0, 0, 0, 6],
    });
  }

  // ── Items table ──────────────────────────────────────────────────────
  if (layout) {
    const cols = layout.tableColumns.filter((c) => {
      const col = (template.tableCustomization as any)[c.id];
      return col ? col.show !== false : c.defaultShow !== false;   // Image / Barcode stay off until a template turns them on
    });
    // `dataModel.tableLinesField` (e.g. 'invoicLines') is a template-styling-config lookup key,
    // NOT the data path — every doc type's actual line items live under the flat `data['lines']`
    // key (confirmed against `document-paper.component.html`'s own single-paper renderer, which
    // always reads `data()['lines']` regardless of document type).
    // Column widths — ported from the server PDF's `normalizeColumnWidths()` (utilts/pdf/columnWidths.ts)
    // so this export lays the table out exactly like the real invoice PDF: `%` widths that always total
    // 100% of the table. Numeric (user drag-resized) columns keep their relative share, `auto` (0)
    // columns split what is left, over-specified tables are scaled down, and an all-auto table is split
    // by per-column weight. pdfmake resolves `%` widths NET of cell padding/borders, so the table can
    // never overshoot the margins (the old fixed-pt split did, clipping the last column).
    const lines = readArray(data, 'lines') as Record<string, unknown>[];
    const widthPcts = normalizeColumnWidthPcts(cols.map((c) => ({
      id: c.id,
      pct: Number((template.tableCustomization as any)[c.id]?.width) || 0,
    })));
    const widths = widthPcts.map((p) => p.toFixed(3) + '%');

    // Real configured header style (`transactionalDetailsCustomization[<type>TableHeader]`) —
    // mirrors `tableHeaderStyle()` exactly instead of a hardcoded navy-blue guess.
    const headerStyle = (template.transactionalDetailsCustomization as any)[TABLE_HEADER_FIELD[template.documentType]] as TextStyle | undefined;
    const headerBg = headerStyle?.backgroundColor || '#1e3a8a';
    // Header cells follow the server PDF's `buildLinesTable()`: per-cell fill from the template, label
    // colour forced to white if it would be invisible against that fill, bold, and `noWrap` so a long
    // label in a narrow column isn't broken character-by-character.
    const headerRow = cols.map((c) => {
      const color = headerStyle?.color || '#fff';
      return {
        text: (template.tableCustomization as any)[c.id]?.label || c.defaultLabel,
        ...pdfTextStyle(headerStyle),
        fillColor: headerBg,
        color: color.toLowerCase() === headerBg.toLowerCase() ? '#ffffff' : color,
        fontSize: Number(headerStyle?.size) || 8.5,
        bold: true,
        noWrap: true,
      };
    });
    const body: any[] = [headerRow];
    lines.forEach((line, i) => {
      body.push(cols.map((c) => {
        if (c.id === 'order') return { text: String(i + 1) };
        if (c.id === 'description' || c.id === 'product') return descriptionCell(line);
        return { text: cellFor(line, c.id) };
      }));
      const voided = Array.isArray(line['voidedItems']) ? line['voidedItems'] as Record<string, unknown>[] : [];
      for (const vl of voided) {
        body.push(cols.map((c) => {
          const val = c.id === 'order' ? String(i + 1) : c.id === 'description' || c.id === 'product' ? String(vl['desc'] ?? '') : cellFor(vl, c.id);
          return { text: val, decoration: 'lineThrough', color: '#94a3b8', fontSize: 8 };
        }));
      }
    });
    // Table + layout ported from the server PDF's `buildLinesTable()`: light horizontal rules only
    // (no vertical lines), 5pt side padding, rows are atomic and the header stays with its first row.
    content.push({
      table: { headerRows: 1, widths, heights: 'auto', dontBreakRows: true, keepWithHeaderRows: 1, body },
      layout: {
        hLineWidth: () => 1,
        hLineColor: () => '#eff2f7',
        vLineWidth: () => 0,
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: (i: number) => (i === 0 ? 4 : 3),
        paddingBottom: (i: number) => (i === 0 ? 4 : 8),
      },
      margin: [0, 0, 0, 20],
    });
  }

  // ── Totals ───────────────────────────────────────────────────────────
  const totals = (data['totals'] as Record<string, unknown>) ?? {};
  const allow = new Set(layout?.totalFields ?? []);
  const num = (v: unknown) => (typeof v === 'number' ? v.toFixed(3) : '0.000');
  const totalRows = TOTAL_CANDIDATES
    .filter((c) => allow.size === 0 || allow.has(c.id))
    .filter((c) => (template.totalSectionCustomization.totalTable as any)[c.id]?.show)
    .map((c) => {
      const style = (template.totalSectionCustomization.totalTable as any)[c.id];
      const label = (style?.label && String(style.label).trim()) || c.defaultLabel;
      return [{ text: label, alignment: 'left' }, { text: 'BHD ' + num(totals[c.sourceKey]), alignment: 'right' }];
    });
  if (totalRows.length) {
    content.push({
      columns: [
        { width: '*', text: '' },
        { width: 220, table: { widths: ['*', 'auto'], body: totalRows }, layout: 'noBorders' },
      ],
      margin: [0, 0, 0, 14],
    });
  }

  // ── Payments box (orange) — Payment Made / Payment Methods / Credit Applied / Balance, plus one
  // row per SUCCESS payment. Mirrors `visiblePaymentRows()`/`paymentEntries()` exactly. ──────────
  const paymentTable = template.totalSectionCustomization.paymentTable;
  const paymentRows: any[][] = [];
  if (paymentTable.show) {
    const PAYMENT_CANDIDATES = [
      { id: 'payments', defaultLabel: 'Payment Made', sourceKey: 'paid' },
      { id: 'paymentMethods', defaultLabel: 'Payment Methods', sourceKey: 'paymentMethods' },
      { id: 'credit', defaultLabel: 'Credit Applied', sourceKey: 'credit' },
      { id: 'balance', defaultLabel: 'Balance', sourceKey: 'balance' },
    ] as const;
    for (const c of PAYMENT_CANDIDATES) {
      const style = (paymentTable as any)[c.id];
      if (!style?.show) continue;
      const label = (style.label && String(style.label).trim()) || c.defaultLabel;
      paymentRows.push([{ text: label }, { text: 'BHD ' + num(totals[c.sourceKey]), alignment: 'right', bold: true }]);
    }
  }
  const invoicePayments = readArray(data, 'invoicePayments') as Record<string, unknown>[];
  for (const p of invoicePayments) {
    if (p['status'] !== 'SUCCESS') continue;
    const ref = p['referenceNumber'] ? ` · Ref# ${p['referenceNumber']}` : '';
    paymentRows.push([{ text: String(p['paymentMethodName'] ?? '') + ref }, { text: 'BHD ' + (Number(p['amount']) || 0).toFixed(3), alignment: 'right', bold: true }]);
  }
  if (paymentRows.length) {
    content.push({
      table: { widths: ['*', 'auto'], body: paymentRows },
      layout: 'noBorders',
      fillColor: template.totalSectionCustomization.paymentTable.backgroundColor || '#f1b44c',
      margin: [0, 0, 0, 12],
    });
  }

  // ── Customer signature — matches `customerSignature()`'s exact data path. ────────────────────
  const invoiceRecord = (data['invoice'] as Record<string, unknown> | undefined) ?? {};
  const signatureUrl = invoiceRecord['customerSignature'];
  if (signatureUrl) {
    const sigDataUri = await toDataUri(String(signatureUrl));
    if (sigDataUri) content.push({ image: sigDataUri, width: 120, margin: [0, 0, 0, 10] });
  }

  // ── Customer note (yellow band) — matches `customerNote()`'s exact data path. ─────────────────
  if (template.footerCustomization.customerNote.show) {
    const noteText = String(invoiceRecord['customerNote'] ?? '');
    if (noteText) content.push({ text: noteText, fillColor: '#fef9c3', margin: [0, 0, 0, 10], fontSize: 9, alignment: 'center' });
  }

  // ── Balance due (highlighted) ─────────────────────────────────────────
  const balanceDue = Number(totals['balance']) || 0;
  if (template.totalSectionCustomization.customerBalance.show && balanceDue > 0) {
    content.push({
      table: { widths: ['*', 'auto'], body: [[{ text: 'Balance Due' }, { text: 'BHD ' + balanceDue.toFixed(3), bold: true, alignment: 'right' }]] },
      layout: 'noBorders',
      fillColor: template.totalSectionCustomization.customerBalance.backgroundColor || '#fde68a',
      margin: [0, 0, 0, 12],
    });
  }

  // ── Footer: customer note, term (inline unless separate page) ──────
  const term = template.footerCustomization.term;
  const separatePage = template.footerCustomization.termAsSeparatePage;
  if (template.footerCustomization.note.show) {
    content.push({
      text: [{ text: (template.footerCustomization.note.label || 'Note') + ': ', bold: true }, { text: resolveTokens('{{notes}}', data) }],
      fontSize: 9, margin: [0, 0, 0, 6],
    });
  }
  if (term.show && !separatePage) {
    content.push({
      text: [{ text: (term.label || 'Terms & Conditions') + ':\n', bold: true }, { text: resolveTokens('{{terms}}', data) }],
      fontSize: 9,
    });
  }
  if (term.show && separatePage) {
    content.push({
      text: [{ text: (term.label || 'Terms & Conditions') + ':\n', bold: true }, { text: resolveTokens('{{terms}}', data) }],
      fontSize: 9,
      pageBreak: 'before',
    });
  }

  return {
    pageSize: { width: widthPt, height: heightPt },
    pageMargins,
    content,
    defaultStyle: { fontSize: template.textSize || 10, color: template.textColor || '#1f2937' },
  };
}
