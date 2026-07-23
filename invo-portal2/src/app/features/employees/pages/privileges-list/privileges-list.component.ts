import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeePrivilege } from '@core/auth/privileges/models/privilege.model';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
} from '@shared/components/list-page/interfaces/list-page.types';

/**
 * Privileges list — shared `<app-list-page>`. Reusable permission-set records
 * (reuses the core {@link PrivilegeService} CRUD). Search / paging / sort /
 * URL-sync are handled by the list-page.
 */
@Component({
  selector: 'app-privileges-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
  ],
  templateUrl: './privileges-list.component.html',
  styleUrl: './privileges-list.component.scss',
})
export class PrivilegesListComponent implements OnInit {
  private service    = inject(PrivilegeService);
  private router     = inject(Router);
  private lang       = inject(LanguageService);

  readonly canAdd = this.service.check('privilegeSecurity.actions.add.access');

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: '', routerLink: '/employees' },
    { label: '', routerLink: '/employees/privileges' },
  ];

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
      { key: 'name',        label: t('EMPLOYEES.PRIVILEGES.NAME'),        sortable: true, primary: true, interactive: true, customTemplate: true, visible: true, order: 0 },
      { key: 'description', label: t('EMPLOYEES.PRIVILEGES.DESCRIPTION'), noApi: true, sortable: false, visible: true, order: 1 },
    ];
    this.breadcrumbs = [
      { label: t('EMPLOYEES.TITLE'),            routerLink: '/employees' },
      { label: t('EMPLOYEES.PRIVILEGES.TITLE'), routerLink: '/employees/privileges' },
    ];
    this.searchConfig.placeholder = t('EMPLOYEES.PRIVILEGES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EMPLOYEES.PRIVILEGES.EMPTY'), message: '' };
  }

  loadPrivileges = async (params: ListQueryParams) => {
    const res = await this.service.getPrivilegeList({
      page:       params.page,
      limit:      params.limit,
      searchTerm: params.searchTerm || '',
      sortBy:     params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    const list  = Array.isArray(res) ? res : res.list;
    const count = Array.isArray(res) ? res.length : res.count;
    return { list, count, pageCount: Math.max(1, Math.ceil(count / params.limit)) };
  };

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: EmployeePrivilege): void {
    void this.router.navigate(['/employees/privileges', row.id]);
  }

  add(): void {
    void this.router.navigate(['/employees/privileges', 0]);
  }
}
