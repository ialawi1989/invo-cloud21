import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { statusClass } from '@shared/utils/status-tone';

import '../../accept-reject-orders-i18n';
import {
  SelectSerialsBatchesData, SelectSerialsBatchesModalComponent,
} from '../../components/select-serials-batches-modal/select-serials-batches-modal.component';
import { LinePick, ONLINE_ORDER_STATUSES, OnlineOrderRow } from '../../models/accept-reject-orders.model';
import { AcceptRejectOrdersService } from '../../services/accept-reject-orders.service';

/**
 * Accept / reject orders (cloud) -> list (`/accept-reject-order-cloud`). Legacy `AcceptRejectOrderCloudComponent`:
 * online orders by status (Pending / Accepted / Rejected, default Pending) and branch, with Accept / Reject on pending
 * ones. Accepting an order with serialized / batch products first asks for the serial / batch of each line.
 */
@Component({
  selector: 'app-accept-reject-orders-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, MycurrencyPipe],
  templateUrl: './accept-reject-orders-list.component.html',
})
export class AcceptRejectOrdersListComponent implements OnInit {
  private service = inject(AcceptRejectOrdersService);
  private api = inject(ApiService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild(ListPageComponent) private list?: ListPageComponent;

  readonly statusClass = statusClass;
  /** Order ids with a status change in flight. */
  readonly busy = signal<Set<string>>(new Set());

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'cart' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('accept-reject-orders');
    const t = (k: string) => this.lang.instant('ACCEPT_REJECT_ORDERS.' + k);
    this.columns = [
      { key: 'invoiceNumber', label: t('COL_INVOICE'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'employeeName', label: t('COL_EMPLOYEE'), sortable: true, visible: true, order: 1 },
      { key: 'customerName', label: t('COL_CUSTOMER'), sortable: true, visible: true, order: 2 },
      { key: 'total', label: t('COL_TOTAL'), sortable: true, customTemplate: true, align: 'end', visible: true, order: 3 },
      { key: 'branchName', label: t('COL_BRANCH'), sortable: true, visible: true, order: 4 },
      { key: 'invoiceDate', label: t('COL_DATE'), sortable: true, customTemplate: true, visible: true, order: 5 },
      { key: 'status', label: t('COL_STATUS'), customTemplate: true, visible: true, order: 6 },
      { key: 'onlineStatus', label: t('COL_ONLINE_STATUS'), customTemplate: true, visible: true, order: 7 },
    ];
    this.filters = [
      {
        type: 'status', key: 'status', label: t('FILTER_STATUS'), defaultValue: 'Placed',
        options: ONLINE_ORDER_STATUSES.map(s => ({ value: s, label: t('STATUS.' + s) })),
      },
      { type: 'dropdown', key: 'branchId', label: t('FILTER_BRANCH'), loadFn: p => this.loadBranches(p) },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/accept-reject-order-cloud' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'cart' };
  }

  private loadBranches = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: p.page, limit: p.pageSize, searchTerm: p.search }));
    const list: any[] = res?.data?.list ?? [];
    return { items: list.map(b => ({ value: b.id, label: b.name })), hasMore: p.page < (res?.data?.pageCount ?? 1) };
  };

  load = async (params: ListQueryParams) => {
    const f = params.filter ?? {};
    const branch = f['branchId'];
    const data = await this.service.getOrders({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
      status: (f['status'] as string) || 'Placed',
      // Legacy: "All" -> `branches: []`, otherwise just the chosen branch.
      branches: branch ? [String(branch)] : [],
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  isPending = (r: OnlineOrderRow) => (r.onlineStatus || 'Placed') === 'Placed';
  isBusy = (r: OnlineOrderRow) => this.busy().has(r.id);
  statusLabel = (s: string) => this.lang.instant('ACCEPT_REJECT_ORDERS.STATUS.' + s);

  view(r: OnlineOrderRow): void { void this.router.navigate(['/account/invoices/view', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  async accept(r: OnlineOrderRow): Promise<void> {
    if (this.isBusy(r)) return;
    // Orders with serialized / batch stock need a pick per line before they can be accepted.
    if (r.lines.length > 0) {
      const lines = await this.modal.open<SelectSerialsBatchesModalComponent, SelectSerialsBatchesData, LinePick[]>(
        SelectSerialsBatchesModalComponent, { size: 'lg', data: { order: r } },
      ).afterClosed();
      if (!lines) return;
      await this.run(r, () => this.service.acceptWithLines(r, lines), 'ACCEPT_REJECT_ORDERS.ACCEPTED');
    } else {
      await this.run(r, () => this.service.updateStatus(r, 'Accepted'), 'ACCEPT_REJECT_ORDERS.ACCEPTED');
    }
  }

  async reject(r: OnlineOrderRow): Promise<void> {
    if (this.isBusy(r)) return;
    await this.run(r, () => this.service.updateStatus(r, 'Rejected'), 'ACCEPT_REJECT_ORDERS.REJECTED');
  }

  private async run(r: OnlineOrderRow, call: () => Promise<any>, okKey: string): Promise<void> {
    this.busy.update(s => new Set(s).add(r.id));
    try {
      const res = await call();
      if (res?.success === false) {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' && res.msg ? res.msg : this.lang.instant('ACCEPT_REJECT_ORDERS.UPDATE_FAILED'));
      } else {
        this.toast.success(okKey);
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('ACCEPT_REJECT_ORDERS.UPDATE_FAILED'));
    } finally {
      this.busy.update(s => { const n = new Set(s); n.delete(r.id); return n; });
      this.list?.refresh();
    }
  }
}
