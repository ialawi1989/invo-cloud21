import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import {
  ProductFormPrefsService,
  ResolvedRow,
  ResolvedSection,
} from '../../services/product-form-prefs.service';
import { ProductFormRowLayout } from '@core/layout/services/employee-options.service';

export interface AdvancedOptionsModalData {
  productType: string;
  productTypeLabel?: string;
  /** Section ids the form would actually render for the active type
   *  (mirrors the per-section `@if` guards). Sections outside this
   *  set are filtered out of the modal — toggling them on wouldn't
   *  do anything, and saved prefs survive for when they reappear. */
  availableSectionIds: Set<string>;
}

/** Working-copy row used inside the modal. Same shape as
 *  `ResolvedRow` but the section arrays are mutable plain arrays
 *  (the resolver returns frozen-ish data). */
interface WorkingRow {
  index:  number;
  layout: ProductFormRowLayout;
  left:   ResolvedSection[];
  right:  ResolvedSection[];
}

/**
 * Advanced Options modal — multi-row layout editor.
 * ──────────────────────────────────────────────────
 *
 * The user manages an ordered list of rows. Each row has:
 *   - a layout picker (single / 2-1 / 1-1 / 1-2),
 *   - one or two CDK drop lanes containing its sections.
 *
 * Every drop lane in the modal is connected to every other drop
 * lane (the row's other column AND every column on every other
 * row). That lets the user drag a section from anywhere to
 * anywhere — the drop handler reads `previousContainer.id` /
 * `container.id` (both encode `row{idx}-{col}`) to decide the
 * source/target lane and updates the working state.
 *
 * Row reordering is its own drop list — the row blocks have a drag
 * handle on their header. Rows themselves drag among their siblings
 * within a separate `cdkDropList` so the section drops never
 * accidentally treat a row block as a sibling drop target.
 *
 * Saves are scoped per product type — `data.productType` is the
 * key under `employeeOptions.productForm`. Apply persists via
 * `prefs.save()` which patches the user's record optimistically.
 */
@Component({
  selector: 'app-advanced-options-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    CdkDropList,
    CdkDrag,
    ModalHeaderComponent,
    ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './advanced-options-modal.component.html',
  styleUrl: './advanced-options-modal.component.scss',
})
export class AdvancedOptionsModalComponent {
  data  = inject<AdvancedOptionsModalData>(MODAL_DATA);
  ref   = inject<ModalRef<void>>(MODAL_REF);
  prefs = inject(ProductFormPrefsService);

  /** Working copy of the row layout. Mutated in place by the drag
   *  handlers / layout selector / add+delete buttons. */
  rows = signal<WorkingRow[]>([]);

  layoutOptions: ProductFormRowLayout[] = ['2-1', '1-1', '1-2', 'single'];

  /** Hidden-but-saved counter for the footer hint. */
  hiddenCount = computed<number>(() => {
    const n = this.rows()
      .flatMap(r => [...r.left, ...r.right])
      .filter(s => !s.visible && !s.required)
      .length;
    return n;
  });

  /** All drop-list ids in the modal — passed to every lane's
   *  `cdkDropListConnectedTo` so cross-row + cross-column drags
   *  work everywhere. Recomputed when the rows list changes. */
  laneIds = computed<string[]>(() => {
    const ids: string[] = [];
    for (const row of this.rows()) {
      ids.push(`row-${row.index}-left`);
      if (row.layout !== 'single') ids.push(`row-${row.index}-right`);
    }
    return ids;
  });

  constructor() {
    this.refreshRows();
  }

  /** Pull the latest layout from the service and filter sections
   *  by `availableSectionIds`. Sections not available for the
   *  current type don't surface in the modal — but their saved
   *  prefs are preserved through `apply()` so they reappear when
   *  the type changes. */
  private refreshRows(): void {
    const avail = this.data.availableSectionIds ?? new Set<string>();
    const resolved = this.prefs.resolveRows(this.data.productType);
    const working: WorkingRow[] = resolved.map((r) => ({
      index:  r.index,
      layout: r.layout,
      left:   r.left.filter(s => avail.has(s.id)).map(s => ({ ...s })),
      right: r.right.filter(s => avail.has(s.id)).map(s => ({ ...s })),
    }));
    // Always keep at least one row to drop into.
    if (working.length === 0) {
      working.push({ index: 0, layout: '2-1', left: [], right: [] });
    }
    this.rows.set(working);
  }

  // ─── Layout picker ───────────────────────────────────────────────
  setLayout(rowIndex: number, layout: ProductFormRowLayout): void {
    const next = this.rows().map((r, i) => {
      if (i !== rowIndex) return r;
      // Swapping into `single` collapses any right-column sections
      // back into the left column so nothing disappears.
      if (layout === 'single' && r.right.length > 0) {
        return { ...r, layout, left: [...r.left, ...r.right], right: [] };
      }
      return { ...r, layout };
    });
    this.rows.set(this.reindex(next));
  }

