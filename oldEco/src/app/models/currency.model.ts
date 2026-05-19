export class Currency {
  name: string = "";
  id: string = "";
  rate: number = 0;
  symbol: string = "";
  isEnabled: boolean = false;
  index: number = 0;
  type: string = "";
  afterDecimal: number = 3;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
  }

  convertPrice(price: number): number {
    return (price / (this.rate || 0)) || 0;
  }
}
