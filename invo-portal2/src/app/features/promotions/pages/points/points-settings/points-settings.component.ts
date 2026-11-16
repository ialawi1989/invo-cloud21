import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { DaySpan, PeriodUnit, TranslatedString } from '../../../models/common.model';
import { PointsSettings } from '../../../models/points.model';
import { PointsService } from '../../../services/points.service';
import { DaySpanControlComponent } from '../../../components/day-span-control/day-span-control.component';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';

const BASE = '/promotions/promotional-points';
const K = 'PROMOTIONS.PROMOTIONS_POINTS.';

/**
 * Promotional points → settings form (name, default periods, points⇄currency
 * equation, mandatory reason + note). Validation is the legacy
 * `PointsFormComponent` one; it is a routed page instead of a modal.
 */
@Component({
  selector: 'app-points-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent,
    DaySpanControlComponent, TranslatedStringInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './points-settings.component.html',
  styleUrl: './points-settings.component.scss',
})
export class PointsSettingsComponent implements OnInit, CanLeaveComponent {
  private service = inject(PointsService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private company = inject(CompanyService);

  loading = signal(true);
  saving = signal(false);
  setting = signal<PointsSettings | null>(null);
  reason = signal<TranslatedString>({});
  note = signal('');
  private original = '';

  breadcrumbs = signal<BreadcrumbItem[]>([]);
  private code = computed(() => this.lang.current() || 'en');

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'PROMOTIONS_POINTS'), routerLink: BASE },
      { label: t(K + 'PROMOTIONS_POINT_SETTINGS') },
    ]);
    const s = await this.service.getPointsSettings();
    s.pointsName = s.pointsName ?? {};
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

  patch(part: Partial<PointsSettings>): void {
    this.setting.update(s => (s ? { ...s, ...part } : s));
  }

  // ── decimals (legacy MathHelpers.afterDecimal) ────────────────────
  private afterDecimal = computed(() => this.company.settings()?.settings?.afterDecimal ?? 3);
  amountStep = computed(() =>
    this.afterDecimal() > 0 ? (1 / Math.pow(10, this.afterDecimal())).toFixed(this.afterDecimal()) : '1');

  limitCurrencyValueDecimals(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [intPart, decPart] = input.value.split('.');
    const dec = this.afterDecimal();
    if (decPart === undefined || decPart.length <= dec) return;
    const trimmed = dec > 0 ? `${intPart}.${decPart.slice(0, dec)}` : intPart;
    input.value = trimmed;
    this.patch({ currencyValue: Number(trimmed) });
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

  nameError = computed(() => !(this.setting()?.pointsName?.[this.code()] ?? '').trim());
  activeNegative = computed(() => (this.setting()?.activePeriod.value ?? 0) < 0);
  expiryNotPositive = computed(() => (this.setting()?.expiryPeriod.value ?? 0) <= 0);
  expirySoonNotPositive = computed(() => (this.setting()?.expirySoonPeriod?.value ?? 0) <= 0);
  pointsNotPositive = computed(() => (this.setting()?.pointsValue ?? 0) <= 0);
  currencyNegative = computed(() => (this.setting()?.currencyValue ?? 0) < 0);
  periodError = computed(() => {
    const s = this.setting();
    return !!s && this.days(s.expiryPeriod) <= this.days(s.activePeriod);
  });
  reasonValid = computed(() => (this.reason()[this.code()] ?? '') !== '');

  formValid = computed(() => {
    const s = this.setting();
    return (
      !!s &&
      (s.pointsName?.[this.code()] ?? '') !== '' &&
      s.pointsValue > 0 &&
      s.currencyValue > 0 &&
      this.reasonValid() &&
      !this.periodError()
    );
  });

  async save(): Promise<void> {
    const s = this.setting();
    if (!s || !this.formValid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.setPointsSettings({ setting: s, reason: this.reason(), note: this.note() });
      this.original = this.snapshot();
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate([BASE]);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate([BASE]);
  }
}
