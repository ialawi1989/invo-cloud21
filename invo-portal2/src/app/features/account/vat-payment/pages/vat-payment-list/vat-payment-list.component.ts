import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalService } from '@shared/modal/modal.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';

import { VatPaymentService } from '../../services/vat-payment.service';
import { VatPaymentActions, vatStatusClass } from '../../services/vat-payment-actions';

const STATUSES = ['Initiated', 'Partially Paid', 'Paid'];
const ymd = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const arr = (v: any): any[] => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * VAT payments -> list (`/account/vat-payment`). Legacy `VatPaymentComponent`: same columns, server-side
 * search / sort / paging and filter payload (`status`, `branches`, dates). Only the latest return can be edited or deleted, and a new one can't start until the latest is paid.
 */
@Component({
  selector: 'app-vat-payment-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe,
  ],
  templateUrl: './vat-payment-list.component.html',
})
export class VatPaymentListComponent implements OnInit {
  private service = inject(VatPaymentService);
  private api = inject(ApiService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  readonly actions = inject(VatPaymentActions);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('vatPayment.actions.add.access');

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  moreItems: DropdownMenuBtnItem[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  /** The newest return - the only one that can still change. */
  private latest: { id: string; status: string } | null = null;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/vat-payment');
    const t = (k: string) => this.lang.instant(k);
    const L = 'VAT_PAYMENT.LIST.';

    this.columns = [
      { key: 'from', label: t(L + 'PERIOD'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'branchName', label: t(L + 'BRANCH'), sortable: true, visible: true, order: 1 },
      { key: 'outputVat', label: t(L + 'TAX_PAYABLE'), customTemplate: true, align: 'end', visible: true, order: 2 },
      { key: 'inputVat', label: t(L + 'TAX_RECLAIMABLE'), customTemplate: true, align: 'end', visible: true, order: 3 },
      { key: 'amountDue', label: t(L + 'AMOUNT_DUE'), sortable: true, customTemplate: true, align: 'end', visible: true, order: 4 },
      { key: 'status', label: t(L + 'STATUS'), sortable: true, customTemplate: true, visible: true, order: 5 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE'), visible: true, order: 6 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'status', label: t('VAT_PAYMENT.FILTERS.STATUS'), multiple: true, options: STATUSES.map(v => ({ value: v, label: t('VAT_PAYMENT.STATUS.' + v) })) },
      { type: 'dropdown', key: 'branches', label: t('VAT_PAYMENT.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('VAT_PAYMENT.FILTERS.DATE') },
    ];

    this.moreItems = [{ label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false }];
    this.searchConfig.placeholder = t('VAT_PAYMENT.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('VAT_PAYMENT.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('VAT_PAYMENT.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'VAT_PAYMENTS') },
    ];
  }

  loadPayments = async (params: ListQueryParams) => {
    const f = params.filter ?? {};
    const body: any = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      filter: { status: arr(f['status']), branches: arr(f['branches']), fromDate: ymd(f['fromDate']), toDate: ymd(f['toDate']) },
    };
    // The server's default order (newest period first) applies only when no sort is sent at all.
    if (params.sortBy) body.sortBy = { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection };
    const [data] = await Promise.all([this.service.getVatPaymentList(body), this.refreshLatest()]);
    return { list: data.list, count: data.count ?? 0, pageCount: data.pageCount ?? 0 };
  };

  /** The newest return overall, whatever the list is filtered / sorted by. */
  private async refreshLatest(): Promise<void> {
    const d = await this.service.getVatPaymentList({ page: 1, limit: 1, searchTerm: '', filter: {} });
    const first = d.list[0];
    this.latest = first ? { id: first.id, status: first.status } : null;
  }

  private loadBranches = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }));
    const list: any[] = res?.data?.list ?? [];
    return { items: list.map(b => ({ value: b.id, label: b.name })), hasMore: p.page < (res?.data?.pageCount ?? 1) };
  };

  /** Legacy: "New" is off while the newest return is still unpaid. */
  get addDisabled(): boolean { return !!this.latest && this.latest.status !== 'Paid'; }

  isLatest(r: any): boolean { return this.latest?.id === r.id; }
  canEdit(r: any): boolean { return this.actions.canEdit(r, this.isLatest(r)); }
  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, this.isLatest(r), () => this.listPage?.refresh?.()); }

  statusClass(status: string): string { return vatStatusClass(status); }
  statusLabel(status: string): string { return this.lang.instant('VAT_PAYMENT.STATUS.' + status); }

  add(): void { void this.router.navigate(['/account/vat-payment', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/vat-payment/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/vat-payment', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true, drawerWidth: '480px', drawerResizable: true,
      data: { sourceTable: 'VatPayments', title: this.lang.instant('VAT_PAYMENT.LIST.VAT_PAYMENTS') },
    });
  }
}
