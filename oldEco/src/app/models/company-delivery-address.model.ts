import { Branch } from "./branch.model";

export interface AddressTranslationEntry {
  ar: string;
  en: string;
}

export interface AddressTranslation {
  [key: string]: AddressTranslationEntry; // e.g. "Governorate", "City"
}

export class DeliveryAddress {
  type: string = "";
  addressKey: string = "";
  minimumOrder: number = 0;
  deliveryCharge: number = 0;
  branches: Branch[] = [];
  coveredZones: CoveredZone[] = [];
  freeDeliveryOver:number | any = null;
  note: string = "";
  translation: AddressTranslation | null = null;

  constructor(initialData?: Partial<DeliveryAddress>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.type = json?.type?.toString() ?? "";
    this.note = json?.note?.toString() ?? "";
    this.addressKey = json?.addressKey?.toString() ?? "";
    this.minimumOrder = Number(json?.minimumOrder ?? 0);
    this.deliveryCharge = Number(json?.deliveryCharge ?? 0);
    this.freeDeliveryOver = Number(json?.freeDeliveryOver ?? null);
    this.translation = json?.translation ?? null;

    this.branches = Array.isArray(json?.branches)
      ? json.branches.map((b: any) => {
          const branch = new Branch();
          branch.ParseJson(b);
          return branch;
        })
      : [];

    this.coveredZones = Array.isArray(json?.coveredZones)
      ? json.coveredZones.map((z: any) => {
          const zone = new CoveredZone();
          zone.ParseJson(z);
          return zone;
        })
      : [];
  }
}

export class CoveredZone {
  radius: number = 0;
  minimumCharge: number = 0;
  deliveryCharge: number = 0;
  freeDeliveryOver:number | any = null;
  note:any= "";

  constructor(initialData?: Partial<CoveredZone>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.radius = Number(json?.radius ?? 0);
    this.minimumCharge = Number(json?.minimumCharge ?? 0);
    this.deliveryCharge = Number(json?.deliveryCharge ?? 0);
    this.freeDeliveryOver = Number(json?.freeDeliveryOver ?? null);
    this.note = json?.note?.toString() ?? "";
  }
}


export class CompanyDeliveryAddress {
  deliveryAreaType: string = "address";
  addresses: DeliveryAddress[] | DeliveryAddress = [];

  constructor(initialData?: Partial<CompanyDeliveryAddress>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.deliveryAreaType = json?.deliveryAreaType?.toString() ?? "address";

    if (this.deliveryAreaType === "zones") {
      const addr = new DeliveryAddress();
      addr.ParseJson({
        branches: json?.addresses?.branches ?? [],
        coveredZones: json?.addresses?.coveredZones ?? [],
      });
      this.addresses = addr;
    } else {
      this.addresses = Array.isArray(json?.addresses)
        ? json.addresses.map((a: any) => {
            const addr = new DeliveryAddress();
            addr.ParseJson(a);
            return addr;
          })
        : [];
    }
  }
}
