import { railKind } from '@shared/utils/status-tone';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ParamDef, QueryParamsService } from '@shared/services/query-params.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';

import { Bill, BillLine } from '../../../models/bill.model';
import { DocRailItem, DocViewConfig, DocViewService, DocumentViewBase } from '../../../services/document-view-base';
import { buildExtraJournals } from '../../../services/doc-journal-extras';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailFilterOption } from '../../../components/doc-rail-filter/doc-rail-filter.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import { DocAdditionalDetailsConfig, DocBillOfEntryRow, DocJournalResult, DocPaymentRow } from '../../../components/doc-additional-details/doc-additional-details.types';
import { SupplierCreditsService } from '../../../supplier-credits/services/supplier-credits.service';
import { DocJournalRow } from '../../../components/doc-journal-tab/doc-journal-tab.component';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { ApplyCreditToBillData, ApplyCreditToBillModalComponent } from '../../components/apply-credit-to-bill-modal/apply-credit-to-bill-modal.component';
import { BillsService } from '../../services/bills.service';
import { BillActions } from '../../services/bill-actions';
import { BillPaymentActions } from '../../../bills-payment/services/bill-payment-actions';
import { BillsPaymentService } from '../../../bills-payment/services/bills-payment.service';
import { billToRenderData } from '../../services/bill-render-data';
import { PartyPeekChipsComponent } from '../../../components/party-peek-chips/party-peek-chips.component';

/** `rstatus` — the rail's status filter, persisted like `rpage`/`rq` are in {@link DocumentViewBase}. */
const RAIL_STATUS_PARAM: ParamDef<string | null> = {
  key: 'rstatus',
  codec: { encode: v => v || null, decode: r => r || null },
};


/**
 * Bills -> view (`/account/bills/view/:id`). Legacy `BillViewComponent`: the bill rendered through the
 * default bill template, print / PDF / share / export, edit, pay, the shared Actions menu, the "credits
 * available" banner, attachments, and the Additional Details (journal, payments, logs). Button rules come
 * from the shared {@link BillActions}.
 */
@Component({
  selector: 'app-bill-view',
  standalone: true,
  imports: [PartyPeekChipsComponent, CommonModule, TranslateModule, MycurrencyPipe, DocViewShellComponent, DocAdditionalDetailsComponent, DocViewAttachmentsComponent],
  providers: [MycurrencyPipe],
  templateUrl: './bill-view.component.html',
  styles: [':host { display: contents; }'],
})
export class BillViewComponent extends DocumentViewBase {
  private bills = inject(BillsService);
  private suppliers = inject(SuppliersService);
  private currency = inject(MycurrencyPipe);
  private queryParams = inject(QueryParamsService);
  readonly actions = inject(BillActions);
  private paymentActions = inject(BillPaymentActions);
  private paymentsSvc = inject(BillsPaymentService);
  private supplierCreditsSvc = inject(SupplierCreditsService);

  readonly cfg: DocViewConfig = {
    features: ['account/bills'],
    routeBase: '/account/bills',
    templateType: 'bill',
    zoomKey: 'billZoomLevel',
    numberField: 'billingNumber',
    whatsappType: 'bills',
    filePrefix: 'bill',
    titleKey: 'BILLS.FORM.BILL',
    dashboardCrumbKey: 'BILLS.DASHBOARD',
    listCrumbKey: 'BILLS.LIST.BILLS_LIST',
    viewCrumbKey: 'BILLS.VIEW.VIEW_BILL',
  };

  protected svc: DocViewService = {
    get: id => this.load1(id),
    pdf: id => this.bills.viewBillPdf(id),
    sendEmail: (payload, id) => this.bills.sendBillEmail({ ...payload, billId: id }),
  };

  /** Credit the supplier still has available (drives the "Apply now" banner). */
  supplierCredit = signal<number>(0);

