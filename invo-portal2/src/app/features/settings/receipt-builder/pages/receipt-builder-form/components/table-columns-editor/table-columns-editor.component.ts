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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OverlayModule } from '@angular/cdk/overlay';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';

import { TableCell, TableGroup, TableRow } from '../../../../services/receipt-builder.types';
import { AlignIconComponent } from '../align-icon/align-icon.component';

/** One row in the "+ Add column" menu. `key` is the binding path the
 *  POS reads off each line ('' for a blank scratch column); `label`
 *  is the seeded column header the user can rename right after. */
export interface ColumnSuggestion {
  key: string;
  label: string;
}

/**
 * TableColumnsEditorComponent
 * ───────────────────────────
 * Renders the typed column model of a `Table` element as one card per
 * row, with each cell shown as a draggable chip. The user can:
 *
 *   - Reorder cells *within* a row (CDK drag inside one drop-list).
 *   - Move cells *between* rows (paired drop-lists via `cdkDropListGroup`).
 *   - Toggle cell visibility (hidden cells stay in the model so the
 *     toggle round-trips, but get width 0 and don't render at print).
 *   - Edit the header label.
 *   - Edit width (% of row, with auto-redistribute when changed).
 *   - Remove non-required cells.
 *   - Add a new column to a row.
 *
 * The component never mutates the input directly. Every change emits
 * `(groupsChange)` with a fresh deep-copied groups array so the parent
 * can fold it into the template via the standard
 * `patchSelectedElement('groups', …)` path. This keeps the form's
 * isDirty / undo-redo / signal-CD story uniform across every element.
 */
@Component({
  selector: 'app-table-columns-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    OverlayModule,
    CdkDropList,
    CdkDropListGroup,
    CdkDrag,
    CdkDragPlaceholder,
    AlignIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-columns-editor.component.html',
  styleUrl: './table-columns-editor.component.scss',
})
export class TableColumnsEditorComponent {
  /** Read-only handle on the current groups; mutations emit a fresh copy. */
  groups = input.required<TableGroup[]>();

  /** Source-specific catalog of pre-defined column suggestions. The
   *  parent (element-editor) picks the right list based on the
   *  table's `source` (lines / taxes / payments) so the user gets a
   *  one-click "Add column total.number()" instead of having to type
   *  the binding path by hand. The last entry should be the empty
   *  scratch column so the user can still add a blank manually. */
  addColumnCatalog = input<ColumnSuggestion[]>([]);

  /** Single emitter — parent funnels every column edit through one path. */
  @Output() groupsChange = new EventEmitter<TableGroup[]>();

  /** All row drop-list ids in render order — wired into each row's
   *  `cdkDropListConnectedTo` so a chip can be dragged from any row to
   *  any other. Recomputed per groups() change so freshly-added rows
   *  participate in the cross-row drag immediately. */
  rowDropListIds = computed<string[]>(() => {
    const ids: string[] = [];
    this.groups().forEach((g, gi) => {
      g.rows.forEach((_, ri) => ids.push(this.rowId(gi, ri)));
    });
    return ids;
  });

  /** Catalog filtered against the current table — mirrors the legacy
   *  `headerCellList()`: collect every cell key already on the table,
   *  then drop any catalog entry that **exactly equals** OR **is a
   *  prefix of** an existing cell key. Two upshots:
   *
   *    - Adding `qty.numberTrim()` (or any suffix-modified form like
   *      `qty.numberTrim().hideIfOne()`) hides the catalog's
   *      `qty.numberTrim()` entry — the row already covers it.
   *    - Different formatter projections of the same base stay
   *      independently offered: `discountAmount.number()` in a row
   *      doesn't filter `discountAmount.percentage()` from the
   *      catalog because the latter isn't a prefix of the former.
   *
   *  Empty-column entries (key `''`) are always kept — they're
   *  scratch columns, not bindings, and the user may want several. */
  availableColumns = computed<ColumnSuggestion[]>(() => {
    const used: string[] = [];
    this.groups().forEach((g) => {
      g.rows.forEach((r) => {
        r.cells.forEach((c) => { if (c.key) used.push(c.key); });
      });
    });
    return this.addColumnCatalog().filter((item) => {
      if (item.key === '') return true;
      return !used.some((k) => k === item.key || k.startsWith(item.key));
    });
  });

