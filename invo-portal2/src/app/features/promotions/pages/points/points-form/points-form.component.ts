import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { CustomerMini, CustomerPickerComponent } from '@shared/components/customer-picker/customer-picker.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { fromDate } from '../../../models/common.model';
import { clone, getToday, withCurrentTime } from '../../../models/promotions-utils';
import { CustomerPoint, CustomerPointsStatues, PointsSettings } from '../../../models/points.model';
import { PointsService } from '../../../services/points.service';
import { InvoiceInfo } from '../../../services/promotions-accounting.service';
import { InvoicePickerComponent } from '../../../components/invoice-picker/invoice-picker.component';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';

const BASE = '/promotions/promotional-points';
const K = 'PROMOTIONS.PROMOTIONS_POINTS.';

/**
 * Give points (`/new`) — the legacy `AddPointFormComponent` as a routed page.
 * Field set, defaults, validation, the "this invoice looks off" confirmations
 * and the save payload are the legacy ones.
 */
@Component({
  selector: 'app-points-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, FormStickyFooterComponent,
    DatePickerComponent, CustomerPickerComponent, PhoneInputComponent, InvoicePickerComponent,
    TranslatedStringInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './points-form.component.html',
  styleUrl: './points-form.component.scss',
})
export class PointsFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(PointsService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  loading = signal(true);
  saving = signal(false);
  settings = signal<PointsSettings | null>(null);
  point = signal<CustomerPoint | null>(null);
  customerSelected = signal(false);
  selectedInvoice = signal<InvoiceInfo | undefined>(undefined);
  private original = '';

  breadcrumbs = signal<BreadcrumbItem[]>([]);
  private code = computed(() => this.lang.current() || 'en');

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs.set([
      { label: t(K + 'PROMOTIONS_POINTS'), routerLink: BASE },
      { label: t(K + 'GIVE_PROMOTIONS_POINTS') },
    ]);
    const settings = await this.service.getPointsSettings();
    this.settings.set(settings);

    const today = getToday();
    this.point.set({
      givenDate: today,
      activeDate: fromDate(today, settings.activePeriod),
      expiryDate: fromDate(today, settings.expiryPeriod),
      id: '',
      phoneNumber: '',
      status: CustomerPointsStatues.INACTIVE,
      reason: {},
      givenPoints: 1,
      isCanceled: false,
      activePoints: 1,
    });
    this.original = this.snapshot();
    this.loading.set(false);
  }

  private snapshot(): string {
    return JSON.stringify(this.point());
  }

  hasUnsavedChanges(): boolean {
    return !this.saving() && !this.loading() && this.snapshot() !== this.original;
  }

  patch(part: Partial<CustomerPoint>): void {
    this.point.update(p => (p ? { ...p, ...part } : p));
  }

  // ── customer / invoice ────────────────────────────────────────────
  onCustomer(c?: CustomerMini): void {
    this.customerSelected.set(!!c);
    this.patch({ phoneNumber: c ? c.phone || '' : '' });
  }

  /** Legacy quirk kept: the invoice's phone is only copied (and the invoice remembered) while the phone is still empty. */
  onInvoice(selected?: InvoiceInfo): void {
    if (selected) {
      const part: Partial<CustomerPoint> = { invoiceId: selected.id, orderNumber: selected.invoiceNumber };
      if (!this.point()?.phoneNumber) {
        part.phoneNumber = selected.phone || '';
        this.selectedInvoice.set(selected);
      }
      this.patch(part);
    } else {
      this.patch({ invoiceId: undefined, orderNumber: undefined });
      this.selectedInvoice.set(undefined);
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
    const p = this.point();
    if (!p) return null;
    const d = new Date(p.activeDate);
    d.setDate(d.getDate() + 1);
    return d;
  });

  // ── validation (legacy) ───────────────────────────────────────────
  phoneError = computed<string | null>(() => {
    const phone = this.point()?.phoneNumber;
    if (!phone) return 'REQUIRED';
    return /^\+?\d{8,}$/.test(phone) ? null : 'INVALID';
  });

  pointsError = computed<string | null>(() => {
    const g = this.point()?.givenPoints;
    if (g === null) return 'REQUIRED';
    if ((g as number) < 1) return 'LESS_THAN_1';
    return null;
  });

  reasonValid = computed(() => (this.point()?.reason?.[this.code()] ?? '') !== '');

  formValid = computed(() => {
    const p = this.point();
    return !!p && this.phoneError() === null && p.givenPoints !== undefined && p.givenPoints >= 1 && this.reasonValid();
  });

  /** Warn when the chosen invoice was paid with points, already gave points, or is not paid (legacy). */
  private confirmKey(): string {
    const p = this.point();
    if (!p?.orderNumber) return '';
    const inv = this.selectedInvoice();
    if (inv?.isPointPayment === true || inv?.isGavePoints === true || inv?.status !== 'Paid') {
      if (inv?.isPointPayment) return 'CONFIRM_POINT_PAYMENT';
      if (inv?.isGavePoints) return 'CONFIRM_POINTS_ALREADY_GIVEN';
      if (inv?.status !== 'Paid') return 'CONFIRM_INVOICE_NOT_PAID';
    }
    return '';
  }

  async save(): Promise<void> {
    const p = this.point();
    if (!p || !this.formValid() || this.saving()) return;

    const key = this.confirmKey();
    if (key) {
      const ok = await this.modal
        .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
          size: 'sm',
          data: {
            title: this.lang.instant(K + key),
            message: '',
            confirm: this.lang.instant('COMMON.YES'),
            cancel: this.lang.instant('COMMON.NO'),
          },
        })
        .afterClosed();
      if (!ok) return;
    }

    this.saving.set(true);
    try {
      const body: CustomerPoint = {
        ...clone(p),
        givenDate: new Date(),
        activeDate: withCurrentTime(p.activeDate),
        expiryDate: withCurrentTime(p.expiryDate),
      };
      await this.service.addCustomerPoints(body);
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
