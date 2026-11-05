import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { CustomerMini } from '@shared/components/customer-picker/customer-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { CreditNote, CreditNoteLine } from '../../../models/credit-note.model';
import { Invoice } from '../../../models/invoice.model';
import { DocFormConfig, DocFormService, DocumentFormBase } from '../../../services/document-form-base';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocPartySectionComponent } from '../../../components/doc-party-section/doc-party-section.component';
import { DocTotalsComponent } from '../../../components/doc-totals/doc-totals.component';
import { CreditNoteActions } from '../../services/credit-note-actions';
import { CreditNotesService } from '../../services/credit-notes.service';
import { CREDIT_NOTE_RULES } from '../../services/credit-note-validation';

/**
 * Credit notes → create page (`/account/credit-notes/:id`, `new` / `0` = create, or
 * `/:id/forInvoice/:invoiceId` from "Create Credit Note" on an invoice). Legacy `CreditNotesFormComponent`:
 * pick the customer, branch and invoice, then credit quantities of that invoice's lines (never above what
 * the invoice still allows — price, discount and tax stay as invoiced). The invoice-level discount comes back
 * as the share of the credited quantity ({@link CreditNote.calculateTotal}). Built on the shared
 * document-form base; what is specific here is where the lines come from.
 */
@Component({
  selector: 'app-credit-note-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocPartySectionComponent, SearchDropdownComponent, DatePickerComponent,
    DocLinesTableComponent, DocAttachmentsCardComponent, DocTotalsComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './credit-note-form.component.html',
})
export class CreditNoteFormComponent extends DocumentFormBase {
  private notes = inject(CreditNotesService);
  private actions = inject(CreditNoteActions);

  readonly cfg: DocFormConfig = {
    features: ['account/credit-notes'],
    routeBase: '/account/credit-notes',
    viewRoute: '/account/credit-notes/view',
    numberField: 'creditNoteNumber',
    dateField: 'creditNoteDate',
    numberModule: 'creditNote',
    numberNameKey: 'CREDIT_NOTES.FORM.CREDIT_NOTE',
    numberModeKey: 'invo_credit_note_number_mode',
    rules: CREDIT_NOTE_RULES,
    privilegeRoot: 'creditNoteSecurity',
    whatsappType: 'credit-note',
    pdfName: 'credit-note.pdf',
    titleKey: 'CREDIT_NOTES.FORM.CREDIT_NOTE',
    newCrumbKey: 'CREDIT_NOTES.FORM.NEW_CREDIT_NOTE',
    editCrumbKey: 'CREDIT_NOTES.FORM.EDIT_CREDIT_NOTE',
    listCrumbKey: 'CREDIT_NOTES.LIST.CREDIT_NOTES_LIST',
    dashboardCrumbKey: 'CREDIT_NOTES.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: ['send'],
  };

  protected svc: DocFormService = {
    get: id => this.notes.getCreditNote(id),
    getNumber: () => this.notes.getCreditNoteNumber(),
    save: d => this.notes.saveCreditNote(d),
    pdf: id => this.notes.viewCreditNotePdf(id),
    sendEmail: (payload, id) => this.notes.sendCreditNoteEmail({ ...payload, creditNoteId: id }),
  };

  /** Invoices of the chosen customer / branch that can still be credited. */
  invoices: Invoice[] = [];
  invoiceTotal = 0;
  private invoiceDate: Date | null = null;
  /** Every line as loaded — kept so a failed save can put back the ones that were filtered out of the request. */
  private allLines: Invoice['lines'] = [];

  protected newDoc(): CreditNote { return new CreditNote(); }

  protected makeLinesConfig(): DocLinesConfig {
    const locked = () => true;
    return {
      fixedLines: true,
      taxType: 'locked',
      columns: [
        { key: 'item', type: 'item', label: 'DOC_LINES.ITEM_DETAILS' },
        { key: 'qty', type: 'qty', label: 'DOC_LINES.COL_QTY', width: '150px', min: 0, max: l => (l.maxQty > 0 ? l.maxQty : null) },
        { key: 'price', type: 'money', label: 'DOC_LINES.COL_PRICE', width: '130px', field: 'price', min: 0, disabled: locked },
        { key: 'discount', type: 'discount', label: 'DOC_LINES.COL_DISCOUNT', width: '170px', disabled: locked },
        { key: 'tax', type: 'tax', label: 'DOC_LINES.COL_TAX', width: '170px', disabled: locked },
        { key: 'amount', type: 'amount', label: 'DOC_LINES.COL_AMOUNT', width: '120px' },
      ],
      itemSearch: async () => ({ list: [], hasNext: false }),
      itemsDisabled: () => true,
      canEditProduct: () => false,
      // Like legacy: a credit note always keeps at least one line.
      canRemove: line => !(line as CreditNoteLine).isDeleted && this.cn.creditLines.filter(l => !l.isDeleted).length > 1,
    };
  }

  get cn(): CreditNote { return this.doc as CreditNote; }

  // ── base hooks ─────────────────────────────────────────────────────
  /** Editing a saved credit note isn't offered anywhere (as in legacy) — only creation. */
  protected override canOpen(): boolean { return false; }

