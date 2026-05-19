import { Address } from './address.model';
import { CoveredAddress } from './covered-addresses.model';

export class DeliveryAddresses {
  type: string = "";
  coveredAddresses: CoveredAddress[] = [];
  list: Address[] = []; // List of addresses

  constructor(type: string = "") {
    this.type = type;
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.type = json['type'] ?? "";

    if (Array.isArray(json['list'])) {
      this.list = json['list'].map((element: any) => {
        const addr = new Address();
        addr.ParseJson(element);
        return addr;
      });
    }

    if (Array.isArray(json['coveredAddresses'])) {
      this.coveredAddresses = json['coveredAddresses'].map((element: any) => {
        const covered = new CoveredAddress();
        covered.ParseJson(element);
        return covered;
      });
    }
  }
}
