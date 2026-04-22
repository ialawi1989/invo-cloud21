import { ResponseData } from '@src/models/ResponseData';
import { Invoice } from '@src/models/account/Invoice';
import { Company } from '@src/models/admin/company';
import axios from 'axios'





interface products{
    name:string,
    quantity:number 
    unit_amount:number 
}
interface ThawaniPaymentData{
    client_reference_id:string,
    mode: "payment",
    products:products[],
    success_url:string,
    cancel_url:string,

}
export class ThawaniPayment {
    production = false
    secretKey="";
    publishableKey="";
    private getBaseUrl(){
        return this.production? 'https://checkout.thawani.om':'https://uatcheckout.thawani.om'
    }

    paymentData:ThawaniPaymentData={
        client_reference_id:"",
        mode:"payment",
        products:[],
        success_url:"",
        cancel_url:""
    }
    async initiatePayment(invoice:Invoice,company:Company,paymentSettings:any,referenceNumber:string,eInvoice:boolean|null = null ){
        try {
       
            //Payment Settings

            this.secretKey = paymentSettings.secretKey
            this.publishableKey = paymentSettings.publishableKey
            //Payment Data
         const baseUrl = eInvoice ?process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
         const urlIds = eInvoice ? company.id + '/' +  invoice.id +'/' + referenceNumber : referenceNumber
            this.paymentData.client_reference_id = referenceNumber;
            this.paymentData.success_url =  baseUrl+ "/payments/thawaniCallBack/"+ urlIds
            this.paymentData.cancel_url = baseUrl + "/payments/ThawaniCancelResponse/"+urlIds
            let unit_amount;
            this.paymentData.products=[]
            invoice.lines.forEach((line) => {
                unit_amount = (line.total / line.qty) * 1000
                this.paymentData.products.push({
                    "name": line.productName,
                    "quantity": line.qty,
                    "unit_amount": unit_amount
                });
            });

            if (invoice.deliveryCharge > 0 && !isNaN(invoice.deliveryCharge)) {
                unit_amount = invoice.deliveryCharge * 1000;
                this.paymentData.products.push({
                    "name": "Delivery Charge",
                    "quantity": 1,
                    "unit_amount": unit_amount
                });
            }

            let totalDiscount = 0;
            if (invoice.discountTotal > 0 && !isNaN(invoice.discountTotal)) {
                totalDiscount += invoice.discountAmount;
            }

            if(invoice.pointsDiscount&& invoice.pointsDiscount > 0 && !isNaN( invoice.pointsDiscount))
            {
                totalDiscount += invoice.pointsDiscount;

            }
            if (totalDiscount> 0 && !isNaN(totalDiscount)) {
                unit_amount = totalDiscount * 1000;
                this.paymentData.products.push({
                    "name": "Discount",
                    "quantity": 1,
                    "unit_amount": unit_amount
                });
            }

            if (invoice.chargeAmount > 0 && !isNaN(invoice.chargeAmount)) {
                unit_amount = invoice.chargeAmount * 1000;
                this.paymentData.products.push({
                    "name": "Other Charges",
                    "quantity": 1,
                    "unit_amount": unit_amount
                });
            }



            let url = this.getBaseUrl() +"/api/v1/checkout/session"
            let config = {
                method: 'post',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'thawani-api-key': this.secretKey
                },
                data: this.paymentData
            };
            let response = (await axios(config)).data;
            if(response.success)
            {
                let redirectUrl = this.getBaseUrl() + "/pay/" + response.data.session_id + "?key=" + this.publishableKey
                return new ResponseData(true,"",{url:redirectUrl})
            }else{
                return new ResponseData(false,response.code+": "+response.description,[])

            }
        } catch (error:any) {

            return new ResponseData(false,error.message,[])
        }
   
    } 
}