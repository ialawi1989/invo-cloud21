import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { statusClass as baseStatusClass } from '@shared/utils/status-tone';

import '../../transfer-i18n';
import { InventoryTransferService } from '../../services/inventory-transfer.service';
import { TransferRow } from '../../models/inventory-transfer.model';

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const ymd = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Inventory transfers -> list (`/inventory/transfer`). Legacy `InventoryTransferComponent`: type / status / number /
 * reference / reason / branch (-> destination for a transfer out) / date columns, search, sort, status + date filters,
 * View and Edit (hidden once confirmed), and "New transfer" in / out plus the wastage shortcut.
 */
@Component({
  selector: 'app-transfer-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent],
  templateUrl: './transfer-list.component.html',
})
export class TransferListComponent implements OnInit {
  private service = inject(InventoryTransferService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('inventoryTransferSecurity.actions.add.access');

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  newItems: DropdownMenuBtnItem[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };
  statusClass = baseStatusClass;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('inventory/transfer');
    const t = (k: string) => this.lang.instant('INVENTORY_TRANSFER.' + k);
    this.columns = [
      { key: 'type', label: t('COL_TYPE'), sortable: true, customTemplate: true, visible: true, order: 0 },
      { key: 'status', label: t('COL_STATUS'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'transferNumber', label: t('COL_NUMBER'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 2 },
      { key: 'reference', label: t('COL_REFERENCE'), sortable: true, visible: true, order: 3 },
      { key: 'reason', label: t('COL_REASON'), sortable: true, visible: true, order: 4 },
      { key: 'branchName', label: t('COL_BRANCH'), sortable: true, customTemplate: true, visible: true, order: 5 },
      { key: 'createdDate', label: t('COL_DATE'), sortable: true, customTemplate: true, visible: true, order: 6 },
    ];
    this.filters = [
      {
        type: 'checkbox-group', key: 'status', label: t('FILTER_STATUS'),
        options: ['Open', 'Confirmed'].map(v => ({ value: v, label: t('STATUS.' + v) })),
      },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('FILTER_DATE') },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/inventory/transfer' },
    ];
    this.newItems = [
      { label: t('NEW_IN'), click: () => this.add('in'), disabled: false, danger: false },
      { label: t('NEW_OUT'), click: () => this.add('out'), disabled: false, danger: false },
      { label: t('NEW_WASTAGE'), click: () => this.add('out', { transferReason: 'Wastage' }), disabled: false, danger: false },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '' };
  }

  load = async (params: ListQueryParams) => {
    const f = params.filter ?? {};
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
      filter: { status: arr(f['status']), fromDate: ymd(f['fromDate']), toDate: ymd(f['toDate']) },
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  /** A confirmed transfer has moved stock and can't be edited. */
  canEdit = (r: TransferRow) => this.canAdd && r.status !== 'Confirmed';

  typeLabel = (r: TransferRow) => this.lang.instant('INVENTORY_TRANSFER.TYPE.' + r.type);
  statusLabel = (r: TransferRow) => this.lang.instant('INVENTORY_TRANSFER.STATUS.' + r.status);

  add(direction: 'in' | 'out', queryParams?: Record<string, string>): void {
    void this.router.navigate(['/inventory/transfer/new', direction], { queryParams });
  }
  view(r: TransferRow): void { void this.router.navigate(['/inventory/transfer/view', r.id]); }
  edit(r: TransferRow): void {
    void this.router.navigate(['/inventory/transfer', r.type === 'Transfer In' ? 'in' : 'out', r.id]);
  }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
