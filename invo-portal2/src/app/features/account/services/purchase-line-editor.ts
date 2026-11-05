import { InvoiceLine, SelectedItem } from '../models/invoice.model';
import { PurchaseOrderLine } from '../models/purchase-order.model';
import { DocumentLineEditor, newTempId, parseNumberField, resolveProductMediaUrl } from './document-line-editor';

/**
 * A row of `accounts/getPurchaseProducts`, with the unit cost the form proposes: the supplier's own cost
 * when it has one, else the product's cost (legacy `PurchaseProducts.setTypeOfCost`). Barcode lookups
 * already come with a `unitCost`.
 */
export function toPurchaseProduct(p: any): any {
  if (p.productCost === undefined && p.supplierCost === undefined) return { ...p, defaultPrice: p.unitCost ?? 0 };
  const supplier = p.supplierCost != null && Number(p.supplierCost) !== 0;
  const unitCost = supplier ? p.supplierCost : (p.productCost ?? 0);
  return { ...p, unitCost, typeOfCost: supplier ? 'supplierCost' : 'productCost', defaultPrice: unitCost };
}

/**
 * Line rules of the purchase documents (legacy `PurchaseOrderFormComponent`), on top of the shared editor:
 * the line is a {@link PurchaseOrderLine}, a picked product brings its cost, supplier code, minimum order,
 * UOM and purchase account (note stays empty), the tax is the product's own (none for a supplier abroad)
 * and a product can be on the document once.
 */
export class PurchaseLineEditor extends DocumentLineEditor {
  /** The supplier is abroad: purchase documents carry no tax. */
  international = false;
  /** The supplier's cost centre - the account new lines start with. */
  costCenter: string | null = null;
  /** Called when a product that is already on the document is picked again. */
  onDuplicate?: (line: InvoiceLine) => void;

  protected override newLine(): InvoiceLine { return new PurchaseOrderLine(); }

  /** Inventory assets - where a stocked product's purchase is booked unless the product says otherwise. */
  private get inventoryAccountId(): string | null {
    return this.accounts.find(a => a.name?.toLowerCase() === 'inventory assets')?.id ?? null;
  }

  /** Taxes stay off on a supplier abroad; otherwise it copies the tax record (base). */
  override onChangeTax(line: InvoiceLine): void {
    if (this.international) {
      (line as PurchaseOrderLine).clearTax();
      this.doc.calculateTotal();
      return;
    }
    super.onChangeTax(line);
  }

  /** A new blank row: account = supplier cost centre, else the previous row's, else the first account; default tax (none abroad). */
  override addLine(): InvoiceLine {
    const prev = this.doc.lines[this.doc.lines.length - 1];
    const line = super.addLine();
    line.accountId = this.costCenter || (prev?.accountId as string) || this.accounts[0]?.id || null;
    if (this.international) (line as PurchaseOrderLine).clearTax();
    return line;
  }

  override chooseItem(line: InvoiceLine, product: any): void {
    if (this.doc.lines.some(l => l !== line && !(l as any).isDeleted && l.selectedItem?.id === product.id)) {
      this.onDuplicate?.(line);
      return;
    }
    const l = line as PurchaseOrderLine;
    if (!(l as any).tempId) (l as any).tempId = newTempId();
    l.productId = product.id;
    l.itemDetailsTemp = product.id;
    l.mediaUrl = resolveProductMediaUrl(product);

    const item = new SelectedItem();
    item.id = product.id;
    item.name = product.name;
    item.type = product.type;
    item.translation = product.translation ?? null;
    l.selectedItem = item;

    if (Number(product.unitCost) > 0) l.unitCost = Number(product.unitCost);
    l.typeOfCost = product.typeOfCost ?? '';
    l.accountId = product.purchaseAccountId ?? this.inventoryAccountId ?? l.accountId;
    // The note stays empty for a product line (the server rejects a line that has both a product and a note).
    (l as any).note = null;
    l.showDropdownItems = false;

    if (this.international) l.clearTax();
    else l.taxId = product.taxId ?? null;

    l.barcode = product.barcode ?? '';
    l.SIC = product.supplierCode ?? '';
    l.UOM = product.UOM ?? '';
    l.qty = Number(product.minimumOrder) || 1;
    l.tempQty = l.qty;

    this.onChangeTax(l);
  }

  override clearItem(line: InvoiceLine): void {
    super.clearItem(line);
    const l = line as PurchaseOrderLine;
    l.typeOfCost = '';
    l.unitCost = 0;
    l.SIC = '';
    l.barcode = '';
    l.UOM = '';
    this.doc.calculateTotal();
  }

  /** A line from an import row: a matched product, or a note line when the barcode / name isn't a product. */
  buildPurchaseImportLine(row: { barcode?: string; productName?: string; qty?: any; unitCost?: any; SIC?: string }, product: any | null): InvoiceLine {
    const line = this.newLine() as PurchaseOrderLine;
    line.isNew = true;
    (line as any).tempId = newTempId();
    line.accountId = this.inventoryAccountId ?? this.accounts[0]?.id ?? null;
    line.SIC = row.SIC || '';
    line.qty = (parseNumberField(row.qty, 1) as number) || 1;
    line.tempQty = line.qty;

    if (product) {
      line.productId = product.id;
      line.itemDetailsTemp = product.id;
      line.barcode = row.barcode || product.barcode || '';
      line.unitCost = parseNumberField(row.unitCost, null) ?? (parseNumberField(product.unitCost, 0) as number);
      (line as any).note = null;
      line.UOM = product.UOM ?? '';
      const item = new SelectedItem();
      item.id = product.id;
      item.name = product.name;
      item.type = product.type;
      item.translation = product.translation ?? null;
      line.selectedItem = item;
      line.taxId = product.taxId ?? null;
    } else {
      const text = (row.barcode || row.productName || '').trim();
      line.productId = '';
      line.note = text;
      line.itemDetailsTemp = text;
      line.barcode = row.barcode || '';
      line.unitCost = (parseNumberField(row.unitCost, 0) as number) || 0;
      line.taxId = this.taxes.find(t => t.default)?.id ?? null;
    }
    if (this.international) line.clearTax();
    this.onChangeTax(line);
    return line;
  }
}
