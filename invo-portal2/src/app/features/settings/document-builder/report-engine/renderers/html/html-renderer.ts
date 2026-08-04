import {
  Block,
  TableBlock,
  PAYMENT_COLUMN_CATALOG,
  DEFAULT_PAYMENT_COLUMNS,
  PaymentColumnDef,
} from '../../core/types/block.types';
import { BindingContext } from '../../core/types/binding.types';
import { ReportTemplate } from '../../core/types/template.types';
import { BindingEngine } from '../../core/binding/binding-engine';
import { PaginationEngine, RenderedPage } from '../../core/layout/pagination';
import { computePageDimensions } from '../../core/layout/dimensions';
import { Renderer, RenderInput } from '../renderer.interface';
import { blockStyleToCss, escapeHtml, fontStyleToCss, mergeCss, sanitizeRichText } from './css-utils';
import { barcodeSvg, qrSvg } from '../../utils/code-svg.utils';

/**
 * Minimum top gap (mm) reserved when a page has no header — keeps content
 * from sitting flush against the page edge. Mirrors the same constant in
 * the pdfmake renderer.
 */
const MIN_TOP_GAP_MM = 8;

/**
 * HTML renderer.
 *
 * Output is a fully self-contained HTML document — no external CSS, no JS.
 * That makes it safe to print directly, attach to email, or open in a webview.
 *
 * Print fidelity strategy:
 *   - Each page is a fixed-size <div class="page"> sized in mm.
 *   - @page CSS sets matching paper size + zero margins so the browser doesn't
 *     add its own. Margins are baked into the .page padding so the renderer
 *     fully owns layout.
 *   - We use absolute positioning for design-time blocks (free placement) and
 *     normal flow for table rows so wrapping and pagination work cleanly.
 */
export class HtmlRenderer implements Renderer<string> {
  private readonly binding: BindingEngine;
  private readonly pagination: PaginationEngine;

  constructor(binding?: BindingEngine, pagination?: PaginationEngine) {
    this.binding = binding ?? new BindingEngine();
    this.pagination = pagination ?? new PaginationEngine();
  }

  render(input: RenderInput): string {
    const { template, data } = input;
    const locale = input.locale ?? template.locale;
    const root = this.binding.createRoot(data, locale, input.vars ?? {});
    const pages = this.pagination.paginate(template, root);
    const dims = computePageDimensions(template.page);
    const totalPages = pages.length;

    const pageHtml = pages
      .map((p) => this.renderPage(template, p, this.binding.withPage(root, p.index + 1, totalPages)))
      .join('\n');

    const customCss = template.theme?.customCss ?? '';

    return `<!DOCTYPE html>
<html lang="${template.language}" dir="${template.direction}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(template.name)}</title>
<style>
@page { size: ${dims.width}mm ${dims.height}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #f5f5f5; }
body { font-family: ${template.theme?.fontFamily ?? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'}; }
.page {
  position: relative;
  width: ${dims.width}mm;
  height: ${dims.height}mm;
  /* Inside-margin origin: page padding reserves the user-configured page
     margins, so block coords (top: position.y) start at the inside of that
     padding. Setting any of page.margins to a positive value visibly shifts
     all content inward. */
  padding: ${dims.marginTop}mm ${dims.marginRight}mm ${dims.marginBottom}mm ${dims.marginLeft}mm;
  margin: 8mm auto;
  background: ${template.page.background ?? '#ffffff'};
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  overflow: hidden;
  page-break-after: always;
}
.page:last-of-type { page-break-after: auto; }
.block { position: absolute; }
.section { position: relative; }
.section-flow > .block { position: relative !important; }
.r-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
/* Mixed mode: any 'auto' column flips the whole table to content-based
   layout so the auto column actually content-sizes. Fixed/fraction widths
   become hints in this mode — browsers honor them when they fit. */
.r-table.r-table-auto { table-layout: auto; }
.r-table th, .r-table td { border: 0.25pt solid #d0d0d0; padding: 1mm 1.5mm; vertical-align: top; white-space: pre-line; word-wrap: break-word; overflow-wrap: anywhere; }
.r-table thead th { background: #f3f4f6; font-weight: 600; }
.r-table tfoot td { font-weight: 600; background: #fafafa; }
/* Borderless override (e.g. payments table with showBorder=false). The
   compound selector outranks the .r-table cell-border rule above without
   needing !important. */
table.r-table.r-no-border, table.r-table.r-no-border th, table.r-table.r-no-border td { border: 0; }
.r-zebra tr.r-odd { background: ${'#fafafa'}; }
.r-line { background: currentColor; }
.r-divider { width: 100%; }
.r-rect { width: 100%; height: 100%; }
.signature-line { border-bottom: 0.5pt solid #000; height: 1px; }
.watermark {
  position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
  pointer-events:none; z-index:0; user-select:none;
}
@media print {
  html, body { background: #fff; }
  .page { margin: 0; box-shadow: none; }
}
${customCss}
</style>
</head>
<body>
${pageHtml}
</body>
</html>`;
  }

