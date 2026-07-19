import {
  Component, ElementRef, HostListener, inject, input, output, signal,
  computed, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DatePreset, DateRange } from '@shared/components/datepicker/date-picker.types';
import { ReportFilterFlags, ReportFilterState } from '../../models/report.model';
import { DATE_PRESETS, resolvePreset, toIso } from '../../utils/report-period.util';

export interface BranchOption { value: string; label: string; }

/**
 * Shared report filter toolbar — the modern equivalent of InvoCloudFront2's
 * `<filter-bar>`. Which controls appear is driven by the report's
 * `ReportFilterFlags`. The period control uses the app's shared
 * `<app-date-picker>` (range mode + quick presets, or single "As of" mode).
 * Emits a complete `ReportFilterState`; the report-view serializes it to the
 * URL (single source of truth).
 */
@Component({
  selector: 'app-report-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DatePickerComponent],
  templateUrl: './report-filter-bar.component.html',
  styleUrl: './report-filter-bar.component.scss',
})
export class ReportFilterBarComponent implements OnInit {
  private host = inject(ElementRef<HTMLElement>);
  private lang = inject(LanguageService);

  /** Which controls to show. */
  flags = input<ReportFilterFlags>({ date: true });
  /** Branch options (empty → branch selector hidden). */
  branches = input<BranchOption[]>([]);
  /** Initial filter state (restored from URL). */
  value = input<ReportFilterState>({ preset: 'thisMonth' });

  apply = output<ReportFilterState>();

  // ── Period (date-picker) state ───────────────────────────────────────
  isAsOf = computed(() => !!this.flags().asOf);
  /** Range value for range mode. */
  rangeValue = signal<DateRange | null>(null);
  /** Single value for "As of" mode. */
  singleValue = signal<Date | null>(null);

  /** Quick-pick presets shown in the picker's sidebar (range mode). */
  readonly presets: DatePreset[] = DATE_PRESETS.filter(p => p.key !== 'custom').map(p => ({
    label: this.lang.instant(p.labelKey),
    range: () => {
      const r = resolvePreset(p.key);
      return { start: new Date(r.from + 'T00:00:00'), end: new Date(r.to + 'T00:00:00') };
    },
  }));

  // ── Branch state ─────────────────────────────────────────────────────
  selectedBranches = signal<string[]>([]);
  compare = signal<boolean>(false);
  branchOpen = signal(false);

  showBranches = computed(() => !!this.flags().branches && this.branches().length > 0);

  ngOnInit(): void {
    const v = this.value();
    const range = resolvePreset(v.preset ?? 'thisMonth', { from: v.from, to: v.to });
    if (this.isAsOf()) {
      this.singleValue.set(new Date((v.to ?? range.to) + 'T00:00:00'));
    } else {
      this.rangeValue.set({
        start: new Date((v.from ?? range.from) + 'T00:00:00'),
        end: new Date((v.to ?? range.to) + 'T00:00:00'),
      });
    }
    this.selectedBranches.set(v.branches ?? []);
    this.compare.set(!!v.compare);
  }

  selectedBranchLabel = computed(() => {
    const sel = this.selectedBranches();
    if (sel.length === 0) return this.lang.instant('REPORTS.FILTER.ALL_BRANCHES');
    if (sel.length === 1) return this.branches().find(b => b.value === sel[0])?.label ?? '1';
    return this.lang.instant('REPORTS.FILTER.N_BRANCHES', { count: sel.length });
  });

  onRangeChange(range: DateRange | null): void {
    this.rangeValue.set(range);
    // Only emit once a complete range is picked.
    if (range?.start && range?.end) this.emit();
  }

  onSingleChange(date: Date | null): void {
    this.singleValue.set(date);
    if (date) this.emit();
  }

  toggleBranch(): void { this.branchOpen.update(v => !v); }

  isBranchSelected = (value: string) => this.selectedBranches().includes(value);

  toggleBranchValue(value: string): void {
    const set = new Set(this.selectedBranches());
    set.has(value) ? set.delete(value) : set.add(value);
    this.selectedBranches.set([...set]);
  }

  applyBranches(): void {
    this.branchOpen.set(false);
    this.emit();
  }

  toggleCompare(): void {
    this.compare.update(v => !v);
    this.emit();
  }

  private emit(): void {
    let from: string | undefined;
    let to: string | undefined;
    if (this.isAsOf()) {
      const d = this.singleValue();
      from = to = d ? toIso(d) : undefined;
    } else {
      const r = this.rangeValue();
      from = r?.start ? toIso(r.start) : undefined;
      to = r?.end ? toIso(r.end) : undefined;
    }
    const state: ReportFilterState = {
      preset: 'custom', // concrete range/date is the source of truth
      from,
      to,
      branches: this.selectedBranches(),
      compare: this.compare(),
    };
    this.apply.emit(state);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.branchOpen.set(false);
    }
  }
}
