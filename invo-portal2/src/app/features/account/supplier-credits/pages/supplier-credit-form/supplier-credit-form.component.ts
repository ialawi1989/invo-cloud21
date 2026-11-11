import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { Invoice } from '../../../models/invoice.model';
import { Bill } from '../../../models/bill.model';
import { SupplierCredit, SupplierCreditLine } from '../../../models/supplier-credit.model';
import { DocFormConfig, DocFormService, DocumentFormBase } from '../../../services/document-form-base';
import { DocumentLineEditor } from '../../../services/document-line-editor';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocAttachmentsCardComponent } from '../../../components/doc-attachments-card/doc-attachments-card.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent, SupplierMini } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { SupplierQuickCreateModalComponent } from '../../../suppliers/components/supplier-quick-create-modal/supplier-quick-create-modal.component';
import { CreditImportLinesData, CreditImportLinesModalComponent } from '../../components/credit-import-lines-modal/credit-import-lines-modal.component';
import { CreditReturnModalComponent } from '../../components/credit-return-modal/credit-return-modal.component';
import { SupplierCreditActions } from '../../services/supplier-credit-actions';
import { SupplierCreditLineEditor } from '../../services/supplier-credit-line-editor';
import { SupplierCreditsService } from '../../services/supplier-credits.service';
import { SUPPLIER_CREDIT_RULES } from '../../services/supplier-credit-validation';

const ALL = 'all';

/**
 * Supplier credits -> create / edit page (`/account/supplier-credit/:id`, `0` / `new` = new;
 * `/:id/forBill/:billingId` starts from one bill). Built on the shared document-form base (legacy
 * `SupplierCreditFormComponent`): pick the supplier and branch, then the bill being credited - its lines come
 * over with the most each may be credited (serials / batches are ticked to return) - or "all bills", where
 * lines are picked from the supplier's billed products. The credit takes back each line's own discount and its
 * share of the bill's discount; the totals are shown, not typed.
 */
@Component({
  selector: 'app-supplier-credit-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, MycurrencyPipe,
    DocFormShellComponent, DocSupplierSectionComponent, SearchDropdownComponent, DatePickerComponent, SegmentedToggleComponent,
    DocLinesTableComponent, DocAttachmentsCardComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './supplier-credit-form.component.html',
  styles: [`
    .sf-import { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .sf-totals { display: flex; justify-content: flex-end; margin-top: 8px; }
    .sf-sum { min-width: 320px; background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
    .sf-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: #334155; }
    .sf-row--total { border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 18px; color: #0f172a; }
  `],
})
export class SupplierCreditFormComponent extends DocumentFormBase {
  private credits = inject(SupplierCreditsService);
  private suppliers = inject(SuppliersService);
  protected actions = inject(SupplierCreditActions);

  readonly cfg: DocFormConfig = {
    features: ['account/supplier-credits', 'account/purchase-orders'],
    routeBase: '/account/supplier-credit',
    viewRoute: '/account/supplier-credit/view',
    numberField: 'supplierCreditNumber',
    dateField: 'supplierCreditDate',
    numberModule: 'supplierCredit',
    numberNameKey: 'SUPPLIER_CREDITS.FORM.SUPPLIER_CREDIT',
    numberModeKey: 'invo_supplier_credit_number_mode',
    rules: SUPPLIER_CREDIT_RULES,
    privilegeRoot: 'supplierCredit',
    whatsappType: 'supplierCreditNote',
    pdfName: 'supplier-credit.pdf',
    titleKey: 'SUPPLIER_CREDITS.FORM.SUPPLIER_CREDIT',
    newCrumbKey: 'SUPPLIER_CREDITS.FORM.NEW_SUPPLIER_CREDIT',
    editCrumbKey: 'SUPPLIER_CREDITS.FORM.EDIT_SUPPLIER_CREDIT',
    listCrumbKey: 'SUPPLIER_CREDITS.LIST.CREDITS_LIST',
    dashboardCrumbKey: 'SUPPLIER_CREDITS.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: ['send'],
  };

