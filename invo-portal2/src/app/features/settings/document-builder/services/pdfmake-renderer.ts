import { resolveTokens, readArray, type DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { DesignerElement, DocumentTemplate, MASTER_PAGE_ID, paperHeightCm, paperWidthCm } from './document-template.types';

/**
 * Design-time "Export PDF" for a Designer-mode template — matches legacy's own builder feature
 * (`free-designer.component.ts` `onExportPdf()`): a preview/test export the template author runs
 * from inside the builder. It does NOT replace the real invoice/estimate PDF, which is still
 * generated server-side (`accounts/viewInvoicePdf` etc.) — this is a separate, parallel path, same
 * as legacy's own architecture (a client-side pdfmake renderer alongside the server print flow).
 *
 * Coordinates: designer elements are px at 96dpi (`paperWidthPx = paperWidthCm * 37.8`); pdfmake
 * pages are in points at 72dpi. `PX_TO_PT` converts between them.
 */
const PX_TO_PT = 72 / 96;
const CM_TO_PT = 28.3465;
const px = (v: number | undefined) => (v ?? 0) * PX_TO_PT;

const PAYMENT_COLUMN_LABEL: Record<string, string> = {
  method: 'Method', reference: 'Reference', date: 'Date', amount: 'Amount', status: 'Status', rate: 'Rate',
};

/** Legacy's Rich Text allow-list (b,i,u,br,span,ul,ol,li) — parsed into pdfmake text runs since
 *  pdfmake has no HTML renderer. Anything outside this allow-list is stripped to plain text. */
function richTextToPdfRuns(html: string): any[] {
  const runs: any[] = [];
  const tagRe = /<(\/?)(b|i|u|br)\s*\/?>/gi;
  let lastIndex = 0;
  let bold = false, italics = false, underline = false;
  let match: RegExpExecArray | null;
  const push = (text: string) => {
    if (!text) return;
    runs.push({ text, bold, italics, decoration: underline ? 'underline' : undefined });
  };
  while ((match = tagRe.exec(html))) {
    push(stripTags(html.slice(lastIndex, match.index)));
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (tag === 'br') { runs.push({ text: '\n' }); }
    else if (tag === 'b') bold = !closing;
    else if (tag === 'i') italics = !closing;
    else if (tag === 'u') underline = !closing;
    lastIndex = tagRe.lastIndex;
  }
  push(stripTags(html.slice(lastIndex)));
  return runs.length ? runs : [{ text: '' }];
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** One element → one (or more, for Repeater) absolutely-positioned pdfmake content node.
 *  `ctx` is what tokens resolve against — the whole document for top-level elements, or a single
 *  row for a Repeater's children (mirrors `document-paper.component.ts`'s `repeaterChildText`). */
function renderElement(el: DesignerElement, ctx: DocumentRenderData, offsetX = 0, offsetY = 0): any[] {
  if (el.hidden) return [];
  const x = px(el.x) + offsetX;
  const y = px(el.y) + offsetY;
  const w = px(el.w);
  const h = px(el.h);
  const textStyle = {
    fontSize: el.size || 10,
    bold: !!el.bold,
    italics: !!el.italic,
    decoration: el.underline ? 'underline' : undefined,
    color: el.color || '#1f2937',
    alignment: el.align || 'left',
  };

  switch (el.type) {
    case 'Image': {
      const src = String(el.src || '');
      if (src.startsWith('data:')) {
        return [{ image: src, width: w, height: h, absolutePosition: { x, y } }];
      }
      // Remote URLs aren't fetchable synchronously for a pdfmake docDefinition — show a label
      // instead of silently omitting the element (same "no image" placeholder the HTML preview
      // shows when there's no `src`).
      return [{ text: el.content || 'IMAGE', absolutePosition: { x, y }, width: w, ...textStyle }];
    }
    case 'QR Code':
      return [{ qr: resolveTokens(el.content, ctx) || ' ', fit: Math.min(w, h) || 80, absolutePosition: { x, y } }];
    case 'Barcode':
      return [{ text: resolveTokens(el.content, ctx), absolutePosition: { x, y }, width: w, fontSize: 9, font: 'Courier' as any, alignment: 'center' }];
    case 'Signature':
      return [
        { canvas: [{ type: 'line', x1: 0, y1: h - 12, x2: w, y2: h - 12, lineWidth: 1, dash: { length: 3 } }], absolutePosition: { x, y } },
        { text: el.content || 'Signature', absolutePosition: { x, y: y + h - 10 }, width: w, fontSize: 9, italics: true, alignment: 'center' },
      ];
    case 'Shape': {
      const kind = el.shapeKind || 'rect';
      const color = el.bg && el.bg !== 'transparent' ? el.bg : undefined;
      const lineColor = el.stroke && el.stroke !== 'none' ? el.stroke : undefined;
      const lineWidth = el.strokeWidth || 1;
      if (kind === 'hline') return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: w, y2: 0, lineWidth, lineColor: lineColor || '#1f2937' }], absolutePosition: { x, y } }];
      if (kind === 'vline') return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 0, y2: h, lineWidth, lineColor: lineColor || '#1f2937' }], absolutePosition: { x, y } }];
      if (kind === 'circle') return [{ canvas: [{ type: 'ellipse', x: w / 2, y: h / 2, r1: w / 2, r2: h / 2, color, lineColor, lineWidth }], absolutePosition: { x, y } }];
      return [{ canvas: [{ type: 'rect', x: 0, y: 0, w, h, r: el.radius ? px(el.radius) : 0, color, lineColor, lineWidth }], absolutePosition: { x, y } }];
    }
    case 'Data Field': {
      if (!el.path) return [];
      const text = (el.prefix || '') + resolveTokens('{{' + el.path + (el.format ? '|' + el.format : '') + '}}', ctx) + (el.suffix || '');
      return [{ text, absolutePosition: { x, y }, width: w, ...textStyle }];
    }
    case 'Page #': {
      const fmt = el.content || 'Page {X} of {Y}';
      const text = fmt.replace(/\{X\}/g, String(el.current ?? 1)).replace(/\{Y\}/g, String(el.total ?? 1));
      return [{ text, absolutePosition: { x, y }, width: w, ...textStyle }];
    }
    case 'Rich Text':
      return [{ text: richTextToPdfRuns(resolveTokens(el.html, ctx)), absolutePosition: { x, y }, width: w, fontSize: el.size || 10, color: el.color || '#1f2937' }];
    case 'Table': {
      const headers = Array.isArray(el.headers) ? el.headers : [];
      const bodyRows = el.bindTo
        ? readArray(ctx, el.bindTo).map((item) =>
            item && typeof item === 'object' ? Object.values(item as Record<string, unknown>).map((v) => String(v ?? '')) : [String(item ?? '')])
        : (el.rows ?? []).map((row) => row.map((c) => resolveTokens(c, ctx)));
      return [{
        absolutePosition: { x, y },
        table: { widths: headers.map(() => '*'), body: [headers, ...bodyRows] },
        layout: { fillColor: (rowIndex: number) => (rowIndex === 0 ? (el.headerBg || '#1e3a8a') : (el.striped !== false && rowIndex % 2 ? '#fafafa' : null)) },
        fontSize: el.size || 9,
      }];
    }
    case 'Payments': {
      const cols: string[] = Array.isArray(el.paymentsColumns) && el.paymentsColumns.length ? el.paymentsColumns : ['method', 'reference', 'date', 'amount'];
      const rows = readArray(ctx, String(el.bindTo || 'invoicePayments')) as Record<string, unknown>[];
      const rowToCell = (row: Record<string, unknown>, col: string): string => {
        if (col === 'amount') return `${el.currency || 'BHD'} ${(Number(row['amount']) || 0).toFixed(3)}`;
        if (col === 'method') return String(row['paymentMethodName'] ?? '');
        if (col === 'reference') return String(row['referenceNumber'] ?? '');
        if (col === 'date') return String(row['createdAt'] ?? '').slice(0, 10);
        return String(row[col] ?? '');
      };
      const body = [cols.map((c) => PAYMENT_COLUMN_LABEL[c] ?? c), ...rows.map((r) => cols.map((c) => rowToCell(r, c)))];
      return [{
        absolutePosition: { x, y },
        table: { widths: cols.map(() => '*'), body: el.showHeader === false ? body.slice(1) : body },
        layout: el.showBorder === false ? 'noBorders' : undefined,
        fontSize: el.size || 9,
      }];
    }
    case 'Repeater': {
      const rows = readArray(ctx, String(el.bindTo || 'lines'));
      const itemH = px(el.itemHeight || 30);
      const spacing = px(el.itemSpacing || 0);
      const children = el.repeaterItems ?? [];
      const out: any[] = [];
      rows.forEach((row, i) => {
        const rowCtx = (row && typeof row === 'object' ? row : {}) as unknown as DocumentRenderData;
        const cardX = el.direction === 'horizontal' ? x + i * (itemH + spacing) : x;
        const cardY = el.direction === 'horizontal' ? y : y + i * (itemH + spacing);
        for (const child of children) out.push(...renderElement(child, rowCtx, cardX, cardY));
      });
      return out;
    }
    default:
      // Text, Group Header, Group Footer — a single interpolated label.
      return [{ text: resolveTokens(el.content, ctx), absolutePosition: { x, y }, width: w, ...textStyle }];
  }
}

