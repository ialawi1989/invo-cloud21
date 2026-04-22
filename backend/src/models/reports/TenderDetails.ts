
export class TenderDetails {
    tenderType: string = "";
    paymentMethodId :string ="";
    rate :number = 0;
    expected :number = 0;
    equivalant :number = 0;
    refund :number = 0;
    tenderTotal :number = 0

  
    constructor() {}
  
    toMap(): { [key: string]: any } {
      return {
        tenderType: this.tenderType,
        paymentMethodId: this.paymentMethodId,
        rate: this.rate,
        expected: this.expected,
        equivalant: this.equivalant,
        refund: this.refund,
        tenderTotal: this.tenderTotal

      };
    }
  
    static fromMap(map: { [key: string]: any }): TenderDetails {
      const tenderDetails = new TenderDetails();
      tenderDetails.tenderType = map.tenderType;
      tenderDetails.paymentMethodId = map.paymentMethodId;
      tenderDetails.rate = parseFloat(map.rate.toString());
      tenderDetails.expected = parseFloat(map.expected.toString());
      tenderDetails.equivalant = parseFloat(map.equivalant.toString());
      tenderDetails.refund = parseFloat(map.refund.toString());
      tenderDetails.tenderTotal = parseFloat(map.tenderTotal.toString());
      return tenderDetails;
    }
  
    static fromJson(json: { [key: string]: any }): TenderDetails {
      const tenderDetails = new TenderDetails();
      tenderDetails.tenderType = json.tenderType;
      tenderDetails.paymentMethodId = json.paymentMethodId;
      tenderDetails.rate = parseFloat(json.rate);
      tenderDetails.expected = parseFloat(json.expected);
      tenderDetails.equivalant = parseFloat(json.equivalant);
      tenderDetails.refund = parseFloat(json.refund);
      tenderDetails.tenderTotal = parseFloat(json.tenderTotal);
      return tenderDetails;
    }
  }