import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, MobileCardConfig, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';

import '../../cheque-builder-i18n';
import { ChequeTemplate } from '../../models/cheque-template.model';
import { ChequeBuilderService } from '../../services/cheque-builder.service';

/** Cheque templates -> list (`/settings/cheque-builder`). Legacy `ChequeBuilderComponent`: list, search, sort, Edit, Delete. */
@Component({
  selector: 'app-cheque-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  templateUrl: './cheque-list.component.html',
})
export class ChequeListComponent implements OnInit {
  private service = inject(ChequeBuilderService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild(ListPageComponent) private list?: ListPageComponent;

  readonly canAdd = this.privileges.check('chequeBuilderSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('chequeBuilderSecurity.actions.delete.access');

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 300 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'receipt' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('cheque-builder');
    const t = (k: string) => this.lang.instant('CHEQUE_BUILDER.' + k);
    this.columns = [
      { key: 'name', label: t('COL_NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'bank', label: t('COL_BANK'), sortable: true, visible: true, order: 1 },
      { key: 'size', label: t('COL_SIZE'), sortable: false, customTemplate: true, visible: true, order: 2 },
      { key: 'dpi', label: t('COL_DPI'), sortable: true, visible: true, order: 3 },
      { key: 'language', label: t('COL_LANGUAGE'), sortable: true, customTemplate: true, visible: true, order: 4 },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/settings/cheque-builder' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: t('EMPTY_BODY'), icon: 'receipt' };
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

  langLabel = (r: ChequeTemplate) => {
    const k = 'CHEQUE_BUILDER.LANG.' + r.language;
    const v = this.lang.instant(k);
    return v === k ? r.language : v;
  };

  add(): void { void this.router.navigate(['/settings/cheque-builder/new']); }
  edit(r: ChequeTemplate): void { void this.router.navigate(['/settings/cheque-builder', r.id]); }
  onRowClick(e: any): void { if (e?.row && this.canAdd) this.edit(e.row); }

  async remove(r: ChequeTemplate): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant('CHEQUE_BUILDER.DELETE_TITLE'), message: this.lang.instant('CHEQUE_BUILDER.DELETE_TEXT'), danger: true },
    }).afterClosed();
    if (!ok) return;
    try {
      const res = await this.service.remove(r.id);
      if (res.success) {
        this.toast.success('CHEQUE_BUILDER.DELETED');
        this.list?.refresh();
      } else {
        this.toast.error('COMMON.OPS', this.lang.instant('CHEQUE_BUILDER.DELETE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.message ?? this.lang.instant('CHEQUE_BUILDER.DELETE_FAILED'));
    }
  }
}
