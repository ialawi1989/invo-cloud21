import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { CompanyService } from '@core/auth/company.service';
import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DateFieldComponent } from '@shared/components/date-field/date-field.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import {
  CommissionEligibilityType,
  CommissionPaymentCycle,
  EmployeeCommissionOptions,
  EmployeeTipOptions,
} from '../../../employees/models/employee-earnings.types';

interface Choice<T> { value: T; label: string; disabled?: boolean }

/**
 * Settings → Commission & Tips.
 *
 * Whether employee commission and tips are switched on, when commission on a paid invoice is earned, the payout
 * cycle that decides which items a new payout pre-selects, and whether card fees come off tips. Both are stored on
 * the company (`employeeCommissionOptions`, `employeeTipOptions`) and saved through the regular company save.
 * This is the ONE save that sends them; every other company save sends null, which the server reads as "keep the
 * stored value" (see `companySavePayload`), so no other settings page can clear them.
 */
@Component({
  selector: 'app-commission-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    BreadcrumbsComponent, FormStickyFooterComponent, LoadingOverlayComponent,
    SearchDropdownComponent, DateFieldComponent, ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './commission-settings.component.html',
  styleUrl: '../../../employees/pages/earnings-pages.scss',
})
export class CommissionSettingsComponent implements OnInit, CanLeaveComponent {
  private api       = inject(ApiService);
  private company   = inject(CompanyService);
  private translate = inject(TranslateService);
  private router    = inject(Router);
  private toast     = inject(ToastService);

  loading = signal(true);
  saving  = signal(false);
  dirty   = signal(false);
  /** Nothing saved yet: the form shows the defaults the server applies. */
  notSavedYet = signal(false);
  returnPeriodDays = signal(0);
  hasReturnPeriod = computed(() => this.returnPeriodDays() > 0);

  options = signal(new EmployeeCommissionOptions());
  tipOptions = signal(new EmployeeTipOptions());

  private tick = signal(0);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.tick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('COMMISSION_SETTINGS.TITLE') },
    ];
  });

  readonly eligibilityChoices = computed<Choice<CommissionEligibilityType>[]>(() => {
    this.tick();
    const t = (k: string) => this.translate.instant('COMMISSION_SETTINGS.ELIGIBILITY_TYPES.' + k);
    return [
      { value: 'immediate', label: t('IMMEDIATE') },
      { value: 'days_after_sale', label: t('DAYS_AFTER_SALE') },
      { value: 'after_return_period', label: t('AFTER_RETURN_PERIOD') },
    ];
  });

  readonly cycleChoices = computed<Choice<CommissionPaymentCycle>[]>(() => {
    this.tick();
    const t = (k: string) => this.translate.instant('COMMISSION_SETTINGS.CYCLES.' + k);
    return [
      { value: 'weekly', label: t('WEEKLY') },
      { value: 'biweekly', label: t('BIWEEKLY') },
      { value: 'monthly', label: t('MONTHLY') },
      { value: 'manual', label: t('MANUAL') },
    ];
  });

  constructor() {
    withTranslations('settings', 'employees');
    this.translate.onTranslationChange.subscribe(() => this.tick.update(n => n + 1));
    this.translate.onLangChange.subscribe(() => this.tick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    try {
      const company = await this.company.loadSettings(true);
      const days = Number(company?.invoiceOptions?.returnPeriodDays ?? 0);
      this.returnPeriodDays.set(days);
      this.notSavedYet.set(company?.employeeCommissionOptions == null);

      const options = new EmployeeCommissionOptions();
      if (company?.employeeCommissionOptions) options.ParseJson(company.employeeCommissionOptions);
      else Object.assign(options, EmployeeCommissionOptions.effectiveDefault(days));
      this.options.set(options);

      const tips = new EmployeeTipOptions();
      if (company?.employeeTipOptions) tips.ParseJson(company.employeeTipOptions);
      this.tipOptions.set(tips);
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }

  /** Applies a change to the commission options and marks the page dirty. */
  setCommission(patch: Partial<EmployeeCommissionOptions>): void {
    const next = new EmployeeCommissionOptions();
    Object.assign(next, this.options(), patch);
    this.options.set(next);
    this.dirty.set(true);
  }

  setTips(patch: Partial<EmployeeTipOptions>): void {
    const next = new EmployeeTipOptions();
    Object.assign(next, this.tipOptions(), patch);
    this.tipOptions.set(next);
    this.dirty.set(true);
  }

  cycleLabel = (c: Choice<CommissionPaymentCycle>) => c.label;
  sameValue = (a: Choice<CommissionPaymentCycle>, b: Choice<CommissionPaymentCycle>) => a?.value === b?.value;
  cycleOf(v: CommissionPaymentCycle): Choice<CommissionPaymentCycle> | null { return this.cycleChoices().find(c => c.value === v) ?? null; }

  isEligibilityDisabled(c: Choice<CommissionEligibilityType>): boolean {
    return c.value === 'after_return_period' && !this.hasReturnPeriod();
  }

  async save(): Promise<void> {
    // Switched-off commission keeps its settings for later but doesn't block the save.
    const opts = this.options();
    const problem = opts.enabled ? opts.validate(this.returnPeriodDays()) : null;
    if (problem) {
      this.toast.error('COMMON.OPS', this.translate.instant(problem));
      return;
    }

    this.saving.set(true);
    try {
      // Reload so the save carries the latest company settings, not the copy from when this page was opened.
      const current = (await this.company.loadSettings(true)) ?? {};
      const payload = {
        ...current,
        employeeCommissionOptions: opts.toPayload(),
        employeeTipOptions: this.tipOptions().toPayload(),
      };
      const res = await firstValueFrom(this.api.post<any>('company/saveCompany', payload));
      if (res?.success) {
        await this.company.loadSettings(true);
        this.dirty.set(false);
        this.notSavedYet.set(false);
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/settings']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg ?? res?.message);
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.error?.msg ?? e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  back(): void { void this.router.navigate(['/settings']); }
}
