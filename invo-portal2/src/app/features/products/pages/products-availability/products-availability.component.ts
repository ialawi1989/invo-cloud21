import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ErrorService } from '@core/http/error.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ProductsService } from '../../services/products.service';
import {
  BULK_PRODUCT_TYPES,
  BulkScope,
  bulkScopeToParams,
  fetchByIds,
  parseBulkScope,
  productTypeKey,
} from '../../utils/bulk-scope';

interface AvailabilityRow {
  productId: string;
  branchProdId: string;
  name: string;
  type: string;
  categoryName: string | null;
  departmentName: string | null;
  available: boolean;
  availableOnline: boolean;
  notAvailableUntil: string | null;
  notAvailableOnlineUntil: string | null;
  hasOptions: boolean;
}

interface OptionRow {
  optionId: string;
  optionName: string;
  available: boolean;
  availableOnline: boolean;
  pauseUntil: string | null;
  OnlinePauseUntil: string | null;
  isDisabled: boolean;
}

interface OptionGroup { groupName: string; options: OptionRow[] }
interface Option { label: string; value: string }

type Channel = 'store' | 'online';

/**
 * Per-branch product + option availability. Each toggle / pause saves
 * immediately (as the legacy page did); the list is then re-read so
 * server-computed "not available until" values are shown.
 */
