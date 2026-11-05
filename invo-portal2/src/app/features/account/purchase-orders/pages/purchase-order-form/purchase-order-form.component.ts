import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { EntityCustomFieldsComponent } from '../../../../settings/components/entity-custom-fields/entity-custom-fields.component';

import { Invoice } from '../../../models/invoice.model';
import { PurchaseOrder, PurchaseOrderLine } from '../../../models/purchase-order.model';
import { DocFormConfig, DocFormService, DocumentFormBase, ymd } from '../../../services/document-form-base';
import { DocumentLineEditor } from '../../../services/document-line-editor';
import { PurchaseLineEditor, toPurchaseProduct } from '../../../services/purchase-line-editor';
import { DocLinesConfig } from '../../../components/doc-lines-table/doc-lines.types';
import { DocLinesTableComponent } from '../../../components/doc-lines-table/doc-lines-table.component';
import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { DocSupplierSectionComponent, SupplierMini } from '../../../components/doc-supplier-section/doc-supplier-section.component';
import { DocTotalsComponent } from '../../../components/doc-totals/doc-totals.component';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { SupplierQuickCreateModalComponent } from '../../../suppliers/components/supplier-quick-create-modal/supplier-quick-create-modal.component';
import { PurchaseImportLinesModalComponent, PurchaseImportResult } from '../../components/purchase-import-lines-modal/purchase-import-lines-modal.component';
import { PurchaseOrderActions } from '../../services/purchase-order-actions';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';
import { PURCHASE_ORDER_RULES } from '../../services/purchase-order-validation';

/**
 * Purchase orders -> create / edit page (`/account/purchase-order/:id`, `0` / `new` = new). Built on the shared
 * document-form base (legacy `PurchaseOrderFormComponent`): supplier + branch + number / dates, the tax type
 * (inclusive / exclusive), and the lines with the supplier's cost, item code and minimum order. Saved lines
 * that are removed are deleted by the server on save; a supplier abroad (bill of entry) carries no tax.
 */
@Component({
  selector: 'app-purchase-order-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DocFormShellComponent, DocSupplierSectionComponent, SearchDropdownComponent, DatePickerComponent, SegmentedToggleComponent,
    DocLinesTableComponent, DocTotalsComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './purchase-order-form.component.html',
})
export class PurchaseOrderFormComponent extends DocumentFormBase {
  private orders = inject(PurchaseOrdersService);
  private suppliers = inject(SuppliersService);
  protected actions = inject(PurchaseOrderActions);

  readonly cfg: DocFormConfig = {
    features: ['account/purchase-orders'],
    routeBase: '/account/purchase-order',
    viewRoute: '/account/purchase-order/view',
    numberField: 'purchaseNumber',
    dateField: 'purchaseDate',
    numberModule: 'purchaseOrder',
    numberNameKey: 'PURCHASE_ORDERS.FORM.PURCHASE_ORDER',
    numberModeKey: 'invo_purchase_order_number_mode',
    rules: PURCHASE_ORDER_RULES,
    privilegeRoot: 'purchaseOrderSecurity',
    whatsappType: 'PO',
    pdfName: 'purchase-order.pdf',
    titleKey: 'PURCHASE_ORDERS.FORM.PURCHASE_ORDER',
    newCrumbKey: 'PURCHASE_ORDERS.FORM.NEW_PURCHASE_ORDER',
    editCrumbKey: 'PURCHASE_ORDERS.FORM.EDIT_PURCHASE_ORDER',
    listCrumbKey: 'PURCHASE_ORDERS.LIST.PURCHASE_ORDER_LIST',
    dashboardCrumbKey: 'PURCHASE_ORDERS.DASHBOARD',
    hasStatus: false,
    primaryKind: 'list',
    menuKinds: ['send'],
  };

  protected svc: DocFormService = {
    get: id => this.orders.getPurchaseOrder(id),
    getNumber: () => this.orders.getPurchaseNumber(),
    save: d => this.orders.savePurchaseOrder(d as PurchaseOrder),
    pdf: id => this.orders.viewPurchaseOrderPdf(id),
    sendEmail: (payload, id) => this.orders.sendPurchaseOrderEmail({ ...payload, purchaseOrderId: id }),
  };

  supplierValue: SupplierMini | null = null;

  readonly taxTypes: SegmentedToggleOption[] = [
    { value: 'exclusive', label: 'DOC_FORM.EXCLUSIVE_TAX' },
    { value: 'inclusive', label: 'DOC_FORM.INCLUSIVE_TAX' },
  ];

  get po(): PurchaseOrder { return this.doc as PurchaseOrder; }
  private get pe(): PurchaseLineEditor { return this.editor as PurchaseLineEditor; }

  protected newDoc(): Invoice { return new PurchaseOrder(); }
  protected override loadAccounts(): Promise<any[]> { return this.lookups.getPurchaseAccounts(); }
  protected override makeEditor(d: Invoice, taxes: any[], accounts: any[]): DocumentLineEditor { return new PurchaseLineEditor(d, taxes, accounts); }

