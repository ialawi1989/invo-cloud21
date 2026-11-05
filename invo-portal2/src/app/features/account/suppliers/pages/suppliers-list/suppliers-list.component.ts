import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ModalService } from '@shared/modal/modal.service';
import { openPartyQuickPeek } from '../../../components/party-quick-peek/party-quick-peek.component';
import { EntityImportExportData, entityImportExportMenu, openEntityImport } from '../../../components/entity-import-export-modal/entity-import';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { TableColumn, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { SuppliersService } from '../../services/suppliers.service';
import { SupplierActions } from '../../services/supplier-actions';

/**
 * Suppliers → list. Legacy `SuppliersComponent`: same columns, search, sort,
 * paging, add / view / edit gates and the activity log (source table
 * `Suppliers`). Row click opens the supplier (dashboard); the pencil edits.
 */
@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective,
    ListRowActionsDirective, DropdownMenuBtnComponent, MycurrencyPipe,
  ],
  templateUrl: './suppliers-list.component.html',
})
export class SuppliersListComponent implements OnInit {
  private service = inject(SuppliersService);
  @ViewChild(ListPageComponent) listPage?: ListPageComponent;
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);

  readonly actions = inject(SupplierActions);

  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];
  moreItems: DropdownMenuBtnItem[] = [];

  async ngOnInit(): Promise<void> {
    await Promise.all([this.lang.loadFeature('account/suppliers'), this.lang.loadFeature('account/components/doc-lines-table')]);
    const t = (k: string) => this.lang.instant(k);
    const L = 'SUPPLIERS.LIST.';
    this.columns = [
      { key: 'name', label: t(L + 'NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'phone', label: t(L + 'PHONE'), sortable: true, visible: true, order: 1 },
      { key: 'email', label: t(L + 'EMAIL'), sortable: true, visible: true, order: 2 },
      { key: 'outStandingPayable', label: t(L + 'ACCOUNT_PAYABLE'), sortable: true, customTemplate: true, align: 'end', visible: true, order: 3 },
    ];

    this.searchConfig.placeholder = t('SUPPLIERS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('SUPPLIERS.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('SUPPLIERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t(L + 'SUPPLIER_LIST') },
    ];
    this.moreItems = [
      { label: t('COMMON.LOGS.SHOW'), click: () => this.openLogs(), disabled: false, danger: false },
      ...(this.actions.canImportExport ? entityImportExportMenu(t, t('SUPPLIERS.IMPORT_SUPPLIERS'), () => void this.openImportExport(), () => this.importData()) : []),
    ];
  }

  loadSuppliers = async (params: ListQueryParams) => {
    const body: any = {
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
    };
    if (params.columns?.length) body.columns = params.columns;
    const data = await this.service.getSuppliersList(body);
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

  add(): void { void this.router.navigate(['/account/suppliers', 'new']); }
  view(row: any): void { void this.router.navigate(['/account/suppliers/view', row.id]); }
  edit(row: any): void { void this.router.navigate(['/account/suppliers', row.id]); }
  peek(row: any): void { openPartyQuickPeek(this.modal, 'supplier', row.id, row.name); }

  onRowClick(event: any): void { if (event?.row) this.view(event.row); }

  /** Import / Export dialog (legacy `ExportImportSuppliersComponent`): columns name, phone, email, website, note, address, openingBalance, country, vatNumber. */
  async openImportExport(): Promise<void> {
    if (await openEntityImport(this.modal, this.importData())) this.listPage?.refresh?.();
  }

  private importData(): EntityImportExportData {
    return {
      title: 'SUPPLIERS.IMPORT_SUPPLIERS',
      requiredNotes: ['SUPPLIERS.IMPORT_REQ_NAME'],
        templateFile: 'suppliers-list-template',
        template: [
          ['name', 'phone', 'email', 'website', 'note', 'address', 'openingBalance', 'country', 'vatNumber'],
          ['Invo', '17777777', 'example@example.com', 'www.example.com', 'Example note', 'Road 0000 - Block 000 - Buldng 000', '5', 'Bahrain', '25'],
        ],
        mapRow: r => (r[0] ? { name: r[0], phone: r[1], email: r[2], website: r[3], note: r[4], address: r[5], openingBalance: r[6], country: r[7], vatNumber: r[8] } : null),
        progress: () => this.service.getBulkImportProgress(),
        import: rows => this.service.importSupplier(rows),
        export: type => this.service.exportSuppliers(type),
    };
  }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: { sourceTable: 'Suppliers', title: this.lang.instant('SUPPLIERS.LIST.SUPPLIER_LIST') },
    });
  }
}
