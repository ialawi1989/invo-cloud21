export class ShippingOptions {
  id: string = "";
  name: string = "";
  note: string = "";
  price: number = 0;

  constructor(init?: Partial<ShippingOptions>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.id = json['id']?.toString() ?? "";
    this.name = json['name']?.toString() ?? "";
    this.price = parseFloat(json['price']) || 0;
    this.note = json['note']?.toString() ?? "";
  }
}
