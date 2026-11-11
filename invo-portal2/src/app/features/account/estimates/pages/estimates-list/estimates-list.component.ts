import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { downloadPdf } from '@core/utils/pdf-download';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';
import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { DocBoardViewComponent } from '../../../components/doc-board-view/doc-board-view.component';
import { DocCalendarViewComponent } from '../../../components/doc-calendar-view/doc-calendar-view.component';
import { DocViewAdapter } from '../../../components/doc-views/doc-views.types';
import { EstimatesService } from '../../services/estimates.service';
import { EstimateActions } from '../../services/estimate-actions';

/**
 * Estimates → list. Legacy `EstimateComponent`: same columns, server-side search / sort / paging
 * and the same filter payload (`sources`, `branches`, dates, sales employee, product). Row actions
 * follow the shared {@link EstimateActions} rules: View + Edit outside, the rest in the "⋯" menu.
 */
@Component({
  selector: 'app-estimates-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe, DocBoardViewComponent, DocCalendarViewComponent],
  templateUrl: './estimates-list.component.html',
})
export class EstimatesListComponent extends DocumentListBase implements OnInit {
  private service = inject(EstimatesService);
  readonly actions = inject(EstimateActions);

  readonly meta: DocListMeta = {
    features: ['account/estimates'],
    logsSource: 'Estimates',
    sheet: 'Estimates',
    filePrefix: 'estimates',
    dateKeys: ['estimateDate', 'estimateExpDate', 'createdAt'],
    hasStatus: true,
    listTitleKey: 'ESTIMATES.LIST.ESTIMATES_LIST',
    dashboardCrumbKey: 'ESTIMATES.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getEstimateList(body);

  async ngOnInit(): Promise<void> {
    await this.initBase();
    const t = this.t;
    const L = 'ESTIMATES.LIST.';

    this.columns = [
      { key: 'estimateNumber', label: t(L + 'ESTIMATE_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), sortable: true, visible: true, order: 1 },
      { key: 'customerName', label: t(L + 'CUSTOMER_NAME'), visible: true, order: 2 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, align: 'end', visible: true, order: 3 },
      { key: 'invoiceNumber', label: t(L + 'INVOICE_NUMBER'), customTemplate: true, visible: true, order: 4 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 5 },
      { key: 'estimateDate', label: t(L + 'ISSUE_DATE'), customTemplate: true, visible: true, order: 6 },
      { key: 'estimateExpDate', label: t(L + 'EXPIRY_DATE'), customTemplate: true, visible: true, order: 7 },
      { key: 'createdAt', label: t('ESTIMATES.CREATED_DATE'), customTemplate: true, visible: false, order: 8 },
    ];

    this.filters = [
      { type: 'checkbox-group', key: 'status', label: t('ESTIMATES.FILTERS.STATUS'), options: ['Open', 'Converted'].map(v => ({ value: v, label: t('ESTIMATES.STATUS.' + v) })) },
      { type: 'checkbox-group', key: 'sources', label: t('ESTIMATES.FILTERS.SOURCE'), options: ['POS', 'Cloud'].map(v => ({ value: v, label: v })) },
      { type: 'dropdown', key: 'branches', label: t('ESTIMATES.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'dropdown', key: 'salesEmployeeId', label: t('ESTIMATES.FILTERS.EMPLOYEE'), loadFn: p => this.loadEmployees(p) },
      { type: 'dropdown', key: 'productId', label: t('ESTIMATES.FILTERS.PRODUCT'), loadFn: p => this.loadProducts(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('ESTIMATES.FILTERS.DATE') },
    ];

    this.bulkActions = [
      { id: 'merged-pdf', label: t('ESTIMATES.ACTIONS.EXPORT_MERGED_PDF'), requiresSelection: true, handler: (rows: any[]) => this.exportMergedPdf(rows) },
      { id: 'send-email', label: t('ESTIMATES.ACTIONS.SEND_EMAIL'), requiresSelection: true, handler: (rows: any[]) => void this.sendBulkEmail(rows) },
    ];
    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('ESTIMATES.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('ESTIMATES.SEARCH_PLACEHOLDER');
    // Legacy: a search with no date filter looks at the last 3 months only (shown as a removable filter).
    this.searchConfig.defaultDateRange = { keyFrom: 'fromDate', keyTo: 'toDate' };
    this.emptyState = { title: t('ESTIMATES.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  /**
   * How the board / calendar present and act on an estimate (same rules as the table).
   * An estimate has no status column: it is Converted once an invoice references it, else Open.
   */
  readonly viewAdapter: DocViewAdapter = {
    numberKey: 'estimateNumber',
    refKey: 'refrenceNumber',
    partyKey: 'customerName',
    dateKey: 'estimateDate',
    dueKey: 'estimateExpDate',
    dueLabelKey: 'ESTIMATES.LIST.EXPIRY_DATE',
    settledStatuses: ['Converted'],
    columns: [
      { id: 'open',      labelKey: 'ESTIMATES.STATUS.Open',      statuses: ['Open'],      tone: 'bg-emerald-500' },
      { id: 'converted', labelKey: 'ESTIMATES.STATUS.Converted', statuses: ['Converted'], tone: 'bg-indigo-500' },
    ],
    statusOf: r => (r.invoiceId ? 'Converted' : 'Open'),
    statusLabel: s => this.lang.instant('ESTIMATES.STATUS.' + s),
    statusClass: s => (s === 'Converted' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'),
    chips: r => (r.invoiceNumber ? [{ text: r.invoiceNumber, classes: 'bg-slate-100 text-slate-700' }] : []),
    view: r => this.view(r),
    edit: r => this.edit(r),
    canEdit: r => this.actions.edit(r),
    menu: (r, after) => this.rowMenu(r, after),
  };

  /** Secondary row actions live in the "⋯" menu (View + Edit stay outside). */
  rowMenu(r: any, after: () => void = () => this.listPage?.refresh?.()): DropdownMenuBtnItem[] {
    return this.actions.menu(r, r.id, after);
  }

  add(): void { void this.router.navigate(['/account/estimate', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/estimate/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/estimate', r.id]); }
  openInvoice(r: any): void {
    if (r.invoiceId) void this.router.navigate(['/account/invoices/view', r.invoiceId]);
  }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  // ── bulk ───────────────────────────────────────────────────────────
  async exportMergedPdf(rows: any[]): Promise<void> {
    if (!rows.length) return;
    const res = await this.service.viewMergedEstimatesPdf(rows.map(r => r.id));
    if (res) downloadPdf(res, 'estimates.pdf');
    else this.toast.error('COMMON.OPS', '');
  }

  /** One email request for the selected estimates (recipient typed manually — they may span customers). */
  async sendBulkEmail(rows: any[]): Promise<void> {
    if (!rows.length) return;
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: { emails: [], sendEmail: payload => this.service.sendEstimateEmail({ ...payload, estimateIds: rows.map(r => r.id) }) },
    }).afterClosed();
  }
}
