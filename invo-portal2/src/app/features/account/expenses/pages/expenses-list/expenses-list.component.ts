import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocumentListBase, DocListMeta } from '../../../services/document-list-base';
import { ExpensesService } from '../../services/expenses.service';
import { ExpenseActions } from '../../services/expense-actions';

/**
 * Expenses -> list. Legacy `ExpenseComponent`: same columns, server-side search / sort / paging and the same
 * filter payload (branches, dates). Row actions follow the shared {@link ExpenseActions} rules: View + Edit outside,
 * Clone / Delete in the "⋯" menu - none of them for a reconciled expense.
 */
@Component({
  selector: 'app-expenses-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe],
  templateUrl: './expenses-list.component.html',
})
export class ExpensesListComponent extends DocumentListBase implements OnInit {
  private service = inject(ExpensesService);
  readonly actions = inject(ExpenseActions);

  readonly meta: DocListMeta = {
    features: ['account/expenses'],
    logsSource: 'Expenses',
    sheet: 'Expenses',
    filePrefix: 'expenses',
    dateKeys: ['expenseDate', 'createdAt'],
    hasStatus: false,
    listTitleKey: 'EXPENSES.LIST.EXPENSE_LIST',
    dashboardCrumbKey: 'EXPENSES.DASHBOARD',
  };

  protected fetch = (body: any) => this.service.getExpenseList(body);

  async ngOnInit(): Promise<void> {
    await this.initBase();
    await this.actions.refresh();
    const t = this.t;
    const L = 'EXPENSES.LIST.';

    this.columns = [
      { key: 'expenseNumber', label: t(L + 'EXPENSE_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'expenseDate', label: t(L + 'EXPENSE_DATE'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'supplierName', label: t(L + 'SUPPLIER_NAME'), visible: true, order: 2 },
      { key: 'customerName', label: t(L + 'CUSTOMER_NAME'), visible: true, order: 3 },
      { key: 'total', label: t(L + 'TOTAL'), customTemplate: true, sortable: true, align: 'end', visible: true, order: 4 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), visible: true, order: 5 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE_NAME'), visible: true, order: 6 },
      { key: 'createdAt', label: t('EXPENSES.CREATED_DATE'), customTemplate: true, visible: false, order: 7 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'branches', label: t('EXPENSES.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('EXPENSES.FILTERS.DATE') },
    ];

    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      { label: t('EXPENSES.ACTIONS.EXPORT_EXCEL'), click: () => void this.exportExcel(), disabled: false, danger: false },
    ];

    this.searchConfig.placeholder = t('EXPENSES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EXPENSES.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t(this.meta.dashboardCrumbKey), routerLink: '/dashboard' },
      { label: t(this.meta.listTitleKey) },
    ];
  }

  rowMenu(r: any): DropdownMenuBtnItem[] { return this.actions.menu(r, r.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/expense', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/expense/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/expense', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
