import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';

import { Budget } from '../../models/budget.model';
import { BudgetService } from '../../services/budget.service';
import { BudgetActions } from '../../services/budget-actions';

/**
 * Budgets -> list (`/account/budget`). Legacy `BudgetComponent`: name / branch / created / periodicity (plus the year,
 * which the search also matches), server-side search, sort and paging, and per row the Budget vs Actual report,
 * edit and delete. Only `name`, `branchName`, `periodicity`, `year` and `createdAt` can be sorted by the server.
 */
@Component({
  selector: 'app-budget-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  templateUrl: './budget-list.component.html',
})
export class BudgetListComponent implements OnInit {
  private service = inject(BudgetService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  readonly actions = inject(BudgetActions);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  columns: TableColumn[] = [];
  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 400 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  ngOnInit(): void {
    const t = (k: string) => this.lang.instant(k);
    const L = 'BUDGET.LIST.';
    this.columns = [
      { key: 'name', label: t(L + 'NAME'), sortable: true, primary: true, locked: true, visible: true, order: 0 },
      { key: 'branchName', label: t(L + 'BRANCH'), sortable: true, visible: true, order: 1 },
      { key: 'year', label: t(L + 'YEAR'), sortable: true, visible: true, order: 2 },
      { key: 'periodicity', label: t(L + 'PERIODICITY'), sortable: true, customTemplate: true, visible: true, order: 3 },
      { key: 'createdAt', label: t(L + 'CREATED'), sortable: true, customTemplate: true, visible: true, order: 4 },
    ];
    this.searchConfig.placeholder = t(L + 'SEARCH_PLACEHOLDER');
    this.emptyState = { title: t(L + 'EMPTY'), message: '' };
    this.breadcrumbs = [{ label: t('BUDGET.DASHBOARD'), routerLink: '/dashboard' }, { label: t(L + 'TITLE') }];
  }

  loadBudgets = async (params: ListQueryParams) => {
    // The server orders by its default (newest first) only when no sort is sent at all - an empty `sortBy` breaks its query.
    const res = await this.service.getBudgetList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      ...(params.sortBy ? { sortBy: { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } } : {}),
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  periodicityLabel(p: string): string { return p ? this.lang.instant('BUDGET.PERIODICITY.' + p) : ''; }

  add(): void { void this.router.navigate(['/account/budget', 'new']); }
  edit(b: Budget): void { void this.router.navigate(['/account/budget', b.id]); }
  report(b: Budget): void { void this.router.navigate(['/account/budget', b.id, 'report']); }
  remove(b: Budget): void { void this.actions.runDelete(b.id, () => this.listPage?.refresh?.()); }

  /** Legacy opened the editor on a row click; a user who can't edit gets the report instead. */
  onRowClick(e: any): void {
    const row: Budget | undefined = e?.row;
    if (!row) return;
    if (this.actions.canEdit) this.edit(row); else this.report(row);
  }
}
