import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn, ListQueryParams, BulkActionConfig,
} from '@shared/components/list-page/interfaces/list-page.types';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import {
  ApproveAccessModalComponent, ApproveAccessData, ApproveAccessResult,
} from './approve-access-modal.component';
import { AccessRequest, AccessRequestService } from '../../services/access-request.service';

/**
 * Access requests — what employees sent from the 403 page's "Request access".
 * Super-admin only (enforced by the API). Approving grants the requested
 * permission to that employee for the chosen period (or open-ended), overlaid
 * on their role; an admin can also dismiss a request or revoke a grant early.
 */
@Component({
  selector: 'app-access-requests',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, SegmentedToggleComponent],
  templateUrl: './access-requests.component.html',
  styleUrl: './access-requests.component.scss',
})
export class AccessRequestsComponent implements OnInit {
  private service = inject(AccessRequestService);
  private lang    = inject(LanguageService);
  private toast   = inject(ToastService);
  private modal   = inject(ModalService);

  @ViewChild(ListPageComponent) private listPage?: ListPageComponent;

  columns: TableColumn[] = [];
  breadcrumbs = [{ label: '', routerLink: '/employees' }, { label: '', routerLink: '/employees/access-requests' }];
  paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  searchConfig     = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig    = { enabled: false };
  emptyState       = { title: '', message: '' };

  /** Which list is showing: finished requests an admin has archived are kept apart. */
  readonly view = signal<'active' | 'archived'>('active');
  private readonly counts = signal({ active: 0, archived: 0 });
  readonly viewOptions = computed(() => [
    { value: 'active',   label: 'EMPLOYEES.ACCESS_REQUESTS.VIEW_ACTIVE',   count: this.counts().active },
    { value: 'archived', label: 'EMPLOYEES.ACCESS_REQUESTS.VIEW_ARCHIVED', count: this.counts().archived },
  ]);
  private archiveActions: BulkActionConfig[] = [];
  private restoreActions: BulkActionConfig[] = [];
  get bulkActions(): BulkActionConfig[] {
    return this.view() === 'archived' ? this.restoreActions : this.archiveActions;
  }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('employees');
    const t = (k: string) => this.lang.instant(k);
    this.columns = [
      { key: 'employeeName', label: t('EMPLOYEES.ACCESS_REQUESTS.EMPLOYEE'),  noApi: true, sortable: false, primary: true, customTemplate: true, visible: true, order: 0 },
      { key: 'page',         label: t('EMPLOYEES.ACCESS_REQUESTS.PAGE'),      noApi: true, sortable: false, customTemplate: true, visible: true, order: 1 },
      { key: 'createdAt',    label: t('EMPLOYEES.ACCESS_REQUESTS.REQUESTED'), noApi: true, sortable: false, customTemplate: true, visible: true, order: 2 },
      { key: 'status',       label: t('EMPLOYEES.ACCESS_REQUESTS.STATUS'),    noApi: true, sortable: false, customTemplate: true, visible: true, order: 3 },
      { key: 'grantedUntil', label: t('EMPLOYEES.ACCESS_REQUESTS.ACCESS_UNTIL'), noApi: true, sortable: false, customTemplate: true, visible: true, order: 4 },
    ];
    this.breadcrumbs = [
      { label: t('EMPLOYEES.TITLE'),                 routerLink: '/employees' },
      { label: t('EMPLOYEES.ACCESS_REQUESTS.TITLE'), routerLink: '/employees/access-requests' },
    ];
    this.archiveActions = [{
      id: 'archive', label: t('EMPLOYEES.ACCESS_REQUESTS.ARCHIVE'), requiresSelection: true,
      handler: (rows: AccessRequest[]) => void this.archiveRows(rows, false),
    }];
    this.restoreActions = [{
      id: 'restore', label: t('EMPLOYEES.ACCESS_REQUESTS.RESTORE'), requiresSelection: true,
      handler: (rows: AccessRequest[]) => void this.archiveRows(rows, true),
    }];
    this.searchConfig.placeholder = t('EMPLOYEES.ACCESS_REQUESTS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('EMPLOYEES.ACCESS_REQUESTS.EMPTY'), message: '' };
  }

