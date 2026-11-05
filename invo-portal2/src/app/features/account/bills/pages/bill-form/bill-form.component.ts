import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';
import { CustomFieldsService } from '../../../../settings/services/custom-fields.service';

import { Invoice } from '../../../models/invoice.model';
import { Bill, BillLine } from '../../../models/bill.model';
import { DocFormConfig, DocFormService, DocumentFormBase, addDays, ymd } from '../../../services/document-form-base';
import { DocumentLineEditor } from '../../../services/document-line-editor';
import { toPurchaseProduct } from '../../../services/purchase-line-editor';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent, SupplierMini } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { SupplierQuickCreateModalComponent } from '../../../suppliers/components/supplier-quick-create-modal/supplier-quick-create-modal.component';
import { PurchaseOrdersService } from '../../../purchase-orders/services/purchase-orders.service';
import { PurchaseImportLinesModalComponent, PurchaseImportResult } from '../../../purchase-orders/components/purchase-import-lines-modal/purchase-import-lines-modal.component';
import { BillTotalsComponent } from '../../components/bill-totals/bill-totals.component';
import { BillSplitModalComponent } from '../../components/bill-split-modal/bill-split-modal.component';
import { BillActions } from '../../services/bill-actions';
import { BillLineEditor } from '../../services/bill-line-editor';
import { BillsService } from '../../services/bills.service';
import { BILL_RULES } from '../../services/bill-validation';

const TERM_DAYS: Record<string, number> = { net7: 7, net10: 10, net15: 15, net30: 30, net45: 45, net60: 60, net90: 90 };
const TERMS = ['net7', 'net10', 'net15', 'net30', 'net45', 'net60', 'net90', 'endOfTheMonth', 'onReceiptDue', 'custom'];

/** Legacy `mapCustomFieldValuesBySlug`: carries a purchase order's custom values over to the bill by field slug. */
const slugOf = (f: any) => String(f?.abbr || f?.name || '').trim().replace(/[\s-]+/g, '_').toLowerCase();
function mapCustomFieldValues(values: Record<string, any> | null | undefined, from: any[], to: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  if (!values) return out;
  const bySlug = new Map(from.filter(f => f?.id).map(f => [slugOf(f), f]));
  for (const f of to) {
    const src = f?.id ? bySlug.get(slugOf(f)) : null;
    const v = src ? values[src.id] : undefined;
    if (v !== undefined && v !== null) out[f.id] = v;
  }
  return out;
}

/**
 * Bills -> create / edit / clone page (`/account/bills/:id`, `0` / `new` = new) and the purchase order ->
 * bill conversion (`/account/bills/convert-from-purchase/:purchaseId`, optionally `?usePartialQty=true` to
 * bill only what is left). Built on the shared document-form base (legacy `BillFormComponent`): supplier,
 * branch, number, dates and payment term, payable account, tax type, lines with a discount, serial / batch
 * entry for stocked products, a bill discount taken before or after tax, and attachments.
 */
@Component({
  selector: 'app-bill-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocSupplierSectionComponent, SearchDropdownComponent, DatePickerComponent, SegmentedToggleComponent, BillTotalsComponent,
    DocLinesTableComponent, DocAttachmentsCardComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './bill-form.component.html',
})
export class BillFormComponent extends DocumentFormBase {
  protected bills = inject(BillsService);
  private orders = inject(PurchaseOrdersService);
  private suppliers = inject(SuppliersService);
  private customFieldsSvc = inject(CustomFieldsService);
  protected actions = inject(BillActions);

  readonly cfg: DocFormConfig = {
    features: ['account/bills', 'account/purchase-orders'],
    routeBase: '/account/bills',
    viewRoute: '/account/bills/view',
    numberField: 'billingNumber',
    dateField: 'billingDate',
    numberModule: 'bill',
    numberNameKey: 'BILLS.FORM.BILL',
    numberModeKey: 'invo_bill_number_mode',
    rules: BILL_RULES,
    privilegeRoot: 'billingSecurity',
    whatsappType: 'bills',
    pdfName: 'bill.pdf',
    titleKey: 'BILLS.FORM.BILL',
    newCrumbKey: 'BILLS.FORM.NEW_BILL',
    editCrumbKey: 'BILLS.FORM.EDIT_BILL',
    listCrumbKey: 'BILLS.LIST.BILLS_LIST',
    dashboardCrumbKey: 'BILLS.DASHBOARD',
    hasStatus: true,
    primaryKind: 'list',
    menuKinds: ['send'],
  };

