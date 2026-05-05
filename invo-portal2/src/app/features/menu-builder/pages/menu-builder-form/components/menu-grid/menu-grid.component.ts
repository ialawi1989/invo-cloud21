import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CdkDragEnd, CdkDragMove, CdkDragStart, DragDropModule } from '@angular/cdk/drag-drop';

import {
  GRID_COLS,
  GRID_ROWS,
  MenuSectionColor,
  MenuSectionProduct,
} from '../../../../services/menu-builder.types';

interface ResizeState {
  id:        string;
  /** SE handle = bottom-right corner; E = right edge; S = bottom edge. */
  dir:       'SE' | 'E' | 'S';
  startX:    number;
  startY:    number;
  baseX:     number;
  baseY:     number;
  baseCols:  number;
  baseRows:  number;
  cellW:     number;
  cellH:     number;
  /** Live values updated on every mousemove; previewed in the template. */
  cols:      number;
  rows:      number;
}

/**
 * Custom 6×6 menu grid.
 *
 * No external grid library — pure CSS Grid for layout + CDK Drag for
 * cell-snap moves + native pointer events for resize.
 *
 * Coordinate model: tiles store `{x, y, cols, rows}`. The grid sets
 * `grid-column: x+1 / span cols` and `grid-row: y+1 / span rows`, so
 * the layout has a single source of truth — no `index` round-trips.
 *
 * Drag: each tile is `cdkDrag`. On `cdkDragEnded` we read the screen-
 * pixel translate, divide by the live cell width/height, round to the
 * nearest integer, clamp inside the grid, and reject the drop if the
 * destination overlaps another tile (otherwise emit `placementChange`).
 *
 * Resize: small SE/E/S handles capture pointer events. While the user
 * drags a handle we update a `resizing` signal whose `cols/rows` the
 * template prefers over the model values, giving a live preview. On
 * mouseup we emit `placementChange` (or clear the preview if the new
 * footprint overlaps another tile or runs off the grid).
 */