  // ─── Add / remove / reorder rows ─────────────────────────────────
  addRow(): void {
    const next = [...this.rows(), { index: 0, layout: '2-1' as ProductFormRowLayout, left: [], right: [] }];
    const reindexed = this.reindex(next);
    this.rows.set(reindexed);
    // Wait for Angular to paint the new row, then scroll the rows
    // container all the way down — since `addRow` always appends,
    // scrolling to the container's `scrollHeight` is what we want.
    // `requestAnimationFrame` fires *after* the next paint, by which
    // point the new row's height contributes to `scrollHeight`.
    // Two rAFs gives the layout a frame to settle in case the row
    // also reflows (empty lanes, glyphs).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = document.querySelector<HTMLElement>('.aom__rows');
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    });
  }

  removeRow(rowIndex: number): void {
    const cur = this.rows();
    if (cur.length <= 1) return;
    const target = cur[rowIndex];
    if (!target) return;
    // Migrate any non-required sections in this row into the
    // previous (or next) row's left column. Required sections
    // shouldn't be lost — they ride along unconditionally.
    const sink = cur[rowIndex - 1] ?? cur[rowIndex + 1];
    const orphans = [...target.left, ...target.right];
    const next = cur.filter((_, i) => i !== rowIndex);
    if (sink && orphans.length) {
      const sinkIdx = next.indexOf(sink);
      next[sinkIdx] = { ...sink, left: [...sink.left, ...orphans] };
    }
    this.rows.set(this.reindex(next));
  }

  dropRow(event: CdkDragDrop<WorkingRow[]>): void {
    const next = [...this.rows()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.rows.set(this.reindex(next));
  }

  /** Re-stamp `index` so `data-row-layout` lookups + lane ids are
   *  always 0..n. The drop handlers rely on `index` to find the
   *  source/target lanes. */
  private reindex(rows: WorkingRow[]): WorkingRow[] {
    return rows.map((r, i) => ({ ...r, index: i }));
  }

  // ─── Section drop handler ────────────────────────────────────────
  // CDK delivers `previousContainer.id` / `container.id` on every
  // drop. We encode the row+col there (`row-{index}-left|right`)
  // so the handler can route the drop to the right working list.
  dropSection(event: CdkDragDrop<ResolvedSection[]>): void {
    const from = this.parseLaneId(event.previousContainer.id);
    const to   = this.parseLaneId(event.container.id);
    if (!from || !to) return;

    const cur = this.rows().map(r => ({
      ...r,
      left:  [...r.left],
      right: [...r.right],
    }));
    const fromArr = cur[from.row][from.col];
    const toArr   = cur[to.row][to.col];

    if (event.previousContainer === event.container) {
      moveItemInArray(toArr, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(fromArr, toArr, event.previousIndex, event.currentIndex);
    }
    this.rows.set(cur);
  }

  private parseLaneId(id: string): { row: number; col: 'left' | 'right' } | null {
    const m = /^row-(\d+)-(left|right)$/.exec(id);
    if (!m) return null;
    return { row: Number(m[1]), col: m[2] as 'left' | 'right' };
  }

  // ─── Per-row visibility shortcuts ────────────────────────────────
  toggleVisibility(rowIndex: number, col: 'left' | 'right', id: string): void {
    const next = this.rows().map((r, i) => {
      if (i !== rowIndex) return r;
      const updateCol = (list: ResolvedSection[]) =>
        list.map(s => s.id === id && !s.required ? { ...s, visible: !s.visible } : s);
      return col === 'left'
        ? { ...r, left: updateCol(r.left) }
        : { ...r, right: updateCol(r.right) };
    });
    this.rows.set(next);
  }

  // ─── Reset / Apply / Cancel ──────────────────────────────────────
  /** Repopulate the working state with catalog defaults, *without*
   *  persisting — the user might still hit Cancel. Apply is what
   *  actually writes to the backend. */
  reset(): void {
    const avail = this.data.availableSectionIds ?? new Set<string>();
    const defaults = this.prefs.defaultRows(this.data.productType);
    this.rows.set(defaults.map(r => ({
      index:  r.index,
      layout: r.layout,
      left:   r.left .filter(s => avail.has(s.id)).map(s => ({ ...s })),
      right:  r.right.filter(s => avail.has(s.id)).map(s => ({ ...s })),
    })));
  }

  async apply(): Promise<void> {
    // Merge edited rows with saved prefs for sections that were
    // filtered out (unavailable for the active type) so switching
    // away from this type and back doesn't drop those sections'
    // saved row+col+order.
    const avail = this.data.availableSectionIds ?? new Set<string>();
    const editedRows = this.rows().map(r => ({
      index:  r.index,
      layout: r.layout,
      left:   r.left,
      right:  r.right,
    }) as ResolvedRow);
    const edited = ProductFormPrefsService.toPersistedRows(editedRows);
    const stale = this.prefs.prefsFor(this.data.productType).sections
      .filter(s => !avail.has(s.id));
    await this.prefs.save(this.data.productType, {
      sections: [...stale, ...edited.sections],
      rows:     edited.rows,
    });
    this.ref.close();
  }

  cancel(): void { this.ref.dismiss(); }

  // ─── Track-by helpers ────────────────────────────────────────────
  trackRow     = (_: number, r: WorkingRow)      => r.index;
  trackSection = (_: number, s: ResolvedSection) => s.id;

  /** Layout label key for the segmented selector. */
  layoutLabel(l: ProductFormRowLayout): string {
    return `PRODUCTS.ADVANCED_OPTIONS.LAYOUT_${l.toUpperCase().replace('-', '_')}`;
  }
}
