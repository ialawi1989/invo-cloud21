import { InvoiceLine, SelectedItem } from '../models/invoice.model';
import { TaxDetails } from '../models/tax.model';
import { SalesAccount, SalesTax } from './sales-lookups.service';

let tempCounter = 0;
/** Stable identity for unsaved lines so `@for` tracking survives re-ordering (legacy `generateGuidFromDate`). */
export const newTempId = (): string => `tmp-${Date.now().toString(36)}-${(tempCounter++).toString(36)}`;

export const parseNumberField = (value: any, fallback: number | null = 0): number | null => {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  if (s === '') return fallback;
  const n = parseFloat(s);
  return isNaN(n) ? fallback : n;
};

/** Direct image URL of a product whatever shape `mediaUrl` came in (string vs image object). */
export const resolveProductMediaUrl = (product: any): string | null => {
  if (!product) return null;
  const m = product.mediaUrl;
  if (typeof m === 'string' && m) return m;
  if (m && typeof m === 'object') return m.thumbnailUrl || m.defaultUrl || null;
  return product.defaultImage || product.image || null;
};

/**
 * What the shared line table + editor need from a document (invoice, estimate, credit note …).
 * `Invoice` satisfies it as-is; other document models add the few members they lack.
 */
export interface DocumentLike {
  lines: InvoiceLine[];
  status: string;
  discountAmount: number;
  discountPercentage: boolean;
  discountType: string;
  applyDiscountBeforeTax: boolean;
  chargeId: string | null;
  chargeAmount: number;
  chargePercentage: boolean;
  chargeType?: string | null;
  chargesTaxDetails?: TaxDetails | null;
  readonly lineTotal: number;
  transactionDiscountBase(): number;
  calculateTotal(): void;
}

/**
 * Line / discount / surcharge rules of the invoice form (legacy `InvoiceFormLinesComponent`),
 * kept free of the UI so the same rules serve the other sales documents. Every mutation
 * ends in `invoice.calculateTotal()`, exactly like legacy.
 */
export class DocumentLineEditor {
  constructor(
    public doc: DocumentLike,
    public taxes: SalesTax[] = [],
    public accounts: SalesAccount[] = [],
  ) {}

  get defaultTax(): SalesTax | undefined {
    return this.taxes.find(t => t.default) || this.taxes[0];
  }

  /** Copies the tax record onto the line and recalculates. */
  onChangeTax(line: InvoiceLine): void {
    const tax = this.taxes.find(t => t.id == line.taxId);
    if (tax) {
      line.taxPercentage = tax.taxPercentage;
      line.taxType = tax.taxType;
      line.taxes = tax.taxes as any;
      line.taxTotal = tax.taxTotal ?? 0;
    } else {
      line.taxPercentage = 0;
      line.taxTotal = 0;
      line.taxType = '';
      line.taxes = [];
    }
    this.doc.calculateTotal();
  }

  /** The trailing empty row. */
  addLine(): InvoiceLine {
    const line = new InvoiceLine();
    line.isNew = true;
    (line as any).tempId = newTempId();
    line.price = 0;
    line.index = this.doc.lines.length;
    if (this.accounts.length) line.accountId = this.accounts[0].id;
    const def = this.taxes.find(t => t.default);
    line.taxId = def ? def.id : null;
    this.onChangeTax(line);
    this.doc.lines.push(line);
    return line;
  }

  /** Inserts an empty row at `index` ("Insert New Row"). */
  insertLineAt(index: number): InvoiceLine {
    const line = this.addLine();
    this.doc.lines.pop();
    this.doc.lines.splice(index, 0, line);
    this.doc.lines.forEach((x, i) => (x.index = i));
    return line;
  }

