import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { Invoice, SelectedItem } from '../../../models/invoice.model';
import { BillOfEntry, BillOfEntryLine } from '../../../models/bill-of-entry.model';
import { DocFormConfig, DocFormService, DocumentFormBase } from '../../../services/document-form-base';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { BillsService } from '../../../bills/services/bills.service';
import { BulkDutyModalComponent } from '../../components/bulk-duty-modal/bulk-duty-modal.component';
import { BillOfEntryActions } from '../../services/bill-of-entry-actions';
import { BillOfEntryService } from '../../services/bill-of-entry.service';
import { BILL_OF_ENTRY_RULES } from '../../services/bill-of-entry-validation';

/**
 * Bill of entry -> create (`/account/bill-of-entry/0/:billId`, from the imported bill) and edit
 * (`/account/bill-of-entry/:id`). Built on the shared document-form base (legacy `BillOfEntryFormComponent`):
 * the bill's lines come over read-only with their assessable value; what the user enters is the customs duty of
 * each line (one by one, or ticked and applied in bulk) and the tax. Only duty + tax are booked, paid through a
 * payment method.
 */
@Component({
  selector: 'app-bill-of-entry-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, MycurrencyPipe,
    DocFormShellComponent, DocSupplierSectionComponent, DocLinesTableComponent, SearchDropdownComponent, DatePickerComponent,
    DocAttachmentsCardComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './bill-of-entry-form.component.html',
  styleUrl: './bill-of-entry-form.component.scss',
})
export class BillOfEntryFormComponent extends DocumentFormBase {
  private entries = inject(BillOfEntryService);
  private bills = inject(BillsService);
  private suppliers = inject(SuppliersService);
  protected actions = inject(BillOfEntryActions);

  readonly cfg: DocFormConfig = {
    features: ['account/bill-of-entry'],
    routeBase: '/account/bill-of-entry',
    viewRoute: '/account/bill-of-entry/view',
    numberField: 'billingOfEnrtyNumber',
    dateField: 'billingOfEntryDate',
    numberModule: 'billOfEntry',
    numberNameKey: 'BILL_OF_ENTRY.FORM.BILL_OF_ENTRY',
    numberModeKey: 'invo_bill_of_entry_number_mode',
    rules: BILL_OF_ENTRY_RULES,
    privilegeRoot: 'billOfEntrySecurity',
    whatsappType: 'BillOfEntry',
    pdfName: 'bill-of-entry.pdf',
    titleKey: 'BILL_OF_ENTRY.FORM.BILL_OF_ENTRY',
    newCrumbKey: 'BILL_OF_ENTRY.FORM.NEW_BILL_OF_ENTRY',
    editCrumbKey: 'BILL_OF_ENTRY.FORM.EDIT_BILL_OF_ENTRY',
    listCrumbKey: 'BILL_OF_ENTRY.LIST.BILL_OF_ENTRY_LIST',
    dashboardCrumbKey: 'BILL_OF_ENTRY.DASHBOARD',
    hasStatus: true,
    primaryKind: 'list',
    menuKinds: [],
  };

  protected svc: DocFormService = {
    get: id => this.entries.getBillOfEntry(id),
    getNumber: () => this.entries.getBillingOfEntryNumber(),
    save: d => this.entries.saveBillOfEntry(d as BillOfEntry),
    pdf: id => this.entries.viewBillOfEntryPdf(id),
    sendEmail: (payload, id) => this.entries.sendBillOfEntryEmail({ ...payload, billOfEntryId: id }),
  };

  supplierValue: { id: string; name: string } | null = null;
  paymentMethods: any[] = [];

  get boe(): BillOfEntry { return this.doc as BillOfEntry; }
  get entryLines(): BillOfEntryLine[] { return (this.boe.lines as BillOfEntryLine[]).filter(l => !l.isDeleted); }

  protected newDoc(): Invoice { return new BillOfEntry(); }
  protected override loadAccounts(): Promise<any[]> { return this.lookups.getPurchaseAccounts(); }
  /** The shared lines table, fixed to the bill's lines: only the duty, the tax and the note are edited. */
  protected makeLinesConfig(): DocLinesConfig {
    const rate = (l: any) => (l.qty ? l.assessableValue / l.qty : 0);
    return {
      fixedLines: true,
      columns: [
        { key: 'item', type: 'item', label: 'BILL_OF_ENTRY.FORM.PRODUCT' },
        {
          key: 'assessable', type: 'money', label: 'BILL_OF_ENTRY.FORM.ASSESSABLE_VALUE', width: '170px', field: 'assessableValue', disabled: () => true,
          hint: l => `${l.qty} ${(l as BillOfEntryLine).UOM ?? ''} × ${Math.round(rate(l) * 1000) / 1000}`,
        },
        { key: 'duty', type: 'money', label: 'BILL_OF_ENTRY.FORM.CUSTOM_DUTY', width: '150px', field: 'customDuty', min: 0 },
        { key: 'taxable', type: 'amount', label: 'BILL_OF_ENTRY.FORM.TAXABLE_AMOUNT', width: '150px' },
        { key: 'tax', type: 'tax', label: 'BILL_OF_ENTRY.FORM.TAX', width: '190px' },
      ],
      bulkActions: [{ label: 'BILL_OF_ENTRY.FORM.BULK_DUTY', run: lines => this.bulkDuty(lines as BillOfEntryLine[]) }],
      itemSearch: async () => ({ list: [], hasNext: false }),
      canEditProduct: () => false,
      canRemove: () => this.entryLines.length > 1,
    };
  }
  protected override linesAreValid(): boolean { return this.entryLines.some(l => !!l.productId || !!l.note); }
  protected override restoreTrailingLine(): void { /* the lines come from the bill: nothing to add */ }
  override get branchLocked(): boolean { return true; }

