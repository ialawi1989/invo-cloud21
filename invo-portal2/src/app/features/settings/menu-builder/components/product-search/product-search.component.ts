import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { PRODUCT_DRAG_TYPE, type DraggedProduct } from '../product-grid/product-grid.component';

export const SEARCH_DEBOUNCE_MS = 250;

/**
 * "Search products to add": a field and a short result list. Enter on a result puts it in the first empty slot;
 * a result can also be dragged onto a grid cell. Presentational: it reports the (debounced) query and the pick;
 * the page runs the search and hands the results back.
 */
@Component({
  selector: 'app-product-search',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-search.component.html',
  styleUrl: './product-search.component.scss',
})
export class ProductSearchComponent {
  results = input<DraggedProduct[]>([]);
  loading = input(false);
  disabled = input(false);

  /** The search text, 250 ms after the user stopped typing. */
  query = output<string>();
  /** Enter / click on a result: put it in the first empty slot. */
  pick = output<DraggedProduct>();

  term = signal('');
  active = signal(0);
  open = signal(false);
  private typed = new Subject<string>();

  constructor() {
    this.typed.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef))).subscribe((t) => this.query.emit(t));
  }

  onInput(value: string): void {
    this.term.set(value);
    this.active.set(0);
    this.open.set(true);
    this.typed.next(value.trim());
  }

  onFocus(): void {
    this.open.set(true);
    // The first focus loads a default list, so the field is useful before anything is typed.
    if (this.results().length === 0 && !this.loading()) this.query.emit(this.term().trim());
  }

  onKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.open.set(true); this.active.set((this.active() + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.active.set((this.active() - 1 + n) % n); }
    else if (e.key === 'Enter') {
      const item = this.results()[this.active()];
      if (item) { e.preventDefault(); this.pick.emit(item); }
    } else if (e.key === 'Escape') this.open.set(false);
  }

  dragStart(e: DragEvent, p: DraggedProduct): void {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(PRODUCT_DRAG_TYPE, JSON.stringify(p));
    e.dataTransfer.effectAllowed = 'copy';
  }
}
