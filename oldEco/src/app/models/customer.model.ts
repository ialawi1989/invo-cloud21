import { Address } from "./address.model";

export class Customer {
  companyId: string = "";
  companyGroup: string = "";
  salutation: string = "";
  name: string = "";
  phone: string = "";
  mobile: string = "";
  email: string = "";
  addresses: Address[] = [];
  MSR: string = "";
  birthDay: string = "";
  notes: any[] = [];
  customerCredit: number = 0;
  discountAmount: number = 0;
  vatNumber: string = "";
  openingBalance: any[] = [];
  updatedAt: string = "";
  id: string = "";
  priceLabelId: string = "";
  currencyId: string = "";
  paymentTerm: string = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === "addresses" && Array.isArray(json[key])) {
        this.addresses = json[key].map((addr: any) => {
          const address = new Address();
          address.ParseJson(addr);
          return address;
        });
      } else if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
  }
}