@Component({
  selector: 'app-menu-grid',
  standalone: true,
  imports: [CommonModule, TranslateModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-grid.component.html',
  styleUrl: './menu-grid.component.scss',
})
export class MenuGridComponent {
  /**
   * SIGNAL inputs (not classic `@Input()`s) so the `cells()` computed
   * actually re-runs when the parent passes a new array. With a plain
   * `@Input() products`, mutating the parent's signal hands the grid
   * a new reference but `computed()` only tracks signals, not regular
   * properties — so the empty-cell list went stale and `+` buttons
   * stopped rendering for cleared cells.
   */
  products     = input<MenuSectionProduct[]>([]);
  sectionColor = input<MenuSectionColor | null>(null);
  cols         = input<number>(GRID_COLS);
  rows         = input<number>(GRID_ROWS);

  @Output() pickAt          = new EventEmitter<{ x: number; y: number; cols: number; rows: number }>();
  @Output() placementChange = new EventEmitter<{ product: MenuSectionProduct; next: { x: number; y: number; cols: number; rows: number } }>();
  @Output() productRemove   = new EventEmitter<MenuSectionProduct>();
  @Output() productColor    = new EventEmitter<MenuSectionProduct>();

  gridEl = viewChild<ElementRef<HTMLElement>>('grid');

  resizing = signal<ResizeState | null>(null);

  /**
   * Live drop-target rectangle the user would land on if they
   * released the drag right now: `{ x, y, cols, rows, valid }`.
   * `null` when no drag is active. Drives the dashed phantom
   * placeholder that highlights the destination cells in the grid
   * (CDK does not surface a drop target for free `cdkDrag`).
   */
  dragTarget = signal<{ x: number; y: number; cols: number; rows: number; valid: boolean } | null>(null);

  /** Per-id live override applied during a resize, so the preview
   *  comes through the same template binding without extra branches. */
  liveOverride = computed(() => {
    const r = this.resizing();
    if (!r) return null;
    return { id: r.id, x: r.baseX, y: r.baseY, cols: r.cols, rows: r.rows };
  });

  /** Empty cells = (cols × rows) minus every cell occupied by a tile.
   *  We render an empty button at each so clicks anywhere on the
   *  background → product picker. */
  cells = computed<Array<{ x: number; y: number }>>(() => {
    const occupied = this.occupiedSet(this.products());
    const out: Array<{ x: number; y: number }> = [];
    const rows = this.rows();
    const cols = this.cols();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!occupied.has(`${x},${y}`)) out.push({ x, y });
      }
    }
    return out;
  });

  /** Display cols/rows for a tile — falls back to model unless the
   *  resize preview is currently overriding this id's footprint. */
  effectiveCols(p: MenuSectionProduct): number {
    const o = this.liveOverride();
    return o && o.id === idOf(p) ? o.cols : p.cols;
  }
  effectiveRows(p: MenuSectionProduct): number {
    const o = this.liveOverride();
    return o && o.id === idOf(p) ? o.rows : p.rows;
  }

  trackProduct = (_: number, p: MenuSectionProduct) => p.id ?? (p as any).__tempId ?? `${p.x},${p.y}`;
  trackCell    = (_: number, c: { x: number; y: number }) => `${c.x},${c.y}`;

  // ─── Empty-cell click → product picker ──────────────────────────────
  onCellClick(c: { x: number; y: number }): void {
    this.pickAt.emit({ x: c.x, y: c.y, cols: 1, rows: 1 });
  }

  // ─── Drag-to-move (cell snap on drop) ───────────────────────────────
  /** Compute the would-be drop position on every pointer move so the
   *  template can render a dashed phantom over those cells. */
  onTileDragMoved(p: MenuSectionProduct, ev: CdkDragMove): void {
    const m = this.cellMetrics();
    if (m.w === 0 || m.h === 0) return;
    const dxCells = Math.round(ev.distance.x / m.w);
    const dyCells = Math.round(ev.distance.y / m.h);
    const nextX = clamp(p.x + dxCells, 0, this.cols() - p.cols);
    const nextY = clamp(p.y + dyCells, 0, this.rows() - p.rows);
    const others = this.products().filter((q) => idOf(q) !== idOf(p));
    const occupied = this.occupiedSet(others);
    // Valid = empty destination OR a same-footprint tile we'd swap with.
    const valid = this.fits(nextX, nextY, p.cols, p.rows, occupied)
               || !!this.findExactNeighbour(others, nextX, nextY, p.cols, p.rows);
    const cur = this.dragTarget();
    // Avoid pointless signal updates when the cell hasn't changed —
    // mousemove fires per-frame.
    if (cur && cur.x === nextX && cur.y === nextY && cur.cols === p.cols
            && cur.rows === p.rows && cur.valid === valid) return;
    this.dragTarget.set({ x: nextX, y: nextY, cols: p.cols, rows: p.rows, valid });
  }

  onTileDragStarted(p: MenuSectionProduct, _ev: CdkDragStart): void {
    // Seed with the current position so the phantom is visible from
    // frame zero (before the first mousemove fires).
    this.dragTarget.set({ x: p.x, y: p.y, cols: p.cols, rows: p.rows, valid: true });
  }

  onTileDragEnd(p: MenuSectionProduct, ev: CdkDragEnd): void {
    const m = this.cellMetrics();
    if (m.w === 0 || m.h === 0) { ev.source.reset(); return; }

    const delta = ev.source.getFreeDragPosition();
    const dxCells = Math.round(delta.x / m.w);
    const dyCells = Math.round(delta.y / m.h);
    if (dxCells === 0 && dyCells === 0) { ev.source.reset(); return; }

    const nextX = clamp(p.x + dxCells, 0, this.cols() - p.cols);
    const nextY = clamp(p.y + dyCells, 0, this.rows() - p.rows);

    if (nextX === p.x && nextY === p.y) { ev.source.reset(); return; }

    const others = this.products().filter((q) => idOf(q) !== idOf(p));
    const occupied = this.occupiedSet(others);

    if (this.fits(nextX, nextY, p.cols, p.rows, occupied)) {
      // Empty cells under the destination → straight move.
      this.placementChange.emit({ product: p, next: { x: nextX, y: nextY, cols: p.cols, rows: p.rows } });
    } else {
      // Destination is occupied. Legacy gridster swapped tiles on
      // collision; we mirror that ONLY when the dropped tile lands
      // squarely on a single neighbour with matching footprint —
      // otherwise the two would partially overlap or run off-grid
      // after the swap. The neighbour's old slot must also fit our
      // dropped tile's footprint (same dimensions guarantees this,
      // but defence-in-depth: re-check `fits`).
      const neighbour = this.findExactNeighbour(others, nextX, nextY, p.cols, p.rows);
      if (neighbour) {
        this.placementChange.emit({
          product: p,
          next:    { x: neighbour.x, y: neighbour.y, cols: p.cols, rows: p.rows },
        });
        this.placementChange.emit({
          product: neighbour,
          next:    { x: p.x, y: p.y, cols: neighbour.cols, rows: neighbour.rows },
        });
      }
      // Otherwise: reject (no emit). The tile snaps back via reset().
    }
    // Whether we accepted the move or not, always clear CDK's translate
    // so the wrap renders at its [style.grid-column/row] (legacy bug:
    // skipping reset left a residual transform on the wrap and the next
    // drag compounded the offset).
    ev.source.reset();
    this.dragTarget.set(null);
  }

  /**
   * Find a tile whose footprint exactly matches `(x, y, cols, rows)` —
   * used by the swap path. Returns `null` when the destination either
   * has no tile or has a tile of a different size (in which case we
   * can't safely swap; the dropped tile snaps back).
   */
  private findExactNeighbour(list: MenuSectionProduct[], x: number, y: number, cols: number, rows: number): MenuSectionProduct | null {
    return list.find((q) => q.x === x && q.y === y && q.cols === cols && q.rows === rows) ?? null;
  }

  // ─── Resize via SE / E / S handles ──────────────────────────────────
  beginResize(p: MenuSectionProduct, dir: 'SE' | 'E' | 'S', ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    const m = this.cellMetrics();
    if (m.w === 0 || m.h === 0) return;
    this.resizing.set({
      id:       idOf(p),
      dir,
      startX:   ev.clientX,
      startY:   ev.clientY,
      baseX:    p.x,
      baseY:    p.y,
      baseCols: p.cols,
      baseRows: p.rows,
      cellW:    m.w,
      cellH:    m.h,
      cols:     p.cols,
      rows:     p.rows,
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onResizeMove(ev: MouseEvent): void {
    const r = this.resizing();
    if (!r) return;
    const dxCells = Math.round((ev.clientX - r.startX) / r.cellW);
    const dyCells = Math.round((ev.clientY - r.startY) / r.cellH);
    // cols/rows are 1 or 2 — clamp to that range AND to the remaining
    // grid space so a resize never spills over the right/bottom edge.
    const maxCols = Math.min(2, this.cols() - r.baseX);
    const maxRows = Math.min(2, this.rows() - r.baseY);
    const cols = (r.dir === 'S')        ? r.baseCols : clamp(r.baseCols + dxCells, 1, maxCols);
    const rows = (r.dir === 'E')        ? r.baseRows : clamp(r.baseRows + dyCells, 1, maxRows);
    if (cols === r.cols && rows === r.rows) return;
    this.resizing.set({ ...r, cols, rows });
  }

  @HostListener('document:mouseup')
  onResizeEnd(): void {
    const r = this.resizing();
    if (!r) return;
    this.resizing.set(null);
    if (r.cols === r.baseCols && r.rows === r.baseRows) return;
    const p = this.products().find((q) => idOf(q) === r.id);
    if (!p) return;
    // Reject if the new footprint overlaps another tile.
    const occupied = this.occupiedSet(this.products().filter((q) => idOf(q) !== r.id));
    if (!this.fits(r.baseX, r.baseY, r.cols, r.rows, occupied)) return;
    this.placementChange.emit({ product: p, next: { x: r.baseX, y: r.baseY, cols: r.cols, rows: r.rows } });
  }

  // ─── Geometry helpers ───────────────────────────────────────────────
  /** Read live pixel size of a single grid cell (factoring in gap +
   *  padding). Re-measured on demand so resizing the page keeps the
   *  cell-snap math accurate without an explicit ResizeObserver. */
  private cellMetrics(): { w: number; h: number } {
    const el = this.gridEl()?.nativeElement;
    if (!el) return { w: 0, h: 0 };
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop)  + parseFloat(cs.paddingBottom);
    const gapX = parseFloat(cs.columnGap || cs.gap) || 0;
    const gapY = parseFloat(cs.rowGap    || cs.gap) || 0;
    const cols = this.cols();
    const rows = this.rows();
    const w = (el.clientWidth  - padX - gapX * (cols - 1)) / cols;
    const h = (el.clientHeight - padY - gapY * (rows - 1)) / rows;
    return { w, h };
  }

  /** Set of `"x,y"` strings covered by the given products. */
  private occupiedSet(list: MenuSectionProduct[]): Set<string> {
    const s = new Set<string>();
    for (const p of list) {
      for (let dx = 0; dx < p.cols; dx++) {
        for (let dy = 0; dy < p.rows; dy++) {
          s.add(`${p.x + dx},${p.y + dy}`);
        }
      }
    }
    return s;
  }

  /** Does a `cols × rows` rectangle anchored at (x, y) fit without
   *  overlapping any cell in `occupied` and without spilling outside
   *  the grid? */
  private fits(x: number, y: number, cols: number, rows: number, occupied: Set<string>): boolean {
    if (x < 0 || y < 0 || x + cols > this.cols() || y + rows > this.rows()) return false;
    for (let dx = 0; dx < cols; dx++) {
      for (let dy = 0; dy < rows; dy++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false;
      }
    }
    return true;
  }
}

function idOf(p: MenuSectionProduct): string {
  return p.id ?? (p as any).__tempId ?? `${p.x},${p.y}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
