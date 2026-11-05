import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';

import { PeriodType, SavedTarget, TargetStatus } from '../../models/sales-target.model';
import { SalesTargetService } from '../../services/sales-target.service';
import { anchorOfTarget, targetStatus } from '../../services/sales-target-calc';

/** What the drawer hands back: which target, and whether to open it on the dashboard or edit it. */
export interface SavedTargetPick { action: 'open' | 'edit'; target: SavedTarget; }

interface Row { target: SavedTarget; label: string; status: TargetStatus; total: number; }
interface YearOpt { value: number | null; label: string; }

const PAGE = 15;

/**
 * "Saved Targets" (legacy `TargetsDrawerComponent`): every stored target, filterable by period type and year, searchable
 * (the server matches the period type only), ordered by newest saved or by amount, loaded page by page as you scroll.
 */
@Component({
  selector: 'app-saved-targets-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, SegmentedToggleComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-targets-drawer.component.html',
  styleUrl: './saved-targets-drawer.component.scss',
})
export class SavedTargetsDrawerComponent implements OnInit {
  private ref = inject<ModalRef<SavedTargetPick | null>>(MODAL_REF);
  private service = inject(SalesTargetService);
  private lang = inject(LanguageService);

  rows = signal<Row[]>([]);
  total = signal(0);
  loading = signal(false);
  loadingMore = signal(false);
  failed = signal(false);

  search = signal('');
  filter = signal<PeriodType | 'all'>('all');
  sort = signal<'latest' | 'target'>('latest');
  year = signal<number | null>(null);
  private page = 1;
  private timer?: ReturnType<typeof setTimeout>;

  hasMore = computed(() => this.rows().length < this.total());

  readonly filterOptions: SegmentedToggleOption<PeriodType | 'all'>[] = [
    { value: 'all', label: 'SALES_TARGET.DRAWER.ALL' },
    { value: 'monthly', label: 'SALES_TARGET.PERIOD.monthly' },
    { value: 'quarterly', label: 'SALES_TARGET.PERIOD.quarterly' },
    { value: 'yearly', label: 'SALES_TARGET.PERIOD.yearly' },
  ];
  readonly sortOptions: SegmentedToggleOption<'latest' | 'target'>[] = [
    { value: 'latest', label: 'SALES_TARGET.DRAWER.LATEST' },
    { value: 'target', label: 'SALES_TARGET.DRAWER.BY_TARGET' },
  ];
  readonly years: YearOpt[] = (() => {
    const y = new Date().getFullYear();
    return [{ value: null, label: this.lang.instant('SALES_TARGET.DRAWER.ALL_YEARS') },
      ...Array.from({ length: 10 }, (_, i) => ({ value: y + 2 - i, label: String(y + 2 - i) }))];
  })();

  ngOnInit(): void { void this.fetch(true); }

  private async fetch(reset: boolean): Promise<void> {
    if (reset) { this.page = 1; this.loading.set(true); this.failed.set(false); } else { this.page++; this.loadingMore.set(true); }
    try {
      const res = await this.service.list({
        page: this.page, limit: PAGE, searchTerm: this.search().trim(),
        period: this.filter(), year: this.year(), sortBy: this.sort(),
      });
      this.total.set(res.total);
      const mapped = res.rows.map<Row>(t => ({ target: t, label: this.labelOf(t), status: targetStatus(t), total: Number(t.totalSalesTarget) || 0 }));
      this.rows.set(reset ? mapped : [...this.rows(), ...mapped]);
    } catch {
      if (reset) this.failed.set(true); else this.page--;
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  private labelOf(t: SavedTarget): string {
    const a = anchorOfTarget(t);
    if (t.period === 'monthly') return new Date(a.year, a.month - 1, 1).toLocaleString(this.lang.current(), { month: 'long', year: 'numeric' });
    if (t.period === 'quarterly') return `Q${a.quarter} ${a.year}`;
    return String(a.year);
  }

  // ── controls ────────────────────────────────────────────────────────
  setFilter(f: PeriodType | 'all'): void { this.filter.set(f); void this.fetch(true); }
  setSort(s: 'latest' | 'target'): void { this.sort.set(s); void this.fetch(true); }

  onSearch(v: string): void {
    this.search.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.fetch(true), 350);
  }

  yearLabel = (o: YearOpt | null) => o?.label ?? '';
  yearSame = (a: YearOpt | null, b: YearOpt | null) => a?.value === b?.value;
  yearValue = (o: YearOpt | null) => o?.value ?? null;
  selectedYear = (): YearOpt | null => this.years.find(y => y.value === this.year()) ?? this.years[0];
  onYear(v: YearOpt | YearOpt[] | null): void { const o = Array.isArray(v) ? v[0] : v; this.year.set(o?.value ?? null); void this.fetch(true); }

  onScroll(e: Event): void {
    const el = e.target as HTMLElement;
    if (this.loadingMore() || this.loading() || !this.hasMore()) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) void this.fetch(false);
  }

  pick(action: 'open' | 'edit', row: Row): void { this.ref.close({ action, target: row.target }); }
  close(): void { this.ref.close(null); }
}
