import { Block, TableBlock, isBlockOfType } from '../types/block.types';
import { ReportTemplate, Section } from '../types/template.types';
import { BindingEngine } from '../binding/binding-engine';
import { BindingContext } from '../types';
import { PageDimensions, approximateTextHeightMm, computePageDimensions } from './dimensions';

/** Mirrors `MIN_TOP_GAP_MM` in the renderers — the floor applied when a
 *  page renders no header so body content doesn't sit flush at the top. */
const MIN_TOP_GAP_MM = 8;

/**
 * The pagination engine produces a list of "rendered pages": each page knows
 * which blocks live on it, including row-sliced tables and repeating
 * headers/footers. Renderers consume this and emit HTML/PDF accordingly.
 *
 * Strategy:
 *   1. Reserve page-header / page-footer / first-page-header / last-page-footer.
 *   2. For each body block, compute its measured height. Static blocks are
 *      placed by Y position; tables are split row-by-row when they overflow.
 *   3. Anything that doesn't fit gets bumped to the next page.
 */

export interface MeasuredBlock {
  block: Block;
  /** Effective top in mm relative to page content area. */
  topMm: number;
  heightMm: number;
}

export interface RenderedPage {
  index: number; // 0-based
  isFirst: boolean;
  isLast: boolean;
  headers: Block[];
  footers: Block[];
  /** Reserved header height for THIS page in mm — `section.height` when
   *  set, else block-derived. Zero on continuation pages with no header.
   *  Renderers should use this for body offset / footer offset rather
   *  than re-deriving from `headers[]`, which loses the explicit height. */
  headerHeightMm: number;
  /** Reserved footer height for THIS page in mm. Same rules as
   *  `headerHeightMm`; includes the last-page footer on the final page. */
  footerHeightMm: number;
  body: MeasuredBlock[];
  /** Slice info for tables that span across this page. */
  tableSlices: Map<string, { rows: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number }>;
  /** Same shape as `tableSlices`, but for `repeater` (card-list) blocks. */
  repeaterSlices: Map<string, { rows: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number }>;
  /** True when the page-footer section is suppressed on this page — set on
   *  non-last pages when `page.repeatFooter === false`. Renderers should
   *  emit a "continued…" indicator in the footer band when this is true. */
  showContinuedFooter?: boolean;
}

export class PaginationEngine {
  constructor(private readonly binding: BindingEngine = new BindingEngine()) {}

