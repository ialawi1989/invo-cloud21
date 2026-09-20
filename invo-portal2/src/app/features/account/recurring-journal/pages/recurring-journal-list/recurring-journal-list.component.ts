import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { TableColumn, FilterConfig, ActionConfig, ListQueryParams } from '@shared/components/list-page/interfaces/list-page.types';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ErrorService } from '@core/http/error.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { RecurringJournalService } from '../../services/recurring-journal.service';
import { RecurringJournalListRow } from '../../models/recurring-journal.model';
import { BranchSettingsService } from 'src/app/features/settings/services/branch-settings.service';

/**
 * Recurring Journal list — mirrors the Products list page's `<app-list-page>`
 * configuration approach (column defs built in `initializeTranslations()`,
 * async `dataSource`, custom cell templates, `<app-dropdown-menu-btn>` row
 * actions) adapted to this feature's flatter field set.
 *
 * Legacy UI only exposed **View** and **Edit** row actions (delete was
 * commented out in the list template, though present — and gated on
 * `childJournalsQty == 0 && !hasJournals` — on the view page). No
 * activate/deactivate/run-now actions exist anywhere in legacy or the
 * backend (verified route-by-route); this list matches that surface
 * exactly, with Delete added to the row menu here (gated the same way the
 * legacy view page gates it) since `<app-dropdown-menu-btn>` makes it cheap
 * to surface safely (the backend still hard-blocks it either way).
 */
@Component({
  selector: 'app-recurring-journal-list',
  standalone: true,
  imports: [
    CommonModule,
    ListPageComponent,
    TranslateModule,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
  ],
  templateUrl: './recurring-journal-list.component.html',
  styleUrl: './recurring-journal-list.component.scss',
})
export class RecurringJournalListComponent implements OnInit {
  private router = inject(Router);
  private service = inject(RecurringJournalService);
  private branchSettings = inject(BranchSettingsService);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modalService = inject(ModalService);
  private errorService = inject(ErrorService);
  private toast = inject(ToastService);

  readonly canAdd = this.privileges.check('recurringJournalSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('recurringJournalSecurity.actions.delete.access');

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  headerActions: ActionConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/recurring-journal');
    this.initializeTranslations();
  }

  private initializeTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.PROFILE_NAME'),
        sortable: true,
        width: '220px',
        primary: true,
        interactive: true,
        visible: true,
        order: 0,
      },
      {
        key: 'branchName',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.BRANCH_NAME'),
        sortable: true,
        width: '160px',
        visible: true,
        order: 1,
      },
      {
        key: 'frequency',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.FREQUENCY'),
        sortable: false,
        customTemplate: true,
        width: '180px',
        visible: true,
        order: 2,
      },
      {
        key: 'startDate',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.START_DATE'),
        sortable: false,
        pipe: 'date',
        width: '130px',
        visible: true,
        order: 3,
      },
      {
        key: 'endDate',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.END_DATE'),
        sortable: false,
        customTemplate: true,
        width: '130px',
        visible: true,
        order: 4,
      },
      {
        key: 'createdAt',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.CREATED_AT'),
        sortable: false,
        pipe: 'date',
        width: '150px',
        visible: false,
        order: 5,
      },
    ];

    this.filters = [
      {
        type: 'dropdown',
        key: 'branchId',
        label: this.lang.instant('RECURRING_JOURNAL.LIST.BRANCH_NAME'),
        multiple: true,
        loadFn: (params: any) => this.loadBranchFilterOptions(params),
      },
    ];

    this.headerActions = [];
    this.searchConfig.placeholder = this.lang.instant('COMMON.SEARCH');
    this.emptyState = {
      title: this.lang.instant('COMMON.NO_DATA'),
      message: '',
    };
  }

  private async loadBranchFilterOptions(params: { page: number; pageSize: number; search: string }) {
    const res = await this.branchSettings.getList({ page: params.page, limit: params.pageSize, searchTerm: params.search });
    return {
      items: res.list.map(b => ({ value: b.id, label: b.name })),
      hasMore: params.page * params.pageSize < res.count,
    };
  }

  loadRecurringJournals = async (params: ListQueryParams) => {
    const branchId = params.filter?.['branchId'];
    const branches: string[] = Array.isArray(branchId) ? branchId : (branchId ? [branchId] : []);

    const response = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
      branches,
    });

    return { list: response.list, count: response.count, pageCount: response.pageCount };
  };

  frequencyLabel(row: RecurringJournalListRow): string {
    const qty = row.repeatData?.periodQty ?? 1;
    switch (row.repeatData?.periodicity) {
      case 'Monthly':
        return this.lang.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_MONTH', { qty, period: 'Month' });
      case 'Yearly':
        return this.lang.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_YEAR', { qty, period: 'Year' });
      case 'Weekly':
        return this.lang.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_WEEK', { qty, period: 'Week' });
      default:
        return '';
    }
  }

  rowMenuItems(row: RecurringJournalListRow): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.canAdd) {
      items.push({ label: 'COMMON.EDIT', click: () => this.edit(row) });
    }
    // Mirrors the legacy view page's delete gate exactly: only offer delete
    // once the record has never generated a child journal. The backend also
    // hard-blocks this server-side regardless.
    if (this.canDelete && (row.childJournalsQty ?? 0) === 0 && !row.hasJournals) {
      items.push({ label: 'COMMON.DELETE', danger: true, click: () => this.delete(row) });
    }
    return items;
  }
  hasRowMenu = (row: RecurringJournalListRow): boolean => this.rowMenuItems(row).length > 0;

  onRowClick(event: any): void {
    const row = event.row as RecurringJournalListRow;
    if (row) this.view(row);
  }

  view(row: RecurringJournalListRow): void {
    this.router.navigate(['/account/recurring-journal', row.id]);
  }

  edit(row: RecurringJournalListRow): void {
    this.router.navigate(['/account/recurring-journal', row.id, 'edit']);
  }

  addNew(): void {
    this.router.navigate(['/account/recurring-journal/new']);
  }

  async delete(row: RecurringJournalListRow): Promise<void> {
    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.lang.instant('COMMON.DELETE'),
        message: this.lang.instant('COMMON.CONFIRM_DELETE'),
        confirm: this.lang.instant('COMMON.DELETE'),
        danger: true,
      },
    });
    const confirmed = await ref.afterClosed();
    if (!confirmed) return;

    try {
      await this.service.delete(row.id);
      this.toast.success('COMMON.DELETED_OK');
      this.listPage?.refresh();
    } catch (err: any) {
      this.toast.error('COMMON.DELETE_FAILED', err?.message);
      await this.errorService.handleError(err);
    }
  }
}
