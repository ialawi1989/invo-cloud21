import {
  Block,
  TableBlock,
  isBlockOfType,
  PAYMENT_COLUMN_CATALOG,
  DEFAULT_PAYMENT_COLUMNS,
  PaymentColumnDef,
} from '../../core/types/block.types';
import { BindingContext } from '../../core/types/binding.types';
import { Section } from '../../core/types/template.types';
import { BlockStyle } from '../../core/types/style.types';
import { BindingEngine } from '../../core/binding/binding-engine';
import { computePageDimensions, mmToPt } from '../../core/layout/dimensions';
import { containsArabic } from '../../utils/arabic.utils';
import { barcodeSvg } from '../../utils/code-svg.utils';
import { Renderer, RenderInput } from '../renderer.interface';

/**
 * pdfmake-friendly docDefinition. We avoid importing the pdfmake type to keep
 * the engine framework-agnostic; the call site provides pdfmake.
 *
 * Key tactics:
 *   - Use absolutely-positioned content for non-table blocks (matches designer)
 *   - Use pdfmake's `table` for tables — pdfmake handles row breaks natively,
 *     so we let it paginate tables instead of pre-slicing.
 *   - Page header/footer are pdfmake's `header` / `footer` callbacks. They
 *     receive (currentPage, pageCount), wired to our page bindings.
 */
export interface PdfMakeDocDefinition {
  pageSize: { width: number; height: number };
  pageMargins: [number, number, number, number];
  defaultStyle?: Record<string, unknown>;
  content: PdfContent[];
  background?: PdfContent[] | ((currentPage: number, pageSize: { width: number; height: number }) => PdfContent[]);
  header?: (currentPage: number, pageCount: number) => PdfContent;
  footer?: (currentPage: number, pageCount: number) => PdfContent;
  styles?: Record<string, Record<string, unknown>>;
  watermark?: { text: string; opacity?: number; angle?: number; fontSize?: number };
  info?: { title?: string; author?: string };
  /** pdfmake's image-key dictionary. `{ image: '<key>' }` content nodes are
   *  resolved by looking up `<key>` here, so we use this to register
   *  pre-fetched data URIs for remote URLs (see `renderAsync`). */
  images?: Record<string, string>;
}

export type PdfContent =
  | string
  | {
    text?: string | PdfContent[];
    image?: string;
    width?: number | string;
    height?: number;
    fit?: number | [number, number];
    table?: { widths: (number | string)[]; headerRows?: number; body: PdfContent[][]; dontBreakRows?: boolean; keepWithHeaderRows?: number };
    layout?: string | Record<string, unknown>;
    absolutePosition?: { x: number; y: number };
    relativePosition?: { x: number; y: number };
    style?: string | string[];
    bold?: boolean;
    italics?: boolean;
    alignment?: 'left' | 'right' | 'center' | 'justify';
    color?: string;
    fillColor?: string;
    fontSize?: number;
    margin?: [number, number, number, number];
    pageBreak?: 'before' | 'after';
    qr?: string;
    eccLevel?: 'L' | 'M' | 'Q' | 'H';
    svg?: string;
    canvas?: unknown[];
    stack?: PdfContent[];
    decoration?: 'underline' | 'lineThrough' | 'overline';
    decorationStyle?: string;
    decorationColor?: string;
    colSpan?: number;
    rowSpan?: number;
    border?: [boolean, boolean, boolean, boolean];
    columns?: PdfContent[];
  };

/**
 * Table layout constants. Referenced in TWO places — the `layout` callbacks
 * passed to pdfmake AND the width-budget math (renderTable computes the
 * cell-padding/border overhead pdfmake adds OUTSIDE the `widths` array, so
 * the rendered table matches the user-designed width). Keep them in sync.
 */
const TABLE_PAD_X = 4;
const TABLE_PAD_Y = 3;
const TABLE_LINE_W = 0.25;

/**
 * Minimum top gap (mm) reserved when no header takes up the top band — i.e.
 * pages without a page-header at all, and continuation pages when
 * `repeatHeader=false`. Without this, content sits flush against the page
 * edge whenever the user's `marginTop` is also 0.
 */
const MIN_TOP_GAP_MM = 8;

export class PdfMakeRenderer implements Renderer<PdfMakeDocDefinition> {
  constructor(private readonly binding: BindingEngine = new BindingEngine()) { }

  /**
   * pdfmake's `absolutePosition` is measured from the page top-left corner
   * for body content, but the `header`/`footer` callbacks are processed
   * inside an *unbreakable block* whose fragment is later committed at
   * `(0, 0)` for the header band and `(0, pageHeight − pageMargins.bottom)`
   * for the footer band. Inside the callback the writer treats
   * `absolutePosition.y` as **block-local** — pdfmake adds the band's
   * y-offset on commit, so we must NOT add it ourselves. That means
   * `originYPt` is 0 inside both header and footer callbacks (block-local)
   * and `bodyYPt`/`headerYPt`/`firstHeaderYPt` for body / repeat-header /
   * first-page-header rendering as absolute body content.
   */
  private originXPt = 0;
  private originYPt = 0;
  /** Top of the body band as it would be if `pageMargins[1]` reserved it —
   *  needed so flow-mode tables can compensate for the gap between
   *  pageMargins[1] (which is shrunk on `repeatHeader=false`) and `bodyYPt`
   *  (which still leaves room for the absolute page-1 header above body). */
  private pageMarginsTopPt = 0;
  /** Width of the inside-margin frame in points. Used to guard tables (and
   *  any other width-bound content) so they don't bleed into the right
   *  margin or off the page. */
  private usableWidthPt = 0;
  /** Top edge of the body band on every page (page-relative pt). Used by
   *  the repeater's pagination logic to compute how much vertical space is
   *  available on continuation pages. */
  private bodyTopPt = 0;
  /** Bottom edge of the body band — i.e. the top of the footer reservation.
   *  Continuation pages have `bodyBottomPt − bodyTopPt` of usable height. */
  private bodyBottomPt = 0;
  /** After a repeater renders, this holds enough info for trailing
   *  below-repeater blocks to anchor themselves to the actual last-card
   *  bottom instead of their designed Y. `designedBottomMm` is the
   *  repeater's `position.y + size.height`; `actualBottomMm` is the
   *  bottom edge of the last card on the last slice (page-local mm,
   *  relative to body top). Cleared between repeaters and between
   *  renders. */
  private repeaterReflowAnchor: { designedBottomMm: number; actualBottomMm: number } | null = null;

