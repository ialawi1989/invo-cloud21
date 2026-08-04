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
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { DesignerStateService } from '../../services/designer-state.service';
import { computePageDimensions, mmToPx } from '../../core/layout/dimensions';
import { CanvasBlockComponent } from './canvas-block.component';
import { CanvasContextMenuComponent } from './canvas-context-menu.component';
import { Block, BlockType } from '../../core/types/block.types';
import { Section, SectionType } from '../../core/types/template.types';
import { snap, rectsIntersect, blockRect } from '../../utils/geometry.utils';

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
  imports: [CommonModule, CdkDropList, CanvasBlockComponent, CanvasContextMenuComponent],
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

  readonly pageWidthPx = computed(() => mmToPx(this.pageDims().width) * this.zoom());
  readonly pageHeightPx = computed(() => mmToPx(this.pageDims().height) * this.zoom());
  readonly pageBg = computed(() => this.state.template()?.page.background ?? '#ffffff');

  readonly marginLeftPx = computed(() => mmToPx(this.state.template()?.page.margins.left ?? 15) * this.zoom());
  readonly marginRightPx = computed(() => mmToPx(this.state.template()?.page.margins.right ?? 15) * this.zoom());
  readonly marginTopPx = computed(() => mmToPx(this.state.template()?.page.margins.top ?? 15) * this.zoom());
  readonly marginBottomPx = computed(() => mmToPx(this.state.template()?.page.margins.bottom ?? 15) * this.zoom());

  readonly watermark = computed(() => this.state.template()?.page?.watermark ?? null);

  /** All blocks across all sections, each tagged with its canvas y offset. */
  readonly allBlocksWithOffset = computed<{ block: Block; yOffsetMm: number; sectionType: SectionType }[]>(() => {
    const t = this.state.template();
    if (!t) return [];
    const dims = this.pageDims();
    const headerH = this.sectionExtentMm('page-header');
    const firstHeaderH = this.sectionExtentMm('first-page-header');
    const footerH = this.sectionExtentMm('page-footer');
    const lastFooterH = this.sectionExtentMm('last-page-footer');
    const bodyOffset = Math.max(headerH, firstHeaderH);

    const out: { block: Block; yOffsetMm: number; sectionType: SectionType }[] = [];
    for (const sec of t.sections) {
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
    const z = this.zoom();
    const dims = this.pageDims();
    const headerHpx = mmToPx(this.sectionExtentMm('page-header')) * z;
    const footerHpx = mmToPx(this.sectionExtentMm('page-footer')) * z;
    const contentHpx = mmToPx(dims.contentHeight) * z;

    const bands: SectionBand[] = [];
    if (headerHpx > 0) {
      bands.push({ type: 'page-header', topPx: 0, heightPx: headerHpx, label: 'Header', variant: 'header' });
    }
    bands.push({
      type: 'body',
      topPx: headerHpx,
      heightPx: Math.max(0, contentHpx - headerHpx - footerHpx),
      label: 'Body',
      variant: 'body',
    });
    if (footerHpx > 0) {
      bands.push({
        type: 'page-footer',
        topPx: contentHpx - footerHpx,
        heightPx: footerHpx,
        label: 'Footer',
        variant: 'footer',
      });
    }
    return bands;
  });

  readonly gridStepPx = computed(() => Math.max(2, mmToPx(5) * this.zoom()));

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

    const dims = this.pageDims();
    const headerH = this.sectionExtentMm('page-header');
    const footerH = this.sectionExtentMm('page-footer');
    const footerTopMm = Math.max(0, dims.contentHeight - footerH);
    const inHeader = headerH > 0 && yMmInside < headerH;
    const inFooter = footerH > 0 && yMmInside > footerTopMm;

    const targetType: SectionType = inHeader ? 'page-header' : inFooter ? 'page-footer' : 'body';
    const targetSection =
      t.sections.find((s) => s.type === targetType) ?? t.sections.find((s) => s.type === 'body');
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
        this.state.patchBlock(id, (b) => ({
          ...b,
          position: { x: snap(b.position.x + dx), y: snap(b.position.y + dy) },
        }));
      }
      ev.preventDefault();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.state.clearSelection();
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
