
import { HmacSHA256, enc } from 'crypto-js';
import axios from "axios"
import { ResponseData } from '@src/models/ResponseData';
import { Invoice } from '@src/models/account/Invoice';
import { Company } from '@src/models/admin/company';
import { PaymentInterFace } from './paymentInterFace';
import { ValidationException } from '@src/utilts/Exception';

interface BenefitPayResponse{
    amount:string,
    currency:string,
    reference_number:Number,
    status:string, //SUCESS OR FAIL 
    authorization_code:Number,
    date:any,
    error_code:string,
    error_description:string,
    config:any,
}
export class BenefitPay implements PaymentInterFace {
    production= true;
    merchantId = ""; //Issued by payment gateway 
    appId = "";//Issued by payment gateway 
    secretKey = "";//Issued by payment gateway 

    transactionAmount = "";
    transactionCurrency = "BHD";
    referenceNumber = "";
    lang = "";
    secure_hash = "";
    showResult=""; // 1=> show result in app , 0 to Check merchant website for result

    private baseUrl() {
        return "https://api.benefitpay.bh/web/v1/merchant";
    }
    public setSecureHashString() {

        var hashedString = "appId=\"" + this.appId + "\",merchantId=\"" + this.merchantId + "\",referenceNumber=\"" + this.referenceNumber + "\",transactionAmount=\"" + this.transactionAmount + "\",transactionCurrency=\"BHD\"";
        
  
        let hash = HmacSHA256(hashedString, this.secretKey);
        this.secure_hash = hash.toString(enc.Base64);

    }

    public async initiatePayment(invoice:Invoice,company:Company,paymentSettings:any,referenceNumber:string){
        
        if(!paymentSettings || !paymentSettings.appId ||  !paymentSettings.merchantId || ! paymentSettings.secretKey )
        {
            throw new ValidationException("Payment Is Not Active")
        }
     
        this.appId = paymentSettings.appId
        this.merchantId = paymentSettings.merchantId
        this.secretKey = paymentSettings.secretKey

        //Payment Data
        this.transactionAmount =      invoice.toPaidAmount.toFixed(company.afterDecimal);
        this.transactionCurrency = company.settings.currencySymbol;
        this.showResult = "1"
        this.referenceNumber =referenceNumber;
        this.setSecureHashString();

       let data =  {
            'appId': this.appId,
            'merchantId': this.merchantId,
            'referenceNumber':this.referenceNumber,
            'transactionAmount': this.transactionAmount,
            'transactionCurrency': this.transactionCurrency,
            'showResult': this.showResult,
            'lang': 'ar',
            'secure_hash': this.secure_hash
        }
       return new ResponseData(true,"",data)
    }

    public async checkPaymentStatus(referenceId: string,paymentSettings:any) {
        try {
            let url = this.baseUrl() + '/transaction/check-status';
     
            this.appId = paymentSettings.settings.appId
            this.merchantId = paymentSettings.settings.merchantId
            this.secretKey = paymentSettings.settings.secretKey
            
            let string = "merchant_id=\"" + this.merchantId + "\",reference_id=\"" + referenceId + "\"";
            let hash = HmacSHA256(string, this.secretKey);
            let checkStatusSignature = hash.toString(enc.Base64);
    
            const body = { 'merchant_id': this.merchantId, 'reference_id': referenceId };
            var config = {
                method: 'post',
                url: url,
                headers: {
                    "X-CLIENT-ID": this.appId,
                    "X-FOO-Signature": checkStatusSignature,
                    "X-FOO-Signature-Type": "KEYVAL",
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                },
                data: body
            };
    
            let response:BenefitPayResponse = (await axios(config)).data.response;
     
            if(response.status == "success")
            {
                return new ResponseData(true,"",{config:response})
            }else{
                return new ResponseData(false,"",{error:response})

            }

        } catch (error:any) {
            console.log(error)
            return new ResponseData(false, error.message,[])
        }
       
    }

}