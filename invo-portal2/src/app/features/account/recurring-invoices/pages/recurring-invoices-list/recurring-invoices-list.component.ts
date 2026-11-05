import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import { FilterConfig, ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { BranchSettingsService } from '../../../../settings/services/branch-settings.service';

import { ymdOf } from '../../../services/document-list-base';
import { RecurringInvoicesService } from '../../services/recurring-invoices.service';
import { RecurringInvoiceActions, frequencyLabel } from '../../services/recurring-invoice-schedule';

/**
 * Recurring Invoices → list. Legacy `RecurringInvoiceComponent`: profile name, customer, frequency
 * sentence and the start / end / created dates, with server-side search (name / branch), sort and
 * paging and the branch filter. Row actions: View + Edit outside, Delete in the "⋯" menu — only for a
 * profile that never generated an invoice (the backend refuses it otherwise). The date filter narrows by
 * created date (`filter.fromDate` / `toDate`, honoured by getRecurringInvoiceList).
 */
@Component({
  selector: 'app-recurring-invoices-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent],
  templateUrl: './recurring-invoices-list.component.html',
})
export class RecurringInvoicesListComponent implements OnInit {
  private router = inject(Router);
  private service = inject(RecurringInvoicesService);
  private branches = inject(BranchSettingsService);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  readonly actions = inject(RecurringInvoiceActions);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/recurring-invoices');
    const t = (k: string) => this.lang.instant(k);
    const L = 'RECURRING_INVOICES.LIST.';

    this.columns = [
      { key: 'name', label: t(L + 'PROFILE_NAME'), sortable: true, primary: true, locked: true, visible: true, order: 0 },
      { key: 'customerName', label: t(L + 'CUSTOMER_NAME'), sortable: true, visible: true, order: 1 },
      { key: 'branchName', label: t(L + 'BRANCH_NAME'), sortable: true, visible: true, order: 2 },
      { key: 'frequency', label: t(L + 'FREQUENCY'), customTemplate: true, visible: true, order: 3 },
      { key: 'startDate', label: t(L + 'START_DATE'), sortable: true, customTemplate: true, visible: true, order: 4 },
      { key: 'endDate', label: t(L + 'END_DATE'), sortable: true, customTemplate: true, visible: true, order: 5 },
      { key: 'childInvoicesQty', label: t(L + 'GENERATED'), align: 'end', visible: true, order: 6 },
      { key: 'createdAt', label: t(L + 'CREATED_AT'), sortable: true, customTemplate: true, visible: false, order: 7 },
    ];

    this.filters = [
      { type: 'dropdown', key: 'branches', label: t('RECURRING_INVOICES.FILTERS.BRANCH'), multiple: true, loadFn: p => this.loadBranches(p) },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('RECURRING_INVOICES.FILTERS.DATE') },
    ];

    this.searchConfig.placeholder = t('RECURRING_INVOICES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: t('RECURRING_INVOICES.EMPTY'), message: '' };
    this.breadcrumbs = [
      { label: t('RECURRING_INVOICES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('RECURRING_INVOICES.LIST.TITLE') },
    ];
  }

  private async loadBranches(p: { page: number; pageSize: number; search: string }) {
    const res = await this.branches.getList({ page: p.page, limit: p.pageSize, searchTerm: p.search });
    return { items: res.list.map(b => ({ value: b.id, label: b.name })), hasMore: p.page * p.pageSize < res.count };
  }

  load = async (params: ListQueryParams) => {
    const b = params.filter?.['branches'];
    const branches: string[] = Array.isArray(b) ? b : b ? [b] : [];
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : {},
      filter: { branches, fromDate: ymdOf(params.filter?.['fromDate']), toDate: ymdOf(params.filter?.['toDate']) },
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  frequency = (row: any) => frequencyLabel(row?.repeatData, this.lang);

  rowMenu(row: any): DropdownMenuBtnItem[] { return this.actions.menu(row, row.id, () => this.listPage?.refresh?.()); }

  add(): void { void this.router.navigate(['/account/recurring-invoice', 'new']); }
  view(r: any): void { void this.router.navigate(['/account/recurring-invoice/view', r.id]); }
  edit(r: any): void { void this.router.navigate(['/account/recurring-invoice', r.id]); }
  onRowClick(e: any): void { if (e?.row) this.view(e.row); }
}
