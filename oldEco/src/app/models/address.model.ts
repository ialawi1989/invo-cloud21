export class Address {
  title: string = "";
  note: string = "";
  lat: string = "";
  lng: string = "";
  governorate: string = "";
  city: string = "";
  block: string = "";
  road: string = "";
  building: string = "";
  addressLine1: string = "";
  addressLine2: string = "";
  country: string = "";
  state: string = "";
  region: string = "";
  flat: string = "";
  carInfo: string = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key] ?? "";
      }
    }
  }
}
