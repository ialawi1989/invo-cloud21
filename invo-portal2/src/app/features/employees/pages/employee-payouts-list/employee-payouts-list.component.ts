import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import { EmployeePayoutService } from '../../services/employee-payout.service';
import { EmployeeService } from '../../services/employee.service';

/** Employee payouts list (`/employees/payouts`), optionally filtered by employee. */
@Component({
  selector: 'app-employee-payouts-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, MycurrencyPipe],
  templateUrl: './employee-payouts-list.component.html',
})
export class EmployeePayoutsListComponent implements OnInit {
  private service   = inject(EmployeePayoutService);
  private employees = inject(EmployeeService);
  private router    = inject(Router);
  private lang      = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('employeePayoutSecurity.actions.add.access');

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  paginationConfig = { enabled: true, pageLimits: [25, 50, 100], default: 25 };
  searchConfig     = { enabled: false, placeholder: '', debounceMs: 400 };
  sortingConfig    = { enabled: false };
  emptyState       = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('employees');
    const t = (k: string) => this.lang.instant(k);
    const L = 'EMPLOYEE_PAYOUT.';

    this.columns = [
      { key: 'paymentDate', label: t(L + 'PAYMENT_DATE'), primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'employeeName', label: t(L + 'EMPLOYEE'), noApi: true, visible: true, order: 1 },
      { key: 'reference', label: t(L + 'REFERENCE'), noApi: true, visible: true, order: 2 },
      { key: 'paymentAccountName', label: t(L + 'PAYMENT_ACCOUNT'), noApi: true, visible: true, order: 3 },
      { key: 'amount', label: t(L + 'AMOUNT'), customTemplate: true, align: 'end', noApi: true, visible: true, order: 4 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'employeeId', label: t(L + 'EMPLOYEE'), placeholder: t(L + 'ALL_EMPLOYEES'), loadFn: p => this.loadEmployees(p) },
    ];

    this.emptyState = { title: t(L + 'NO_PAYOUTS'), message: '' };
    this.breadcrumbs = [
      { label: t('MENU.EMPLOYEES'), routerLink: '/employees' },
      { label: t('MENU.SUB.EMPLOYEE_PAYOUTS') },
    ];
  }

  loadPayouts = async (params: ListQueryParams) => {
    const employeeId = params.filter?.['employeeId'];
    const res = await this.service.getEmployeePayoutsList({
      filter: employeeId ? { employeeId: Array.isArray(employeeId) ? employeeId[0] : employeeId } : {},
      page: params.page,
      limit: params.limit,
    });
    const data = res?.data;
    return { list: data?.list ?? [], count: data?.count ?? 0, pageCount: data?.pageCount ?? 1 };
  };

  private loadEmployees = async (p: { page: number; pageSize: number; search: string }) => {
    const r = await this.employees.searchEmployees({ page: p.page, limit: p.pageSize, searchTerm: p.search });
    return { items: r.items.map(e => ({ value: e.id, label: e.name })), hasMore: r.hasMore };
  };

  add(): void { void this.router.navigate(['/employees/payouts', 0]); }
  open(row: any): void { void this.router.navigate(['/employees/payouts/view', row.id]); }
  onRowClick(e: any): void { if (e?.row) this.open(e.row); }
}