  rowId(gi: number, ri: number): string {
    return `rb-row-${gi}-${ri}`;
  }

  trackGroup = (_: number, g: TableGroup) => g.__key ?? _;
  trackRow   = (_: number, r: TableRow)   => r.__key ?? _;
  trackCell  = (_: number, c: TableCell)  => c.__key ?? _;

  // ── Expansion state ────────────────────────────────────────────────────
  // Only one cell is expanded at a time so the panel doesn't grow
  // taller than the right rail. Toggling a different cell collapses the
  // current one, click-again on the same cell collapses without
  // selecting another.
  expandedKey = signal<string | null>(null);
  isExpanded(key: string | undefined): boolean { return !!key && key === this.expandedKey(); }
  toggleExpanded(key: string | undefined): void {
    if (!key) return;
    this.expandedKey.update((cur) => (cur === key ? null : key));
  }

  /** Alignment options shown in the detail panel — wire stores mixed
   *  casing (`Left` for SideText, `left` for Logo/Image). We compare
   *  case-insensitively and write the lowercase form which matches the
   *  legacy table-cell convention. */
  readonly cellAlignments = ['left', 'center', 'right'] as const;

  /** Case-insensitive compare so a stored `Left` still highlights the
   *  `left` segment in the picker. */
  isAlignmentOn(cell: TableCell, value: string): boolean {
    return (cell.alignment || '').toLowerCase() === value;
  }

  // ── Conditional hide modifiers (legacy `.hideIfOne()` / `.hideIfZero()`) ─
  // The legacy wire encodes "hide this cell when its value matches a
  // sentinel" by appending a formatter suffix to `cell.key` — so `qty`
  // becomes `qty.hideIfOne()` when the user toggles it on, and
  // `price.number()` becomes `price.number().hideIfZero()`. We follow
  // the same convention here so the round-trip stays byte-compatible.
  //
  // Which sentinel applies depends on the column's base key: qty-like
  // columns use `hideIfOne`, money-like columns use `hideIfZero`. Other
  // columns get no toggle (the modifier wouldn't make sense).

  /** Strip `.hideIfOne()` / `.hideIfZero()` off the tail to recover
   *  the canonical key for catalog matching + display. */
  private stripHideSuffix(key: string): string {
    return (key || '')
      .replace(/\.hideIfOne\(\)$/,  '')
      .replace(/\.hideIfZero\(\)$/, '');
  }

  /** Strip the formatter (`.number()`, `.percentage()`, `.numberTrim()`)
   *  so we can match the column's BASE name regardless of how it's
   *  projected (e.g. `price.number()` → `price`, `qty.numberTrim()` →
   *  `qty`). Order matters: hide-suffix peels first, then formatter. */
  baseFieldName(key: string): string {
    return this.stripHideSuffix(key)
      .replace(/\.numberTrim\(\)$/,  '')
      .replace(/\.number\(\)$/,      '')
      .replace(/\.percentage\(\)$/,  '');
  }

  /** Returns which hide-modifier (if any) applies to this cell, based
   *  on its base column name. Returns `null` when no modifier is
   *  appropriate — the toggle row is hidden entirely in that case. */
  hideKind(cell: TableCell): 'one' | 'zero' | null {
    const base = this.baseFieldName(cell.key || '');
    if (base === 'qty') return 'one';
    if ([
      'price', 'total', 'taxTotal', 'subTotal', 'subTotalWithoutTax',
      'discountAmount', 'tenderAmount', 'tenderEquivalent', 'amount',
    ].includes(base)) return 'zero';
    return null;
  }

  /** True when the cell currently carries the `.hideIfX()` suffix. */
  isHideOn(cell: TableCell): boolean {
    const k = cell.key || '';
    return k.endsWith('.hideIfOne()') || k.endsWith('.hideIfZero()');
  }

