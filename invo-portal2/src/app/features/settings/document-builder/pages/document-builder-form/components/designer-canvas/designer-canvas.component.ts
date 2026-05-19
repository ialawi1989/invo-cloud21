import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  DesignerElement,
  DocumentTemplate,
  paperHeightCm,
  paperWidthCm,
} from '../../../../services/document-template.types';

/** Resize-handle directions. North/south/east/west + diagonals. */
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Active drag (move or resize) — captured at mousedown, applied on
 *  mousemove, finalised on mouseup. Keeping it in `signal` form keeps
 *  the OnPush canvas reactive without manual change detection. */
interface DragState {
  mode:    'move' | 'resize';
  id:      DesignerElement['id'];
  handle?: Handle;
  startX:  number;   // pointer client X at mousedown
  startY:  number;
  origX:   number;   // element's original geometry
  origY:   number;
  origW:   number;
  origH:   number;
}

/** Smart-guide line drawn while dragging — vertical or horizontal,
 *  spanning the relevant range so the user can see exactly which
 *  edges are aligning. */
interface Guide {
  orient: 'v' | 'h';
  pos:    number;
  from:   number;
  to:     number;
}

/**
 * DesignerCanvasComponent
 * ───────────────────────
 * Absolute-positioned canvas — the centerpiece of the Designer mode.
 *
 *   - Drop targets accept items from the palette via the
 *     `application/x-palette-item` MIME type so the parent's palette
 *     stays a plain HTML5 drag source (no CDK overhead per element).
 *   - Each element is positioned via `left/top/width/height` in CSS
 *     pixels. Mouse-down on an element starts a move drag; mouse-down
 *     on a handle starts a resize.
 *   - Smart guides snap to other element edges and to the page
 *     edges + center. Holding **Alt** bypasses the snap.
 *
 * The canvas is "dumb" — it never mutates the elements input; it
 * emits a fresh array via `(elementsChange)` so the parent funnels
 * every edit through its central patch path (keeps `isDirty` and
 * undo/redo deterministic).
 */
@Component({
  selector: 'app-designer-canvas',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designer-canvas.component.html',
  styleUrl: './designer-canvas.component.scss',
})
export class DesignerCanvasComponent {
  // ─── Inputs / outputs ─────────────────────────────────────────────
  template     = input.required<DocumentTemplate>();
  elements     = input<DesignerElement[]>([]);
  /** Currently-selected element — `null` means nothing selected. */
  selectedId   = input<DesignerElement['id'] | null>(null);
  /** Canvas zoom (1 = 100%). Used for the cursor-to-paper coordinate
   *  conversion so drags feel correct at any zoom. */
  zoom         = input<number>(1);

  @Output() elementsChange = new EventEmitter<DesignerElement[]>();
  @Output() selectChange   = new EventEmitter<DesignerElement | null>();

  // ─── Derived geometry ─────────────────────────────────────────────
  paperWidthPx  = computed<number>(() => paperWidthCm(this.template())  * 37.8);
  paperHeightPx = computed<number>(() => paperHeightCm(this.template()) * 37.8);

  // ─── Internal drag state (not exposed to the template directly) ──
  private drag = signal<DragState | null>(null);
  /** Smart-alignment guides currently being shown — refreshed on
   *  every mousemove during a drag. */
  guides = signal<Guide[]>([]);

  // ─── Click handlers ───────────────────────────────────────────────
  /** Click on the paper background — deselect. We let mousedown on
   *  an element/handle stop propagation, so this only fires for
   *  clicks that bubbled from the empty area. */
  onPaperMouseDown(): void {
    if (this.drag()) return;
    this.selectChange.emit(null);
  }

  /** Click on an element. Selects it and (when not locked) starts a
   *  move drag. */
  onElementMouseDown(event: MouseEvent, el: DesignerElement): void {
    event.stopPropagation();
    this.selectChange.emit(el);
    if (el.locked) return;
    this.beginDrag({
      mode:   'move',
      id:     el.id,
      startX: event.clientX,
      startY: event.clientY,
      origX:  el.x, origY: el.y, origW: el.w, origH: el.h,
    });
  }

