import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragMove, CdkDragStart } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { GRID_COLS, GRID_ROWS, type MenuSectionColor, type MenuSectionProduct } from '../../services/menu-builder.types';
import { rectsOverlap, slotNumber, tileKey } from '../../utils/menu-layout';
import { RowMenuComponent, type RowMenuItem } from '../row-menu/row-menu.component';

/** MIME type the search results put on a drag, read back here on drop. */
export const PRODUCT_DRAG_TYPE = 'application/x-menu-product';
export interface DraggedProduct { id: string; name: string; defaultImage?: string; color?: string; price?: number | null }

export type Direction = 'up' | 'down' | 'left' | 'right';

interface ResizeState {
  key: string; dir: 'SE' | 'E' | 'S'; startX: number; startY: number; baseX: number; baseY: number;
  baseCols: number; baseRows: number; cellW: number; cellH: number; cols: number; rows: number;
}

/**
 * The fixed 6x6 grid of one section page. Pure CSS grid; tiles are cdkDrag so they snap to cells.
 *  - empty cell: dashed "+" that asks for the product picker; a product dragged from the search results can be dropped on it;
 *  - tile: name (2 lines), price, the section colour as its border; drag to move (a same-size neighbour is swapped, anything else
 *    snaps back); hover "x" removes (the page offers Undo); the "..." menu moves it a cell at a time for keyboard users;
 *  - the small SE / E / S handles make a tile 2 cells wide / tall (existing menus use that).
 * Presentational: it reports what the user did, the page's store decides.
 */
@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [TranslateModule, CdkDrag, RowMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.scss',
})
export class ProductGridComponent {
  products = input<MenuSectionProduct[]>([]);
  sectionColor = input<MenuSectionColor | null>(null);
  cols = input(GRID_COLS);
  rows = input(GRID_ROWS);
  /** A short message to show under the grid (e.g. "Chicken Mandi is already on this page"). */
  notice = input<string | null>(null);

  pickAt = output<{ x: number; y: number }>();
  /** A tile was dragged (or resized) to a new cell / footprint. */
  tileMove = output<{ key: string; to: { x: number; y: number } }>();
  tileResize = output<{ key: string; cols: number; rows: number }>();
  tileStep = output<{ key: string; dir: Direction }>();
  tileRemove = output<MenuSectionProduct>();
  tileColor = output<MenuSectionProduct>();
  /** A search result was dropped on a cell. */
  productDrop = output<{ product: DraggedProduct; x: number; y: number }>();

  private gridEl = viewChild<ElementRef<HTMLElement>>('grid');
  resizing = signal<ResizeState | null>(null);
  dragTarget = signal<{ x: number; y: number; cols: number; rows: number; valid: boolean } | null>(null);
  /** Cell a search result is being dragged over. */
  overCell = signal<string | null>(null);

  constructor(private translate: TranslateService) {}

  keyOf(p: MenuSectionProduct): string { return tileKey(p); }
  trackCell = (_: number, c: { x: number; y: number }) => `${c.x},${c.y}`;