  // ── lifecycle ──────────────────────────────────────────────────────
  /** From the imported bill: its lines become the bill of entry's (to be assessed). */
  protected override async initNew(d: Invoice): Promise<void> {
    const billId = this.route.snapshot.paramMap.get('billId');
    if (!billId) return;
    this.prefilled = true;
    const b = d as BillOfEntry;
    const raw: any = await this.bills.getBillRaw(billId);
    if (!raw) return;
    b.ParseJson(raw);
    b.id = null;
    b.status = '';
    b.attachment = [];
    b.currentBillingStatus = raw.status ?? '';
    b.billingId = billId;
    b.billingNumber = raw.billingNumber ?? b.billingNumber;
    b.billingOfEntryDate = new Date();
    b.lines.forEach(l => {
      const line = l as BillOfEntryLine;
      line.billingLineId = l.id;
      line.billingId = billId;
      line.billOfEntryId = billId;
      line.id = null;
      line.customDuty = 0;
      line.isNew = true;
    });
  }

  protected override async afterInit(isNew: boolean): Promise<void> {
    const b = this.boe;
    this.editor!.deleteMode = true;
    // The table's item cell reads the picked product; a line carried over from the bill may only have its name.
    this.entryLines.forEach(l => {
      if (l.productId && !l.selectedItem?.id) {
        const it = new SelectedItem();
        it.id = l.productId;
        it.name = l.productName;
        l.selectedItem = it;
      }
    });
    if (b.supplierId) {
      this.supplierValue = { id: b.supplierId, name: b.supplierName };
      try {
        const s = await this.suppliers.getSupplier(b.supplierId);
        this.supplierValue = { id: s.id, name: s.name };
        b.supplierName = s.name;
        b.supplierCountry = s.country;
        b.supplierEmail = b.supplierEmail || s.email;
      } catch { /* the name already on the record is enough */ }
    }
    this.paymentMethods = await this.lookups.getMiniPaymentMethods(b.branchId, b.paymentMethodId || null);
    if (isNew && this.paymentMethods.length && !b.paymentMethodId) this.applyMethod(this.paymentMethods[0]);

    // New: every line starts on the default tax (duty + tax are what this document books).
    if (isNew) {
      const def = this.editor!.defaultTax;
      this.entryLines.forEach(l => { if (!l.taxId && def) { l.taxId = def.id; this.editor!.onChangeTax(l); } });
    } else {
      // A saved line's tax breakdown is refilled from the tax record, so the table sees it complete.
      this.entryLines.forEach(l => { if (l.taxId) this.editor!.onChangeTax(l); });
    }
    b.calculateTotal();
  }

  protected override async sendRecipient(): Promise<{ emails: string[]; phone: string }> {
    const b = this.boe;
    let email = b.supplierEmail || '';
    let phone = '';
    if (b.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(b.supplierId);
        email = email || s.email;
        phone = s.phone;
      } catch { /* the modal lets the user type the address */ }
    }
    return { emails: email ? [email] : [], phone };
  }

  // ── payment method ─────────────────────────────────────────────────
  methodOf = () => this.paymentMethods.find(m => m.id === this.boe.paymentMethodId) ?? null;
  methodLabel = (m: any) => m?.name ?? '';
  private applyMethod(m: any): void {
    const b = this.boe;
    b.paymentMethodId = m?.id ?? '';
    b.paymentMethodName = m?.name ?? '';
    b.paymentMethodType = m?.type ?? '';
  }
  onMethod(m: any): void { this.applyMethod(m); this.markDirty(); }

  onBillOfEntryDate(v: any): void { if (v instanceof Date) { this.boe.billingOfEntryDate = v; this.markDirty(); } }
  get entryDate(): Date { return this.cachedDate(this.boe.billingOfEntryDate); }

  // ── lines ──────────────────────────────────────────────────────────
  /** "Update Custom Duty" on the ticked lines: one amount for all of them. */
  private async bulkDuty(lines: BillOfEntryLine[]): Promise<void> {
    const duty = await this.modal.open<BulkDutyModalComponent, void, number | null>(BulkDutyModalComponent, { size: 'sm' }).afterClosed();
    if (duty == null) return;
    lines.forEach(l => (l.customDuty = Number(duty) || 0));
  }

  actionsMenu(): DropdownMenuBtnItem[] {
    const d = this.boe;
    if (this.formStatus !== 'edit' || !d?.id) return [];
    return this.actions.menu(d, d.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }
}