  protected svc: DocFormService = {
    get: id => this.credits.getSupplierCredit(id),
    getNumber: () => this.credits.getSupplierCreditNumber(),
    save: d => this.credits.saveSupplierCredit(d as SupplierCredit),
    pdf: id => this.credits.viewSupplierCreditPdf(id),
    sendEmail: (payload, id) => this.credits.sendSupplierCreditEmail({ ...payload, supplierCreditId: id }),
  };

  supplierValue: SupplierMini | null = null;
  /** The supplier's bills at the branch, plus the "all bills" choice. */
  billOptions: { id: string; label: string }[] = [];
  private billsLoadedFor = '';

  get credit(): SupplierCredit { return this.doc as SupplierCredit; }
  private get ce(): SupplierCreditLineEditor { return this.editor as SupplierCreditLineEditor; }
  /** True once a single bill is chosen: its lines are fixed, only their quantity changes. */
  get fromBill(): boolean { return !!this.credit.billingId && this.credit.billingId !== ALL; }

  protected newDoc(): Invoice { return new SupplierCredit(); }
  protected override loadAccounts(): Promise<any[]> { return this.lookups.getPurchaseAccounts(); }
  protected override makeEditor(d: Invoice, taxes: any[], accounts: any[]): DocumentLineEditor { return new SupplierCreditLineEditor(d, taxes, accounts); }

  protected makeLinesConfig(): DocLinesConfig {
    const form = this;
    const credit = () => this.credit;
    const hasSplit = (l: any) => (l as SupplierCreditLine).batches.length > 0 || (l as SupplierCreditLine).serials.length > 0;
    return {
      columns: [
        { key: 'item', type: 'item', label: 'DOC_LINES.ITEM_DETAILS' },
        {
          key: 'qty', type: 'qty', label: 'DOC_LINES.COL_QTY', width: '150px', min: 0, freeQty: true,
          max: l => (l as SupplierCreditLine).maxQty || (l as SupplierCreditLine).lineQtyLimit || null,
          disabled: hasSplit,
        },
        { key: 'unitCost', type: 'money', label: 'PURCHASE_ORDERS.FORM.UNIT_COST', width: '140px', field: 'unitCost', disabled: () => true },
        { key: 'tax', type: 'tax', label: 'DOC_LINES.COL_TAX', width: '170px', visible: () => !credit().allowBillOfEntry, disabled: () => true },
        { key: 'amount', type: 'amount', label: 'DOC_LINES.COL_AMOUNT', width: '120px' },
      ],
      get fixedLines() { return form.fromBill; },
      accounts: false,
      itemsDisabled: () => !credit().branchId || !credit().supplierId,
      itemSearch: async (term, filter) => {
        const page = filter?.page ?? 1;
        const d: any = await this.credits.getProductBillingLines({ page, limit: 20, searchTerm: term, sortBy: {}, branchId: credit().branchId, supplierId: credit().supplierId });
        const list = (d?.list ?? []).map((p: any) => ({
          ...p, name: p.billingNumber ? `${p.productName} · ${p.billingNumber}` : p.productName, type: p.productType, defaultPrice: p.unitCost,
        }));
        return { list, hasNext: page < (d?.pageCount ?? 1) };
      },
      splitEditor: line => this.editReturn(line as SupplierCreditLine),
      splitSummary: line => {
        const l = line as SupplierCreditLine;
        if (l.serials.length) return this.lang.instant('SUPPLIER_CREDITS.RETURN.N_SERIALS', { count: l.serialsReturned });
        if (l.batches.length) return this.lang.instant('SUPPLIER_CREDITS.RETURN.N_BATCHES', { count: l.batches.filter(b => b.return).length });
        return '';
      },
      canRemove: () => this.credit.lines.filter(l => !(l as SupplierCreditLine).isDeleted).length > 1,
    };
  }

