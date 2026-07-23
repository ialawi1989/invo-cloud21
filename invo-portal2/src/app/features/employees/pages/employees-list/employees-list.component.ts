import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
} from '@shared/components/list-page/interfaces/list-page.types';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeSummary } from '../../models/employee.types';

/**
 * Employees list — shared `<app-list-page>`.
 * Search / paging / sort / URL-sync handled by the list-page; this component
 * only supplies the column config, the data source, and the row/header
 * actions. Invited users route to the invitation form on edit.
 */
@Component({
  selector: 'app-employees-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
  ],
  templateUrl: './employees-list.component.html',
  styleUrl: './employees-list.component.scss',
})
export class EmployeesListComponent implements OnInit {
  private service    = inject(EmployeeService);
  private router     = inject(Router);
  private lang       = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd    = this.privileges.check('employeeSecurity.actions.add.access');
  readonly canInvite = this.privileges.check('employeeInvitationSecurity.actions.add.access');

  columns: TableColumn[] = [];

  paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  searchConfig     = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig    = { enabled: true };
  emptyState       = { title: '', message: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('employees');
    this.initTranslations();
  }

  private initTranslations(): void {
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'name',  label: t('EMPLOYEES.LIST.NAME'),  sortable: true, primary: true, locked: true, interactive: true, customTemplate: true, visible: true, order: 0 },
      { key: 'email', label: t('EMPLOYEES.LIST.EMAIL'), sortable: true, visible: true, order: 1 },
      { key: 'superAdmin', label: t('EMPLOYEES.LIST.SUPER_ADMIN'), noApi: true, sortable: false, customTemplate: true, align: 'center', visible: true, order: 2 },
      { key: 'admin',      label: t('EMPLOYEES.LIST.CLOUD_ADMIN'), noApi: true, sortable: false, customTemplate: true, align: 'center', visible: true, order: 3 },
      { key: 'user',       label: t('EMPLOYEES.LIST.POS_USER'),    noApi: true, sortable: false, customTemplate: true, align: 'center', visible: true, order: 4 },
    ];
    this.searchConfig.placeholder = t('EMPLOYEES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EMPLOYEES.EMPTY'), message: '' };
  }

  loadEmployees = async (params: ListQueryParams) => {
    const res = await this.service.getList({
      page:       params.page,
      limit:      params.limit,
      searchTerm: params.searchTerm || '',
      sortBy:     params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  initial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: EmployeeSummary): void {
    void this.router.navigate(
      row.isInvitedUser ? ['/employees/invitation', row.id] : ['/employees', row.id],
    );
  }

  add(): void {
    void this.router.navigate(['/employees', 0]);
  }

  invite(): void {
    void this.router.navigate(['/employees/invitation', 0]);
  }
}
