import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ToastService } from '@shared/components/toast/toast.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import {
  EmployeeLeaveService,
  LeaveEntitlement,
  LeaveSettings,
  LeaveTypeDescriptor,
  RateMultiplierKey,
  RateMultipliers,
} from '../../services/employee-leave.service';
import { portalKey } from '../../hr-labels';

interface Opt { value: string; label: string }

/** One editable row. The entitlement is flattened so inputs can bind to it. */
interface Row {
  key: string;
  labelKey: string;
  label: string;
  isCustom: boolean;
  enabled: boolean;
  deductsBalance: boolean;
  paid: boolean;
  hasEntitlement: boolean;
  days: number | null;
  per: LeaveEntitlement['per'];
  dayBasis: LeaveEntitlement['dayBasis'];
  pay: LeaveEntitlement['pay'];
  accrualMethod: 'upfront' | 'monthly';
  maxPerRequest: number | null;
  maxTimes: number | null;
  minServiceMonths: number | null;
  audience: string;
  source: string;
  verify: boolean;
  open: boolean;
}

/**
 * Employees → Leave types & entitlements.
 *
 * A company's own list of leave types. The country's rules supply the starting
 * values (server side); everything here is editable, types can be switched off,
 * and a company can add its own. Saving replaces the whole list; "Reset" drops
 * the company's edits and returns to the country defaults.
 *
 * Built-in types cannot be deleted — requests already filed against them must
 * stay readable — only switched off. Custom types can be removed.
 */