  // ─── page rendering ─────────────────────────────────────────

  private renderPage(template: ReportTemplate, page: RenderedPage, ctx: BindingContext): string {
    const dims = computePageDimensions(template.page);
    // Each section uses section-local coordinates. Translate them to page-
    // content coords for HTML output:
    //   header → 0 (top)
    //   body   → header reservation height (just below the header band)
    //   footer → contentHeight − footer reservation (top of the footer band)
    //
    // When no header occupies the top of this page (no header section, or
    // a continuation page with repeatHeader=false), apply MIN_TOP_GAP_MM so
    // body content doesn't sit flush against the page edge.
    // Use the resolved heights from the pagination engine — they honor
    // explicit `section.height` overrides, fall back to block-derived,
    // and report 0 on continuation pages where the header is suppressed.
    // `maxBlocksHeight(page.headers)` would lose all of that.
    const headerH = page.headerHeightMm;
    const footerH = page.footerHeightMm;
    const bodyOffsetMm = headerH > 0 ? headerH : MIN_TOP_GAP_MM;
    const footerOffsetMm = Math.max(0, dims.contentHeight - footerH);

    const watermark = this.renderWatermark(template);
    const headers = page.headers.map((b) => this.renderBlock(b, ctx, page, 0)).join('');
    const footers = page.footers.map((b) => this.renderBlock(b, ctx, page, footerOffsetMm)).join('');
    // When `repeatFooter` is off, non-last pages get a small "continued…"
    // hint centered in the footer band (which is still reserved at full
    // height so subsequent block placement is unaffected).
    const continued = page.showContinuedFooter
      ? `<div class="r-continued" style="position:absolute; left:0; right:0; top:${footerOffsetMm}mm; height:${footerH}mm; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:8pt; font-style:italic; pointer-events:none;">continued…</div>`
      : '';
    // Honor MeasuredBlock.topMm — it can differ from block.position.y when
    // the pagination engine reflows below-table blocks onto a continuation
    // page. The y-offset compensates so the rendered top is `topMm + bodyOffsetMm`.
    const body = page.body
      .map((mb) => this.renderBlock(mb.block, ctx, page, mb.topMm - mb.block.position.y + bodyOffsetMm, footerOffsetMm))
      .join('');
    return `<div class="page" data-page="${page.index + 1}">
  ${watermark}
  ${headers}
  ${body}
  ${footers}
  ${continued}
</div>`;
  }

  private renderWatermark(template: ReportTemplate): string {
    const wm = template.page.watermark;
    if (!wm) return '';
    const opacity = wm.opacity ?? 0.08;
    const rotation = wm.rotation ?? -30;
    if (wm.text) {
      return `<div class="watermark" style="opacity:${opacity}; transform: rotate(${rotation}deg); font-size: 80pt; font-weight: 700; color: #000;">${escapeHtml(wm.text)}</div>`;
    }
    if (wm.image) {
      return `<div class="watermark" style="opacity:${opacity}; transform: rotate(${rotation}deg);"><img src="${wm.image}" style="max-width:60%; max-height:60%;" /></div>`;
    }
    return '';
  }

