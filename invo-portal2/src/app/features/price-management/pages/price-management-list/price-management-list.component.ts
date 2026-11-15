import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import '../../price-management-i18n';
import { PriceManagementRow } from '../../models/price-management.model';
import { PriceManagementService } from '../../services/price-management.service';

/**
 * Price management -> list (`/price-management`). Legacy `PriceManagementComponent`: title / from / to / repeat /
 * discount / surcharge columns, search (title, discount, surcharge), sort, Edit. Row click opens the form.
 */
@Component({
  selector: 'app-price-management-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  templateUrl: './price-management-list.component.html',
})
export class PriceManagementListComponent implements OnInit {
  private service = inject(PriceManagementService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('priceManagementSecurity.actions.add.access');

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'tag' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('price-management');
    const t = (k: string) => this.lang.instant('PRICE_MANAGEMENT.' + k);
    this.columns = [
      { key: 'title', label: t('COL_TITLE'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'fromDate', label: t('COL_FROM'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'toDate', label: t('COL_TO'), sortable: true, customTemplate: true, visible: true, order: 2 },
      { key: 'repeat', label: t('COL_REPEAT'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'discountName', label: t('COL_DISCOUNT'), sortable: true, visible: true, order: 4 },
      { key: 'chargeName', label: t('COL_SURCHARGE'), sortable: true, visible: true, order: 5 },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/price-management' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'tag' };
  }

  load = async (params: ListQueryParams) => {
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  repeatLabel = (r: PriceManagementRow) => (r.repeat ? this.lang.instant('PRICE_MANAGEMENT.REPEAT_OPTION.' + r.repeat) : '');

  add(): void { void this.router.navigate(['/price-management/new']); }
  edit(r: PriceManagementRow): void { void this.router.navigate(['/price-management', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.edit(e.row); }
}
