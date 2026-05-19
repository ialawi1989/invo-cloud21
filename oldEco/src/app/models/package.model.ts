export class Package {
  mediaUrl: string = "";
  productId: string = "";
  productName: string = "";
  qty: number = 0;

  constructor(initialData?: Partial<Package>) {
    if (initialData) Object.assign(this, initialData);
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.mediaUrl = json.mediaUrl ?? "";
    this.productId = json.productId ?? "";
    this.productName = json.productName ?? "";
    this.qty = Number(json.qty ?? 0);
  }
}
