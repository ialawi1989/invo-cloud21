import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import type {
  TableColumn,
  ListQueryParams,
  ListResponse,
  FilterConfig,
} from '@shared/components/list-page/interfaces/list-page.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';

import { journalLink } from '../../../chart-of-accounts/utils/journal-links';
import { BankingOverviewService } from '../../services/banking-overview.service';
import { ReconciliationTransaction } from '../../services/banking-overview.types';
import { AccountHeaderComponent } from '../../components/account-header/account-header.component';

/**
 * Per-account transactions ledger. Filters: date range, reconcile status
 * (all / reconciled / unreconciled) and branch — all applied server-side
 * through `BankingOverviewService.getTransactions`.
 */
@Component({
  selector: 'app-banking-transactions',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    ListPageComponent,
    ListCellTemplateDirective,
    BreadcrumbsComponent,
    AccountHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
})
export class TransactionsComponent implements OnInit {
  private service    = inject(BankingOverviewService);
  private privilege  = inject(PrivilegeService);

  /** Legacy gate: `reconciliationSecurity.actions.view` shows the button. */
  get canReconcile(): boolean { return this.privilege.check('reconciliationSecurity.actions.view.access'); }
  private translate  = inject(TranslateService);
  private router     = inject(Router);

  /** Source document of a ledger row (legacy `LinkedTypes`): '' when the type has no page here. */
  docLink(row: ReconciliationTransaction): string {
    return journalLink(row.reference, row.referenceId);
  }
  private route      = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  accountId   = signal<string>('');
  accountName = signal<string>('');

  /** Filter button + chips of the list page (same as Products): status, date range and branch. */
  filters: FilterConfig[] = [];

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('BANKING_OVERVIEW.TITLE'), routerLink: '/account/banking-overview' },
      { label: this.accountName() || '—' },
    ];
  });

  columns: TableColumn<ReconciliationTransaction>[] = [];

  constructor() {
    withTranslations('settings/banking-overview');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.i18nTick.update(n => n + 1); this.initColumns(); });
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.i18nTick.update(n => n + 1); this.initColumns(); });
  }

  async ngOnInit(): Promise<void> {
    this.initColumns();
    this.accountId.set(this.route.snapshot.paramMap.get('accountId') || '');
    await this.loadAccountName();
  }

  private initColumns(): void {
    const t = (key: string) => this.translate.instant(key);
    this.columns = [
      { key: 'date',               label: t('BANKING_OVERVIEW.TRANSACTIONS.DATE'),    sortable: true,  width: '120px', customTemplate: true },
      { key: 'reference',          label: t('BANKING_OVERVIEW.TRANSACTIONS.TYPE'),     customTemplate: true },
      { key: 'referenceNumber',    label: t('BANKING_OVERVIEW.TRANSACTIONS.REFERENCE'), customTemplate: true },
      { key: 'transactionDetails', label: t('BANKING_OVERVIEW.TRANSACTIONS.DETAILS') },
      { key: 'Debit',              label: t('BANKING_OVERVIEW.TRANSACTIONS.DEBIT'),    customTemplate: true, align: 'end' },
      { key: 'Credit',             label: t('BANKING_OVERVIEW.TRANSACTIONS.CREDIT'),   customTemplate: true, align: 'end' },
      { key: 'reconcile',          label: t('BANKING_OVERVIEW.TRANSACTIONS.STATUS'),   customTemplate: true },
    ];
    this.filters = [
      {
        type: 'checkbox-group',
        key: 'status',
        label: t('BANKING_OVERVIEW.TRANSACTIONS.STATUS'),
        options: [
          { value: 'reconciled',   label: t('BANKING_OVERVIEW.STATUS.RECONCILED') },
          { value: 'unreconciled', label: t('BANKING_OVERVIEW.STATUS.UNRECONCILED') },
        ],
      },
      { type: 'date-range', keyFrom: 'fromDate', keyTo: 'toDate', label: t('BANKING_OVERVIEW.FILTERS.DATE_RANGE') },
    ];
  }

  private async loadAccountName(): Promise<void> {
    try {
      this.accountName.set(await this.service.getAccountName(this.accountId()));
    } catch (e) {
      console.error('[banking-overview] loadAccountName failed', e);
    }
  }

  /** `yyyy-MM-dd`, local calendar date (not UTC) so day boundaries match
   *  what the user picked regardless of timezone offset. */
  private toIsoDate(v: unknown): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v.slice(0, 10);
    const d = v as Date;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  loadTransactions = async (params: ListQueryParams): Promise<ListResponse<ReconciliationTransaction>> => {
    const f = params.filter ?? {};
    // Ticking both statuses (or none) = all; exactly one restricts the ledger.
    const statuses: string[] = Array.isArray(f['status']) ? f['status'] : f['status'] ? [f['status']] : [];
    const res = await this.service.getTransactions({
      accountId:     this.accountId(),
      fromDate:      this.toIsoDate(f['fromDate']),
      toDate:        this.toIsoDate(f['toDate']),
      reconcile:     statuses.length === 1 ? statuses[0] === 'reconciled' : undefined,
      sortDirection: params.sortBy?.sortDirection === 'asc' ? 'ASC' : 'DESC',
      page:          params.page,
      limit:         params.limit,
      searchTerm:    params.searchTerm || '',
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  reconcileAccount(): void {
    void this.router.navigate(['/account/banking-overview/reconciliations', this.accountId()]);
  }
}
