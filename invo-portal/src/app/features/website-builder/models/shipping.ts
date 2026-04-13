export class ShippingZone {
  name: string = "";
  Countries: string[] = [];
  rates: Rate[] = [];
  isNew: boolean = false;
  ParseJson(json: any): void {
    for (const key in json) {
      if (key === "rates") {
        const ratesTemp: Rate[] = [];
        json[key].forEach((rateJson: any) => {
          const rate = new Rate();
          rate.ParseJson(rateJson);
          ratesTemp.push(rate);
        });
        this.rates = ratesTemp;
      } else {
        if (key in this) {
          this[key as keyof this] = json[key];
        }
      }
    }
  }
}

export class Rate {
  type: string = ""; // 'weight' or 'total'
  from: number | null = null;
  to: number | null = null; // Can be a number or an empty string
  price: number | null = null;
  name = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key];
      }
    }
  }
}

export class ShippingOptions {
  type = "delivery";
  weightUOM = "kg";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key];
      }
    }
  }
}