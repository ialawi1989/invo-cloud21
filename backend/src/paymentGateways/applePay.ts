import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { FileStorage } from "@src/utilts/fileStorage";
import https from 'https'
import axios from "axios";
import { Invoice } from "@src/models/account/Invoice";
import { TapPayment } from "./TapPaymnet";
import { PaymentInterFace } from "./paymentInterFace";
export class ApplePay implements PaymentInterFace {
    baseUrl() {
        return "https://api.tap.company/v2";
    }
    production = true;
    public async initiatePayment(invoice: Invoice, company: Company, paymentSettings: any, referenceNumber: string, eInvoice: boolean | null = null) {
        try {

            if (paymentSettings.settings.host === 'TapPayment') {
                let payment = new TapPayment();
                const data = await payment.validateapplepaypayment(company, paymentSettings, invoice, referenceNumber, eInvoice)
                console.warn("data in  initiatePayment Apple Pay Payment", data)
                return data
            } else {
                return new ResponseData(true, "", [])
            }
        } catch (error) {
            console.warn("Error in  initiatePayment Apple Pay Payment", error)

            throw error
        }
    }
    public static async MerchantValidation(company: Company, url: string, payment: any) {
        try {

            const fileStorage = new FileStorage();
            let files = await fileStorage.getApplePayCertandkey();
            if (files.success) {
                const httpsAgent = new https.Agent({
                    rejectUnauthorized: false, // (NOTE: this will disable client verification)
                    cert: files.data.cert,
                    key: files.data.key
                })
                let baseUrl;
                switch (process.env.NODE_ENV) {
                    case "development":
                        baseUrl = "dev.invopos.co"
                        break;

                    default:
                        baseUrl = "dev.invopos.co"
                        break;
                }
                let response = await axios.post(
                    url, {
                    merchantIdentifier: payment.paymentMethod.settings.Merchant_Identifier,
                    displayName: company.name,
                    initiative: "web",
                    initiativeContext: baseUrl
                }, {
                    httpsAgent
                }
                )
                console.warn("response in  MerchantValidation Apple Pay Payment", response.data)
                return new ResponseData(true, "", response.data)
            } else {
                console.warn("Invalid Merchant")
                return new ResponseData(false, "Invalid Merchant", [])
            }
        } catch (error: any) {
            console.warn("error in  MerchantValidation Apple Pay Payment", error)
        throw error
        }
    }



}