  /** Copies product, price, discount, tax and account into a new unsaved row right below `source`. */
  cloneLine(source: InvoiceLine): InvoiceLine {
    const line: any = new InvoiceLine();
    line.isNew = true;
    line.tempId = newTempId();
    for (const k of ['productId', 'itemDetailsTemp', 'mediaUrl', 'qty', 'tempQty', 'price', 'note', 'UOM', 'discountAmount',
      'discountPercentage', 'discountPerQty', 'taxId', 'taxPercentage', 'taxType', 'accountId', 'commissionAmount', 'commissionPercentage']) {
      line[k] = (source as any)[k];
    }
    if (source.selectedItem?.id) line.selectedItem = Object.assign(new SelectedItem(), source.selectedItem);
    line.taxes = (source.taxes ?? []).map(t => Object.assign(Object.create(Object.getPrototypeOf(t)), t));
    this.doc.lines.splice(this.doc.lines.indexOf(source) + 1, 0, line);
    this.doc.lines.forEach((x, i) => (x.index = i));
    this.doc.calculateTotal();
    return line;
  }

  /** Scan flow: bumps the qty of an existing unsaved line of the same product, else fills the next empty row. */
  addScanned(product: any): InvoiceLine {
    const same = this.doc.lines.find(l => l.isNew && l.productId === product.id);
    if (same) {
      same.qty += 1;
      same.tempQty = same.qty;
      this.doc.calculateTotal();
      return same;
    }
    const line = this.doc.lines.find(l => !l.productId && !l.note) ?? this.addLine();
    this.chooseItem(line, product);
    if (!this.lastLineIsEmpty) this.addLine();
    return line;
  }

  /** True while the last row has no product/description — legacy `disableAddLine`. */
  get lastLineIsEmpty(): boolean {
    const lines = this.doc.lines;
    if (!lines.length) return false;
    const a = lines[lines.length - 1].itemDetailsTemp ?? '';
    return String(a).trim() === '';
  }

  /** Picks a product for a line (no I/O — serial/batch loading is the caller's job). */
  chooseItem(line: InvoiceLine, product: any): void {
    if (!(line as any).tempId) (line as any).tempId = newTempId();
    line.productId = product.id;
    line.itemDetailsTemp = product.id;
    line.mediaUrl = resolveProductMediaUrl(product);

    const item = new SelectedItem();
    item.id = product.id;
    item.name = product.name;
    item.type = product.type;
    item.translation = product.translation ?? null;
    line.selectedItem = item;

    line.price = product.defaultPrice || 0;
    line.taxId = product.taxId == null || product.taxId === '' ? (this.defaultTax?.id ?? null) : product.taxId;
    line.note = product.description;
    line.commissionAmount = product.commissionAmount;
    line.commissionPercentage = product.commissionPercentage;
    line.showDropdownItems = false;
    if (product.saleAccountId != null) line.accountId = product.saleAccountId;

    this.onChangeTax(line);
  }

  /** Clears the product of a line (draft invoices drop the row entirely, like legacy). */
  clearItem(line: InvoiceLine): void {
    if (this.doc.status === 'Draft') {
      const i = this.doc.lines.indexOf(line);
      if (i > -1) this.doc.lines.splice(i, 1);
    }
    line.productId = '';
    line.selectedItem = null as any;
    line.batch = '';
    line.serial = '';
    line.itemDetailsTemp = '';
    line.mediaUrl = null;
    line.price = 0;
  }

  /**
   * Removes a line. On an edited invoice a saved line is voided (kept, flagged) rather than
   * dropped; unsaved lines are removed. Returns what happened so the UI can react.
   */
  removeLine(line: InvoiceLine, formStatus: string): 'removed' | 'voided' {
    const i = this.doc.lines.indexOf(line);
    if (formStatus === 'edit' && line.id) {
      line.justVoided = true;
      line.isVoided = true;
      this.doc.calculateTotal();
      return 'voided';
    }
    if (i > -1) this.doc.lines.splice(i, 1);
    this.doc.calculateTotal();
    return 'removed';
  }

  onChangeQty(line: InvoiceLine, qty: number): void {
    if (qty < line.minQty) line.qty = line.minQty;
    this.doc.calculateTotal();
  }