  protected makeLinesConfig(): DocLinesConfig {
    const po = () => this.po;
    const scope = () => po().branchId;
    const query = (term: string, page: number) => ({ page, limit: 20, searchTerm: term, sortBy: {}, branchId: scope(), supplierId: po().supplierId });
    return {
      columns: [
        { key: 'item', type: 'item', label: 'DOC_LINES.ITEM_DETAILS' },
        { key: 'sic', type: 'text', label: 'PURCHASE_ORDERS.FORM.SIC', width: '140px', field: 'SIC' },
        { key: 'qty', type: 'qty', label: 'DOC_LINES.COL_QTY', width: '150px', min: 0, freeQty: true },
        {
          key: 'unitCost', type: 'money', label: 'PURCHASE_ORDERS.FORM.UNIT_COST', width: '150px', field: 'unitCost', required: true, min: 0,
          hint: line => {
            const t = (line as PurchaseOrderLine).typeOfCost;
            return t === 'supplierCost' ? 'PURCHASE_ORDERS.FORM.SUPPLIER_COST' : t === 'productCost' ? 'PURCHASE_ORDERS.FORM.PRODUCT_COST' : null;
          },
        },
        { key: 'tax', type: 'tax', label: 'DOC_LINES.COL_TAX', width: '170px', visible: () => !po().internationalSupplier },
        { key: 'amount', type: 'amount', label: 'DOC_LINES.COL_AMOUNT', width: '120px' },
      ],
      accounts: true,
      bulkItems: true,
      itemsDisabled: () => !scope() || !po().supplierId,
      itemSearch: async (term, filter) => {
        const page = filter?.page ?? 1;
        const d = await this.orders.getPurchaseProducts(query(term, page));
        return { list: (d.list ?? []).map(toPurchaseProduct), hasNext: page < (d.pageCount ?? 1) };
      },
      barcodeLookup: async term => {
        const res: any = await this.orders.getPurchaseProductByBarcode({ searchTerm: term, branchId: scope(), supplierId: po().supplierId });
        return res?.data ? toPurchaseProduct(res.data) : null;
      },
      customImport: () => this.importLines(),
      canRemove: () => this.po.lines.filter(l => !(l as PurchaseOrderLine).isDeleted).length > 1,
    };
  }

  // ── lifecycle hooks ────────────────────────────────────────────────
  /** A purchase order isn't an accounting transaction: no period-lock minimum on its dates. */
  protected override lockDate(): Date | null { return null; }
  override get branchLocked(): boolean { return false; }

  protected override prepareLoaded(d: Invoice, cloned: boolean): void {
    const po = d as PurchaseOrder;
    if (cloned) {
      po.isBill = false;
      po.status = '';
      po.billingId = '';
      po.billingNumber = '';
      const due = new Date();
      due.setMonth(due.getMonth() + 1);
      po.dueDate = ymd(due);
    }
  }

  /** The supplier dashboard's "New Purchase Order" opens the form with `?supplierId=`. */
  protected override initNew(d: Invoice): void {
    const supplierId = this.route.snapshot.queryParams['supplierId'];
    if (supplierId) (d as PurchaseOrder).supplierId = supplierId;
  }

  protected override async afterInit(isNew: boolean): Promise<void> {
    const ed = this.pe;
    ed.deleteMode = true;
    ed.onDuplicate = () => this.toast.warning(this.lang.instant('PURCHASE_ORDERS.FORM.ALREADY_ADDED'), '');

    const po = this.po;
    if (po.supplierId) {
      try {
        const s = await this.suppliers.getSupplier(po.supplierId);
        this.supplierValue = { id: s.id, name: s.name, phone: s.phone, email: s.email, country: s.country, costCenter: s.costCenter, allowBillOfEntry: s.allowBillOfEntry };
        po.supplierName = s.name;
        po.supplierEmail = po.supplierEmail || s.email;
        ed.costCenter = s.costCenter || null;
        if (isNew) po.lines.forEach(l => { if (!l.productId) l.accountId = s.costCenter || l.accountId; });
        po.internationalSupplier = !!s.allowBillOfEntry;
      } catch {
        this.supplierValue = { id: po.supplierId, name: po.supplierName };
      }
      ed.international = po.internationalSupplier;
      if (po.internationalSupplier) po.lines.forEach(l => (l as PurchaseOrderLine).clearTax());
      po.calculateTotal();
    }
  }

