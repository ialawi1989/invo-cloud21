import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { InvoicePayment } from '../../../models/invoice-payment.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocViewSkeletonComponent } from '../../../components/doc-view-skeleton/doc-view-skeleton.component';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { buildExtraJournals } from '../../../services/doc-journal-extras';
import { DocAdditionalDetailsConfig, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { PaymentReceiptComponent } from '../../components/payment-receipt/payment-receipt.component';
import { PaymentsService } from '../../services/payments.service';
import { PaymentActions } from '../../services/payment-actions';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/** `rstatus` — the rail's status filter, persisted like `rpage`/`rq` are in {@link DocumentViewBase}. */
const RAIL_STATUS_PARAM: ParamDef<string | null> = {
  key: 'rstatus',
  codec: { encode: v => v || null, decode: r => r || null },
};

/**
 * Payments → view (`/account/payments/view/:id`). Legacy `PaymentsViewComponent`: the receipt, print / PDF,
 * email / WhatsApp, edit and delete (both hidden for reconciled payments) — laid out like the invoice view
 * (record rail, toolbar, the document below, Logs). The document is the receipt itself: payments have no
 * document template, so the paper is replaced by `<app-payment-receipt>`.
 */
@Component({
  selector: 'app-payment-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, DocViewShellComponent, DocViewSkeletonComponent, DocAdditionalDetailsComponent, DocViewAttachmentsComponent, PaymentReceiptComponent],
  providers: [MycurrencyPipe, MynumberPipe, DatePipe],
  templateUrl: './payment-view.component.html',
  styleUrl: './payment-view.component.scss',
  // See invoice-view.component.ts — `display: contents` keeps the fixed-height chain intact.
  host: { style: 'display: contents' },
})
export class PaymentViewComponent extends DocumentViewBase {
  private payments = inject(PaymentsService);
  private currency = inject(MycurrencyPipe);
  private number = inject(MynumberPipe);
  private datePipe = inject(DatePipe);
  private queryParams = inject(QueryParamsService);
  readonly actions = inject(PaymentActions);

  readonly cfg: DocViewConfig = {
    features: ['account/payments'],
    routeBase: '/account/payments',
    zoomKey: 'paymentZoomLevel',
    numberField: 'paymentName',
    whatsappType: 'invoicePayment',
    filePrefix: 'payment',
    titleKey: 'PAYMENTS.VIEW.PAYMENT',
    dashboardCrumbKey: 'PAYMENTS.DASHBOARD',
    listCrumbKey: 'PAYMENTS.LIST.PAYMENTS_LIST',
    viewCrumbKey: 'PAYMENTS.VIEW.VIEW_PAYMENT',
  };

  protected svc: DocViewService = {
    get: id => this.payments.getInvoicePayment(id),
    pdf: id => this.payments.viewInvoicePaymentPdf(id),
    sendEmail: (payload, id) => this.payments.sendInvoicePaymentEmail({ ...payload, invoicePaymentId: id }),
  };

  /** Never drawn — the receipt component is the document. */
  protected toRenderData(_p: InvoicePayment): DocumentRenderData { return {} as DocumentRenderData; }

  railStatus = signal<string | null>(null);
  /** Backend payment statuses (`FAILD` is the stored spelling). With none picked, failed / pending / void stay hidden. */
  readonly railStatusOptions: { value: string; key: string }[] = [
    { value: 'SUCCESS', key: 'STATUS_SUCCESS' },
    { value: 'PENDING', key: 'STATUS_PENDING' },
    { value: 'FAILD', key: 'STATUS_FAILED' },
  ];
  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('PAYMENTS.LIST.ALL_PAYMENTS') },
      ...this.railStatusOptions.map(o => ({ value: o.value, label: this.t('PAYMENTS.LIST.' + o.key) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    this.queryParams.writeOne(RAIL_STATUS_PARAM, status);
    void this.loadRail(1);
  }

  protected override async onInit(): Promise<void> {
    this.railStatus.set(this.queryParams.read({ status: RAIL_STATUS_PARAM }).status);
    this.initRail(
      (term, page) => this.payments.getInvoicePaymentsList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: { status: this.railStatus() ? [this.railStatus()] : [] } })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    const first = Array.isArray(r.invoicesNumber) ? r.invoicesNumber.find((n: string) => !!n) : null;
    // legacy: the tender amount (with "Eq." in the company currency when the rate isn't 1) unless more was paid than tendered
    const foreign = r.paidAmount <= r.tenderAmount && r.rate != 1;
    return {
      id: r.id,
      primary: (r.customerName || this.t('PAYMENTS.VIEW.NO_CUSTOMER')) + (first ? ` (${first})` : ''),
      amountLabel: r.paidAmount > r.tenderAmount ? this.currency.transform(r.paidAmount)
        : foreign ? `${this.number.transform(r.tenderAmount)} · Eq. ${this.currency.transform(r.equivalentAmount)}`
        : this.currency.transform(r.tenderAmount),
      sub: `${r.paymentMethodName ?? ''} | ${this.datePipe.transform(r.paymentDate, 'dd/MM/yyyy')}${r.branchName ? ' · ' + r.branchName : ''}`,
      data: r,
    };
  }

  /** The receipt has no lines to export. */
  override exportItems(): DropdownMenuBtnItem[] { return []; }

  /** Delete — rule and runner come from the shared {@link PaymentActions} (also used by the list). */
  actionItems(p: InvoicePayment): DropdownMenuBtnItem[] {
    return this.actions.menu(p, this.id, () => this.goToList());
  }

  /** "Additional Details" under the receipt - the payment's Journal and Logs. */
  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('PAYMENTS.VIEW.PAYMENT'),
      loadJournal: () => this.loadJournal(),
      logsSourceTable: 'InvoicePayments',
      logsSourceId: this.id,
    };
  }

  /** The payment's journal (`accounts/getInvoicePaymentJournals/:id`): its own rows, then one block per invoice line it settled. */
  private async loadJournal(): Promise<DocJournalResult> {
    const j: any = await this.payments.getInvoicePaymentJournals(this.id);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: buildExtraJournals('payment', j?.extraJournals, (k, p) => this.lang.instant(k, p)) };
  }
}