@Component({
  selector: 'app-products-availability',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslateModule, BreadcrumbsComponent, SearchDropdownComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-availability.component.html',
  styleUrl: './products-availability.component.scss',
})
export class ProductsAvailabilityComponent {
  private products = inject(ProductsService);
  private branchSvc = inject(BranchConnectionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private errorService = inject(ErrorService);

  scope = signal<BulkScope>(parseBulkScope(this.route.snapshot.queryParams));
  rows = signal<AvailabilityRow[]>([]);
  count = signal(0);
  pageCount = signal(1);
  loading = signal(false);
  branchId = signal<string>('');
  searchText = signal(this.scope().search);

  /** Expanded option panels, keyed by branchProdId (survive list reloads). */
  expanded = signal<ReadonlySet<string>>(new Set());
  optionGroups = signal<Record<string, OptionGroup[]>>({});
  optionsLoading = signal<ReadonlySet<string>>(new Set());

  idsMode = computed(() => this.scope().ids.length > 0);
  branchItems = computed<Option[]>(() =>
    this.branchSvc.branches().map(b => ({ label: b.name || '—', value: b.id })),
  );
  selectedBranch = computed(() => this.branchItems().find(i => i.value === this.branchId()) ?? null);

  display = (i: any) => i?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  typeItems = computed<Option[]>(() =>
    BULK_PRODUCT_TYPES.map(t => ({
      label: this.translate.instant('PRODUCTS.TYPES.' + productTypeKey(t)),
      value: t,
    })),
  );
  selectedTypes = computed(() => this.typeItems().filter(i => this.scope().types.includes(i.value)));
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

  breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('PRODUCTS.TITLE'), routerLink: '/products/list' },
    { label: this.translate.instant('PRODUCTS.AVAILABILITY_PAGE.TITLE') },
  ]);

  typeLabel = (type: string) => this.translate.instant('PRODUCTS.TYPES.' + productTypeKey(type));

  constructor() {
    withTranslations('products');
    void this.init();
  }

  private async init(): Promise<void> {
    if (!this.branchSvc.loaded()) {
      try { await this.branchSvc.load(); } catch (e) { await this.errorService.handleError(e); }
    }
    this.branchId.set(this.branchItems()[0]?.value ?? '');
    await this.restoreNamedFilters();
    await this.load();
  }

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

  /** `silent` keeps the current rows on screen (no dimming) after a save. */
  async load(silent = false): Promise<void> {
    const s = this.scope();
    const branchId = this.branchId();
    if (!branchId) { this.rows.set([]); return; }
    if (!silent) this.loading.set(true);
    try {
      // sortBy: null on purpose - the backend builds `"<sortValue>"` from any
      // object, so the legacy `{}` becomes the column "undefined".
      const fetchPage = async (page: number, limit: number, searchTerm: string, filter: any) => {
        const res = await this.products.getBranchProductsAvailability({
          page, limit, searchTerm, sortBy: null, branchId, filter,
        });
        const d = res?.data ?? {};
        return { list: (d.list ?? []) as AvailabilityRow[], count: Number(d.count ?? 0), pageCount: Number(d.pageCount ?? 0) };
      };
      if (s.ids.length) {
        const list = await fetchByIds<AvailabilityRow>(s.ids, r => r.productId, (p, l) => fetchPage(p, l, '', {}));
        this.rows.set(list);
        this.count.set(list.length);
        this.pageCount.set(1);
      } else {
        const res = await fetchPage(s.page, s.limit, s.search, {
          type: s.types,
          departments: s.departmentId ? [s.departmentId] : [],
          categories: s.categoryId ? [s.categoryId] : [],
        });
        this.rows.set(res.list);
        this.count.set(res.count);
        this.pageCount.set(Math.max(1, res.pageCount));
      }
    } catch (e) {
      this.rows.set([]);
      await this.errorService.handleError(e);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Scope / URL ───────────────────────────────────────────────────────────

  private async setScope(patch: Partial<BulkScope>): Promise<void> {
    const next = { ...this.scope(), ...patch };
    this.scope.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bulkScopeToParams(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    await this.load();
  }

  onBranch(v: any): void {
    this.branchId.set(v?.value ?? '');
    this.expanded.set(new Set());
    this.optionGroups.set({});
    void this.load();
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

  // ── Product availability ──────────────────────────────────────────────────

  private patchRow(branchProdId: string, patch: Partial<AvailabilityRow>): void {
    this.rows.update(rs => rs.map(r => (r.branchProdId === branchProdId ? { ...r, ...patch } : r)));
  }

  /** Toggle on/off. Optimistic, rolled back if the save fails. */
  async setAvailable(row: AvailabilityRow, channel: Channel, value: boolean): Promise<void> {
    const online = channel === 'online';
    const prev = online ? row.availableOnline : row.available;
    this.patchRow(row.branchProdId, online ? { availableOnline: value } : { available: value });
    try {
      const payload = { branchProdId: row.branchProdId, available: value };
      const res = online
        ? await this.products.updateOnlineAvailability(payload)
        : await this.products.updateAvailability(payload);
      if (res?.success === false) throw res;
      await this.load(true);
    } catch (e) {
      this.patchRow(row.branchProdId, online ? { availableOnline: prev } : { available: prev });
      await this.errorService.handleError(e);
    }
  }

  /** Pause for a day / resume. Server computes `notAvailableUntil`. */
  async togglePause(row: AvailabilityRow, channel: Channel): Promise<void> {
    const online = channel === 'online';
    const paused = online ? row.notAvailableOnlineUntil : row.notAvailableUntil;
    try {
      const payload = {
        branchProdId: row.branchProdId,
        available: online ? row.availableOnline : row.available,
        pause: !paused,
      };
      const res = online
        ? await this.products.updateOnlineAvailability(payload)
        : await this.products.updateAvailability(payload);
      if (res?.success === false) throw res;
      await this.load(true);
    } catch (e) {
      await this.errorService.handleError(e);
    }
  }

  // ── Option availability ───────────────────────────────────────────────────

  isExpanded(row: AvailabilityRow): boolean { return this.expanded().has(row.branchProdId); }

  async toggleOptions(row: AvailabilityRow): Promise<void> {
    const id = row.branchProdId;
    if (this.expanded().has(id)) {
      this.expanded.update(s => { const n = new Set(s); n.delete(id); return n; });
      return;
    }
    this.expanded.update(s => new Set(s).add(id));
    await this.loadOptions(id);
  }

  private async loadOptions(branchProdId: string): Promise<void> {
    this.optionsLoading.update(s => new Set(s).add(branchProdId));
    try {
      const res = await this.products.getOptionsProductAvailability(branchProdId);
      const groups = new Map<string, OptionRow[]>();
      for (const o of (res?.data ?? []) as any[]) {
        const key = o.groupName ?? '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(o as OptionRow);
      }
      this.optionGroups.update(m => ({
        ...m,
        [branchProdId]: [...groups.entries()].map(([groupName, options]) => ({ groupName, options })),
      }));
    } catch (e) {
      await this.errorService.handleError(e);
    } finally {
      this.optionsLoading.update(s => { const n = new Set(s); n.delete(branchProdId); return n; });
    }
  }

  async setOptionAvailable(row: AvailabilityRow, opt: OptionRow, channel: Channel, value: boolean): Promise<void> {
    const online = channel === 'online';
    try {
      const payload = { optionId: opt.optionId, available: value, branchProdId: row.branchProdId };
      const res = online
        ? await this.products.updateOnlineProductOptionsAvailability(payload)
        : await this.products.updateProductOptionsAvailability(payload);
      if (res?.success === false) throw res;
      await this.loadOptions(row.branchProdId);
    } catch (e) {
      await this.errorService.handleError(e);
      await this.loadOptions(row.branchProdId); // snap the toggle back to server truth
    }
  }

  async toggleOptionPause(row: AvailabilityRow, opt: OptionRow, channel: Channel): Promise<void> {
    const online = channel === 'online';
    const paused = online ? opt.OnlinePauseUntil : opt.pauseUntil;
    try {
      const payload = {
        optionId: opt.optionId,
        available: online ? opt.availableOnline : opt.available,
        branchProdId: row.branchProdId,
        pause: !paused,
      };
      const res = online
        ? await this.products.updateOnlineProductOptionsAvailability(payload)
        : await this.products.updateProductOptionsAvailability(payload);
      if (res?.success === false) throw res;
      await this.loadOptions(row.branchProdId);
    } catch (e) {
      await this.errorService.handleError(e);
    }
  }

  trackRow = (_: number, r: AvailabilityRow) => r.branchProdId;
}
