import { TimeHelper } from "@src/utilts/timeHelper";

export class TenderBreakdown {
    paymentDate: Date = new Date();
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
        paymentDate: this.paymentDate,
        tenderType: this.tenderType,
        paymentMethodId: this.paymentMethodId,
        rate: this.rate,
        expected: this.expected,
        equivalant: this.equivalant,
        refund: this.refund,
        tenderTotal: this.tenderTotal

      };
    }
  
    static fromMap(map: { [key: string]: any }): TenderBreakdown {
      const tenderBreakdown = new TenderBreakdown();
      tenderBreakdown.tenderType = map.tenderType;
      tenderBreakdown.paymentDate = TimeHelper.convertToDate(map.paymentDate);
      tenderBreakdown.paymentMethodId = map.paymentMethodId;
      tenderBreakdown.rate = parseFloat(map.rate.toString());
      tenderBreakdown.expected = parseFloat(map.expected.toString());
      tenderBreakdown.equivalant = parseFloat(map.equivalant.toString());
      tenderBreakdown.refund = parseFloat(map.refund.toString());
      tenderBreakdown.tenderTotal = parseFloat(map.tenderTotal.toString());
      return tenderBreakdown;
    }
  
    static fromJson(json: { [key: string]: any }): TenderBreakdown {
      const tenderBreakdown = new TenderBreakdown();
      tenderBreakdown.tenderType = json.tenderType;
      tenderBreakdown.paymentMethodId = json.paymentMethodId;
      tenderBreakdown.paymentDate = TimeHelper.convertToDate(json.paymentDate);
      tenderBreakdown.rate = parseFloat(json.rate);
      tenderBreakdown.expected = parseFloat(json.expected);
      tenderBreakdown.equivalant = parseFloat(json.equivalant);
      tenderBreakdown.refund = parseFloat(json.refund);
      tenderBreakdown.tenderTotal = parseFloat(json.tenderTotal);
      return tenderBreakdown;
    }
  }