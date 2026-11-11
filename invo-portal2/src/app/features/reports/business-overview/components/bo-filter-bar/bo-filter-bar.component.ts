import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DatePreset, DateRange } from '@shared/components/datepicker/date-picker.types';
import { ModalService } from '@shared/modal/modal.service';
import { toIso } from '../../../utils/report-period.util';
import { BoFilter, normalizeFilter } from '../../shared/bo-filter';
import {
  BoFiltersModalComponent, BoFiltersModalData, BranchOption,
} from '../bo-filters-modal/bo-filters-modal.component';
import { BoDateModalComponent, BoDateModalData, BoDateModalResult } from '../bo-date-modal/bo-date-modal.component';

export type { BranchOption };
interface Tag { key: 'branches' | 'compare'; text: string; }

/**
 * Filter row for the Business Overview reports, laid out like the legacy
 * `<app-filter-bar>`: a date button, a "Filters" button (active-count badge)
 * that opens the branch + comparison modal, "Clear all", and a strip of
 * applied-filter tags. Stateless — it renders `filter` and emits a normalised
 * copy on every change; the host owns the state (URL).
 */
@Component({
  selector: 'app-bo-filter-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule, DatePickerComponent],
  templateUrl: './bo-filter-bar.component.html',
  styleUrl: './bo-filter-bar.component.scss',
})
export class BoFilterBarComponent {
  private lang = inject(LanguageService);
  private modal = inject(ModalService);

