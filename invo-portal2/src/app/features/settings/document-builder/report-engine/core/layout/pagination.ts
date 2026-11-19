import { Block, TableBlock, isBlockOfType } from '../types/block.types';
import { MASTER_PAGE_ID, ReportTemplate, Section } from '../types/template.types';
import { BindingEngine } from '../binding/binding-engine';
import { BindingContext } from '../types';
import { PageDimensions, approximateTextHeightMm, computePageDimensions, computeRepeaterItemHeightMm } from './dimensions';

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
    // Designed bottom edge — `position.y + size.height` for every block,
    // repeaters included. Matches the reflow anchor the PDF renderer
    // (`pdfmake-renderer.ts`) and the backend's PDF pipeline both use for
    // the identical below-repeater reflow; drifting from that (e.g.
    // anchoring on a repeater's `itemHeight`, one card, instead of its own
    // drawn box) produces a bigger growth delta than the designed box
    // actually represents, which reads as extra dead space below the card
    // list that neither the designer canvas nor the PDF export show.
    const designedBottom = (b: Block): number => b.position.y + b.size.height;
    const paginatingInBody = body.blocks.filter(isPaginating);
    // Lowest designed bottom of any paginating block — that's our reflow
    // anchor. With both a table and a repeater present, blocks below either
    // need to reflow, so use the max.
    const tableAnchorY = paginatingInBody.length > 0
      ? Math.max(...paginatingInBody.map(designedBottom))
      : Infinity;
    // Paginating blocks whose designed box a (non-paginating) block's top lies
    // inside, beyond a 1mm tolerance so a backdrop starting at the box's own
    // top doesn't count, and side-by-side blocks (no horizontal overlap) are
    // left alone. Returns their ids.
    const overlaidAnchors = (b: Block): string[] =>
      isPaginating(b)
        ? []
        : paginatingInBody
            .filter(
              (p) =>
                b.position.y > p.position.y + 1 &&
                b.position.y < designedBottom(p) &&
                b.position.x < p.position.x + p.size.width &&
                b.position.x + b.size.width > p.position.x,
            )
            .map((p) => p.id);
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

      // Anchors record what every paginating block (table/repeater) has
      // done SO FAR on this page, keyed by its designed bottom edge:
      //   - `growthMm`: drift between its DESIGNED box (one card's
      //     `itemHeight`, or a table's `size.height`) and what it actually
      //     occupies with real row/card counts. Anything drawn below it in
      //     the designer — a totals summary, a second table, a signature —
      //     was positioned assuming the designed box, so it has to shift
      //     down by the same amount or it lands inside (or above) whatever
      //     the anchor actually rendered.
      //   - `isDone`: whether the anchor finished ALL its rows/cards on
      //     this page (`isLastSlice`), or still has more coming on a later
      //     page. A block drawn below an anchor that ISN'T done yet must
      //     not render at all this page — not "misplaced", genuinely
      //     ABSENT — otherwise a totals summary (or a second table) shows
      //     up wedged between two pages' worth of card-list rows instead of
      //     after all of them.
      //
      // Both are looked up by position — `growthOffsetFor`/`isGatedBy` sum
      // or test only anchors whose designed bottom is at or above `y`, i.e.
      // anchors actually ABOVE this block, not beside it. Two blocks drawn
      // at the same y (left/right cards) are siblings, not stacked, so
      // neither may gate or offset the other — that's exactly the
      // phantom-overflow bug the y-position placement below (as opposed to
      // sequential stacking) exists to avoid.
      //
      // This only covers blocks that stay in the main per-page sweep — i.e.
      // everything from the top of the page down to the LOWEST paginating
      // block. Content strictly below that lowest block is handled by the
      // separate below-data reflow further down, which also has to defer
      // across page boundaries.
      // `id` + `contentEndMm` serve blocks drawn INSIDE an anchor's designed
      // box (see `overlaidAnchors`): `contentEndMm` is where its rows really
      // end on this page, unfloored, so such a block clears them.
      const anchors: { id: string; designedBottomMm: number; growthMm: number; isDone: boolean; contentEndMm: number }[] = [];
      const growthOffsetFor = (y: number): number =>
        anchors.reduce((sum, a) => (a.designedBottomMm <= y ? sum + a.growthMm : sum), 0);
      const isGatedBy = (y: number): boolean => anchors.some((a) => a.designedBottomMm <= y && !a.isDone);

      // A table/repeater's OWN continuation of ITS OWN earlier slice has no
      // meaningful designed y to reflow from — it's mid-content, not a fresh
      // block. Continuation slices instead flow sequentially from the top of
      // the band: the first one lands at 0, and if a SECOND paginating block
      // is also still continuing on this same page, it starts right after
      // the first one, in the same Y-order the designer drew them in.
      // Nothing else (static blocks, or a fresh first slice landing on a
      // later page after its gate cleared) uses this — they use the
      // gap-preserving `growthOffsetFor` above instead.
      let continuationCursorMm = 0;

      // Body blocks are absolutely positioned by the designer. Use each block's
      // own y-coordinate to decide whether it fits on this page — do NOT stack
      // sequentially, because that incorrectly sums the heights of side-by-side
      // blocks (e.g. left and right cards) and produces phantom overflow pages.
      for (const block of queue) {
        // Visibility short-circuit.
        if (!this.binding.isTruthy(block.visibleWhen, ctx)) continue;

        if (isBlockOfType(block, 'table')) {
          const isFirstSlice = !tableProgress.has(block.id);
          if (isFirstSlice && isGatedBy(block.position.y)) {
            remaining.push(block); // wait for the anchor above to finish first
            continue;
          }
          // A fresh slice — whether on page 1 at its raw designed y, or a
          // first slice that got deferred onto a later page after its gate
          // cleared — uses the SAME gap-preserving math as a static block:
          // designed y plus drift from anchors above. A genuine CONTINUATION
          // of this table's own earlier slice restarts at the top of the
          // band instead (or right after another continuing block already
          // placed there this page) — design y no longer applies to it.
          const tableTop = isFirstSlice ? block.position.y + growthOffsetFor(block.position.y) : continuationCursorMm;
          // `maxHeightMm` caps the row band itself, not the page — a table
          // can be told to stop at 50mm and continue next page even though
          // the page has more room left below it.
          const availableForTable = typeof block.maxHeightMm === 'number'
            ? Math.min(tableMaxBottom - tableTop, block.maxHeightMm)
            : tableMaxBottom - tableTop;
          const placedRows = this.placeTableRows(block, ctx, availableForTable, tableProgress);
          if (placedRows.rowsThisPage.length > 0 || placedRows.isFirstSlice) {
            const heightMm = this.tableHeightMm(block, placedRows.bodyHeightMm, placedRows.isFirstSlice, placedRows.isLastSlice, availableForTable);
            const rawHeightMm = this.tableHeightMm(block, placedRows.bodyHeightMm, placedRows.isFirstSlice, placedRows.isLastSlice, availableForTable, false);
            placed.push({ block, topMm: tableTop, heightMm });
            tableSlices.set(block.id, {
              rows: placedRows.rowsThisPage,
              isFirstSlice: placedRows.isFirstSlice,
              isLastSlice: placedRows.isLastSlice,
              startIndex: placedRows.startIndex,
            });
            // Growth relative to where this slice actually STARTED, not the
            // block's own designed Y — a continuation slice starts at the
            // top of a fresh band (`continuationCursorMm`, typically 0), not
            // at `block.position.y`. Using `heightMm - size.height` alone
            // silently assumed those were the same, so any block gated on a
            // repeater/table that finished on a later page inherited a
            // growth figure inflated by however far that page's start
            // differed from the designed one — landing far below the
            // anchor's real bottom instead of just past it.
            anchors.push({ id: block.id, designedBottomMm: designedBottom(block), growthMm: tableTop + heightMm - designedBottom(block), isDone: placedRows.isLastSlice, contentEndMm: tableTop + rawHeightMm });
            if (!isFirstSlice) continuationCursorMm = tableTop + heightMm;
          }
          if (!placedRows.isLastSlice) {
            remaining.push(block); // table continues next page
          }
          continue;
        }

        if (isBlockOfType(block, 'repeater')) {
          const isFirstSlice = !repeaterProgress.has(block.id);
          if (isFirstSlice && isGatedBy(block.position.y)) {
            remaining.push(block);
            continue;
          }
          const top = isFirstSlice ? block.position.y + growthOffsetFor(block.position.y) : continuationCursorMm;
          const placedRows = this.placeRepeaterRows(block, ctx, tableMaxBottom - top, repeaterProgress);
          if (placedRows.rowsThisPage.length > 0 || placedRows.isFirstSlice) {
            const heightMm = this.repeaterHeightMm(block, placedRows.rowsThisPage.length, placedRows.isFirstSlice, placedRows.isLastSlice);
            placed.push({ block, topMm: top, heightMm });
            repeaterSlices.set(block.id, {
              rows: placedRows.rowsThisPage,
              isFirstSlice: placedRows.isFirstSlice,
              isLastSlice: placedRows.isLastSlice,
              startIndex: placedRows.startIndex,
            });
            // Growth relative to where THIS slice actually starts (`top`),
            // not the repeater's designed Y — see the identical fix on the
            // table branch above for why: a continuation slice starts at the
            // top of a fresh band, not at `block.position.y`, so anchoring
            // growth on `heightMm - size.height` alone drags anything gated
            // on this repeater down by however far the two disagree.
            anchors.push({ id: block.id, designedBottomMm: designedBottom(block), growthMm: top + heightMm - designedBottom(block), isDone: placedRows.isLastSlice, contentEndMm: top + this.repeaterHeightMm(block, placedRows.rowsThisPage.length, placedRows.isFirstSlice, placedRows.isLastSlice, false) });
            if (!isFirstSlice) continuationCursorMm = top + heightMm;
          }
          if (!placedRows.isLastSlice) {
            remaining.push(block);
          }
          continue;
        }

        // Static block. Gated the same way a paginating block would be —
        // it must not render wedged between two pages of an unfinished
        // card list / table above it. Once ungated, always use the
        // gap-preserving formula (designed y + drift from anchors above) —
        // never the raw continuation cursor, which has no notion of the
        // gap the designer actually drew between this block and the one
        // above it.
        if (isGatedBy(block.position.y)) {
          remaining.push(block);
          continue;
        }
        const h = this.measureBlockHeight(block);
        let top = block.position.y + growthOffsetFor(block.position.y);

        // A block drawn INSIDE a table/repeater's designed box (totals sitting
        // over the box's empty lower part) is neither "above" nor "below" it
        // by the y-rule above, so it used to print at its raw y on whichever
        // page came first — on top of rows when the data spans pages.
        // Treat it like below-data content instead: wait until the data block
        // has finished, then keep its designed y unless the real rows run
        // past it, in which case sit just under them.
        const overlaid = overlaidAnchors(block);
        if (overlaid.length > 0) {
          const onPage = anchors.filter((a) => overlaid.includes(a.id));
          if (onPage.some((a) => !a.isDone)) {
            remaining.push(block);
            continue;
          }
          const contentEnd = onPage.reduce((m, a) => Math.max(m, a.contentEndMm), 0);
          top = Math.max(top, contentEnd);
          // Never loop forever on a later page: pull it up to fit instead.
          if (top + h > usableHeight && !isFirst) top = Math.max(0, usableHeight - h);
        }
        if (top + h > usableHeight) {
          // Doesn't fit on this page. On its natural (first) page with
          // nothing gating it, that's a design overflow — drop it, as
          // before ("clipped — designer should fix"). Once it was already
          // waiting on a gate, though, it's real content the user is owed
          // somewhere — give it another page rather than losing it.
          if (!isFirst) remaining.push(block);
          continue;
        }
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
          return designedBottom(b) > designedBottom(acc) ? b : acc;
        }, null);
        const lastAnchorPlaced = anchorBlock
          ? placed.find((m) => m.block.id === anchorBlock.id)
          : undefined;
        const designedAnchorEndY = anchorBlock ? designedBottom(anchorBlock) : 0;
        const rows = this.groupRowsByY(pendingBelow);

        // Anchor for the FIRST below-row on this page:
        //   - last-data-page → just past the data block's actual bottom
        //   - continuation-only page (data block finished earlier) → top of body
        //
        // The continuation case takes its designed cursor from the first row
        // itself, so that row's `designedGap` comes out zero and it lands at
        // the top of the band. Leaving the designed cursor at 0 there instead
        // measured the gap from the top of the DESIGNED page, which re-placed
        // a deferred row at its original y — a signature designed to sit at
        // the foot of the page reappeared at the foot of an otherwise empty
        // continuation page, with the whole band above it blank.
        let cursorAdjustedY = lastAnchorPlaced
          ? lastAnchorPlaced.topMm + lastAnchorPlaced.heightMm
          : 0;
        let cursorDesignedY = lastAnchorPlaced
          ? designedAnchorEndY
          : rows.length > 0
            ? Math.min(...rows[0].map((b) => b.position.y))
            : 0;
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
          let rowAdjustedTop = cursorAdjustedY + designedGap;
          // The designed gap is preserved so the reflowed stack keeps the
          // spacing the designer drew. But it's a preference, not a promise:
          // a layout that parks the signature and QR at the foot of the page
          // leaves a wide empty gap above them, and carrying that gap down
          // from a table that grew even slightly pushed the bottom rows past
          // the band — exiling them to a page of their own while the page
          // they left still had room several times over.
          //
          // So each row gives up as much of its leading gap as the rows below
          // it need, and no more: `remainingSpan` is this row's top down to
          // the designed bottom of the last block still queued. Never rises
          // above `cursorAdjustedY`, which is where the content already
          // placed ends — when even a fully closed gap isn't enough, the
          // tail defers as before rather than overlapping.
          // Bottom-anchored rows keep their designed place.
          //
          // A signature and QR parked just above the footer are positioned
          // against the FOOT of the page, not against the content above them
          // — the wide gap in between is slack, not spacing. Reflowing them
          // down from a data block that grew spends that slack and lands them
          // tight against the footer, so the same document looks different
          // from the design on every row count. Placing them where they were
          // drawn keeps the page bottom identical every time and lets the
          // gap absorb the growth, which is what it's there for.
          //
          // Which rows those are is decided without a magic threshold: a row
          // is bottom-anchored when it sits closer to the bottom of the band
          // than to the content above it. `cursorAdjustedY` still wins if the
          // content above has already grown past the designed spot — then
          // the row is pushed down (and deferred, if it no longer fits) as
          // any other.
          const distanceToBandBottom = usableHeight - rowBottomY;
          const bottomAnchored = distanceToBandBottom >= 0 && distanceToBandBottom < designedGap;
          if (bottomAnchored) {
            // Cap only a downward push past the designed Y — a table/repeater
            // that grew shouldn't shove this row further down the page. But
            // when the content above ended up SHORTER than designed (fewer
            // repeater rows than the template was drawn for), the natural
            // `rowAdjustedTop` already sits above `rowTopY`; clamping to
            // `Math.max(cursorAdjustedY, rowTopY)` would snap it back down to
            // its designed Y and reopen the gap this block is meant to close.
            // Only clamp when the tight value would actually land below the
            // designed position.
            rowAdjustedTop = Math.min(rowAdjustedTop, Math.max(cursorAdjustedY, rowTopY));
          }

          // Otherwise the gap is kept, and only given up if this row itself
          // would fall out of the band. Rows are NOT squeezed to reserve room
          // for what follows: the bottom-anchored ones hold their own place
          // by the rule above, so reserving for them too would spend the gap
          // directly under the data block — the one gap that is real
          // spacing rather than slack — and paste the totals onto the cards.
          const maxTop = usableHeight - rowDesignedHeight;
          if (rowAdjustedTop > maxTop) {
            rowAdjustedTop = Math.max(cursorAdjustedY, maxTop);
          }
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
    let rowBottom = -Infinity;
    for (const b of sorted) {
      const top = b.position.y;
      // Same row when this block's box overlaps the vertical span of the row
      // so far — that is what "side by side" means, and a row is placed and
      // deferred as one unit with its internal offsets intact.
      //
      // Grouping on the TOP edge alone (within a tolerance) got this wrong
      // for any pair that isn't flush: a QR at the foot of the page beside a
      // signature whose line starts a few mm higher landed in two rows, and
      // the reflow then stacked the second BELOW the first — turning a pair
      // that needs the height of the taller one into a column needing both,
      // which overflowed the band and pushed the QR onto a page of its own.
      // The old top-edge tolerance survives as the second half of the test,
      // for the degenerate case: zero-height blocks (a rule, a divider)
      // overlap nothing, so near-equal tops still count as one row. It is
      // NOT applied below the row's bottom edge — a block that starts just
      // after one ends is stacked under it, which is how it was drawn.
      const rowTop = current.length > 0 ? current[0].position.y : top;
      const overlaps =
        current.length > 0 && (top < rowBottom || top - rowTop <= tolMm);
      if (overlaps) {
        current.push(b);
        rowBottom = Math.max(rowBottom, top + b.size.height);
      } else {
        if (current.length) rows.push(current);
        current = [b];
        rowBottom = top + b.size.height;
      }
    }
    if (current.length) rows.push(current);
    return rows;
  }

  /**
   * Resolves a section by type. Confined to sections with no `pageId` (or
   * `pageId === 'master'`) so pagination of the master page never picks up a
   * section that actually belongs to an extra page appended later — see
   * `Section.pageId`. Callers that need to paginate an extra page in
   * isolation pass a synthetic template whose `sections` array already
   * contains only that page's own sections, so this filter is a no-op there.
   */
  private findSection(template: ReportTemplate, type: Section['type']): Section | undefined {
    return template.sections.find((s) => (s.pageId ?? MASTER_PAGE_ID) === MASTER_PAGE_ID && s.type === type);
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
      const itemH = computeRepeaterItemHeightMm(block);
      return Math.max(block.size.height, itemH); // floor only
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
  ): { rowsThisPage: unknown[]; isFirstSlice: boolean; isLastSlice: boolean; startIndex: number; bodyHeightMm: number } {
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
    // Sum of the SAME per-row estimates `used` is tracked with, but without
    // the header reservation mixed in — `tableHeightMm` needs just the body
    // rows' real height so a block below the table reflows against what
    // actually got drawn, not `rowCount * rowMinHeight`. That flat estimate
    // ignores font size entirely, so bumping a column's font larger grew the
    // real rows (this loop already accounts for that via `estimateRowHeight`)
    // without growing the reported block height — Notes/Subtotal below then
    // reflowed against the OLD, shorter height and landed on top of rows
    // that were actually taller than assumed.
    let bodyHeightMm = 0;
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
          bodyHeightMm += estH;
        }
        break;
      }
      out.push(row);
      entry.cursor++;
      used += estH;
      bodyHeightMm += estH;
    }
    const isLastSlice = entry.cursor >= entry.rows.length;
    return { rowsThisPage: out, isFirstSlice, isLastSlice, startIndex, bodyHeightMm };
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
    bodyHeightMm: number,
    isFirstSlice: boolean,
    isLastSlice: boolean,
    availableMm: number = Infinity,
    applyFloor: boolean = true,
  ): number {
    const headerFooterH = table.rowMinHeight ?? 7;
    const showHeader = table.showHeader && (isFirstSlice || table.repeatHeader);
    const showFooter = table.showFooter && isLastSlice;
    const raw = (showHeader ? headerFooterH : 0) + bodyHeightMm + (showFooter ? headerFooterH : 0);
    if (!applyFloor) return raw;
    // A table that fits entirely on one page never reports SHORTER than its
    // own designed box — the same floor `measureBlockHeight` already applies
    // to every other autoHeight block (text/rich-text/totals) and
    // `computeRepeaterItemHeightMm` applies per card. Anything drawn below
    // the table in the designer was positioned assuming at least that much
    // room; without this floor, fewer/shorter real rows than designed made
    // this report a SMALLER height, which drags the below-data reflow's
    // growth negative and can pull that content up into the table's own
    // drawn area. A slice that spans multiple pages isn't the whole design
    // box, so the floor doesn't apply there.
    if (isFirstSlice && isLastSlice) return Math.max(table.size.height, raw);
    // The FINAL slice of a multi-page table gets the same floor, bounded by
    // the room left on its page. Without it the last page's short tail
    // reported only its few rows' height, so totals designed at the foot of
    // the page (just under the table's designed box) were reflowed up to sit
    // right under the last rows instead of staying where the designer put
    // them. Non-final slices stay unfloored — they are never the whole box.
    if (isLastSlice) return Math.max(raw, Math.min(table.size.height, availableMm));
    return raw;
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
    const itemH = computeRepeaterItemHeightMm(block);
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
    isFirstSlice: boolean,
    isLastSlice: boolean,
    applyFloor: boolean = true,
  ): number {
    const gap = block.itemSpacing ?? 0;
    const raw = rowCount <= 0 ? 0 : rowCount * computeRepeaterItemHeightMm(block) + Math.max(0, rowCount - 1) * gap;
    if (!applyFloor) return raw;
    // Same floor as `tableHeightMm` above, for the same reason: a repeater
    // that fits entirely on one page (fewer/shorter real cards than the
    // designer's drawn box) must not report less than its own designed
    // `size.height` — otherwise below-data reflow computes negative growth
    // and pulls that content up into the card list's drawn area. Only
    // applies to the whole block (single-page); a continuing slice isn't
    // the full design box.
    return isFirstSlice && isLastSlice ? Math.max(block.size.height, raw) : raw;
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
