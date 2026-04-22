// import { OpenCashier } from './models/OpenCashier';
import { TenderDetails } from './TenderDetails';
// import { CashierReport } from './models/custom/cashierReport';
import { PaymentBreakdown } from './PaymentBreakdown';
import {CategoryDetails} from './CategoryDetails';
import { OpenOrders } from './openOrders';
import { SalesDetails } from './salesDetails';
import { ServiceDetails } from './serviceDetails';


export class PaymentByTender {
   
    paymentMethodName: string = "";
    paymentMethodId :string ="";
    total :number = 0;
    equivalant :number = 0;

    static fromMap(map: { [key: string]: any }): PaymentByTender {
    const paymentByTender = new PaymentByTender();
    paymentByTender.paymentMethodName = map.paymentMethodName;
    paymentByTender.paymentMethodId = map.paymentMethodId;
    paymentByTender.total = map.total ?? 0;
    paymentByTender.equivalant = map.equivalant ?? 0;
    return paymentByTender;
    }


    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
    
   
}

export class ShortOver {
   
    paymentMethodName: string = "";
    paymentMethodId :string ="";
    countAmount :number = 0;
    expected :number = 0;
    shortOver : number = 0;

    static fromMap(map: { [key: string]: any }): ShortOver {
        const paymentByTender = new ShortOver();
        paymentByTender.paymentMethodName = map.paymentMethodName;
        paymentByTender.paymentMethodId = map.paymentMethodId;
        paymentByTender.countAmount = map.countAmount ?? 0;
        paymentByTender.expected = map.expected ?? 0;
        paymentByTender.shortOver = map.shortOver ?? 0;
        return paymentByTender;
    }

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
   
}

class CashierReport {
  cashierIn:any = null;
  cashierOut :any =null;
  employeeName :string| null=null;
  branchName : string|null = null;
  branchId : string| null =null;
  
  totalOrders: number = 0;
  openingBalance: number = 0;
  totalPayments: number = 0;
  totalRefunds: number = 0;
  totalPayout: number = 0;
  closingBalance: number = 0;

  paymentByTender: PaymentByTender[] = [];
  shortOver :ShortOver[] = [];
 
  ParseJson(json:any): void{
    for (const key in json) {
       this[key as keyof typeof this] = json[key];
    }
}
 
 


}

export { CashierReport };