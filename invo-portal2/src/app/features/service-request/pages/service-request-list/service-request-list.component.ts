import { EmojiIconComponent } from '@shared/components/emoji-icon/emoji-icon.component';
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

import '../../service-request-i18n';
import { ServiceRequest } from '../../models/service-request.model';
import { ServiceRequestService } from '../../services/service-request.service';

/**
 * Service requests -> list (`/paging`). Legacy `ServiceRequestListComponent`: the request text, searchable and sortable,
 * with Edit and Delete. The endpoint returns every template, so search / sort / paging happen in the service.
 */
@Component({
  selector: 'app-service-request-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, EmojiIconComponent, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  templateUrl: './service-request-list.component.html',
})
export class ServiceRequestListComponent implements OnInit {
  private service = inject(ServiceRequestService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild(ListPageComponent) private list?: ListPageComponent;

  readonly canAdd = this.privileges.check('pagingSecurity.actions.add.access');

  columns: TableColumn[] = [];
  breadcrumbs: { label: string; routerLink?: string; icon?: 'home'; iconOnly?: boolean }[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState: { title: string; message: string; icon: string } = { title: '', message: '', icon: 'list' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('service-request');
    const t = (k: string) => this.lang.instant('SERVICE_REQUEST.' + k);
    this.columns = [
      { key: 'icon', label: t('COL_ICON'), sortable: false, customTemplate: true, visible: true, order: 0 },
      { key: 'body', label: t('COL_TEXT'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 1 },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: t('TITLE'), routerLink: '/paging' },
    ];
    this.searchConfig.placeholder = t('SEARCH');
    this.emptyState = { title: t('EMPTY'), message: t('EMPTY_HINT'), icon: 'list' };
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

  add(): void { void this.router.navigate(['/paging/new']); }
  edit(r: ServiceRequest): void { void this.router.navigate(['/paging', r.id]); }
  onRowClick(e: any): void { if (e?.row && this.canAdd) this.edit(e.row); }

  async remove(r: ServiceRequest): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant('SERVICE_REQUEST.DELETE_TITLE'), message: this.lang.instant('SERVICE_REQUEST.DELETE_TEXT'), danger: true },
    }).afterClosed();
    if (!ok) return;
    try {
      const res = await this.service.remove(r.id);
      if (res?.success) {
        this.toast.success('SERVICE_REQUEST.DELETED');
        this.list?.refresh();
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' && res.msg ? res.msg : this.lang.instant('SERVICE_REQUEST.DELETE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('SERVICE_REQUEST.DELETE_FAILED'));
    }
  }
}
