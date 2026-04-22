import { Invoice } from "@src/models/account/Invoice";
import { Company } from "@src/models/admin/company";

interface paymentResponse{
    success:boolean,
    msg:string,
    data:{onlineData:any,referenceId:string,url:string}
}



export interface PaymentInterFace {
    production:boolean;
    initiatePayment(invoice:Invoice,company:Company,paymentSettings:any,referenceNumber:string,eInvoice:boolean|null):Promise<paymentResponse>;
} 