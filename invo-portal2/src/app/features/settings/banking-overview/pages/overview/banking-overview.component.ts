import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

import { BankingOverviewService } from '../../services/banking-overview.service';
import { BankAccountOverviewRow } from '../../services/banking-overview.types';

/**
 * Banking Overview — landing page.
 *
 * Small, non-paginated list of bank/cash accounts and their current
 * balance (the repo always computes "as of today" — see the service
 * doc-comment). A plain client-side table via `<app-list-shell>` is a
 * better fit here than `<app-list-page>`, which is built around a
 * server-paginated `dataSource`; this dataset is a handful of rows.
 */
@Component({
  selector: 'app-banking-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, MycurrencyPipe, ListShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banking-overview.component.html',
  styleUrl: './banking-overview.component.scss',
})
export class BankingOverviewComponent implements OnInit {
  private service    = inject(BankingOverviewService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  rows    = signal<BankAccountOverviewRow[]>([]);
  search  = signal<string>('');

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('BANKING_OVERVIEW.TITLE') },
    ];
  });

  filteredRows = computed<BankAccountOverviewRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.rows();
    if (!term) return list;
    return list.filter(r =>
      r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term));
  });

  totalBalance = computed(() => this.filteredRows().reduce((s, r) => s + (r.balance || 0), 0));

  constructor() {
    withTranslations('settings/banking-overview');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.service.getBankingOverview();
      this.rows.set(rows);
    } catch (e) {
      console.error('[banking-overview] load failed', e);
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(term: string): void { this.search.set(term); }
  onClearSearch(): void { this.search.set(''); }

  openTransactions(row: BankAccountOverviewRow): void {
    void this.router.navigate(['/account/banking-overview/transactions', row.id]);
  }
}
