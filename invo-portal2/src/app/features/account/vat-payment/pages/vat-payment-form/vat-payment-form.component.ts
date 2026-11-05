import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';

import { VatPayment } from '../../../models/vat-payment.model';
import { VatPaymentService } from '../../services/vat-payment.service';
import { VatPaymentActions } from '../../services/vat-payment-actions';
import { VatReportContentComponent, VatReportTotals } from '../../components/vat-report-content/vat-report-content.component';
import { PayVatPaymentData, PayVatPaymentModalComponent } from '../../components/pay-vat-payment-modal/pay-vat-payment-modal.component';

const ymd = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/** A yyyy-MM-dd as a local date (new Date('2024-01-31') would be UTC and slip a day back in negative offsets). */
const localDate = (v: any): Date | null => {
  const s = ymd(v);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * VAT payment -> create / edit (`/account/vat-payment/:id`, `new` / `0` = new). Legacy `VatPaymentFormComponent`:
 * the period starts the day after the previous return ended (fixed), the user picks its end (before today), the
 * sales / purchase VAT of that period is shown as the VAT return and its net is what gets saved. Once saved the
 * period end is fixed; "Pay" settles the amount due.
 */
@Component({
  selector: 'app-vat-payment-form',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent,
    DatePickerComponent, DropdownMenuBtnComponent, VatReportContentComponent,
  ],
  templateUrl: './vat-payment-form.component.html',
  styleUrl: './vat-payment-form.component.scss',
})
export class VatPaymentFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private modal = inject(ModalService);
  private service = inject(VatPaymentService);
  private actions = inject(VatPaymentActions);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private listParams: Record<string, any> = {};
  private dirty = false;

  vatPayment = new VatPayment();
  formStatus: 'new' | 'edit' = 'new';
  breadcrumbs: BreadcrumbItem[] = [];
  submitting = false;
  showErrors = false;
  loaded = false;
  /** The period end the user picked (yyyy-MM-dd); empty until chosen. */
  toValue = '';
  fromValue = '';

  /** The period end must be after the start and before today. */
  minTo: Date | null = null;
  readonly maxTo = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 1); return d; })();

  get canAdd(): boolean { return this.actions.canAdd; }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/vat-payment');
    const q = this.route.snapshot.queryParams;
    for (const k of ['pageNum', 'pageLimit', 'searchTerm', 'filterByBranch', 'fromDate', 'toDate']) {
      if (q[k]) this.listParams[k] = q[k];
    }

    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === '0' || id === 'new';
    this.formStatus = isNew ? 'new' : 'edit';

    if (isNew) {
      this.vatPayment = new VatPayment();
      this.vatPayment.from = await this.service.getNewTransactionDate();
      this.vatPayment.to = null;
    } else {
      this.vatPayment = await this.service.getVatPayment(id!);
      this.toValue = ymd(this.vatPayment.to);
    }
    this.fromValue = ymd(this.vatPayment.from);
    this.minTo = localDate(this.vatPayment.from);

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('VAT_PAYMENT.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('VAT_PAYMENT.LIST.VAT_PAYMENTS'), routerLink: '/account/vat-payment' },
      { label: t(isNew ? 'VAT_PAYMENT.FORM.NEW_VAT_PAYMENT' : 'VAT_PAYMENT.FORM.EDIT_VAT_PAYMENT') },
    ];
    this.loaded = true;
    this.cdr.detectChanges();
  }

  hasUnsavedChanges(): boolean { return !this.submitting && this.dirty; }

  get toDateValue(): Date | null { return localDate(this.toValue); }

  onTo(v: any): void {
    if (!(v instanceof Date)) return;
    this.toValue = ymd(v);
    this.vatPayment.to = this.toValue;
    this.dirty = true;
  }

  /** The VAT return reloaded for the period: keep its net / output / input on the record. */
  onReport(r: VatReportTotals): void {
    this.vatPayment.netVat = MathUtils.roundDecimal(r.netVat);
    this.vatPayment.outputVat = r.output;
    this.vatPayment.inputVat = r.input;
  }

  get toError(): string | null {
    if (!this.showErrors) return null;
    if (!this.toValue) return this.lang.instant('VAT_PAYMENT.FORM.THIS_VALUE_IS_REQUIRED');
    if (this.toValue < this.fromValue) return this.lang.instant('VAT_PAYMENT.FORM.TO_MUST_BE_LARGER_THAN_FROM');
    return null;
  }

  private get valid(): boolean { return !!this.toValue && this.toValue >= this.fromValue; }

  get canPay(): boolean {
    return this.canAdd && !!this.vatPayment.id && this.vatPayment.amountDue !== 0;
  }

  actionsMenu(): DropdownMenuBtnItem[] {
    if (this.formStatus !== 'edit' || !this.vatPayment.id) return [];
    return this.actions.menu(this.vatPayment, this.vatPayment.id, true, () => { this.dirty = false; this.goList(); });
  }

  private goList(): void { void this.router.navigate(['/account/vat-payment'], { queryParams: this.listParams }); }

  /** Saves the return. Resolves the saved record's id, or '' when it was refused. */
  private async persist(): Promise<string> {
    this.showErrors = true;
    if (!this.valid) { this.cdr.detectChanges(); return ''; }
    this.submitting = true;
    try {
      const res: any = await this.service.saveVatPayment(this.vatPayment);
      if (res?.success) {
        this.dirty = false;
        const id = res.data?.id ?? this.vatPayment.id;
        this.vatPayment.id = id;
        return id;
      }
      this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
      return '';
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
      return '';
    } finally {
      this.submitting = false;
      this.cdr.detectChanges();
    }
  }

  async save(): Promise<void> {
    if (this.submitting) return;
    if (await this.persist()) {
      this.toast.success('COMMON.SAVED_OK');
      this.goList();
    }
  }

  /** Saves a new return first (a payment needs the return's id), then opens the payment dialog. */
  async pay(): Promise<void> {
    if (this.submitting) return;
    if (!this.vatPayment.id || this.dirty) {
      if (!(await this.persist())) return;
      // Re-read: the saved record carries what the server computed (branch, paid total, due).
      this.vatPayment = await this.service.getVatPayment(this.vatPayment.id);
    }
    const paid = await this.modal.open<PayVatPaymentModalComponent, PayVatPaymentData, boolean>(PayVatPaymentModalComponent, {
      size: 'md',
      data: { vatPayment: this.vatPayment },
    }).afterClosed();
    if (paid) this.goList();
    else { this.formStatus = 'edit'; this.cdr.detectChanges(); }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else this.goList();
  }

  view(): void {
    this.dirty = false;
    void this.router.navigate(['/account/vat-payment/view', this.vatPayment.id], { queryParams: this.listParams });
  }
}
