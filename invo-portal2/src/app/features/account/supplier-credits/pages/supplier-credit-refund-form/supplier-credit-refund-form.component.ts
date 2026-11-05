import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { SupplierCredit } from '../../../models/supplier-credit.model';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { SupplierCreditsService } from '../../services/supplier-credits.service';

/**
 * Supplier credits -> refund (`/account/supplier-credit/refund/:supplierCreditId`). Legacy
 * `SupplierCreditRefundFormComponent`: the supplier pays the unused balance of a credit back through one of
 * the branch's payment methods (date, reference, amount up to the balance, description), saved through
 * `accounts/saveSupplierRefund`.
 */
@Component({
  selector: 'app-supplier-credit-refund-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent, DatePickerComponent, SearchDropdownComponent],
  templateUrl: './supplier-credit-refund-form.component.html',
  // Same card / field identity as the other account forms.
  styleUrls: ['../../../payments/pages/payment-form/payment-form.component.scss', '../../../credit-notes/pages/credit-note-refund-form/credit-note-refund-form.component.scss'],
})
export class SupplierCreditRefundFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private lookups = inject(SalesLookupsService);
  private credits = inject(SupplierCreditsService);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private dirty = false;

  credit = new SupplierCredit();
  creditId = '';
  paymentMethods: any[] = [];
  breadcrumbs: BreadcrumbItem[] = [];
  /** The most this refund may take: the credit's unused balance. */
  maxAmount = 0;
  amount = 0;
  methodId = '';
  reference = '';
  description = '';
  /** Legacy "Payment mode" (Cash / Card), stored on the refund. */
  paymentMode = '';
  readonly paymentModes = ['Cash', 'Card'];
  onMode(v: any): void { this.paymentMode = (Array.isArray(v) ? v[0] : v) ?? ''; this.markDirty(); }
  /** Memoised so the date picker keeps one Date instance between change-detection passes. */
  refundDate = new Date();
  submitting = false;
  showErrors = false;
  loaded = false;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/supplier-credits');
    this.creditId = this.route.snapshot.paramMap.get('supplierCreditId') ?? '';
    this.credit = await this.credits.getSupplierCredit(this.creditId);
    this.maxAmount = Number(this.credit.refundDue) || 0;
    this.amount = this.maxAmount;
    this.paymentMethods = await this.lookups.getMiniPaymentMethods(this.credit.branchId, null);

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('SUPPLIER_CREDITS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('SUPPLIER_CREDITS.LIST.CREDITS_LIST'), routerLink: '/account/supplier-credit' },
      { label: t('SUPPLIER_CREDITS.VIEW.VIEW_SUPPLIER_CREDIT'), routerLink: ['/account/supplier-credit/view', this.creditId] },
      { label: t('SUPPLIER_CREDITS.REFUND.NEW') },
    ];
    this.loaded = true;
  }

  hasUnsavedChanges(): boolean { return !this.submitting && this.dirty; }
  markDirty(): void { this.dirty = true; }

  get issues(): string[] {
    const out: string[] = [];
    if (!this.creditId) out.push('SUPPLIER_CREDITS.REFUND.REQUIRED_CREDIT');
    if (!this.methodId) out.push('SUPPLIER_CREDITS.REFUND.REQUIRED_METHOD');
    if (!(this.amount > 0)) out.push('SUPPLIER_CREDITS.REFUND.REQUIRED_AMOUNT');
    return out;
  }

  onDate(v: any): void { if (v instanceof Date) { this.refundDate = v; this.markDirty(); } }
  onAmount(v: any): void {
    let n = Number(v) || 0;
    if (n < 0) n = 0;
    if (n > this.maxAmount) n = this.maxAmount;
    this.amount = n;
    this.markDirty();
  }
  pickMethod(m: any): void { this.methodId = m.id; this.markDirty(); }

  async save(): Promise<void> {
    if (this.submitting) return;
    if (this.issues.length) {
      this.showErrors = true;
      this.toast.error('COMMON.OPS', this.issues.map(k => this.lang.instant(k)).join(', '));
      return;
    }
    this.submitting = true;
    try {
      const res: any = await this.credits.saveSupplierRefund({
        id: '',
        supplierCreditId: this.creditId,
        refundedDate: this.refundDate,
        reference: this.reference,
        referenceNumber: this.reference,
        description: this.description,
        paymentMode: this.paymentMode,
        total: this.amount,
        lines: [{ amount: this.amount, paymentMethodId: this.methodId }],
      });
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/supplier-credit']);
      } else {
        this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
        this.submitting = false;
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
      this.submitting = false;
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/supplier-credit']);
  }
}
