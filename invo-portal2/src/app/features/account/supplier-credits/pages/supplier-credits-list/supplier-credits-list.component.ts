import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { SupplierCreditsService } from '../../services/supplier-credits.service';
import { SupplierCreditActions } from '../../services/supplier-credit-actions';

/**
 * Supplier credits -> list. Legacy `SupplierCreditComponent`: same columns, server-side search / sort / paging
 * and the same filter payload (branches, dates). Row actions follow the shared {@link SupplierCreditActions} rules.
 */
@Component({
  selector: 'app-supplier-credits-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
  templateUrl: './supplier-credits-list.component.html',
})
export class SupplierCreditsListComponent extends DocumentListBase implements OnInit {
  private service = inject(SupplierCreditsService);
  readonly actions = inject(SupplierCreditActions);

  readonly meta: DocListMeta = {
    features: ['account/supplier-credit'],
    logsSource: 'SupplierCredits',
    sheet: 'Supplier Credits',
    filePrefix: 'supplier-credits',
    dateKeys: ['supplierCreditDate', 'createdAt'],
    hasStatus: false,
    listTitleKey: 'SUPPLIER_CREDITS.LIST.CREDITS_LIST',
    dashboardCrumbKey: 'SUPPLIER_CREDITS.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getCreditList(body);

  async ngOnInit(): Promise<void> {
    await this.initBase();
    await this.actions.refresh();
    const t = this.t;
    const L = 'SUPPLIER_CREDITS.LIST.';

    this.columns = [
      { key: 'supplierCreditNumber', label: t(L + 'CREDIT_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'supplierName', label: t(L + 'SUPPLIER_NAME'), visible: true, order: 1 },
      { key: 'billingNumber', label: t(L + 'BILL_NUMBER'), visible: true, order: 2 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, sortable: true, align: 'end', visible: true, order: 3 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 4 },
      { key: 'supplierCreditDate', label: t(L + 'CREDIT_DATE'), customTemplate: true, sortable: true, visible: true, order: 5 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), visible: true, order: 6 },
      { key: 'createdAt', label: t('SUPPLIER_CREDITS.CREATED_DATE'), customTemplate: true, visible: false, order: 7 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'branches', label: t('SUPPLIER_CREDITS.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('SUPPLIER_CREDITS.FILTERS.DATE') },
    ];

    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('SUPPLIER_CREDITS.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('SUPPLIER_CREDITS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('SUPPLIER_CREDITS.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/supplier-credit', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/supplier-credit/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/supplier-credit', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
