import { ResponseData } from "@src/models/ResponseData"
import axios from "axios"

interface FatoorahExecutePaymentData {
    PaymentMethodId: string,
    CustomerName: string,
    DisplayCurrencyIso: "BHD" | "KWD"| "SAR" | "AED"| "QAR" | "OMR" | "JOD" |"EGP",
    MobileCountryCode: "+973" | "+965"| "+966" |"+971"|"+974" |"+968"|"+962"|"+20",
    CustomerMobile: string,
    CustomerEmail: string,
    InvoiceValue: Number,
    CallBackUrl: string,
    ErrorUrl: string,
    Language: string,
    CustomerReference: string,
    ExpiryDate: string,
    InvoiceItems:any[]
}

interface FatoorahExecutePaymentResponse {
    IsSuccess: boolean,
    Message: string,
    ValidationErrors: string,
    Data: {
        InvoiceId: string,
        IsDirectPayment: boolean,
        PaymentURL: string,
        CustomerReference: string
        UserDefinedField: string
        RecurringId: string
    }
}

interface FatoorahInitiatePaymentData {
    InvoiceAmount: Number,
    CurrencyIso: "BHD" | "KWD"| "SAR" | "AED"| "QAR" | "OMR" | "JOD" |"EGP"
}

interface FatoorahInitiatePaymentResponse {
    IsSuccess: boolean,
    Message: string,
    ValidationErrors: string,
    Data: {
        PaymentMethods: [] // array of pamentMethods List 
    }
}

export class FatoorahPayment {

    token = "";
    production = false;

    paymentMethodId = "" // (used on excute Payment) referes to fatoorah selected payment method

    initiatePaymentData: FatoorahInitiatePaymentData = {
        InvoiceAmount: 0,
        CurrencyIso: "BHD"
    }

    excutePaymentData: FatoorahExecutePaymentData = {
        PaymentMethodId: "",
        CustomerEmail: "",
        CustomerMobile: "",
        CustomerName: "",
        CustomerReference: "",
        DisplayCurrencyIso: "BHD",
        MobileCountryCode: "+973" ,
        InvoiceValue: 0,
        CallBackUrl: "",
        ErrorUrl: "",
        ExpiryDate: "",
        InvoiceItems: [],
        Language: ""
    }
    private getBaseUrl() {
        return this.production ? `https://api.myfatoorah.com/swagger/docs/v2` : `https://apitest.myfatoorah.com/swagger/docs/v2`
    }


    //TODO: A ROUTE TO GET PAYMNET METHOD LIST 
    public async initiatePayment() {

        try {
            let url = this.getBaseUrl() + '/InitiatePayment'
            var config = {
                method: 'post',
                url: url,
                data: JSON.stringify(this.initiatePaymentData),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            };

            let response: FatoorahInitiatePaymentResponse = (await axios(config)).data;

            if (response.IsSuccess) {
                return new ResponseData(true, "", response.Data.PaymentMethods)
            } else {
                return new ResponseData(false, "", [])
            }
        } catch (error: any) {
            return new ResponseData(false, error.message, [])
        }
    }

    public async excutePaymnet() {
        try {
            let url = this.getBaseUrl() + '/ExecutePayment'
            var config = {
                method: 'post',
                url: url,
                data: JSON.stringify(this.excutePaymentData),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            };
            let response: FatoorahExecutePaymentResponse = (await axios(config)).data;
            if (response.IsSuccess) {
                return new ResponseData(true, response.Message, response.Data.PaymentURL)
            } else {
                return new ResponseData(false, response.Message, response.ValidationErrors)
            }
        } catch (error: any) {
            return new ResponseData(false, error.message, [])
        }
    }
}