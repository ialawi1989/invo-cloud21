export class TaxData {
  id = "";
  name = "";
  taxPercentage = 0;
  companyId = "";
  updatedAt = new Date();
  default = false;
  taxType = ""; //empty when its not tax Group 
  taxes = [];
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}