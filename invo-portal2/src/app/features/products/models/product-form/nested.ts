// Nested models with ParseJson — composed into the Product class.

export class ProductImage {
  id: string | null = '';
  defaultUrl: string | null = '';
  thumbnailUrl: string | null = '';
  name?: string | null = '';
  extension?: string | null = '';
  size?: string | null = '';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }
}

export class Nutrition {
  kcal = 0;
  fat = 0;
  carb = 0;
  protien = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }
}

export class Measurement {
  shoulder = true;
  sleeve = true;
  armholeGrith = true;
  upperarmGrith = true;
  wristGrith = true;
  frontShoulderToWaist = true;
  bustGrith = true;
  waistGrith = true;
  hipGrith = true;
  acrossShoulder = true;
  thigh = true;
  ankle = true;
  bodyHeight = true;
  napeOfNeckToWaist = true;
  outsteam = true;
  insideLeg = true;

  get atLeastOne(): number {
    return (Object.values(this) as any[]).filter((v) => v === true).length;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }
}

export class ProductAttributes {
  key = '';
  title = '';
  checked = false;
  showInSearch: boolean | null = null;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }
}

export class InventorySummary {
  qtySum = 0;
  stockValue = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }
}

export class PriceModel {
  discount = 0;
  discountType: 'amount' | 'percent' | '' = '';
  [key: string]: any;

  ParseJson(json: any): void {
    for (const key in json) {
      (this as any)[key] = json[key];
    }
  }
}
