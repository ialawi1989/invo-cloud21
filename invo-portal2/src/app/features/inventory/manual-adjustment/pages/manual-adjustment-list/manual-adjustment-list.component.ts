import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';

import '../../manual-adjustment-i18n';
import { AdjustmentRow, isUnitCost } from '../../models/manual-adjustment.model';
import { ManualAdjustmentService } from '../../services/manual-adjustment.service';

const ymd = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Manual adjustments -> list (`/manual-adjustment`). Legacy `ManualAdjustmentComponent`: branch / type / employee / date
 * columns, search by branch, sort, View, Edit (an on-hand adjustment only: a unit-cost one can't be edited once saved) and Delete.
 */
@Component({
  selector: 'app-manual-adjustment-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  templateUrl: './manual-adjustment-list.component.html',
})
export class ManualAdjustmentListComponent implements OnInit {
  private service = inject(ManualAdjustmentService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild(ListPageComponent) private list?: ListPageComponent;

  readonly canAdd = this.privileges.check('manualAdjustmentSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('manualAdjustmentSecurity.actions.delete.access');

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'box' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('inventory/manual-adjustment');
    const t = (k: string) => this.lang.instant('MANUAL_ADJUSTMENT.' + k);
    this.columns = [
      { key: 'branchName', label: t('COL_BRANCH'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'adjustmentType', label: t('COL_TYPE'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'employeeName', label: t('COL_EMPLOYEE'), sortable: true, visible: true, order: 2 },
      { key: 'inventoryMovmentDate', label: t('COL_DATE'), sortable: true, customTemplate: true, visible: true, order: 3 },
    ];
    this.filters = [{ type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('FILTER_DATE') }];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/manual-adjustment' },
    ];
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
      filter: { fromDate: ymd(f['fromDate']), toDate: ymd(f['toDate']) },
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  typeLabel = (r: AdjustmentRow) => this.lang.instant('MANUAL_ADJUSTMENT.TYPE.' + (r.adjustmentType ?? 'onHand adjustment'));

  /** A unit-cost adjustment re-valued the stock and can't be edited once saved. */
  canEdit = (r: AdjustmentRow) => this.canAdd && !isUnitCost(r.adjustmentType);

  add(): void { void this.router.navigate(['/manual-adjustment/new']); }
  view(r: AdjustmentRow): void { void this.router.navigate(['/manual-adjustment/view', r.id]); }
  edit(r: AdjustmentRow): void { void this.router.navigate(['/manual-adjustment', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }

  async remove(r: AdjustmentRow): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant('MANUAL_ADJUSTMENT.DELETE_TITLE'), message: this.lang.instant('MANUAL_ADJUSTMENT.DELETE_TEXT'), danger: true },
    }).afterClosed();
    if (!ok) return;
    try {
      const res = await this.service.remove(r.id);
      if (res?.success) {
        this.toast.success('MANUAL_ADJUSTMENT.DELETED');
        this.list?.refresh();
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : this.lang.instant('MANUAL_ADJUSTMENT.DELETE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('MANUAL_ADJUSTMENT.DELETE_FAILED'));
    }
  }
}
