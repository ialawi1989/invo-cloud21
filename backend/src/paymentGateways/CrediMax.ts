import { ResponseData } from "@src/models/ResponseData";
import { Invoice } from "@src/models/account/Invoice";
import { Company } from "@src/models/admin/company";
import axios from "axios"
import { PaymentInterFace } from "./paymentInterFace";

interface CrediMaxPaymentRequest {
    apiOperation: string; // INITIATE_CHECKOUT
    interaction: {
        operation: string; // PURCHASE (for both testing and production)
        returnUrl: string;
        cancelUrl: string;
        timeoutUrl: string;
        merchant:any;
        displayControl:any;
        style:any
    };
    order: {
        id: string;
        amount: string;
        currency: string;
        description:string
    };
}
interface CrediMaxPaymentResponse {
    merchant: string; // The unique identifier issued to you by your payment provider
    result: "FAILURE" | "PENDING" | "SUCCESS" | "UNKNOWN";
    successIndicator: any; // for successful payments only.
    session: any; // session.id is used for hosted.checkout()
    error: any;
}


export class CrediMaxPayment implements PaymentInterFace {
    merchantId = "";
    apiPassword = "";
    production= true;
    paymentData: CrediMaxPaymentRequest = {
        apiOperation: "",
        interaction: {
            operation: "",
            returnUrl: "",
            cancelUrl: "",
            timeoutUrl: "",
            merchant:{"name":""},
            displayControl:{},
            style:{}
        },
        order: {
            id: "",
            amount: "0",
            currency: "",
           description:""
        }
    }



    public async initiatePayment(invoice:Invoice,company:Company,paymentSettings:any,referenceNumber:string,eInvoice:boolean|null=null) {
        try {

            this.merchantId = paymentSettings.merchantId;
            this.apiPassword = paymentSettings.apiPassword;
            const baseUrl = eInvoice ?process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
            const urlIds = eInvoice ? company.id + '/' +  invoice.id +'/' + referenceNumber : referenceNumber

            //Payment Data 
            this.paymentData.apiOperation = "INITIATE_CHECKOUT"
            this.paymentData.interaction.operation =  "PURCHASE"  
            this.paymentData.interaction.returnUrl = baseUrl + "/payments/CrediMaxPaymentCallBack/" +urlIds
            this.paymentData.interaction.cancelUrl = baseUrl + "/payments/CrediMaxCancelCallBack/"+urlIds
            this.paymentData.interaction.timeoutUrl = baseUrl + "/payments/CrediMaxTimeoutCallBack/"+urlIds
            this.paymentData.interaction.merchant.name = company.name
            this.paymentData.interaction.displayControl={
                billingAddress:"HIDE",
                  shipping: 'HIDE',
                       customerEmail: 'HIDE',
            }
            
            this.paymentData.order.id = referenceNumber
            this.paymentData.order.amount =     invoice.toPaidAmount.toFixed(company.afterDecimal)
            this.paymentData.order.currency = company.settings.currencySymbol
            this.paymentData.order.description = company.settings.currencySymbol


            let url = `https://credimax.gateway.mastercard.com/api/rest/version/100/merchant/${this.merchantId}/session`;



            let tokenString = "merchant." + this.merchantId + ":" + this.apiPassword;
            let tokenStringBase64 = Buffer.from(tokenString).toString("base64");


            let reqConfig = {
                method: 'post',
                url: url,
                data: this.paymentData,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${tokenStringBase64}`
                }
            }

            let paymentResponse:CrediMaxPaymentResponse = (await axios(reqConfig)).data



            if (paymentResponse.result == "SUCCESS") {
                    const  config = {
                    merchant: this.merchantId,
                    session: {
                        id: paymentResponse.session.id,
                    },
                    order: {
                        amount:invoice.total,
                        currency: 'BHD',
                        description: 'Ordering goods',
                        id: referenceNumber
                    },
                    interaction: {
                        merchant: {
                            name: company.name,
                            logo: company.logo
                        },
                        locale: 'en_US',
                        theme: 'default',
                        displayControl: {
                            billingAddress: 'HIDE',
                            customerEmail: 'HIDE',
                            orderSummary: 'HIDE',
                            shipping: 'HIDE'
                        },
                    }
                }
                return new ResponseData(true, "",{sessionId:paymentResponse.session.id , onlineData:{successIndicator:paymentResponse.successIndicator} })
            } else {
                return new ResponseData(false, paymentResponse.error.explanation, [])
            }
        } catch (error: any) {
            return new ResponseData(false, "", error.message)
        }

    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}