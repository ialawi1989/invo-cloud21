import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { downloadPdf } from '@core/utils/pdf-download';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { InvoicePayment } from '../../../models/invoice-payment.model';
import { PaymentsService } from '../../services/payments.service';
import { PaymentActions } from '../../services/payment-actions';
import { PaymentReceiptComponent } from '../../components/payment-receipt/payment-receipt.component';
import { SendDocumentData, SendDocumentModalComponent } from '../../../components/send-document-modal/send-document-modal.component';

/**
 * Payments → view (`/account/payments/view/:id`). Legacy `PaymentsViewComponent`: the receipt,
 * print / PDF, email / WhatsApp, edit and delete (both hidden for reconciled payments).
 */
@Component({
  selector: 'app-payment-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, BreadcrumbsComponent, DropdownMenuBtnComponent, PaymentReceiptComponent],
  templateUrl: './payment-view.component.html',
  styleUrl: './payment-view.component.scss',
})
export class PaymentViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private privileges = inject(PrivilegeService);
  private payments = inject(PaymentsService);
  readonly actions = inject(PaymentActions);

  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  payment = signal<InvoicePayment | null>(null);
  breadcrumbs: BreadcrumbItem[] = [];

  get id(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }
  get canPrint() { return this.privileges.check('invoicePaymentsSecurity.actions.print.access'); }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/payments');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('PAYMENTS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('PAYMENTS.LIST.PAYMENTS_LIST'), routerLink: '/account/payments' },
      { label: t('PAYMENTS.VIEW.VIEW_PAYMENT') },
    ];
    this.route.paramMap.subscribe(() => void this.load());
  }

  async load(): Promise<void> {
    const p = await this.payments.getInvoicePayment(this.id);
    if (!p?.id) {
      void this.router.navigate(['/account/payments']);
      return;
    }
    this.payment.set(p);
  }

  printItems(): DropdownMenuBtnItem[] {
    const t = (k: string) => this.lang.instant(k);
    return [
      { label: t('PAYMENTS.VIEW.PRINT'), click: () => void this.printPdf(), disabled: false, danger: false },
      { label: 'PDF', click: () => void this.savePdf(), disabled: false, danger: false },
    ];
  }

  back(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/payments']);
  }
  edit(): void { void this.router.navigate(['/account/payments', this.id]); }

  async remove(): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant('COMMON.DELETE'), message: this.lang.instant('PAYMENTS.VIEW.CONFIRM_DELETE'), danger: true },
    }).afterClosed();
    if (!ok) return;
    try {
      await this.payments.DeleteInvPay(this.id);
      this.toast.success('PAYMENTS.VIEW.DELETED');
      void this.router.navigate(['/account/payments']);
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    }
  }

  async send(): Promise<void> {
    const p = this.payment()!;
    await this.modal.open<SendDocumentModalComponent, SendDocumentData, boolean>(SendDocumentModalComponent, {
      size: 'md',
      data: {
        emails: p.customerEmail ? [p.customerEmail] : [],
        sendEmail: payload => this.payments.sendInvoicePaymentEmail({ ...payload, invoicePaymentId: p.id }),
        whatsapp: { type: 'invoicePayment', id: p.id!, phone: p.customerContact },
      },
    }).afterClosed();
  }

  async savePdf(): Promise<void> {
    const res = await this.payments.viewInvoicePaymentPdf(this.id);
    if (res) downloadPdf(res, 'payment.pdf');
  }

  async printPdf(): Promise<void> {
    const base64 = await this.payments.viewInvoicePaymentPdf(this.id);
    if (!base64) return;
    const bytes = atob(String(base64).replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><body style="margin:0"><iframe id="pdf" src="${url}" style="width:100%;height:100vh;border:none"></iframe>` +
      `<script>document.getElementById('pdf').onload=function(){this.contentWindow.focus();this.contentWindow.print();}<\/script></body></html>`,
    );
    w.document.close();
  }
}
