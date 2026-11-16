import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import '../../company-group-employees-i18n';
import { CompanyGroupEmployeesService } from '../../services/company-group-employees.service';

import { TooltipDirective } from '@shared/directives/tooltip.directive';
/**
 * Company group employees -> list (`/company-group-employees`): every employee of the company group with the
 * companies of the group they can work in. Read-only; search by name / email, sort, paging.
 */
@Component({
  selector: 'app-company-group-employees-list',
  standalone: true,
  imports: [TooltipDirective, CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective],
  templateUrl: './company-group-employees-list.component.html',
})
export class CompanyGroupEmployeesListComponent implements OnInit {
  private service = inject(CompanyGroupEmployeesService);
  private lang = inject(LanguageService);

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'users' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('company-group-employees');
    const t = (k: string) => this.lang.instant('COMPANY_GROUP_EMPLOYEES.' + k);
    this.columns = [
      { key: 'name', label: t('COL_EMPLOYEE'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'companyList', label: t('COL_COMPANIES'), customTemplate: true, visible: true, order: 1 },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/company-group-employees' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'users' };
  }

  load = async (params: ListQueryParams) => {
    try {
      const data = await this.service.getList({
        page: params.page,
        limit: params.limit,
        searchTerm: params.searchTerm || '',
        sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
      });
      this.emptyState = { title: this.lang.instant('COMPANY_GROUP_EMPLOYEES.EMPTY'), message: '', icon: 'users' };
      return { list: data.list, count: data.count, pageCount: data.pageCount };
    } catch (e: any) {
      // Typically "only super admin has access": shown through the list's illustrated (error) empty state.
      this.emptyState = {
        title: this.lang.instant('COMPANY_GROUP_EMPLOYEES.ERROR'),
        message: e?.error?.msg ?? e?.message ?? this.lang.instant('COMPANY_GROUP_EMPLOYEES.ERROR_HINT'),
        icon: 'error',
      };
      return { list: [], count: 0, pageCount: 1 };
    }
  };
}
