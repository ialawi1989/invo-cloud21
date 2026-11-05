import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
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
import { FilterConfig, ListQueryParams, SearchConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';

import { PaymentsService } from '../../services/payments.service';
import { PaymentActions } from '../../services/payment-actions';
import { GatewayCheckModalComponent, GatewayCheckData } from '../../components/gateway-check-modal/gateway-check-modal.component';

type PaymentsTab = 'success' | 'failed';

/** `tab` — which list is shown; omitted for the default (successful) one, like legacy's `?tab=failed`. */
const TAB_PARAM: ParamDef<PaymentsTab> = {
  key: 'tab',
  codec: { encode: v => (v === 'failed' ? 'failed' : null), decode: r => (r === 'failed' ? 'failed' : 'success') },
};

const ymd = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const arr = (v: any): any[] => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * Payments → list (`/account/payments`). Legacy `PaymentsComponent`: same columns, server-side
 * search / sort / paging and the same filter payload (`sources`, `branches`, dates). Editing is
 * hidden for reconciled payments and for users without the add privilege. A second tab lists the failed
 * online payments, each with a "check with the gateway" action (no view / edit — a failed payment has no record to open).
 */
@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe, SegmentedToggleComponent,
  ],
  templateUrl: './payments-list.component.html',
})
export class PaymentsListComponent implements OnInit {
  private service = inject(PaymentsService);
  private api = inject(ApiService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  private queryParams = inject(QueryParamsService);
  readonly actions = inject(PaymentActions);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('invoicePaymentsSecurity.actions.add.access');

  readonly tab = signal<PaymentsTab>('success');
  tabs: SegmentedToggleOption<PaymentsTab>[] = [];
  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  moreItems: DropdownMenuBtnItem[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig: SearchConfig = { enabled: true, placeholder: '', debounceMs: 400, defaultDateRange: { keyFrom: 'fromDate', keyTo: 'toDate' } };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/payments');
    const t = (k: string) => this.lang.instant(k);
    const L = 'PAYMENTS.LIST.';

    this.tab.set(this.queryParams.read({ tab: TAB_PARAM }).tab);
    this.tabs = [
      { value: 'success', label: t(L + 'SUCCESSFUL_PAYMENTS') },
      { value: 'failed', label: t(L + 'FAILED_PAYMENTS') },
    ];
    this.columns = this.buildColumns();

    this.filters = [
      { type: 'checkbox-group', key: 'sources', label: t('PAYMENTS.FILTERS.SOURCE'), options: ['POS', 'Cloud', 'Online'].map(v => ({ value: v, label: v })) },
      { type: 'dropdown', key: 'branches', label: t('PAYMENTS.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('PAYMENTS.FILTERS.DATE') },
    ];

    this.moreItems = [{ label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false }];
    this.searchConfig.placeholder = t('PAYMENTS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('PAYMENTS.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('PAYMENTS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'PAYMENTS_LIST') },
    ];
  }

  /** The legacy columns, in the legacy order; the invoice number column is the successful list's only (a failed payment never reached an invoice). */
  private buildColumns(): TableColumn[] {
    const t = (k: string) => this.lang.instant(k);
    const L = 'PAYMENTS.COLUMNS.';
    const cols: Omit<TableColumn, 'order'>[] = [
      { key: 'paymentDate', label: t(L + 'DATE'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true },
      { key: 'paymentMethodName', label: t(L + 'PAYMENT_METHOD'), visible: true },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), sortable: true, visible: true },
      { key: 'paidAmount', label: t(L + 'AMOUNT'), sortable: true, customTemplate: true, align: 'end', visible: true },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), sortable: true, visible: true },
      { key: 'customerName', label: t(L + 'CUSTOMER_NAME'), visible: true },
      { key: 'referenceNumber', label: t(L + 'REFERENCE_NUMBER'), visible: true },
      ...(this.tab() === 'success' ? [{ key: 'invoicesNumber', label: t(L + 'INVOICE_NUMBER'), customTemplate: true, visible: true }] : []),
    ];
    return cols.map((c, order) => ({ ...c, order }));
  }

  selectTab(tab: PaymentsTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.queryParams.writeOne(TAB_PARAM, tab);
    this.columns = this.buildColumns();
    queueMicrotask(() => this.listPage?.refresh?.());
  }

  /** Legacy `checkWithGateway`: ask the gateway what it knows about this failed payment. */
  checkWithGateway(r: any): void {
    this.modal.open<GatewayCheckModalComponent, GatewayCheckData, void>(GatewayCheckModalComponent, {
      size: 'lg', data: { referenceNumber: r.referenceNumber },
    });
  }

  loadPayments = async (params: ListQueryParams) => {
    const f = params.filter ?? {};
    const body: any = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
      filter: { sources: arr(f['sources']), branches: arr(f['branches']), fromDate: ymd(f['fromDate']), toDate: ymd(f['toDate']) },
    };
    const data = this.tab() === 'failed' ? await this.service.getFailedInvoicePaymentsList(body) : await this.service.getInvoicePaymentsList(body);
    return { list: data.list, count: data.count ?? 0, pageCount: data.pageCount ?? 0 };
  };

  private loadBranches = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }));
    const list: any[] = res?.data?.list ?? [];
    return { items: list.map(b => ({ value: b.id, label: b.name })), hasMore: p.page < (res?.data?.pageCount ?? 1) };
  };

  invoices(row: any): string {
    const v = row?.invoicesNumber;
    return Array.isArray(v) ? v.join(', ') : (v ?? '');
  }

  canEdit(r: any): boolean { return this.actions.canEdit(r); }
  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/payments', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/payments/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/payments', r.id]); }
  onRowClick(e: any): void { if (e?.row && this.tab() === 'success') this.view(e.row); }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true, drawerWidth: '480px', drawerResizable: true,
      data: { sourceTable: 'InvoicePayments', title: this.lang.instant('PAYMENTS.LIST.PAYMENTS_LIST') },
    });
  }
}
