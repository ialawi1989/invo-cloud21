import { InvoiceLine, SelectedItem } from '../../models/invoice.model';
import { SupplierCreditLine } from '../../models/supplier-credit.model';
import { DocumentLineEditor, newTempId } from '../../services/document-line-editor';

/**
 * Line rules of a supplier credit not tied to one bill ("all bills"): a line is a line of some bill of the
 * supplier, picked from the supplier's billed products. It brings the bill line's cost, tax, account, the bill's
 * discounts and totals (so the credit can take back the matching share) and the most that can be credited.
 */
export class SupplierCreditLineEditor extends DocumentLineEditor {
  /** The supplier is abroad: no tax on the credit. */
  international = false;
  /** Called when a bill line already on the credit is picked again. */
  onDuplicate?: (line: InvoiceLine) => void;

  protected override newLine(): InvoiceLine { return new SupplierCreditLine(); }

  override onChangeTax(line: InvoiceLine): void {
    if (this.international) {
      line.taxId = null; line.taxPercentage = 0; line.taxType = ''; line.taxes = []; line.taxTotal = 0;
      this.doc.calculateTotal();
      return;
    }
    super.onChangeTax(line);
  }

  /** `product` is a row of `accounts/getProductBillingLines` (a billed line). */
  override chooseItem(line: InvoiceLine, product: any): void {
    if (this.doc.lines.some(l => l !== line && !(l as any).isDeleted && (l as SupplierCreditLine).billingLineId === product.id)) {
      this.onDuplicate?.(line);
      return;
    }
    const l = line as SupplierCreditLine;
    if (!(l as any).tempId) (l as any).tempId = newTempId();
    l.ParseJson(product);
    l.id = null;
    l.billingLineId = product.id;
    l.productId = product.productId;
    l.itemDetailsTemp = product.productId;

    const item = new SelectedItem();
    item.id = product.productId;
    item.name = product.productName ?? product.name;
    item.type = product.productType ?? product.type;
    item.translation = product.translation ?? null;
    l.selectedItem = item;

    l.accountId = product.accountId;
    l.accountName = product.accountName;
    if (Number(product.unitCost) > 0) l.unitCost = Number(product.unitCost);
    l.note = product.note;
    l.barcode = product.barcode;
    l.UOM = product.UOM;
    l.qty = Number(product.qty) || Number(product.maxQty) || 0;
    l.tempMaxQty = Number(product.maxQty) || 0;
    l.maxQty = l.tempMaxQty;
    l.lineQtyLimit = l.qty;
    l.billingDiscountTotal = product.billingDiscountTotal;
    l.billDiscount = Number(product.billDiscount) || 0;
    l.billingQty = Number(product.billingQty) || 0;
    l.taxId = this.international ? null : product.taxId;
    this.onChangeTax(l);
  }
}
