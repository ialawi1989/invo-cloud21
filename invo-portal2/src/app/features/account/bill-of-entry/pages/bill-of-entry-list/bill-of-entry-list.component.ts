import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { BillOfEntryService } from '../../services/bill-of-entry.service';
import { BillOfEntryActions } from '../../services/bill-of-entry-actions';

/**
 * Bill of entry -> list. Legacy `BillOfEntryComponent`: same columns, server-side search / sort / paging
 * and the same filter payload (branches, dates). Row actions follow the shared {@link BillOfEntryActions} rules.
 */
@Component({
  selector: 'app-bill-of-entry-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
  templateUrl: './bill-of-entry-list.component.html',
})
export class BillOfEntryListComponent extends DocumentListBase implements OnInit {
  private service = inject(BillOfEntryService);
  readonly actions = inject(BillOfEntryActions);

  readonly meta: DocListMeta = {
    features: ['account/bill-of-entry'],
    logsSource: 'BillOfEntries',
    sheet: 'Bill of Entry',
    filePrefix: 'bill-of-entry',
    dateKeys: ['billingOfEntryDate', 'createdAt'],
    hasStatus: false,
    listTitleKey: 'BILL_OF_ENTRY.LIST.BILL_OF_ENTRY_LIST',
    dashboardCrumbKey: 'BILL_OF_ENTRY.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getBillOfEntryList(body);

  async ngOnInit(): Promise<void> {
    await this.initBase();
    await this.actions.refresh();
    const t = this.t;
    const L = 'BILL_OF_ENTRY.LIST.';

    this.columns = [
      { key: 'billingOfEnrtyNumber', label: t(L + 'NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'billingNumber', label: t(L + 'BILL_NUMBER'), visible: true, order: 1 },
      { key: 'supplierName', label: t(L + 'SUPPLIER_NAME'), visible: true, order: 2 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, sortable: true, align: 'end', visible: true, order: 3 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 4 },
      { key: 'billingOfEntryDate', label: t(L + 'DATE'), customTemplate: true, sortable: true, visible: true, order: 5 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), visible: true, order: 6 },
      { key: 'createdAt', label: t('BILL_OF_ENTRY.CREATED_DATE'), customTemplate: true, visible: false, order: 7 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'branches', label: t('BILL_OF_ENTRY.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('BILL_OF_ENTRY.FILTERS.DATE') },
    ];

    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('BILL_OF_ENTRY.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('BILL_OF_ENTRY.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('BILL_OF_ENTRY.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/bill-of-entry', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/bill-of-entry/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/bill-of-entry', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
