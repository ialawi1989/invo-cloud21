import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { SuppliersService } from '../../services/suppliers.service';

export interface PickSupplierProductsData { supplierId: string }

interface Opt { value: string; label: string }
const PAGE = 30;

/**
 * "Pick products" of a supplier (legacy `PickProductModalSupplierComponent`): search + department /
 * category / type filters over `product/getProductsListForSupplier`, multi-select across pages (products the
 * supplier already sells are disabled) and "select all matching". Closes with the picked product objects.
 */
@Component({
  selector: 'app-pick-supplier-products-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent],
  template: `
    <app-modal-header [title]="'SUPPLIERS.ITEMS.PICK_PRODUCTS' | translate"/>
    <div class="pk">
      <div class="pk__filters">
        <input class="pk__input" type="text" [ngModel]="search()" (ngModelChange)="onSearch($event)" [placeholder]="'SUPPLIERS.ITEMS.SEARCH_PRODUCT' | translate"/>
        <app-search-dropdown class="pk__f" [loadFn]="loadDepartments" [displayWith]="label" [compareWith]="same" [clearable]="true"
          [placeholder]="'SUPPLIERS.ITEMS.DEPARTMENT' | translate" [value]="department()" (valueChange)="department.set($any($event) ?? null); reload()"/>
        <app-search-dropdown class="pk__f" [loadFn]="loadCategories" [displayWith]="label" [compareWith]="same" [clearable]="true"
          [placeholder]="'SUPPLIERS.ITEMS.CATEGORY' | translate" [value]="category()" (valueChange)="category.set($any($event) ?? null); reload()"/>
        <app-search-dropdown class="pk__f" [items]="types" [displayWith]="label" [compareWith]="same" [clearable]="false" [searchable]="false"
          [value]="typeOpt()" (valueChange)="type.set($any($event)?.value ?? 'all'); reload()"/>
      </div>

      <div class="pk__bar">
        <label class="pk__check"><input type="checkbox" [checked]="allLoadedPicked()" (change)="toggleLoaded()"/> {{ 'SUPPLIERS.ITEMS.SELECT_LOADED' | translate }}</label>
        @if (total() > items().length) {
          <button type="button" class="pk__link" [disabled]="selectingAll()" (click)="selectAllMatching()">
            {{ 'SUPPLIERS.ITEMS.SELECT_ALL_MATCHING' | translate: { count: total() } }}
          </button>
        }
        <span class="pk__count">{{ picked().size }} {{ 'SUPPLIERS.ITEMS.SELECTED' | translate }}</span>
        @if (picked().size) { <button type="button" class="pk__link" (click)="clear()">{{ 'COMMON.CLEAR' | translate }}</button> }
      </div>

      <div class="pk__list">
        @for (p of items(); track p.id) {
          <label class="pk__row" [class.is-disabled]="p.disabled">
            <input type="checkbox" [disabled]="!!p.disabled" [checked]="picked().has(p.id)" (change)="toggle(p)"/>
            <span class="pk__name">{{ p.name }}<small>{{ p.barcode }} · {{ p.type }}</small></span>
            <span class="pk__meta">{{ p.categoryName }}<small>{{ p.departmentName }}</small></span>
          </label>
        } @empty {
          @if (!loading()) { <p class="pk__empty">{{ 'SUPPLIERS.ITEMS.NO_PRODUCTS' | translate }}</p> }
        }
        @if (hasMore()) {
          <button type="button" class="pk__more" [disabled]="loading()" (click)="loadMore()">{{ 'SUPPLIERS.ITEMS.LOAD_MORE' | translate }}</button>
        }
      </div>
    </div>
    <app-modal-footer>
      <button type="button" class="pk__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="pk__btn pk__btn--primary" [disabled]="!picked().size || selectingAll()" (click)="pick()">{{ 'SUPPLIERS.ITEMS.PICK' | translate }} ({{ picked().size }})</button>
    </app-modal-footer>
  `,
  styles: [`
    .pk { padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; min-width: 640px; max-width: 100%; }
    .pk__filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .pk__input { flex: 1 1 220px; border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 12px; font: inherit; }
    .pk__f { flex: 1 1 160px; min-width: 150px; }
    .pk__bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .pk__check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
    .pk__count { margin-inline-start: auto; font-weight: 600; }
    .pk__link { border: 0; background: none; color: #2691a4; font-weight: 600; cursor: pointer; padding: 0; }
    .pk__list { border: 1px solid #e4e7ec; border-radius: 10px; max-height: 380px; overflow-y: auto; }
    .pk__row { display: grid; grid-template-columns: 24px 1fr 1fr; gap: 10px; align-items: center; padding: 9px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
    .pk__row:hover:not(.is-disabled) { background: #f8fafc; }
    .pk__row.is-disabled { opacity: .5; cursor: not-allowed; }
    .pk__name, .pk__meta { display: flex; flex-direction: column; font-size: 13.5px; color: #0f172a; }
    .pk__name small, .pk__meta small { color: #94a3b8; font-size: 12px; }
    .pk__empty { text-align: center; color: #94a3b8; padding: 24px; margin: 0; }
    .pk__more { width: 100%; border: 0; background: #f8fafc; padding: 10px; cursor: pointer; color: #2691a4; font-weight: 600; }
    .pk__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; cursor: pointer; }
    .pk__btn:disabled { opacity: .5; cursor: not-allowed; }
    .pk__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class PickSupplierProductsModalComponent implements OnInit {
  data = inject<PickSupplierProductsData>(MODAL_DATA);
  ref = inject<ModalRef<any[] | null>>(MODAL_REF);
  private suppliers = inject(SuppliersService);

  items = signal<any[]>([]);
  total = signal(0);
  page = signal(1);
  pageCount = signal(1);
  loading = signal(false);
  selectingAll = signal(false);
  search = signal('');
  department = signal<Opt | null>(null);
  category = signal<Opt | null>(null);
  type = signal('all');
  /** Every product picked so far (across pages / reloads), by id. */
  picked = signal<Map<string, any>>(new Map());

  types: Opt[] = [
    ['all', 'All Types'], ['inventory', 'Inventory'], ['serialized', 'Serialized'], ['batch', 'Batched'], ['kit', 'Kit'],
    ['service', 'Service'], ['package', 'Package'], ['menuItem', 'Menu Item'], ['menuSelection', 'Menu Selection'], ['tailoring', 'Tailoring'],
  ].map(([value, label]) => ({ value, label }));
  typeOpt = computed(() => this.types.find(t => t.value === this.type()) ?? this.types[0]);

  hasMore = computed(() => this.page() < this.pageCount());
  allLoadedPicked = computed(() => {
    const open = this.items().filter(p => !p.disabled);
    return open.length > 0 && open.every(p => this.picked().has(p.id));
  });

  label = (o: Opt) => o?.label ?? '';
  same = (a: Opt, b: Opt) => a?.value === b?.value;

  async ngOnInit(): Promise<void> { await this.reload(); }

  private params(page: number, limit: number): any {
    const filter: any = {};
    if (this.department()) filter.departments = [this.department()!.value];
    if (this.category()) filter.categories = [this.category()!.value];
    const p: any = { filter, page, limit, supplierId: this.data.supplierId };
    if (this.search()) p.searchTerm = this.search();
    if (this.type() !== 'all') p.types = [this.type()];
    return p;
  }

  async reload(): Promise<void> {
    this.page.set(1);
    this.items.set([]);
    await this.fetch(1);
  }

  async loadMore(): Promise<void> { await this.fetch(this.page() + 1); }

  private async fetch(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.suppliers.getProductsListForSupplier(this.params(page, PAGE));
      this.page.set(page);
      this.total.set(res?.count ?? 0);
      this.pageCount.set(res?.pageCount ?? 1);
      this.items.update(l => [...l, ...(res?.list ?? [])]);
    } finally {
      this.loading.set(false);
    }
  }

  private timer: any;
  onSearch(v: string): void {
    this.search.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reload(), 300);
  }

  toggle(p: any): void {
    this.picked.update(m => { const n = new Map(m); n.has(p.id) ? n.delete(p.id) : n.set(p.id, p); return n; });
  }

  toggleLoaded(): void {
    const open = this.items().filter(p => !p.disabled);
    const all = this.allLoadedPicked();
    this.picked.update(m => { const n = new Map(m); open.forEach(p => (all ? n.delete(p.id) : n.set(p.id, p))); return n; });
  }

  /** "Select all matching": every product of the current search / filters, not only the pages loaded. */
  async selectAllMatching(): Promise<void> {
    this.selectingAll.set(true);
    try {
      const res = await this.suppliers.getProductsListForSupplier(this.params(1, Math.max(this.total(), PAGE)));
      this.picked.update(m => { const n = new Map(m); (res?.list ?? []).filter((p: any) => !p.disabled).forEach((p: any) => n.set(p.id, p)); return n; });
    } finally {
      this.selectingAll.set(false);
    }
  }

  clear(): void { this.picked.set(new Map()); }
  pick(): void { this.ref.close([...this.picked().values()]); }

  // ── filter sources ─────────────────────────────────────────────────
  loadDepartments = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.suppliers.getDepartments({ page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} });
    return { items: (res?.list ?? []).map((d: any) => ({ value: d.id, label: d.name })), hasMore: p.page < (res?.pageCount ?? 1) };
  };
  loadCategories = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.suppliers.getCategories({ page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} });
    return { items: (res?.list ?? []).map((c: any) => ({ value: c.id, label: c.name })), hasMore: p.page < (res?.pageCount ?? 1) };
  };
}