  paginate(template: ReportTemplate, ctx: BindingContext): RenderedPage[] {
    const dims = computePageDimensions(template.page);
    const headerSection = this.findSection(template, 'page-header');
    const footerSection = this.findSection(template, 'page-footer');
    const firstHeaderSection = this.findSection(template, 'first-page-header');
    const lastFooterSection = this.findSection(template, 'last-page-footer');
    const body = this.findSection(template, 'body');

    const headerH = this.sectionHeight(headerSection, dims);
    const firstHeaderH = this.sectionHeight(firstHeaderSection, dims);
    const footerH = this.sectionHeight(footerSection, dims);

    if (!body) return [];

    // Below-data blocks (y >= the last paginating block's designed bottom)
    // are pulled OUT of the normal per-page queue. They get appended to the
    // page on which that block actually finishes, with `topMm` adjusted so
    // they sit just after its real end — never overlapping content that
    // grew past the block's designed height.
    //
    // "Paginating block" = table OR repeater. Both slice across pages, so
    // anything positioned below either of them needs to reflow.
    const isPaginating = (b: Block): boolean => isBlockOfType(b, 'table') || isBlockOfType(b, 'repeater');
    const paginatingInBody = body.blocks.filter(isPaginating);
    // Lowest designed bottom of any paginating block — that's our reflow
    // anchor. With both a table and a repeater present, blocks below either
    // need to reflow, so use the max.
    const tableAnchorY = paginatingInBody.length > 0
      ? Math.max(...paginatingInBody.map((b) => b.position.y + b.size.height))
      : Infinity;
    const belowTableBlocks = body.blocks
      .filter((b) => !isPaginating(b) && b.position.y >= tableAnchorY)
      .sort((a, b) => a.position.y - b.position.y);

    // Sort body blocks by Y to support flow placement. Exclude below-data
    // blocks since they're appended separately on the last data-block page.
    const sorted = body.blocks
      .filter((b) => isPaginating(b) || b.position.y < tableAnchorY)
      .sort((a, b) => a.position.y - b.position.y);

    // page.repeatHeader === false → page-header only on page 1 (unless a
    // dedicated first-page-header is present, which always overrides p1).
    const repeatHeader = template.page.repeatHeader !== false;
    // page.repeatFooter === false → page-footer only on last page. Non-last
    // pages get a "continued" indicator in the footer band instead. The band
    // height is still reserved so tables stop at the same place either way.
    const repeatFooter = template.page.repeatFooter !== false;

    const pages: RenderedPage[] = [];
    let pageIndex = 0;
    let queue = [...sorted];
    // Below-table blocks pending placement — kept across pages so a row
    // that doesn't fit can defer to the next page.
    let pendingBelow: Block[] = [...belowTableBlocks];
    // Track table progress when a table overflows.
    const tableProgress = new Map<string, { rows: unknown[]; cursor: number }>();
    // Same idea for repeaters — long card lists slice across pages.
    const repeaterProgress = new Map<string, { rows: unknown[]; cursor: number }>();

    while (queue.length > 0 || pendingBelow.length > 0 || pageIndex === 0) {
      const isFirst = pageIndex === 0;
      // Body blocks use section-local coordinates (y=0 at the top of the body
      // band). Reservation depends on which header (if any) actually renders
      // on THIS page — when nothing renders, fall back to MIN_TOP_GAP_MM so
      // content doesn't sit flush against the page edge.
      const headerHForPage = isFirst
        ? firstHeaderSection ? firstHeaderH : headerH
        : repeatHeader ? headerH : 0;
      const reservedTop = headerHForPage > 0 ? headerHForPage : MIN_TOP_GAP_MM;
      const usableHeight = Math.max(0, dims.contentHeight - reservedTop - footerH);
      // Tables do row-slicing within the body band; same cap as static blocks.
      const tableMaxBottom = usableHeight;

      const placed: MeasuredBlock[] = [];
      const tableSlices = new Map<
        string,
        { rows: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number }
      >();
      const repeaterSlices = new Map<
        string,
        { rows: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number }
      >();
      const remaining: Block[] = [];

      // Body blocks are absolutely positioned by the designer. Use each block's
      // own y-coordinate to decide whether it fits on this page — do NOT stack
      // sequentially, because that incorrectly sums the heights of side-by-side
      // blocks (e.g. left and right cards) and produces phantom overflow pages.
      for (const block of queue) {
        // Visibility short-circuit.
        if (!this.binding.isTruthy(block.visibleWhen, ctx)) continue;

        if (isBlockOfType(block, 'table')) {
          // First slice → designed y. Continuation slices → top of body
          // band, so a long table on page 2+ doesn't leave dead space at
          // the top equal to its original `position.y`.
          const isFirstSlice = !tableProgress.has(block.id);
          const tableTop = isFirstSlice ? block.position.y : 0;
          const placedRows = this.placeTableRows(block, ctx, tableMaxBottom - tableTop, tableProgress);
          if (placedRows.rowsThisPage.length > 0 || placedRows.isFirstSlice) {
            const heightMm = this.tableHeightMm(block, placedRows.rowsThisPage.length, placedRows.isFirstSlice, placedRows.isLastSlice);
            placed.push({ block, topMm: tableTop, heightMm });
            tableSlices.set(block.id, {
              rows: placedRows.rowsThisPage,
              isFirstSlice: placedRows.isFirstSlice,
              isLastSlice: placedRows.isLastSlice,
              startIndex: placedRows.startIndex,
            });
          }
          if (!placedRows.isLastSlice) {
            remaining.push(block); // table continues next page
          }
          continue;
        }

        if (isBlockOfType(block, 'repeater')) {
          // Same pattern as tables — pack cards into the page's vertical
          // budget, then defer the rest to the next page. First slice
          // anchors at `position.y`, continuation slices at the top of the
          // body band.
          const isFirstSlice = !repeaterProgress.has(block.id);
          const top = isFirstSlice ? block.position.y : 0;
          const placedRows = this.placeRepeaterRows(block, ctx, tableMaxBottom - top, repeaterProgress);
          if (placedRows.rowsThisPage.length > 0 || placedRows.isFirstSlice) {
            const heightMm = this.repeaterHeightMm(block, placedRows.rowsThisPage.length);
            placed.push({ block, topMm: top, heightMm });
            repeaterSlices.set(block.id, {
              rows: placedRows.rowsThisPage,
              isFirstSlice: placedRows.isFirstSlice,
              isLastSlice: placedRows.isLastSlice,
              startIndex: placedRows.startIndex,
            });
          }
          if (!placedRows.isLastSlice) {
            remaining.push(block);
          }
          continue;
        }

        const h = this.measureBlockHeight(block);
        const top = block.position.y;
        // Static blocks only appear on the first page; continuation pages
        // contain only the overflowing table.
        if (!isFirst) continue;
        if (top + h > usableHeight) continue; // clipped — designer should fix
        placed.push({ block, topMm: top, heightMm: h });
      }

      // Below-data reflow: once no paginating blocks (tables OR repeaters)
      // are pending continuation, the queued below-data blocks land here.
      // Side-by-side pairs (notes ↔ totals at the same y) are kept together
      // so they don't get split across pages. If a row would overflow into
      // the footer band, defer the rest to `pendingBelow` so they pick up
      // on the next page — never overlapping the footer.
      const paginatingDone = remaining.every((b) => !isPaginating(b));
      if (paginatingDone && pendingBelow.length > 0) {
        // Anchor below whichever paginating block lives furthest down in
        // the designed layout — that's the one whose real bottom edge the
        // below-data blocks need to chase.
        const anchorBlock = paginatingInBody.reduce<Block | null>((acc, b) => {
          if (!acc) return b;
          return b.position.y + b.size.height > acc.position.y + acc.size.height ? b : acc;
        }, null);
        const lastAnchorPlaced = anchorBlock
          ? placed.find((m) => m.block.id === anchorBlock.id)
          : undefined;
        const designedAnchorEndY = anchorBlock
          ? anchorBlock.position.y + anchorBlock.size.height
          : 0;
        // Anchor for the FIRST below-row on this page:
        //   - last-data-page → just past the data block's actual bottom
        //   - continuation-only page (data block finished earlier) → top of body
        let cursorAdjustedY = lastAnchorPlaced
          ? lastAnchorPlaced.topMm + lastAnchorPlaced.heightMm
          : 0;
        let cursorDesignedY = lastAnchorPlaced ? designedAnchorEndY : 0;

        const rows = this.groupRowsByY(pendingBelow);
        const stillPending: Block[] = [];
        let deferring = false;
        for (const row of rows) {
          if (deferring) {
            stillPending.push(...row);
            continue;
          }
          const rowTopY = Math.min(...row.map((b) => b.position.y));
          const rowBottomY = Math.max(...row.map((b) => b.position.y + b.size.height));
          const rowDesignedHeight = rowBottomY - rowTopY;
          const designedGap = Math.max(0, rowTopY - cursorDesignedY);
          const rowAdjustedTop = cursorAdjustedY + designedGap;
          if (rowAdjustedTop + rowDesignedHeight > usableHeight) {
            // Doesn't fit on this page — push this row and the rest to next page.
            deferring = true;
            stillPending.push(...row);
            continue;
          }
          for (const b of row) {
            if (!this.binding.isTruthy(b.visibleWhen, ctx)) continue;
            const h = this.measureBlockHeight(b);
            const offsetInRow = b.position.y - rowTopY;
            placed.push({ block: b, topMm: rowAdjustedTop + offsetInRow, heightMm: h });
          }
          cursorAdjustedY = rowAdjustedTop + rowDesignedHeight;
          cursorDesignedY = rowBottomY;
        }
        pendingBelow = stillPending;
      }

      const headersForPage =
        isFirst && firstHeaderSection
          ? firstHeaderSection.blocks
          : isFirst || repeatHeader
            ? headerSection?.blocks ?? []
            : [];

      // Resolved header/footer heights for THIS page — `section.height` if
      // the user pinned it, else block-derived. `headerHForPage` is already
      // computed above and is what the layout reserved (zero on
      // header-suppressed continuation pages). Footer height is the same
      // for every page until the final one (last-page footer is merged in
      // a patch below, so adjust there too).
      // When `repeatFooter` is false, non-last pages omit the real footer
      // blocks (last-page patch below promotes the final page back to the
      // full footer). The band's height stays reserved so block placement
      // is identical — the renderers paint a "continued" indicator in
      // that empty band.
      const footersForPage = repeatFooter ? footerSection?.blocks ?? [] : [];
      pages.push({
        index: pageIndex,
        isFirst,
        isLast: false, // patched
        headers: headersForPage,
        footers: footersForPage,
        headerHeightMm: headerHForPage,
        footerHeightMm: footerH,
        body: placed,
        tableSlices,
        repeaterSlices,
        showContinuedFooter: !repeatFooter,
      });

      queue = remaining;
      pageIndex++;
      if (pageIndex > 500) {
        // Hard guard against runaway loops in malformed templates.
        throw new Error('Pagination produced more than 500 pages — aborting.');
      }
      // Keep generating pages while EITHER the main queue or the
      // below-data reflow queue still has work. Breaking only on
      // `queue.length === 0` would strand any below-card blocks the
      // reflow had to defer (e.g. totals/notes that didn't fit on the
      // last card-list page).
      if (queue.length === 0 && pendingBelow.length === 0) break;
    }

    if (pages.length === 0) {
      pages.push({
        index: 0,
        isFirst: true,
        isLast: true,
        headers: headerSection?.blocks ?? [],
        footers: footerSection?.blocks ?? [],
        headerHeightMm: headerSection ? this.sectionHeight(headerSection, dims) : 0,
        footerHeightMm: footerSection ? this.sectionHeight(footerSection, dims) : 0,
        body: [],
        tableSlices: new Map(),
        repeaterSlices: new Map(),
      });
    }

    // Patch last-page flag and merge last-page footer. The last-page
    // footer can be taller than the regular footer, so re-resolve the
    // reserved footer height for that page only.
    const last = pages[pages.length - 1];
    last.isLast = true;
    // When repeatFooter was suppressed on non-last pages, the final page
    // must still receive the full footer — promote it back here.
    last.showContinuedFooter = false;
    if (!repeatFooter) last.footers = footerSection?.blocks ?? [];
    if (lastFooterSection) {
      last.footers = [...last.footers, ...lastFooterSection.blocks];
      last.footerHeightMm = Math.max(
        last.footerHeightMm,
        this.sectionHeight(lastFooterSection, dims),
      );
    }

    return pages;
  }

