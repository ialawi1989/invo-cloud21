import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { DesignerStateService } from '../../services/designer-state.service';
import { computePageDimensions, mmToPx } from '../../core/layout/dimensions';
import { CanvasBlockComponent } from './canvas-block.component';
import { CanvasContextMenuComponent } from './canvas-context-menu.component';
import { Block, BlockType } from '../../core/types/block.types';
import { MASTER_PAGE_ID, Section, SectionType } from '../../core/types/template.types';
import { snap, rectsIntersect, blockRect } from '../../utils/geometry.utils';
import { DEFAULT_FONT_STACK, normalizeSeedFontFamily } from '../../utils/fonts.utils';

/** One visual header/body/footer zone drawn behind the blocks. */
interface SectionBand {
  type: SectionType;
  topPx: number;
  heightPx: number;
  label: string;
  /** Modifier suffix on `.canvas__band--` driving the band's colors. */
  variant: 'header' | 'body' | 'footer';
}

/**
 * Unified design surface. Header, body, and footer blocks all draw on one
 * page-shaped canvas. Each block sits at its section-local
 * (position.x, position.y), translated into page coordinates by a
 * per-section `yOffsetMm` (0 for header/body, contentHeight − footerH for
 * footer). Drag deltas stay section-local, so state updates pass straight
 * through without needing to know about the offset.
 *
 * Toolbox drops pick their target section from the horizontal band the
 * pointer landed in. Dragging an *existing* block is handled by
 * CanvasBlockComponent itself with native pointer events.
 */
