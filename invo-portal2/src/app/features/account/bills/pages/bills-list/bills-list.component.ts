import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { statusClass } from '@shared/utils/status-tone';
import { BillsService } from '../../services/bills.service';
import { BillActions } from '../../services/bill-actions';

/**
 * Bills -> list. Legacy `BillsComponent`: same columns, server-side search / sort / paging and the same
 * filter payload (status, branches, dates). Row actions follow the shared {@link BillActions} rules:
 * View + Edit + Pay outside, the rest in the "⋯" menu.
 */
@Component({
  selector: 'app-bills-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
  templateUrl: './bills-list.component.html',
})
export class BillsListComponent extends DocumentListBase implements OnInit {
  private service = inject(BillsService);
  readonly actions = inject(BillActions);

  readonly meta: DocListMeta = {
    features: ['account/bills'],
    logsSource: 'Billings',
    sheet: 'Bills',
    filePrefix: 'bills',
    dateKeys: ['billingDate', 'dueDate', 'createdAt'],
    hasStatus: true,
    listTitleKey: 'BILLS.LIST.BILLS_LIST',
    dashboardCrumbKey: 'BILLS.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getBillingList(body);

  async ngOnInit(): Promise<void> {
    await this.initBase();
    await this.actions.refresh();
    const t = this.t;
    const L = 'BILLS.LIST.';

    this.columns = [
      { key: 'billingNumber', label: t(L + 'BILL_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'supplierName', label: t(L + 'SUPPLIER_NAME'), sortable: true, visible: true, order: 1 },
      { key: 'purchaseNumber', label: t(L + 'PURCHASE_NUMBER'), customTemplate: true, visible: true, order: 2 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, sortable: true, align: 'end', visible: true, order: 3 },
      { key: 'status', label: t(L + 'STATUS'), customTemplate: true, visible: true, order: 4 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 5 },
      { key: 'billingDate', label: t(L + 'BILL_DATE'), customTemplate: true, sortable: true, visible: true, order: 6 },
      { key: 'dueDate', label: t(L + 'DUE_DATE'), customTemplate: true, visible: true, order: 7 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), visible: false, order: 8 },
      { key: 'createdAt', label: t('BILLS.CREATED_DATE'), customTemplate: true, visible: false, order: 9 },
    ];

    this.filters = [
      {
        type: 'checkbox-group', key: 'status', label: t('BILLS.FILTERS.STATUS'),
        options: ['Draft', 'Open', 'Partially Paid', 'Paid', 'Overdue', 'Closed'].map(v => ({ value: v, label: t('BILLS.STATUS.' + v) })),
      },
      { type: 'dropdown', key: 'branches', label: t('BILLS.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('BILLS.FILTERS.DATE') },
    ];

    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('BILLS.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('BILLS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('BILLS.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  statusClass = statusClass;
  statusLabel(status: string): string { return this.lang.instant('BILLS.STATUS.' + status); }

  rowMenu(r: any): DropdownMenuBtnItem[] {
    // Pay lives in the menu (first), so only View and Edit sit outside it.
    const pay: DropdownMenuBtnItem[] = this.actions.pay(r)
      ? [{ label: this.lang.instant('BILLS.LIST.PAY'), click: () => this.pay(r) }]
      : [];
    return [...pay, ...this.actions.menu(r, r.id, () => this.listPage?.refresh?.())];
  }

  add(): void { void this.router.navigate(['/account/bills', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/bills/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/bills', r.id]); }
  pay(r: any): void { this.actions.goPay(r.id); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
