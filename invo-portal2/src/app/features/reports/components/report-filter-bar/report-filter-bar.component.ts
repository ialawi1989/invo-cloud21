import {
  Component, ElementRef, HostListener, inject, input, output, signal,
  computed, OnInit, effect, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { ModalService } from '@shared/modal/modal.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DatePreset, DateRange } from '@shared/components/datepicker/date-picker.types';
import { ReportFilterFlags, ReportFilterState } from '../../models/report.model';
import { DATE_PRESETS, resolvePreset, toIso } from '../../utils/report-period.util';
import {
  ReportFiltersModalComponent, ReportFiltersModalData, ReportFiltersModalResult,
} from '../report-filters-modal/report-filters-modal.component';

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
  private modal = inject(ModalService);

  /** Which controls to show. */
  flags = input<ReportFilterFlags>({ date: true });
  /** Branch options (empty → branch selector hidden). */
  branches = input<BranchOption[]>([]);
  /** Initial filter state (restored from URL). */
  value = input<ReportFilterState>({ preset: 'thisMonth' });

  apply = output<ReportFilterState>();

  // ── Period (date-picker) state ───────────────────────────────────────
  /** An as-of report the user switched to a range (the checkbox in the date panel). */
  asOfMode = signal(true);
  isAsOf = computed(() => !!this.flags().asOf && this.asOfMode());
  /** Range value for range mode. */
  rangeValue = signal<DateRange | null>(null);
  /** The chosen month of a month-only report (its first day). */
  monthValue = signal<Date | null>(null);
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
  openingHour = signal<boolean>(false);
  comparison = signal<{ period: 'Month' | 'Year'; qty: number } | null>(null);
  productIds = signal<string[]>([]);
  categoryIds = signal<string[]>([]);
  sources = signal<string[]>([]);
  voidTimings = signal<string[]>([]);
  filterBy = signal<string>('');
  employeeIds = signal<string[]>([]);
  mode = signal<string>('actual');
  locationIds = signal<string[]>([]);
  productTypes = signal<string[]>([]);
  customerIds = signal<string[]>([]);
  supplierIds = signal<string[]>([]);
  customerType = signal<string>('');
  balanceOnly = signal(false);
  salesEmployee = signal(false);
  hideDeleted = signal(false);
  voidReasons = signal<string[]>([]);
  branchOpen = signal(false);

  showBranches = computed(() => !!this.flags().branches && this.branches().length > 0);

  /** The "Filters" button is shown when there is anything to put in it. */
  hasFilters = computed(() =>
    this.showBranches() || !!this.flags().compare || !!this.flags().comparePeriods || !!this.flags().applyOpeningHour
    || !!this.flags().products || !!this.flags().categories || !!this.flags().sources?.length || !!this.flags().voidTimings || !!this.flags().filterBy?.length || !!this.flags().customerType || !!this.flags().customers || !!this.flags().suppliers || !!this.flags().hasBalanceOnly || !!this.flags().productTypes?.length || !!this.flags().locations || !!this.flags().hideDeleted || !!this.flags().purchaseMode || !!this.flags().salesEmployee || !!this.flags().voidedBy || !!this.flags().singleEmployee || !!this.flags().voidReasons);
  /** How many filters are on (shown as the badge). */
  activeCount = computed(() =>
    (this.selectedBranches().length ? 1 : 0)
    + (this.flags().compare && this.compare() ? 1 : 0)
    + (this.flags().applyOpeningHour && this.openingHour() ? 1 : 0)
    + (this.flags().comparePeriods && this.comparison() ? 1 : 0)
    + (this.flags().products && this.productIds().length ? 1 : 0)
    + (this.flags().categories && this.categoryIds().length ? 1 : 0)
    + (this.flags().sources?.length && this.sources().length ? 1 : 0)
    + (this.flags().voidTimings && this.voidTimings().length ? 1 : 0)
    + (this.flags().filterBy?.length && this.filterBy() !== this.flags().filterBy![0] ? 1 : 0)
    + (this.flags().customerType && this.customerType() ? 1 : 0)
    + (this.flags().customers && this.customerIds().length ? 1 : 0)
    + (this.flags().suppliers && this.supplierIds().length ? 1 : 0)
    + (this.flags().hasBalanceOnly && this.balanceOnly() ? 1 : 0)
    + (this.flags().salesEmployee && this.salesEmployee() ? 1 : 0)
    + (this.flags().productTypes?.length && this.productTypes().length ? 1 : 0)
    + (this.flags().locations && this.locationIds().length ? 1 : 0)
    + (this.flags().hideDeleted && this.hideDeleted() ? 1 : 0)
    + (this.flags().purchaseMode && this.mode() !== 'actual' ? 1 : 0)
    + ((this.flags().voidedBy || this.flags().singleEmployee) && this.employeeIds().length ? 1 : 0)
    + (this.flags().voidReasons && this.voidReasons().length ? 1 : 0));

  /** The filters that are on, shown beside the button as removable chips (so nothing hides inside the dialog). */
  chips = computed(() => {
    const f = this.flags();
    const t = (k: string, p?: Record<string, unknown>) => this.lang.instant(k, p);
    const list = (k: string, n: number) => `${t(k)}: ${n}`;
    const out: { key: string; label: string; clear: () => void }[] = [];
    const sel = this.selectedBranches();
    if (sel.length) out.push({ key: 'branches', label: `${t('REPORTS.BO.FILTERS.BRANCHES')}: ${this.branches().filter(b => sel.includes(b.value)).map(b => b.label).join(', ') || sel.length}`, clear: () => this.selectedBranches.set([]) });
    if (f.compare && this.compare()) out.push({ key: 'compare', label: t('REPORTS.FILTER.COMPARE'), clear: () => this.compare.set(false) });
    const c = this.comparison();
    if (f.comparePeriods && c) out.push({ key: 'comparison', label: `${t('REPORTS.BO.COMPARE.LABEL')}: ${c.qty} ${t(c.period === 'Year' ? 'REPORTS.BO.COMPARE.YEARS' : 'REPORTS.BO.COMPARE.MONTHS')}`, clear: () => this.comparison.set(null) });
    if (f.applyOpeningHour && this.openingHour()) out.push({ key: 'oh', label: t('REPORTS.FILTER.OPENING_HOURS'), clear: () => this.openingHour.set(false) });
    if (f.purchaseMode && this.mode() !== 'actual') out.push({ key: 'mode', label: `${t('REPORTS.FILTER.PURCHASE_MODE')}: ${t('REPORTS.FILTER.PURCHASE_MODE_OPTION.' + this.mode())}`, clear: () => this.mode.set('actual') });
    if (f.filterBy?.length && this.filterBy() && this.filterBy() !== f.filterBy[0]) {
      out.push({ key: 'filterBy', label: `${t(f.filterByLabel ?? 'REPORTS.FILTER.FILTER_BY')}: ${t('REPORTS.FILTER.FILTER_BY_OPTION.' + this.filterBy())}`, clear: () => this.filterBy.set(f.filterBy![0]) });
    }
    if (f.customerType && this.customerType()) out.push({ key: 'ctype', label: `${t('REPORTS.FILTER.CUSTOMER_TYPE')}: ${t('REPORTS.FILTER.CUSTOMER_TYPE_OPTION.' + this.customerType())}`, clear: () => this.customerType.set('') });
    if (f.salesEmployee && this.salesEmployee()) out.push({ key: 'se', label: t('REPORTS.FILTER.SALES_EMPLOYEE'), clear: () => this.salesEmployee.set(false) });
    if (f.hasBalanceOnly && this.balanceOnly()) out.push({ key: 'bal', label: t('REPORTS.FILTER.BALANCE_ONLY'), clear: () => this.balanceOnly.set(false) });
    if (f.hideDeleted && this.hideDeleted()) out.push({ key: 'del', label: t('REPORTS.FILTER.HIDE_DELETED'), clear: () => this.hideDeleted.set(false) });
    if (f.suppliers && this.supplierIds().length) out.push({ key: 'sups', label: list('REPORTS.FILTER.SUPPLIERS', this.supplierIds().length), clear: () => this.supplierIds.set([]) });
    if (f.products && this.productIds().length) out.push({ key: 'products', label: list('REPORTS.FILTER.PRODUCTS', this.productIds().length), clear: () => this.productIds.set([]) });
    if (f.categories && this.categoryIds().length) out.push({ key: 'cats', label: list('REPORTS.FILTER.CATEGORIES', this.categoryIds().length), clear: () => this.categoryIds.set([]) });
    if (f.customers && this.customerIds().length) out.push({ key: 'custs', label: list('REPORTS.FILTER.CUSTOMERS', this.customerIds().length), clear: () => this.customerIds.set([]) });
    if (f.locations && this.locationIds().length) out.push({ key: 'locs', label: list('REPORTS.FILTER.LOCATIONS', this.locationIds().length), clear: () => this.locationIds.set([]) });
    if (f.productTypes?.length && this.productTypes().length) out.push({ key: 'ptypes', label: list('REPORTS.FILTER.PRODUCT_TYPES', this.productTypes().length), clear: () => this.productTypes.set([]) });
    if (f.sources?.length && this.sources().length) out.push({ key: 'src', label: list(f.sourcesLabel ?? 'REPORTS.FILTER.SOURCE', this.sources().length), clear: () => this.sources.set([]) });
    if (f.voidTimings && this.voidTimings().length) out.push({ key: 'vt', label: list('REPORTS.FILTER.VOID_TIMINGS', this.voidTimings().length), clear: () => this.voidTimings.set([]) });
    if ((f.voidedBy || f.singleEmployee) && this.employeeIds().length) out.push({ key: 'vb', label: list(f.singleEmployee ? (f.singleEmployeeLabel ?? 'REPORTS.FILTER.EMPLOYEE') : 'REPORTS.FILTER.VOIDED_BY', this.employeeIds().length), clear: () => this.employeeIds.set([]) });
    if (f.voidReasons && this.voidReasons().length) out.push({ key: 'vr', label: list('REPORTS.FILTER.VOID_REASONS', this.voidReasons().length), clear: () => this.voidReasons.set([]) });
    return out;
  });

  /** Remove one filter chip and re-run the report. */
  clearChip(c: { clear: () => void }): void { c.clear(); this.emit(); }
  /** Remove every applied filter at once. */
  clearAll(): void { this.chips().forEach(c => c.clear()); this.emit(); }

  private autoOpened = false;

  constructor() {
    // A report with a required branch (Daily Closing) opens the Filters dialog straight away until one is chosen.
    effect(() => {
      const f = this.flags();
      const needBranch = !!f.requireBranch && this.showBranches();
      const needProduct = !!f.requireProduct;
      const needEmployee = !!f.requireEmployee;
      if (this.autoOpened || (!needBranch && !needProduct && !needEmployee)) return;
      // the branch list loads after the page does: wait for it, or the dialog would open without its Branches section
      if (f.branches && this.branches().length === 0) return;
      this.autoOpened = true;
      const missing = (needBranch && !(this.value().branches?.length || this.selectedBranches().length))
        || (needProduct && !(this.value().productIds?.length || this.productIds().length))
        || (needEmployee && !(this.value().employeeIds?.length || this.employeeIds().length));
      if (missing) untracked(() => void this.openFilters());
    });
  }

  async openFilters(): Promise<void> {
    const ref = this.modal.open<ReportFiltersModalComponent, ReportFiltersModalData, ReportFiltersModalResult>(
      ReportFiltersModalComponent, {
        size: 'md',
        data: {
          branches: this.showBranches() ? this.branches() : [],
          singleBranch: !!this.flags().singleBranch, requireBranch: !!this.flags().requireBranch,
          selected: this.selectedBranches(),
          compare: !!this.flags().compare, compareValue: this.compare(),
          comparePeriods: !!this.flags().comparePeriods, comparisonValue: this.comparison(),
          products: !!this.flags().products, productIds: this.productIds(),
          singleProduct: !!this.flags().singleProduct, requireProduct: !!this.flags().requireProduct,
          categories: !!this.flags().categories, categoryIds: this.categoryIds(),
          filterByOptions: this.flags().filterBy ?? [], filterBy: this.filterBy(),
          filterByLabel: this.flags().filterByLabel ?? 'REPORTS.FILTER.FILTER_BY',
          purchaseMode: !!this.flags().purchaseMode, mode: this.mode(),
          customerTypeOn: !!this.flags().customerType, customerType: this.customerType(),
          customers: !!this.flags().customers, customerIds: this.customerIds(),
          suppliers: !!this.flags().suppliers, supplierIds: this.supplierIds(),
          balanceOnly: !!this.flags().hasBalanceOnly, balanceOnlyValue: this.balanceOnly(),
          salesEmployeeOn: !!this.flags().salesEmployee, salesEmployeeValue: this.salesEmployee(),
          productTypeOptions: this.flags().productTypes ?? [], productTypes: this.productTypes(),
          locations: !!this.flags().locations, locationIds: this.locationIds(),
          hideDeleted: !!this.flags().hideDeleted, hideDeletedValue: this.hideDeleted(),
          voidedBy: !!this.flags().voidedBy, singleEmployee: !!this.flags().singleEmployee, requireEmployee: !!this.flags().requireEmployee, employeeLabel: this.flags().singleEmployeeLabel, employeeIds: this.employeeIds(),
          voidReasons: !!this.flags().voidReasons, voidReasonValues: this.voidReasons(),
          voidTimings: !!this.flags().voidTimings, voidTimingValues: this.voidTimings(),
          sourceOptions: this.flags().sources ?? [], sources: this.sources(), sourceLabel: this.flags().sourcesLabel, sourceOptionPrefix: this.flags().sourcesOptionPrefix,
          openingHour: !!this.flags().applyOpeningHour, openingHourValue: this.openingHour(),
        },
      });
    const r = await ref.afterClosed();
    if (!r) return;
    this.selectedBranches.set(r.branches);
    this.compare.set(r.compare);
    this.openingHour.set(r.applyOpeningHour);
    this.comparison.set(r.comparison);
    this.productIds.set(r.productIds);
    this.categoryIds.set(r.categoryIds);
    this.sources.set(r.sources);
    this.voidTimings.set(r.voidTimings);
    this.filterBy.set(r.filterBy);
    this.employeeIds.set(r.employeeIds);
    this.mode.set(r.mode);
    this.locationIds.set(r.locationIds);
    this.productTypes.set(r.productTypes);
    this.customerIds.set(r.customerIds);
    this.supplierIds.set(r.supplierIds);
    this.customerType.set(r.customerType);
    this.balanceOnly.set(r.hasBalanceOnly);
    this.salesEmployee.set(r.salesEmployee);
    this.hideDeleted.set(r.hideDeleted);
    this.voidReasons.set(r.voidReasons);
    this.emit();
  }

  ngOnInit(): void {
    const v = this.value();
    this.asOfMode.set(v.asOf !== false);
    const range = resolvePreset(v.preset ?? 'thisMonth', { from: v.from, to: v.to });
    if (this.isAsOf()) {
      this.singleValue.set(new Date((v.to ?? range.to) + 'T00:00:00'));
    } else {
      this.rangeValue.set({
        start: new Date((v.from ?? range.from) + 'T00:00:00'),
        end: new Date((v.to ?? range.to) + 'T00:00:00'),
      });
    }
    // a month-only report shows (and asks for) the month the period starts in
    if (this.flags().monthOnly) {
      const today = new Date().toISOString().slice(0, 10);
      const end = v.to ?? range.to;
      const f = new Date((end < today ? end : today) + 'T00:00:00');
      this.monthValue.set(new Date(f.getFullYear(), f.getMonth(), 1));
    }
    this.selectedBranches.set(v.branches ?? []);
    this.compare.set(!!v.compare);
    this.openingHour.set(!!v.applyOpeningHour);
    this.comparison.set(v.comparison ?? null);
    this.productIds.set(v.productIds ?? []);
    this.categoryIds.set(v.categoryIds ?? []);
    this.sources.set(v.sources ?? []);
    this.voidTimings.set(v.voidTimings ?? []);
    this.filterBy.set(v.filterBy ?? this.flags().filterBy?.[0] ?? '');
    this.employeeIds.set(v.employeeIds ?? []);
    this.mode.set(v.mode ?? 'actual');
    this.locationIds.set(v.locationIds ?? []);
    this.productTypes.set(v.productTypes ?? []);
    this.customerIds.set(v.customerIds ?? []);
    this.supplierIds.set(v.supplierIds ?? []);
    this.customerType.set(v.customerType ?? '');
    this.balanceOnly.set(!!v.hasBalanceOnly);
    this.salesEmployee.set(!!v.salesEmployee);
    this.hideDeleted.set(!!v.hideDeleted);
    this.voidReasons.set(v.voidReasons ?? []);
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

  /** A month-only report: the period is that month, first day to last. */
  onMonthChange(date: Date | null): void {
    if (!date) return;
    this.monthValue.set(new Date(date.getFullYear(), date.getMonth(), 1));
    this.rangeValue.set({ start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0) });
    this.emit();
  }

  /** Previous / next month arrows of a month-only report. */
  shiftMonth(delta: number): void {
    const m = this.monthValue() ?? new Date();
    this.onMonthChange(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }
  /** The chosen month is this month or later: there is nothing after it to step to. */
  isCurrentMonth(): boolean {
    const m = this.monthValue();
    const now = new Date();
    return !!m && (m.getFullYear() > now.getFullYear() || (m.getFullYear() === now.getFullYear() && m.getMonth() >= now.getMonth()));
  }

  onSingleChange(date: Date | null): void {
    this.singleValue.set(date);
    if (date) this.emit();
  }

  /** "As of" checkbox: ticked = one date, unticked = a range (starting with that date's month). */
  onAsOf(checked: boolean): void {
    if (checked === this.asOfMode()) return;
    if (!checked) {
      const d = this.singleValue() ?? new Date();
      this.rangeValue.set({ start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) });
    } else {
      this.singleValue.set(this.rangeValue()?.end ?? new Date());
    }
    this.asOfMode.set(checked);
    this.emit();
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

  toggleOpeningHour(): void {
    this.openingHour.update(v => !v);
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
      applyOpeningHour: this.flags().applyOpeningHour ? this.openingHour() : undefined,
      comparison: this.flags().comparePeriods ? this.comparison() : undefined,
      productIds: this.flags().products ? this.productIds() : undefined,
      categoryIds: this.flags().categories ? this.categoryIds() : undefined,
      sources: this.flags().sources?.length ? this.sources() : undefined,
      voidTimings: this.flags().voidTimings ? this.voidTimings() : undefined,
      filterBy: this.flags().filterBy?.length ? this.filterBy() : undefined,
      mode: this.flags().purchaseMode ? this.mode() : undefined,
      customerType: this.flags().customerType ? this.customerType() : undefined,
      customerIds: this.flags().customers ? this.customerIds() : undefined,
      supplierIds: this.flags().suppliers ? this.supplierIds() : undefined,
      hasBalanceOnly: this.flags().hasBalanceOnly ? this.balanceOnly() : undefined,
      salesEmployee: this.flags().salesEmployee ? this.salesEmployee() : undefined,
      productTypes: this.flags().productTypes?.length ? this.productTypes() : undefined,
      locationIds: this.flags().locations ? this.locationIds() : undefined,
      hideDeleted: this.flags().hideDeleted ? this.hideDeleted() : undefined,
      employeeIds: this.flags().voidedBy || this.flags().singleEmployee ? this.employeeIds() : undefined,
      voidReasons: this.flags().voidReasons ? this.voidReasons() : undefined,
      asOf: this.flags().asOf ? this.asOfMode() : undefined,
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