  onChangePrice(line: InvoiceLine): void {
    if ((line.price as any) === '' || line.price == null) line.price = 0;
    this.doc.calculateTotal();
  }

  setLineDiscount(line: InvoiceLine, d: { amount: number; percentage: boolean }): void {
    line.discountAmount = d.amount;
    if (!d.percentage && line.discountAmount > line.price * line.qty) line.discountAmount = line.price * line.qty;
    line.discountPercentage = d.percentage;
    this.doc.calculateTotal();
  }

  /** Invoice-level discount — capped at the discount base when it's a fixed amount. */
  setInvoiceDiscount(d: { amount: number; percentage: boolean }): void {
    const inv = this.doc;
    inv.discountAmount = d.amount;
    const base = inv.applyDiscountBeforeTax ? inv.transactionDiscountBase() : inv.lineTotal;
    if (!d.percentage && inv.discountAmount > base) inv.discountAmount = base;
    inv.discountPercentage = d.percentage;
    inv.calculateTotal();
  }

  setCharge(surcharge: { id: string; amount: number; percentage: boolean; taxId?: string | null } | undefined): void {
    const inv = this.doc;
    if (!surcharge) {
      inv.chargeId = null;
      inv.chargeAmount = 0;
      inv.chargePercentage = false;
    } else {
      if ('chargeType' in inv) inv.chargeType = 'chargeBeforeTax';
      if ('chargesTaxDetails' in inv && surcharge.taxId != null) {
        const tax = this.taxes.find(t => t.id == surcharge.taxId);
        if (tax) {
          const details = new TaxDetails();
          details.fromTaxObject(tax as any);
          inv.chargesTaxDetails = details;
        }
      }
      inv.chargeId = surcharge.id;
      inv.chargeAmount = surcharge.amount;
      inv.chargePercentage = surcharge.percentage;
    }
    inv.calculateTotal();
  }

  /** Moves a line and re-indexes (drag-and-drop reorder). */
  moveLine(from: number, to: number): void {
    if (from === to) return;
    const [l] = this.doc.lines.splice(from, 1);
    this.doc.lines.splice(to, 0, l);
    this.doc.lines.forEach((x, i) => (x.index = i));
    this.doc.calculateTotal();
  }

  /** Builds a line from a bulk-import row + the matched product (legacy `importProductsByBarcodes`). */
  buildImportedLine(row: any, product: any, barcode: string): InvoiceLine {
    const qty = parseNumberField(row?.qty, 1) as number;
    const price = parseNumberField(row?.price, null) ?? (parseNumberField(product.defaultPrice, 0) as number);
    const discount = parseNumberField(row?.discountTotal, 0) as number;

    const line: any = new InvoiceLine();
    line.isNew = true;
    line.tempId = newTempId();
    line.itemDetailsTemp = product.id;
    line.productId = product.id;
    line.mediaUrl = resolveProductMediaUrl(product);
    line.barcode = product.barcode || barcode;
    line.price = price;
    line.qty = qty;
    line.tempQty = qty;
    line.note = product.description || row?.note || '';
    line.UOM = product.UOM ?? '';

    const inventory = this.accounts.find(a => a.name?.toLowerCase() === 'inventory assets');
    line.accountId = inventory?.id ?? (this.accounts.length ? this.accounts[0].id : null);

    const item = new SelectedItem();
    item.id = product.id;
    item.name = product.name;
    item.barcode = product.barcode || barcode;
    item.type = product.type;
    item.translation = product.translation ?? null;
    line.selectedItem = item;

    line.taxId = product.taxId ?? this.defaultTax?.id ?? null;
    this.onChangeTax(line);

    if (product.commissionAmount) line.commissionAmount = product.commissionAmount;
    if (product.commissionPercentage) line.commissionPercentage = product.commissionPercentage;
    if (discount > 0) {
      line.discountAmount = discount;
      line.discountPercentage = false;
    }
    return line;
  }
}
