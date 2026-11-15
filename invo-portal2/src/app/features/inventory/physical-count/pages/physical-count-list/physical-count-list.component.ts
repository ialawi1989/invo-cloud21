import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';
import { statusClass as baseStatusClass } from '@shared/utils/status-tone';

import '../../physical-count-i18n';
import { COUNT_MODES, CountMode, CountRow } from '../../models/physical-count.model';
import { PhysicalCountService } from '../../services/physical-count.service';

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const ymd = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** `By category` -> `by_category`: the key under `PHYSICAL_COUNT.TYPE`. */
export const typeKey = (type: string | null | undefined): string => String(type ?? '').trim().toLowerCase().replace(/\s+/g, '_');

/**
 * Physical counts -> list (`/inventory/physical-counts`). Legacy `PhysicalCountComponent`: type / status / reference /
 * branch / date columns, search, sort, status + date filters, View, Edit (until the count is closed), Delete, and
 * "New count" with the four ways to start one.
 */
@Component({
  selector: 'app-physical-count-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent],
  templateUrl: './physical-count-list.component.html',
})
export class PhysicalCountListComponent implements OnInit {
  private service = inject(PhysicalCountService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild(ListPageComponent) private list?: ListPageComponent;

  readonly canAdd = this.privileges.check('inventoryPhysicalCountsSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('inventoryPhysicalCountsSecurity.actions.delete.access');

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  newItems: DropdownMenuBtnItem[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'package' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };
  statusClass = baseStatusClass;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('inventory/physical-count');
    const t = (k: string) => this.lang.instant('PHYSICAL_COUNT.' + k);
    this.columns = [
      { key: 'type', label: t('COL_TYPE'), sortable: true, customTemplate: true, visible: true, order: 0 },
      { key: 'status', label: t('COL_STATUS'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'reference', label: t('COL_REFERENCE'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 2 },
      { key: 'branchName', label: t('COL_BRANCH'), sortable: true, visible: true, order: 3 },
      { key: 'createdDate', label: t('COL_DATE'), sortable: true, customTemplate: true, visible: true, order: 4 },
    ];
    this.filters = [
      {
        type: 'checkbox-group', key: 'status', label: t('FILTER_STATUS'),
        options: ['Open', 'Calculated', 'Closed'].map(v => ({ value: v, label: t('STATUS.' + v) })),
      },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('FILTER_DATE') },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/inventory/physical-counts' },
    ];
    this.newItems = COUNT_MODES.map(m => ({ label: t('NEW_' + m.toUpperCase().replace(/-/g, '_')), click: () => this.add(m), disabled: false, danger: false }));
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: '', icon: 'package' };
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

  typeLabel = (r: CountRow) => {
    const key = 'PHYSICAL_COUNT.TYPE.' + typeKey(r.type);
    const out = this.lang.instant(key);
    return out === key ? r.type : out;
  };
  statusLabel = (r: CountRow) => this.lang.instant('PHYSICAL_COUNT.STATUS.' + r.status);

  /** A closed count has moved stock and can't be edited. */
  canEdit = (r: CountRow) => this.canAdd && r.status !== 'Closed';

  add(mode: CountMode): void { void this.router.navigate(['/inventory/physical-counts/new', mode]); }
  view(r: CountRow): void { void this.router.navigate(['/inventory/physical-counts/view', r.id]); }
  edit(r: CountRow): void { void this.router.navigate(['/inventory/physical-counts/edit', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  async remove(r: CountRow): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant('PHYSICAL_COUNT.DELETE_TITLE'), message: this.lang.instant('PHYSICAL_COUNT.DELETE_TEXT'), danger: true },
    }).afterClosed();
    if (!ok) return;
    try {
      const res = await this.service.remove(r.id);
      if (res?.success) {
        this.toast.success('PHYSICAL_COUNT.DELETED');
        this.list?.refresh();
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : this.lang.instant('PHYSICAL_COUNT.DELETE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('PHYSICAL_COUNT.DELETE_FAILED'));
    }
  }
}