/** Builds the full pdfmake docDefinition for a Designer-mode template's current sample/live data —
 *  the client-side "Export PDF" the builder offers while designing, matching legacy's own feature. */
export function buildPdfDocDefinition(template: DocumentTemplate, data: DocumentRenderData): any {
  const widthPt = paperWidthCm(template) * CM_TO_PT;
  const heightPt = paperHeightCm(template) * CM_TO_PT;
  const content: any[] = [];

  // Master page — everything with no `pageId` (or `pageId === 'master'`), matching legacy's
  // `Section.pageId ?? MASTER_PAGE_ID` convention so a template saved before extra pages existed
  // renders unchanged.
  const masterElements = template.designerElements.filter((e) => (e.pageId ?? MASTER_PAGE_ID) === MASTER_PAGE_ID);
  for (const el of masterElements) content.push(...renderElement(el, data));

  // Extra pages (see `DocumentTemplate.extraPages`) — standalone pages appended after the
  // master's flow (e.g. a company's own Terms & Conditions layout), each starting on a fresh
  // physical page via `pageBreak: 'before'` on its first node.
  for (const page of template.extraPages) {
    const pageElements = template.designerElements.filter((e) => e.pageId === page.id);
    const rendered = pageElements.flatMap((el) => renderElement(el, data));
    if (!rendered.length) continue;
    rendered[0] = { ...rendered[0], pageBreak: 'before' };
    content.push(...rendered);
  }

  return {
    pageSize: { width: widthPt, height: heightPt },
    pageMargins: [0, 0, 0, 0],
    background: template.BackgroundColor && template.BackgroundColor !== '#ffffff'
      ? [{ canvas: [{ type: 'rect', x: 0, y: 0, w: widthPt, h: heightPt, color: template.BackgroundColor }] }]
      : undefined,
    content,
    defaultStyle: { fontSize: template.textSize || 10 },
  };
}
