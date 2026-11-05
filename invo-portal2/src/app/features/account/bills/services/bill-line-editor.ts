import { InvoiceLine } from '../../models/invoice.model';
import { BillLine } from '../../models/bill.model';
import { PurchaseLineEditor } from '../../services/purchase-line-editor';

/** Purchase line rules (see {@link PurchaseLineEditor}) on bill lines: a picked product starts with no serials / batches. */
export class BillLineEditor extends PurchaseLineEditor {
  protected override newLine(): InvoiceLine { return new BillLine(); }

  override chooseItem(line: InvoiceLine, product: any): void {
    const before = line.selectedItem?.id;
    super.chooseItem(line, product);
    const l = line as BillLine;
    if (l.selectedItem?.id && l.selectedItem.id !== before) {
      l.batches = [];
      l.serials = [];
      l.productDefaultUnitCost = Number(product.unitCost) > 0 ? Number(product.unitCost) : l.unitCost;
    }
  }

  override clearItem(line: InvoiceLine): void {
    super.clearItem(line);
    const l = line as BillLine;
    l.batches = [];
    l.serials = [];
    l.productDefaultUnitCost = 0;
  }
}
