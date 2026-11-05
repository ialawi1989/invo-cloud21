import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { BillingPayment } from '../../../models/billing-payment.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocViewSkeletonComponent } from '../../../components/doc-view-skeleton/doc-view-skeleton.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { buildExtraJournals } from '../../../services/doc-journal-extras';
import { BillPaymentReceiptComponent } from '../../components/bill-payment-receipt/bill-payment-receipt.component';
import { BillsPaymentService } from '../../services/bills-payment.service';
import { BillPaymentActions } from '../../services/bill-payment-actions';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/**
 * Bill payments -> view (`/account/bills-payment/view/:id`). Legacy `PaymentsViewComponent`: the receipt, print /
 * PDF, email / WhatsApp, edit and delete (both hidden for reconciled payments) - laid out like the other document
 * views (record rail, toolbar, the document, Logs). A payment has no document template, so the paper is replaced
 * by `<app-bill-payment-receipt>`.
 */
@Component({
  selector: 'app-bill-payment-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, BillPaymentReceiptComponent],
  providers: [MycurrencyPipe, DatePipe],
  templateUrl: './bill-payment-view.component.html',
  styleUrl: './bill-payment-view.component.scss',
  // See invoice-view.component.ts - `display: contents` keeps the fixed-height chain intact.
  host: { style: 'display: contents' },
})
export class BillPaymentViewComponent extends DocumentViewBase {
  private payments = inject(BillsPaymentService);
  private currency = inject(MycurrencyPipe);
  private datePipe = inject(DatePipe);
  readonly actions = inject(BillPaymentActions);

  readonly cfg: DocViewConfig = {
    features: ['account/bills-payment'],
    routeBase: '/account/bills-payment',
    zoomKey: 'billPaymentZoomLevel',
    numberField: 'paymentName',
    whatsappType: 'billPayment',
    filePrefix: 'bill-payment',
    titleKey: 'BILLS_PAYMENT.VIEW.PAYMENT',
    dashboardCrumbKey: 'BILLS_PAYMENT.DASHBOARD',
    listCrumbKey: 'BILLS_PAYMENT.LIST.PAYMENTS_LIST',
    viewCrumbKey: 'BILLS_PAYMENT.VIEW.VIEW_PAYMENT',
  };

  protected svc: DocViewService = {
    get: id => this.payments.getBillingPayment(id),
    pdf: id => this.payments.viewBillPaymentPdf(id),
    sendEmail: (payload, id) => this.payments.sendBillPaymentEmail({ ...payload, billPaymentId: id }),
  };

  /** Never drawn - the receipt component is the document. */
  protected toRenderData(_p: BillingPayment): DocumentRenderData { return {} as DocumentRenderData; }

  protected override recipient(p: BillingPayment) { return { emails: p.supplierEmail ? [p.supplierEmail] : [], phone: '' }; }

  protected override async onInit(): Promise<void> {
    this.initRail(
      (term, page) => this.payments.getBillingPaymentList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: {} })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.supplierName,
      amountLabel: this.currency.transform(r.paidAmount),
      sub: `${r.paymentName ?? ''} | ${this.datePipe.transform(r.paymentDate, 'dd/MM/yyyy')}${r.branchName ? ' · ' + r.branchName : ''}`,
      data: r,
    };
  }

  /** The receipt has no lines to export. */
  override exportItems(): DropdownMenuBtnItem[] { return []; }

  actionItems(p: BillingPayment): DropdownMenuBtnItem[] { return this.actions.menu(p, this.id, () => this.goToList()); }

  /** "Additional Details" under the receipt - the payment's Logs. */
  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('BILLS_PAYMENT.VIEW.PAYMENT'),
      loadJournal: () => this.loadJournal(),
      logsSourceTable: 'BillingPayments',
      logsSourceId: this.id,
    };
  }

  /** The payment's journal (`accounts/getBillingPaymentJournal/:id`): its own rows, then one block per bill it settled. */
  private async loadJournal(): Promise<DocJournalResult> {
    const j: any = await this.payments.getBillingPaymentJournal(this.id);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: buildExtraJournals('billPayment', j?.extraJournals, (k, p) => this.lang.instant(k, p)) };
  }
}