  protected override async initNew(d: Invoice): Promise<void> {
    const invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    if (invoiceId) await this.fillFromInvoice(d as CreditNote, invoiceId);
  }

  protected override async afterInit(): Promise<void> {
    await this.actions.refresh(this.cn.branchId || null);
    this.applyInvoiceDate();
    if (!this.cn.invoiceId) await this.loadInvoices();
  }

  protected override blockSave(): string | null {
    if (!this.cn.creditLines.some(l => !l.isDeleted && l.qty > 0)) return this.lang.instant('CREDIT_NOTES.FORM.NEEDS_QTY');
    return null;
  }

  /** Lines removed in the form are dropped from the request; the full list is kept to restore on a failed save. */
  protected override linesForSave(lines: Invoice['lines']): Invoice['lines'] {
    this.allLines = lines;
    return (lines as CreditNoteLine[]).filter(l => !l.isDeleted || !!l.id);
  }
  protected override restoreTrailingLine(): void {
    if (this.allLines.length) this.cn.lines = this.allLines;
  }

  // ── invoice → credit note ──────────────────────────────────────────
  /**
   * Turns the invoice into the credit note's lines (`accounts/getCreditNoteInvoice`): every invoiced line with a qty
   * becomes a credit line pointing at it (`invoiceLineId`), credited by default in full (`maxQty` = what is left).
   */
  private async fillFromInvoice(d: CreditNote, invoiceId: string): Promise<void> {
    const raw: any = await this.notes.getCreditNoteInvoiceRaw(null, invoiceId);
    if (!raw) return;
    this.prefilled = true;

    const keep = { ...raw };
    for (const k of ['attachment', 'creditNoteNumber', 'creditNoteDate']) delete keep[k];
    d.ParseJson(keep);
    d.invoiceId = raw.id;
    d.id = null;
    d.creditNoteDate = new Date();
    d.attachment = [];
    d.appliedAmount = 0;
    d.refundedAmount = 0;
    d.lines = (d.creditLines)
      .filter(l => l.qty > 0)
      .map((l, i) => {
        l.invoiceLineId = l.id ?? '';
        l.id = null;
        l.maxQty = l.qty;
        l.index = i;
        return l;
      });
    // a separate copy: removing a line from the form must not shrink what "the whole invoice" means for the charge
    d.tempLines = [...d.creditLines];
    d.tempChargeId = d.chargeId;
    d.tempChargesTaxDetails = d.chargesTaxDetails;
    d.tempChargeAmount = d.chargeAmount;
    d.calculateTotal();

    this.invoiceTotal = Number(raw.total) || 0;
    this.invoiceDate = raw.invoiceDate ? new Date(String(raw.invoiceDate).split('T')[0]) : null;
    if (d.customerId) {
      this.customerValue = { id: d.customerId, name: d.customerName, displayName: d.customerName, phone: '', email: '' };
      this.addresses = this.parseAddresses(await this.customersService.customerAddresses(d.customerId));
    }
  }

  /** The credit note can't predate the invoice it credits. */
  private applyInvoiceDate(): void {
    const min = this.invoiceDate;
    if (!min) return;
    const lock = this.lockDate();
    this.minDate = lock && lock > min ? lock : min;
    if (new Date(this.cn.creditNoteDate) < this.minDate) this.cn.creditNoteDate = new Date();
  }

  async loadInvoices(): Promise<void> {
    const d = this.cn;
    this.invoices = d.customerId && d.branchId ? await this.notes.getInvoicesForCreditNote(d.branchId, d.customerId) : [];
    this.cdr.markForCheck();
  }

  override async onCustomer(c: CustomerMini | undefined): Promise<void> {
    await super.onCustomer(c);
    this.cn.invoiceId = '';
    this.cn.lines = [];
    await this.loadInvoices();
  }

  override async onBranch(b: any): Promise<void> {
    await super.onBranch(b);
    this.cn.invoiceId = '';
    this.cn.lines = [];
    await this.loadInvoices();
  }

  async onInvoice(inv: Invoice | null): Promise<void> {
    const d = this.cn;
    if (!inv?.id) { d.invoiceId = ''; d.lines = []; d.calculateTotal(); this.markDirty(); return; }
    const customerId = d.customerId, branchId = d.branchId;
    await this.fillFromInvoice(d, inv.id);
    d.customerId = customerId ?? d.customerId;
    d.branchId = branchId || d.branchId;
    this.applyInvoiceDate();
    this.markDirty();
    this.cdr.markForCheck();
  }

  invoiceOf = () => this.invoices.find(i => i.id == this.cn.invoiceId) ?? null;
  invoiceLabel = (i: Invoice) => i?.invoiceNumber ?? '';
  /** Picked from the invoice (or opened for one): customer / branch / invoice are fixed. */
  get fromInvoiceRoute(): boolean { return !!this.route.snapshot.paramMap.get('invoiceId'); }

  get exceedsInvoice(): boolean { return this.invoiceTotal > 0 && this.cn.total > this.invoiceTotal; }

  onCreditNoteDate(v: any): void {
    if (!(v instanceof Date)) return;
    this.cn.creditNoteDate = v;
    this.markDirty();
  }
}
