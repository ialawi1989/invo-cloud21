import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  HostListener,
  OnDestroy,
  computed,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  Block,
  PAYMENT_COLUMN_CATALOG,
  DEFAULT_PAYMENT_COLUMNS,
  PaymentColumnDef,
  TableColumn,
} from '../../core/types/block.types';
import { BindingContext } from '../../core/types/binding.types';
import { AlignGuide, DesignerStateService } from '../../services/designer-state.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { mmToPx } from '../../core/layout/dimensions';
import { blockStyleToCss } from '../../renderers/html/css-utils';
import { barcodeSvg, qrSvg } from '../../utils/code-svg.utils';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** 96 dpi conversion factor, hoisted so the hot drag path doesn't recompute it. */
const PX_PER_MM = mmToPx(1);

/** How close (mm) an edge must come to a neighbour's edge before it snaps. */
const SNAP_THRESHOLD_MM = 1.5;

/** Design grid. 0.5mm suits invoice work; fine enough to look deliberate,
 *  coarse enough that dragging lands on round numbers. */
const SNAP_GRID_MM = 0.5;

/** Rows of sample data rendered inside table/payments previews. The export
 *  renderer paginates properly; the canvas only needs enough to show layout. */
const PREVIEW_ROW_CAP = 15;

/**
 * One block on the design surface: a live preview of its content plus the
 * selection outline and eight resize handles.
 *
 * Drag/resize use native pointer events rather than CDK DragDrop — we need
 * pixel-precise mm conversion, multi-select, and edge snapping, none of
 * which CDK handles cleanly across many items.
 */
@Component({
  selector: 'app-canvas-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Self-import so the 'repeater' branch can render nested
  // <app-canvas-block> per child. forwardRef is required because the class
  // symbol isn't bound yet when the decorator metadata is built.
  imports: [CommonModule, forwardRef(() => CanvasBlockComponent)],
  templateUrl: './canvas-block.component.html',
  styleUrls: ['./canvas-block.component.scss'],
})
export class CanvasBlockComponent implements OnDestroy {
  readonly block = input.required<Block>();
  readonly zoom = input.required<number>();

  /** Vertical offset (mm) added to position.y for display only. Lets footer
   *  blocks — whose y is section-local — appear in the footer band without
   *  altering their stored coordinates. Drag deltas stay section-local so
   *  position updates pass straight through. */
  readonly yOffsetMm = input<number>(0);

  /** Binding context handed down by a parent block. A `repeater` passes its
   *  first row so `{{row.x}}` resolves in the child previews, matching what
   *  the HTML/PDF exports do at render time. */
  readonly rowContextOverride = input<BindingContext | null>(null);

  /** Cumulative ancestor offset (mm) of this block's coordinate frame from
   *  the margin-frame origin. Top-level blocks are 0 — their `yOffsetMm`
   *  already carries the section offset. Repeater children get the
   *  repeater's own resolved frame origin. The align-guide overlay reads
   *  these so a guide drawn in page-mm lines up with the rendered block no
   *  matter how deeply nested it is. */
  readonly parentXOffsetMm = input<number>(0);
  readonly parentYOffsetMm = input<number>(0);

  private readonly state = inject(DesignerStateService);
  private readonly contextMenu = inject(ContextMenuService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Shared engine from designer state, so the host's `extraFilters` (e.g. a
   *  tenant-aware `currency`) apply in the preview exactly as they do on
   *  export. Recomputes when those filters change. */
  private readonly bindingEngine = computed(() => this.state.bindingEngine());

  readonly selected = computed(() => this.state.selectedIds().has(this.block().id));
  readonly locked = computed(() => !!this.block().locked);

