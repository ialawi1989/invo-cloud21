export class Service {
  id: string = "";
  name: string = "";
  companyId: string = "";
  barcode: string = "";
  defaultPrice: number = 0;
  description: string | null = null;
  mediaId: string | null = null;
  translation: { [key: string]: any } = {};
  taxId: string = "";
  serviceTime: number = 0;
  available: boolean = false;
  branchId: string = "";
  productTaxes: { [key: string]: any } = {};
  color: string = "";
  employeePrices: any | null = null;
  productId: string = "";
  price: number | null = null;
  priceBoundriesFrom: number | null = null;
  priceBoundriesTo: number | null = null;
  buyDownPrice: number = 0;
  buyDownQty: number = 0;
  priceByQty: any[] = [];
  selectedPricingType: string = "";
  serials: any | null = null;

  constructor(init?: Partial<Service>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.id = json.id ?? "";
    this.name = json.name ?? "";
    this.companyId = json.companyId ?? "";
    this.barcode = json.barcode ?? "";
    this.defaultPrice = Number(json.defaultPrice ?? 0);
    this.description = json.description ?? null;
    this.mediaId = json.mediaId ?? null;
    this.translation = json.translation ?? {};
    this.taxId = json.taxId ?? "";
    this.serviceTime = Number(json.serviceTime ?? 0);
    this.available = Boolean(json.available ?? false);
    this.branchId = json.branchId ?? "";
    this.productTaxes = json.productTaxes ?? {};
    this.color = json.color ?? "";
    this.employeePrices = json.employeePrices ?? null;
    this.productId = json.productId ?? "";
    this.price = json.price !== undefined ? Number(json.price) : null;
    this.priceBoundriesFrom = json.priceBoundriesFrom !== undefined ? Number(json.priceBoundriesFrom) : null;
    this.priceBoundriesTo = json.priceBoundriesTo !== undefined ? Number(json.priceBoundriesTo) : null;
    this.buyDownPrice = Number(json.buyDownPrice ?? 0);
    this.buyDownQty = Number(json.buyDownQty ?? 0);
    this.priceByQty = Array.isArray(json.priceByQty) ? json.priceByQty : [];
    this.selectedPricingType = json.selectedPricingType ?? "";
    this.serials = json.serials ?? null;
  }
}
