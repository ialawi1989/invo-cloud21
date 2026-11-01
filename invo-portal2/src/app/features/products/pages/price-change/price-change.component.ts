import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ErrorService } from '@core/http/error.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { resolveLocalizedName } from '@shared/utils/localized-name';

import { ProductsService } from '../../services/products.service';
import {
  BULK_PRODUCT_TYPES,
  BulkScope,
  bulkScopeToParams,
  fetchByIds,
  parseBulkScope,
  productTypeKey,
} from '../../utils/bulk-scope';

interface PriceRow {
  productId: string;
  name: string;
  defaultPrice: number | null;
  /** Only the branches the product is actually sold at (BranchProducts rows). */
  branches: Record<string, number | null>;
}

interface Option { label: string; value: string }

const round3 = (n: number) => Number(n.toFixed(3));

/**
 * Bulk price change. Edit per-branch prices inline, or select products and
 * apply a +/- formula to one branch (or all). Edits are held client-side
 * across pages and sent in one `product/updateBulkPrices` call.
 */
@Component({
  selector: 'app-price-change',
  standalone: true,
  imports: [FormsModule, TranslateModule, BreadcrumbsComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-change.component.html',
  styleUrl: './price-change.component.scss',
})
export class PriceChangeComponent {
  private products = inject(ProductsService);
  private branchSvc = inject(BranchConnectionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private errorService = inject(ErrorService);

  scope = signal<BulkScope>(parseBulkScope(this.route.snapshot.queryParams));
  rows = signal<PriceRow[]>([]);
  count = signal(0);
  pageCount = signal(1);
  loading = signal(false);
  saving = signal(false);

  /** Original rows seen so far (any page) - lets formulas reach selected rows off-screen. */
  private known = new Map<string, PriceRow>();
  edits = signal<Record<string, Record<string, number | null>>>({});
  selected = signal<ReadonlySet<string>>(new Set());

  // Formula panel
  panelOpen = signal(false);
  formulaBranch = signal<string>('all');
  operand = signal<'+' | '-'>('+');
  amount = signal<number | null>(0);

  // Search box text (committed to scope on Enter)
  searchText = signal(this.scope().search);

  idsMode = computed(() => this.scope().ids.length > 0);
  branches = computed(() =>
    this.branchSvc.branches()
      .filter(b => (b.name ?? '').toLowerCase() !== 'all')
      .map(b => ({ id: b.id, name: b.name || '—' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  editedCount = computed(() => Object.keys(this.edits()).length);
  allSelected = computed(() => {
    const r = this.rows();
    return r.length > 0 && r.every(x => this.selected().has(x.productId));
  });

  // Dropdown plumbing
  display = (i: any) => i?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (i: any) => i?.value ?? i;

  typeItems = computed<Option[]>(() => {
    this.i18nTick();
    return BULK_PRODUCT_TYPES.map(t => ({
      label: this.translate.instant('PRODUCTS.TYPES.' + productTypeKey(t)),
      value: t,
    }));
  });
  selectedTypes = computed(() => this.typeItems().filter(i => this.scope().types.includes(i.value)));
  branchItems = computed<Option[]>(() => [
    { label: this.translate.instant('PRODUCTS.BULK_OPS.ALL_BRANCHES'), value: 'all' },
    ...this.branches().map(b => ({ label: b.name, value: b.id })),
  ]);
  selectedBranchItem = computed(() => this.branchItems().find(i => i.value === this.formulaBranch()) ?? null);
  operandItems: Option[] = [{ label: '+', value: '+' }, { label: '-', value: '-' }];
  selectedOperand = computed(() => this.operandItems.find(i => i.value === this.operand()) ?? null);
  limitItems: Option[] = [10, 25, 50, 100].map(n => ({ label: String(n), value: String(n) }));
  selectedLimit = computed(() => this.limitItems.find(i => i.value === String(this.scope().limit)) ?? null);

  departmentItem = signal<Option | null>(null);
  categoryItem = signal<Option | null>(null);
  loadDepartments = (p: { page: number; pageSize: number; search: string }) =>
    this.products.getDepartments({ ...p, departmentId: this.scope().departmentId });
  loadCategories = (p: { page: number; pageSize: number; search: string }) =>
    this.products.getCategories({ ...p, categoryId: this.scope().categoryId });

  hasFilters = computed(() => {
    const s = this.scope();
    return s.types.length > 0 || !!s.departmentId || !!s.categoryId;
  });

  private i18nTick = signal(0);
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.TITLE'), routerLink: '/products/list' },
      { label: this.translate.instant('PRODUCTS.PRICE_CHANGE.TITLE') },
    ];
  });

  constructor() {
    withTranslations('products');
    void this.init();
  }

  private async init(): Promise<void> {
    if (!this.branchSvc.loaded()) {
      try { await this.branchSvc.load(); } catch (e) { await this.errorService.handleError(e); }
    }
    await this.restoreNamedFilters();
    await this.load();
  }

  /** The URL carries only ids; resolve their labels for the dropdown triggers. */
  private async restoreNamedFilters(): Promise<void> {
    const s = this.scope();
    try {
      if (s.departmentId) {
        const page = await this.products.getDepartments({ page: 1, pageSize: 20, search: '', departmentId: s.departmentId });
        this.departmentItem.set(page.items.find(i => i.value === s.departmentId) ?? null);
      }
      if (s.categoryId) {
        const page = await this.products.getCategories({ page: 1, pageSize: 20, search: '', categoryId: s.categoryId });
        this.categoryItem.set(page.items.find(i => i.value === s.categoryId) ?? null);
      }
    } catch { /* label only - the filter id still applies */ }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    const s = this.scope();
    this.loading.set(true);
    try {
      const filter = {
        type: s.types,
        departments: s.departmentId ? [s.departmentId] : [],
        categories: s.categoryId ? [s.categoryId] : [],
      };
      let list: any[];
      if (s.ids.length) {
        list = await fetchByIds<any>(
          s.ids, r => r.productId,
          (page, limit) => this.products.getProductListByBranch({ page, limit, searchTerm: '', filter: {} }),
        );
        this.count.set(list.length);
        this.pageCount.set(1);
      } else {
        const res = await this.products.getProductListByBranch({ page: s.page, limit: s.limit, searchTerm: s.search, filter });
        list = res.list;
        this.count.set(res.count);
        this.pageCount.set(Math.max(1, res.pageCount));
      }
      const mapped = list.map(p => this.toRow(p));
      mapped.forEach(r => { if (!this.known.has(r.productId)) this.known.set(r.productId, r); });
      this.rows.set(mapped);
    } catch (e) {
      this.rows.set([]);
      await this.errorService.handleError(e);
    } finally {
      this.loading.set(false);
    }
  }

  private toRow(p: any): PriceRow {
    const branches: Record<string, number | null> = {};
    // A product with no BranchProducts rows comes back as one all-null entry.
    for (const b of p.branches ?? []) {
      if (b?.branchId) branches[b.branchId] = b.price ?? null;
    }
    return {
      productId: p.productId,
      name: resolveLocalizedName(p, this.translate.currentLang, 'productName') || p.productName || '',
      defaultPrice: p.defaultPrice ?? null,
      branches,
    };
  }

  // ── Scope / URL ───────────────────────────────────────────────────────────

  private async setScope(patch: Partial<BulkScope>, reload = true): Promise<void> {
    const next = { ...this.scope(), ...patch };
    this.scope.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bulkScopeToParams(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (reload) await this.load();
  }

  onSearch(): void { void this.setScope({ search: this.searchText().trim(), page: 1 }); }
  clearSearch(): void { this.searchText.set(''); void this.setScope({ search: '', page: 1 }); }
  onTypes(v: any): void {
    const arr = Array.isArray(v) ? v : [];
    void this.setScope({ types: arr.map((i: any) => i?.value ?? i), page: 1 });
  }
  onDepartment(v: any): void {
    this.departmentItem.set(v ?? null);
    void this.setScope({ departmentId: v?.value ?? null, page: 1 });
  }
  onCategory(v: any): void {
    this.categoryItem.set(v ?? null);
    void this.setScope({ categoryId: v?.value ?? null, page: 1 });
  }
  clearFilters(): void {
    this.departmentItem.set(null);
    this.categoryItem.set(null);
    void this.setScope({ types: [], departmentId: null, categoryId: null, page: 1 });
  }
  showAll(): void { void this.setScope({ ids: [], page: 1 }); }
  goTo(delta: number): void {
    const page = this.scope().page + delta;
    if (page >= 1 && page <= this.pageCount()) void this.setScope({ page });
  }
  onLimit(v: any): void {
    const n = Number(v?.value ?? v);
    if (n) void this.setScope({ limit: n, page: 1 });
  }

  // ── Prices ────────────────────────────────────────────────────────────────

  stocked(row: PriceRow, branchId: string): boolean { return branchId in row.branches; }

  priceOf(row: PriceRow, branchId: string): number | null {
    const e = this.edits()[row.productId];
    return e && branchId in e ? e[branchId] : (row.branches[branchId] ?? null);
  }

  isModified(row: PriceRow, branchId: string): boolean {
    const e = this.edits()[row.productId];
    return !!e && branchId in e;
  }

  private setEdit(row: PriceRow, branchId: string, value: number | null): void {
    this.edits.update(all => {
      const next = { ...all };
      const mine = { ...(next[row.productId] ?? {}) };
      if (value === (row.branches[branchId] ?? null)) delete mine[branchId];
      else mine[branchId] = value;
      if (Object.keys(mine).length) next[row.productId] = mine;
      else delete next[row.productId];
      return next;
    });
  }

  onPriceInput(row: PriceRow, branchId: string, raw: string): void {
    const n = raw === '' ? null : Number(raw);
    if (n !== null && !Number.isFinite(n)) return;
    this.setEdit(row, branchId, n === null ? null : n);
    this.select(row.productId, true); // editing a price selects the row (legacy)
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  private select(id: string, on: boolean): void {
    this.selected.update(s => {
      const next = new Set(s);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  onSelect(row: PriceRow, on: boolean): void {
    this.select(row.productId, on);
    if (!on) this.discardEdits([row.productId]); // unselecting reverts the row
  }

  onSelectAll(on: boolean): void {
    const ids = this.rows().map(r => r.productId);
    this.selected.update(s => {
      const next = new Set(s);
      ids.forEach(id => (on ? next.add(id) : next.delete(id)));
      return next;
    });
    if (!on) this.discardEdits(ids);
  }

  private discardEdits(ids: string[]): void {
    this.edits.update(all => {
      const next = { ...all };
      ids.forEach(id => delete next[id]);
      return next;
    });
  }

  discardAll(): void { this.edits.set({}); }

  // ── Formula ───────────────────────────────────────────────────────────────

  togglePanel(): void { this.panelOpen.update(v => !v); }

  onFormulaBranch(v: any): void { this.formulaBranch.set(v?.value ?? 'all'); }
  onOperand(v: any): void { this.operand.set((v?.value ?? v) === '-' ? '-' : '+'); }

  applyFormula(): void {
    const amount = Number(this.amount());
    if (!Number.isFinite(amount)) return;
    const sign = this.operand() === '-' ? -1 : 1;
    const only = this.formulaBranch();
    for (const id of this.selected()) {
      const row = this.known.get(id);
      if (!row) continue;
      for (const branchId of Object.keys(row.branches)) {
        if (only !== 'all' && branchId !== only) continue;
        // Always computed from the stored price so re-applying doesn't stack.
        const base = row.branches[branchId] ?? row.defaultPrice ?? 0;
        this.setEdit(row, branchId, round3(Math.max(0, base + sign * amount)));
      }
    }
    this.panelOpen.set(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    const payload = Object.entries(this.edits()).map(([productId, byBranch]) => ({
      productId,
      branches: Object.entries(byBranch).map(([branchId, price]) => ({ branchId, price })),
    }));
    if (!payload.length) return;
    this.saving.set(true);
    try {
      const res = await this.products.updateBulkPrices(payload);
      if (res?.success === false) throw res;
      this.toast.success(this.translate.instant('PRODUCTS.PRICE_CHANGE.SAVED'));
      this.edits.set({});
      this.selected.set(new Set());
      this.known.clear();
      await this.load();
    } catch (e) {
      await this.errorService.handleError(e);
    } finally {
      this.saving.set(false);
    }
  }

  trackRow = (_: number, r: PriceRow) => r.productId;
}
