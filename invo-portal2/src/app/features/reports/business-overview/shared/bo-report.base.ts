import { Directive, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { BoReportConfig } from '../config/business-overview.config';
import { BoFilter, filterToQuery } from './bo-filter';
import { ReportRecord } from './accounting.utils';

/**
 * Common behaviour of the Business Overview report pages (legacy
 * `BaseBusinessOverviewReportComponent`): load when the filter or the
 * host's refresh counter changes, expose loading / error / data signals, and
 * drill into Account Journals.
 *
 * Unlike the legacy base there is no shared state-manager singleton — the host
 * passes the filter in, so a report can never read another report's leftover
 * filter. Out-of-order responses are dropped with a sequence guard.
 */
@Directive()
export abstract class BoReportBase<T> {
  protected router = inject(Router);
  protected lang = inject(LanguageService);

  filter = input.required<BoFilter>();
  /** Incremented by the host's Refresh button. */
  refresh = input(0);

  abstract readonly cfg: BoReportConfig;

  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<T | null>(null);
  /** True once a response (even an empty one) has arrived. */
  loaded = signal(false);

  private seq = 0;

  protected abstract fetch(f: BoFilter): Promise<T>;
  /** Hook to post-process a fresh response before it is published. */
  protected afterLoad(_data: T): void {}

  /** Called when the filter itself changed (not on Refresh) — e.g. reset paging. */
  protected onFilterChange(): void {}

  private prevFilter: BoFilter | null = null;

  constructor() {
    effect(() => {
      const f = this.filter();
      this.refresh();
      untracked(() => {
        if (this.prevFilter && this.prevFilter !== f) this.onFilterChange();
        this.prevFilter = f;
        void this.load(f);
      });
    });
  }

  async load(f: BoFilter = this.filter()): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const d = await this.fetch(f);
      if (mine !== this.seq) return; // a newer request superseded this one
      this.afterLoad(d);
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

  /** Open the Account Journals sub-report for a row, inheriting the filter. */
  drill(r: ReportRecord): void {
    if (!r.accountId) return;
    void this.router.navigate(['/reports/view', this.cfg.slug, 'account-journals'], {
      queryParams: {
        ...filterToQuery(this.filter(), this.cfg.asOf),
        accountId: r.accountId,
        account: r.account ?? null,
      },
    });
  }
}
