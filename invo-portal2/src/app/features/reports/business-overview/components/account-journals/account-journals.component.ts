import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { journalLink } from '../../../../settings/chart-of-accounts/utils/journal-links';
import { AccountJournalData, BusinessOverviewService } from '../../services/business-overview.service';
import { BoFilter } from '../../shared/bo-filter';
import { PAGING_PARAMS, pickPageSize } from '../../shared/paging-params';
import { BoStateComponent } from '../bo-state/bo-state.component';

/**
 * Account Journals — the drill-down sub-report behind P&L, Balance Sheet,
 * Trial Balance and General Ledger rows: every journal line of one account in
 * the parent's period/branches, with debit/credit totals and closing balance.
 */
@Component({
  selector: 'app-bo-account-journals',
  standalone: true,
  imports: [TranslateModule, RouterLink, DatePipe, MycurrencyPipe, BoStateComponent, PaginationComponent],
  templateUrl: './account-journals.component.html',
  styleUrl: './account-journals.component.scss',
})
export class AccountJournalsComponent {
  private svc = inject(BusinessOverviewService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  accountId = input.required<string>();
  accountName = input<string>('');
  filter = input.required<BoFilter>();
  /** The parent report is a point-in-time report (as-of date). */
  asOf = input(false);
  refresh = input(0);

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<AccountJournalData | null>(null);
  loaded = signal(false);
  page = signal(1);
  pageSize = signal(25);
  readonly sizes = [15, 25, 50, 100];

  private seq = 0;
  private prevKey = '';

  constructor() {
    withTranslations('settings/chart-of-accounts');
    // Page and page size come back from the URL, so a refresh (or a shared link) keeps them.
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    effect(() => {
      const key = JSON.stringify([this.accountId(), this.filter(), this.asOf()]);
      this.refresh();
      untracked(() => {
        if (this.prevKey && this.prevKey !== key) { this.page.set(1); this.persist(); }
        this.prevKey = key;
        void this.load();
      });
    });
  }

  lines = computed(() => this.data()?.journals ?? []);
  isEmpty = computed(() => this.loaded() && this.lines().length === 0);
  totals = computed(() => this.data()?.total ?? { debit: 0, credit: 0 });
  closing = computed(() => (this.totals().debit || 0) - (this.totals().credit || 0));

  link = (type: string, id?: string) => journalLink(type, id);

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.svc.accountJournal(this.accountId(), this.filter(), this.asOf(), {
        page: this.page(), limit: this.pageSize(),
      });
      if (mine !== this.seq) return;
      this.data.set(d);
      this.loaded.set(true);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  private persist(): void {
    this.urlState.write(PAGING_PARAMS, { page: this.page(), limit: this.pageSize(), sortBy: '', sortDirection: 'asc' });
  }

  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
}