  /** Click on a resize handle — starts a resize drag in that
   *  direction. */
  onHandleMouseDown(event: MouseEvent, el: DesignerElement, handle: Handle): void {
    event.stopPropagation();
    event.preventDefault();
    if (el.locked) return;
    this.selectChange.emit(el);
    this.beginDrag({
      mode:   'resize',
      handle,
      id:     el.id,
      startX: event.clientX,
      startY: event.clientY,
      origX:  el.x, origY: el.y, origW: el.w, origH: el.h,
    });
  }

  /** Drop from the palette — adds an element at the drop location. */
  onPaperDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('application/x-palette-item')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onPaperDrop(event: DragEvent): void {
    const type = event.dataTransfer?.getData('application/x-palette-item');
    if (!type) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const rect   = target.getBoundingClientRect();
    const z      = this.zoom() || 1;
    const x      = (event.clientX - rect.left) / z;
    const y      = (event.clientY - rect.top)  / z;

    // Per-type seed dimensions so the dropped element starts at a
    // sensible size instead of 0×0. Numbers match the legacy seed.
    const sized: Record<string, { w: number; h: number }> = {
      'Text':       { w: 200, h: 22 },
      'Data Field': { w: 180, h: 22 },
      'Image':      { w: 120, h: 80 },
      'Table':      { w: 400, h: 80 },
      'Shape':      { w: 200, h: 40 },
      'Barcode':    { w: 180, h: 44 },
      'QR Code':    { w: 100, h: 100 },
      'Signature':  { w: 200, h: 64 },
      'Page #':     { w: 140, h: 16 },
    };
    const dims = sized[type] ?? { w: 140, h: 22 };
    const el: DesignerElement = {
      id:      Date.now(),
      type,
      x:       Math.max(0, x - dims.w / 2),
      y:       Math.max(0, y - dims.h / 2),
      w:       dims.w,
      h:       dims.h,
      content: type === 'Text' ? 'New text' : (type === 'Data Field' ? '' : type),
      color:   '#1f2937',
      size:    10,
      bg:      type === 'Shape' ? '#e5e7eb' : 'transparent',
      // Shape / data-field defaults
      ...(type === 'Shape'      ? { shapeKind: 'rect' as const, stroke: '#1f2937', strokeWidth: 1, radius: 4 } : {}),
      ...(type === 'Data Field' ? { path: 'customer.name', format: '', prefix: '', suffix: '' } : {}),
      ...(type === 'Table'      ? { headers: ['Column A', 'Column B'], rows: [['Row 1 A', 'Row 1 B']], headerBg: '#1e3a8a', headerColor: '#ffffff', striped: true } : {}),
    };
    this.elementsChange.emit([...this.elements(), el]);
    this.selectChange.emit(el);
  }

  // ─── Drag lifecycle ───────────────────────────────────────────────
  private beginDrag(s: DragState): void {
    this.drag.set(s);
    document.body.style.cursor   = s.mode === 'resize' ? this.resizeCursor(s.handle!) : 'move';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup',   this.onWindowMouseUp);
  }

  private endDrag(): void {
    this.drag.set(null);
    this.guides.set([]);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup',   this.onWindowMouseUp);
  }

  private onWindowMouseMove = (event: MouseEvent): void => {
    const s = this.drag();
    if (!s) return;
    const z   = this.zoom() || 1;
    const dx  = (event.clientX - s.startX) / z;
    const dy  = (event.clientY - s.startY) / z;
    const bypass = event.altKey;

    if (s.mode === 'move') {
      this.applyMove(s, dx, dy, bypass);
    } else if (s.mode === 'resize') {
      this.applyResize(s, dx, dy, bypass);
    }
  };

  private onWindowMouseUp = (): void => { this.endDrag(); };

