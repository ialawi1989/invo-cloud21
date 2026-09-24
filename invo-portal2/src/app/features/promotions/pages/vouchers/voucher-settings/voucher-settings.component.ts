import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { DaySpan, PeriodUnit, TranslatedString } from '../../../models/common.model';
import { VouchersSettings } from '../../../models/vouchers.model';
import { VouchersService } from '../../../services/vouchers.service';
import { DaySpanControlComponent } from '../../../components/day-span-control/day-span-control.component';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';

/**
 * Gift vouchers → settings form (name + default active / expiry / expiry-soon
 * periods, with the mandatory reason + note). Validation is the legacy
 * `VouchersFormComponent` one; it is a page instead of a modal.
 */
@Component({
  selector: 'app-voucher-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent,
    DaySpanControlComponent, TranslatedStringInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voucher-settings.component.html',
  styleUrl: './voucher-settings.component.scss',
})
export class VoucherSettingsComponent implements OnInit, CanLeaveComponent {
  private service = inject(VouchersService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  setting = signal<VouchersSettings | null>(null);
  reason = signal<TranslatedString>({});
  note = signal('');
  private original = '';

  breadcrumbs = signal<BreadcrumbItem[]>([]);
  private code = computed(() => this.lang.current() || 'en');

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.PROMOTIONS_VOUCHERS'), routerLink: '/promotions/promotions-vouchers' },
      { label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.PROMOTIONS_VOUCHER_SETTINGS') },
    ]);
    const s = await this.service.getVouchersSettings();
    s.vouchersName = s.vouchersName ?? {};
    this.setting.set(s);
    this.original = this.snapshot();
    this.loading.set(false);
  }

  private snapshot(): string {
    return JSON.stringify({ s: this.setting(), r: this.reason(), n: this.note() });
  }

  hasUnsavedChanges(): boolean {
    return !this.saving() && !this.loading() && this.snapshot() !== this.original;
  }

  patch(part: Partial<VouchersSettings>): void {
    this.setting.update(s => (s ? { ...s, ...part } : s));
  }

  // ── validation (legacy) ───────────────────────────────────────────
  private days(span: DaySpan): number {
    switch (span.periodUnit) {
      case PeriodUnit.DAYS: return span.value;
      case PeriodUnit.WEEKS: return span.value * 7;
      case PeriodUnit.MONTHS: return span.value * 30;
      case PeriodUnit.YEARS: return span.value * 365;
      default: return span.value;
    }
  }

  nameError = computed(() => {
    const s = this.setting();
    return !(s?.vouchersName?.[this.code()] ?? '').trim();
  });
  activeNegative = computed(() => (this.setting()?.activePeriod.value ?? 0) < 0);
  expiryNotPositive = computed(() => (this.setting()?.expiryPeriod.value ?? 0) <= 0);
  expirySoonNotPositive = computed(() => (this.setting()?.expirySoonPeriod.value ?? 0) <= 0);
  periodError = computed(() => {
    const s = this.setting();
    return !!s && this.days(s.expiryPeriod) <= this.days(s.activePeriod);
  });
  reasonValid = computed(() => (this.reason()[this.code()] ?? '') !== '');

  formValid = computed(() => {
    const s = this.setting();
    return !!s && (s.vouchersName?.[this.code()] ?? '') !== '' && this.reasonValid() && !this.periodError();
  });

  async save(): Promise<void> {
    const s = this.setting();
    if (!s || !this.formValid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.setVouchersSettings({ setting: s, reason: this.reason(), note: this.note() });
      this.original = this.snapshot();
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate(['/promotions/promotions-vouchers']);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/promotions/promotions-vouchers']);
  }
}
