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

import { BillsPaymentService } from '../../services/bills-payment.service';
import { BillPaymentActions } from '../../services/bill-payment-actions';

const ymd = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const arr = (v: any): any[] => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * Payments → list (`/account/bills-payment`). Legacy `PaymentsComponent`: same columns, server-side
 * search / sort / paging and the same filter payload (`sources`, `branches`, dates). Editing is
 * hidden for reconciled payments and for users without the add privilege.
 */
@Component({
  selector: 'app-bills-payment-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe,
  ],
  templateUrl: './bills-payment-list.component.html',
})
export class BillsPaymentListComponent implements OnInit {
  private service = inject(BillsPaymentService);
  private api = inject(ApiService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  readonly actions = inject(BillPaymentActions);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('billingPaymentsSecurity.actions.add.access');

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  moreItems: DropdownMenuBtnItem[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/bills-payment');
    const t = (k: string) => this.lang.instant(k);
    const L = 'BILLS_PAYMENT.LIST.';

    this.columns = [
      { key: 'paymentDate', label: t(L + 'PAYMENT_DATE'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'supplierName', label: t(L + 'SUPPLIER_NAME'), visible: true, order: 1 },
      { key: 'paymentName', label: t(L + 'PAYMENT_METHOD'), visible: true, order: 2 },
      { key: 'referenceNumber', label: t(L + 'REFERENCE_NUMBER'), visible: true, order: 3 },
      { key: 'paidAmount', label: t(L + 'AMOUNT'), sortable: true, customTemplate: true, align: 'end', visible: true, order: 4 },
      { key: 'unusedAmount', label: t(L + 'UNUSED_AMOUNT'), customTemplate: true, align: 'end', visible: true, order: 5 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), sortable: true, visible: true, order: 6 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), sortable: true, visible: true, order: 7 },
      { key: 'createdAt', label: t(L + 'CREATED_DATE'), customTemplate: true, visible: false, order: 8 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'branches', label: t('BILLS_PAYMENT.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('BILLS_PAYMENT.FILTERS.DATE') },
    ];

    this.moreItems = [{ label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false }];
    this.searchConfig.placeholder = t('BILLS_PAYMENT.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('BILLS_PAYMENT.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('BILLS_PAYMENT.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'PAYMENTS_LIST') },
    ];
  }

  loadPayments = async (params: ListQueryParams) => {
    const f = params.filter ?? {};
    const body: any = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
      filter: { branches: arr(f['branches']), fromDate: ymd(f['fromDate']), toDate: ymd(f['toDate']) },
    };
    const data = await this.service.getBillingPaymentList(body);
    return { list: data.list, count: data.count ?? 0, pageCount: data.pageCount ?? 0 };
  };

  private loadBranches = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }));
    const list: any[] = res?.data?.list ?? [];
    return { items: list.map(b => ({ value: b.id, label: b.name })), hasMore: p.page < (res?.data?.pageCount ?? 1) };
  };

  canEdit(r: any): boolean { return this.actions.canEdit(r); }
  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/bills-payment', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/bills-payment/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/bills-payment', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true, drawerWidth: '480px', drawerResizable: true,
      data: { sourceTable: 'BillingPayments', title: this.lang.instant('BILLS_PAYMENT.LIST.PAYMENTS_LIST') },
    });
  }
}
