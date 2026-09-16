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

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective } from '@shared/components/list-page/directives/list-template.directives';
import type {
  TableColumn,
  ListQueryParams,
  ListResponse,
} from '@shared/components/list-page/interfaces/list-page.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';

import { BranchSettingsService } from '../../../services/branch-settings.service';
import { BankingOverviewService } from '../../services/banking-overview.service';
import { ReconciliationTransaction } from '../../services/banking-overview.types';
import { AccountHeaderComponent } from '../../components/account-header/account-header.component';

interface BranchOption { id: string; name: string; }

type ReconcileFilter = 'all' | 'reconciled' | 'unreconciled';

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
    SegmentedToggleComponent,
    SearchDropdownComponent,
    DatePickerComponent,
    BreadcrumbsComponent,
    AccountHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
})
export class TransactionsComponent implements OnInit {
  private service    = inject(BankingOverviewService);
  private branchSvc  = inject(BranchSettingsService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  accountId   = signal<string>('');
  accountName = signal<string>('');

  statusFilter = signal<ReconcileFilter>('all');
  dateRange    = signal<DateRange | null>(null);
  branches     = signal<BranchOption[]>([]);
  branchId     = signal<string | null>(null);

  private i18nTick = signal(0);

  statusOptions: SegmentedToggleOption<ReconcileFilter>[] = [
    { value: 'all',          label: 'BANKING_OVERVIEW.STATUS.ALL' },
    { value: 'reconciled',   label: 'BANKING_OVERVIEW.STATUS.RECONCILED' },
    { value: 'unreconciled', label: 'BANKING_OVERVIEW.STATUS.UNRECONCILED' },
  ];

  branchDisplay = (b: BranchOption) => b?.name ?? '';
  branchCompare = (a: BranchOption, b: BranchOption) => a?.id === b?.id;
  selectedBranch = computed<BranchOption | null>(
    () => this.branches().find(b => b.id === this.branchId()) ?? null);

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
    await Promise.all([this.loadAccountName(), this.loadBranches()]);
  }

  private initColumns(): void {
    const t = (key: string) => this.translate.instant(key);
    this.columns = [
      { key: 'date',               label: t('BANKING_OVERVIEW.TRANSACTIONS.DATE'),    sortable: true,  width: '120px' },
      { key: 'reference',          label: t('BANKING_OVERVIEW.TRANSACTIONS.TYPE'),     customTemplate: true },
      { key: 'transactionDetails', label: t('BANKING_OVERVIEW.TRANSACTIONS.DETAILS') },
      { key: 'Debit',              label: t('BANKING_OVERVIEW.TRANSACTIONS.DEBIT'),    customTemplate: true, align: 'right' },
      { key: 'Credit',             label: t('BANKING_OVERVIEW.TRANSACTIONS.CREDIT'),   customTemplate: true, align: 'right' },
      { key: 'reconcile',          label: t('BANKING_OVERVIEW.TRANSACTIONS.STATUS'),   customTemplate: true },
    ];
  }

  private async loadAccountName(): Promise<void> {
    try {
      this.accountName.set(await this.service.getAccountName(this.accountId()));
    } catch (e) {
      console.error('[banking-overview] loadAccountName failed', e);
    }
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branches.set(res.list.map(b => ({ id: b.id, name: b.name })));
    } catch (e) {
      console.error('[banking-overview] loadBranches failed', e);
    }
  }

  onStatusChange(v: ReconcileFilter): void {
    this.statusFilter.set(v);
    this.listPage?.refresh();
  }

  onDateRangeChange(value: DateRange | Date | null): void {
    // `mode="range"` always yields a DateRange (or null); the union is only
    // there because DatePickerComponent's output type isn't mode-narrowed.
    this.dateRange.set(value && !(value instanceof Date) ? value : null);
    this.listPage?.refresh();
  }

  /** `yyyy-MM-dd`, local calendar date (not UTC) so day boundaries match
   *  what the user picked regardless of timezone offset. */
  private toIsoDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  onBranchChange(option: BranchOption | BranchOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.branchId.set(opt?.id ?? null);
    this.listPage?.refresh();
  }

  loadTransactions = async (params: ListQueryParams): Promise<ListResponse<ReconciliationTransaction>> => {
    const status = this.statusFilter();
    const range  = this.dateRange();
    const res = await this.service.getTransactions({
      accountId:     this.accountId(),
      branchId:      this.branchId(),
      fromDate:      range?.start ? this.toIsoDate(range.start) : null,
      toDate:        range?.end   ? this.toIsoDate(range.end)   : null,
      reconcile:     status === 'all' ? undefined : status === 'reconciled',
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
