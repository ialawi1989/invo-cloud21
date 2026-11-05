import { railKind } from '@shared/utils/status-tone';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { VatPayment, VatPaymentLine } from '../../../models/vat-payment.model';
import { formatJournalDate } from '../../../services/journal-date';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocExtraJournal, DocJournalResult } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { PayVatPaymentData, PayVatPaymentModalComponent } from '../../components/pay-vat-payment-modal/pay-vat-payment-modal.component';
import { VatPaymentService } from '../../services/vat-payment.service';
import { VatPaymentActions, vatStatusClass } from '../../services/vat-payment-actions';

/**
 * VAT payment -> view (`/account/vat-payment/view/:id`). Same layout as the customer view: the record rail on the
 * left, the title bar with Edit / Pay / Actions, then the return's figures, its payment history (a payment can be
 * edited until it is reconciled) and the Journal / Logs tabs. Edit / Pay / Delete follow {@link VatPaymentActions}.
 */
@Component({
  selector: 'app-vat-payment-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, DropdownMenuBtnComponent, DocViewShellComponent, DocAdditionalDetailsComponent],
  providers: [MycurrencyPipe, DatePipe],
  templateUrl: './vat-payment-view.component.html',
  styleUrl: './vat-payment-view.component.scss',
  // See invoice-view.component.ts - `display: contents` keeps the fixed-height chain intact.
  host: { style: 'display: contents' },
})
export class VatPaymentViewComponent extends DocumentViewBase {
  private service = inject(VatPaymentService);
  private currency = inject(MycurrencyPipe);
  private datePipe = inject(DatePipe);
  readonly actions = inject(VatPaymentActions);

  readonly cfg: DocViewConfig = {
    features: ['account/vat-payment'],
    routeBase: '/account/vat-payment',
    zoomKey: 'vatPaymentZoomLevel',
    numberField: 'id',
    whatsappType: 'vatPayment',
    filePrefix: 'vat-payment',
    titleKey: 'VAT_PAYMENT.VIEW.VAT_PAYMENT',
    dashboardCrumbKey: 'VAT_PAYMENT.DASHBOARD',
    listCrumbKey: 'VAT_PAYMENT.LIST.VAT_PAYMENTS',
    viewCrumbKey: 'VAT_PAYMENT.VIEW.VIEW_VAT_PAYMENT',
  };

  protected svc: DocViewService = {
    get: id => this.service.getVatPayment(id),
    pdf: () => Promise.resolve(null),
    sendEmail: () => Promise.resolve(null),
  };

  /** Never drawn - there is no document paper. */
  protected toRenderData(_v: VatPayment): DocumentRenderData { return {} as DocumentRenderData; }

  payments = signal<any[]>([]);
  isLatest = signal(false);
  details: DocAdditionalDetailsConfig = { tabs: [] };
  /** Rail's status filter (null = all); sent as `filter.status`. */
  railStatus = signal<string | null>(null);

  /** The title bar shows the period. */
  period = computed(() => {
    const v = this.doc() as VatPayment | null;
    return v ? `${this.datePipe.transform(v.from, 'dd/MM/yyyy')} – ${this.datePipe.transform(v.to, 'dd/MM/yyyy')}` : '';
  });

  protected override async onInit(): Promise<void> {
    this.details = {
      tabs: ['journal', 'logs'],
      journalHeading: this.t('VAT_PAYMENT.VIEW.VAT_PAYMENT'),
      loadJournal: () => this.loadJournal(),
      logsSourceTable: 'VatPayments',
      logsSourceId: this.id,
    };
    this.initRail(
      (term, page) => this.service.getVatPaymentList({ page, limit: this.railPageSize, searchTerm: term, filter: this.railStatus() ? { status: [this.railStatus()] } : {} })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('VAT_PAYMENT.VIEW.ALL_VAT_PAYMENTS') },
      ...['Initiated', 'Partially Paid', 'Paid'].map(v => ({ value: v, label: this.statusLabel(v) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    void this.loadRail(1);
  }

  private mapRailItem(r: VatPayment): DocRailItem {
    return {
      id: r.id,
      primary: `${this.datePipe.transform(r.from, 'dd/MM/yyyy')} – ${this.datePipe.transform(r.to, 'dd/MM/yyyy')}`,
      amountLabel: this.currency.transform(r.amountDue),
      sub: r.branchName ?? '',
      statusText: this.statusLabel(r.status),
      statusKind: railKind(r.status),
      data: r,
    };
  }

  protected override async afterLoad(_v: VatPayment): Promise<void> {
    const [payments, newest] = await Promise.all([
      this.service.getVatPayments(this.id),
      this.service.getVatPaymentList({ page: 1, limit: 1, searchTerm: '', filter: {} }),
    ]);
    this.payments.set(payments ?? []);
    this.isLatest.set(newest.list[0]?.id === this.id);
  }

  private async loadJournal(): Promise<DocJournalResult> {
    const j: any = await this.service.getVatPaymentJournal(this.id);
    const byDebit = (a: DocJournalRow, b: DocJournalRow) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1);
    const rows = (list: any[]): DocJournalRow[] =>
      (list ?? []).map(r => ({ accountType: r?.accountType || r?.name, debit: r?.debit, credit: r?.credit })).sort(byDebit);
    const extras: DocExtraJournal[] = [
      ...(j?.extraJournals ?? []).map((e: any) => ({ heading: this.t('VAT_PAYMENT.VIEW.VAT_PAYABLE_JOURNAL'), rows: rows(e.journals) })),
      ...(j?.paymentJournals ?? []).map((e: any) => ({ heading: this.lang.instant('VAT_PAYMENT.VIEW.PAID_ON', { date: formatJournalDate(e.createdAt) }), rows: rows(e.journals) })),
    ];
    return { rows: rows(j?.defaultJournals), extras };
  }

  statusClass(status: string): string { return vatStatusClass(status); }
  statusLabel(status: string): string { return this.lang.instant('VAT_PAYMENT.STATUS.' + status); }

  canEdit(v: VatPayment): boolean { return this.actions.canEdit(v, this.isLatest()); }
  /** Paying is a form of "add" (legacy), open while something is due. */
  canPay(v: VatPayment): boolean { return this.actions.canAdd && v.amountDue > 0; }
  /** A reconciled payment is locked. */
  canEditPayment(p: any): boolean { return this.actions.canAdd && !p.reconciled; }

  actionItems(v: VatPayment): DropdownMenuBtnItem[] {
    return this.actions.menu(v, this.id, this.isLatest(), () => this.goToList());
  }

  /** Pay the amount due, or edit one payment of the history (`accounts/getVatPaymentLineById`). */
  async openPay(v: VatPayment, paymentLineId?: string): Promise<void> {
    let line: VatPaymentLine | undefined;
    let amountDue = v.amountDue;
    if (paymentLineId) {
      line = (await this.service.getVatPaymentLineById(paymentLineId)).lines[0];
      // The line's own amount is available again while it is being edited.
      amountDue = v.amountDue + (line?.amount ?? 0);
    }
    const saved = await this.modal.open<PayVatPaymentModalComponent, PayVatPaymentData, boolean>(PayVatPaymentModalComponent, {
      size: 'md',
      data: { vatPayment: v, line, amountDue },
    }).afterClosed();
    if (saved) {
      await this.load();
      void this.loadRail(this.railPage());
    }
  }
}