  // ─── Move / resize math ───────────────────────────────────────────
  private applyMove(s: DragState, dx: number, dy: number, bypass: boolean): void {
    const xRaw = s.origX + dx;
    const yRaw = s.origY + dy;
    const candidates = bypass ? null : this.snapCandidates(s.id);
    const snap = candidates
      ? this.findBestSnap([xRaw, xRaw + s.origW / 2, xRaw + s.origW], candidates.v,
                          [yRaw, yRaw + s.origH / 2, yRaw + s.origH], candidates.h)
      : null;

    const nextX = xRaw + (snap?.vOffset ?? 0);
    const nextY = yRaw + (snap?.hOffset ?? 0);

    this.guides.set(snap?.guides ?? []);
    this.emitElement(s.id, { x: nextX, y: nextY });
  }

  private applyResize(s: DragState, dx: number, dy: number, bypass: boolean): void {
    const h = s.handle!;
    let x = s.origX, y = s.origY, w = s.origW, hh = s.origH;
    if (h.includes('e')) w  = Math.max(8, s.origW + dx);
    if (h.includes('w')) { const nw = Math.max(8, s.origW - dx); x = s.origX + (s.origW - nw); w = nw; }
    if (h.includes('s')) hh = Math.max(6, s.origH + dy);
    if (h.includes('n')) { const nh = Math.max(6, s.origH - dy); y = s.origY + (s.origH - nh); hh = nh; }

    if (!bypass) {
      const cand = this.snapCandidates(s.id);
      // Only snap the moving edges
      if (h.includes('e')) {
        const best = this.snap1D([x + w], cand.v);
        if (best) { w = Math.max(8, best.pos - x); }
      }
      if (h.includes('w')) {
        const best = this.snap1D([x], cand.v);
        if (best) { const diff = best.pos - x; x = best.pos; w = Math.max(8, w - diff); }
      }
      if (h.includes('s')) {
        const best = this.snap1D([y + hh], cand.h);
        if (best) { hh = Math.max(6, best.pos - y); }
      }
      if (h.includes('n')) {
        const best = this.snap1D([y], cand.h);
        if (best) { const diff = best.pos - y; y = best.pos; hh = Math.max(6, hh - diff); }
      }
    }
    this.emitElement(s.id, { x, y, w, h: hh });
  }

  /** Build vertical / horizontal snap candidates for the page +
   *  every element except the one being dragged. */
  private snapCandidates(skipId: DesignerElement['id']) {
    const w = this.paperWidthPx();
    const h = this.paperHeightPx();
    const v = [
      { pos: 0,         from: 0, to: h },
      { pos: w / 2,     from: 0, to: h },
      { pos: w,         from: 0, to: h },
    ];
    const hC = [
      { pos: 0,     from: 0, to: w },
      { pos: h / 2, from: 0, to: w },
      { pos: h,     from: 0, to: w },
    ];
    for (const el of this.elements()) {
      if (el.id === skipId || el.hidden) continue;
      v .push({ pos: el.x,             from: el.y, to: el.y + el.h });
      v .push({ pos: el.x + el.w / 2,  from: el.y, to: el.y + el.h });
      v .push({ pos: el.x + el.w,      from: el.y, to: el.y + el.h });
      hC.push({ pos: el.y,             from: el.x, to: el.x + el.w });
      hC.push({ pos: el.y + el.h / 2,  from: el.x, to: el.x + el.w });
      hC.push({ pos: el.y + el.h,      from: el.x, to: el.x + el.w });
    }
    return { v, h: hC };
  }

  /** 1-D snap: nearest line within `SNAP_PX` to one of the moving
   *  edges. Returns `null` when nothing is close. */
  private snap1D(lines: number[], cand: { pos: number; from: number; to: number }[]):
    { pos: number; offset: number; from: number; to: number } | null {
    const SNAP = 6;
    let best: { pos: number; offset: number; from: number; to: number; dist: number } | null = null;
    for (const ln of lines) {
      for (const c of cand) {
        const d = Math.abs(ln - c.pos);
        if (d <= SNAP && (!best || d < best.dist)) {
          best = { pos: c.pos, offset: c.pos - ln, from: c.from, to: c.to, dist: d };
        }
      }
    }
    return best;
  }

