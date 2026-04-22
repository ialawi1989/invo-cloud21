import { TimeHelper } from "@src/utilts/timeHelper";

export class PaymentBreakdown {
    invoicesDate: Date = new Date();
    invoiceQty: number = 0;
    paymentReceived: number = 0;
  
    constructor() {}
  
    toMap(): { [key: string]: any } {
      return {
        invoicesDate: this.invoicesDate,
        invoiceQty: this.invoiceQty,
        paymentReceived: this.paymentReceived,
      };
    }
  
    static fromMap(map: { [key: string]: any }): PaymentBreakdown {
      const paymentBreakdown = new PaymentBreakdown();
      paymentBreakdown.invoicesDate = TimeHelper.convertToDate(map.invoicesDate);
      paymentBreakdown.invoiceQty = parseInt(map.invoiceQty.toString());
      paymentBreakdown.paymentReceived = parseFloat(map.paymentReceived.toString());
      return paymentBreakdown;
    }
  
    static fromJson(json: { [key: string]: any }): PaymentBreakdown {
      const paymentBreakdown = new PaymentBreakdown();
      paymentBreakdown.invoicesDate = TimeHelper.convertToDate(json.invoicesDate);;
      paymentBreakdown.invoiceQty = parseInt(json.invoiceQty.toString());
      paymentBreakdown.paymentReceived = parseFloat(json.paymentReceived.toString());
      return paymentBreakdown;
    }
  }