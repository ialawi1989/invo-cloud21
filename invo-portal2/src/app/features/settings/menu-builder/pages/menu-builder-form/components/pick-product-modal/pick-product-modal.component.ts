import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { MenuBuilderService } from '../../../../services/menu-builder.service';

export interface PickProductModalData {
  /** Product ids already placed on the active page — hidden from the
   *  picker so the user can't double-add the same product to one page. */
  excludeIds?: Set<string>;
  /**
   * Maximum products the user is allowed to pick. The form computes
   * this from the active page's empty cell count (`cols × rows -
   * occupied`) so the user can't drop more tiles than will fit. New
   * tiles are 1×1, so `maxPick === remainingCells`. `Infinity` (or
   * undefined) means no cap.
   */
  maxPick?: number;
}

export interface PickedProduct {
  id: string;
  name: string;
  defaultImage: string;
  color: string;
  categoryId: string;
  categoryName: string;
}

/**
 * Modal that lists branch products and lets the user check several to
 * drop into the active section/page in one go.
 *
 * The form provides the active branch id; if no branch is selected the
 * modal renders a friendly empty state pointing back to the form.
 */
@Component({
  selector: 'app-pick-product-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'MENU_BUILDER.PICK.TITLE' | translate" [subtitle]="'MENU_BUILDER.PICK.SUB' | translate"/>

    <!-- The body is a fixed-height column: a sticky header (search +
         select-all) at the top, then a scrollable list that loads
         15 rows at a time as the user scrolls toward the bottom. -->
    <div class="body">
      <header class="head">
        <label class="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" [ngModel]="search()" (ngModelChange)="onSearch($event)" [placeholder]="'COMMON.SEARCH' | translate"/>
        </label>

        @if (!loading() && filtered().length > 0) {
          <div class="bar">
            <!-- Tri-state master toggle. Operates on the *currently
                 loaded* rows; flipping it on also activates "sticky"
                 select-all so newly-scrolled rows auto-join (up to cap). -->
            <button
              type="button"
              class="select-all"
              [class.select-all--locked]="capReached() && !someLoadedSelected()"
              (click)="toggleAll()"
              [disabled]="capReached() && !someLoadedSelected()">
              <span
                class="select-all__check"
                [class.select-all__check--on]="allLoadedSelected()"
                [class.select-all__check--mixed]="someLoadedSelected() && !allLoadedSelected()"
                aria-hidden="true">
                @if (allLoadedSelected()) {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                } @else if (someLoadedSelected()) {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="6" y1="12" x2="18" y2="12"/>
                  </svg>
                }
              </span>
              <span class="select-all__label">
                {{ (allLoadedSelected() ? 'MENU_BUILDER.PICK.DESELECT_ALL' : 'MENU_BUILDER.PICK.SELECT_ALL') | translate }}
              </span>
            </button>

            <!-- Counter chip: "X selected · N cells left" so users
                 know the cap before they hit it. -->
            <span class="counter" [class.counter--full]="capReached()">
              {{ 'MENU_BUILDER.PICK.COUNTER' | translate: { picked: picked().size, cells: capRemaining() } }}
            </span>
          </div>
        }
      </header>

      @if (loading()) {
        <div class="loading"><span class="spinner"></span></div>
      } @else if (filtered().length === 0) {
        <p class="empty">{{ 'MENU_BUILDER.PICK.EMPTY' | translate }}</p>
      } @else {
        <ul class="list" #scrollEl (scroll)="onListScroll($event)">
          @for (p of loadedRows(); track p.id) {
            <li
              class="row"
              [class.row--on]="picked().has(p.id)"
              [class.row--locked]="!picked().has(p.id) && capReached()"
              (click)="toggle(p.id)"
            >
              <span class="row__check" [class.row__check--on]="picked().has(p.id)" aria-hidden="true">
                @if (picked().has(p.id)) {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }
              </span>
              @if (p.defaultImage) {
                <img class="row__img" [src]="p.defaultImage" [alt]="p.name"/>
              } @else {
                <span class="row__img row__img--placeholder">{{ p.name.charAt(0) }}</span>
              }
              <span class="row__name">{{ p.name }}</span>
              @if (p.categoryName) {
                <span class="row__category" [attr.title]="p.categoryName">{{ p.categoryName }}</span>
              }
            </li>
          }
          <!-- Sentinel row: shown while there are still hidden filtered
               rows below the loaded slice. -->
          @if (loadedRows().length < filtered().length) {
            <li class="more">
              <span class="spinner"></span>
            </li>
          }
        </ul>
      }
    </div>

    <app-modal-footer>
      <span class="count">{{ 'MENU_BUILDER.PICK.SELECTED' | translate: { n: picked().size } }}</span>
      <button class="btn-cancel" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button class="btn-confirm" [disabled]="picked().size === 0" (click)="confirm()">
        {{ 'MENU_BUILDER.PICK.CONFIRM' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    /* Body is a fixed-height column: header pinned, list scrolls.
       Without min-height:0 on the list, the flex parent would size
       the list to its content and the page (not the list) would scroll. */
    .body {
      padding: 14px 20px 0;
      height: 60vh;
      max-height: 60vh;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    }
    .head {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #f1f5f9;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .counter {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      &--full { color: #b45309; }
    }
    .search {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #94a3b8;
      input {
        flex: 1; border: none; outline: none; font: inherit; font-size: 13px;
        background: transparent; color: #0f172a;
        &::placeholder { color: #94a3b8; }
      }
    }
    .loading { display: flex; align-items: center; justify-content: center; padding: 40px 0; }
    .spinner {
      width: 22px; height: 22px; border-radius: 50%;
      border: 3px solid #e2e8f0; border-top-color: var(--color-brand-600);
      animation: ppm-spin .8s linear infinite;
    }
    @keyframes ppm-spin { to { transform: rotate(360deg); } }

    .empty { margin: 0; padding: 32px 8px; text-align: center; color: #94a3b8; font-size: 13px; }

    // Master checkbox bar — visually quieter than a row so it doesn't
    // compete with the per-row checkboxes underneath.
    .select-all {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      font: inherit;
      color: #475569;
      font-size: 12px;
      font-weight: 600;

      &:hover { background: #f8fafc; border-color: #e2e8f0; color: #0f172a; }

      &__check {
        width: 18px; height: 18px;
        border: 1.5px solid #cbd5e1;
        border-radius: 4px;
        display: inline-flex; align-items: center; justify-content: center;
        color: #fff;
        background: #fff;
        flex-shrink: 0;
        &--on, &--mixed {
          background: var(--color-brand-600);
          border-color: var(--color-brand-600);
        }
      }
    }

    .list {
      list-style: none;
      margin: 0;
      padding: 4px 0 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-height: 0;       // crucial for flex-child overflow auto to work
      overflow-y: auto;
    }
    .more {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 0;
    }
    .row {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
      &:hover { background: #f8fafc; }
      &--on   { background: var(--color-brand-50); border-color: var(--color-brand-300, #bae6fd); }
      &--locked {
        // Cap reached + this row not picked → can't pick more.
        opacity: 0.55;
        cursor: not-allowed;
        &:hover { background: transparent; }
      }

      &__check {
        width: 18px; height: 18px;
        border: 1.5px solid #cbd5e1;
        border-radius: 4px;
        display: inline-flex; align-items: center; justify-content: center;
        color: #fff;
        background: #fff;
        flex-shrink: 0;
        &--on { background: var(--color-brand-600); border-color: var(--color-brand-600); }
      }
      &__img {
        width: 28px; height: 28px;
        border-radius: 6px;
        object-fit: cover;
        background: #f1f5f9;
        flex-shrink: 0;

        &--placeholder {
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: var(--color-brand-700);
          background: var(--color-brand-50);
        }
      }
      &__name { flex: 1; font-size: 13px; font-weight: 500; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Category chip — surfaces the backend's categoryName (the
         SQL COALESCE already normalises NULL → 'Uncategorized'). Hidden
         when empty so the row stays clean if the field is missing. */
      &__category {
        flex-shrink: 0;
        max-width: 130px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--color-brand-700);
        background: var(--color-brand-50);
        border-radius: 999px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .count { flex: 1; font-size: 12px; color: #64748b; }

    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }
    .btn-confirm {
      padding: 9px 24px; background: var(--color-brand-600); color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
      &:hover:not(:disabled) { background: var(--color-brand-700); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `]
})
export class PickProductModalComponent implements OnInit {
  data = inject<PickProductModalData>(MODAL_DATA);
  ref  = inject<ModalRef<PickedProduct[]>>(MODAL_REF);
  private service = inject(MenuBuilderService);

  loading = signal<boolean>(false);
  search  = signal<string>('');
  rows    = signal<PickedProduct[]>([]);
  picked  = signal<Set<string>>(new Set());

  /** How many filtered rows are visible right now. Bumped by 15 each
   *  time the user scrolls near the bottom of the list. Reset to 15
   *  whenever the search term changes so a new filter starts fresh. */
  loadedCount = signal<number>(15);

  /** Sticky select-all flag: when on, every newly-loaded row gets
   *  added to `picked` automatically (capped). Turning off any row
   *  manually flips this back off, so the user is never confused
   *  about whether new scrolled rows will join. */
  selectAllSticky = signal<boolean>(false);

  /** Hard cap on `picked.size` — the form computes this from the
   *  active page's empty-cell count and passes it via modal data. */
  readonly maxPick = (): number => this.data.maxPick ?? Infinity;

  /** Filtered = rows minus already-placed minus search miss. */
  filtered = computed<PickedProduct[]>(() => {
    const q = this.search().trim().toLowerCase();
    const exclude = this.data.excludeIds ?? new Set<string>();
    return this.rows()
      .filter((r) => !exclude.has(r.id))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q));
  });

  /** Visible slice — the first `loadedCount` filtered rows. */
  loadedRows = computed<PickedProduct[]>(() => this.filtered().slice(0, this.loadedCount()));

  capRemaining = computed<number>(() => Math.max(0, this.maxPick() - this.picked().size));
  capReached   = computed<boolean>(() => this.picked().size >= this.maxPick());

  /** True when every loaded row is in `picked`. */
  allLoadedSelected = computed<boolean>(() => {
    const f = this.loadedRows();
    if (f.length === 0) return false;
    const p = this.picked();
    return f.every((r) => p.has(r.id));
  });

  /** True when at least one loaded row is in `picked`. */
  someLoadedSelected = computed<boolean>(() => {
    const p = this.picked();
    return this.loadedRows().some((r) => p.has(r.id));
  });

  constructor() {
    // Sticky select-all: when more rows scroll into view AND the user
    // had "select all" active, auto-pick the new arrivals (up to cap).
    effect(() => {
      if (!this.selectAllSticky()) return;
      const visible = this.loadedRows();
      const cap = this.maxPick();
      this.picked.update((s) => {
        const next = new Set(s);
        for (const r of visible) {
          if (next.size >= cap) break;
          next.add(r.id);
        }
        return next;
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      // Pull a generous first page — anything beyond ~200 products
      // would warrant proper infinite scroll, which we can add when
      // someone hits it. Search runs client-side over the loaded set.
      const res = await this.service.listMenuProducts({ page: 1, limit: 200 });
      this.rows.set(res.list);
    } finally {
      this.loading.set(false);
    }
  }

  toggle(id: string): void {
    this.picked.update((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
        // Manually deselecting any row turns sticky select-all off,
        // so newly-loaded rows don't surprise-undo this action.
        this.selectAllSticky.set(false);
      } else {
        // Cap denies the add. Silent — the row's `--locked` style
        // already telegraphed it.
        if (next.size >= this.maxPick()) return s;
        next.add(id);
      }
      return next;
    });
  }

  /**
   * Master toggle. Operates on the currently *loaded* rows (not the
   * full filtered set) — that mirrors the legacy paging contract and
   * matches what's on screen. Flipping it on also enables
   * `selectAllSticky`, so any rows that scroll in afterwards auto-join
   * the selection (still capped).
   */
  toggleAll(): void {
    const visible = this.loadedRows();
    if (visible.length === 0) return;
    const allOn = this.allLoadedSelected();
    if (allOn) {
      // Deselect every visible row + drop sticky mode.
      this.picked.update((s) => {
        const next = new Set(s);
        for (const r of visible) next.delete(r.id);
        return next;
      });
      this.selectAllSticky.set(false);
    } else {
      // Select up to cap, then enable sticky mode for future scrolls.
      this.picked.update((s) => {
        const next = new Set(s);
        const cap = this.maxPick();
        for (const r of visible) {
          if (next.size >= cap) break;
          next.add(r.id);
        }
        return next;
      });
      this.selectAllSticky.set(true);
    }
  }

  /** Reset paging when the user changes the search term. Without this,
   *  the user could type a query that filters out the loaded slice and
   *  see "no products" even when matches exist further down the list. */
  onSearch(value: string): void {
    this.search.set(value);
    this.loadedCount.set(15);
  }

  /** Infinite scroll — when the list scrolls within ~64 px of the
   *  bottom, bump `loadedCount` by 15 until we've shown everything. */
  onListScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining > 64) return;
    const total = this.filtered().length;
    if (this.loadedCount() >= total) return;
    this.loadedCount.update((n) => Math.min(n + 15, total));
  }

  confirm(): void {
    const ids = this.picked();
    const out = this.rows().filter((r) => ids.has(r.id));
    this.ref.close(out);
  }
}