  render(input: RenderInput): PdfMakeDocDefinition {
    const { template, data } = input;
    const locale = input.locale ?? template.locale;
    const ctx = this.binding.createRoot(data, locale, input.vars ?? {});
    const dims = computePageDimensions(template.page);

    const body = template.sections.find((s) => s.type === 'body');
    const headerSection = template.sections.find((s) => s.type === 'page-header');
    const footerSection = template.sections.find((s) => s.type === 'page-footer');
    const firstHeaderSection = template.sections.find((s) => s.type === 'first-page-header');
    const lastFooterSection = template.sections.find((s) => s.type === 'last-page-footer');

    // Compute reservation heights (max bottom edge of contained blocks, or
    // explicit `height` if set on the section).
    const headerH = this.sectionHeightMm(headerSection);
    const firstHeaderH = this.sectionHeightMm(firstHeaderSection);
    const footerH = this.sectionHeightMm(footerSection);
    const lastFooterH = this.sectionHeightMm(lastFooterSection);

    // INSIDE-MARGIN origin: block coords are relative to the page-margin
    // frame, so user-configured page margins shift content visibly. pdfmake's
    // pageMargins reserve the same areas — top/bottom are bumped so they
    // also accommodate the header/footer reservations.
    const marginLeftPt = mmToPt(dims.marginLeft);
    const marginRightPt = mmToPt(dims.marginRight);
    const reservedBottomPt = mmToPt(Math.max(dims.marginBottom, footerH, lastFooterH));
    const pageHeightPt = mmToPt(dims.height);

    const repeatHeader = template.page.repeatHeader !== false;

    // pdfmake's `pageMargins` is static for the whole document — there is no
    // per-page override. So when `repeatHeader=false` we can't keep the top
    // reservation (it would leave empty space above page 2+ where no header
    // gets drawn). Instead, we shrink `pageMargins[1]` to just the user's
    // marginTop and render the page-1 header as ABSOLUTE body content (which
    // pdfmake only draws once, on page 1). When `repeatHeader=true` we keep
    // the reservation and let the `header` callback fire on every page.
    //
    // Whenever no header occupies the top band (no header section, or
    // page 2+ with repeatHeader=false), enforce MIN_TOP_GAP_MM so content
    // never sits flush against the page edge.
    const headerBandH = Math.max(headerH, firstHeaderH);
    const reservedTopPt = mmToPt(
      repeatHeader && headerBandH > 0
        ? Math.max(dims.marginTop, headerBandH)
        : Math.max(dims.marginTop, MIN_TOP_GAP_MM),
    );
    // Body always sits BELOW the header band on page 1 — even when the band
    // isn't reserved by pageMargins, the absolute header content occupies it.
    // When there's no header at all, fall back to the same top-gap floor.
    const bodyYPt = mmToPt(
      headerBandH > 0
        ? Math.max(dims.marginTop, headerBandH)
        : Math.max(dims.marginTop, MIN_TOP_GAP_MM),
    );

    // Origins for header callback / body. Footer uses block-local 0 (see
    // comment on `originYPt`) so no `footerYPt` is needed.
    const headerYPt = bodyYPt - mmToPt(headerH);
    const firstHeaderYPt = bodyYPt - mmToPt(firstHeaderH);

    this.usableWidthPt = mmToPt(dims.width) - marginLeftPt - marginRightPt;

    const content: PdfContent[] = [];

    // When repeatHeader=false, draw the page-1 header (or first-page-header)
    // as absolute body content. Absolute body content is page-1-only because
    // it doesn't advance pdfmake's flow position, so it never repeats.
    if (!repeatHeader && body) {
      const useFirst = !!firstHeaderSection;
      const section = useFirst ? firstHeaderSection : headerSection;
      if (section) {
        this.originXPt = marginLeftPt;
        this.originYPt = useFirst ? firstHeaderYPt : headerYPt;
        for (const b of section.blocks) {
          const c = this.renderBlock(b, ctx);
          if (c) content.push(c);
        }
      }
    }

    // ─── Body content ─────────────────────────────────────
    this.originXPt = marginLeftPt;
    this.originYPt = bodyYPt;
    this.pageMarginsTopPt = reservedTopPt;
    this.bodyTopPt = bodyYPt;
    this.bodyBottomPt = pageHeightPt - mmToPt(Math.max(dims.marginBottom, footerH));

    if (body) {
      const tables = body.blocks.filter((b) => isBlockOfType(b, 'table')) as TableBlock[];
      const others = body.blocks.filter((b) => !isBlockOfType(b, 'table'));
      // Anchor for "below the table" = bottom edge of the LAST table. Blocks
      // whose y starts at or after this point are reflowed AFTER the table
      // in the content array (no absolutePosition) so they always end up on
      // the page where the table actually finishes — never overlapping a
      // table that grew past its designed height.
      const lastTable = tables[tables.length - 1];
      const tableAnchorY = lastTable
        ? lastTable.position.y + lastTable.size.height
        : Infinity;
      const aboveTable = others.filter((b) => b.position.y < tableAnchorY);
      const belowTable = others.filter((b) => b.position.y >= tableAnchorY);

      // Sort by designed y so a `repeater` is emitted BEFORE any block
      // positioned below it. The repeater's internal slicing inserts
      // `pageBreak: 'before'` markers between pages; pdfmake's flow writer
      // advances to the last slice's page, so absolute blocks emitted
      // afterwards naturally land on that final repeater page rather than
      // sitting on page 1 underneath the first slice.
      const sortedAbove = [...aboveTable].sort((a, b) => a.position.y - b.position.y);
      this.repeaterReflowAnchor = null;
      // Mutable reflow anchor for this page. Starts null (no repeater yet
      // → blocks use designed y). After a repeater renders, this picks up
      // its side-effect; subsequent blocks reflow relative to it. When a
      // block won't fit on the current page, we emit pageBreak: 'before'
      // and reset the anchor to the top of the new page's body band so
      // the *next* block continues to use the running cursor.
      let pageAnchor: { designedBottomMm: number; actualBottomMm: number } | null = null;
      const bodyHeightMm = (this.bodyBottomPt - this.bodyTopPt) / mmToPt(1);
      for (const b of sortedAbove) {
        // Pick up an anchor a previous block (e.g. a repeater) installed
        // by side-effect. Cast resets TS's control-flow narrowing — the
        // loop body can't see the side-effect through renderBlock.
        const installed = this.repeaterReflowAnchor as { designedBottomMm: number; actualBottomMm: number } | null;
        if (installed) {
          pageAnchor = installed;
          this.repeaterReflowAnchor = null;
        }

        let renderTarget: Block = b;
        let reflowed = false;
        if (pageAnchor && b.position.y >= pageAnchor.designedBottomMm) {
          let newY = pageAnchor.actualBottomMm + (b.position.y - pageAnchor.designedBottomMm);
          // If the block would overflow the body band, push it to the next
          // page and reset the running cursor to the top of body.
          if (newY + b.size.height > bodyHeightMm) {
            content.push({ text: '', pageBreak: 'before' } as PdfContent);
            newY = 0;
            pageAnchor = { designedBottomMm: b.position.y, actualBottomMm: 0 };
          }
          renderTarget = {
            ...b,
            position: { x: b.position.x, y: newY },
          } as Block;
          reflowed = true;
        }

        const c = this.renderBlock(renderTarget, ctx);
        if (c) content.push(c);

        // Advance the cursor ONLY when this block was reflowed against the
        // anchor — otherwise a block that sits inside the repeater's
        // designed bounds (and was therefore rendered at its original Y)
        // would overwrite the anchor with values unrelated to where the
        // cards actually ended, making the next trailing block reflow
        // against a meaningless cursor.
        if (pageAnchor && reflowed) {
          pageAnchor = {
            designedBottomMm: b.position.y + b.size.height,
            actualBottomMm: renderTarget.position.y + b.size.height,
          };
        }
      }
      this.repeaterReflowAnchor = null;
      // The LAST table switches to FLOW positioning when there's content
      // below it. `absolutePosition` doesn't advance pdfmake's flow writer,
      // so a below-table stack would otherwise land at flow Y=0 (top of
      // body) and overlap the table. With flow positioning the writer
      // advances past the table and the stack lands right after it on
      // whatever page the table finishes.
      const useFlowForLastTable = !!lastTable && belowTable.length > 0;
      for (let i = 0; i < tables.length; i++) {
        const isLast = i === tables.length - 1;
        const mode: 'absolute' | 'flow' = isLast && useFlowForLastTable ? 'flow' : 'absolute';
        const c = this.renderTable(tables[i], ctx, mode);
        if (c) content.push(c);
      }
      const flow = this.renderBelowTableFlow(belowTable, tableAnchorY, ctx);
      if (flow) content.push(flow);
    }

    return {
      pageSize: { width: mmToPt(dims.width), height: pageHeightPt },
      // pdfmake's pageMargins reserve whitespace on each side. We use them
      // to honor the user's page.margins AND to leave room for header/footer
      // callback content (top/bottom are at least the section reservation).
      pageMargins: [marginLeftPt, reservedTopPt, marginRightPt, reservedBottomPt],
      defaultStyle: this.styleToPdf(template.defaultStyle),
      content,
      info: { title: template.name },
      header: (currentPage, pageCount) => {
        // When repeatHeader=false, the page-1 header is rendered as absolute
        // body content above and the callback stays empty for every page.
        if (!repeatHeader) return '';
        const useFirst = currentPage === 1 && !!firstHeaderSection;
        this.originXPt = marginLeftPt;
        this.originYPt = useFirst ? firstHeaderYPt : headerYPt;
        const headerCtx = this.binding.withPage(ctx, currentPage, pageCount);
        const section = useFirst ? firstHeaderSection : headerSection;
        return this.renderSectionStack(section, headerCtx);
      },
      footer: (currentPage, pageCount) => {
        // Origins are BLOCK-LOCAL inside the footer callback — see comment
        // above `originYPt` for why we don't pass `footerYPt` here. pdfmake
        // commits the fragment at `(0, pageHeight − pageMargins.bottom)`
        // on its own, so block.position.y straight from the section maps
        // to the right page row.
        this.originXPt = 0;
        this.originYPt = 0;
        const footerCtx = this.binding.withPage(ctx, currentPage, pageCount);
        const isLast = currentPage === pageCount;
        // page.repeatFooter === false → suppress the regular footer on
        // non-last pages; render a centered "continued…" marker instead so
        // the reader can tell the document continues.
        const repeatFooter = template.page.repeatFooter !== false;
        if (!repeatFooter && !isLast) {
          return {
            text: 'continued…',
            italics: true,
            color: '#94a3b8',
            fontSize: 8,
            alignment: 'center',
            margin: [0, 4, 0, 0],
          } as PdfContent;
        }
        const merged: Block[] = [
          ...(footerSection?.blocks ?? []),
          ...(isLast ? lastFooterSection?.blocks ?? [] : []),
        ];
        return this.renderSectionStack({ blocks: merged } as Section, footerCtx);
      },
      watermark: template.page.watermark?.text
        ? {
          text: template.page.watermark.text,
          opacity: template.page.watermark.opacity ?? 0.08,
          angle: template.page.watermark.rotation ?? -30,
          fontSize: 80,
        }
        : undefined,
    };
  }

