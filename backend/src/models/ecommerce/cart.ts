import { CustomerAddress } from "../account/Customer";

export class CartItem {

}

export class Payment{
    paymentMethodId:string|null;
    amount=0;
    status="Pending";

    constructor(){
        this.paymentMethodId = null;
    }

}

export class Cart{
    branchId:string|null;
    branchName:string|null;

    sessionId:string="";

    status = "Draft"
    items:CartItem[]=[];
    address="";
    customerAddress:CustomerAddress|null;

    deliveryCharge = 0;
    minimumOrder =0;

    serviceId="";
    serviceName="";

    countryCode="";

    deliveryProvider="";
    externalId="";
    constructor(){
        this.branchId= null;
        this.customerAddress = null;
        this.branchName = null
    }

    calculateTotal(){

    }

    resetCart(){
       this.branchId = null;
       this.branchName = null;
       this.items =[];
       this.customerAddress = null;
       this.deliveryCharge = 0;
       this.minimumOrder=0
       this.serviceId ="";
       this.serviceName ="";
       this.countryCode ="";
       this.deliveryProvider ="";
    }

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    } 
}