  /** Empty cells = every cell not covered by a tile. */
  cells = computed<Array<{ x: number; y: number }>>(() => {
    const occupied = this.occupiedSet(this.products());
    const out: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < this.rows(); y++) for (let x = 0; x < this.cols(); x++) if (!occupied.has(`${x},${y}`)) out.push({ x, y });
    return out;
  });

  private override = computed(() => {
    const r = this.resizing();
    return r ? { key: r.key, cols: r.cols, rows: r.rows } : null;
  });
  effCols(p: MenuSectionProduct): number { const o = this.override(); return o && o.key === tileKey(p) ? o.cols : p.cols; }
  effRows(p: MenuSectionProduct): number { const o = this.override(); return o && o.key === tileKey(p) ? o.rows : p.rows; }

  tileLabel(p: MenuSectionProduct): string {
    return this.translate.instant('MENU_BUILDER.GRID.TILE_LABEL', { name: p.productName, slot: slotNumber(p) });
  }
  removeLabel(p: MenuSectionProduct): string {
    return this.translate.instant('MENU_BUILDER.GRID.REMOVE_FROM_SLOT', { name: p.productName, slot: slotNumber(p) });
  }
  menuLabel(p: MenuSectionProduct): string { return this.translate.instant('MENU_BUILDER.GRID.TILE_ACTIONS', { name: p.productName }); }
  tileMenu(p: MenuSectionProduct): RowMenuItem[] {
    const t = (k: string) => this.translate.instant(k);
    const free = (dx: number, dy: number) => {
      const x = p.x + dx, y = p.y + dy;
      if (x < 0 || y < 0 || x + p.cols > this.cols() || y + p.rows > this.rows()) return false;
      return true;
    };
    return [
      { id: 'up', label: t('MENU_BUILDER.GRID.MOVE_UP'), disabled: !free(0, -1) },
      { id: 'down', label: t('MENU_BUILDER.GRID.MOVE_DOWN'), disabled: !free(0, 1) },
      { id: 'left', label: t('MENU_BUILDER.GRID.MOVE_LEFT'), disabled: !free(-1, 0) },
      { id: 'right', label: t('MENU_BUILDER.GRID.MOVE_RIGHT'), disabled: !free(1, 0) },
      { id: 'color', label: t('MENU_BUILDER.GRID.COLOR'), separator: true },
      { id: 'remove', label: t('COMMON.DELETE'), danger: true },
    ];
  }
  onTileMenu(p: MenuSectionProduct, id: string): void {
    if (id === 'color') this.tileColor.emit(p);
    else if (id === 'remove') this.tileRemove.emit(p);
    else this.tileStep.emit({ key: tileKey(p), dir: id as Direction });
  }

  onCellClick(c: { x: number; y: number }): void { this.pickAt.emit({ x: c.x, y: c.y }); }

  // ─── A search result dragged onto the grid (native drag and drop) ───
  onCellDragOver(e: DragEvent, c: { x: number; y: number }): void {
    if (!e.dataTransfer?.types.includes(PRODUCT_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.overCell.set(`${c.x},${c.y}`);
  }
  onCellDragLeave(): void { this.overCell.set(null); }
  onCellDrop(e: DragEvent, c: { x: number; y: number }): void {
    this.overCell.set(null);
    const raw = e.dataTransfer?.getData(PRODUCT_DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();
    try { this.productDrop.emit({ product: JSON.parse(raw) as DraggedProduct, x: c.x, y: c.y }); } catch { /* not ours */ }
  }

  // ─── Drag a tile to move it (cell snap on drop) ───
  onTileDragStarted(p: MenuSectionProduct, _e: CdkDragStart): void {
    this.dragTarget.set({ x: p.x, y: p.y, cols: p.cols, rows: p.rows, valid: true });
  }

  onTileDragMoved(p: MenuSectionProduct, ev: CdkDragMove): void {
    const m = this.cellMetrics();
    if (!m.w || !m.h) return;
    const x = clamp(p.x + Math.round(ev.distance.x / m.w), 0, this.cols() - p.cols);
    const y = clamp(p.y + Math.round(ev.distance.y / m.h), 0, this.rows() - p.rows);
    const others = this.products().filter((q) => tileKey(q) !== tileKey(p));
    const valid = this.fitsOn(others, x, y, p.cols, p.rows) || !!this.exactNeighbour(others, x, y, p);
    const cur = this.dragTarget();
    if (cur && cur.x === x && cur.y === y && cur.valid === valid) return;
    this.dragTarget.set({ x, y, cols: p.cols, rows: p.rows, valid });
  }

  onTileDragEnd(p: MenuSectionProduct, ev: CdkDragEnd): void {
    const m = this.cellMetrics();
    const d = ev.source.getFreeDragPosition();
    ev.source.reset();
    this.dragTarget.set(null);
    if (!m.w || !m.h) return;
    const x = clamp(p.x + Math.round(d.x / m.w), 0, this.cols() - p.cols);
    const y = clamp(p.y + Math.round(d.y / m.h), 0, this.rows() - p.rows);
    if (x === p.x && y === p.y) return;
    // The store decides: move to an empty cell, swap with a same-size tile, or refuse (the tile has already snapped back).
    this.tileMove.emit({ key: tileKey(p), to: { x, y } });
  }

  // ─── Resize (2 cells wide / tall) ───
  beginResize(p: MenuSectionProduct, dir: 'SE' | 'E' | 'S', ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    const m = this.cellMetrics();
    if (!m.w || !m.h) return;
    this.resizing.set({ key: tileKey(p), dir, startX: ev.clientX, startY: ev.clientY, baseX: p.x, baseY: p.y, baseCols: p.cols, baseRows: p.rows, cellW: m.w, cellH: m.h, cols: p.cols, rows: p.rows });
  }

  @HostListener('document:mousemove', ['$event'])
  onResizeMove(ev: MouseEvent): void {
    const r = this.resizing();
    if (!r) return;
    const dx = Math.round((ev.clientX - r.startX) / r.cellW);
    const dy = Math.round((ev.clientY - r.startY) / r.cellH);
    const cols = r.dir === 'S' ? r.baseCols : clamp(r.baseCols + dx, 1, Math.min(2, this.cols() - r.baseX));
    const rows = r.dir === 'E' ? r.baseRows : clamp(r.baseRows + dy, 1, Math.min(2, this.rows() - r.baseY));
    if (cols !== r.cols || rows !== r.rows) this.resizing.set({ ...r, cols, rows });
  }

  @HostListener('document:mouseup')
  onResizeEnd(): void {
    const r = this.resizing();
    if (!r) return;
    this.resizing.set(null);
    if (r.cols === r.baseCols && r.rows === r.baseRows) return;
    const others = this.products().filter((q) => tileKey(q) !== r.key);
    if (this.fitsOn(others, r.baseX, r.baseY, r.cols, r.rows)) this.tileResize.emit({ key: r.key, cols: r.cols, rows: r.rows });
  }

  // ─── Geometry ───
  private cellMetrics(): { w: number; h: number } {
    const el = this.gridEl()?.nativeElement;
    if (!el) return { w: 0, h: 0 };
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gapX = parseFloat(cs.columnGap || cs.gap) || 0;
    const gapY = parseFloat(cs.rowGap || cs.gap) || 0;
    return {
      w: (el.clientWidth - padX - gapX * (this.cols() - 1)) / this.cols(),
      h: (el.clientHeight - padY - gapY * (this.rows() - 1)) / this.rows(),
    };
  }
  private occupiedSet(list: readonly MenuSectionProduct[]): Set<string> {
    const s = new Set<string>();
    for (const p of list) for (let dx = 0; dx < p.cols; dx++) for (let dy = 0; dy < p.rows; dy++) s.add(`${p.x + dx},${p.y + dy}`);
    return s;
  }
  private fitsOn(others: readonly MenuSectionProduct[], x: number, y: number, cols: number, rows: number): boolean {
    if (x < 0 || y < 0 || x + cols > this.cols() || y + rows > this.rows()) return false;
    return !others.some((o) => rectsOverlap({ x, y, cols, rows }, o));
  }
  private exactNeighbour(list: readonly MenuSectionProduct[], x: number, y: number, p: MenuSectionProduct) {
    return list.find((q) => q.x === x && q.y === y && q.cols === p.cols && q.rows === p.rows) ?? null;
  }
}

function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
