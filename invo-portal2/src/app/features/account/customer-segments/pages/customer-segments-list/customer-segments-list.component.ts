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
import { TableColumn, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';

import { CustomersService } from '../../../customers/services/customers.service';

/**
 * Customer segments → list. Legacy `CustomerSegmentsComponent`: a single sortable
 * Title column with search + paging; row click / pencil opens the editor.
 */
@Component({
  selector: 'app-customer-segments-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  templateUrl: './customer-segments-list.component.html',
})
export class CustomerSegmentsListComponent implements OnInit {
  private service = inject(CustomersService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('customerSegmentsSecurity.actions.add.access');

  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/customer-segments');
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'title', label: t('CUSTOMER_SEGMENTS.COL_TITLE'), sortable: true, primary: true, locked: true,
        interactive: true, customTemplate: true, visible: true, order: 0 },
    ];
    this.searchConfig.placeholder = t('CUSTOMER_SEGMENTS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('CUSTOMER_SEGMENTS.EMPTY'), message: '' };
  }

  loadSegments = async (params: ListQueryParams) => {
    const data = await this.service.getCustomerSegmentList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : null,
    });
    const list: any[] = Array.isArray(data?.list) ? data.list : [];
    const count = Number(data?.count ?? list.length) || 0;
    const pageCount = Number(data?.pageCount ?? Math.ceil(count / (params.limit || 15))) || 1;
    return { list, count, pageCount };
  };

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }
  edit(row: { id: string }): void { void this.router.navigate(['/account/customer-segments', row.id]); }
  add(): void { void this.router.navigate(['/account/customer-segments', 'new']); }
}