  load = async (params: ListQueryParams) => {
    const { list, count, counts } = await this.service.list({
      page: params.page, limit: params.limit, searchTerm: params.searchTerm || '', view: this.view(),
    });
    this.counts.set(counts);
    return { list, count, pageCount: Math.max(1, Math.ceil(count / params.limit)) };
  };

  setView(v: 'active' | 'archived'): void {
    if (v === this.view()) return;
    this.view.set(v);
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }

  async approve(row: AccessRequest): Promise<void> {
    const ref = this.modal.open<ApproveAccessModalComponent, ApproveAccessData, ApproveAccessResult>(
      ApproveAccessModalComponent,
      { size: 'md', data: { employeeName: row.employeeName, page: row.page } },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    await this.run(row, 'approve', result.grantedUntil, 'EMPLOYEES.ACCESS_REQUESTS.APPROVED_OK');
  }

  dismiss(row: AccessRequest): Promise<void> {
    return this.run(row, 'dismiss', null, 'EMPLOYEES.ACCESS_REQUESTS.DISMISSED_OK');
  }

  revoke(row: AccessRequest): Promise<void> {
    return this.run(row, 'revoke', null, 'EMPLOYEES.ACCESS_REQUESTS.REVOKED_OK');
  }

  /** Finished requests only: dismissed, revoked, or an approval past its end date. */
  canArchive(row: AccessRequest): boolean {
    return !row.archivedAt && (row.status === 'dismissed' || row.status === 'revoked'
      || (row.status === 'approved' && !row.isActive));
  }

  archiveOne(row: AccessRequest): Promise<void> {
    return this.archiveRows([row], !!row.archivedAt, true);
  }

  /** Bulk or single archive/restore. Archiving asks first; restoring does not. */
  private async archiveRows(rows: AccessRequest[], restore: boolean, single = false): Promise<void> {
    const eligible = restore ? rows : rows.filter(r => this.canArchive(r));
    if (eligible.length === 0) {
      this.toast.error('EMPLOYEES.ACCESS_REQUESTS.NOTHING_TO_ARCHIVE');
      return;
    }
    if (!restore && !single) {
      const skipped = rows.length - eligible.length;
      const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: {
          title:   this.lang.instant('EMPLOYEES.ACCESS_REQUESTS.ARCHIVE_TITLE'),
          message: this.lang.instant('EMPLOYEES.ACCESS_REQUESTS.ARCHIVE_MSG', { count: eligible.length }),
          note:    skipped ? this.lang.instant('EMPLOYEES.ACCESS_REQUESTS.ARCHIVE_SKIPPED', { count: skipped }) : undefined,
          confirm: this.lang.instant('EMPLOYEES.ACCESS_REQUESTS.ARCHIVE'),
        },
      });
      if (!(await ref.afterClosed())) return;
    }
    const res = await this.service.archive(eligible.map(r => r.id), restore).catch(() => null);
    if (!res) { this.toast.error('EMPLOYEES.ACCESS_REQUESTS.ACTION_FAILED'); return; }
    this.toast.success(this.lang.instant(
      restore ? 'EMPLOYEES.ACCESS_REQUESTS.RESTORED_OK' : 'EMPLOYEES.ACCESS_REQUESTS.ARCHIVED_OK',
      { count: res.changed },
    ));
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }

  /** Display state: an approved row past its end date reads as expired. */
  stateOf(row: AccessRequest): string {
    return row.status === 'approved' && !row.isActive ? 'expired' : row.status;
  }

  private async run(row: AccessRequest, action: 'approve' | 'dismiss' | 'revoke', until: string | null, okKey: string) {
    const ok = await this.service.resolve(row.id, action, until).catch(() => false);
    if (!ok) { this.toast.error('EMPLOYEES.ACCESS_REQUESTS.ACTION_FAILED'); return; }
    this.toast.success(okKey);
    this.listPage?.refresh();
  }
}
