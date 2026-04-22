import crypto from 'node:crypto'
import axios from 'axios'
import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { Invoice } from '@src/models/account/Invoice';
interface initialiatPaymentData {
    unique_id: string,//Merchant ID 
    api_type: Number,// 1 (default value) => use api through customer registration, 2 =>   without customer registration, 3 =>customer registration & customer information only, 4 though customer login only
    amount: Number,
    action: "normal" | "background", //normal =>  Process payment data normally , background=> Process payment data in background
    callback_url: string,
    ref_code: string, //Invoice Id 
    calculated_hash: string
}

interface initialiatPaymentResponse {
    status: "success" | "failure",//"success"
    payment_id: Number,// 1 (default value) => use api through customer registration, 2 =>   without customer registration, 3 =>customer registration & customer information only, 4 though customer login only
    payment_url: Number,
    code: string,
    error: string
}

interface getPaymentData {
    payment_id: string,
    calculated_hash: string,
}

export class Gatee {

    production = true;
    merchantId = "";
    secretKey = "";
    hash = "";
    refeferenceNumber = ""
    processed = 1
    paymentData: initialiatPaymentData = {
        unique_id: "",
        api_type: 2,
        amount: 0,
        action: "background",
        callback_url: "",
        ref_code: "",
        calculated_hash: ""
    }

    getPaymentData: getPaymentData = {
        payment_id: "",
        calculated_hash: ""
    }

    private getBaseUrl() {
        return this.production ? `https://www.gate-e.com/api` : `https://www.test.gate-e.com/api`
    }
    calculateHash(hash: string, data: any) {
        try {
            var ordered = Object.keys(data).sort().reduce(
                (obj: any, key: string) => {
                    obj[key] = data[key];
                    return obj;
                }, {}
            );

            var calculatedHash = "";
            for (var key in ordered) {
                if (key != "calculated_hash")
                    calculatedHash += key + "=" + ordered[key] + ";"
            }
            calculatedHash += "hash=" + hash + ";";
            return crypto.createHash('md5').update(calculatedHash).digest("hex");
        } catch (error: any) {
            throw new Error(error)
        }

    }

    /**
     * 
     * @param url 
     * @param data 
     * @returns 
     * 
     *  is used to append data as query parameters to a given URL
     */
    dataUrl(url: any, data: any) {
        for (var key in data) {
            if (url.includes("?")) {
                url += "&" + key + "=" + encodeURIComponent(data[key]);
            } else {
                url += "?" + key + "=" + encodeURIComponent(data[key]);
            }
        }
        return url;
    }


    public async initiatePayment(invoice: Invoice, company: Company, paymentSettings: any, referenceNumber: string, eInvoice: boolean | null = null) {
        try {
             if (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'local') {
                this.production = false;
            }

            let url = this.getBaseUrl() + "/process.php"

            const baseUrl = eInvoice ? process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
            const urlIds = eInvoice ? company.id + '/' + invoice.id + '/' + referenceNumber : referenceNumber
            this.hash = paymentSettings.secretKey
            this.paymentData.amount =      invoice.toPaidAmount;
            this.paymentData.unique_id = paymentSettings.merchantId;
            this.paymentData.callback_url = baseUrl + "/payments/GateeCallBack/" + urlIds
            this.paymentData.calculated_hash = this.calculateHash(this.hash, this.paymentData)


            url = this.dataUrl(url, this.paymentData)
            let config = {
                method: 'post',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            let response: initialiatPaymentResponse = (await axios(config)).data;

            if (response.status == "success") {
                return new ResponseData(true, "", { url: response.payment_url, payment_id: response.payment_id, hash: this.hash })

            } else {
                return new ResponseData(false, response.code + ": " + response.error, [])

            }

        } catch (error: any) {

            throw new Error(error)
        }
    }

    async checkPaymentstatus() {
        try {
            if (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'local') {
                this.production = false;
            }
            let url = this.getBaseUrl() + "/getpayment.php"
            url += "?unique_id=" + this.merchantId + "&hash=" + this.hash + "&payment_id=" + this.refeferenceNumber;
            let config = {
                method: 'post',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            let response = (await axios(config)).data;

            if (response.status == "completed") {
                return new ResponseData(true, "", { onlineData: response })

            } else {
                return new ResponseData(false, "", { onlineData: response })

            }
        } catch (error: any) {
            throw new Error(error)
        }
    }


    async updatePayment() {


        try {
            if (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'local') {
                this.production = false;
            }
            var url = this.getBaseUrl() + "/updatepayment.php";
            url += "?unique_id=" + this.merchantId + "&hash=" + this.hash + "&payment_id=" + this.refeferenceNumber + "&processed=" + this.processed;
            var config = {
                method: 'post',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            var res = await axios(config);
            var data = res.data;
            if (data.status == "success") {
                return new ResponseData(true, "", { data: data })
            } else {
                return new ResponseData(false, "", { data: data })
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
}