  /** Set when the bill is made from a purchase order. */
  purchaseId = '';
  usePartialQty = false;
  private originalPoLines: { id: string | null; productId: string; qty: number }[] = [];

  protected svc: DocFormService = {
    get: id => this.bills.getBill(id),
    getNumber: () => this.bills.getBillingNumber(),
    save: d => (this.purchaseId ? this.bills.convertToBill(this.purchaseId, d as Bill) : this.bills.saveBilling(d as Bill)),
    pdf: id => this.bills.viewBillPdf(id),
    sendEmail: (payload, id) => this.bills.sendBillEmail({ ...payload, billId: id }),
  };

  supplierValue: SupplierMini | null = null;
  payableAccounts: any[] = [];
  readonly taxTypes: SegmentedToggleOption[] = [
    { value: 'exclusive', label: 'DOC_FORM.EXCLUSIVE_TAX' },
    { value: 'inclusive', label: 'DOC_FORM.INCLUSIVE_TAX' },
  ];
  readonly qtyModes: SegmentedToggleOption[] = [
    { value: 'full', label: 'BILLS.FORM.FULL_QTY' },
    { value: 'remaining', label: 'BILLS.FORM.REMAINING_QTY' },
  ];
  terms = TERMS.map(t => ({ value: t, label: 'BILLS.TERMS.' + t }));

  get bill(): Bill { return this.doc as Bill; }
  private get be(): BillLineEditor { return this.editor as BillLineEditor; }
  get isConversion(): boolean { return !!this.purchaseId; }

  protected newDoc(): Invoice { return new Bill(); }
  protected override loadAccounts(): Promise<any[]> { return this.lookups.getPurchaseAccounts(); }
  protected override makeEditor(d: Invoice, taxes: any[], accounts: any[]): DocumentLineEditor { return new BillLineEditor(d, taxes, accounts); }

  protected makeLinesConfig(): DocLinesConfig {
    const bill = () => this.bill;
    const scope = () => bill().branchId;
    const split = (l: any) => (l as BillLine).batches.length > 0 || (l as BillLine).serials.length > 0;
    return {
      columns: [
        { key: 'item', type: 'item', label: 'DOC_LINES.ITEM_DETAILS' },
        { key: 'sic', type: 'text', label: 'PURCHASE_ORDERS.FORM.SIC', width: '130px', field: 'SIC' },
        { key: 'qty', type: 'qty', label: 'DOC_LINES.COL_QTY', width: '150px', min: 0, freeQty: true, disabled: split },
        {
          key: 'unitCost', type: 'money', label: 'PURCHASE_ORDERS.FORM.UNIT_COST', width: '140px', field: 'unitCost', required: true, min: 0, disabled: split,
          hint: line => {
            const t = (line as BillLine).typeOfCost;
            return t === 'supplierCost' ? 'PURCHASE_ORDERS.FORM.SUPPLIER_COST' : t === 'productCost' ? 'PURCHASE_ORDERS.FORM.PRODUCT_COST' : null;
          },
        },
        { key: 'discount', type: 'discount', label: 'DOC_LINES.COL_DISCOUNT', width: '170px' },
        { key: 'tax', type: 'tax', label: 'DOC_LINES.COL_TAX', width: '170px', visible: () => !bill().allowBillOfEntry },
        { key: 'amount', type: 'amount', label: 'DOC_LINES.COL_AMOUNT', width: '120px' },
      ],
      accounts: true,
      bulkItems: true,
      itemsDisabled: () => !scope() || !bill().supplierId,
      itemSearch: async (term, filter) => {
        const page = filter?.page ?? 1;
        const d = await this.orders.getPurchaseProducts({ page, limit: 20, searchTerm: term, sortBy: {}, branchId: scope(), supplierId: bill().supplierId });
        return { list: (d.list ?? []).map(toPurchaseProduct), hasNext: page < (d.pageCount ?? 1) };
      },
      barcodeLookup: async term => {
        const res: any = await this.orders.getPurchaseProductByBarcode({ searchTerm: term, branchId: scope(), supplierId: bill().supplierId });
        return res?.data ? toPurchaseProduct(res.data) : null;
      },
      customImport: () => this.importLines(),
      splitEditor: line => this.editSplit(line as BillLine),
      splitSummary: line => {
        const l = line as BillLine;
        if (l.serials.length) return this.lang.instant('BILLS.SPLIT.N_SERIALS', { count: l.serials.filter(s => !s.isDeleted).length });
        if (l.batches.length) return this.lang.instant('BILLS.SPLIT.N_BATCHES', { count: l.batches.filter(b => !b.isDeleted).length });
        return '';
      },
      canRemove: () => this.bill.lines.filter(l => !(l as BillLine).isDeleted).length > 1,
    };
  }