  /** 2-D snap during move — finds the best vertical AND horizontal
   *  snap, returns offsets + the guide lines to render. */
  private findBestSnap(
    vLines: number[],
    vCand:  { pos: number; from: number; to: number }[],
    hLines: number[],
    hCand:  { pos: number; from: number; to: number }[],
  ) {
    const v = this.snap1D(vLines, vCand);
    const h = this.snap1D(hLines, hCand);
    const guides: Guide[] = [];
    if (v) guides.push({ orient: 'v', pos: v.pos, from: v.from, to: v.to });
    if (h) guides.push({ orient: 'h', pos: h.pos, from: h.from, to: h.to });
    return { vOffset: v?.offset ?? 0, hOffset: h?.offset ?? 0, guides };
  }

  /** Mutate one element by id and emit the new array. Pure — never
   *  touches the input. */
  private emitElement(id: DesignerElement['id'], patch: Partial<DesignerElement>): void {
    this.elementsChange.emit(this.elements().map((e) => e.id === id ? { ...e, ...patch } : e));
  }

  /** Cursor name for a resize handle direction. */
  private resizeCursor(h: Handle): string {
    return ({
      n: 'n-resize', s: 's-resize', e: 'e-resize',  w: 'w-resize',
      ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
    } as Record<Handle, string>)[h];
  }

  // ─── Template helpers ─────────────────────────────────────────────
  /** Compose inline styles for an element. Pulled into a method so
   *  the template stays compact. */
  elementStyle(el: DesignerElement): Record<string, string> {
    const justify = el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start');
    const isShape = el.type === 'Shape';
    const isQR    = el.type === 'QR Code';

    return {
      'left':            el.x + 'px',
      'top':             el.y + 'px',
      'width':           el.w + 'px',
      'height':          el.h + 'px',
      'background':      (el.bg && el.bg !== 'transparent') ? el.bg : 'transparent',
      'color':           el.color || '#1f2937',
      'font-weight':     el.bold      ? '700'       : '400',
      'font-style':      el.italic    ? 'italic'    : 'normal',
      'text-decoration': el.underline ? 'underline' : 'none',
      'font-size':       el.size ? el.size + 'pt' : 'inherit',
      'text-align':      el.align || 'left',
      'display':         'flex',
      'align-items':     'flex-start',
      'justify-content': justify,
      'padding':         (isShape || isQR) ? '0' : '2px 4px',
      'overflow':        'hidden',
      'opacity':         (el.opacity ?? 1).toString(),
      'border-radius':   isShape && el.shapeKind === 'circle'
                            ? '50%'
                            : (isShape && el.radius != null ? el.radius + 'px' : '0'),
      'border':          isShape && el.stroke && el.stroke !== 'none'
                            ? `${el.strokeWidth || 1}px solid ${el.stroke}`
                            : '0',
      'transform':       el.rotation ? `rotate(${el.rotation}deg)` : 'none',
      'cursor':          el.locked ? 'default' : 'move',
    };
  }

  trackEl = (_: number, el: DesignerElement) => el.id;

  /** Resize-handle positions for the selected element. */
  readonly handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  handleStyle(h: Handle): Record<string, string> {
    const map: Record<Handle, Record<string, string>> = {
      nw: { top: '-5px',        'inset-inline-start': '-5px' },
      n:  { top: '-5px',        'inset-inline-start': 'calc(50% - 4px)' },
      ne: { top: '-5px',        'inset-inline-end':   '-5px' },
      e:  { top: 'calc(50% - 4px)', 'inset-inline-end': '-5px' },
      se: { bottom: '-5px',     'inset-inline-end':   '-5px' },
      s:  { bottom: '-5px',     'inset-inline-start': 'calc(50% - 4px)' },
      sw: { bottom: '-5px',     'inset-inline-start': '-5px' },
      w:  { top: 'calc(50% - 4px)', 'inset-inline-start': '-5px' },
    };
    return { ...map[h], cursor: this.resizeCursor(h) };
  }

