import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import type {
  TableColumn,
  ListQueryParams,
  ListResponse,
  FilterConfig,
} from '@shared/components/list-page/interfaces/list-page.types';

import { BankingOverviewService } from '../../services/banking-overview.service';
import { BankAccountOverviewRow } from '../../services/banking-overview.types';

/**
 * Banking Overview — landing page.
 *
 * The endpoint (`accounts/bankOverView`) returns every account in one
 * response (no server paging), so the `<app-list-page>` dataSource fetches
 * once and does search / sort / paging in memory.
 */
@Component({
  selector: 'app-banking-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banking-overview.component.html',
  styleUrl: './banking-overview.component.scss',
})
export class BankingOverviewComponent {
  private service    = inject(BankingOverviewService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  private i18nTick = signal(0);
  private cache: BankAccountOverviewRow[] | null = null;

  columns: TableColumn<BankAccountOverviewRow>[] = [];
  /** Filter button + chips of the list page: account type and reconciliation status. */
  filters: FilterConfig[] = [];

  /** Account types present in the data, for the Type filter (the endpoint returns every account, so no extra call). */
  private loadTypeOptions = async (p: { page: number; pageSize: number; search: string }) => {
    if (!this.cache) {
      try { this.cache = await this.service.getBankingOverview(); } catch { this.cache = []; }
    }
    const term = (p.search || '').trim().toLowerCase();
    const types = [...new Set(this.cache.map(r => r.type).filter(Boolean))]
      .filter(t => !term || t.toLowerCase().includes(term))
      .sort((a, b) => a.localeCompare(b));
    return { items: types.map(t => ({ value: t, label: t })), hasMore: false };
  };

  constructor() {
    withTranslations('settings/banking-overview');
    this.initColumns();
    const rebuild = () => { this.i18nTick.update(n => n + 1); this.initColumns(); };
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(rebuild);
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(rebuild);
  }

  private initColumns(): void {
    const t = (key: string) => this.translate.instant(key);
    this.columns = [
      { key: 'name',                  label: t('BANKING_OVERVIEW.LIST.NAME'),        sortable: true, primary: true, highlight: true },
      { key: 'type',                  label: t('BANKING_OVERVIEW.LIST.TYPE'),        sortable: true },
      { key: 'transactionCount',      label: t('BANKING_OVERVIEW.LIST.TRANSACTIONS'), sortable: true, align: 'right', customTemplate: true },
      { key: 'lastTransactionDate',   label: t('BANKING_OVERVIEW.LIST.LAST_TRANSACTION'), sortable: true, customTemplate: true },
      { key: 'lastReconciledTo',      label: t('BANKING_OVERVIEW.LIST.LAST_RECONCILED'),  sortable: true, customTemplate: true },
      { key: 'hasOpenReconciliation', label: t('BANKING_OVERVIEW.LIST.RECONCILIATION_STATUS'), customTemplate: true },
      { key: 'balance',               label: t('BANKING_OVERVIEW.LIST.BALANCE'),     sortable: true, align: 'right', customTemplate: true },
    ];
    this.filters = [
      {
        type: 'dropdown',
        key: 'types',
        label: t('BANKING_OVERVIEW.LIST.TYPE'),
        multiple: true,
        loadFn: p => this.loadTypeOptions(p),
      },
      {
        type: 'checkbox-group',
        key: 'reconciliation',
        label: t('BANKING_OVERVIEW.LIST.RECONCILIATION_STATUS'),
        options: [
          { value: 'in-progress', label: t('BANKING_OVERVIEW.STATUS.IN_PROGRESS') },
          { value: 'never',       label: t('BANKING_OVERVIEW.LIST.NEVER_RECONCILED') },
        ],
      },
    ];
  }

  loadAccounts = async (params: ListQueryParams): Promise<ListResponse<BankAccountOverviewRow>> => {
    // A fresh fetch on page 1 / new search keeps balances current; later pages reuse it.
    if (!this.cache || params.page === 1) {
      try {
        this.cache = await this.service.getBankingOverview();
      } catch (e) {
        console.error('[banking-overview] load failed', e);
        this.cache = [];
      }
    }

    let rows = [...this.cache];
    const term = (params.searchTerm || '').trim().toLowerCase();
    if (term) {
      rows = rows.filter(r => r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term));
    }

    const f = params.filter ?? {};
    const asList = (v: unknown): string[] =>
      (Array.isArray(v) ? v : v ? [v] : []).map((x: any) => String(x && typeof x === 'object' ? (x.value ?? x.id) : x));
    const types = asList(f['types']);
    if (types.length) rows = rows.filter(r => types.includes(r.type));
    // Ticked reconciliation states combine as "any of".
    const rec = asList(f['reconciliation']);
    if (rec.length) {
      rows = rows.filter(r =>
        (rec.includes('in-progress') && r.hasOpenReconciliation) ||
        (rec.includes('never') && !r.lastReconciledTo));
    }

    const sort = params.sortBy;
    if (sort?.sortValue) {
      const key = sort.sortValue as keyof BankAccountOverviewRow;
      const dir = sort.sortDirection === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }

    const limit = params.limit || 25;
    const start = (params.page - 1) * limit;
    return {
      list: rows.slice(start, start + limit),
      count: rows.length,
      pageCount: Math.max(1, Math.ceil(rows.length / limit)),
    };
  };

  rowMenuItems(row: BankAccountOverviewRow): DropdownMenuBtnItem[] {
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('BANKING_OVERVIEW.LIST.VIEW_TRANSACTIONS'), click: () => this.openTransactions(row) },
      { label: t('BANKING_OVERVIEW.LIST.RECONCILIATIONS'),
        click: () => void this.router.navigate(['/account/banking-overview/reconciliations', row.id]) },
      { label: t('BANKING_OVERVIEW.RECONCILIATIONS.RECONCILE_BY_FILE'),
        click: () => void this.router.navigate(['/account/banking-overview/file-reconciliation', row.id]) },
    ];
  }

  openTransactions(row: BankAccountOverviewRow): void {
    void this.router.navigate(['/account/banking-overview/transactions', row.id]);
  }
}
