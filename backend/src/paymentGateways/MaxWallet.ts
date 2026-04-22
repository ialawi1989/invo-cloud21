
import { HmacSHA256, enc } from 'crypto-js';
import axios from "axios"
import { ResponseData } from '@src/models/ResponseData';

interface MaxWalletResponse{
    amount:string,
    currency:string,
    reference_number:Number,
    status:string, //SUCESS OR FAIL 
    authorization_code:Number,
    date:any,
    error_code:string,
    error_description:string,
}
export class MaxWallet {
    merchantId = ""; //Issued by payment gateway 
    appId = "";//Issued by payment gateway 
    secretKey = "";//Issued by payment gateway 

    transactionAmount = 0;
    transactionCurrency = "BHD";
    referenceNumber = "";
    lang = "";
    secure_hash = "";
    showResult=""; // 1=> show result in app , 0 to Check merchant website for result
    private baseUrl() {
        return "https://api.credimax.com.bh/web/v1/merchant/transaction/check-status";
    }
    public setSecureHashString() {
        let string = "appId=\"" + this.appId + "\",merchantId=\"" + this.merchantId + "\",referenceNumber=\"" + this.referenceNumber + "\",transactionAmount=\"" + this.transactionAmount + "\",transactionCurrency=\"BHD\"";
        let hash = HmacSHA256(string, this.secretKey);
        this.secure_hash = hash.toString(enc.Base64);
    }

    public getPaymentData(){
       return {
            'appId': this.appId,
            'merchantId': this.merchantId,
            'referenceNumber': this.referenceNumber,
            'transactionAmount': this.transactionAmount,
            'transactionCurrency': this.transactionCurrency,
            'showResult': this.showResult,
            'lang': 'ar',
            'secure_hash': this.secretKey
        }
    }

    public async checkPaymentStatus(referenceId: string) {
        try {
    

            let string = "merchant_id=\"" + this.merchantId + "\",reference_id=\"" + referenceId + "\"";
            let hash = HmacSHA256(string, this.secretKey);
            let checkStatusSignature = hash.toString(enc.Base64);
    
            const body = { 'merchant_id': this.merchantId, 'reference_id': referenceId };
            var config = {
                method: 'post',
                url: this.baseUrl(),
                headers: {
                    "X-CLIENT-ID": this.appId,
                    "X-FOO-Signature": checkStatusSignature,
                    "X-FOO-Signature-Type": "KEYVAL",
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                },
                data: body
            };
    
            let response:MaxWalletResponse = (await axios(config)).data.response;

            if(response.status == "success")
            {
                return new ResponseData(true,"",response)
            }else{
                return new ResponseData(false,"",response)

            }

        } catch (error:any) {
            return new ResponseData(false, error.message,[])
        }
       
    }

}