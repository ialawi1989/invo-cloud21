export class CoveredAddress {
  address: string = "";
  minimumOrder: number = 0;
  deliveryCharge: number = 0;
  branchId: string = "";

  ParseJson(json: any): void {
    if (!json) return;

    this.address = json['address'] ?? "";
    this.branchId = json['branchId'] ?? "";
    this.minimumOrder = json['minimumOrder'] !== undefined ? parseFloat(json['minimumOrder']) : 0;
    this.deliveryCharge = json['deliveryCharge'] !== undefined ? parseFloat(json['deliveryCharge']) : 0;
  }
}