  // ─── block dispatch ─────────────────────────────────────────

  private renderBlock(block: Block, ctx: BindingContext, page: RenderedPage, yOffsetMm: number = 0, footerTopMm: number = Infinity): string {
    if (!this.binding.isTruthy(block.visibleWhen, ctx)) return '';
    const positionCss = this.positionCss(block, yOffsetMm);
    const styleCss = mergeCss(positionCss, blockStyleToCss(this.applyConditionalStyle(block, ctx)));

    switch (block.type) {
      case 'text':
        return `<div class="block" style="${styleCss}">${escapeHtml(this.binding.interpolate(block.text, ctx))}</div>`;

      case 'rich-text':
        return `<div class="block" style="${styleCss}">${sanitizeRichText(this.binding.interpolate(block.html, ctx))}</div>`;

      case 'dynamic-field': {
        const v = this.binding.evaluate(block.expression, ctx);
        return `<div class="block" style="${styleCss}">${escapeHtml(v === null || v === undefined ? '' : String(v))}</div>`;
      }

      case 'image': {
        // Either an explicit `binding` field, or a `source` that may itself
        // contain {{...}} placeholders. Interpolation is fail-soft so a missing
        // image just renders an empty <img> rather than throwing.
        const src = block.binding
          ? String(this.binding.evaluate(block.binding, ctx) ?? '')
          : this.binding.interpolate(block.source, ctx);
        const fit = block.fit ?? 'contain';
        return `<div class="block" style="${styleCss}"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt ?? '')}" style="width:100%;height:100%;object-fit:${fit};" /></div>`;
      }

      case 'line': {
        const isV = block.orientation === 'vertical' || block.size.height > block.size.width;
        return `<div class="block r-line" style="${styleCss}; background:${block.color}; ${isV ? `width:${block.thickness}pt` : `height:${block.thickness}pt`};"></div>`;
      }

      case 'rectangle': {
        // Precedence: `style.background` (panel-controlled) wins over the
        // legacy `fill` field. The factory seeds `fill: '#f3f4f6'`, which
        // would otherwise mask any user edit made via the panel.
        const fill = block.style?.background ?? block.fill ?? 'transparent';
        const radius = block.borderRadius ? `border-radius: ${block.borderRadius}mm` : '';
        return `<div class="block r-rect" style="${mergeCss(styleCss, `background: ${fill}`, radius)}"></div>`;
      }

      case 'divider': {
        const color = block.color ?? '#e5e7eb';
        const thickness = block.thickness ?? 0.5;
        const style = block.pattern === 'dashed' ? 'dashed' : block.pattern === 'dotted' ? 'dotted' : 'solid';
        return `<div class="block" style="${styleCss}; border-top:${thickness}pt ${style} ${color};"></div>`;
      }

      case 'qr-code': {
        const value = this.binding.interpolate(block.value, ctx);
        // Foreground follows the block's font color so a QR inherits the
        // theme like any other block; background falls back to transparent
        // white rather than the page color, since scanners need contrast.
        const qrStyle = this.applyConditionalStyle(block, ctx);
        const svg = qrSvg(value, {
          ecLevel: block.ecLevel,
          margin: block.margin,
          dark: qrStyle?.font?.color,
          light: qrStyle?.background,
        });
        return `<div class="block" style="${styleCss}" data-qr="${escapeHtml(value)}">${svg}</div>`;
      }

      case 'barcode': {
        const value = this.binding.interpolate(block.value, ctx);
        const bcStyle = this.applyConditionalStyle(block, ctx);
        const svg = barcodeSvg(value, block.symbology, {
          showText: block.showText,
          dark: bcStyle?.font?.color,
          light: bcStyle?.background,
        });
        return `<div class="block" style="${styleCss}" data-barcode="${escapeHtml(value)}" data-symbology="${block.symbology}">${svg}</div>`;
      }

      case 'signature': {
        // Honor block.style for everything: blockCss is already on the
        // outer wrapper (font/color/background/padding). The line picks up
        // style.border.bottom when set, otherwise a default in the font
        // color so the signature theme reads cohesively.
        const sigBorder = block.style?.border?.bottom;
        const lineColor = sigBorder?.color ?? block.style?.font?.color ?? '#000';
        const lineWidth = sigBorder?.width ?? 0.5;
        const lineStyle = sigBorder?.style ?? 'solid';
        const align = block.style?.align ?? 'center';
        return `<div class="block" style="${styleCss}; display:flex; flex-direction:column; justify-content:flex-end;">
          <div style="width:100%; border-bottom: ${lineWidth}pt ${lineStyle} ${lineColor};"></div>
          <div style="text-align:${align}; margin-top:1mm;">${escapeHtml(block.label ?? '')}</div>
        </div>`;
      }

      case 'page-number':
        return `<div class="block" style="${styleCss}">${escapeHtml(this.binding.interpolate(block.format, ctx))}</div>`;

      case 'totals':
        return this.renderTotals(block, ctx, styleCss);

      case 'payments':
        return this.renderPayments(block, ctx, styleCss);

      case 'group-header':
      case 'group-footer':
        // Group headers/footers in the body section are static labels —
        // dynamic ones live inside table grouping.
        return `<div class="block" style="${styleCss}">${escapeHtml(this.binding.interpolate(block.template, ctx))}</div>`;

      case 'table': {
        // Cap the table at the top of the page-footer band so a table whose
        // rendered rows outgrew their `rowMinHeight` budget (multi-line
        // text, oversize image) can't paint past the footer. Computed in
        // page-content (inside-margin) coordinates, same frame the block's
        // `top` resolves to.
        const tableTopMm = block.position.y + yOffsetMm;
        const maxTableHMm = Math.max(0, footerTopMm - tableTopMm);
        return this.renderTable(block, ctx, page, styleCss, maxTableHMm);
      }
      case 'repeater': {
        // The repeater's own style (border/background/font/padding) is
        // applied to EACH card so the user gets one bordered card per row
        // rather than one box around the whole list. The outer wrapper
        // only carries positioning + the slice clip.
        const cardCss = blockStyleToCss(this.applyConditionalStyle(block, ctx));
        return this.renderRepeater(block, ctx, page, positionCss, cardCss, yOffsetMm, footerTopMm);
      }
    }
  }

