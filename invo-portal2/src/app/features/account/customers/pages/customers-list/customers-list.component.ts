import { Component, OnInit, ViewChild, inject } from '@angular/core';
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

import { openPartyQuickPeek } from '../../../components/party-quick-peek/party-quick-peek.component';
import { EntityImportExportData, entityImportExportMenu, openEntityImport } from '../../../components/entity-import-export-modal/entity-import';
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

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('customerSecurity.actions.add.access');
  /** Legacy showed Import / Export to everyone; the privilege list has no action for it, so it follows "Add/Edit Customer". */
  readonly canImportExport = this.canAdd;

  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];
  moreItems: DropdownMenuBtnItem[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/customers');
    // `DOC_IMPORT.*` labels of the shared import / export dialog.
    await this.lang.loadFeature('account/components/doc-lines-table');
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
      ...(this.canImportExport ? entityImportExportMenu(t, t('CUSTOMERS.IMPORT_CUSTOMERS'), () => void this.openImportExport(), () => this.importData()) : []),
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

  /**
   * Import / Export dialog (legacy `ExportImportCustomersComponent`, "Current POS" format). Columns are read by name -
   * name, phone, mobile, email, "VAT Registration Number", addresses (a JSON list), birthDay - so a file exported from
   * this list imports back as is. A customer with the same phone is updated; one with a VAT number becomes a Business.
   * (The legacy template listed `addresses/title`, `addresses/city` … columns the import never read; the template here
   * uses the `addresses` JSON column it does read.)
   */
  async openImportExport(): Promise<void> {
    if (await openEntityImport(this.modal, this.importData())) this.listPage?.refresh?.();
  }

  private importData(): EntityImportExportData {
    const col = (header: any[] | undefined, ...names: string[]) =>
      (header ?? []).findIndex(h => names.includes(String(h ?? '').trim().toLowerCase()));
    return {
      title: 'CUSTOMERS.IMPORT_CUSTOMERS',
      requiredNotes: ['CUSTOMERS.IMPORT_REQ_NAME', 'CUSTOMERS.IMPORT_REQ_ADDR'],
        templateFile: 'customers-list-template',
        template: [
          ['name', 'phone', 'mobile', 'email', 'VAT Registration Number', 'addresses', 'birthDay'],
          ['Ali', '17777777', '37000000', 'example@example.com', 'BH12345678',
            '[{"title":"Home","city":"Manama","block":"500","road":"444","building":"1","flat":"","note":"","lat":"","lng":""}]', '1990-01-11'],
        ],
        mapRow: (r, header) => {
          const at = (i: number, fallback: number) => String(r[i >= 0 ? i : fallback] ?? '').trim();
          const nameAt = col(header, 'name');
          const name = at(nameAt, 0);
          if (!name) return null;
          const addrAt = col(header, 'addresses');
          let addresses: any[] = [];
          const raw = addrAt >= 0 ? r[addrAt] : null;
          if (raw && raw !== '[]' && raw !== 'null') {
            try {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (Array.isArray(parsed)) addresses = parsed;
            } catch { /* an unreadable address cell imports the customer without one */ }
          }
          const cell = (i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
          return {
            name,
            phone: cell(col(header, 'phone')),
            mobile: cell(col(header, 'mobile')),
            email: cell(col(header, 'email')),
            vatNumber: cell(col(header, 'vat registration number', 'vatnumber')),
            birthDay: cell(col(header, 'birthday')),
            addresses,
          };
        },
        progress: () => this.service.getBulkImportProgress(),
        import: rows => this.service.importCustomers(rows),
        export: type => this.service.exportCustomers(type),
    };
  }

  /** Quick-peek side panel of the customer (legacy `app-customer-sidenav`). */
  peek(row: any): void { openPartyQuickPeek(this.modal, 'customer', row.id, this.displayName(row)); }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: { sourceTable: 'Customers', title: this.lang.instant('CUSTOMERS.LIST.CUSTOMER_LIST') },
    });
  }
}
