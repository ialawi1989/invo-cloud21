import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { TableColumn, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { CustomersService } from '../../services/customers.service';

/**
 * Customers → list. Legacy `CustomersComponent`: same columns, search, sort,
 * paging, add / view / edit gates and the activity log (source table
 * `Customers`). Row click opens the customer (dashboard); the pencil edits.
 */
@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe,
  ],
  templateUrl: './customers-list.component.html',
})
export class CustomersListComponent implements OnInit {
  private service = inject(CustomersService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('customerSecurity.actions.add.access');

  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];
  moreItems: DropdownMenuBtnItem[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/customers');
    const t = (k: string) => this.lang.instant(k);
    const L = 'CUSTOMERS.LIST.';
    this.columns = [
      { key: 'name', label: t(L + 'NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'type', label: t(L + 'CUSTOMER_TYPE'), sortable: true, visible: true, order: 1 },
      { key: 'phone', label: t(L + 'PHONE'), sortable: true, visible: true, order: 2 },
      { key: 'email', label: t(L + 'EMAIL'), sortable: true, visible: true, order: 3 },
      { key: 'outStandingRecivable', label: t(L + 'ACCOUNT_RECIEVABLE'), sortable: true, customTemplate: true, align: 'end', visible: true, order: 4 },
    ];
    this.searchConfig.placeholder = t('CUSTOMERS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('CUSTOMERS.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('CUSTOMERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'CUSTOMER_LIST') },
    ];
    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
    ];
  }

  loadCustomers = async (params: ListQueryParams) => {
    const body: any = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
    };
    if (params.columns?.length) body.columns = params.columns;
    const data = await this.service.getCustomerList(body);
    return {
      list: data?.list ?? [],
      count: data?.count ?? 0,
      pageCount: data?.pageCount ?? 0,
    };
  };

  loadCustomFieldsFn = async (columns: TableColumn[]): Promise<TableColumn[]> => {
    const fields = await this.service.getCustomFields();
    const existing = new Set(columns.map(c => c.key));
    const extra = fields
      .filter(f => !existing.has(f.key))
      .map((f, i) => ({
        key: f.key, label: f.label, visible: false, order: columns.length + i, sortable: false, isCustomField: true,
      } as TableColumn));
    return [...columns, ...extra];
  };

  displayName(row: any): string {
    return row?.saluation ? `${row.saluation} ${row.name}` : row?.name ?? '';
  }

  add(): void { void this.router.navigate(['/account/customers', 'new']); }
  view(row: any): void { void this.router.navigate(['/account/customers/view', row.id]); }
  edit(row: any): void { void this.router.navigate(['/account/customers', row.id]); }
  onRowClick(event: any): void { if (event?.row) this.view(event.row); }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: { sourceTable: 'Customers', title: this.lang.instant('CUSTOMERS.LIST.CUSTOMER_LIST') },
    });
  }
}