  private renderPayments(
    block: Extract<Block, { type: 'payments' }>,
    ctx: BindingContext,
    styleCss: string,
  ): string {
    const rows = this.applyRowVisibility(
      block.rowVisibleWhen,
      this.binding.resolveArray(block.dataSource, ctx),
      ctx,
    );
    const currency = block.currency ?? 'BHD';
    const ids = block.columns ?? DEFAULT_PAYMENT_COLUMNS;
    // Filter the catalog by selected IDs, preserving the IDs' order — this
    // is the canonical "what columns + in what order" projection used by all
    // three renderers (HTML, PDF, designer preview).
    const cols: PaymentColumnDef[] = ids
      .map((id) => PAYMENT_COLUMN_CATALOG.find((c) => c.id === id))
      .filter((c): c is PaymentColumnDef => !!c);

    const head = block.showHeader === false
      ? ''
      : `<thead><tr>${cols
          .map((c) => `<th style="text-align:${c.align}">${escapeHtml(c.label)}</th>`)
          .join('')}</tr></thead>`;

    const body = rows
      .map((row, i) => {
        const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, i);
        const cls = i % 2 === 1 ? 'r-odd' : '';
        const cells = cols
          .map((c) => {
            const expr = c.isAmount ? `${c.expression} | currency:${currency}` : c.expression;
            const v = this.binding.evaluate(expr, rowCtx);
            return `<td style="text-align:${c.align}">${escapeHtml(this.toCellText(v))}</td>`;
          })
          .join('');
        return `<tr class="${cls}">${cells}</tr>`;
      })
      .join('');