  /** Toggle the conditional-hide suffix on or off. Picks the right
   *  modifier (`hideIfOne` vs `hideIfZero`) based on the cell's base
   *  name; no-op when the cell isn't a candidate. */
  toggleHide(gi: number, ri: number, ci: number): void {
    const next = this.cloneGroups();
    const cell = next[gi].rows[ri].cells[ci];
    const kind = this.hideKind(cell);
    if (!kind) return;

    const stripped = this.stripHideSuffix(cell.key || '');
    if (this.isHideOn(cell)) {
      cell.key = stripped;
    } else {
      cell.key = stripped + (kind === 'one' ? '.hideIfOne()' : '.hideIfZero()');
    }
    this.groupsChange.emit(next);
  }

  // ── Mutations (all funnel through emit) ────────────────────────────────

  /** Drop handler — same drop-list reorders, cross drop-list transfers,
   *  then redistributes width across the row's visible cells so the
   *  totals stay at 100% (matches legacy `reCalculateCells`). */
  onCellDrop(event: CdkDragDrop<TableCell[]>): void {
    // Clone groups deeply enough to mutate locally without aliasing.
    const next = this.cloneGroups();
    const fromIds = this.parseRowId(event.previousContainer.id);
    const toIds   = this.parseRowId(event.container.id);
    if (!fromIds || !toIds) return;

    const fromRow = next[fromIds.gi].rows[fromIds.ri].cells;
    const toRow   = next[toIds.gi].rows[toIds.ri].cells;

    if (event.previousContainer === event.container) {
      moveItemInArray(fromRow, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(fromRow, toRow, event.previousIndex, event.currentIndex);
      // Source row lost a visible cell — redistribute the freed width.
      this.redistributeRow(next[fromIds.gi].rows[fromIds.ri]);
      this.redistributeRow(next[toIds.gi].rows[toIds.ri]);
    }
    this.groupsChange.emit(next);
  }

  toggleVisible(gi: number, ri: number, ci: number): void {
    const next = this.cloneGroups();
    const cell = next[gi].rows[ri].cells[ci];
    cell.isVisible = !cell.isVisible;
    if (!cell.isVisible) cell.width = 0;
    this.redistributeRow(next[gi].rows[ri]);
    this.groupsChange.emit(next);
  }

  removeCell(gi: number, ri: number, ci: number): void {
    const next = this.cloneGroups();
    next[gi].rows[ri].cells.splice(ci, 1);
    this.redistributeRow(next[gi].rows[ri]);
    this.groupsChange.emit(next);
  }

  addCell(gi: number, ri: number): void {
    this.addCellFromCatalog(gi, ri, { key: '', label: 'New column' });
  }

  /** Append a new empty row to the group at index `gi`. Mirrors the
   *  legacy `ReceiptTableGroup.addRow()`. The fresh row gets a stable
   *  `__key` for CDK drag tracking and starts with no cells; the user
   *  fills it via the per-row "+ Add column" menu. */
  addRow(gi: number): void {
    const next = this.cloneGroups();
    if (!next[gi]) return;
    next[gi].rows.push({
      __key: 'row_' + Math.random().toString(36).slice(2, 8),
      rowType: 'static',
      cells: [],
    });
    this.groupsChange.emit(next);
  }

  /** Append a new empty group with a single starter row. Mirrors the
   *  legacy `ReceiptTable.addGroup(-1)` (push at end). Each group is
   *  visually separated and rows in different groups can carry
   *  independent column counts (legacy supports this, e.g. the
   *  invoice-lines table's two-row layout). */
  addGroup(): void {
    const next = this.cloneGroups();
    next.push({
      __key: 'group_' + Math.random().toString(36).slice(2, 8),
      rows: [
        {
          __key: 'row_' + Math.random().toString(36).slice(2, 8),
          rowType: 'static',
          cells: [],
        },
      ],
    });
    this.groupsChange.emit(next);
  }

  /** Remove the group at index `gi`. The user can never delete the
   *  last remaining group — every table needs at least one group to
   *  hold its rows, so the per-group delete button is hidden when
   *  only one group exists. */
  removeGroup(gi: number): void {
    if (this.groups().length <= 1) return;
    const next = this.cloneGroups();
    next.splice(gi, 1);
    this.groupsChange.emit(next);
  }

  /** Append a fresh cell seeded from a catalog entry. The empty-key
   *  case is the legacy "scratch column" path; non-empty keys come
   *  from the source-specific catalog so the user picks a binding
   *  with one click instead of typing the path by hand. Both paths
   *  funnel through this method so the cell shape (default width,
   *  alignment, visibility, fresh `__key`) stays consistent. */
  addCellFromCatalog(gi: number, ri: number, item: ColumnSuggestion): void {
    const next = this.cloneGroups();
    next[gi].rows[ri].cells.push({
      __key: 'cell_' + Math.random().toString(36).slice(2, 8),
      key:        item.key,
      value:      item.label,
      width:      20,
      alignment:  'Center',
      isVisible:  true,
    });
    this.redistributeRow(next[gi].rows[ri]);
    this.groupsChange.emit(next);
    this.closeAddMenu();
  }

  // ── "+ Add column" overlay menu ────────────────────────────────────────
  // Tracks which row's menu is open via row indices. Only one menu is
  // open at a time so the overlay backdrop doesn't fight itself when
  // the user opens row 2's menu while row 1's is still up.
  private addMenu = signal<{ gi: number; ri: number } | null>(null);

  isAddMenuOpen(gi: number, ri: number): boolean {
    const m = this.addMenu();
    return m !== null && m.gi === gi && m.ri === ri;
  }

  openAddMenu(gi: number, ri: number): void { this.addMenu.set({ gi, ri }); }
  closeAddMenu(): void                     { this.addMenu.set(null); }

  patchCell<K extends keyof TableCell>(
    gi: number, ri: number, ci: number, key: K, value: TableCell[K],
  ): void {
    const next = this.cloneGroups();
    const cell = next[gi].rows[ri].cells[ci];
    (cell as TableCell)[key] = value;
    if (key === 'width') this.redistributeRow(next[gi].rows[ri], ci);
    this.groupsChange.emit(next);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Deep clone `groups` so the parent's signal sees a brand-new array
   *  reference (which is what triggers OnPush re-render). Going through
   *  JSON would drop `__key`s after `parseElements` — they're plain
   *  strings, so they survive a structuredClone-equivalent copy. */
  private cloneGroups(): TableGroup[] {
    return this.groups().map((g) => ({
      ...g,
      rows: g.rows.map((r) => ({
        ...r,
        cells: r.cells.map((c) => ({ ...c })),
      })),
    }));
  }

  /** Drop-list id → indices. The id format is fixed by `rowId()`. */
  private parseRowId(id: string): { gi: number; ri: number } | null {
    const m = /^rb-row-(\d+)-(\d+)$/.exec(id);
    if (!m) return null;
    return { gi: +m[1], ri: +m[2] };
  }

  /** Spread the row's 100% across the visible cells, leaving the
   *  optionally-changed cell at its current width. Mirrors legacy
   *  `ReceiptTableRow.reCalculateCells`. */
  private redistributeRow(row: TableRow, fixedIndex: number = -1): void {
    const visible = row.cells.filter((c) => c.isVisible);
    if (visible.length === 0) return;

    if (fixedIndex >= 0 && fixedIndex < row.cells.length && row.cells[fixedIndex].isVisible) {
      const fixed = row.cells[fixedIndex];
      const others = visible.filter((c) => c !== fixed);
      const remaining = Math.max(0, 100 - fixed.width);
      const each = others.length > 0 ? remaining / others.length : 0;
      others.forEach((c) => (c.width = round1(each)));
    } else {
      const each = 100 / visible.length;
      visible.forEach((c) => (c.width = round1(each)));
    }
    // Hidden cells always read 0 so the wire stays consistent.
    row.cells.forEach((c) => { if (!c.isVisible) c.width = 0; });
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
