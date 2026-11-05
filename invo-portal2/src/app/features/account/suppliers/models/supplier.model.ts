export class SupplierContact {
  contact = '';
  phone = '';
  email = '';
  note = '';

  ParseJson(json: any): void {
    for (const key in json) if (key in this) (this as any)[key] = json[key];
  }
}

/** A product the supplier sells (batch / serialized / inventory), with the supplier's own code, minimum order and cost. */
export class SupplierItem {
  id: string | null = null;
  supplierId = '';
  minimumOrder = 0;
  cost = 0;
  supplierCode = '';
  supplierName = '';
  supplierEmail = '';
  productId = '';
  UOM = '';
  isDeleted = false;
  modified = false;
  onHand = 0;
  productName = '';
  barcode = '';

  ParseJson(json: any): void {
    for (const key in json) if (key in this) (this as any)[key] = json[key];
  }
}

export class Supplier {
  id = '';
  name = '';
  code = '';
  country = '';
  address = '';
  /** `[{ branchId, openingBalance }]` — only sent for a new supplier. */
  openingBalance: { branchId: string; openingBalance: number }[] = [];
  phone = '';
  /** Read-only here (no field on the form); kept so it survives a load → save round-trip and shows on the dashboard. */
  mobile = '';
  email = '';
  website = '';
  vatNumber = '';
  currencyId: string | null = null;
  note = '';
  contacts: SupplierContact[] = [];
  outStandingPayable = 0;
  cost = 0;
  disabled = false;
  allowBillOfEntry = false;
  costCenter = '';
  paymentTerm = 'net7';
  minimumOrder = 0;
  active = true;
  customFields: { [id: string]: any } = {};
  /** batch / inventory / serialized products (only the modified ones are saved). */
  supplierItems: SupplierItem[] = [];

  get is_email_valid(): boolean {
    if (!this.email) return true;
    return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(this.email);
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'contacts') {
        this.contacts = (json[key] ?? []).map((c: any) => { const x = new SupplierContact(); x.ParseJson(c); return x; });
      } else if (key === 'supplierItems') {
        this.supplierItems = (json[key] ?? []).map((i: any) => { const x = new SupplierItem(); x.ParseJson(i); return x; });
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
    if (this.contacts == null) this.contacts = [];
    if (this.customFields == null || Array.isArray(this.customFields)) this.customFields = {};
  }
}
