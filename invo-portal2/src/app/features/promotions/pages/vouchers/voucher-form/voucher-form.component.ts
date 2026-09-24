import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { CustomerMini, CustomerPickerComponent } from '@shared/components/customer-picker/customer-picker.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { fromDate, TranslatedString } from '../../../models/common.model';
import { clone, getToday, withCurrentTime } from '../../../models/promotions-utils';
import { Voucher, VouchersSettings, VouchersStatues } from '../../../models/vouchers.model';
import { VouchersService } from '../../../services/vouchers.service';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';

/**
 * Give gift vouchers (`/new`) and edit one (`/:id/edit`) — the legacy
 * `AddVoucherFormComponent` (title 'add' | 'edit') as a routed page. Field set,
 * defaults, validation and the save payloads are the legacy ones.
 */
@Component({
  selector: 'app-voucher-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent,
    DatePickerComponent, CustomerPickerComponent, TranslatedStringInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voucher-form.component.html',
  styleUrl: './voucher-form.component.scss',
})
export class VoucherFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(VouchersService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private company = inject(CompanyService);

  loading = signal(true);
  saving = signal(false);
  isEdit = signal(false);
  settings = signal<VouchersSettings | null>(null);
  voucher = signal<Voucher | null>(null);
  count = signal<number | null>(1);
  /** Edit mode keeps its reason/notes apart from the voucher (legacy `data.reason` / `data.notes`). */
  editReason = signal<TranslatedString>({});
  editNotes = signal('');
  customerSelected = signal(false);
  private original = '';

  breadcrumbs = signal<BreadcrumbItem[]>([]);
  private code = computed(() => this.lang.current() || 'en');

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t('PROMOTIONS.PROMOTIONS_VOUCHERS.PROMOTIONS_VOUCHERS'), routerLink: '/promotions/promotions-vouchers' },
      { label: t(id ? 'PROMOTIONS.PROMOTIONS_VOUCHERS.EDIT_PROMOTIONS_VOUCHERS' : 'PROMOTIONS.PROMOTIONS_VOUCHERS.GIVE_PROMOTIONS_VOUCHERS') },
    ]);

    const settings = await this.service.getVouchersSettings();
    this.settings.set(settings);

    if (id) {
      this.voucher.set(clone(await this.service.getCustomerVoucher(id)));
      this.editNotes.set(' ');
    } else {
      const today = getToday();
      this.voucher.set({
        givenDate: today,
        code: '',
        activeDate: fromDate(today, settings.activePeriod),
        expiryDate: fromDate(today, settings.expiryPeriod),
        id: '',
        phoneNumber: '',
        status: VouchersStatues.INACTIVE,
        reason: {},
        initialVoucher: 1,
        isCanceled: false,
        balance: 1,
        vouchersName: settings.vouchersName,
        oneTimeUse: true,
        private: false,
      });
    }
    this.original = this.snapshot();
    this.loading.set(false);
  }

  private snapshot(): string {
    return JSON.stringify({ v: this.voucher(), c: this.count(), r: this.editReason(), n: this.editNotes() });
  }

  hasUnsavedChanges(): boolean {
    return !this.saving() && !this.loading() && this.snapshot() !== this.original;
  }

  patch(part: Partial<Voucher>): void {
    this.voucher.update(v => (v ? { ...v, ...part } : v));
  }

  // ── decimals (legacy MathHelpers.afterDecimal) ────────────────────
  private afterDecimal = computed(() => this.company.settings()?.settings?.afterDecimal ?? 3);
  amountStep = computed(() =>
    this.afterDecimal() > 0 ? (1 / Math.pow(10, this.afterDecimal())).toFixed(this.afterDecimal()) : '1');

  limitDecimals(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [intPart, decPart] = input.value.split('.');
    const dec = this.afterDecimal();
    if (decPart === undefined || decPart.length <= dec) return;
    const trimmed = dec > 0 ? `${intPart}.${decPart.slice(0, dec)}` : intPart;
    input.value = trimmed;
    this.patch({ initialVoucher: Number(trimmed) });
  }

  roundAmount(): void {
    const value = this.voucher()?.initialVoucher;
    if (value === null || value === undefined || (value as any) === '') return;
    this.patch({ initialVoucher: Number(Number(value).toFixed(this.afterDecimal())) });
  }

  // ── customer ──────────────────────────────────────────────────────
  onCustomer(c?: CustomerMini): void {
    this.customerSelected.set(!!c);
    if (c) {
      this.patch({ customerName: c.displayName, customerEmail: c.email || '', phoneNumber: c.phone || '' });
    } else {
      this.patch({ customerName: undefined, customerEmail: undefined, phoneNumber: '' });
    }
  }

  onActiveDate(d: any): void {
    if (d instanceof Date) this.patch({ activeDate: d });
  }
  onExpiryDate(d: any): void {
    if (d instanceof Date) this.patch({ expiryDate: d });
  }

  /** Expiry can be at earliest the day after activation (legacy `getMinDate`). */
  minExpiry = computed(() => {
    const v = this.voucher();
    if (!v) return null;
    const d = new Date(v.activeDate);
    d.setDate(d.getDate() + 1);
    return d;
  });

  // ── validation (legacy) ───────────────────────────────────────────
  emailValid = computed(() => {
    const email = this.voucher()?.customerEmail?.trim();
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  });

  countValid = computed(() => {
    if (this.isEdit()) return true;
    const c = Number(this.count());
    return Number.isInteger(c) && c > 0;
  });

  amountError = computed<string | null>(() => {
    const a = this.voucher()?.initialVoucher;
    if (a === null) return 'REQUIRED';
    if ((a as number) < 1) return 'LESS_THAN_1';
    return null;
  });

  phoneError = computed<string | null>(() => {
    const v = this.voucher();
    if (!v) return null;
    if (!v.phoneNumber) return v.private ? 'REQUIRED' : null;
    return /^\+?\d{8,}$/.test(v.phoneNumber) ? null : 'INVALID';
  });

  reasonValid = computed(() => {
    if (this.isEdit()) return true;
    const v = this.voucher();
    const reason = v?.reason?.[this.code()] ?? this.editReason()[this.code()];
    return !!reason?.trim();
  });

  formValid = computed(() => {
    const v = this.voucher();
    if (!v) return false;
    const amountOk = v.initialVoucher !== undefined && v.initialVoucher >= 1;
    return this.phoneError() === null && amountOk && this.reasonValid();
  });

  async save(): Promise<void> {
    const v = this.voucher();
    if (!v || !this.formValid() || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.isEdit()) {
        await this.service.editCustomerVouchers(v.id, this.editReason() ?? {}, this.editNotes() ?? '', v);
      } else {
        const voucher: Voucher = {
          ...v,
          givenDate: new Date(),
          activeDate: withCurrentTime(v.activeDate),
          expiryDate: withCurrentTime(v.expiryDate),
        };
        await this.service.addCustomerVouchers({ voucher, count: this.count() ?? 1 });
      }
      this.original = this.snapshot();
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate(
        this.isEdit() ? ['/promotions/promotions-vouchers', v.id] : ['/promotions/promotions-vouchers'],
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    const v = this.voucher();
    void this.router.navigate(
      this.isEdit() && v ? ['/promotions/promotions-vouchers', v.id] : ['/promotions/promotions-vouchers'],
    );
  }
}