  // ── lifecycle ──────────────────────────────────────────────────────
  protected override async initNew(d: Invoice): Promise<void> {
    const bill = d as Bill;
    const supplierId = this.route.snapshot.queryParams['supplierId'];
    if (supplierId) bill.supplierId = supplierId;

    const purchaseId = this.route.snapshot.paramMap.get('purchaseId');
    if (purchaseId) {
      this.purchaseId = purchaseId;
      this.usePartialQty = ['true', '1'].includes(String(this.route.snapshot.queryParams['usePartialQty']));
      this.prefilled = true;
      await this.convertFromPurchase(bill, purchaseId);
    }
  }

  protected override prepareLoaded(d: Invoice, cloned: boolean): void {
    if (cloned) {
      const b = d as Bill;
      b.purchaseOrderId = null;
      b.purchaseNumber = '';
      b.billOfEntryId = null;
      b.paidAmount = 0;
      b.appliedCredit = 0;
      b.balance = 0;
      b.status = '';
      b.billingPayments = [];
      b.dueDate = ymd(addDays(new Date(), 30));
    }
  }

  protected override async afterInit(isNew: boolean): Promise<void> {
    const ed = this.be;
    ed.deleteMode = true;
    ed.onDuplicate = () => this.toast.warning(this.lang.instant('PURCHASE_ORDERS.FORM.ALREADY_ADDED'), '');
    this.payableAccounts = (await this.bills.getPayableAccounts()) ?? [];

    const b = this.bill;
    if (b.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(b.supplierId);
        this.supplierValue = { id: s.id, name: s.name, phone: s.phone, email: s.email, country: s.country, costCenter: s.costCenter, allowBillOfEntry: s.allowBillOfEntry, paymentTerm: s.paymentTerm };
        b.supplierName = s.name;
        b.supplierEmail = b.supplierEmail || s.email;
        b.allowBillOfEntry = !!s.allowBillOfEntry;
        ed.costCenter = s.costCenter || null;
        if (isNew && !this.isConversion && !b.id) { b.paymentTerm = s.paymentTerm ?? 'net7'; this.applyTerm(); }
      } catch {
        this.supplierValue = { id: b.supplierId, name: b.supplierName };
      }
      ed.international = b.allowBillOfEntry;
      if (b.allowBillOfEntry) b.lines.forEach(l => (l as BillLine).clearTax());
      if (isNew && !this.isConversion) b.lines.forEach(l => { if (!l.productId) l.accountId = ed.costCenter || l.accountId; });
    }
    if (this.isConversion) { b.lines.forEach((l, i) => (l.index = i)); if (!ed.lastLineIsEmpty) ed.addLine(); }
    b.calculateTotal();
  }

  // ── purchase order -> bill ─────────────────────────────────────────
  private async convertFromPurchase(bill: Bill, purchaseId: string): Promise<void> {
    const [raw, poFields, billFields] = await Promise.all([
      this.orders.getPurchaseOrderRaw(purchaseId),
      this.customFieldsSvc.getByType('purchaseOrder'),
      this.customFieldsSvc.getByType('bill'),
    ]);
    const po: any = raw ?? {};
    const lines: any[] = po.lines ?? [];
    this.originalPoLines = lines.map(l => ({ id: l.id, productId: l.productId, qty: l.qty }));

    const { lines: _l, id: _id, customFields, status: _s, total: _t, dueDate: _d, billingDate: _bd, ...header } = po;
    bill.ParseJson(header);
    bill.id = null;
    bill.status = '';
    bill.purchaseOrderId = purchaseId;
    bill.purchaseNumber = po.purchaseNumber ?? '';
    bill.customFields = mapCustomFieldValues(customFields, poFields ?? [], billFields ?? []);
    bill.billingNumber = await this.bills.getBillingNumber();
    const due = new Date();
    due.setDate(due.getDate() + 1);
    bill.dueDate = ymd(due);

    bill.lines = lines
      .filter(l => (this.usePartialQty ? Number(l.remainingQty) > 0 : Number(l.qty) > 0))
      .map(l => {
        const line = new BillLine();
        line.ParseJson({ ...l, id: null, purchaseOrderId: undefined });
        line.remainingQty = Number(l.remainingQty) || 0;
        (line as any).poLineId = l.id;
        if (this.usePartialQty) { line.qty = line.remainingQty; line.tempQty = line.qty; }
        line.isNew = true;
        return line;
      });
  }

  /** "Full quantity / Remaining quantity" switch of a converted bill (legacy `switchQtyMode`). */
  get qtyMode(): string { return this.usePartialQty ? 'remaining' : 'full'; }
  onQtyMode(v: string): void {
    const partial = v === 'remaining';
    if (partial === this.usePartialQty) return;
    this.usePartialQty = partial;
    for (const l of this.bill.lines as BillLine[]) {
      const original = this.originalPoLines.find(o => o.productId === l.productId && l.productId) ?? null;
      if (partial) { l.isDeleted = l.remainingQty <= 0; if (!l.isDeleted) l.qty = l.remainingQty; }
      else if (original) { l.qty = original.qty; l.isDeleted = original.qty <= 0; }
      l.tempQty = l.qty;
    }
    this.bill.calculateTotal();
    this.markDirty();
  }

  protected override afterSaveRoute(): void {
    if (this.isConversion) void this.router.navigate(['/account/purchase-order'], { queryParams: this.listParams });
    else super.afterSaveRoute();
  }

  override saveMenu(): DropdownMenuBtnItem[] { return this.isConversion ? [] : super.saveMenu(); }

  // ── supplier ───────────────────────────────────────────────────────
  async onSupplier(s: SupplierMini | undefined): Promise<void> {
    const b = this.bill;
    const ed = this.be;
    this.supplierValue = s ?? null;
    b.supplierId = s?.id ?? '';
    b.supplierName = s?.name ?? '';
    b.supplierEmail = s?.email ?? '';
    b.allowBillOfEntry = !!s?.allowBillOfEntry;
    ed.international = b.allowBillOfEntry;
    ed.costCenter = s?.costCenter || null;
    if (s) { b.paymentTerm = s.paymentTerm ?? 'net7'; this.applyTerm(); }

    b.lines.forEach(l => {
      const line = l as BillLine;
      if (b.allowBillOfEntry) line.clearTax();
      if (b.id == null && !line.productId) line.accountId = s?.costCenter || this.accounts[0]?.id || null;
    });
    b.calculateTotal();
    this.markDirty();
  }

  async createSupplier(): Promise<void> {
    const res = await this.modal.open<SupplierQuickCreateModalComponent, void, { supplierId: string; supplierName: string } | null>(
      SupplierQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (!res?.supplierId) return;
    const s = await this.suppliers.getSupplier(res.supplierId);
    await this.onSupplier({ id: s.id, name: s.name, phone: s.phone, email: s.email, country: s.country, costCenter: s.costCenter, allowBillOfEntry: s.allowBillOfEntry, paymentTerm: s.paymentTerm });
  }

  protected override async sendRecipient(): Promise<{ emails: string[]; phone: string }> {
    const b = this.bill;
    let email = b.supplierEmail || '';
    let phone = this.supplierValue?.phone || '';
    if (b.supplierId && (!email || !phone)) {
      try {
        const s = await this.suppliers.getSupplier(b.supplierId);
        email = email || s.email;
        phone = phone || s.phone;
      } catch { /* the modal lets the user type the address */ }
    }
    return { emails: email ? [email] : [], phone };
  }

  // ── dates / payment term ───────────────────────────────────────────
  get billingDate(): Date { return this.cachedDate(this.bill.billingDate); }
  get dueDate(): Date { return this.cachedDate(this.bill.dueDate); }

  onBillingDate(v: any): void {
    if (!(v instanceof Date)) return;
    this.bill.billingDate = v;
    if (ymd(v) > String(this.bill.dueDate).slice(0, 10)) this.bill.dueDate = ymd(v);
    this.applyTerm();
    this.markDirty();
  }
  onDueDate(v: any): void {
    if (!(v instanceof Date)) return;
    this.bill.dueDate = ymd(v);
    this.bill.paymentTerm = 'custom';
    this.markDirty();
  }
  onTerm(term: string | undefined): void {
    this.bill.paymentTerm = term || 'custom';
    this.applyTerm();
    this.markDirty();
  }
  /** Due date from the payment term and the bill date (legacy `onChangeTerm`); `custom` keeps the typed date. */
  private applyTerm(): void {
    const b = this.bill;
    const from = new Date(b.billingDate);
    const term = b.paymentTerm;
    if (term in TERM_DAYS) b.dueDate = ymd(addDays(from, term === 'net7' ? 7 : TERM_DAYS[term]));
    else if (term === 'endOfTheMonth') b.dueDate = ymd(new Date(from.getFullYear(), from.getMonth() + 1, 0));
    else if (term === 'onReceiptDue') b.dueDate = ymd(from);
  }
  termOf = () => this.terms.find(t => t.value === this.bill.paymentTerm) ?? null;
  termLabel = (t: any) => (t ? this.lang.instant(t.label) : '');
  sameValue = (a: any, b: any) => a?.value === b?.value;

  payableOf = () => this.payableAccounts.find(a => a.id === this.bill.payableAccountId) ?? null;
  accountLabel = (a: any) => a?.name ?? '';
  onPayable(a: any): void { this.bill.payableAccountId = a?.id ?? ''; this.markDirty(); }

  // ── tax type / discount ────────────────────────────────────────────
  get taxType(): string { return this.bill.isInclusiveTax ? 'inclusive' : 'exclusive'; }
  onTaxType(v: string): void { this.bill.isInclusiveTax = v === 'inclusive'; this.bill.calculateTotal(); this.markDirty(); }

  /** "Actions" dropdown of a saved bill - items and behaviour come from the shared {@link BillActions}. */
  actionsMenu(): DropdownMenuBtnItem[] {
    const d = this.bill;
    if (this.formStatus !== 'edit' || !d?.id) return [];
    const done = () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); };
    return this.actions.menu(d, d.id, done);
  }

  // ── serial / batch entry ───────────────────────────────────────────
  async editSplit(line: BillLine): Promise<void> {
    const res = await this.modal.open<BillSplitModalComponent, { line: BillLine }, { batches: BillLine[]; serials: BillLine[] } | null>(
      BillSplitModalComponent, { size: 'lg', data: { line } },
    ).afterClosed();
    if (!res) return;
    line.batches = res.batches;
    line.serials = res.serials;
    line.syncFromSplit();
    this.bill.calculateTotal();
    this.markDirty();
  }

  // ── import (CSV / XLSX) ────────────────────────────────────────────
  async importLines(): Promise<void> {
    const res = await this.modal.open<PurchaseImportLinesModalComponent, void, PurchaseImportResult | null>(PurchaseImportLinesModalComponent, { size: 'md' }).afterClosed();
    if (!res?.lines.length) return;

    const bill = this.bill;
    const ed = this.be;
    const last = bill.lines[bill.lines.length - 1];
    if (last && !last.productId && !last.note) bill.lines.pop();

    let rows = res.lines;
    if (res.skipDuplicate) {
      const live = (bill.lines as BillLine[]).filter(l => !l.isDeleted);
      const codes = new Set(live.map(l => String(l.barcode || l.selectedItem?.barcode || '').trim()).filter(Boolean));
      const notes = new Set(live.map(l => String(l.note ?? '').trim()).filter(Boolean));
      rows = rows.filter(r => (r.barcode ? !codes.has(r.barcode) : !notes.has(r.productName)));
    }
    if (!rows.length) {
      this.toast.error('COMMON.OPS', this.lang.instant(res.skipDuplicate ? 'PURCHASE_ORDERS.IMPORT.ALL_EXIST' : 'PURCHASE_ORDERS.IMPORT.NOTHING'));
      if (!ed.lastLineIsEmpty) ed.addLine();
      return;
    }

    const barcodes = [...new Set(rows.map(r => r.barcode).filter(Boolean))];
    const found = barcodes.length ? ((await this.lookups.searchByBarcodes(barcodes, 'bill')) ?? []) : [];
    const byCode = new Map<string, any>(found.filter(p => p?.barcode).map(p => [String(p.barcode).trim(), p]));

    const missing: string[] = [];
    for (const r of rows) {
      const product = r.barcode ? byCode.get(r.barcode) ?? null : null;
      if (r.barcode && !product) missing.push(r.barcode);
      bill.lines.push(ed.buildPurchaseImportLine(r, product));
    }
    bill.lines.forEach((l, i) => (l.index = i));
    if (!ed.lastLineIsEmpty) ed.addLine();
    bill.calculateTotal();
    this.markDirty();

    if (missing.length) this.toast.warning(this.lang.instant('PURCHASE_ORDERS.IMPORT.NOT_FOUND', { count: missing.length }), missing.slice(0, 10).join(', ') + (missing.length > 10 ? '…' : ''));
    else this.toast.success(this.lang.instant('PURCHASE_ORDERS.IMPORT.DONE', { count: rows.length }));
  }
}