    const classes = ['r-table'];
    if (block.zebra) classes.push('r-zebra');
    if (block.showBorder === false) classes.push('r-no-border');
    return `<div class="block" style="${styleCss}">
      <table class="${classes.join(' ')}">
        ${head}
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }

  private toCellText(v: unknown): string {
    return v === null || v === undefined ? '' : String(v);
  }

  /** Filter rows by a per-row visibility expression. `expr` undefined → no
   *  filter. Each row is evaluated under its own row context (so `row.x`
   *  paths resolve as expected). Used by both Table and Payments. */
  private applyRowVisibility(
    expr: string | undefined,
    rows: unknown[],
    ctx: BindingContext,
  ): unknown[] {
    if (!expr) return rows;
    return rows.filter((row, i) => {
      const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, i);
      return this.binding.isTruthy(expr, rowCtx);
    });
  }

  // ─── Block renderers ───────────────────────────────────────

  private renderTotals(
    block: Extract<Block, { type: 'totals' }>,
    ctx: BindingContext,
    styleCss: string,
  ): string {
    const labelW = block.labelWidth ?? 35;
    const rowsHtml = block.rows
      .map((r) => {
        // If a format pipe is provided, append it to the expression and re-evaluate.
        const expr = r.format ? `${r.expression} | ${r.format}` : r.expression;
        const v = this.binding.evaluate(expr, ctx);
        const valStr = v === null || v === undefined ? '' : String(v);
        const weight = r.bold ? 'font-weight:600;' : '';
        return `<tr style="${weight}">
          <td style="width:${labelW}mm;padding:0.5mm 1mm;">${escapeHtml(r.label)}</td>
          <td style="text-align:right;padding:0.5mm 1mm;">${escapeHtml(valStr)}</td>
        </tr>`;
      })
      .join('');
    return `<div class="block" style="${styleCss}"><table style="width:100%;border-collapse:collapse;">${rowsHtml}</table></div>`;
  }

  private renderTable(
    block: TableBlock,
    ctx: BindingContext,
    page: RenderedPage,
    styleCss: string,
    maxHeightMm: number = Infinity,
  ): string {
    const slice = page.tableSlices.get(block.id);
    const rawSliceRows: unknown[] = slice?.rows ?? this.binding.resolveArray(block.dataSource, ctx);
    // Per-row filter is applied AFTER pagination — pagination decides which
    // rows live on this page based on the raw array, then visibility hides
    // some of those. Aggregates use the fully-filtered all-rows view so
    // totals reflect what the reader actually sees.
    const rows = this.applyRowVisibility(block.rowVisibleWhen, rawSliceRows, ctx);
    const showHeader = block.showHeader && (slice?.isFirstSlice ?? true) || block.repeatHeader;
    const showFooter = block.showFooter && (slice?.isLastSlice ?? true);
    const allRows = this.applyRowVisibility(
      block.rowVisibleWhen,
      this.binding.resolveArray(block.dataSource, ctx),
      ctx,
    );

    // Column widths.
    //   - fixed mm    → literal mm
    //   - fraction    → CSS calc() sharing remaining width weighted by `fr`
    //                  (only relative to OTHER fraction columns, not autos)
    //   - auto        → no width hint; lets table-layout: auto content-size it
    //
    // When any column is auto the whole table flips to table-layout: auto via
    // the `r-table-auto` class so the auto column actually grows to fit its
    // content. In that mode the fixed/fraction widths become browser hints,
    // not strict caps — matches what users expect from a mixed-mode table.
    const fixedTotalMm = block.columns.reduce(
      (s, c) => s + (c.width.kind === 'fixed' ? c.width.mm : 0),
      0,
    );
    const fractionTotal = block.columns.reduce(
      (s, c) => s + (c.width.kind === 'fraction' ? c.width.fr : 0),
      0,
    );
    const colGroup = block.columns
      .map((c) => {
        if (c.width.kind === 'fixed') return `<col style="width:${c.width.mm}mm" />`;
        if (c.width.kind === 'fraction') {
          if (fractionTotal <= 0) return `<col />`;
          const share = c.width.fr / fractionTotal;
          return `<col style="width:calc((100% - ${fixedTotalMm}mm) * ${share})" />`;
        }
        // auto — emit no width so the browser content-sizes the column.
        return `<col />`;
      })
      .join('');

    const head = showHeader
      ? `<thead><tr>${block.columns
          .map((c) => {
            const css = mergeCss(blockStyleToCss(c.headerStyle), c.align ? `text-align:${c.align}` : '');
            return `<th style="${css}">${escapeHtml(this.binding.interpolate(c.header, ctx))}</th>`;
          })
          .join('')}</tr></thead>`
      : '';

    // Slice start index — pagination assigns rows 0..N-1 to page 1, N..M to
    // page 2, etc. The renderer must offset its loop counter so `rowIndex`
    // expressions reflect the row's absolute position in the source array
    // (which is what users expect for "row #" / "rowIndex + 1" columns).
    const startIndex = slice?.startIndex ?? 0;
    const groupedBody = block.groups && block.groups.length > 0
      ? this.renderGroupedRows(block, rows, ctx, startIndex)
      : this.renderFlatRows(block, rows, ctx, startIndex);

    const foot = showFooter
      ? `<tfoot><tr>${block.columns
          .map((c) => {
            const css = mergeCss(blockStyleToCss(c.cellStyle), c.align ? `text-align:${c.align}` : '');
            const f = c.footer;
            if (!f) return `<td style="${css}"></td>`;
            const value = f.kind === 'custom' && f.expression
              ? this.binding.evaluate(f.expression, ctx)
              : this.binding.aggregate(f.kind === 'custom' ? 'sum' : f.kind, allRows, f.expression ?? c.expression, ctx);
            const formatted = f.format
              ? this.binding.evaluate(`x | ${f.format}`, { ...ctx, vars: { ...ctx.vars, x: value } } as BindingContext)
              : value;
            return `<td style="${css}">${escapeHtml(String(formatted ?? ''))}</td>`;
          })
          .join('')}</tr></tfoot>`
      : '';

    const hasAutoCol = block.columns.some((c) => c.width.kind === 'auto');
    const classes = ['r-table'];
    if (block.zebra) classes.push('r-zebra');
    if (hasAutoCol) classes.push('r-table-auto');
    // Clip the table wrapper at the top of the page-footer band so a table
    // whose rendered rows grew past their `rowMinHeight` budget can't paint
    // over the footer. The cap is computed by the caller from the page
    // layout — Infinity falls back to natural growth when no footer exists.
    const clipCss = Number.isFinite(maxHeightMm)
      ? `max-height:${maxHeightMm}mm; overflow:hidden;`
      : '';
    return `<div class="block" style="${styleCss}; ${clipCss}">
      <table class="${classes.join(' ')}">
        <colgroup>${colGroup}</colgroup>
        ${head}
        ${groupedBody}
        ${foot}
      </table>
    </div>`;
  }

  /**
   * Render a `repeater` (card list) — one card per row in `dataSource`,
   * stacked vertically. Each card hosts the block's `items[]` rendered with
   * `row`-scoped bindings, so child text/image expressions resolve to that
   * row's data. The wrapper is clipped at the page-footer band, same as
   * tables, so an over-long list can't paint over the footer.
   */
  private renderRepeater(
    block: Extract<Block, { type: 'repeater' }>,
    ctx: BindingContext,
    page: RenderedPage,
    wrapperCss: string,
    cardCss: string,
    yOffsetMm: number,
    footerTopMm: number,
  ): string {
    // Use the paginated slice when present so a long card-list flows across
    // pages instead of overlaying the footer. Falls back to the full array
    // for pre-pagination contexts (none today, but defensive).
    const slice = page.repeaterSlices.get(block.id);
    const sliceRows = slice ? slice.rows : this.binding.resolveArray(block.dataSource, ctx);
    const startIndex = slice?.startIndex ?? 0;
    const rows = this.applyRowVisibility(block.rowVisibleWhen, sliceRows, ctx);
    const itemH = block.itemHeight;
    const gap = block.itemSpacing ?? 0;
    const direction = block.direction ?? 'vertical';
    const cards = rows
      .map((row, i) => {
        const absIdx = startIndex + i;
        const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, absIdx);
        const childMarkup = block.items
          .map((c) => this.renderBlock(c, rowCtx, page, 0, Infinity))
          .join('');
        const offsetMm = i * (itemH + gap);
        const cardW = direction === 'horizontal' ? itemH : block.size.width;
        const offsetCss = direction === 'horizontal'
          ? `left:${offsetMm}mm; top:0;`
          : `left:0; top:${offsetMm}mm;`;
        // Apply the repeater block's visual style (border, background,
        // padding, font) to EACH card so the border draws around every
        // row instead of around the entire list. Corner radius is
        // per-card too — rounding the list as a whole would only round
        // the first and last cards.
        //
        // `mergeCss` joins fragments with `; ` so a missing trailing
        // semicolon on `cardCss` can't swallow the radius into the
        // previous property's value.
        const radiusCss = block.borderRadius ? `border-radius: ${block.borderRadius}mm` : '';
        const cardStyle = mergeCss(
          `position: absolute`,
          offsetCss.replace(/;$/, ''),
          `width: ${cardW}mm`,
          `height: ${itemH}mm`,
          `overflow: hidden`,
          cardCss,
          radiusCss,
        );
        return `<div class="r-card" style="${cardStyle}">${childMarkup}</div>`;
      })
      .join('');
    // Explicit total height — cards are absolutely positioned, so without
    // this the wrapper collapses to 0 and overflow:hidden hides every card.
    const totalCount = rows.length;
    const totalMm = totalCount > 0 ? totalCount * itemH + Math.max(0, totalCount - 1) * gap : 0;
    const totalCss = direction === 'horizontal'
      ? `width:${totalMm}mm; height:${itemH}mm;`
      : `width:${block.size.width}mm; height:${totalMm}mm;`;
    // Clip the whole repeater at the footer band so an over-long card list
    // doesn't bleed into the footer area.
    const topMm = block.position.y + yOffsetMm;
    const maxHMm = Math.max(0, footerTopMm - topMm);
    const clipCss = Number.isFinite(maxHMm) ? `max-height:${maxHMm}mm; overflow:hidden;` : '';
    return `<div class="block" style="${wrapperCss}; ${clipCss}">
      <div style="position:relative; ${totalCss}">
        ${cards}
      </div>
    </div>`;
  }

  private renderFlatRows(block: TableBlock, rows: unknown[], ctx: BindingContext, startIndex: number = 0): string {
    const rowH = block.rowMinHeight ?? 7;
    // Effective body-row height: pagination uses max(rowMinHeight, tallest
    // imageHeightMm) to budget how many rows fit per page, but a <tr> only
    // grows to its content's natural height — so a row with a 30mm image
    // column would still be ~14mm tall in HTML, leaving the table shorter
    // than pagination assumed and creating dead space before below-table
    // blocks. Pin every <tr> to that same effective height so the rendered
    // table matches the paginated budget exactly.
    let maxImg = 0;
    for (const c of block.columns) {
      if (c.cellType === 'image' && typeof c.imageHeightMm === 'number') {
        if (c.imageHeightMm > maxImg) maxImg = c.imageHeightMm;
      }
    }
    const trHeightMm = Math.max(rowH, maxImg);
    const body = rows
      .map((row, i) => {
        const absIdx = startIndex + i;
        const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, absIdx);
        const cls = absIdx % 2 === 1 ? 'r-odd' : '';
        return `<tr class="${cls}" style="height:${trHeightMm}mm">${block.columns
          .map((c) => {
            const css = mergeCss(
              blockStyleToCss(this.applyColumnConditional(c, rowCtx)),
              c.align ? `text-align:${c.align}` : '',
            );
            const v = this.binding.evaluateCell(c.expression, rowCtx);
            if (c.cellType === 'image') {
              const src = v === null || v === undefined ? '' : String(v);
              const hMm = c.imageHeightMm ?? rowH;
              return `<td style="${css}"><img src="${escapeHtml(src)}" alt="" style="max-height:${hMm}mm;max-width:100%;object-fit:contain;display:block;margin:auto;" /></td>`;
            }
            return `<td style="${css}">${escapeHtml(v === null || v === undefined ? '' : String(v))}</td>`;
          })
          .join('')}</tr>`;
      })
      .join('');
    return `<tbody>${body}</tbody>`;
  }

  private renderGroupedRows(block: TableBlock, rows: unknown[], ctx: BindingContext, startIndex: number = 0): string {
    const group = block.groups![0]; // simple single-level grouping for now
    const buckets = new Map<unknown, unknown[]>();
    rows.forEach((row, i) => {
      const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, startIndex + i);
      const key = this.binding.evaluate(group.by, rowCtx);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    });

    const colCount = block.columns.length;
    let groupIndex = 0;
    let cumulative = startIndex;
    const out: string[] = [];
    for (const [key, bucketRows] of buckets) {
      const groupCtx = this.binding.withGroup(ctx, key, bucketRows, groupIndex);
      if (group.showHeader && group.headerExpression) {
        out.push(
          `<tr class="r-group-header"><td colspan="${colCount}" style="background:#f3f4f6;font-weight:600;padding:1mm 1.5mm;">${escapeHtml(
            this.binding.interpolate(group.headerExpression, groupCtx),
          )}</td></tr>`,
        );
      }
      out.push(this.renderFlatRows(block, bucketRows, ctx, cumulative).replace('<tbody>', '').replace('</tbody>', ''));
      cumulative += bucketRows.length;
      if (group.showFooter && group.footerExpression) {
        out.push(
          `<tr class="r-group-footer"><td colspan="${colCount}" style="font-style:italic;padding:1mm 1.5mm;">${escapeHtml(
            this.binding.interpolate(group.footerExpression, groupCtx),
          )}</td></tr>`,
        );
      }
      groupIndex++;
    }
    return `<tbody>${out.join('')}</tbody>`;
  }

  // ─── helpers ────────────────────────────────────────────────

  private positionCss(block: Block, yOffsetMm: number = 0): string {
    return `left:${block.position.x}mm; top:${block.position.y + yOffsetMm}mm; width:${block.size.width}mm; ${
      block.size.autoHeight ? '' : `height:${block.size.height}mm;`
    } z-index:${block.zIndex ?? 1};`;
  }

  private applyConditionalStyle(block: Block, ctx: BindingContext) {
    if (!block.conditionalStyles?.length) return block.style;
    let merged = { ...(block.style ?? {}) };
    for (const c of block.conditionalStyles) {
      if (this.binding.isTruthy(c.when, ctx)) {
        merged = { ...merged, ...c.style, font: { ...merged.font, ...c.style.font } };
      }
    }
    return merged;
  }

  private applyColumnConditional(
    col: TableBlock['columns'][number],
    ctx: BindingContext,
  ) {
    if (!col.conditionalStyles?.length) return col.cellStyle;
    let merged = { ...(col.cellStyle ?? {}) };
    for (const c of col.conditionalStyles) {
      if (this.binding.isTruthy(c.when, ctx)) {
        merged = { ...merged, ...c.style, font: { ...merged.font, ...c.style.font } };
      }
    }
    return merged;
  }

}