  // ─── helpers ─────────────────────────────────────────────────

  /**
   * Group blocks into rows by Y-position so side-by-side pairs (notes ↔
   * totals at the same designed y) stay together when reflowed below the
   * table. Anything within `tolMm` of the row's leading y joins that row.
   */
  private groupRowsByY(blocks: Block[], tolMm = 5): Block[][] {
    const sorted = [...blocks].sort((a, b) => a.position.y - b.position.y);
    const rows: Block[][] = [];
    let current: Block[] = [];
    let leadY = -Infinity;
    for (const b of sorted) {
      if (b.position.y - leadY > tolMm) {
        if (current.length) rows.push(current);
        current = [b];
        leadY = b.position.y;
      } else {
        current.push(b);
      }
    }
    if (current.length) rows.push(current);
    return rows;
  }

  private findSection(template: ReportTemplate, type: Section['type']): Section | undefined {
    return template.sections.find((s) => s.type === type);
  }

  private sectionHeight(section: Section | undefined, dims: PageDimensions): number {
    if (!section) return 0;
    if (section.height) return section.height;
    // Auto: max bottom edge of contained blocks, capped at 30% of content height.
    let max = 0;
    for (const b of section.blocks) {
      max = Math.max(max, b.position.y + b.size.height);
    }
    return Math.min(max, dims.contentHeight * 0.3);
  }

