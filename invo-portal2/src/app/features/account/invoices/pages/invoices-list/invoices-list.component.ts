import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { LanguageService } from '@core/i18n/language.service';
import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { statusClass } from '@shared/utils/status-tone';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { downloadPdf } from '@core/utils/pdf-download';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  BulkActionConfig, FilterConfig, ListQueryParams, TableColumn,
  SearchConfig,
} from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';

import { CustomerAddress } from '../../../customers/models/customer.model';
import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';
import { InvoicesService } from '../../services/invoices.service';
import { InvoiceActions } from '../../services/invoice-actions';
import { DocBoardViewComponent } from '../../../components/doc-board-view/doc-board-view.component';
import { DocCalendarViewComponent } from '../../../components/doc-calendar-view/doc-calendar-view.component';
import { DocFetch, DocViewAdapter } from '../../../components/doc-views/doc-views.types';
import { DocListQuery, makeDocViewFetch } from '../../../components/doc-views/doc-view-fetch';
import { DOC_EXTRA_VIEW_MODES } from '../../../services/document-list-base';

const ymd = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const arr = (v: any): any[] => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * Invoices → list. Legacy `InvoicesComponent`: same columns, server-side search / sort /
 * paging and the same filter payload (`sources`, `status`, `branches`, dates, sales
 * employee, product). Row actions keep the legacy visibility rules (period lock, status,
 * privileges); the bulk action exports the selection as one merged PDF.
 */
@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe, TooltipDirective,
    DocBoardViewComponent, DocCalendarViewComponent,
  ],
  templateUrl: './invoices-list.component.html',
})
export class InvoicesListComponent implements OnInit {
  private service = inject(InvoicesService);
  private api = inject(ApiService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);

  readonly statusClass = statusClass;

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly actions = inject(InvoiceActions);

