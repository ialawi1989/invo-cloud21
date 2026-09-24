export class TaxLineModel {
  name = '';
  index = '';
  taxId = '';
  taxPercentage = 0;
  taxAmount = 0;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) this[key as keyof typeof this] = json[key];
    }
  }
}

export class TaxDetails {
  taxId = '';
  type = '';
  taxPercentage = 0;
  taxAmount = 0;
  taxes: any[] = [];

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) this[key as keyof typeof this] = json[key];
    }
  }

  /** `tax` is a company tax record (`{ id, taxType, taxPercentage, taxes[] }`). */
  fromTaxObject(tax: { id: string; taxType: string; taxPercentage: number; taxes: any[] }): void {
    this.taxId = tax.id;
    this.type = tax.taxType;
    this.taxPercentage = tax.taxPercentage;
    this.taxAmount = 0;
    this.taxes = [...tax.taxes];
  }
}