  private measureBlockHeight(block: Block): number {
    if (!block.size.autoHeight) return block.size.height;

    if (isBlockOfType(block, 'text')) {
      const fontSize = block.style?.font?.size ?? 10;
      const lines = Math.max(1, Math.ceil(block.text.length / 80));
      return Math.max(block.size.height, approximateTextHeightMm(fontSize, lines));
    }
    if (isBlockOfType(block, 'rich-text')) {
      const fontSize = block.style?.font?.size ?? 10;
      const stripped = block.html.replace(/<[^>]+>/g, '');
      const lines = Math.max(1, Math.ceil(stripped.length / 80));
      return Math.max(block.size.height, approximateTextHeightMm(fontSize, lines));
    }
    if (isBlockOfType(block, 'totals')) {
      const rowH = approximateTextHeightMm(block.style?.font?.size ?? 10, 1) + 1;
      return Math.max(block.size.height, block.rows.length * rowH);
    }
    if (isBlockOfType(block, 'repeater')) {
      // Estimate: rowCount × (itemHeight + spacing) − one spacing (no tail).
      // We don't resolve the data source here (no ctx in this helper), so the
      // renderer-side footer-band clip is what actually keeps the block in
      // bounds. measureBlockHeight is best-effort — the designed height is
      // the floor when `dataSource` can't be read here.
      const gap = block.itemSpacing ?? 0;
      const itemH = block.itemHeight;
      return Math.max(block.size.height, itemH * 1 + gap * 0); // floor only
    }
    return block.size.height;
  }