  private t = (k: string) => this.lang.instant(k);
  exporting = signal(false);

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  bulkActions: BulkActionConfig[] = [];
  moreItems: DropdownMenuBtnItem[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig: SearchConfig = { enabled: true, placeholder: '', debounceMs: 400, defaultDateRange: { keyFrom: 'fromDate', keyTo: 'toDate' } };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/invoices');
    await this.actions.refresh();
    const t = (k: string) => this.lang.instant(k);
    const L = 'INVOICES.LIST.';

    this.columns = [
      { key: 'invoiceNumber', label: t(L + 'INVOICE_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), sortable: true, visible: true, order: 1 },
      { key: 'customerName', label: t(L + 'CUSTOMER_NAME'), visible: true, order: 2 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, align: 'end', visible: true, order: 3 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 4 },
      { key: 'invoiceDate', label: t(L + 'ISSUE_DATE'), customTemplate: true, visible: true, order: 5 },
      { key: 'dueDate', label: t(L + 'DUE_DATE'), customTemplate: true, visible: true, order: 6 },
      { key: 'createdAt', label: t('INVOICES.CREATED_DATE'), customTemplate: true, visible: true, order: 7 },
      { key: 'status', label: t(L + 'STATUS'), customTemplate: true, visible: true, order: 8 },
      { key: 'onlineData', label: t(L + 'ONLINE_STATUS'), customTemplate: true, visible: true, order: 9 },
      { key: 'customerAddress', label: t(L + 'CUSTOMER_ADDRESS'), customTemplate: true, visible: false, order: 10 },
    ];

    this.filters = [
      {
        type: 'checkbox-group', key: 'status', label: t('INVOICES.FILTERS.STATUS'),
        options: ['Draft', 'Open', 'Closed', 'Paid', 'Partially Paid', 'Void', 'writeOff', 'merged']
          .map(v => ({ value: v, label: t('INVOICES.STATUS.' + v) })),
      },
      {
        type: 'checkbox-group', key: 'sources', label: t('INVOICES.FILTERS.SOURCE'),
        options: ['POS', 'Cloud', 'Online'].map(v => ({ value: v, label: v })),
      },
      { type: 'dropdown', key: 'branches', label: t('INVOICES.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'dropdown', key: 'salesEmployeeId', label: t('INVOICES.FILTERS.EMPLOYEE'), loadFn: p => this.loadEmployees(p) },
      { type: 'dropdown', key: 'productId', label: t('INVOICES.FILTERS.PRODUCT'), loadFn: p => this.loadProducts(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('INVOICES.FILTERS.DATE') },
    ];

    this.bulkActions = [
      { id: 'merged-pdf', label: t('INVOICES.ACTIONS.EXPORT_MERGED_PDF'), requiresSelection: true, handler: (rows: any[]) => this.exportMergedPdf(rows) },
      { id: 'send-email', label: t('INVOICES.ACTIONS.SEND_EMAIL'), requiresSelection: true, handler: (rows: any[]) => void this.sendBulkEmail(rows) },
    ];
    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('INVOICES.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
      { label: t('INVOICES.VIEW.RESET_COLUMN_WIDTH'), click: () => this.listPage?.resetColumnWidths(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('INVOICES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('INVOICES.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('INVOICES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'INVOICES_LIST') },
    ];
  }

  // ── data ───────────────────────────────────────────────────────────
  /** Legacy `getInvoices` filter payload. */
  private buildBody(params: { searchTerm?: string; sortBy?: any; filter?: Record<string, any> }): any {
    const f = params.filter ?? {};
    return {
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
      filter: {
        sources: arr(f['sources']),
        status: arr(f['status']),
        branches: arr(f['branches']),
        fromDate: ymd(f['fromDate']),
        toDate: ymd(f['toDate']),
        salesEmployeeId: f['salesEmployeeId'] || null,
        productId: f['productId'] || null,
      },
    };
  }

  // ── board / calendar views ─────────────────────────────────────────
  /** Active body: the list's table, or one of the extra views projected into it. */
  viewMode = signal<'table' | 'board' | 'calendar'>('table');

  readonly extraViewModes = DOC_EXTRA_VIEW_MODES;

  onViewMode(mode: string): void {
    this.viewMode.set(mode === 'board' || mode === 'calendar' ? mode : 'table');
  }

  /**
   * The list's latest search / sort / filters. The list page re-calls
   * `loadInvoices` whenever any of them change (whatever view is showing), so
   * recording them here is what keeps the board and calendar in step with it.
   */
  readonly query = signal<DocListQuery>({});

  /** Fetch for the board / calendar: the list's query plus per-view overrides. */
  readonly viewFetch: DocFetch = makeDocViewFetch({
    query: () => this.query(),
    buildBody: q => this.buildBody(q),
    fetch: body => this.service.getInvoiceList(body),
  });

  /** How the board / calendar present and act on an invoice (same rules as the table). */
  readonly viewAdapter: DocViewAdapter = {
    numberKey: 'invoiceNumber',
    refKey: 'refrenceNumber',
    partyKey: 'customerName',
    dateKey: 'invoiceDate',
    dueKey: 'dueDate',
    dueLabelKey: 'INVOICES.LIST.DUE_DATE',
    settledStatuses: ['Paid', 'Closed', 'Void', 'writeOff', 'merged', 'Draft'],
    columns: [
      { id: 'draft',   labelKey: 'INVOICES.STATUS.Draft',          statuses: ['Draft'],          tone: 'bg-amber-400' },
      { id: 'open',    labelKey: 'INVOICES.STATUS.Open',           statuses: ['Open'],           tone: 'bg-emerald-500' },
      { id: 'partial', labelKey: 'INVOICES.STATUS.Partially Paid', statuses: ['Partially Paid'], tone: 'bg-indigo-500' },
      { id: 'paid',    labelKey: 'INVOICES.STATUS.Paid',           statuses: ['Paid'],           tone: 'bg-teal-500' },
      { id: 'closed',  labelKey: 'INVOICES.STATUS.Closed',         statuses: ['Closed'],         tone: 'bg-slate-400' },
      { id: 'other',   labelKey: 'INVOICES.BOARD.VOID_OTHER',      statuses: ['Void', 'writeOff', 'merged'], tone: 'bg-red-400' },
    ],
    statusLabel: s => this.lang.instant('INVOICES.STATUS.' + s),
    statusClass,
    chips: r => r.onlineData?.onlineStatus
      ? [{ text: r.onlineData.onlineStatus, classes: 'bg-sky-50 text-sky-700' }]
      : [],
    view: r => this.view(r),
    edit: r => this.edit(r),
    canEdit: r => this.actions.edit(r),
    editBlockedReason: r => this.actions.editBlockedReason(r),
    menu: (r, after) => this.rowMenu(r, after),
  };

  loadInvoices = async (params: ListQueryParams) => {
    this.query.set({ searchTerm: params.searchTerm, sortBy: params.sortBy, filter: params.filter });
    const body: any = { page: params.page, limit: params.limit, ...this.buildBody(params) };
    if (params.columns?.length) body.columns = params.columns;
    const data = await this.service.getInvoiceList(body);
    return { list: data?.list ?? [], count: data?.count ?? 0, pageCount: data?.pageCount ?? 0 };
  };

  private async paged(endpoint: string, body: any, map: (r: any) => { value: any; label: string }, page: number) {
    const res = await this.api.request<any>(this.api.post(endpoint, body));
    const list: any[] = res?.data?.list ?? [];
    return { items: list.map(map), hasMore: page < (res?.data?.pageCount ?? 1) };
  }

  private loadBranches = (p: { page: number; pageSize: number; search: string }) =>
    this.paged('branch/getBranches/', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }, b => ({ value: b.id, label: b.name }), p.page);

  private loadEmployees = (p: { page: number; pageSize: number; search: string }) =>
    this.paged('employee/getEmployeeList', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }, e => ({ value: e.id, label: e.name }), p.page);

  private loadProducts = (p: { page: number; pageSize: number; search: string }) =>
    this.paged('product/getProductsListByType', { page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} }, x => ({ value: x.id, label: x.name }), p.page);

  /** Secondary row actions live in the "⋯" menu so the Actions column stays narrow (View + Edit stay outside). */
  rowMenu(r: any, after: () => void = () => this.listPage?.refresh?.()): DropdownMenuBtnItem[] {
    // Pay lives here too, first in the list, so only View and Edit sit outside.
    const pay: DropdownMenuBtnItem[] = this.actions.pay(r)
      ? [{ label: this.lang.instant('INVOICES.LIST.PAY'), click: () => this.actions.goPay(r.id) }]
      : [];
    return [...pay, ...this.actions.menu(r, r.id, after)];
  }

  // ── navigation / actions ───────────────────────────────────────────
  add(): void { void this.router.navigate(['/account/invoices', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/invoices/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/invoices', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  // ── bulk / export ──────────────────────────────────────────────────
  async exportMergedPdf(rows: any[]): Promise<void> {
    if (!rows.length) return;
    const res = await this.service.viewMergedInvoicesPdf(rows.map(r => r.id));
    if (res) downloadPdf(res, 'invoices.pdf');
    else this.toast.error('COMMON.OPS', '');
  }

  /** One email request for the selected invoices (recipient typed manually — they may span customers). */
  async sendBulkEmail(rows: any[]): Promise<void> {
    if (!rows.length) return;
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: { emails: [], sendEmail: payload => this.service.sendInvoiceEmail({ ...payload, invoiceIds: rows.map(r => r.id) }) },
    }).afterClosed();
  }

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
      const data = await this.service.getInvoiceList(body);
      const rows = (data?.list ?? []).map((row: any) => {
        const out: Record<string, any> = {};
        visible.forEach(c => (out[c.label] = this.exportValue(c.key, row)));
        return out;
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Invoices');
      XLSX.writeFile(wb, `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportValue(key: string, row: any): string {
    const raw = row?.[key];
    if (raw == null) return '';
    if (key === 'onlineData') return raw?.onlineStatus ?? '';
    if (key === 'customerAddress') return this.address(raw);
    if (['invoiceDate', 'dueDate', 'createdAt'].includes(key)) return String(raw).slice(0, 10);
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
      data: { sourceTable: 'Invoices', title: this.lang.instant('INVOICES.LIST.INVOICES_LIST') },
    });
  }
}