  // ── supplier ───────────────────────────────────────────────────────
  async onSupplier(s: SupplierMini | undefined): Promise<void> {
    const po = this.po;
    const ed = this.pe;
    this.supplierValue = s ?? null;
    po.supplierId = s?.id ?? '';
    po.supplierName = s?.name ?? '';
    po.supplierEmail = s?.email ?? '';
    po.internationalSupplier = !!s?.allowBillOfEntry;
    ed.international = po.internationalSupplier;
    ed.costCenter = s?.costCenter || null;

    po.lines.forEach(l => {
      const line = l as PurchaseOrderLine;
      if (po.internationalSupplier) line.clearTax();
      // A new order's rows start on the supplier's cost centre (rows that already hold a product keep their own account).
      if (po.id == null && !line.productId) line.accountId = s?.costCenter || this.accounts[0]?.id || null;
    });
    po.calculateTotal();
    this.markDirty();
  }

  async createSupplier(): Promise<void> {
    const res = await this.modal.open<SupplierQuickCreateModalComponent, void, { supplierId: string; supplierName: string } | null>(
      SupplierQuickCreateModalComponent, { size: 'lg' },
    ).afterClosed();
    if (!res?.supplierId) return;
    const s = await this.suppliers.getSupplier(res.supplierId);
    await this.onSupplier({ id: s.id, name: s.name, phone: s.phone, email: s.email, country: s.country, costCenter: s.costCenter, allowBillOfEntry: s.allowBillOfEntry });
  }

  protected override async sendRecipient(): Promise<{ emails: string[]; phone: string }> {
    const po = this.po;
    let email = po.supplierEmail || '';
    let phone = this.supplierValue?.phone || '';
    if (po.supplierId && (!email || !phone)) {
      try {
        const s = await this.suppliers.getSupplier(po.supplierId);
        email = email || s.email;
        phone = phone || s.phone;
      } catch { /* the modal lets the user type the address */ }
    }
    return { emails: email ? [email] : [], phone };
  }

  // ── tax type ───────────────────────────────────────────────────────
  get taxType(): string { return this.po.isInclusiveTax ? 'inclusive' : 'exclusive'; }
  onTaxType(v: string): void {
    this.po.isInclusiveTax = v === 'inclusive';
    this.po.calculateTotal();
    this.markDirty();
  }

  // ── dates ──────────────────────────────────────────────────────────
  get purchaseDate(): Date { return this.cachedDate(this.po.purchaseDate); }
  get expiryDate(): Date { return this.cachedDate(this.po.dueDate); }
  onPurchaseDate(v: any): void { if (v instanceof Date) { this.po.purchaseDate = v; this.markDirty(); } }
  onExpiryDate(v: any): void { if (v instanceof Date) { this.po.dueDate = ymd(v); this.markDirty(); } }

  /** "Actions" dropdown of a saved purchase order - items and behaviour come from the shared {@link PurchaseOrderActions}. */
  actionsMenu(): DropdownMenuBtnItem[] {
    const d = this.po;
    if (this.formStatus !== 'edit' || !d?.id) return [];
    return this.actions.menu(d, d.id, () => { this.dirty = false; this.form.markAsPristine(); this.afterSaveRoute(); });
  }

  // ── import (CSV / XLSX) ────────────────────────────────────────────
  /**
   * Legacy `imporProducts`: barcodes are matched to products (`product/searchByBarcodes`); a barcode that matches
   * nothing, and a row with only a name, become note lines. "Skip duplicates" drops rows already on the order.
   */
  async importLines(): Promise<void> {
    const res = await this.modal.open<PurchaseImportLinesModalComponent, void, PurchaseImportResult | null>(PurchaseImportLinesModalComponent, { size: 'md' }).afterClosed();
    if (!res?.lines.length) return;

    const po = this.po;
    const ed = this.pe;
    const last = po.lines[po.lines.length - 1];
    if (last && !last.productId && !last.note) po.lines.pop();

    let rows = res.lines;
    if (res.skipDuplicate) {
      const live = (po.lines as PurchaseOrderLine[]).filter(l => !l.isDeleted);
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
    const found = barcodes.length ? ((await this.lookups.searchByBarcodes(barcodes, 'purchaseOrder')) ?? []) : [];
    const byCode = new Map<string, any>(found.filter(p => p?.barcode).map(p => [String(p.barcode).trim(), p]));

    const missing: string[] = [];
    for (const r of rows) {
      const product = r.barcode ? byCode.get(r.barcode) ?? null : null;
      if (r.barcode && !product) missing.push(r.barcode);
      po.lines.push(ed.buildPurchaseImportLine(r, product));
    }
    po.lines.forEach((l, i) => (l.index = i));
    if (!ed.lastLineIsEmpty) ed.addLine();
    po.calculateTotal();
    this.markDirty();

    if (missing.length) {
      this.toast.warning(this.lang.instant('PURCHASE_ORDERS.IMPORT.NOT_FOUND', { count: missing.length }), missing.slice(0, 10).join(', ') + (missing.length > 10 ? '…' : ''));
    } else {
      this.toast.success(this.lang.instant('PURCHASE_ORDERS.IMPORT.DONE', { count: rows.length }));
    }
  }
}