  /** Phones get the date picker as a modal (Cancel / Apply) instead of the cramped popover. */
  isMobile = signal(false);

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 639px)');
    this.isMobile.set(mq.matches);
    const on = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
    mq.addEventListener('change', on);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', on));
  }

  /** Text of the date button when it opens the modal. */
  dateLabel = computed(() => {
    const f = this.filter();
    const fmt = (iso: string) => new Date(iso + 'T00:00:00')
      .toLocaleDateString(this.lang.current(), { month: 'short', day: '2-digit', year: 'numeric' });
    return f.asOf ? fmt(f.to) : `${fmt(f.from)} → ${fmt(f.to)}`;
  });

  async openDateModal(): Promise<void> {
    const f = this.filter();
    const ref = this.modal.open<BoDateModalComponent, BoDateModalData, BoDateModalResult>(BoDateModalComponent, {
      size: 'md',
      data: { asOf: f.asOf, from: f.from, to: f.to, asOfOptional: this.asOfOptional(), presets: this.presets },
    });
    const r = await ref.afterClosed();
    if (r) this.patch({ asOf: r.asOf, from: r.from, to: r.to });
  }

  filter = input.required<BoFilter>();
  /** The report may be switched between an "as of" date and a from–to range (legacy "As of" checkbox). */
  asOfOptional = input(false);
  /** Single "as of" date instead of a from–to range — comes from the filter. */
  asOf = computed(() => this.filter().asOf);
  /** Show the comparison section in the Filters modal. */
  comparison = input(false);
  branches = input<BranchOption[]>([]);

  filterChange = output<BoFilter>();

  /**
   * Same list as the legacy date picker (week / quarter / year-to-date included), in its order.
   * Weeks run Sunday–Saturday like the legacy (`moment().startOf('week')`); "This …" ranges cover the
   * whole week / month / quarter / year, "Year to date" stops today.
   */
  readonly presets: DatePreset[] = ((): DatePreset[] => {
    const day = (y: number, m: number, d: number) => new Date(y, m, d);
    const mk = (labelKey: string, range: (t: Date) => { start: Date; end: Date }): DatePreset => ({
      label: this.lang.instant(labelKey),
      range: () => range(new Date()),
    });
    const weekStart = (t: Date, back = 0) => day(t.getFullYear(), t.getMonth(), t.getDate() - t.getDay() - 7 * back);
    const quarterStart = (t: Date, back = 0) => day(t.getFullYear(), Math.floor(t.getMonth() / 3) * 3 - 3 * back, 1);
    return [
      mk('REPORTS.PERIOD.TODAY', t => ({ start: day(t.getFullYear(), t.getMonth(), t.getDate()), end: day(t.getFullYear(), t.getMonth(), t.getDate()) })),
      mk('REPORTS.PERIOD.THIS_WEEK', t => { const s = weekStart(t); return { start: s, end: day(s.getFullYear(), s.getMonth(), s.getDate() + 6) }; }),
      mk('REPORTS.PERIOD.THIS_MONTH', t => ({ start: day(t.getFullYear(), t.getMonth(), 1), end: day(t.getFullYear(), t.getMonth() + 1, 0) })),
      mk('REPORTS.PERIOD.THIS_QUARTER', t => { const s = quarterStart(t); return { start: s, end: day(s.getFullYear(), s.getMonth() + 3, 0) }; }),
      mk('REPORTS.PERIOD.THIS_YEAR', t => ({ start: day(t.getFullYear(), 0, 1), end: day(t.getFullYear(), 11, 31) })),
      mk('REPORTS.PERIOD.YEAR_TO_DATE', t => ({ start: day(t.getFullYear(), 0, 1), end: day(t.getFullYear(), t.getMonth(), t.getDate()) })),
      mk('REPORTS.PERIOD.YESTERDAY', t => { const y = day(t.getFullYear(), t.getMonth(), t.getDate() - 1); return { start: y, end: y }; }),
      mk('REPORTS.PERIOD.PREVIOUS_WEEK', t => { const s = weekStart(t, 1); return { start: s, end: day(s.getFullYear(), s.getMonth(), s.getDate() + 6) }; }),
      mk('REPORTS.PERIOD.PREVIOUS_MONTH', t => ({ start: day(t.getFullYear(), t.getMonth() - 1, 1), end: day(t.getFullYear(), t.getMonth(), 0) })),
      mk('REPORTS.PERIOD.PREVIOUS_QUARTER', t => { const s = quarterStart(t, 1); return { start: s, end: day(s.getFullYear(), s.getMonth() + 3, 0) }; }),
      mk('REPORTS.PERIOD.PREVIOUS_YEAR', t => ({ start: day(t.getFullYear() - 1, 0, 1), end: day(t.getFullYear() - 1, 11, 31) })),
    ];
  })();

  rangeValue = computed<DateRange>(() => ({
    start: new Date(this.filter().from + 'T00:00:00'),
    end: new Date(this.filter().to + 'T00:00:00'),
  }));
  singleValue = computed(() => new Date(this.filter().to + 'T00:00:00'));

  /** The Filters button is only needed when it has something to hold. */
  hasModal = computed(() => this.branches().length > 0 || this.comparison());

  /** Applied-filter tags (branches / comparison) — the legacy "Applied:" strip. */
  tags = computed<Tag[]>(() => {
    const f = this.filter();
    const out: Tag[] = [];
    if (f.branches.length) {
      const ids = new Set(f.branches);
      const names = this.branches().filter(b => ids.has(b.value)).map(b => b.label);
      out.push({
        key: 'branches',
        text: `${this.lang.instant('REPORTS.BO.FILTERS.BRANCHES')}: ${names.length ? names.join(', ') : f.branches.length}`,
      });
    }
    if (f.compareType !== 'none') {
      const what = f.compareType === 'branch'
        ? this.lang.instant('REPORTS.BO.COMPARE.BRANCH')
        : `${f.compareQty} ${this.lang.instant(f.comparePeriod === 'Year' ? 'REPORTS.BO.COMPARE.YEARS' : 'REPORTS.BO.COMPARE.MONTHS')}`;
      out.push({ key: 'compare', text: `${this.lang.instant('REPORTS.BO.COMPARE.LABEL')}: ${what}` });
    }
    return out;
  });

  private patch(p: Partial<BoFilter>): void {
    this.filterChange.emit(normalizeFilter({ ...this.filter(), ...p }));
  }

  onRange(r: DateRange | null): void {
    if (r?.start && r?.end) this.patch({ from: toIso(r.start), to: toIso(r.end) });
  }
  onSingle(d: Date | null): void {
    if (d) this.patch({ to: toIso(d) });
  }

  /** The "As of" checkbox: ticked = one date, unticked = a range (starting with that date's month). */
  onAsOf(checked: boolean): void {
    const to = new Date(this.filter().to + 'T00:00:00');
    this.patch(checked
      ? { asOf: true }
      : { asOf: false, from: toIso(new Date(to.getFullYear(), to.getMonth(), 1)), to: toIso(new Date(to.getFullYear(), to.getMonth() + 1, 0)) });
  }

  async openFilters(): Promise<void> {
    const ref = this.modal.open<BoFiltersModalComponent, BoFiltersModalData, BoFilter>(BoFiltersModalComponent, {
      size: 'md',
      data: { filter: this.filter(), branches: this.branches(), comparison: this.comparison() },
    });
    const result = await ref.afterClosed();
    if (result) this.filterChange.emit(result);
  }

  removeTag(t: Tag): void {
    this.patch(t.key === 'branches' ? { branches: [] } : { compareType: 'none' });
  }
  clearAll(): void { this.patch({ branches: [], compareType: 'none' }); }
}
