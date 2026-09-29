import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { EstimatesService } from '../../services/estimates.service';
import { EstimateActions } from '../../services/estimate-actions';

/**
 * Estimates → list. Legacy `EstimateComponent`: same columns, server-side search / sort / paging
 * and the same filter payload (`sources`, `branches`, dates, sales employee, product). Row actions
 * follow the shared {@link EstimateActions} rules: View + Edit outside, Convert / Delete in the "⋯" menu.
 */
@Component({
  selector: 'app-estimates-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
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
    hasStatus: false,
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
      { type: 'checkbox-group', key: 'sources', label: t('ESTIMATES.FILTERS.SOURCE'), options: ['POS', 'Cloud'].map(v => ({ value: v, label: v })) },
      { type: 'dropdown', key: 'branches', label: t('ESTIMATES.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'dropdown', key: 'salesEmployeeId', label: t('ESTIMATES.FILTERS.EMPLOYEE'), loadFn: p => this.loadEmployees(p) },
      { type: 'dropdown', key: 'productId', label: t('ESTIMATES.FILTERS.PRODUCT'), loadFn: p => this.loadProducts(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('ESTIMATES.FILTERS.DATE') },
    ];

    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('ESTIMATES.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('ESTIMATES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('ESTIMATES.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  /** Secondary row actions live in the "⋯" menu (View + Edit stay outside). */
  rowMenu(r: any): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.actions.convert(r)) items.push({ label: this.t('ESTIMATES.ACTIONS.CONVERT_TO_INVOICE'), click: () => this.convert(r), disabled: false, danger: false });
    if (this.actions.delete(r)) items.push({ label: this.t('ESTIMATES.ACTIONS.DELETE'), click: () => void this.remove(r), disabled: false, danger: true });
    return items;
  }

  add(): void { void this.router.navigate(['/account/estimate', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/estimate/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/estimate', r.id]); }
  convert(r: any): void { void this.router.navigate(['/account/invoices/convertFromEstimate', r.id]); }
  openInvoice(r: any): void {
    if (r.invoiceId) void this.router.navigate(['/account/invoices/view', r.invoiceId]);
  }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  async remove(r: any): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.t('ESTIMATES.ACTIONS.DELETE'), message: this.t('ESTIMATES.ACTIONS.CONFIRM_DELETE'), danger: true },
    }).afterClosed();
    if (!ok) return;
    try {
      await this.service.deleteEstimate(r.id);
      this.toast.success('COMMON.SAVED_OK');
      this.listPage?.refresh?.();
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }
}
