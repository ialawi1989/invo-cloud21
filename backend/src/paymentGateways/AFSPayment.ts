import { ResponseData } from "@src/models/ResponseData";
import { Invoice } from "@src/models/account/Invoice";
import { Company } from "@src/models/admin/company";
import axios from "axios"
import {PaymentInterFace} from "./paymentInterFace"
interface AFSPaymentRequest {
    apiOperation: string; // INITIATE_CHECKOUT
    interaction: {
        operation: string; // PURCHASE (for both testing and production)
        returnUrl: string;
        cancelUrl: string;
        timeoutUrl: string;
    };
    order: {
        id: string;
        amount: number;
        currency: string;
    };
}
interface AFSPaymentResponse {
    merchant: string; // The unique identifier issued to you by your payment provider
    result: "FAILURE" | "PENDING" | "SUCCESS" | "UNKNOWN";
    successIndicator: any; // for successful payments only.
    session: any; // session.id is used for hosted.checkout()
    error: any;
}

export  class AFSPayment  implements PaymentInterFace{
    merchantId = "";
    apiPassword = "";
    production = true;
    paymentData: AFSPaymentRequest = {
        apiOperation: "",
        interaction: {
            operation: "",
            returnUrl: "",
            cancelUrl: "",
            timeoutUrl: ""
        },
        order: {
            id: "",
            amount: 0,
            currency: ""

        }
    }

    config = {
        merchant: "",
        session: {
            id: "",
        },
        order: {
            amount: 0,
            currency: 'BHD',
            description: 'Ordering goods',
            id: ""
        },
        interaction: {
            merchant: {
                name: "",
                logo: ""
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



    public async initiatePayment(invoice:Invoice,company:Company,paymentSettings:any,referenceNumber:string,eInvoice:boolean|null = null) {
        try {

            this.merchantId = paymentSettings.merchantId;
            this.apiPassword = paymentSettings.apiPassword;
            const baseUrl = eInvoice ?process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
            const urlIds = eInvoice ? company.id + '/' +  invoice.id +'/' + referenceNumber : referenceNumber
            //Payment Data
            this.production = this.merchantId.toLocaleLowerCase().startsWith('test') ? false:true 
            this.paymentData.apiOperation = "CREATE_CHECKOUT_SESSION"
            this.paymentData.interaction.operation = this.production ? "PURCHASE" : "AUTHORIZE"   

            this.paymentData.interaction.returnUrl = baseUrl+ "/payments/AFSPaymentCallBack/" +urlIds
            this.paymentData.interaction.cancelUrl = baseUrl+ "/payments/AFSCancelCallBack/"+urlIds
            this.paymentData.interaction.timeoutUrl = baseUrl+ "/payments/AFStimeoutCallBack/"+urlIds
            this.paymentData.order.id = referenceNumber
            this.paymentData.order.amount =      invoice.toPaidAmount
            this.paymentData.order.currency = "BHD"
 

            let url = `https://afs.gateway.mastercard.com/api/rest/version/60/merchant/${this.merchantId}/session`;



            let tokenString = "merchant." + this.merchantId + ":" + this.apiPassword;
       
            let tokenStringBase64 = Buffer.from(tokenString).toString("base64");

            let reqConfig = {
                method: 'post',
                url: url,
                data: JSON.stringify(this.paymentData),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${tokenStringBase64}`
                }
            }

            let paymentResponse: AFSPaymentResponse = (await axios(reqConfig)).data
            
    
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
                return new ResponseData(true, "",   {config:config , onlineData:{successIndicator:paymentResponse.successIndicator}})
            } else {
                return new ResponseData(false, paymentResponse.error.explanation, [])
            }
        } catch (error: any) {
            console.log(error)
            return new ResponseData(false, "", error.code)
        }

    }

  
}