  /**
   * Async wrapper around `render`. pdfmake's `image: '<url>'` form cannot
   * fetch remote URLs from the browser — it only resolves data URIs or
   * entries already registered in its `images` dictionary. This walks the
   * produced doc, fetches every `http(s)://` image in parallel, encodes
   * them as data URIs, and registers them under `docDef.images` keyed by
   * URL so the same `image: '<url>'` references resolve. URLs that fail
   * to fetch (CORS, 404) are dropped from the output so pdfmake doesn't
   * throw.
   */
  async renderAsync(input: RenderInput): Promise<PdfMakeDocDefinition> {
    const docDef = this.render(input);
    const urls = new Set<string>();
    this.collectRemoteImageUrls(docDef as unknown as PdfContent, urls);
    if (urls.size === 0) return docDef;
    const entries = await Promise.all(
      [...urls].map(async (u): Promise<[string, string | null]> => {
        try {
          const res = await fetch(u);
          if (!res.ok) return [u, null];
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(blob);
          });
          return [u, dataUrl];
        } catch {
          return [u, null];
        }
      }),
    );
    const images: Record<string, string> = { ...(docDef.images ?? {}) };
    const failed = new Set<string>();
    for (const [u, dataUrl] of entries) {
      if (dataUrl) images[u] = dataUrl;
      else failed.add(u);
    }
    docDef.images = images;
    if (failed.size > 0) this.stripFailedImages(docDef as unknown as PdfContent, failed);
    return docDef;
  }

  /** Recursively walk a pdfmake content node, collecting every `image: '<url>'`
   *  whose value is a remote http(s) URL that isn't already a data URI. */
  private collectRemoteImageUrls(node: unknown, out: Set<string>): void {
    if (!node) return;
    if (Array.isArray(node)) { for (const n of node) this.collectRemoteImageUrls(n, out); return; }
    if (typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n['image'] === 'string') {
      const v = n['image'];
      if (/^https?:\/\//i.test(v)) out.add(v);
    }
    for (const k of ['stack', 'columns', 'table', 'body', 'content', 'header', 'footer', 'ul', 'ol']) {
      if (n[k] !== undefined) this.collectRemoteImageUrls(n[k], out);
    }
  }

  /** Replace `image:` nodes that point at a URL we couldn't fetch with an
   *  empty text node so pdfmake doesn't throw on render. */
  private stripFailedImages(node: unknown, failed: Set<string>): void {
    if (!node) return;
    if (Array.isArray(node)) { for (const n of node) this.stripFailedImages(n, failed); return; }
    if (typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n['image'] === 'string' && failed.has(n['image'] as string)) {
      delete n['image'];
      delete n['fit'];
      delete n['width'];
      delete n['height'];
      n['text'] = '';
    }
    for (const k of ['stack', 'columns', 'table', 'body', 'content', 'header', 'footer', 'ul', 'ol']) {
      if (n[k] !== undefined) this.stripFailedImages(n[k], failed);
    }
  }

  // ─── section / block dispatch ───────────────────────────────

  private renderSectionStack(section: Section | undefined, ctx: BindingContext): PdfContent {
    if (!section) return '';
    const items: PdfContent[] = [];
    for (const b of section.blocks) {
      const c = this.renderBlock(b, ctx);
      if (c) items.push(c);
    }
    return { stack: items };
  }

  private renderBlock(block: Block, ctx: BindingContext): PdfContent | null {
    if (!this.binding.isTruthy(block.visibleWhen, ctx)) return null;
    const merged = this.applyConditionalStyle(block, ctx);

    switch (block.type) {
      case 'text':
        return this.positionedText(block, this.binding.interpolate(block.text, ctx), merged);
      case 'rich-text':
        return this.positionedText(block, this.htmlToPdfRuns(this.binding.interpolate(block.html, ctx)), merged);
      case 'dynamic-field': {
        const v = this.binding.evaluate(block.expression, ctx);
        return this.positionedText(block, v === null || v === undefined ? '' : String(v), merged);
      }
      case 'image': {
        const src = block.binding
          ? String(this.binding.evaluate(block.binding, ctx) ?? '')
          : this.binding.interpolate(block.source, ctx);
        if (!src) return null;
        // pdfmake's `image` field only accepts PNG/JPEG (data URL or VFS path).
        // SVGs — including SVG data URLs — must go through the `svg` field as
        // raw markup. Routing keeps the same author-time `image` block working
        // for both formats.
        if (this.isSvgSource(src)) {
          const svg = this.extractSvgMarkup(src);
          if (!svg) return null;
          return this.positioned(block, {
            svg,
            width: mmToPt(block.size.width),
            height: mmToPt(block.size.height),
          });
        }
        return this.positioned(block, {
          image: src,
          fit: [mmToPt(block.size.width), mmToPt(block.size.height)],
        });
      }
      case 'line': {
        const isV = block.orientation === 'vertical' || block.size.height > block.size.width;
        return this.positioned(block, {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: isV ? 0 : mmToPt(block.size.width),
              y2: isV ? mmToPt(block.size.height) : 0,
              lineWidth: block.thickness,
              lineColor: block.color,
            },
          ],
        });
      }
      case 'rectangle': {
        // pdfmake's canvas rect draws fill + stroke on a single primitive
        // and `r:` rounds both, so the border naturally follows the
        // radius. Border width/color come from `style.border` (any side
        // — pdfmake doesn't support per-side widths on a canvas rect, so
        // we pick whichever side is set first).
        const side = block.style?.border?.top
          ?? block.style?.border?.right
          ?? block.style?.border?.bottom
          ?? block.style?.border?.left;
        return this.positioned(block, {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: mmToPt(block.size.width),
              h: mmToPt(block.size.height),
              ...(block.borderRadius ? { r: mmToPt(block.borderRadius) } : {}),
              // Precedence: panel-controlled `style.background` wins over
              // the legacy `fill` so user edits aren't masked by the
              // factory's default fill seed.
              color: block.style?.background ?? block.fill ?? undefined,
              lineColor: side?.color,
              lineWidth: side?.width ?? 0,
            },
          ],
        });
      }
      case 'divider':
        return this.positioned(block, {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: mmToPt(block.size.width),
              y2: 0,
              lineWidth: block.thickness ?? 0.5,
              lineColor: block.color ?? '#e5e7eb',
              dash: block.pattern === 'dashed' ? { length: 3, space: 2 } : block.pattern === 'dotted' ? { length: 0.5, space: 1.5 } : undefined,
            },
          ],
        });
      case 'qr-code': {
        const value = this.binding.interpolate(block.value, ctx);
        return this.positioned(block, {
          qr: value,
          fit: mmToPt(Math.min(block.size.width, block.size.height)),
          eccLevel: block.ecLevel ?? 'M',
        });
      }
      case 'barcode': {
        const value = this.binding.interpolate(block.value, ctx);
        return this.positioned(block, {
          svg: barcodeSvg(value, block.symbology, {
            showText: block.showText,
            dark: merged?.font?.color,
            light: merged?.background,
          }),
          width: mmToPt(block.size.width),
          height: mmToPt(block.size.height),
        });
      }
      case 'signature': {
        const label = block.label ?? '';
        // Mirror the HTML/canvas renderers: line uses style.border.bottom
        // when set, else 0.5pt in the font color. Label inherits font /
        // alignment from style via styleToPdf (with size 8 as the default
        // when style.font.size isn't set).
        const sigBorder = merged?.border?.bottom;
        const lineColor = sigBorder?.color ?? merged?.font?.color ?? '#000000';
        const lineWidth = sigBorder?.width ?? 0.5;
        const alignment = (merged?.align ?? 'center') as 'left' | 'right' | 'center' | 'justify';
        return this.positioned(block, {
          stack: [
            { canvas: [{
              type: 'line',
              x1: 0,
              y1: mmToPt(block.size.height) - 10,
              x2: mmToPt(block.size.width),
              y2: mmToPt(block.size.height) - 10,
              lineWidth,
              lineColor,
            }] },
            {
              text: label,
              alignment,
              fontSize: 8,
              margin: [0, 2, 0, 0],
              ...this.styleToPdf(merged),
              ...this.arabicFontOverride(label),
            },
          ],
        });
      }
      case 'page-number':
        return this.positionedText(block, this.binding.interpolate(block.format, ctx), merged);
      case 'totals':
        return this.positioned(block, this.renderTotalsBody(block, ctx, merged));
      case 'payments':
        return this.positioned(block, this.renderPaymentsBody(block, ctx));
      case 'group-header':
      case 'group-footer':
        return this.positionedText(block, this.binding.interpolate(block.template, ctx), merged);
      case 'table':
        return this.renderTable(block, ctx);
      case 'repeater':
        return this.renderRepeater(block, ctx, 'absolute');
    }
  }

  private renderPaymentsBody(
    block: Extract<Block, { type: 'payments' }>,
    ctx: BindingContext,
  ): Exclude<PdfContent, string> {
    const rows = this.applyRowVisibility(
      block.rowVisibleWhen,
      this.binding.resolveArray(block.dataSource, ctx),
      ctx,
    );
    const currency = block.currency ?? 'BHD';
    const ids = block.columns ?? DEFAULT_PAYMENT_COLUMNS;
    const cols: PaymentColumnDef[] = ids
      .map((id) => PAYMENT_COLUMN_CATALOG.find((c) => c.id === id))
      .filter((c): c is PaymentColumnDef => !!c);

    if (cols.length === 0) {
      // No columns selected — emit an empty stack so positioned() still has a
      // box to anchor at the block's coordinates.
      return { stack: [] };
    }

    // pdfmake adds cell padding + border lines around the widths array — match
    // the overhead math used by renderTable so the visible table never exceeds
    // the block's designed width (and so the right-margin guard isn't
    // undershot). When borders are hidden we still leave the same overhead
    // budget so the layout doesn't shift between border on/off.
    const numCols = cols.length;
    const lineW = block.showBorder === false ? 0 : TABLE_LINE_W;
    const overheadPt = numCols * (TABLE_PAD_X * 2) + (numCols + 1) * TABLE_LINE_W;
    const widthPt = mmToPt(block.size.width);
    const usable = Math.max(0, widthPt - overheadPt);
    const totalWeight = cols.reduce((s, c) => s + c.weight, 0) || 1;
    const widths: number[] = cols.map((c) => (usable * c.weight) / totalWeight);

    const body: PdfContent[][] = [];
    if (block.showHeader !== false) {
      body.push(
        cols.map((c) => ({
          text: c.label,
          fillColor: '#f3f4f6',
          bold: true,
          alignment: c.align,
        })),
      );
    }
    rows.forEach((row, i) => {
      const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, i);
      const fillColor = block.zebra && i % 2 === 1 ? block.zebraColor ?? '#fafafa' : undefined;
      body.push(
        cols.map((c) => {
          const expr = c.isAmount ? `${c.expression} | currency:${currency}` : c.expression;
          const v = this.binding.evaluate(expr, rowCtx);
          const text = v === null || v === undefined ? '' : String(v);
          return { text, fillColor, alignment: c.align };
        }),
      );
    });

    // See renderTable for why this guard exists — empty body crashes pdfmake.
    if (body.length === 0) {
      body.push(cols.map(() => ({ text: '' })));
    }

    return {
      table: {
        widths,
        headerRows: block.showHeader === false ? 0 : 1,
        body,
      },
      layout: {
        hLineWidth: () => lineW,
        vLineWidth: () => lineW,
        hLineColor: () => '#d0d0d0',
        vLineColor: () => '#d0d0d0',
        paddingTop: () => TABLE_PAD_Y,
        paddingBottom: () => TABLE_PAD_Y,
        paddingLeft: () => TABLE_PAD_X,
        paddingRight: () => TABLE_PAD_X,
      },
    };
  }

  // ─── below-table flow layout ───────────────────────────────

  /**
   * Render blocks whose designed y is at/below the last table's bottom edge
   * as FLOW content (no absolutePosition). pdfmake then places them on
   * whichever page the table actually finishes — they ride along when the
   * table grows past its designed height instead of staying nailed to the
   * page-1 y where they overlap the overflowing rows.
   *
   * To preserve side-by-side layout (e.g. notes ↔ totals at the same y),
   * blocks within `Y_BAND_TOLERANCE_MM` are grouped into a row rendered as
   * pdfmake `columns`, with empty spacer columns reproducing the designed
   * x-gaps.
   */
  private renderBelowTableFlow(
    blocks: Block[],
    tableAnchorY: number,
    ctx: BindingContext,
  ): PdfContent | null {
    if (blocks.length === 0) return null;
    const Y_BAND_TOLERANCE_MM = 5;
    const sorted = [...blocks].sort((a, b) => a.position.y - b.position.y);
    const rows: Block[][] = [];
    let currentRow: Block[] = [];
    let currentRowY = -Infinity;
    for (const b of sorted) {
      if (b.position.y - currentRowY > Y_BAND_TOLERANCE_MM) {
        if (currentRow.length) rows.push(currentRow);
        currentRow = [b];
        currentRowY = b.position.y;
      } else {
        currentRow.push(b);
      }
    }
    if (currentRow.length) rows.push(currentRow);

    let prevRowEndY = tableAnchorY;
    const items: PdfContent[] = [];
    for (const row of rows) {
      row.sort((a, b) => a.position.x - b.position.x);
      const rowY = Math.min(...row.map((b) => b.position.y));
      const rowH = Math.max(...row.map((b) => b.size.height));
      const topGapMm = Math.max(0, rowY - prevRowEndY);
      prevRowEndY = rowY + rowH;

      const cols: PdfContent[] = [];
      let cursorMm = 0;
      for (const b of row) {
        if (b.position.x > cursorMm) {
          cols.push({ width: mmToPt(b.position.x - cursorMm), text: '' });
        }
        const flat = this.stripAbsolute(this.renderBlock(b, ctx));
        if (flat && typeof flat !== 'string') {
          cols.push({ ...(flat as object), width: mmToPt(b.size.width) } as PdfContent);
        }
        cursorMm = b.position.x + b.size.width;
      }
      // Fill remaining width so pdfmake doesn't auto-distribute.
      cols.push({ width: '*', text: '' });

      items.push({
        columns: cols,
        margin: [0, mmToPt(topGapMm), 0, 0],
      });
    }
    return { stack: items };
  }

  /**
   * Strip `absolutePosition` from a renderBlock result so the same content
   * can be reused inside flow containers. The inner `width` set by
   * `positionedText`/`positioned` survives, so the block still lays out at
   * its designed size when slotted into a parent `columns`.
   */
  private stripAbsolute(content: PdfContent | null): PdfContent | null {
    if (!content || typeof content === 'string') return content;
    if (!('absolutePosition' in (content as object))) return content;
    const { absolutePosition: _drop, ...rest } = content as Record<string, unknown>;
    return rest as PdfContent;
  }

  // ─── tables ────────────────────────────────────────────────

  /** Filter rows by a per-row visibility expression (same semantics as the
   *  HTML renderer). Returns the original array when the expression is
   *  absent so callers don't have to branch. */
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

  /**
   * Render a `repeater` (card list). Each row in `dataSource` produces one
   * card, positioned absolutely below the previous one. Children render
   * with `row`-scoped bindings, and their `position` is taken as
   * relative-to-card — converted to absolute page coords by adding the
   * card's own offset on top of the repeater block's position.
   */
  private renderRepeater(
    block: Extract<Block, { type: 'repeater' }>,
    ctx: BindingContext,
    _mode: 'absolute' | 'flow' = 'absolute',
  ): PdfContent {
    const rows = this.applyRowVisibility(
      block.rowVisibleWhen,
      this.binding.resolveArray(block.dataSource, ctx),
      ctx,
    );
    const itemH = block.itemHeight;
    const gap = block.itemSpacing ?? 0;
    const direction = block.direction ?? 'vertical';
    const stride = itemH + gap;
    // Available body height per page.
    //   - Page 1 starts at `position.y` (relative to bodyTop) — its budget
    //     shrinks by that offset.
    //   - Pages 2+ get the full body band.
    const bodyHeightPt = Math.max(0, this.bodyBottomPt - this.bodyTopPt);
    const bodyHeightMm = bodyHeightPt / mmToPt(1);
    const page1BudgetMm = Math.max(0, bodyHeightMm - block.position.y);
    const cardsPerPage1 = Math.max(1, Math.floor((page1BudgetMm + gap) / stride));
    const cardsPerPageN = Math.max(1, Math.floor((bodyHeightMm + gap) / stride));

    // Slice rows into pages. The first slice fills page 1's remaining body
    // band starting at `position.y`; every following slice starts at the
    // top of the body band on its own page.
    const slices: Array<{ rows: unknown[]; startIndex: number; yMm: number }> = [];
    let cursor = 0;
    while (cursor < rows.length) {
      const isFirst = slices.length === 0;
      const take = isFirst ? cardsPerPage1 : cardsPerPageN;
      const slice = rows.slice(cursor, cursor + take);
      slices.push({
        rows: slice,
        startIndex: cursor,
        yMm: isFirst ? block.position.y : 0,
      });
      cursor += slice.length;
    }
    // Empty data source still emits one (empty) slice so the wrapper has a
    // predictable shape.
    if (slices.length === 0) slices.push({ rows: [], startIndex: 0, yMm: block.position.y });

    // Anchor for below-repeater reflow: the actual bottom edge of the LAST
    // card on the LAST slice. Trailing absolute blocks emitted after this
    // repeater use the anchor to offset themselves so they land just past
    // the cards instead of at their designed Y (which might leave a huge
    // gap or — when the repeater spilled to extra pages — sit above the
    // cards entirely).
    const lastSlice = slices[slices.length - 1];
    const lastCardCount = Math.max(1, lastSlice.rows.length);
    const lastBottomMm = lastSlice.yMm + lastCardCount * itemH + Math.max(0, lastCardCount - 1) * gap;
    this.repeaterReflowAnchor = {
      designedBottomMm: block.position.y + block.size.height,
      actualBottomMm: lastBottomMm,
    };

    // Per-card background canvas. pdfmake has no native per-cell rounded
    // background so we draw a rounded rect canvas BEHIND each card's
    // children when the repeater has a `style.background` OR a border.
    // Children emitted after it sit on top because of pdfmake's draw
    // order within a stack — first item painted first.
    const cardBg = block.style?.background;
    const cardBorderSide = block.style?.border?.top
      ?? block.style?.border?.right
      ?? block.style?.border?.bottom
      ?? block.style?.border?.left;
    const cardRadiusPt = block.borderRadius ? mmToPt(block.borderRadius) : 0;
    const cardWPt = mmToPt(direction === 'horizontal' ? itemH : block.size.width);
    const cardHPt = mmToPt(itemH);

    const items: PdfContent[] = [];
    slices.forEach((slice, sliceIdx) => {
      // Force a new page before slice 2+ via an invisible flow marker.
      // Absolute content after the marker is positioned relative to the
      // new page's coordinate system, so each slice's cards land at the
      // designed Y on its own page.
      if (sliceIdx > 0) {
        items.push({ text: '', pageBreak: 'before' } as PdfContent);
      }
      slice.rows.forEach((row, i) => {
        const absIdx = slice.startIndex + i;
        const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, absIdx);
        // Card N's offset within this slice — every slice restarts at i=0.
        const offset = i * stride;
        const cardXMm = block.position.x + (direction === 'horizontal' ? offset : 0);
        const cardYMm = slice.yMm + (direction === 'vertical' ? offset : 0);
        // Card background: emit a rounded rect FIRST so children paint on
        // top. Emit it when the repeater carries either a background OR a
        // border — both ride on the same canvas rect so the radius rounds
        // both simultaneously (pdfmake's rect supports `color` + `lineColor`
        // + `lineWidth` on a single primitive).
        if (cardBg || cardBorderSide) {
          items.push({
            canvas: [{
              type: 'rect',
              x: 0,
              y: 0,
              w: cardWPt,
              h: cardHPt,
              ...(cardRadiusPt > 0 ? { r: cardRadiusPt } : {}),
              color: cardBg,
              lineColor: cardBorderSide?.color,
              lineWidth: cardBorderSide?.width ?? 0,
            }],
            absolutePosition: {
              x: this.originXPt + mmToPt(cardXMm),
              y: this.originYPt + mmToPt(cardYMm),
            },
          } as PdfContent);
        }
        for (const child of block.items) {
          const absChild = {
            ...child,
            position: {
              x: cardXMm + child.position.x,
              y: cardYMm + child.position.y,
            },
          } as Block;
          const rendered = this.renderBlock(absChild, rowCtx);
          if (rendered) items.push(rendered);
        }
      });
    });
    // `pageOrientation: undefined` keeps the inserted pageBreaks from
    // toggling orientation between slices — defensive against pdfmake
    // defaults changing.
    return { stack: items };
  }

  private renderTable(
    block: TableBlock,
    ctx: BindingContext,
    mode: 'absolute' | 'flow' = 'absolute',
  ): PdfContent {
    const rows = this.applyRowVisibility(
      block.rowVisibleWhen,
      this.binding.resolveArray(block.dataSource, ctx),
      ctx,
    );
    // pdfmake's table.widths only accepts numbers (pt), '*', or 'auto' — not
    // percentages. Convert each column to absolute points so the table fills
    // exactly block.size.width: fractions share whatever is left after the
    // fixed columns, weighted by their `fr` value.
    //
    // pdfmake renders each cell as `widths[i] + paddingLeft + paddingRight`
    // and draws a vLine between every column plus both outer edges, so the
    // visible table is wider than sum(widths) by `overheadPt`. Subtracting
    // it from the budget keeps the rendered table at exactly the designed
    // width — and prevents the right-margin guard from being undershot.
    const numCols = block.columns.length;
    const overheadPt = numCols * (TABLE_PAD_X * 2) + (numCols + 1) * TABLE_LINE_W;

    const designedWidthPt = mmToPt(block.size.width);
    const remainingToRightMarginPt = Math.max(
      0,
      this.usableWidthPt - mmToPt(block.position.x),
    );
    const totalWidthPt = Math.max(
      0,
      Math.min(designedWidthPt, remainingToRightMarginPt) - overheadPt,
    );
    const fixedTotalPt = block.columns.reduce(
      (s, c) => s + (c.width.kind === 'fixed' ? mmToPt(c.width.mm) : 0),
      0,
    );
    const fractionUnits = block.columns.reduce(
      (s, c) => s + (c.width.kind === 'fraction' ? c.width.fr : 0),
      0,
    );
    const remainingForFractions = Math.max(0, totalWidthPt - fixedTotalPt);
    let widths = block.columns.map((c): number | string => {
      if (c.width.kind === 'fixed') return mmToPt(c.width.mm);
      if (c.width.kind === 'fraction') {
        return fractionUnits > 0 ? (remainingForFractions * c.width.fr) / fractionUnits : 0;
      }
      return 'auto';
    });
    // If the fixed columns alone exceed the table's budget, the fraction
    // columns get 0 but the fixed columns still claim their full mm — so the
    // numeric sum overshoots block.size.width and the table grows past it.
    // Scale every numeric width down proportionally so the column array sums
    // to exactly totalWidthPt — the table can no longer outgrow its block.
    const numericSum = widths.reduce<number>(
      (s, w) => s + (typeof w === 'number' ? w : 0),
      0,
    );
    if (numericSum > totalWidthPt && numericSum > 0) {
      const scale = totalWidthPt / numericSum;
      widths = widths.map((w) => (typeof w === 'number' ? w * scale : w));
    }

    const body: PdfContent[][] = [];

    if (block.showHeader) {
      body.push(
        block.columns.map((c) => {
          const text = this.binding.interpolate(c.header, ctx);
          return {
            text,
            fillColor: '#f3f4f6',
            bold: true,
            alignment: c.align,
            ...this.styleToPdf(c.headerStyle),
            ...this.arabicFontOverride(text),
          };
        }),
      );
    }

    const rowH = block.rowMinHeight ?? 7;
    const buildRowCells = (row: unknown, i: number): PdfContent[] => {
      const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, i);
      const isOdd = i % 2 === 1;
      return block.columns.map((c, colIdx) => {
        const v = this.binding.evaluateCell(c.expression, rowCtx);
        const style = this.applyColumnConditional(c, rowCtx);
        const fillColor = block.zebra && isOdd ? block.zebraColor ?? '#fafafa' : undefined;
        if (c.cellType === 'image') {
          const src = v === null || v === undefined ? '' : String(v);
          const hPt = mmToPt(c.imageHeightMm ?? rowH);
          // Column-content width = column width minus the 2× horizontal
          // cell padding. Without this clamp, a tall imageHeightMm value
          // would let `fit: [hPt, hPt]` push the image wider than its
          // column, bleeding into the next column.
          const colW = widths[colIdx];
          const innerColPt = typeof colW === 'number' ? Math.max(0, colW - TABLE_PAD_X * 2) : hPt;
          const fitW = Math.min(hPt, innerColPt);
          if (!src) return { text: '', alignment: c.align, fillColor };
          // SVG goes through the `svg` field; PNG/JPEG (incl. data URLs) → `image`.
          // pdfmake won't auto-shrink an SVG to its container — set both
          // width and height so it can never blow the column wider.
          if (this.isSvgSource(src)) {
            const svg = this.extractSvgMarkup(src);
            return svg
              ? { svg, width: fitW, height: hPt, alignment: c.align, fillColor }
              : { text: '', alignment: c.align, fillColor };
          }
          return { image: src, fit: [fitW, hPt], alignment: c.align, fillColor };
        }
        const text = v === null || v === undefined ? '' : String(v);
        return {
          text,
          alignment: c.align,
          fillColor,
          ...this.styleToPdf(style),
          ...this.arabicFontOverride(text),
        };
      });
    };

    if (block.groups && block.groups.length > 0) {
      // Single-level grouping (matches the HTML renderer's behaviour).
      // Group banners and subtotal lines span every column via colSpan;
      // pdfmake requires placeholder `{}` cells for the rest of the row.
      const group = block.groups[0];
      const buckets = new Map<unknown, unknown[]>();
      rows.forEach((row, i) => {
        const rowCtx = this.binding.withRow(ctx, row as Record<string, unknown>, i);
        const key = this.binding.evaluate(group.by, rowCtx);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(row);
      });
      let groupIndex = 0;
      let runningRowIndex = 0;
      for (const [key, bucketRows] of buckets) {
        const groupCtx = this.binding.withGroup(ctx, key, bucketRows, groupIndex);
        if (group.showHeader !== false && group.headerExpression) {
          const text = this.binding.interpolate(group.headerExpression, groupCtx);
          const cell: PdfContent = {
            text,
            colSpan: numCols,
            fillColor: '#f3f4f6',
            bold: true,
            ...this.arabicFontOverride(text),
          };
          body.push([cell, ...Array(Math.max(0, numCols - 1)).fill({})]);
        }
        for (const row of bucketRows) {
          body.push(buildRowCells(row, runningRowIndex));
          runningRowIndex += 1;
        }
        if (group.showFooter !== false && group.footerExpression) {
          const text = this.binding.interpolate(group.footerExpression, groupCtx);
          const cell: PdfContent = {
            text,
            colSpan: numCols,
            italics: true,
            ...this.arabicFontOverride(text),
          };
          body.push([cell, ...Array(Math.max(0, numCols - 1)).fill({})]);
        }
        groupIndex += 1;
      }
    } else {
      rows.forEach((row, i) => body.push(buildRowCells(row, i)));
    }

    if (block.showFooter) {
      body.push(
        block.columns.map((c) => {
          if (!c.footer) return { text: '', fillColor: '#fafafa' };
          const value = c.footer.kind === 'custom' && c.footer.expression
            ? this.binding.evaluate(c.footer.expression, ctx)
            : this.binding.aggregate(
              c.footer.kind === 'custom' ? 'sum' : c.footer.kind,
              rows,
              c.footer.expression ?? c.expression,
              ctx,
            );
          const formatted = c.footer.format
            ? this.binding.evaluate(`x | ${c.footer.format}`, { ...ctx, vars: { ...ctx.vars, x: value } } as BindingContext)
            : value;
          const text = String(formatted ?? '');
          return {
            text,
            alignment: c.align,
            bold: true,
            fillColor: '#fafafa',
            ...this.arabicFontOverride(text),
          };
        }),
      );
    }

    // pdfmake's preprocessTable reads `body[0].length` unconditionally —
    // an empty body (header off + no data rows + footer off) throws
    // "Cannot read properties of undefined". Backfill a blank row keyed to
    // the column count so the export still produces a (visibly empty) table.
    if (body.length === 0 && block.columns.length > 0) {
      body.push(block.columns.map(() => ({ text: '' })));
    }

    const tableContent: PdfContent = {
      table: {
        widths,
        headerRows: block.showHeader ? 1 : 0,
        body,
        keepWithHeaderRows: block.repeatHeader ? 1 : 0,
        dontBreakRows: !block.pageBreak,
      },
      layout: {
        hLineWidth: () => TABLE_LINE_W,
        vLineWidth: () => TABLE_LINE_W,
        hLineColor: () => '#d0d0d0',
        vLineColor: () => '#d0d0d0',
        paddingTop: () => TABLE_PAD_Y,
        paddingBottom: () => TABLE_PAD_Y,
        paddingLeft: () => TABLE_PAD_X,
        paddingRight: () => TABLE_PAD_X,
      },
    };

    // Two positioning modes:
    //   'absolute' — current behavior, table pinned at exact (x, y). pdfmake
    //                does NOT advance its flow writer past absolute content,
    //                so anything appended in the content array still draws
    //                from flow Y=0.
    //   'flow'     — table participates in flow. After the table renders,
    //                flow Y is at the table's actual bottom — exactly what
    //                the below-table stack needs to land just past it.
    if (mode === 'absolute') {
      return {
        ...tableContent,
        absolutePosition: {
          x: this.originXPt + mmToPt(block.position.x),
          y: this.originYPt + mmToPt(block.position.y),
        },
      };
    }

    // Flow mode: place the table at (designed x, designed y) on page 1.
    // Top placement is forced by an invisible canvas spacer rather than the
    // table's own `margin[top]` because pdfmake collapses the top margin of
    // the first flow item on a page — the spacer survives that collapse.
    // Spacer height also folds in `flowTopOffsetPt`, the gap between
    // pageMargins[1] (flow origin) and the body band's actual top
    // (`originYPt` — diverges only when repeatHeader=false leaves the
    // page-1 absolute header sitting above body).
    const flowTopOffsetPt = Math.max(0, this.originYPt - this.pageMarginsTopPt);
    const spacerHeightPt = flowTopOffsetPt + mmToPt(block.position.y);
    return {
      stack: [
        ...(spacerHeightPt > 0
          ? [{
              canvas: [{
                type: 'rect',
                x: 0,
                y: 0,
                w: 0.001,
                h: spacerHeightPt,
                color: '#ffffff',
                lineWidth: 0,
              }],
            } as PdfContent]
          : []),
        {
          ...tableContent,
          margin: [mmToPt(block.position.x), 0, 0, 0] as [number, number, number, number],
        },
      ],
    };
  }

  private renderTotalsBody(
    block: Extract<Block, { type: 'totals' }>,
    ctx: BindingContext,
    merged: BlockStyle | undefined,
  ): Exclude<PdfContent, string> {
    const labelW = mmToPt(block.labelWidth ?? 35);
    const remaining = mmToPt(block.size.width) - labelW;
    const numRows = block.rows.length;
    const numCols = 2;
    // Draw only the OUTER box per the block's border config — inner row /
    // column dividers stay off so the totals read as a single bordered card,
    // matching the HTML renderer.
    const border = merged?.border;
    const top = border?.top;
    const bottom = border?.bottom;
    const left = border?.left;
    const right = border?.right;
    const body: PdfContent[][] = block.rows.map((r) => {
      // Mirror HTML renderer: append format pipe to expression for formatting.
      const expr = r.format ? `${r.expression} | ${r.format}` : r.expression;
      const v = this.binding.evaluate(expr, ctx);
      const valueText = v === null || v === undefined ? '' : String(v);
      return [
        { text: r.label, bold: !!r.bold, ...this.arabicFontOverride(r.label) },
        { text: valueText, alignment: 'right' as const, bold: !!r.bold, ...this.arabicFontOverride(valueText) },
      ];
    });
    // pdfmake crashes on tables with empty body — see renderTable. Block
    // with zero totals rows still needs a placeholder row to render.
    if (body.length === 0) {
      body.push([{ text: '' }, { text: '' }]);
    }
    return {
      table: {
        widths: [labelW, remaining],
        body,
      },
      layout: {
        hLineWidth: (i: number) =>
          i === 0 ? top?.width ?? 0 : i === numRows ? bottom?.width ?? 0 : 0,
        vLineWidth: (i: number) =>
          i === 0 ? left?.width ?? 0 : i === numCols ? right?.width ?? 0 : 0,
        hLineColor: (i: number) =>
          i === 0 ? top?.color ?? '#000' : i === numRows ? bottom?.color ?? '#000' : '#000',
        vLineColor: (i: number) =>
          i === 0 ? left?.color ?? '#000' : i === numCols ? right?.color ?? '#000' : '#000',
        paddingTop: () => 1,
        paddingBottom: () => 1,
        paddingLeft: () => 2,
        paddingRight: () => 2,
      },
    };
  }

  // ─── style mapping ─────────────────────────────────────────

  private styleToPdf(style: BlockStyle | undefined): Record<string, unknown> {
    if (!style) return {};
    const out: Record<string, unknown> = {};
    if (style.font?.size !== undefined) out['fontSize'] = style.font.size;
    if (style.font?.weight && (style.font.weight === 'bold' || Number(style.font.weight) >= 600)) out['bold'] = true;
    if (style.font?.italic) out['italics'] = true;
    if (style.font?.color) out['color'] = style.font.color;
    if (style.font?.underline) out['decoration'] = 'underline';
    // pdfmake doesn't understand CSS font stacks like '"Inter", Arial, sans-serif'.
    // Only forward the name if it matches a font registered in pdfMake.fonts
    // (the default VFS only ships Roboto). Otherwise let pdfmake fall back.
    const fontName = this.resolvePdfFontName(style.font?.family);
    if (fontName) out['font'] = fontName;
    if (style.background) out['fillColor'] = style.background;
    if (style.align) out['alignment'] = style.align;
    if (style.padding) {
      out['margin'] = [
        style.padding.left ?? 0,
        style.padding.top ?? 0,
        style.padding.right ?? 0,
        style.padding.bottom ?? 0,
      ];
    }
    return out;
  }

  /**
   * Section height in mm: explicit `height` if set, otherwise the max bottom
   * edge (y + height) of contained blocks. Returns 0 for missing sections.
   */
  private sectionHeightMm(section: Section | undefined): number {
    if (!section) return 0;
    if (section.height) return section.height;
    let max = 0;
    for (const b of section.blocks) max = Math.max(max, b.position.y + b.size.height);
    return max;
  }

  /** True if `src` is an SVG (data URL with svg+xml mime, or starts with `<svg`). */
  private isSvgSource(src: string): boolean {
    const s = src.trim();
    return s.startsWith('<svg') || /^data:image\/svg\+xml/i.test(s);
  }

  /**
   * Pull raw SVG markup out of either a `data:image/svg+xml;...` URL (handling
   * `;base64,` and `;utf8,` / URL-encoded forms) or an inline `<svg>` string.
   * Returns undefined if the input doesn't look like extractable SVG.
   */
  private extractSvgMarkup(src: string): string | undefined {
    const s = src.trim();
    if (s.startsWith('<svg')) return s;
    const m = /^data:image\/svg\+xml(?:;([^,]+))?,(.*)$/i.exec(s);
    if (!m) return undefined;
    const params = (m[1] ?? '').toLowerCase();
    const payload = m[2];
    try {
      if (params.includes('base64')) return atob(payload);
      return decodeURIComponent(payload);
    } catch {
      return undefined;
    }
  }

  /**
   * Map a CSS font-family declaration to a font name registered in
   * pdfMake.fonts. Returns undefined if no match — caller should omit the
   * `font` field so pdfmake uses its default (Roboto).
   */
  private resolvePdfFontName(family: string | undefined): string | undefined {
    if (!family) return undefined;
    const known = new Set(['Roboto', 'Amiri']);
    for (const raw of family.split(',')) {
      const name = raw.trim().replace(/^["']|["']$/g, '');
      if (known.has(name)) return name;
    }
    return undefined;
  }

  /**
   * Positioned text. pdfmake's `absolutePosition` doesn't reliably honor
   * `width` + `alignment` on a bare text node — `alignment: 'right'` (and
   * center) ends up applied against pdfmake's internal flow width instead of
   * the block's box, so right-aligned values land far from where the designer
   * placed them. Wrapping the run in a single-column box of exactly
   * `block.size.width` pins both wrap and alignment to the block. Used for
   * every text-bearing block (text, rich-text, dynamic-field, page-number,
   * group-header/footer).
   */
  private positionedText(
    block: Block,
    text: string | PdfContent[],
    merged: BlockStyle | undefined,
  ): PdfContent {
    return {
      absolutePosition: {
        x: this.originXPt + mmToPt(block.position.x),
        y: this.originYPt + mmToPt(block.position.y),
      },
      columns: [
        {
          width: mmToPt(block.size.width),
          text,
          ...this.styleToPdf(merged),
          ...this.arabicFontOverride(text),
        },
      ],
    };
  }

  /**
   * Force `font: 'Amiri'` on any run that contains Arabic — pdfmake's
   * default Roboto has no Arabic glyphs, so without this Arabic chars
   * render as `.notdef` boxes. Amiri also has Latin glyphs, so mixed
   * runs still render acceptably. (Amiri is registered by
   * `registerArabicFont()` at PDF-export time.) Returns `{}` for
   * Latin-only runs so the document keeps Roboto as the default.
   */
  private arabicFontOverride(text: string | PdfContent[]): { font?: string } {
    if (typeof text === 'string') {
      return containsArabic(text) ? { font: 'Amiri' } : {};
    }
    for (const run of text) {
      if (typeof run === 'string') {
        if (containsArabic(run)) return { font: 'Amiri' };
      } else if (run && typeof run.text === 'string' && containsArabic(run.text)) {
        return { font: 'Amiri' };
      }
    }
    return {};
  }

  private positioned(block: Block, content: Partial<Exclude<PdfContent, string>>): PdfContent {
    // Canvas content (rect/line/divider) defines its own dimensions via the
    // shape entries; adding `width` to the wrapper would cause pdfmake to
    // re-flow it. Skip width for canvas-only nodes.
    const isCanvasOnly = 'canvas' in content && !('text' in content) && !('stack' in content);
    const out: Partial<Exclude<PdfContent, string>> = {
      ...content,
      absolutePosition: {
        x: this.originXPt + mmToPt(block.position.x),
        y: this.originYPt + mmToPt(block.position.y),
      },
    };
    if (!isCanvasOnly) out.width = mmToPt(block.size.width);
    return out as PdfContent;
  }

  private applyConditionalStyle(block: Block, ctx: BindingContext): BlockStyle | undefined {
    if (!block.conditionalStyles?.length) return block.style;
    let merged: BlockStyle = { ...(block.style ?? {}) };
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
  ): BlockStyle | undefined {
    if (!col.conditionalStyles?.length) return col.cellStyle;
    let merged: BlockStyle = { ...(col.cellStyle ?? {}) };
    for (const c of col.conditionalStyles) {
      if (this.binding.isTruthy(c.when, ctx)) {
        merged = { ...merged, ...c.style, font: { ...merged.font, ...c.style.font } };
      }
    }
    return merged;
  }

  /**
   * Rough HTML → PDFMake text-runs conversion. Production: use a proper HTML
   * parser (e.g. parse5) and map nodes to runs. This handles the common
   * subset (b/strong, i/em, u, br) which is enough for invoice copy.
   */
  private htmlToPdfRuns(html: string): PdfContent[] {
    const runs: PdfContent[] = [];
    const tokens = html.split(/(<[^>]+>)/g);
    const stack: Array<{ bold?: boolean; italics?: boolean; underline?: boolean }> = [{}];
    for (const tok of tokens) {
      if (!tok) continue;
      if (tok.startsWith('<')) {
        const close = tok.startsWith('</');
        const tag = tok.replace(/[<\/>]/g, '').split(' ')[0].toLowerCase();
        if (tag === 'br') {
          runs.push('\n');
          continue;
        }
        if (close) {
          stack.pop();
        } else {
          const top = stack[stack.length - 1];
          stack.push({
            ...top,
            bold: top.bold || tag === 'b' || tag === 'strong',
            italics: top.italics || tag === 'i' || tag === 'em',
            underline: top.underline || tag === 'u',
          });
        }
      } else {
        const top = stack[stack.length - 1];
        runs.push({
          text: tok,
          bold: top.bold,
          italics: top.italics,
          decoration: top.underline ? 'underline' : undefined,
        });
      }
    }
    return runs;
  }
}