  /** Coordinate-aware classes so `selected` styling stays in sync
   *  with the parent's `selectedId`. */
  isSelected = (el: DesignerElement) => this.selectedId() === el.id;

  /** Static QR matrix used by every QR Code element — a fake but
   *  recognisable pattern. The Classic preview uses the same one for
   *  visual continuity. */
  readonly qrPattern: [number, number][] = [
    [0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],
    [4,0],[6,0],[8,0],[9,0],[4,1],[7,1],[9,1],[5,2],[6,2],[8,2],
    [4,3],[5,3],[7,3],[9,3],[0,4],[2,4],[3,4],[5,4],[7,4],[8,4],[9,4],
    [1,5],[4,5],[6,5],[8,5],[0,6],[2,6],[5,6],[7,6],[9,6],
    [3,7],[4,7],[6,7],[8,7],[0,8],[1,8],[2,8],[3,8],[5,8],[7,8],[9,8],
    [0,9],[2,9],[6,9],[8,9],[9,9],
  ];

  /** Bar widths for the dummy Code-128-style barcode. Repeats. */
  readonly barcodeBars: number[] = [
    0.5, 0.5, 1, 0.5, 1.5, 0.5, 1, 0.5, 0.5, 1, 1.5, 0.5, 0.5, 1, 0.5,
    0.5, 0.5, 1, 0.5, 1.5, 0.5, 1, 0.5, 0.5, 1, 1.5, 0.5, 0.5, 1, 0.5,
    0.5, 0.5, 1, 0.5, 1.5, 0.5, 1, 0.5, 0.5, 1, 1.5, 0.5, 0.5, 1, 0.5,
    0.5, 0.5, 1, 0.5, 1.5,
  ];

  /** Format a Page-# element's content. Pulled into TS so the
   *  template doesn't chain `.replace()` calls (which Angular's
   *  template parser dislikes). */
  pageNumberText(el: DesignerElement): string {
    const fmt = (el.content || 'Page {X} of {Y}');
    const cur = String(el.current ?? 1);
    const tot = String(el.total ?? 1);
    return fmt.replace(/\{X\}/g, cur).replace(/\{Y\}/g, tot);
  }

  /** Compose the resolved token for a Data-Field element. */
  dataFieldText(el: DesignerElement): string {
    const path = el.path || '';
    if (!path) return '';
    return (el.prefix || '') + this.resolveTokens('{{' + path + (el.format ? '|' + el.format : '') + '}}') + (el.suffix || '');
  }

  /** Resolve `{{path.to.value}}` tokens against the sample data
   *  baked into the canvas (matches the Classic preview's sample so
   *  bound elements look like they would on a real document). */
  resolveTokens(input: string | undefined | null): string {
    if (!input) return '';
    return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
      const [path] = expr.split('|').map((s) => s.trim());
      const v = path.split('.').reduce<unknown>(
        (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]),
        SAMPLE_DATA as unknown,
      );
      return v == null ? '' : String(v);
    });
  }
}

/** Sample data used to resolve `{{tokens}}` in the canvas preview.
 *  Same shape as the Classic preview's sample so the two modes look
 *  visually consistent. */
const SAMPLE_DATA = {
  company:  { name: 'ABC Trading W.L.L.', vat: '200012345600002', phone: '+973 1700 0000' },
  customer: { name: 'XYZ Enterprises Ltd.', vat: '200056789400001', phone: '+973 1800 0000', address: 'Building 55, Block 303, Road 101, Riffa' },
  invoice:  { number: 'INV-2026-001287', date: '20/04/2026', dueDate: '20/05/2026' },
  totals:   { subtotal: '336.250', vat: '31.625', grandTotal: '367.875' },
};