  /**
   * Decide how many table rows fit on the current page, advancing the table's
   * progress cursor in `tableProgress`.
   */
  private placeTableRows(
    table: TableBlock,
    ctx: BindingContext,
    availableHeight: number,
    progress: Map<string, { rows: unknown[]; cursor: number }>,
  ): { rowsThisPage: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number } {
    let entry = progress.get(table.id);
    if (!entry) {
      entry = { rows: this.binding.resolveArray(table.dataSource, ctx), cursor: 0 };
      progress.set(table.id, entry);
    }

    const startIndex = entry.cursor;
    const isFirstSlice = entry.cursor === 0;
    const headerH = table.showHeader ? (table.rowMinHeight ?? 7) : 0;
    const footerH = table.showFooter ? (table.rowMinHeight ?? 7) : 0;
    const repeatHeader = table.repeatHeader && !isFirstSlice ? headerH : isFirstSlice ? headerH : 0;
    const rowMinH = this.effectiveRowHeight(table);

    let used = repeatHeader;
    const out: unknown[] = [];
    while (entry.cursor < entry.rows.length) {
      // Per-row height estimate. `rowMinHeight` is a floor; the actual height
      // is driven by the tallest cell's content (multi-line expressions, image
      // cells). Without this estimate, tall rows are packed too densely and
      // the last one ends up clipped by the page-footer band instead of
      // flowing to the next page.
      const row = entry.rows[entry.cursor];
      const estH = this.estimateRowHeight(table, ctx, row, entry.cursor, rowMinH);
      // Reserve footer space ONLY on last slice — but we don't know yet.
      // Conservative: reserve footer space throughout to avoid orphans.
      if (used + estH + footerH > availableHeight) {
        // Guarantee forward progress: a single row taller than the whole
        // page would loop forever otherwise. Place it anyway and let the
        // renderer's footer-band clip do the visual trim.
        if (out.length === 0) {
          out.push(row);
          entry.cursor++;
          used += estH;
        }
        break;
      }
      out.push(row);
      entry.cursor++;
      used += estH;
    }
    const isLastSlice = entry.cursor >= entry.rows.length;
    return { rowsThisPage: out, isFirstSlice, isLastSlice, startIndex };
  }

