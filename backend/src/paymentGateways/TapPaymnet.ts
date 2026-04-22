
import { ResponseData } from '@src/models/ResponseData'
import axios from 'axios'
import { PaymentInterFace } from './paymentInterFace'
import { Invoice } from '@src/models/account/Invoice'
import { Company } from '@src/models/admin/company'
import { Helper } from '@src/utilts/helper'
interface TapPaymentData {
    amount: Number,
    currency: string,
    reference: { order: string },
    redirect: { url: string },
    post: { url: string },
    customer: {
        first_name: string,
        email: string,
        phone: {
            country_code: string | null,
            number: string | null
        }
    }
    source: { id: string }

}

export class TapPayment implements PaymentInterFace {
    secretKey = ""
    production = true;
    paymentData: TapPaymentData = {
        amount: 0,
        currency: "BHD",
        reference: { order: "" },
        redirect: { url: "" },
        post: { url: "" },
        customer: {
            first_name: "",
            email: "",
            phone: {
                country_code: "",
                number: ""
            }
        },
        source: { id: "" }
    }

    chargeId: string = "" // used to get charge 

    baseUrl() {
        return 'https://api.tap.company/v2'
    }
    async initiatePayment(invoice: Invoice, company: Company, paymentSettings: any, referenceNumber: string, eInvoice: boolean | null = null) {
        try {

            this.secretKey = paymentSettings.secretKey;
            const baseUrl = eInvoice ? process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
            const urlIds = eInvoice ? company.id + '/' + invoice.id + '/' + referenceNumber : referenceNumber

            this.paymentData.amount = invoice.toPaidAmount;
            this.paymentData.reference.order = referenceNumber;
            this.paymentData.redirect.url = baseUrl + "/payments/tapPaymentResponse/" + urlIds
            this.paymentData.customer.phone.country_code = invoice.countryCode ?? Helper.getCountryCode(invoice.customerContact ?? invoice.customerPhone);
            this.paymentData.customer.phone.number = invoice.customerContact && this.paymentData.customer.phone.country_code ? invoice.customerContact.startsWith(this.paymentData.customer.phone.country_code)
                ? invoice.customerContact.slice(this.paymentData.customer.phone.country_code.length)
                : invoice.customerContact : invoice.customerPhone;
            this.paymentData.customer.email = " ";
            this.paymentData.customer.first_name = invoice.customerName
            this.paymentData.source.id = "src_all"



            let url = `${this.baseUrl()}/charges`;
            let config = {
                method: 'post',
                url: url,
                data: this.paymentData,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.secretKey}`
                }
            };

            let response = (await axios(config)).data;
            if (response.status == "INITIATED") {

                return new ResponseData(true, "", { url: response.transaction.url, referenceId: response.id })

            } else {
                return new ResponseData(false, response.response.code + ": " + response.response.message, [])


            }
        } catch (error: any) {
            console.log(error)
            return new ResponseData(false, error.message, [])

        }
    }

    async checkPaymentstatus() {
        try {

            let url = `${this.baseUrl()}/charges/` + this.chargeId;
            let config = {
                method: 'get',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.secretKey}`
                }
            };

            let response = (await axios(config)).data;
            if (response.status == "CAPTURED") {

                return new ResponseData(true, "", response.data)

            } else {
                return new ResponseData(false, response.response.code + ": " + response.response.message, [])


            }
        } catch (error: any) {
            console.log(error)
            return new ResponseData(false, error.message, [])

        }
    }


    async validateapplepaypayment(company: Company, payment: any, invoice: Invoice, referenceNumber: string, eInvoice: boolean | null = false) {
        try {

            if (!invoice.applePayTokendata?.data) {
                return new ResponseData(false, "Apple Pay token missing", []);
            }

            const tokenRes = await axios.post(
                "https://api.tap.company/v2/tokens",
                {
                    type: "applepay",
                    token_data: invoice.applePayTokendata
                },
                {
                    headers: {
                        Authorization: `Bearer ${payment.settings.appleSecretKey}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            if (!tokenRes.data?.id) {
                return new ResponseData(false, "Token not created", tokenRes.data);
            }

            return this.chargeApplePayPayment(
                invoice,
                company,
                payment,
                tokenRes.data.id,
                referenceNumber,
                eInvoice
            );
        } catch (error: any) {
            return new ResponseData(false, error.message, [])
        }
    }

    async chargeApplePayPayment(invoice: Invoice, company: Company, paymentData: any, token: string, referenceNumber: string, eInvoice: boolean | null = false) {
        try {
            let customer_number = invoice.customerContact;
            if (customer_number.startsWith("+")) {
                customer_number = customer_number = customer_number.replace(/^\+\d{1,3}/, '')
            }

            const baseUrl = eInvoice ? process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
            const urlIds = eInvoice ? company.id + '/' + invoice.id + '/' + referenceNumber : referenceNumber


            let data = {
                "amount": invoice.toPaidAmount,
                "currency": company.settings.currencyCode,
                "threeDSecure": true,
                "save_card": false,
                "reference": {
                    "transaction": invoice.id,
                    "order": invoice.id
                },
                "receipt": {
                    "email": false,
                    "sms": false
                },
                "customer": {
                    "first_name": invoice.customerName,
                    "middle_name": " ",
                    "last_name": invoice.customer.email,
                    "email": " ",
                    "phone": {
                        "country_code": company.settings.countryCode,
                        "number": customer_number
                    }
                },
                "source": {
                    "id": token
                },
                "redirect": {
                    "url": baseUrl + "/payments/tapPaymentResponse/" + urlIds
                },
                "post": {
                    "url": baseUrl + "/payments/tapPaymentResponse/" + urlIds
                }

            }

            let chargeres = await await axios.post(
                "https://api.tap.company/v2/tokens",
                data,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${paymentData.settings.applesecretKey}`
                    }
                }
            );
            if (chargeres.data.status == "CAPTURED") {
                return new ResponseData(true, "", { referenceId: chargeres.data.id })

            } else {
                return new ResponseData(false, "", { olineData: chargeres.data })
            }
        } catch (error: any) {
            return new ResponseData(false, error.message, [])
        }

    }
}