@Component({
  selector: 'app-leave-types',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, SearchDropdownComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-types.component.html',
  styleUrls: ['./leave-types.component.scss'],
})
export class LeaveTypesComponent implements OnInit {
  private service = inject(EmployeeLeaveService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  readonly rows = signal<Row[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);

  constructor() { withTranslations('employees'); }

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
    { label: this.translate.instant('EMPLOYEES.LEAVE.ENT.SETTINGS_TITLE') },
  ]);

  private t = (k: string) => this.translate.instant('EMPLOYEES.LEAVE.ENT.' + k);

  readonly perOptions = (): Opt[] => [
    { value: 'year', label: this.t('PER_YEAR') },
    { value: 'event', label: this.t('PER_EVENT') },
    { value: 'lifetime', label: this.t('PER_LIFETIME') },
  ];
  readonly payOptions = (): Opt[] => ['full', 'half', 'unpaid', 'mixed']
    .map(v => ({ value: v, label: this.t('PAY_' + v.toUpperCase()) }));
  readonly basisOptions = (): Opt[] => ['calendar', 'working']
    .map(v => ({ value: v, label: this.t('BASIS_' + v.toUpperCase()) }));
  readonly accrualOptions = (): Opt[] => [
    { value: 'upfront', label: this.t('ACCRUAL_UPFRONT') },
    { value: 'monthly', label: this.t('ACCRUAL_MONTHLY') },
  ];
  readonly audienceOptions = (): Opt[] => [
    { value: '', label: this.t('AUDIENCE_ALL') },
    ...['female', 'male', 'muslim', 'muslimFemale']
      .map(v => ({ value: v, label: this.t('AUDIENCE_' + v.toUpperCase()) })),
  ];

  optLabel = (o: Opt) => o?.label ?? '';
  optValue = (o: Opt) => o?.value;
  optMatch = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  // ── Accrual rules (unpaid-leave threshold, compensatory expiry) ────────
  readonly accrual = signal<LeaveSettings | null>(null);
  readonly accrualSaving = signal(false);

  async saveAccrual(): Promise<void> {
    const a = this.accrual();
    if (!a) return;
    this.accrualSaving.set(true);
    try {
      await this.service.saveLeaveSettings({
        unpaidAccrualThresholdDays: Number(a.unpaidAccrualThresholdDays),
        compensatoryExpiryDays: Number(a.compensatoryExpiryDays),
      });
      this.toast.success(this.t('RATES_SAVED'));
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.accrualSaving.set(false);
    }
  }

  async resetAccrual(): Promise<void> {
    this.accrualSaving.set(true);
    try {
      await this.service.resetLeaveSettings();
      this.accrual.set(await this.service.leaveSettings());
      this.toast.success(this.t('RESET_DONE'));
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.accrualSaving.set(false);
    }
  }

  // ── Pay multipliers (overtime / rest day / public holiday) ─────────────
  readonly rateKeys: RateMultiplierKey[] =
    ['overtimeDaytime', 'overtimeNighttime', 'weeklyRestDayWorked', 'publicHolidayWorked'];
  readonly rates = signal<RateMultipliers | null>(null);
  readonly ratesSaving = signal(false);

  rateLabel(k: RateMultiplierKey): string { return this.t('RATE_' + k.toUpperCase()); }
  rateHint(k: RateMultiplierKey): string { return this.t('RATE_' + k.toUpperCase() + '_HINT'); }

  async saveRates(): Promise<void> {
    const r = this.rates();
    if (!r) return;
    this.ratesSaving.set(true);
    try {
      await this.service.saveRateMultipliers(r);
      this.toast.success(this.t('RATES_SAVED'));
      this.rates.set(await this.service.rateMultipliers());
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.ratesSaving.set(false);
    }
  }

  async resetRates(): Promise<void> {
    this.ratesSaving.set(true);
    try {
      await this.service.resetRateMultipliers();
      this.toast.success(this.t('RESET_DONE'));
      this.rates.set(await this.service.rateMultipliers());
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.ratesSaving.set(false);
    }
  }

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [cat, rates, accrual] = await Promise.all([
        this.service.catalog(),
        this.service.rateMultipliers().catch(() => null),
        this.service.leaveSettings().catch(() => null),
      ]);
      this.rates.set(rates);
      this.accrual.set(accrual);
      this.rows.set(cat.types.map(t => this.toRow(t)));
    } catch (e: any) {
      this.toast.error(e?.message ?? 'COMMON.SAVE_FAILED');
    } finally {
      this.loading.set(false);
    }
  }

  private toRow(t: LeaveTypeDescriptor): Row {
    const e = t.entitlement;
    return {
      key: t.key,
      labelKey: t.labelKey,
      label: t.label ?? '',
      isCustom: !t.labelKey,
      enabled: t.enabled !== false,
      deductsBalance: t.deductsBalance === true,
      paid: t.paid !== false,
      hasEntitlement: !!e,
      days: e?.days ?? null,
      per: e?.per ?? 'event',
      dayBasis: e?.dayBasis ?? 'calendar',
      pay: e?.pay ?? 'full',
      accrualMethod: e?.accrualMethod ?? 'upfront',
      maxPerRequest: e?.maxPerRequest ?? null,
      maxTimes: e?.maxTimes ?? null,
      minServiceMonths: e?.minServiceMonths ?? null,
      audience: e?.audience ?? '',
      source: e?.source ?? '',
      verify: e?.verify === true,
      open: false,
    };
  }

  displayName(r: Row): string {
    return r.labelKey ? this.translate.instant(portalKey(r.labelKey)) : (r.label || r.key);
  }

  summary(r: Row): string {
    if (!r.hasEntitlement) return this.t('NO_ENTITLEMENT');
    const parts: string[] = [];
    parts.push(r.days === null ? '—' : `${r.days}`);
    parts.push(this.t('PER_' + r.per.toUpperCase()));
    parts.push(this.t('PAY_' + r.pay.toUpperCase()));
    if (r.per === 'year') parts.push(this.t('ACCRUAL_' + r.accrualMethod.toUpperCase()));
    return parts.join(' · ');
  }

  toggleOpen(r: Row): void { r.open = !r.open; this.rows.update(x => [...x]); }

  addType(): void {
    const row: Row = {
      key: '', labelKey: '', label: '', isCustom: true, enabled: true, deductsBalance: false, paid: true,
      hasEntitlement: true, days: null, per: 'event', dayBasis: 'calendar', pay: 'full',
      accrualMethod: 'upfront', maxPerRequest: null, maxTimes: null, minServiceMonths: null,
      audience: '', source: '', verify: false, open: true,
    };
    this.rows.update(x => [...x, row]);
  }

  removeType(r: Row): void {
    this.rows.update(x => x.filter(y => y !== r));
  }

  setPer(r: Row, v: string): void { r.per = v as Row['per']; this.rows.update(x => [...x]); }

  private num(v: number | null | string): number | null {
    if (v === null || v === '' || v === undefined) return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  private toPayload(r: Row): LeaveTypeDescriptor {
    // A saved type keeps its key for life — requests are filed against it, so
    // renaming a custom type changes its label, never its key. A brand-new type
    // takes its key from the name typed.
    const key = (r.key || r.label).trim();
    const ent: LeaveEntitlement | undefined = r.hasEntitlement ? {
      days: this.num(r.days),
      per: r.per,
      dayBasis: r.dayBasis,
      pay: r.pay,
      ...(r.per === 'year' ? { accrualMethod: r.accrualMethod } : {}),
      ...(this.num(r.maxPerRequest) !== null ? { maxPerRequest: this.num(r.maxPerRequest)! } : {}),
      ...(this.num(r.maxTimes) !== null ? { maxTimes: this.num(r.maxTimes)! } : {}),
      ...(this.num(r.minServiceMonths) !== null ? { minServiceMonths: this.num(r.minServiceMonths)! } : {}),
      ...(r.audience ? { audience: r.audience as LeaveEntitlement['audience'] } : {}),
      ...(r.source ? { source: r.source } : {}),
      ...(r.verify ? { verify: true } : {}),
    } : undefined;
    return {
      key,
      labelKey: r.labelKey,
      label: r.isCustom ? (r.label.trim() || key) : undefined,
      deductsBalance: r.deductsBalance,
      paid: r.paid,
      enabled: r.enabled,
      entitlement: ent,
    };
  }

  async save(): Promise<void> {
    const rows = this.rows();
    if (rows.some(r => r.isCustom && !(r.label || r.key).trim())) {
      // A custom type with no name has nothing to be filed under.
      this.toast.error(this.t('NAME'));
      return;
    }
    this.saving.set(true);
    try {
      await this.service.saveEntitlementTypes(rows.map(r => this.toPayload(r)));
      this.toast.success(this.t('SAVED'));
      await this.load();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async reset(): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.t('RESET'),
        message: this.t('RESET_CONFIRM'),
        confirm: this.translate.instant('COMMON.CONFIRM'),
        danger: true,
      },
    });
    if (!(await ref.afterClosed())) return;
    this.saving.set(true);
    try {
      await this.service.resetEntitlementTypes();
      this.toast.success(this.t('RESET_DONE'));
      await this.load();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