  /** Approximate the rendered height of a single body row by evaluating each
   *  cell and counting the visual lines it would produce. Floor is the
   *  table's effective row height (rowMinHeight ∨ tallest imageHeightMm). */
  private estimateRowHeight(
    table: TableBlock,
    ctx: BindingContext,
    row: unknown,
    rowIndex: number,
    floor: number,
  ): number {
    const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, rowIndex);
    let maxH = floor;
    for (const c of table.columns) {
      if (c.cellType === 'image') continue; // image floor already in `floor`
      let text: string;
      try {
        const v = this.binding.evaluateCell(c.expression, rowCtx);
        text = v === null || v === undefined ? '' : String(v);
      } catch {
        text = '';
      }
      if (!text) continue;
      const lines = text.split('\n').length;
      const fontSize = c.cellStyle?.font?.size ?? table.style?.font?.size ?? 10;
      // 2mm = top+bottom cell padding the HTML/PDF tables use (~1mm each).
      const cellH = approximateTextHeightMm(fontSize, lines) + 2;
      if (cellH > maxH) maxH = cellH;
    }
    return maxH;
  }

  private tableHeightMm(
    table: TableBlock,
    rowCount: number,
    isFirstSlice: boolean,
    isLastSlice: boolean,
  ): number {
    const headerFooterH = table.rowMinHeight ?? 7;
    const rowH = this.effectiveRowHeight(table);
    const showHeader = table.showHeader && (isFirstSlice || table.repeatHeader);
    const showFooter = table.showFooter && isLastSlice;
    return (showHeader ? headerFooterH : 0) + rowCount * rowH + (showFooter ? headerFooterH : 0);
  }

  /**
   * Pack repeater (card-list) rows into the page's vertical budget the same
   * way `placeTableRows` packs table rows. One card = `itemHeight + gap`
   * (gap doesn't apply to the last card on a page, but reserving it
   * uniformly is safer than under-reserving and overflowing the footer).
   */
  private placeRepeaterRows(
    block: Extract<Block, { type: 'repeater' }>,
    ctx: BindingContext,
    availableHeight: number,
    progress: Map<string, { rows: unknown[]; cursor: number }>,
  ): { rowsThisPage: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number } {
    let entry = progress.get(block.id);
    if (!entry) {
      entry = { rows: this.binding.resolveArray(block.dataSource, ctx), cursor: 0 };
      progress.set(block.id, entry);
    }
    const startIndex = entry.cursor;
    const isFirstSlice = entry.cursor === 0;
    const itemH = block.itemHeight;
    const gap = block.itemSpacing ?? 0;
    const stride = itemH + gap;
    let used = 0;
    const out: unknown[] = [];
    while (entry.cursor < entry.rows.length) {
      if (used + itemH > availableHeight) {
        // Forward-progress guard: a single card taller than the page still
        // gets placed (and gets clipped by the renderer) so we don't loop.
        if (out.length === 0) {
          out.push(entry.rows[entry.cursor]);
          entry.cursor++;
          used += stride;
        }
        break;
      }
      out.push(entry.rows[entry.cursor]);
      entry.cursor++;
      used += stride;
    }
    const isLastSlice = entry.cursor >= entry.rows.length;
    return { rowsThisPage: out, isFirstSlice, isLastSlice, startIndex };
  }

  private repeaterHeightMm(
    block: Extract<Block, { type: 'repeater' }>,
    rowCount: number,
  ): number {
    if (rowCount <= 0) return 0;
    const gap = block.itemSpacing ?? 0;
    return rowCount * block.itemHeight + Math.max(0, rowCount - 1) * gap;
  }

  /** Effective row height for body rows — `rowMinHeight` floor, lifted to the
   *  tallest image cell's `imageHeightMm` so paging doesn't undercount rows
   *  that contain images larger than the configured row minimum. */
  private effectiveRowHeight(table: TableBlock): number {
    const base = table.rowMinHeight ?? 7;
    let maxImg = 0;
    for (const c of table.columns) {
      if (c.cellType === 'image' && typeof c.imageHeightMm === 'number') {
        if (c.imageHeightMm > maxImg) maxImg = c.imageHeightMm;
      }
    }
    return Math.max(base, maxImg);
  }
}
