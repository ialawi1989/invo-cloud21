import { FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective } from '@shared/components/form-actions/form-actions.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

import '../../price-management-i18n';
import {
  Option, PriceManagement, RepeatDays, RepeatType, WEEK_DAYS, emptyRepeatDays,
} from '../../models/price-management.model';
import { PriceManagementService } from '../../services/price-management.service';

/**
 * Price management -> create / edit (`/price-management/new`, `/price-management/:id`). Legacy
 * `PriceManagementFormComponent`: title (unique), date range (or a single date for "Once") with from/to time, repeat
 * (Once / Daily / Weekly + weekdays), price label, optional surcharge + discount and the branches it applies to.
 * Same call sequence as legacy: lookups -> record -> validate the date range; the title is checked as you type.
 */
@Component({
  selector: 'app-price-management-form',
  standalone: true,
  imports: [FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective, PageHeaderComponent, 
    CommonModule, FormsModule, TranslateModule, DatePickerComponent, SearchDropdownComponent,
    EmptyStateComponent, LoadingOverlayComponent, TimePickerComponent, ToggleComponent,
  ],
  templateUrl: './price-management-form.component.html',
  styleUrl: './price-management-form.component.scss',
})
export class PriceManagementFormComponent implements OnInit, OnDestroy, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private service = inject(PriceManagementService);
  private cdr = inject(ChangeDetectorRef);

  readonly weekDays = WEEK_DAYS;
  readonly repeatOptions: Option[] = [];

  pm: PriceManagement = this.blank();
  isNew = true;
  loading = true;
  loadFailed = false;
  saving = false;
  showErrors = false;
  dirty = false;

  priceLabels: Option[] = [];
  surcharges: Option[] = [];
  discounts: Option[] = [];
  branches: Option[] = [];
  selectedBranchIds = new Set<string>();

  titleExists = false;
  /** `false` when another price management already covers the selected interval. */
  rangeFree = true;
  datesTouched = false;
  breadcrumbs: BreadcrumbItem[] = [];

  private titleTimer: ReturnType<typeof setTimeout> | null = null;
  private rangeSeq = 0;

  readonly label = (o: Option) => o?.name ?? '';
  readonly byId = (a: Option, b: Option) => a?.id === b?.id;

  private blank(): PriceManagement {
    const today = new Date();
    return {
      id: '', title: '', repeat: '', priceLabelId: '', branchIds: [], fromDate: today, toDate: today,
      fromTime: '12:00:00', toTime: '12:00:00', discountId: '', chargeId: '', repeatDays: emptyRepeatDays(),
    };
  }

  ngOnDestroy(): void { if (this.titleTimer) clearTimeout(this.titleTimer); }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('price-management');
    const t = (k: string) => this.lang.instant('PRICE_MANAGEMENT.' + k);
    (['Once', 'Daily', 'Weekly'] as RepeatType[]).forEach(id =>
      this.repeatOptions.push({ id, name: this.lang.instant('PRICE_MANAGEMENT.REPEAT_OPTION.' + id) }));

    const rawId = this.route.snapshot.paramMap.get('id');
    this.isNew = !rawId || rawId === 'new' || rawId === '0';
    this.breadcrumbs = [
      { label: t('DASHBOARD'), routerLink: '/dashboard' },
      { label: t('TITLE'), routerLink: '/price-management' },
      { label: t(this.isNew ? 'FORM_NEW' : 'FORM_EDIT') },
    ];

    try {
      // Legacy order: price labels, surcharges, branches, discounts, then the record.
      this.priceLabels = await this.service.getPriceLabels();
      this.surcharges = await this.service.getSurcharges();
      this.branches = await this.service.getBranches();
      this.discounts = await this.service.getDiscounts();

      if (!this.isNew) {
        const rec = await this.service.getById(rawId!);
        if (!rec) { this.loadFailed = true; return; }
        this.pm = rec;
        this.selectedBranchIds = new Set(rec.branchIds.map(b => String(b.branchId)));
      }
      await this.checkRange();
    } catch {
      this.loadFailed = true;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  get isOnce(): boolean { return this.pm.repeat === 'Once'; }
  get isWeekly(): boolean { return this.pm.repeat === 'Weekly'; }
  get titleEmpty(): boolean { return !this.pm.title?.trim(); }
  get repeatEmpty(): boolean { return !this.pm.repeat; }
  get labelEmpty(): boolean { return !this.pm.priceLabelId; }
  /** "To" must come after "From" (a "Once" price management is a single date, so it is exempt). */
  get dateOrderOk(): boolean { return this.isOnce || this.pm.fromDate.getTime() < this.pm.toDate.getTime(); }
  get allBranches(): boolean { return this.branches.length > 0 && this.branches.every(b => this.selectedBranchIds.has(b.id)); }

  get invalid(): boolean {
    return this.titleEmpty || this.titleExists || this.repeatEmpty || this.labelEmpty || !this.dateOrderOk || !this.rangeFree;
  }

  choice(list: Option[], id: string): Option | null { return list.find(o => o.id === id) ?? null; }

  // ── Editing ────────────────────────────────────────────────────────────────
  touch(): void { this.dirty = true; }

  onTitle(v: string): void {
    this.pm.title = v;
    this.touch();
    if (this.titleTimer) clearTimeout(this.titleTimer);
    if (!v.trim()) { this.titleExists = false; return; }
    this.titleTimer = setTimeout(async () => {
      try {
        const free = await this.service.isTitleFree(this.pm.title, this.isNew ? null : this.pm.id);
        this.titleExists = !free;
      } catch { this.titleExists = false; }
      this.cdr.markForCheck();
    }, 500);
  }

  onRepeat(o: Option | null): void {
    this.pm.repeat = (o?.id ?? '') as RepeatType | '';
    if (this.isOnce) this.pm.toDate = this.pm.fromDate;
    this.touch();
    void this.checkRange();
  }

  onFrom(v: unknown): void {
    if (!(v instanceof Date)) return;
    this.pm.fromDate = v;
    if (this.isOnce) this.pm.toDate = v;
    this.datesTouched = true;
    this.touch();
    void this.checkRange();
  }

  onTo(v: unknown): void {
    if (!(v instanceof Date)) return;
    this.pm.toDate = v;
    this.datesTouched = true;
    this.touch();
    if (this.dateOrderOk) void this.checkRange();
  }

  setTime(which: 'fromTime' | 'toTime', v: string | null): void {
    this.pm[which] = v ? (v.length === 5 ? v + ':00' : v) : '12:00:00';
    this.touch();
  }
  timeOf(v: string): string { return (v || '').slice(0, 5); }

  setDay(day: keyof RepeatDays, on: boolean): void { this.pm.repeatDays = { ...this.pm.repeatDays, [day]: on }; this.touch(); }

  setPriceLabel(o: Option | null): void { this.pm.priceLabelId = o?.id ?? ''; this.touch(); }
  setSurcharge(o: Option | null): void { this.pm.chargeId = o?.id ?? ''; this.touch(); }
  setDiscount(o: Option | null): void { this.pm.discountId = o?.id ?? ''; this.touch(); }

  toggleBranch(id: string, on: boolean): void {
    const s = new Set(this.selectedBranchIds);
    if (on) s.add(id); else s.delete(id);
    this.selectedBranchIds = s;
    this.touch();
  }
  toggleAllBranches(on: boolean): void {
    this.selectedBranchIds = on ? new Set(this.branches.map(b => b.id)) : new Set();
    this.touch();
  }

  /** `product/validatePriceManagementDate`; only the latest answer is applied. */
  private async checkRange(): Promise<void> {
    const seq = ++this.rangeSeq;
    try {
      const free = await this.service.isDateRangeFree({
        id: this.isNew ? undefined : this.pm.id, fromDate: this.pm.fromDate, toDate: this.pm.toDate,
      });
      if (seq === this.rangeSeq) this.rangeFree = free;
    } catch { if (seq === this.rangeSeq) this.rangeFree = true; }
    this.cdr.markForCheck();
  }

  // ── Save / cancel ──────────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.showErrors = true;
    this.datesTouched = true;
    if (this.invalid || this.saving) return;
    this.saving = true;
    try {
      const payload: PriceManagement = {
        ...this.pm,
        title: this.pm.title.trim(),
        // Legacy sent the selected branches as `[{ branchId }]`.
        branchIds: this.branches.filter(b => this.selectedBranchIds.has(b.id)).map(b => ({ branchId: b.id })),
      };
      const res = await this.service.save(payload);
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/price-management']);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : undefined);
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.error?.msg ?? e?.message);
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  cancel(): void { void this.router.navigate(['/price-management']); }

  hasUnsavedChanges(): boolean { return this.dirty && !this.saving; }
}