  // ── lifecycle ──────────────────────────────────────────────────────
  protected override async initNew(d: Invoice): Promise<void> {
    const c = d as SupplierCredit;
    const supplierId = this.route.snapshot.queryParams['supplierId'];
    if (supplierId) c.supplierId = supplierId;
    const billingId = this.route.snapshot.paramMap.get('billingId');
    if (billingId) {
      this.prefilled = true;
      c.billingId = billingId;
      await this.applyBill(c, billingId);
      return;
    }
    c.billingId = '';
  }

  protected override prepareLoaded(d: Invoice): void {
    (d as SupplierCredit).lines.forEach(l => (l as SupplierCreditLine).serials.forEach(s => (s.id = null)));
  }

  protected override async afterInit(isNew: boolean): Promise<void> {
    const ed = this.ce;
    ed.deleteMode = true;
    ed.onDuplicate = () => this.toast.warning(this.lang.instant('SUPPLIER_CREDITS.FORM.ALREADY_ADDED'), '');

    const c = this.credit;
    if (!isNew && c.billingId && c.billingId !== ALL) {
      try {
        const b = new Bill();
        b.ParseJson(await this.credits.getBillForCreditRaw(c.billingId, c.id));
        b.calculateTotal();
        this.billTotal = b.total;
      } catch { /* no warning without the bill's total */ }
    }
    if (c.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(c.supplierId);
        this.supplierValue = { id: s.id, name: s.name, phone: s.phone, email: s.email, allowBillOfEntry: s.allowBillOfEntry, costCenter: s.costCenter };
        c.supplierName = s.name;
        c.supplierEmail = c.supplierEmail || s.email;
        c.allowBillOfEntry = !!s.allowBillOfEntry;
      } catch {
        this.supplierValue = { id: c.supplierId, name: c.supplierName };
      }
      ed.international = c.allowBillOfEntry;
      await this.loadBills();
    }
    c.calculateTotal();
    if (isNew && this.fromBill && !c.branchId && this.branches.length) c.branchId = this.branches[0].id;
  }

  /** Grand total of the bill being credited - a credit worth more than it gets a warning (legacy). */
  billTotal = 0;

  // ── bill ───────────────────────────────────────────────────────────
  /** The supplier's bills at the branch for the "which bill?" picker (new credits only). */
  private async loadBills(): Promise<void> {
    const c = this.credit;
    const key = `${c.supplierId}|${c.branchId}`;
    if (!c.supplierId || !c.branchId || key === this.billsLoadedFor) return;
    this.billsLoadedFor = key;
    const list: any[] = (await this.credits.getBillsForSupplier(c.supplierId, c.branchId)) ?? [];
    this.billOptions = [
      { id: ALL, label: this.lang.instant('SUPPLIER_CREDITS.FORM.ALL_BILLS') },
      ...list.map(b => ({ id: b.id, label: b.billingNumber ?? b.code ?? b.id })),
    ];
    // The chosen bill may not be in the list (edit): keep it selectable.
    if (c.billingId && !this.billOptions.some(o => o.id === c.billingId)) {
      this.billOptions.push({ id: c.billingId, label: c.billingNumber || c.billingId });
    }
  }

  billOf = () => this.billOptions.find(o => o.id === this.credit.billingId) ?? null;
  billLabel = (o: any) => o?.label ?? '';
  billLocked(): boolean { return this.formStatus === 'edit' || !!this.route.snapshot.paramMap.get('billingId'); }

  async onBill(o: { id: string; label: string } | undefined): Promise<void> {
    const c = this.credit;
    if (!o) return;
    if (o.id === ALL) {
      this.billTotal = 0;
      c.billingId = ALL;
      c.lines = [];
      this.ce.addLine();
      c.calculateTotal();
    } else {
      c.billingId = o.id;
      await this.applyBill(c, o.id);
    }
    this.markDirty();
  }

  /** Legacy `convertBillDataToSupplierCredit`: the bill's lines become the credit's lines (up to what may still be credited). */
  private async applyBill(c: SupplierCredit, billId: string): Promise<void> {
    const raw: any = await this.credits.getBillForCreditRaw(billId, c.id);
    if (!raw) return;
    const bill = new Bill();
    bill.ParseJson(raw);
    bill.calculateTotal();

    const keep = { attachment: c.attachment, allowBillOfEntry: c.allowBillOfEntry, number: c.supplierCreditNumber };
    const { lines, ...header } = raw;
    c.ParseJson(header);
    c.id = null;
    c.billingId = bill.id ?? billId;
    this.billTotal = bill.total;
    c.attachment = keep.attachment;
    c.allowBillOfEntry = keep.allowBillOfEntry;
    c.applyDiscountBeforeTax = bill.applyDiscountBeforeTax;
    c.discountIncludesTax = bill.discountIncludesTax;
    c.isInclusiveTax = bill.isInclusiveTax;
    c.supplierCreditNumber = keep.number;

    const out: SupplierCreditLine[] = [];
    for (const l of (lines ?? []) as any[]) {
      const line = this.toCreditLine(l);
      if (line) out.push(line);
    }
    c.lines = out;
    if (!c.branchId && this.branches.length) c.branchId = bill.branchId || this.branches[0].id;
    if (!this.supplierValue && c.supplierId) this.supplierValue = { id: c.supplierId, name: c.supplierName };
    c.supplierCreditNumber = keep.number || (await this.credits.getSupplierCreditNumber());
    c.calculateTotal();
  }


  /** A bill line as a credit line of the full quantity still creditable, or null when nothing is left to credit. */
  private toCreditLine(l: any): SupplierCreditLine | null {
    const line = new SupplierCreditLine();
    line.ParseJson(l);
    if (!(line.qty > 0 || line.serials.length || line.batches.length)) return null;
    line.billingLineId = l.id;
    line.id = null;
    line.qty = line.maxQty;
    line.tempQty = line.qty;
    line.lineQtyLimit = line.qty;
    // billDiscount / returned* come from the server row: the line's own share of the bill's header discount and what other credits took
    // Serials / batches start fully returned; the dialog narrows them.
    line.serials.forEach(s => (s.return = true));
    line.batches.forEach(b => { b.return = true; if (b.qty > b.maxQty) b.qty = b.maxQty; });
    line.isNew = true;
    return line;
  }

  /** "Import from bill" is for a saved credit of a single bill: it adds the bill's lines the credit does not hold. */
  get canImportFromBill(): boolean { return this.formStatus === 'edit' && this.fromBill; }

  async importFromBill(): Promise<void> {
    const c = this.credit;
    const raw: any = await this.credits.getBillForCreditRaw(c.billingId, c.id);
    if (!raw) return;
    const bill = new Bill();
    bill.ParseJson(raw);
    bill.calculateTotal();
    const offered = ((raw.lines ?? []) as any[]).map(l => this.toCreditLine(l)).filter((l): l is SupplierCreditLine => !!l);
    // Legacy match: same product, or the same non-empty note for free-text lines.
    const held = c.lines.filter(x => !(x as SupplierCreditLine).isDeleted);
    const taken = (l: SupplierCreditLine) => held.some(x => (x.selectedItem?.id && x.selectedItem.id === l.selectedItem?.id) || (!!x.note && x.note === l.note));
    const picked = await this.modal.open<CreditImportLinesModalComponent, CreditImportLinesData, SupplierCreditLine[] | null>(
      CreditImportLinesModalComponent, { size: 'lg', data: { lines: offered, taken } },
    ).afterClosed();
    if (!picked?.length) return;
    picked.forEach(l => { l.isImported = true; c.lines.push(l); });
    c.calculateTotal();
    this.markDirty();
  }

  // ── supplier / branch ──────────────────────────────────────────────
  async onSupplier(s: SupplierMini | undefined): Promise<void> {
    const c = this.credit;
    this.supplierValue = s ?? null;
    c.supplierId = s?.id ?? '';
    c.supplierName = s?.name ?? '';
    c.supplierEmail = s?.email ?? '';
    c.allowBillOfEntry = !!s?.allowBillOfEntry;
    this.ce.international = c.allowBillOfEntry;
    if (c.allowBillOfEntry) c.lines.forEach(l => { l.taxId = null; l.taxPercentage = 0; l.taxType = ''; l.taxes = []; l.taxTotal = 0; });
    this.billsLoadedFor = '';
    c.billingId = '';
    c.lines = [];
    this.ce.addLine();
    await this.loadBills();
    c.calculateTotal();
    this.markDirty();
  }

  override async onBranch(b: any): Promise<void> {
    await super.onBranch(b);
    this.billsLoadedFor = '';
    await this.loadBills();
  }

  async createSupplier(): Promise<void> {
    const res = await this.modal.open<SupplierQuickCreateModalComponent, void, { supplierId: string; supplierName: string } | null>(
      SupplierQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (!res?.supplierId) return;
    const s = await this.suppliers.getSupplier(res.supplierId);
    await this.onSupplier({ id: s.id, name: s.name, phone: s.phone, email: s.email, allowBillOfEntry: s.allowBillOfEntry, costCenter: s.costCenter });
  }

  protected override async sendRecipient(): Promise<{ emails: string[]; phone: string }> {
    const c = this.credit;
    let email = c.supplierEmail || '';
    let phone = this.supplierValue?.phone || '';
    if (c.supplierId && (!email || !phone)) {
      try {
        const s = await this.suppliers.getSupplier(c.supplierId);
        email = email || s.email;
        phone = phone || s.phone;
      } catch { /* the modal lets the user type the address */ }
    }
    return { emails: email ? [email] : [], phone };
  }

  // ── save ───────────────────────────────────────────────────────────
  protected override linesForSave(lines: Invoice['lines']): Invoice['lines'] {
    return lines.filter(l => !!l.productId || !!l.note || !!(l as SupplierCreditLine).billingLineId);
  }

  protected override blockSave(): string | null {
    return this.totalQuantity > 0 ? null : this.lang.instant('SUPPLIER_CREDITS.FORM.NO_QTY');
  }

  /** "Actions" dropdown of a saved supplier credit - items and behaviour come from the shared {@link SupplierCreditActions}. */
  actionsMenu(): DropdownMenuBtnItem[] {
    const d = this.credit;
    if (this.formStatus !== 'edit' || !d?.id) return [];
    return this.actions.menu(d, d.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }

  onCreditDate(v: any): void { if (v instanceof Date) { this.credit.supplierCreditDate = v; this.markDirty(); } }

  readonly taxTypes: SegmentedToggleOption[] = [
    { value: 'exclusive', label: 'DOC_FORM.EXCLUSIVE_TAX' },
    { value: 'inclusive', label: 'DOC_FORM.INCLUSIVE_TAX' },
  ];

  // ── serial / batch return ──────────────────────────────────────────
  async editReturn(line: SupplierCreditLine): Promise<void> {
    const res = await this.modal.open<CreditReturnModalComponent, { line: SupplierCreditLine }, { batches: SupplierCreditLine[]; serials: SupplierCreditLine[] } | null>(
      CreditReturnModalComponent, { size: 'lg', data: { line } },
    ).afterClosed();
    if (!res) return;
    line.batches = res.batches;
    line.serials = res.serials;
    line.qty = line.serials.length ? line.serialsReturned : line.batchesReturned;
    line.tempQty = line.qty;
    this.credit.calculateTotal();
    this.markDirty();
  }
}