  /** Handles shown when selected. Dividers are conceptually horizontal —
   *  their thickness is a style field, not a size — so they only get w/e. */
  readonly handles = computed<ResizeHandle[]>(() =>
    this.block().type === 'divider' ? ['e', 'w'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'],
  );

  /** Root binding context from the template's sampleData; everything in the
   *  WYSIWYG preview evaluates against this. */
  private readonly ctx = computed<BindingContext>(() => {
    const override = this.rowContextOverride();
    if (override) return override;
    const t = this.state.template();
    return this.bindingEngine().createRoot(
      (t?.sampleData ?? {}) as Record<string, unknown>,
      t?.locale ?? 'en-US',
      {},
    );
  });

  /** Row-scoped context for children of a `repeater` — the first row of the
   *  resolved data source, so the "template card" shows real values. Falls
   *  back to the root context when the source is empty or broken. */
  readonly repeaterChildCtx = computed<BindingContext | null>(() => {
    const b = this.block();
    if (b.type !== 'repeater') return null;
    try {
      const rows = this.bindingEngine().resolveArray(b.dataSource, this.ctx());
      return rows.length === 0
        ? this.ctx()
        : this.bindingEngine().withRow(this.ctx(), rows[0] as Record<string, unknown>, 0);
    } catch {
      return this.ctx();
    }
  });

  // ─── Style projections ──────────────────────────────────────────

  readonly fontSize = computed(() => this.block().style?.font?.size ?? 10);
  readonly align = computed(() => this.block().style?.align ?? 'left');
  readonly weight = computed(() => this.block().style?.font?.weight ?? 'normal');

  /** The block's full style as a CSS string — the same helper the HTML
   *  renderer uses on export, so the canvas shows the real font, color,
   *  background, padding, border, and alignment as the user edits them. */
  readonly blockCss = computed<string>(() => blockStyleToCss(this.block().style));

  // ─── Live-evaluated previews ────────────────────────────────────
  // Each of these interpolates or evaluates against the current sampleData
  // so the canvas shows actual output. Failures fall back to the raw source
  // so a half-typed expression is still visible rather than blanking out.

  readonly textPreview = computed(() => {
    const b = this.block();
    return b.type === 'text' ? this.safeInterpolate(b.text ?? '') : '';
  });

  readonly richHtml = computed(() => {
    const b = this.block();
    return b.type === 'rich-text' ? this.safeInterpolate(b.html ?? '') : '';
  });

  readonly expressionText = computed(() => {
    const b = this.block();
    return b.type === 'dynamic-field' ? this.safeEvaluateCell(b.expression) : '';
  });

  readonly lineColor = computed(() => {
    const b = this.block();
    return b.type === 'line' ? b.color : '#000';
  });

  readonly rectFill = computed(() => {
    const b = this.block();
    if (b.type !== 'rectangle') return 'transparent';
    // `style.background` — what the property panel writes — wins over the
    // legacy `fill` field. Otherwise the factory default would mask every
    // edit made through the generic color slot.
    return b.style?.background ?? b.fill ?? '#f3f4f6';
  });

  /** Corner radius (mm) for rectangles; 0 elsewhere so the binding stays
   *  unconditional and well-typed. */
  readonly rectRadius = computed<number>(() => {
    const b = this.block();
    return b.type === 'rectangle' ? b.borderRadius ?? 0 : 0;
  });

  readonly dividerCss = computed(() => {
    const b = this.block();
    if (b.type !== 'divider') return '';
    return `${b.thickness ?? 0.5}pt ${b.pattern ?? 'solid'} ${b.color ?? '#e5e7eb'}`;
  });

  readonly sigLabel = computed(() => {
    const b = this.block();
    return b.type === 'signature' ? b.label ?? '' : '';
  });

  /** Signature rule: `style.border.bottom` when the user set one, else a
   *  0.5pt solid line in the font color. Keeps it themeable without a
   *  dedicated color field. */
  readonly signatureLineCss = computed<string>(() => {
    const b = this.block();
    if (b.type !== 'signature') return '';
    const border = b.style?.border?.bottom;
    return `${border?.width ?? 0.5}pt ${border?.style ?? 'solid'} ${border?.color ?? b.style?.font?.color ?? '#000'}`;
  });

  readonly pageFormat = computed(() => {
    const b = this.block();
    // {{page.current}} / {{page.total}} resolve from the context's default
    // `page: { current: 1, total: 1 }` — right for a preview; the renderer
    // substitutes real values per page at export.
    return b.type === 'page-number' ? this.safeInterpolate(b.format) : '';
  });

  readonly totalsRows = computed(() => {
    const b = this.block();
    return b.type === 'totals' ? b.rows : [];
  });

  /** First-column width (mm) for totals — mirrors the HTML renderer's 35mm
   *  default so editing the field shows up on the canvas. */
  readonly totalsLabelWidth = computed<number>(() => {
    const b = this.block();
    return b.type === 'totals' ? b.labelWidth ?? 35 : 35;
  });

  readonly groupTemplate = computed(() => {
    const b = this.block();
    return b.type === 'group-header' || b.type === 'group-footer' ? this.safeInterpolate(b.template) : '';
  });

  // ─── QR / barcode previews ──────────────────────────────────────
  // Generated with the same helpers the renderers use, so the canvas shows
  // the real symbol rather than a decorative stand-in. Sanitizer bypass is
  // safe: the SVG is built by our own generators, never from user HTML.

  readonly qrPreview = computed<SafeHtml>(() => {
    const b = this.block();
    if (b.type !== 'qr-code') return '';
    const style = b.style;
    return this.sanitizer.bypassSecurityTrustHtml(
      qrSvg(this.safeInterpolate(b.value), {
        ecLevel: b.ecLevel,
        margin: b.margin,
        dark: style?.font?.color,
        light: style?.background,
      }),
    );
  });

  readonly barcodePreview = computed<SafeHtml>(() => {
    const b = this.block();
    if (b.type !== 'barcode') return '';
    const style = b.style;
    return this.sanitizer.bypassSecurityTrustHtml(
      barcodeSvg(this.safeInterpolate(b.value), b.symbology, {
        showText: b.showText,
        dark: style?.font?.color,
        light: style?.background,
      }),
    );
  });

  // ─── Tables ─────────────────────────────────────────────────────

  readonly tableColumns = computed<TableColumn[]>(() => {
    const b = this.block();
    return b.type === 'table' ? b.columns : [];
  });

  /** Sum of every fixed-mm column width — the subtrahend in fraction calc(). */
  readonly tableFixedTotalMm = computed<number>(() => {
    const b = this.block();
    if (b.type !== 'table') return 0;
    return b.columns.reduce((s, c) => s + (c.width.kind === 'fixed' ? c.width.mm : 0), 0);
  });

  /** Total fraction weight. Auto columns stay out of this so their
   *  content-sizing isn't coupled to the fr math. */
  readonly tableFractionTotal = computed<number>(() => {
    const b = this.block();
    if (b.type !== 'table') return 0;
    return b.columns.reduce((s, c) => s + (c.width.kind === 'fraction' ? c.width.fr : 0), 0);
  });

  readonly tableHasAutoCol = computed<boolean>(() => {
    const b = this.block();
    return b.type === 'table' && b.columns.some((c) => c.width.kind === 'auto');
  });

  readonly tableRowMinHeight = computed<number>(() => {
    const b = this.block();
    return b.type === 'table' ? b.rowMinHeight ?? 8 : 8;
  });

  /** Column width CSS — mirrors the HTML renderer:
   *    fixed    → `<width>mm`
   *    fraction → `calc((100% - <fixedTotal>mm) * <share>)`
   *    auto     → empty, letting the browser content-size it */
  tableColWidth(col: TableColumn): string {
    if (col.width.kind === 'fixed') return `${col.width.mm}mm`;
    if (col.width.kind === 'fraction') {
      const totalFr = this.tableFractionTotal();
      if (totalFr <= 0) return '';
      return `calc((100% - ${this.tableFixedTotalMm()}mm) * ${col.width.fr / totalFr})`;
    }
    return '';
  }

  readonly tableRows = computed<unknown[]>(() => this.previewRows('table'));
  readonly paymentsRows = computed<unknown[]>(() => this.previewRows('payments'));

  readonly paymentsCurrency = computed<string>(() => {
    const b = this.block();
    return b.type === 'payments' ? b.currency ?? 'BHD' : 'BHD';
  });

  readonly paymentsCols = computed<readonly PaymentColumnDef[]>(() => {
    const b = this.block();
    if (b.type !== 'payments') return [];
    return (b.columns ?? DEFAULT_PAYMENT_COLUMNS)
      .map((id) => PAYMENT_COLUMN_CATALOG.find((c) => c.id === id))
      .filter((c): c is PaymentColumnDef => !!c);
  });

  readonly paymentsShowBorder = computed<boolean>(() => {
    const b = this.block();
    return b.type === 'payments' && b.showBorder !== false;
  });

  readonly paymentsShowHeader = computed<boolean>(() => {
    const b = this.block();
    return b.type === 'payments' && b.showHeader !== false;
  });

  // ─── Repeater ───────────────────────────────────────────────────

  readonly repeaterChildren = computed<Block[]>(() => {
    const b = this.block();
    return b.type === 'repeater' ? b.items : [];
  });

  /** Row count from the repeater's data source — drives the "card · N rows"
   *  badge so the user can sanity-check the binding at a glance. */
  readonly repeaterRowCount = computed<number>(() => {
    const b = this.block();
    if (b.type !== 'repeater') return 0;
    try {
      return this.bindingEngine().resolveArray(b.dataSource, this.ctx()).length;
    } catch {
      return 0;
    }
  });

  readonly repeaterRadius = computed<number>(() => {
    const b = this.block();
    return b.type === 'repeater' ? b.borderRadius ?? 0 : 0;
  });

  /** True once the user gives the repeater its own background or border —
   *  the dashed "card" hint then hides, so the preview shows only styling
   *  the export will actually produce. */
  readonly repeaterHasOwnSkin = computed<boolean>(() => {
    const b = this.block();
    if (b.type !== 'repeater' || !b.style) return false;
    if (b.style.background) return true;
    const bd = b.style.border;
    return !!(bd && (bd.top?.width || bd.right?.width || bd.bottom?.width || bd.left?.width));
  });

  // ─── Cell evaluation ────────────────────────────────────────────

  evalTableCell(expression: string, row: unknown, rowIndex: number): string {
    try {
      const rowCtx = this.bindingEngine().withRow(this.ctx(), row as Record<string, unknown>, rowIndex);
      const v = this.bindingEngine().evaluateCell(expression, rowCtx);
      return v === null || v === undefined ? '' : String(v);
    } catch {
      return '';
    }
  }

  /** Payments cell, with the catalog's currency formatting applied to the
   *  Amount column so the preview matches the export. */
  evalPaymentCell(col: PaymentColumnDef, row: unknown, rowIndex: number): string {
    const expr = col.isAmount ? `${col.expression} | currency:${this.paymentsCurrency()}` : col.expression;
    try {
      const rowCtx = this.bindingEngine().withRow(this.ctx(), row as Record<string, unknown>, rowIndex);
      const v = this.bindingEngine().evaluateCell(expr, rowCtx);
      return v === null || v === undefined ? '' : String(v);
    } catch {
      return '';
    }
  }

  evalTotalsValue(expression: string, format?: string): string {
    try {
      const v = this.bindingEngine().evaluateCell(format ? `${expression} | ${format}` : expression, this.ctx());
      return v === null || v === undefined ? '' : String(v);
    } catch {
      return '';
    }
  }

  /** Header CSS for a table column: `headerStyle` plus a `col.align`
   *  fallback when the style doesn't declare alignment itself. */
  headerCss(col: TableColumn): string {
    const css = blockStyleToCss(col.headerStyle);
    if (col.headerStyle?.align || !col.align) return css;
    return css ? `${css}; text-align: ${col.align}` : `text-align: ${col.align}`;
  }

  /** Same for body cells, plus `pre-line` so `\n` in a cell value wraps the
   *  way it does in the HTML export. */
  cellCss(col: TableColumn): string {
    const css = blockStyleToCss(col.cellStyle);
    const base = col.cellStyle?.align || !col.align ? css : css ? `${css}; text-align: ${col.align}` : `text-align: ${col.align}`;
    return base ? `${base}; white-space: pre-line` : 'white-space: pre-line';
  }

  // ─── Host geometry ──────────────────────────────────────────────

  @HostBinding('class.is-locked') get lockedClass(): boolean {
    return this.locked();
  }
  @HostBinding('style.left.px') get leftPx(): number {
    return this.block().position.x * PX_PER_MM * this.zoom();
  }
  @HostBinding('style.top.px') get topPx(): number {
    return (this.block().position.y + this.yOffsetMm()) * PX_PER_MM * this.zoom();
  }
  @HostBinding('style.width.px') get widthPx(): number {
    return this.block().size.width * PX_PER_MM * this.zoom();
  }
  @HostBinding('style.height.px') get heightPx(): number {
    return this.block().size.height * PX_PER_MM * this.zoom();
  }
  @HostBinding('style.z-index') get zIndex(): number {
    return this.block().zIndex ?? 1;
  }

  // ─── Drag / resize ──────────────────────────────────────────────

  private dragRaf: number | null = null;
  private dragStart: { px: number; py: number; bx: number; by: number; bw: number; bh: number } | null = null;
  private resizeHandle: ResizeHandle | null = null;

  /** Right-click selects the block under the cursor (so the menu acts on it
   *  even if it wasn't already selected) and opens the canvas menu. Locked
   *  blocks still get a menu — that's how you unlock them. */
  @HostListener('contextmenu', ['$event'])
  onContextMenu(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    const id = this.block().id;
    if (!this.state.selectedIds().has(id)) {
      this.state.select(id, ev.shiftKey || ev.metaKey || ev.ctrlKey);
    }
    this.contextMenu.show(ev.clientX, ev.clientY);
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(ev: PointerEvent): void {
    if (this.locked()) return;
    // Resize handles have their own handler; let it claim the gesture.
    if ((ev.target as HTMLElement).classList.contains('resize-handle')) return;
    ev.stopPropagation();

    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
    if (!this.selected() || additive) {
      this.state.select(this.block().id, additive);
    }

    const b = this.block();
    this.dragStart = {
      px: ev.clientX,
      py: ev.clientY,
      bx: b.position.x,
      by: b.position.y,
      bw: b.size.width,
      bh: b.size.height,
    };
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  startResize(ev: PointerEvent, handle: ResizeHandle): void {
    ev.preventDefault();
    ev.stopPropagation();
    const b = this.block();
    this.dragStart = {
      px: ev.clientX,
      py: ev.clientY,
      bx: b.position.x,
      by: b.position.y,
      bw: b.size.width,
      bh: b.size.height,
    };
    this.resizeHandle = handle;
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.dragStart) return;
    // Coalesce to one state write per frame — without this a fast drag
    // fires dozens of template mutations per frame and the whole canvas
    // re-renders behind the pointer.
    if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
    this.dragRaf = requestAnimationFrame(() => {
      const start = this.dragStart;
      if (!start) return;
      const z = this.zoom();
      const dxMm = (ev.clientX - start.px) / (PX_PER_MM * z);
      const dyMm = (ev.clientY - start.py) / (PX_PER_MM * z);

      if (this.resizeHandle) {
        this.applyResize(this.resizeHandle, dxMm, dyMm, start);
        return;
      }

      const b = this.block();
      const snapped = this.snapWithGuides(start.bx + dxMm, start.by + dyMm, b.size.width, b.size.height, b.id);
      this.state.patchBlock(b.id, (cur) => ({ ...cur, position: { x: snapped.x, y: snapped.y } }));
    });
  };

  private onPointerUp = (): void => {
    this.dragStart = null;
    this.resizeHandle = null;
    if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
    this.dragRaf = null;
    // Guides are a drag-only affordance.
    this.state.setAlignGuides([]);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  };

  private applyResize(
    handle: ResizeHandle,
    dx: number,
    dy: number,
    s: { bx: number; by: number; bw: number; bh: number },
  ): void {
    let nx = s.bx;
    let ny = s.by;
    let nw = s.bw;
    let nh = s.bh;
    if (handle.includes('e')) nw = Math.max(5, s.bw + dx);
    if (handle.includes('s')) nh = Math.max(3, s.bh + dy);
    if (handle.includes('w')) {
      nw = Math.max(5, s.bw - dx);
      nx = s.bx + (s.bw - nw);
    }
    if (handle.includes('n')) {
      nh = Math.max(3, s.bh - dy);
      ny = s.by + (s.bh - nh);
    }

    const snapped = this.snapResizeWithGuides(handle, nx, ny, nw, nh, this.block().id);
    this.state.patchBlock(this.block().id, (b) => {
      const next = {
        ...b,
        position: { x: snapped.x, y: snapped.y },
        size: { ...b.size, width: snapped.w, height: snapped.h },
      };
      // A repeater's per-card height has to track the visual template card,
      // or resizing on the canvas wouldn't change the rendered card height.
      return b.type === 'repeater' ? ({ ...next, itemHeight: snapped.h } as typeof b) : next;
    });
  }

  // ─── Snapping ───────────────────────────────────────────────────

  /**
   * Snap a drag position to neighbouring block edges.
   *
   * Considers the dragged block's left/centre/right and top/middle/bottom
   * against the same six axes on every neighbour. The closest pair within
   * SNAP_THRESHOLD_MM wins, the position locks exactly onto it, and a guide
   * line spanning both blocks is published so the user can see what they
   * aligned to.
   */
  private snapWithGuides(
    rawX: number,
    rawY: number,
    w: number,
    h: number,
    excludeId: string,
  ): { x: number; y: number } {
    const tpl = this.state.template();
    if (!tpl) return { x: this.snap(rawX), y: this.snap(rawY) };

    const { neighbours, pageOffsetX, pageOffsetY } = this.neighbourContext(excludeId);
    const xCandidates = [rawX, rawX + w / 2, rawX + w];
    const yCandidates = [rawY, rawY + h / 2, rawY + h];

    let bestDx = SNAP_THRESHOLD_MM;
    let bestX = rawX;
    let vGuide: AlignGuide | null = null;
    let bestDy = SNAP_THRESHOLD_MM;
    let bestY = rawY;
    let hGuide: AlignGuide | null = null;

    for (const n of neighbours) {
      const nXs = [n.x, n.x + n.w / 2, n.x + n.w];
      const nYs = [n.y, n.y + n.h / 2, n.y + n.h];

      for (let i = 0; i < xCandidates.length; i++) {
        for (const nx of nXs) {
          const d = Math.abs(xCandidates[i] - nx);
          if (d < bestDx) {
            bestDx = d;
            // Offset so the i-th edge (0 left, 1 centre, 2 right) lands on nx.
            bestX = nx - (i === 0 ? 0 : i === 1 ? w / 2 : w);
            vGuide = { kind: 'v', position: nx, from: Math.min(rawY, n.y), to: Math.max(rawY + h, n.y + n.h) };
          }
        }
      }

      for (let j = 0; j < yCandidates.length; j++) {
        for (const ny of nYs) {
          const d = Math.abs(yCandidates[j] - ny);
          if (d < bestDy) {
            bestDy = d;
            bestY = ny - (j === 0 ? 0 : j === 1 ? h / 2 : h);
            hGuide = { kind: 'h', position: ny, from: Math.min(rawX, n.x), to: Math.max(rawX + w, n.x + n.w) };
          }
        }
      }
    }

    this.publishGuides(vGuide, hGuide, pageOffsetX, pageOffsetY);
    return { x: this.snap(bestX), y: this.snap(bestY) };
  }

  /**
   * Per-edge snap for resize. Only the edges actually being dragged (read
   * off the handle) look for neighbours — the opposite edges stay anchored,
   * which is what makes a resize feel like a resize rather than a move.
   */
  private snapResizeWithGuides(
    handle: ResizeHandle,
    nx: number,
    ny: number,
    nw: number,
    nh: number,
    excludeId: string,
  ): { x: number; y: number; w: number; h: number } {
    const tpl = this.state.template();
    if (!tpl) {
      return { x: this.snap(nx), y: this.snap(ny), w: this.snap(nw), h: this.snap(nh) };
    }

    const { neighbours, pageOffsetX, pageOffsetY } = this.neighbourContext(excludeId);
    const verticalAxes = neighbours.flatMap((n) => [n.x, n.x + n.w / 2, n.x + n.w]);
    const horizontalAxes = neighbours.flatMap((n) => [n.y, n.y + n.h / 2, n.y + n.h]);

    const snapValue = (val: number, axes: number[]): number | null => {
      let best = SNAP_THRESHOLD_MM;
      let matched: number | null = null;
      for (const a of axes) {
        const d = Math.abs(val - a);
        if (d < best) {
          best = d;
          matched = a;
        }
      }
      return matched;
    };
    // Which neighbour produced a matched axis — needed to span the guide
    // across both blocks. Tolerance is a rounding epsilon, not a threshold.
    const neighbourOn = (axis: number, horizontal: boolean) =>
      neighbours.find((n) => {
        const [a, b, c] = horizontal ? [n.y, n.y + n.h / 2, n.y + n.h] : [n.x, n.x + n.w / 2, n.x + n.w];
        return Math.abs(a - axis) < 0.01 || Math.abs(b - axis) < 0.01 || Math.abs(c - axis) < 0.01;
      });

    let left = nx;
    let right = nx + nw;
    let top = ny;
    let bottom = ny + nh;
    let vGuide: AlignGuide | null = null;
    let hGuide: AlignGuide | null = null;

    if (handle.includes('w') || handle.includes('e')) {
      const dragging = handle.includes('w') ? left : right;
      const m = snapValue(dragging, verticalAxes);
      if (m !== null) {
        if (handle.includes('w')) left = m;
        else right = m;
        const nei = neighbourOn(m, false);
        if (nei) vGuide = { kind: 'v', position: m, from: Math.min(top, nei.y), to: Math.max(bottom, nei.y + nei.h) };
      }
    }

    if (handle.includes('n') || handle.includes('s')) {
      const dragging = handle.includes('n') ? top : bottom;
      const m = snapValue(dragging, horizontalAxes);
      if (m !== null) {
        if (handle.includes('n')) top = m;
        else bottom = m;
        const nei = neighbourOn(m, true);
        if (nei) hGuide = { kind: 'h', position: m, from: Math.min(left, nei.x), to: Math.max(right, nei.x + nei.w) };
      }
    }

    this.publishGuides(vGuide, hGuide, pageOffsetX, pageOffsetY);
    return {
      x: this.snap(left),
      y: this.snap(top),
      w: this.snap(Math.max(5, right - left)),
      h: this.snap(Math.max(3, bottom - top)),
    };
  }

  /**
   * Neighbours to snap against, plus the translation from this block's
   * coordinate frame to the margin-frame the guide overlay draws in.
   *
   * A repeater's children snap against their siblings in card-local coords,
   * with the card itself included as a virtual neighbour — otherwise a card
   * holding a single child would have nothing to align to. Top-level blocks
   * snap against every top-level block in every section.
   */
  private neighbourContext(excludeId: string): {
    neighbours: { x: number; y: number; w: number; h: number }[];
    pageOffsetX: number;
    pageOffsetY: number;
  } {
    const tpl = this.state.template();
    const neighbours: { x: number; y: number; w: number; h: number }[] = [];
    const parent = this.state.findBlock(this.block().id)?.parent;

    if (parent?.type === 'repeater') {
      neighbours.push({ x: 0, y: 0, w: parent.size.width, h: parent.itemHeight });
      for (const c of parent.items) {
        if (c.id === excludeId) continue;
        neighbours.push({ x: c.position.x, y: c.position.y, w: c.size.width, h: c.size.height });
      }
      return {
        neighbours,
        pageOffsetX: this.parentXOffsetMm() + parent.position.x,
        pageOffsetY: this.parentYOffsetMm() + parent.position.y,
      };
    }

    for (const sec of tpl?.sections ?? []) {
      for (const b of sec.blocks) {
        if (b.id === excludeId) continue;
        neighbours.push({ x: b.position.x, y: b.position.y, w: b.size.width, h: b.size.height });
      }
    }
    return { neighbours, pageOffsetX: this.parentXOffsetMm(), pageOffsetY: this.yOffsetMm() };
  }

  /** Translate guides from the local coordinate frame into margin-frame mm
   *  and hand them to the canvas overlay. */
  private publishGuides(
    vGuide: AlignGuide | null,
    hGuide: AlignGuide | null,
    offsetX: number,
    offsetY: number,
  ): void {
    const guides: AlignGuide[] = [];
    if (vGuide) {
      guides.push({ ...vGuide, position: vGuide.position + offsetX, from: vGuide.from + offsetY, to: vGuide.to + offsetY });
    }
    if (hGuide) {
      guides.push({ ...hGuide, position: hGuide.position + offsetY, from: hGuide.from + offsetX, to: hGuide.to + offsetX });
    }
    this.state.setAlignGuides(guides);
  }

  private snap(mm: number): number {
    return Math.round(mm / SNAP_GRID_MM) * SNAP_GRID_MM;
  }

  // ─── internals ──────────────────────────────────────────────────

  /** Capped slice of a block's data source for the preview. */
  private previewRows(kind: 'table' | 'payments'): unknown[] {
    const b = this.block();
    if (b.type !== kind) return [];
    try {
      return this.bindingEngine().resolveArray(b.dataSource, this.ctx()).slice(0, PREVIEW_ROW_CAP);
    } catch {
      return [];
    }
  }

  private safeInterpolate(template: string): string {
    if (!template) return '';
    try {
      return this.bindingEngine().interpolate(template, this.ctx());
    } catch {
      return template;
    }
  }

  private safeEvaluateCell(expression: string): string {
    if (!expression) return '';
    try {
      const v = this.bindingEngine().evaluateCell(expression, this.ctx());
      return v === null || v === undefined ? '' : String(v);
    } catch {
      // Surface the broken expression rather than an empty box, so the user
      // can see which block needs fixing.
      return `⚠ ${expression}`;
    }
  }

  ngOnDestroy(): void {
    if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }
}
