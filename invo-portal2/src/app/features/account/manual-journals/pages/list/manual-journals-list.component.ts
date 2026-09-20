import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListRowActionsDirective,
  ListCellTemplateDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import type {
  TableColumn,
  ActionConfig,
  ListQueryParams,
  ListResponse,
} from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { LogsDrawerComponent, LogsDrawerData } from '@shared/components/logs-drawer/logs-drawer.component';

import { ManualJournalsService } from '../../services/manual-journals.service';
import { JournalListRow } from '../../services/manual-journals.types';

/**
 * Manual Journals list — mirrors the Products / Chart-of-Accounts list
 * pattern (`<app-list-page>`, config-driven columns + async dataSource,
 * row `…` overflow menu) rather than a hand-rolled table.
 *
 * Row actions match legacy `journal.component.html` exactly: View always
 * available; Edit/Clone/Delete hidden once `reconciled` is true (a
 * reconciled journal's lines are locked) and gated on the matching
 * `manualJournalSecurity` privilege.
 */
@Component({
  selector: 'app-manual-journals-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    ListPageComponent,
    ListRowActionsDirective,
    ListCellTemplateDirective,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manual-journals-list.component.html',
  styleUrl: './manual-journals-list.component.scss',
})
export class ManualJournalsListComponent implements OnInit {
  private service = inject(ManualJournalsService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  columns: TableColumn<JournalListRow>[] = [];
  headerActions: ActionConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 350 };
  sortingConfig = { enabled: true, defaultSort: { key: 'createdAt', direction: 'desc' as const } };
  emptyState = { title: '', message: '' };

  breadcrumbs: { label: string; routerLink?: string }[] = [];

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.initializeTranslations());
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.initializeTranslations());
  }

  ngOnInit(): void {
    this.initializeTranslations();
  }

  private initializeTranslations(): void {
    const t = (key: string) => this.translate.instant(key);

    this.breadcrumbs = [
      { label: t('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('MANUAL_JOURNALS.LIST.TITLE') },
    ];

    this.columns = [
      { key: 'journalDate', label: t('MANUAL_JOURNALS.LIST.DATE'), sortable: true, pipe: 'date', width: '130px', visible: true, order: 0 },
      { key: 'reference', label: t('MANUAL_JOURNALS.LIST.REFERENCE'), sortable: true, visible: true, order: 1 },
      { key: 'branchName', label: t('MANUAL_JOURNALS.LIST.BRANCH'), sortable: true, visible: true, order: 2 },
      { key: 'employeeName', label: t('MANUAL_JOURNALS.LIST.EMPLOYEE'), sortable: true, visible: true, order: 3 },
      { key: 'amount', label: t('MANUAL_JOURNALS.LIST.AMOUNT'), sortable: true, customTemplate: true, align: 'end', width: '140px', visible: true, order: 4 },
      { key: 'status', label: t('MANUAL_JOURNALS.LIST.STATUS'), sortable: true, customTemplate: true, width: '120px', visible: true, order: 5 },
    ];

    this.searchConfig = { ...this.searchConfig, placeholder: t('MANUAL_JOURNALS.LIST.SEARCH_PLACEHOLDER') };
    this.emptyState = { title: t('MANUAL_JOURNALS.LIST.EMPTY'), message: '' };
  }

  /** list-page dataSource. */
  loadJournals = async (params: ListQueryParams): Promise<ListResponse<JournalListRow>> => {
    const res = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy,
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  // ─── Row navigation ─────────────────────────────────────────────────
  view(row: JournalListRow): void {
    void this.router.navigate(['/account/manual-journals/view', row.id]);
  }

  edit(row: JournalListRow, ev?: Event): void {
    ev?.stopPropagation();
    void this.router.navigate(['/account/manual-journals', row.id]);
  }

  clone(row: JournalListRow, ev?: Event): void {
    ev?.stopPropagation();
    void this.router.navigate(['/account/manual-journals', row.id], { queryParams: { clone: 'true' } });
  }

  add(): void {
    void this.router.navigate(['/account/manual-journals', 'new']);
  }

  onRowClick(event: { row: JournalListRow }): void {
    this.view(event.row);
  }

  rowMenuItems(row: JournalListRow): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (!row.reconciled) {
      items.push({ label: 'COMMON.EDIT', click: () => this.edit(row) });
      items.push({ label: 'COMMON.CLONE', click: () => this.clone(row) });
      items.push({ label: 'COMMON.DELETE', danger: true, click: () => void this.confirmDelete(row) });
    }
    return items;
  }
  hasRowMenu = (row: JournalListRow): boolean => this.rowMenuItems(row).length > 0;

  private async confirmDelete(row: JournalListRow): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant('MANUAL_JOURNALS.LIST.DELETE_TITLE'),
          message: this.translate.instant('MANUAL_JOURNALS.LIST.DELETE_MESSAGE', { reference: row.reference || '—' }),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger: true,
        },
        closeOnBackdrop: false,
      },
    );
    if (!(await ref.afterClosed())) return;
    try {
      const ok = await this.service.delete(row.id);
      if (ok) {
        this.toast.success('COMMON.DELETED_OK');
        this.listPage?.refresh();
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.DELETE_FAILED', err?.message);
    }
  }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(
      LogsDrawerComponent,
      {
        drawer: true,
        drawerWidth: '480px',
        drawerResizable: true,
        data: { sourceTable: 'Journals', title: this.translate.instant('MANUAL_JOURNALS.LIST.TITLE') },
      },
    );
  }
}
