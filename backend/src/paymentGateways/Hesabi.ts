import { HesabeCrypt } from "hesabe-crypt-ts/lib"
import aesjs from "aes-js";
import https from 'node:https'
import axios from "axios"
import { ResponseData } from "@src/models/ResponseData";

interface HesabePaymentData {
    amount: Number,
    currency: "KWD" | "BHD" | "AED" | "OMR" | "QAR" | "SAR" | "USD" | "GBP" | "EUR"
    responseUrl: string,
    failureUrl: string,
    merchantCode: Number,//Issued By Hesabe 
    paymentType: Number,//Payment Type 0, 1 or 2; 0 - Indirect, 1 - Knet, 2 - MPGS
    name: string, // customer name 
    mobile_number: string
    orderReferenceNumber: string
}


interface HesabePaymentResponse {
    status: boolean,
    response: {
        data: any // responseToken fro payment url 
    }
}
export class Hesabe {
    production = true
    secret = "";
    ivKey = "";
    merchantId =0;
    accessCode = ""


    paymentData: HesabePaymentData = {
        amount: 0,
        currency: "BHD",
        responseUrl: "",
        failureUrl: "",
        merchantCode: 0,
        paymentType: 0,
        name: "",
        mobile_number: "",
        orderReferenceNumber: ""
    }
    private getBaseUrl() {
        return this.production ? `https://api.hesabe.com` : `https://sandbox.hesabe.com`
    }

    encryptAes(data: any) {
        let key = aesjs.utils.utf8.toBytes(this.secret);
        let iv = aesjs.utils.utf8.toBytes(this.ivKey);
        let instance = new HesabeCrypt();

        return instance.encryptAes(data, key, iv);
    }

    decryptAes(data: any) {
        let key = aesjs.utils.utf8.toBytes(this.secret);
        let iv = aesjs.utils.utf8.toBytes(this.ivKey);
        let instance = new HesabeCrypt();

        return instance.decryptAes(data, key, iv);
    }

    async checkOut() {
        try {
            let url = this.getBaseUrl() + "/checkOut"
            let encryptedData = this.encryptAes(this.paymentData);


            var config = {
                method: 'post',
                url: url,
                headers: {
                    "accessCode": this.accessCode,
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                },
                data: JSON.stringify({ 'data': encryptedData }),
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            };

            let paymentResponse = (await axios(config)).data;

            let decryptedResponse: HesabePaymentResponse = JSON.parse(this.decryptAes(paymentResponse));

            if (decryptedResponse.status) {
                let redirectUrl = this.getBaseUrl() + "/payment?data=" + decryptedResponse.response.data
                return new ResponseData(true, "", { url: redirectUrl })
            } else {
                return new ResponseData(false, "", [])
            }
        } catch (error:any) {
            return new ResponseData(false, error.message, [])

        }


    }

}