@Component({
  selector: 'app-designer-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, CdkDropList, CanvasBlockComponent, CanvasContextMenuComponent],
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent {
  readonly state = inject(DesignerStateService);
  @ViewChild('pageEl') private pageEl?: ElementRef<HTMLElement>;

  readonly zoom = this.state.zoom;
  readonly showGrid = signal(true);

  /** Pixels per millimetre at 100% zoom. Everything that converts mm to
   *  screen space multiplies by this AND by `zoom()`, so overlays stay
   *  locked to the blocks at any zoom level. */
  readonly pxPerMm = computed(() => mmToPx(1));

  /** Left padding (px) around the page inside the scroll area. The rulers
   *  add the same offset to their tick origin, which is why the page column
   *  is start-aligned rather than centred — centring would slide the page
   *  off this fixed origin whenever its width differs from the column's. */
  readonly PAGE_PAD_PX = 32;

  readonly pageDims = computed(() => {
    const t = this.state.template();
    return t
      ? computePageDimensions(t.page)
      : computePageDimensions({
          size: 'A4',
          orientation: 'portrait',
          margins: { top: 15, right: 15, bottom: 15, left: 15 },
        });
  });

  /**
   * Paper size in CSS px at 100%. Zoom is a `transform: scale()` on the page
   * element, not a factor baked into every measurement — so everything
   * inside the paper (type, padding, borders, radii, the mm and pt the style
   * helpers emit) scales with the page instead of staying at its 100% size
   * while the boxes around it grow. That's what makes the canvas agree with
   * the HTML preview and the print at any zoom level; before this, only the
   * geometry scaled and the design drifted from its output the moment you
   * left 100%.
   *
   * A transform doesn't affect layout, so `pageBox*` below reserves the
   * scaled footprint for the scroll area.
   */
  readonly pageWidthPx = computed(() => mmToPx(this.pageDims().width));
  readonly pageHeightPx = computed(() => mmToPx(this.pageDims().height));

  /** Footprint the scaled page occupies in the scroll area. */
  readonly pageBoxWidthPx = computed(() => this.pageWidthPx() * this.zoom());
  readonly pageBoxHeightPx = computed(() => this.pageHeightPx() * this.zoom());
  readonly pageBg = computed(() => this.state.template()?.page.background ?? '#ffffff');

  /**
   * Family the page cascades to every block whose own `style.font.family` is
   * empty — i.e. the "Inherit" option. `blockStyleToCss` emits no
   * `font-family` for those blocks, so they pick this up by CSS inheritance
   * and a block with an explicit family still wins on its own inline style.
   *
   * This is the canvas half of the same fallback the HTML renderer writes onto
   * `body`; keeping both on `theme.fontFamily ?? DEFAULT_FONT_STACK` is what
   * makes the design surface preview the export rather than the app's own UI
   * font. See DEFAULT_FONT_STACK for why the stack is Roboto-then-Amiri.
   */
  readonly pageFontFamily = computed(
    () => normalizeSeedFontFamily(this.state.template()?.theme?.fontFamily) || DEFAULT_FONT_STACK,
  );

  // Inside the scaled page — 100% px, the transform does the rest.
  readonly marginLeftPx = computed(() => mmToPx(this.state.template()?.page.margins.left ?? 15));
  readonly marginRightPx = computed(() => mmToPx(this.state.template()?.page.margins.right ?? 15));
  readonly marginTopPx = computed(() => mmToPx(this.state.template()?.page.margins.top ?? 15));
  readonly marginBottomPx = computed(() => mmToPx(this.state.template()?.page.margins.bottom ?? 15));

  readonly watermark = computed(() => this.state.template()?.page?.watermark ?? null);

  /** All blocks across all sections, each tagged with its canvas y offset. */
  readonly allBlocksWithOffset = computed<{ block: Block; yOffsetMm: number; sectionType: SectionType }[]>(() => {
    const t = this.state.template();
    if (!t) return [];
    const dims = this.pageDims();
    const activePage = this.state.activePageId();
    // Header/footer bands only exist on the master page — extra pages are
    // standalone content pages with no repeating header/footer of their own
    // (see `Section.pageId`), so their body starts flush at the top.
    const isMaster = activePage === MASTER_PAGE_ID;
    const headerH = isMaster ? this.sectionExtentMm('page-header') : 0;
    const firstHeaderH = isMaster ? this.sectionExtentMm('first-page-header') : 0;
    const footerH = isMaster ? this.sectionExtentMm('page-footer') : 0;
    const lastFooterH = isMaster ? this.sectionExtentMm('last-page-footer') : 0;
    const bodyOffset = Math.max(headerH, firstHeaderH);

    const out: { block: Block; yOffsetMm: number; sectionType: SectionType }[] = [];
    for (const sec of t.sections) {
      if ((sec.pageId ?? MASTER_PAGE_ID) !== activePage) continue;
      let offset = 0;
      switch (sec.type) {
        case 'page-header':
        case 'first-page-header':
          offset = 0;
          break;
        case 'body':
          offset = bodyOffset;
          break;
        case 'page-footer':
          offset = Math.max(0, dims.contentHeight - footerH);
          break;
        case 'last-page-footer':
          offset = Math.max(0, dims.contentHeight - lastFooterH);
          break;
      }
      for (const b of sec.blocks) out.push({ block: b, yOffsetMm: offset, sectionType: sec.type });
    }
    return out;
  });

  /** Section bands in px, relative to the inside-margin frame. */
  readonly sectionBands = computed<SectionBand[]>(() => {
    const t = this.state.template();
    if (!t) return [];
    const dims = this.pageDims();
    // Extra pages have no header/footer bands of their own — see the same
    // gating in `allBlocksWithOffset`.
    const isMaster = this.state.activePageId() === MASTER_PAGE_ID;
    const headerHpx = isMaster ? mmToPx(this.sectionExtentMm('page-header')) : 0;
    const footerHpx = isMaster ? mmToPx(this.sectionExtentMm('page-footer')) : 0;
    const contentHpx = mmToPx(dims.contentHeight);

    const bands: SectionBand[] = [];
    if (headerHpx > 0) {
      bands.push({ type: 'page-header', topPx: 0, heightPx: headerHpx, label: 'DOCUMENT_BUILDER.HEADER_CHECK', variant: 'header' });
    }
    bands.push({
      type: 'body',
      topPx: headerHpx,
      heightPx: Math.max(0, contentHpx - headerHpx - footerHpx),
      label: 'DOCUMENT_BUILDER.BODY',
      variant: 'body',
    });
    if (footerHpx > 0) {
      bands.push({
        type: 'page-footer',
        topPx: contentHpx - footerHpx,
        heightPx: footerHpx,
        label: 'DOCUMENT_BUILDER.FOOTER_CHECK',
        variant: 'footer',
      });
    }
    return bands;
  });

  // Inside the scaled page, so no zoom factor: the 5mm grid stays 5mm.
  readonly gridStepPx = computed(() => mmToPx(5));

  // Ruler ticks every 10mm, offset by the page padding so 0 lines up with
  // the paper's left/top edge.
  readonly rulerTicksX = computed(() => {
    const ticks: { x: number; label: string }[] = [];
    for (let mm = 0; mm <= this.pageDims().width; mm += 10) {
      ticks.push({ x: mmToPx(mm) * this.zoom() + this.PAGE_PAD_PX, label: String(mm) });
    }
    return ticks;
  });

  readonly rulerTicksY = computed(() => {
    const ticks: { y: number; label: string }[] = [];
    for (let mm = 0; mm <= this.pageDims().height; mm += 10) {
      ticks.push({ y: mmToPx(mm) * this.zoom() + this.PAGE_PAD_PX, label: String(mm) });
    }
    return ticks;
  });

  /** Track by block id so moving one block doesn't tear down and rebuild
   *  every other block host (each is OnPush and holds drag state). */
  trackBlock(_: number, item: { block: Block }): string {
    return item.block.id;
  }

  // ─── Drop from toolbox ─────────────────────────────────────────────

  onDrop(ev: CdkDragDrop<string>): void {
    const blockType = ev.item.data as BlockType;
    if (!blockType) return;
    const surface = this.pageEl?.nativeElement;
    const t = this.state.template();
    if (!surface || !t) return;

    const rect = surface.getBoundingClientRect();
    const z = this.zoom();
    // Pointer pixels → inside-margin mm, the coordinate system blocks use.
    const xMm = (ev.dropPoint.x - rect.left) / mmToPx(1) / z - (t.page.margins.left ?? 0);
    const yMmInside = (ev.dropPoint.y - rect.top) / mmToPx(1) / z - (t.page.margins.top ?? 0);

    const activePage = this.state.activePageId();
    const isMaster = activePage === MASTER_PAGE_ID;
    const dims = this.pageDims();
    // Extra pages have no header/footer bands — see `allBlocksWithOffset`.
    const headerH = isMaster ? this.sectionExtentMm('page-header') : 0;
    const footerH = isMaster ? this.sectionExtentMm('page-footer') : 0;
    const footerTopMm = Math.max(0, dims.contentHeight - footerH);
    const inHeader = headerH > 0 && yMmInside < headerH;
    const inFooter = footerH > 0 && yMmInside > footerTopMm;

    const targetType: SectionType = inHeader ? 'page-header' : inFooter ? 'page-footer' : 'body';
    const pageSections = t.sections.filter((s) => (s.pageId ?? MASTER_PAGE_ID) === activePage);
    const targetSection =
      pageSections.find((s) => s.type === targetType) ?? pageSections.find((s) => s.type === 'body');
    if (!targetSection) return;

    const sectionTopMm = inHeader ? 0 : inFooter ? footerTopMm : headerH;
    const dropX = snap(xMm);
    const dropY = snap(yMmInside - sectionTopMm);

    // When a repeater (or one of its children) is selected and the drop
    // lands inside the card's bounds, add the block as a child instead —
    // child coordinates are stored relative to the card's top-left.
    const selectedId = Array.from(this.state.selectedIds())[0];
    if (selectedId) {
      const hit = this.state.findBlock(selectedId);
      const repeater =
        hit?.block.type === 'repeater' ? hit.block : hit?.parent?.type === 'repeater' ? hit.parent : null;
      if (repeater) {
        const { x: rx, y: ry } = repeater.position;
        const { width: rw, height: rh } = repeater.size;
        if (dropX >= rx && dropX <= rx + rw && dropY >= ry && dropY <= ry + rh) {
          this.state.addChildBlock(repeater.id, blockType, snap(dropX - rx), snap(dropY - ry));
          return;
        }
      }
    }

    this.state.addBlock(blockType, dropX, dropY, targetSection.id);
  }

  // ─── Marquee selection ─────────────────────────────────────────────

  readonly marquee = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  private marqueeOrigin: { x: number; y: number } | null = null;

  onSurfaceMouseDown(ev: MouseEvent): void {
    // Middle button is the pan gesture (see onCanvasMouseDown) — not a
    // marquee start.
    if (ev.button !== 0) return;
    // The click may land on the surface, the margin frame, or a section
    // band — all of which count as empty area. Only bail when it landed
    // inside a real block; CanvasBlockComponent handles those itself.
    if ((ev.target as HTMLElement).closest('app-canvas-block')) return;

    const surface = ev.currentTarget as HTMLElement;
    const rect = surface.getBoundingClientRect();
    this.marqueeOrigin = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    this.marquee.set({ x: this.marqueeOrigin.x, y: this.marqueeOrigin.y, w: 0, h: 0 });
    if (!ev.shiftKey) this.state.clearSelection();

    const move = (e: MouseEvent) => {
      if (!this.marqueeOrigin) return;
      this.marquee.set({
        x: Math.min(this.marqueeOrigin.x, e.clientX - rect.left),
        y: Math.min(this.marqueeOrigin.y, e.clientY - rect.top),
        w: Math.abs(e.clientX - rect.left - this.marqueeOrigin.x),
        h: Math.abs(e.clientY - rect.top - this.marqueeOrigin.y),
      });
    };

    const up = () => {
      const m = this.marquee();
      // Ignore sub-3px drags — those are plain clicks that already cleared
      // the selection above.
      if (m && (m.w > 2 || m.h > 2)) {
        const z = this.zoom();
        const t = this.state.template();
        const marginLeft = t?.page.margins.left ?? 0;
        const marginTop = t?.page.margins.top ?? 0;
        // Marquee coords are page-surface px; convert to inside-margin mm.
        const mmRect = {
          x: m.x / mmToPx(1) / z - marginLeft,
          y: m.y / mmToPx(1) / z - marginTop,
          width: m.w / mmToPx(1) / z,
          height: m.h / mmToPx(1) / z,
        };
        const ids = this.allBlocksWithOffset()
          .filter((item) => {
            const r = blockRect(item.block);
            return rectsIntersect({ ...r, y: r.y + item.yOffsetMm }, mmRect);
          })
          .map((item) => item.block.id);
        if (ids.length) this.state.selectMany(ids);
      }
      this.marquee.set(null);
      this.marqueeOrigin = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // ─── Keyboard shortcuts ────────────────────────────────────────────

  onKeyDown(ev: KeyboardEvent): void {
    const ids = this.state.selectedIds();
    if (ids.size === 0) return;
    const ctrl = ev.ctrlKey || ev.metaKey;
    const step = ev.shiftKey ? 5 : 1;

    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      this.state.deleteSelected();
      ev.preventDefault();
    } else if (ctrl && ev.key.toLowerCase() === 'd') {
      this.state.duplicateSelected();
      ev.preventDefault();
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) {
      const dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0;
      const dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0;
      for (const id of ids) {
        this.state.patchBlock(id, (b) => (
          // Locked blocks can be selected, so a selection may include one —
          // nudging it would defeat the lock the drag handler honors.
          b.locked
            ? b
            : { ...b, position: { x: snap(b.position.x + dx), y: snap(b.position.y + dy) } }
        ));
      }
      ev.preventDefault();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.state.clearSelection();
  }

  /** Ctrl/Cmd+scroll zooms the canvas, matching the toolbar's zoom step —
   *  preventDefault stops the browser's own page-zoom gesture from firing
   *  alongside it. Plain scroll (no modifier) is left alone to pan/scroll
   *  the canvas as normal. */
  @HostListener('wheel', ['$event'])
  onWheel(ev: WheelEvent): void {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    const step = ev.deltaY < 0 ? 0.1 : -0.1;
    this.state.setZoom(this.zoom() + step);
  }

  // ─── Middle-click pan (Adobe-style hand tool) ───────────────────────

  @ViewChild('scrollEl') private scrollEl?: ElementRef<HTMLElement>;

  /** Drives the grabbing cursor — a template class binding rather than
   *  direct style writes, since OnPush still needs a signal read to update. */
  readonly isPanning = signal(false);

  private panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panScrollLeft = 0;
  private panScrollTop = 0;

  /** Bound on the scroll container (mousedown), not the page surface — a
   *  middle-click anywhere in the visible canvas, including outside the
   *  paper, should start panning. */
  onCanvasMouseDown(ev: MouseEvent): void {
    if (ev.button !== 1) return;
    const el = this.scrollEl?.nativeElement;
    if (!el) return;
    // Middle-click's default is the browser's own autoscroll icon — without
    // this it fights our drag-to-pan for the same gesture.
    ev.preventDefault();
    this.panning = true;
    this.isPanning.set(true);
    this.panStartX = ev.clientX;
    this.panStartY = ev.clientY;
    this.panScrollLeft = el.scrollLeft;
    this.panScrollTop = el.scrollTop;
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(ev: MouseEvent): void {
    if (!this.panning) return;
    const el = this.scrollEl?.nativeElement;
    if (!el) return;
    el.scrollLeft = this.panScrollLeft - (ev.clientX - this.panStartX);
    el.scrollTop = this.panScrollTop - (ev.clientY - this.panStartY);
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(ev: MouseEvent): void {
    if (ev.button !== 1 || !this.panning) return;
    this.panning = false;
    this.isPanning.set(false);
  }

  // ─── internals ─────────────────────────────────────────────────────

  /** Vertical space a section reserves (mm): its explicit `height`, or the
   *  bottom edge of its lowest block when unset. */
  private sectionExtentMm(type: SectionType): number {
    const sec = this.state.template()?.sections.find((s) => s.type === type);
    return sec ? this.sectionHeightOf(sec) : 0;
  }

  private sectionHeightOf(sec: Section): number {
    if (sec.height) return sec.height;
    let max = 0;
    for (const b of sec.blocks) max = Math.max(max, b.position.y + b.size.height);
    return max;
  }
}
