import { Directive, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';

import { LanguageService } from '@core/i18n/language.service';
import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { BulkActionConfig, FilterConfig, ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';

import { CustomerAddress } from '../customers/models/customer.model';
import { TransactionLockService } from './transaction-lock.service';

export const ymdOf = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const toArray = (v: any): any[] => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/** Per-document settings of a list built on {@link DocumentListBase}. */
export interface DocListMeta {
  /** i18n features to load. */
  features: string[];
  /** Entity key the logs are stored under (`Invoices`, `Estimates`). */
  logsSource: string;
  /** Excel sheet + file prefix. */
  sheet: string;
  filePrefix: string;
  /** Row properties holding dates (exported as `yyyy-MM-dd`). */
  dateKeys: string[];
  /** The list filters by status (invoices) or not (estimates). */
  hasStatus: boolean;
  /** i18n keys: list title and dashboard crumb. */
  listTitleKey: string;
  dashboardCrumbKey: string;
}

/**
 * Plumbing every sales-document list page shares: the `app-list-page` state, the request body
 * (search / sort / filter payload), paged dropdown loaders for the filters, Excel export of the
 * visible columns and the activity-log drawer. A concrete list only defines its columns, filters,
 * row rules and the API call.
 */
@Directive()
export abstract class DocumentListBase {
  protected api = inject(ApiService);
  protected router = inject(Router);
  protected lang = inject(LanguageService);
  protected modal = inject(ModalService);
  protected toast = inject(ToastService);
  protected lock = inject(TransactionLockService);
  protected privileges = inject(PrivilegeService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  abstract readonly meta: DocListMeta;
  /** The paged list call of the document's API service. */
  protected abstract fetch(body: any): Promise<any>;

  protected lockInfo: any = null;
  exporting = signal(false);

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  bulkActions: BulkActionConfig[] = [];
  moreItems: DropdownMenuBtnItem[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  protected async initBase(): Promise<void> {
    await Promise.all(this.meta.features.map(f => this.lang.loadFeature(f)));
    this.lockInfo = await this.lock.transactionsDate();
  }

  protected t = (k: string) => this.lang.instant(k);

  /** Request body (search / sort / filter) shared by the list and the export. */
  protected buildBody(params: { searchTerm?: string; sortBy?: any; filter?: Record<string, any> }): any {
    const f = params.filter ?? {};
    const filter: Record<string, any> = {
      sources: toArray(f['sources']),
      branches: toArray(f['branches']),
      fromDate: ymdOf(f['fromDate']),
      toDate: ymdOf(f['toDate']),
      salesEmployeeId: f['salesEmployeeId'] || null,
      productId: f['productId'] || null,
    };
    if (this.meta.hasStatus) filter['status'] = toArray(f['status']);
    return {
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
      filter,
    };
  }

  load = async (params: ListQueryParams) => {
    const body: any = { page: params.page, limit: params.limit, ...this.buildBody(params) };
    if (params.columns?.length) body.columns = params.columns;
    const data = await this.fetch(body);
    return { list: data?.list ?? [], count: data?.count ?? 0, pageCount: data?.pageCount ?? 0 };
  };

  private async paged(endpoint: string, body: any, map: (r: any) => { value: any; label: string }, page: number) {
    const res = await this.api.request<any>(this.api.post(endpoint, body));
    const list: any[] = res?.data?.list ?? [];
    return { items: list.map(map), hasMore: page < (res?.data?.pageCount ?? 1) };
  }

  protected loadBranches = (p: { page: number; pageSize: number; search: string }) =>
    this.paged('branch/getBranches/', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }, b => ({ value: b.id, label: b.name }), p.page);

  protected loadEmployees = (p: { page: number; pageSize: number; search: string }) =>
    this.paged('employee/getEmployeeList', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }, e => ({ value: e.id, label: e.name }), p.page);

  protected loadProducts = (p: { page: number; pageSize: number; search: string }) =>
    this.paged('product/getProductsListByType', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }, x => ({ value: x.id, label: x.name }), p.page);

  // ── export / logs ──────────────────────────────────────────────────
  async exportExcel(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const visible = this.columns.filter(c => c.visible !== false);
      const body = {
        ...this.buildBody({
          searchTerm: this.listPage?.searchTerm(),
          sortBy: this.listPage?.sortBy(),
          filter: this.listPage?.activeFilters(),
        }),
        page: 1,
        limit: 999,
        columns: visible.map(c => c.key),
      };
      const data = await this.fetch(body);
      const rows = (data?.list ?? []).map((row: any) => {
        const out: Record<string, any> = {};
        visible.forEach(c => (out[c.label] = this.exportValue(c.key, row)));
        return out;
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), this.meta.sheet);
      XLSX.writeFile(wb, `${this.meta.filePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      this.exporting.set(false);
    }
  }

  protected exportValue(key: string, row: any): string {
    const raw = row?.[key];
    if (raw == null) return '';
    if (key === 'onlineData') return raw?.onlineStatus ?? '';
    if (key === 'customerAddress') return this.address(raw);
    if (this.meta.dateKeys.includes(key)) return String(raw).slice(0, 10);
    return typeof raw === 'object' ? '' : String(raw);
  }

  address(a: any): string {
    if (!a || typeof a !== 'object') return '';
    const addr = new CustomerAddress();
    addr.ParseJson(a);
    return addr.toString().trim();
  }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: { sourceTable: this.meta.logsSource, title: this.lang.instant(this.meta.listTitleKey) },
    });
  }
}
