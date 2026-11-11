import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { journalLink } from '../../../../settings/chart-of-accounts/utils/journal-links';
import { QueryParamsService } from '@shared/services/query-params.service';
import { findBoReport } from '../../config/business-overview.config';
import { BusinessOverviewService, JournalEntriesData } from '../../services/business-overview.service';
import { BoFilter, BoSort } from '../../shared/bo-filter';
import { BoReportBase } from '../../shared/bo-report.base';
import { PAGING_PARAMS, pickPageSize, pickSort } from '../../shared/paging-params';
import { BoAccountNamePipe } from '../../shared/pipes/bo-account-name.pipe';
import { BoStateComponent } from '../bo-state/bo-state.component';

@Component({
  selector: 'app-bo-journal-entries',
  standalone: true,
  imports: [TranslateModule, RouterLink, MycurrencyPipe, BoAccountNamePipe, BoStateComponent, PaginationComponent],
  templateUrl: './journal-entries.component.html',
  styleUrl: './journal-entries.component.scss',
})
export class JournalEntriesComponent extends BoReportBase<JournalEntriesData> {
  readonly cfg = findBoReport('journal-entries')!;
  private svc = inject(BusinessOverviewService);
  private urlState = inject(QueryParamsService);

  /** Columns the API can sort by (the names it returns). */
  readonly sortable = ['AccountType', 'reference', 'referenceNumber', 'Debit', 'Credit'] as const;
  sort = signal<BoSort | null>(null);

  page = signal(1);
  pageSize = signal(25);
  readonly sizes = [10, 25, 50, 100];

  constructor() {
    super();
    withTranslations('settings/chart-of-accounts');
    // Page, page size and sort come back from the URL, so a refresh (or a shared link) keeps them.
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    this.sort.set(pickSort(u.sortBy, u.sortDirection, this.sortable));
  }

  /** Writes page / page size / sort to the URL (defaults are left out). */
  private persist(): void {
    const s = this.sort();
    this.urlState.write(PAGING_PARAMS, {
      page: this.page(), limit: this.pageSize(), sortBy: s?.sortValue ?? '', sortDirection: s?.sortDirection ?? 'asc',
    });
  }

  protected override onFilterChange(): void { this.page.set(1); this.persist(); }
  protected fetch(f: BoFilter): Promise<JournalEntriesData> {
    return this.svc.journalEntries(this.cfg, f, { page: this.page(), limit: this.pageSize(), sort: this.sort() });
  }

  records = computed(() => this.data()?.records ?? []);
  isEmpty = computed(() => this.loaded() && this.records().length === 0);

  /** Link to the source document, empty when the type has no view page here. */
  link = (reference: string, id: string) => journalLink(reference, id);

  /** Header click: ascending → descending → back to the default order. */
  sortBy(col: string): void {
    const cur = this.sort();
    this.sort.set(cur?.sortValue !== col ? { sortValue: col, sortDirection: 'asc' }
      : cur.sortDirection === 'asc' ? { sortValue: col, sortDirection: 'desc' } : null);
    this.page.set(1);
    this.persist();
    void this.load();
  }
  ariaSort(col: string): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s?.sortValue !== col ? 'none' : s.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }
}
