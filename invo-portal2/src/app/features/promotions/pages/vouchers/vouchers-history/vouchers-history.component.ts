import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import { TableColumn, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';

import { translate } from '../../../models/common.model';
import { PageInfo, SortInfo } from '../../../services/promotions-api.service';
import { VouchersService } from '../../../services/vouchers.service';

/** Gift vouchers → log of settings changes (legacy `VouchersHistoryComponent`, as a page). */
@Component({
  selector: 'app-vouchers-history',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-page
      [pageTitle]="'PROMOTIONS.PROMOTIONS_VOUCHERS.PROMOTIONS_VOUCHERS_CHANGES' | translate"
      [breadcrumbs]="breadcrumbs"
      [columns]="columns"
      [dataSource]="load"
      [pagination]="pagination"
      [search]="{ enabled: false }"
      [sorting]="sorting"
      [filters]="[]"
      [headerActions]="[]"
      [selectable]="false"
      [fitContent]="true"
      [emptyState]="emptyState">
      <ng-template listCellTemplate="actionName" let-row>
        {{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.ACTIONS.' + row.actionName | translate }}
      </ng-template>
      <ng-template listCellTemplate="actionDate" let-row>{{ row.actionDate | date: 'dd/MM/yyyy HH:mm:ss' }}</ng-template>
      <ng-template listCellTemplate="reason" let-row>{{ translate(row.reason, currentLang()) }}</ng-template>
    </app-list-page>
  `,
})
export class VouchersHistoryComponent implements OnInit {
  private service = inject(VouchersService);
  private lang = inject(LanguageService);

  translate = translate;
  currentLang = computed(() => this.lang.current() || 'en');

  columns: TableColumn[] = [];
  pagination = { enabled: true, pageLimits: [15, 30, 50], default: 15 };
  sorting = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    const K = 'PROMOTIONS.PROMOTIONS_VOUCHERS.';
    this.columns = [
      { key: 'actionName', label: t(K + 'ACTION_NAME'), sortable: false, customTemplate: true, visible: true, order: 0 },
      { key: 'actionDate', label: t(K + 'ACTION_DATE'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'user', label: t(K + 'USER'), sortable: false, visible: true, order: 2 },
      { key: 'reason', label: t(K + 'REASON'), sortable: false, customTemplate: true, visible: true, order: 3 },
    ];
    this.emptyState = { title: t(K + 'NO_DATA'), message: '' };
    this.breadcrumbs = [
      { label: t(K + 'PROMOTIONS_VOUCHERS'), routerLink: '/promotions/promotions-vouchers' },
      { label: t(K + 'PROMOTIONS_VOUCHERS_CHANGES') },
    ];
  }

  load = async (params: ListQueryParams) => {
    const pageInfo: PageInfo = { page: params.page, limit: params.limit, count: 0, startIndex: 0, lastIndex: 0 };
    const sortInfo: SortInfo | undefined = params.sortBy
      ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
      : undefined;
    const list = await this.service.getVouchersActionsList(pageInfo, sortInfo);
    const count = pageInfo.count ?? list?.length ?? 0;
    return { list: list ?? [], count, pageCount: Math.ceil(count / params.limit) || 1 };
  };
}