  /** The bill plus its supplier's phone / address, which the document paper prints but the bill record doesn't carry. */
  private async load1(id: string): Promise<Bill> {
    const bill = await this.bills.getBill(id);
    if (bill.id && bill.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(bill.supplierId);
        bill.supplierPhone = s.phone;
        bill.supplierAddress = s.address;
        bill.supplierEmail = bill.supplierEmail || s.email;
      } catch { /* the paper simply leaves the supplier contact lines empty */ }
    }
    return bill;
  }

  protected toRenderData(b: Bill): DocumentRenderData { return billToRenderData(b); }
  protected override recipient(b: Bill) { return { emails: b.supplierEmail ? [b.supplierEmail] : [], phone: b.supplierPhone }; }

  protected override exportRows(b: Bill): Record<string, any>[] {
    return (b.lines as BillLine[]).map(l => ({
      ProductName: l.selectedItem?.name || l.note || '',
      Barcode: l.barcode || l.selectedItem?.barcode || '',
      Quantity: l.qty || 0,
      UnitCost: l.unitCost || 0,
      SIC: l.SIC || '',
    }));
  }

  railStatus = signal<string | null>(null);
  /** The statuses the backend stores (`Overdue` is derived, not a filterable status). Re-fetches page 1 on change. */
  readonly railStatusOptions = ['Draft', 'Open', 'Partially Paid', 'Paid', 'Closed'];
  railFilterOptions(): DocRailFilterOption[] {
    return [
      { value: null, label: this.t('BILLS.LIST.ALL_BILLS') },
      ...this.railStatusOptions.map(s => ({ value: s, label: this.t('BILLS.STATUS.' + s) })),
    ];
  }
  onRailFilterPick(status: string | null): void {
    this.railStatus.set(status);
    this.queryParams.writeOne(RAIL_STATUS_PARAM, status);
    void this.loadRail(1);
  }

  protected override async onInit(): Promise<void> {
    await this.actions.refresh();
    this.railStatus.set(this.queryParams.read({ status: RAIL_STATUS_PARAM }).status);
    this.initRail(
      (term, page) => this.bills.getBillingList({ page, limit: this.railPageSize, searchTerm: term, sortBy: {}, filter: { status: this.railStatus() ? [this.railStatus()] : [] } })
        .then(d => ({ list: d?.list ?? [], pageCount: d?.pageCount ?? 1 })),
      (r: any) => this.mapRailItem(r),
    );
  }

  private mapRailItem(r: any): DocRailItem {
    return {
      id: r.id,
      primary: r.supplierName,
      amountLabel: this.currency.transform(r.total),
      sub: `${r.billingNumber} · ${new Date(r.billingDate).toLocaleDateString()}`,
      statusText: r.status ? this.t('BILLS.STATUS.' + r.status) : undefined,
      statusKind: railKind(r.status),
    };
  }

  protected override async afterLoad(b: Bill): Promise<void> {
    await this.actions.refresh(b.branchId);
    if (b.supplierId) {
      const c: any = await this.suppliers.getAvailableCredit(b.supplierId);
      this.supplierCredit.set(Number(c?.credit) || 0);
    } else {
      this.supplierCredit.set(0);
    }
  }

  actionItems(b: Bill): DropdownMenuBtnItem[] { return this.actions.menu(b, this.id, () => void this.load(), () => this.goToList()); }

  showApplyCredit(b: Bill): boolean {
    return this.supplierCredit() > 0 && b.status !== 'Paid' && b.status !== 'Draft' && b.status !== 'Closed' && b.balance > 0;
  }

  pay(): void { this.actions.goPay(this.id); }

  async applyCredit(): Promise<void> {
    const b = this.doc()!;
    const ok = await this.modal.open<ApplyCreditToBillModalComponent, ApplyCreditToBillData, boolean>(ApplyCreditToBillModalComponent, {
      size: 'lg',
      data: { billId: b.id!, billNumber: b.billingNumber, supplierId: b.supplierId, balance: b.balance },
    }).afterClosed();
    if (ok) await this.load();
  }

  // ── Additional Details (journal, payments, logs) ───────────────────
  additionalDetails(): DocAdditionalDetailsConfig {
    return {
      tabs: ['journal', 'payments', 'logs', ...(this.doc()?.allowBillOfEntry && this.doc()?.billOfEntryId ? ['billOfEntry' as const] : [])],
      billOfEntry: () => this.billOfEntryRow(),
      journalHeading: this.t('BILLS.FORM.BILL'),
      loadJournal: () => this.loadJournal(this.id),
      payments: () => this.mapPayments(this.doc()?.billingPayments ?? []),
      onPaymentClick: (p: DocPaymentRow) => void this.router.navigate(['/account/bills-payment/view', p.id]),
      onPaymentEdit: (p: DocPaymentRow) => void this.router.navigate(['/account/bills-payment', p.id]),
      onPaymentDelete: (p: DocPaymentRow) => void this.paymentActions.runDelete(p.id, () => void this.load()),
      canEditPayment: (p: DocPaymentRow) => this.paymentActions.canEdit(p),
      canDeletePayment: (p: DocPaymentRow) => this.paymentActions.canRemove(p),
      logsSourceTable: 'Billings',
      logsSourceId: this.id,
    };
  }

  private mapPayments(list: any[]): DocPaymentRow[] {
    return list.map(p => ({
      id: p.id, date: p.createdAt ?? p.paymentDate, methodName: p.paymentMethodName ?? '', status: p.status ?? 'SUCCESS',
      amount: Number(p.amount ?? p.paidAmount) || 0, referenceNumber: p.referenceNumber ?? '', attachment: p.attachment, reconciled: !!p.reconciled,
    }));
  }

  private async loadJournal(billId: string): Promise<DocJournalResult> {
    const j: any = await this.bills.getBillingJournal(billId);
    const rows: DocJournalRow[] = j?.defaultJournals ?? [];
    rows.sort((a, b) => ((a.debit ?? 0) < (b.debit ?? 0) ? 1 : -1));
    return { rows, extras: buildExtraJournals('bill', j?.extraJournals, (k, p) => this.lang.instant(k, p), id => void this.deleteAppliedCredit(id)) };
  }

  /** Takes a supplier credit that was applied to this bill back (legacy: confirm, delete, reload the page). */
  private async deleteAppliedCredit(appliedCreditId: string): Promise<void> {
    if (!(await this.confirm(this.t('COMMON.DELETE'), this.t('BILLS.VIEW.CONFIRM_DELETE_APPLIED_CREDIT'), true))) return;
    await this.run(() => this.supplierCreditsSvc.deleteSupplierAppliedCredit(appliedCreditId), () => void this.load());
  }

  /** The bill of entry created from this bill (international suppliers only). */
  private billOfEntryRow(): DocBillOfEntryRow | null {
    const b = this.doc();
    if (!b?.allowBillOfEntry || !b.billOfEntryId) return null;
    return { id: b.billOfEntryId, number: b.billingOfEnrtyNumber, date: b.billingOfEntryDate, total: Number(b.billingOfEnrtyTotal) || 0 };
  }

  /** "Label print": opens the label printing page with this bill's items and quantities. */
  override printItems(): DropdownMenuBtnItem[] {
    return [
      ...super.printItems(),
      { label: this.t('BILLS.VIEW.LABEL_PRINT'), click: () => void this.router.navigate(['/products/bulk-print'], { queryParams: { billId: this.id } }), disabled: false, danger: false },
    ];
  }
}
