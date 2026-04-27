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
  // Serving information
  servingSize = '';
  servingsPerContainer = 0;
  // `kcal` maps to "Calories per Serving" — kept under the original name to
  // preserve compatibility with existing persisted records.
  kcal = 0;

  // Macronutrients
  fat = 0;          // Total fat (g)
  saturatedFat = 0; // g
  transFat = 0;     // g
  cholesterol = 0;  // mg
  sodium = 0;       // mg
  carb = 0;         // Total carbohydrates (g)
  protien = 0;      // Protein (g) — original typo preserved for back-compat
  dietaryFiber = 0; // g
  totalSugars = 0;  // g
  addedSugars = 0;  // g

  // Vitamins & minerals — entered as % Daily Value.
  vitaminA = 0;
  vitaminC = 0;
  vitaminD = 0;
  vitaminE = 0;
  calcium = 0;
  iron = 0;
  potassium = 0;
  magnesium = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }
}

/**
 * FDA-style allergen tracking. `contains` and `mayContain` are arrays of
 * canonical allergen keys (see ALLERGEN_KEYS in the component) — the same
 * key may appear in either, both, or neither. `statement` is a free-form
 * advisory string the user can edit independently of the boxes.
 */
export class Allergens {
  contains: string[] = [];
  mayContain: string[] = [];
  statement = '';

  ParseJson(json: any): void {
    if (!json) return;
    if (Array.isArray(json.contains))   this.contains   = json.contains.filter((x: any) => typeof x === 'string');
    if (Array.isArray(json.mayContain)) this.mayContain = json.mayContain.filter((x: any) => typeof x === 'string');
    if (typeof json.statement === 'string') this.statement = json.statement;
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
