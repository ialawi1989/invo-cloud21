import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import type { DocAdditionalDetailsConfig } from '../../../components/doc-additional-details/doc-additional-details.types';
import type { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { CreditNote } from '../../../models/credit-note.model';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { CreditNotesService } from '../../services/credit-notes.service';
import { Refund, RefundsService, newRefund } from '../../services/refunds.service';

/**
 * Credit notes → refund (`/account/credit-notes/refund/:creditNoteId`, edit: `/refund/view/:id`). Legacy
 * `CreditNoteRefundFormComponent`: pay the unused balance of a credit note back through one of the
 * branch's refund payment methods (date, reference, amount up to the balance, description), saved through
 * `accounts/saveRefund`.
 */
@Component({
  selector: 'app-credit-note-refund-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent, DatePickerComponent, DocAdditionalDetailsComponent],
  templateUrl: './credit-note-refund-form.component.html',
  // Same card / field identity as the other account forms.
  styleUrls: ['../../../payments/pages/payment-form/payment-form.component.scss', './credit-note-refund-form.component.scss'],
})
export class CreditNoteRefundFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);
  private lookups = inject(SalesLookupsService);
  private notes = inject(CreditNotesService);
  private refunds = inject(RefundsService);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  private dirty = false;

  refund: Refund = newRefund();
  creditNote = new CreditNote();
  creditNoteId = '';
  formStatus: 'new' | 'edit' = 'new';
  paymentMethods: any[] = [];
  breadcrumbs: BreadcrumbItem[] = [];
  /** The most this refund may take: the credit note's unused balance (plus what this refund already holds when editing). */
  maxAmount = 0;
  amount = 0;
  /** Memoised so the date picker keeps one Date instance between change-detection passes. */
  refundDate = new Date();
  submitting = false;
  showErrors = false;
  loaded = false;

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/credit-notes');
    const params = this.route.snapshot.paramMap;
    const refundId = params.get('id');

    if (refundId) {
      this.formStatus = 'edit';
      this.refund = await this.refunds.getRefund(refundId);
      this.creditNoteId = String(this.refund.creditNoteId ?? '');
    } else {
      this.creditNoteId = params.get('creditNoteId') ?? '';
    }

    this.creditNote = await this.notes.getCreditNote(this.creditNoteId);
    const held = this.formStatus === 'edit' ? Number(this.refund.lines[0]?.amount) || 0 : 0;
    this.maxAmount = (this.creditNote.remainingCredit ?? 0) + held;
    this.amount = this.formStatus === 'edit' ? held : this.creditNote.remainingCredit ?? 0;
    this.refund.branchId = this.refund.branchId || this.creditNote.branchId;
    this.refund.creditNoteId = this.creditNoteId;
    if (this.refund.refundDate) this.refundDate = new Date(this.refund.refundDate);

    this.paymentMethods = await this.lookups.getMiniPaymentMethods(this.refund.branchId, null, 'refund');

    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('CREDIT_NOTES.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('CREDIT_NOTES.LIST.CREDIT_NOTES_LIST'), routerLink: '/account/credit-notes' },
      { label: t('CREDIT_NOTES.VIEW.VIEW_CREDIT_NOTE'), routerLink: ['/account/credit-notes/view', this.creditNoteId] },
      { label: t(this.formStatus === 'new' ? 'CREDIT_NOTES.REFUND.NEW' : 'CREDIT_NOTES.REFUND.EDIT') },
    ];
    this.loaded = true;
  }

  /** Edit mode: the saved refund's journal (legacy shows it under the form through `<additional-details type="refund">`). */
  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal'],
      journalHeading: this.lang.instant('CREDIT_NOTES.REFUND.TITLE'),
      loadJournal: async () => {
        const rows: DocJournalRow[] = await this.refunds.getJournal(this.refund.id);
        rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
        return rows;
      },
    };
  }

  hasUnsavedChanges(): boolean { return !this.submitting && this.dirty; }
  markDirty(): void { this.dirty = true; }

  /** Changing the method of an existing refund is its own privilege (creating is unaffected). */
  get methodLocked(): boolean {
    return this.formStatus === 'edit' && !this.privileges.check('paymentMethodSecurity.actions.changePaymentMethod.access');
  }

  get line() { return this.refund.lines[0]; }

  get issues(): string[] {
    const out: string[] = [];
    if (!this.creditNoteId) out.push('CREDIT_NOTES.REFUND.REQUIRED_CREDIT_NOTE');
    if (!this.line.paymentMethodId) out.push('CREDIT_NOTES.REFUND.REQUIRED_METHOD');
    if (!(this.amount > 0)) out.push('CREDIT_NOTES.REFUND.REQUIRED_AMOUNT');
    return out;
  }

  onDate(v: any): void { if (v instanceof Date) { this.refundDate = v; this.refund.refundDate = v; this.markDirty(); } }
  onAmount(v: any): void {
    let n = Number(v) || 0;
    if (n > this.maxAmount) n = this.maxAmount;
    this.amount = n;
    this.markDirty();
  }
  pickMethod(m: any): void {
    if (this.methodLocked) return;
    this.line.paymentMethodId = m.id;
    this.line.paymentMethodName = m.name;
    this.markDirty();
  }

  async save(): Promise<void> {
    if (this.submitting) return;
    if (this.issues.length) {
      this.showErrors = true;
      this.toast.error('COMMON.OPS', this.issues.map(k => this.lang.instant(k)).join(', '));
      return;
    }
    this.refund.creditNoteId = this.creditNoteId;
    this.line.amount = this.amount;
    this.refund.total = this.amount;
    this.submitting = true;
    try {
      const res: any = await this.refunds.saveRefund(this.refund);
      if (res?.success) {
        this.dirty = false;
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/credit-notes']);
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
    else void this.router.navigate(['/account/credit-notes']);
  }
}
