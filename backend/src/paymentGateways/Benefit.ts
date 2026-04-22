
import { ResponseData } from '@src/models/ResponseData';
import { Invoice } from '@src/models/account/Invoice';
import aesjs from 'aes-js'
import axios from "axios"
import { PaymentInterFace } from './paymentInterFace';
import { Company } from '@src/models/admin/company';

//trandData of request  
interface BenefitRequest {
    id: string | null, // Merchant Identifier issued by gateway
    password: string | null,  // Merchant Password issued by gateway
    action: string | null,  // 1 -> auth, 4 -> Purchase
    amt: number,  // Order Amount
    currencycode: string | null,
    trackid: string | null,  // ORDER ID
    udf1: string | null,
    udf2: string | null,
    udf3: string | null,
    udf4: string | null,
    udf5: string | null,
    expYear: string | null,
    expMonth: string | null,
    member: string | null,
    cardNo: string | null,
    cardType: string | null,
    paymentData: string | null,
    paymentMethod: string | null,
    transactionIdentifier: string | null,
    transId: string | null,
    pin: string | null,
    ticketNo: string | null,
    bookingId: string | null,
    transactionDate: string | null,
    responseURL: string | null, // POST URL IN CASE OF SUCCESS
    errorURL: string | null, // POST URL IN CASE OF ERROR
}

// response.body.trandata
// this response is posted to the provided url in responseURL  on request 
interface BenefitTrandataResponse {
    paymentid: string | null;
    result: string | null;
    auth: string | null;
    amt: number;
    trackid: string | null;//Order id 
    error: string | null;
    udf1: string | null;
    udf2: string | null;
    udf3: string | null;
    udf4: string | null;
    udf5: string | null;
}

//when initializing payment 
interface BenefitResponse {
    status: string;// 1 => success , 2=> failuer 
    result: string;
    ID: string;// paymnet page url 
    error: string;// null when success
    errorText: string;// null when success
}

export class Benefit implements PaymentInterFace {

    production = true; /** in local and testing change to false */
    paymentData: BenefitRequest = {
        id: null,//transportalID
        password: null,//transportalPass
        action: null,
        amt: 0,
        currencycode: "048",
        trackid: null,
        udf1: null,
        udf2: null,
        udf3: null,
        udf4: null,
        udf5: null,
        responseURL: null,
        errorURL: null,
        expYear: null,
        expMonth: null,
        member: null,
        cardNo: null,
        cardType: null,
        paymentData: null,
        paymentMethod: null,
        transactionIdentifier: null,
        transId: null,
        pin: null,
        ticketNo: null,
        bookingId: null,
        transactionDate: null,
    }

    transportalID = "";
    transportalPass = "";
    terminalResourseKey = "";

    invoice = new Invoice();


    getBaseUrl() {
        return "https://www.benefit-gateway.bh/payment/API/hosted.htm"
    }


    private aesEncrypt(trandata: any, key: any) {
        var iv = "PGKEYENCDECIVSPC";
        var rkEncryptionIv = aesjs.utils.utf8.toBytes(iv);
        var enckey = aesjs.utils.utf8.toBytes(key);
        var aesCtr = new aesjs.ModeOfOperation.cbc(enckey, rkEncryptionIv);
        var textBytes = aesjs.utils.utf8.toBytes(trandata);
        var encryptedBytes = aesCtr.encrypt(aesjs.padding.pkcs7.pad(textBytes));
        var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
        return encryptedHex;
    }

    private AESdecryption(encryptedHex: any, key: any) {
        var iv = "PGKEYENCDECIVSPC";
        var enckey = aesjs.utils.utf8.toBytes(key);
        var rkEncryptionIv = aesjs.utils.utf8.toBytes(iv);
        var encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
        var aesCbc = new aesjs.ModeOfOperation.cbc(enckey, rkEncryptionIv);
        var decryptedBytes = aesCbc.decrypt(encryptedBytes);
        var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
        return decryptedText;
    }


    public async initiatePayment(invoice: Invoice, company: Company, paymentSettings: any,referenceNumber:string,eInvoice:boolean|null = null) {
        try {


            this.terminalResourseKey = paymentSettings.terminalResourseKey
            this.transportalID = paymentSettings.transportalID
            this.transportalPass = paymentSettings.transportalPass
            const baseUrl = eInvoice ?process.env.APP_BASE_URL + '/eInvoice' : process.env.BASE_URL + "/ecommerce/" + company.slug;
            const urlIds = eInvoice ? company.id + '/' +  invoice.id +'/' + referenceNumber : referenceNumber
            //Payment Data 
            this.paymentData.action = "1";
            this.paymentData.amt =     invoice.toPaidAmount;
            this.paymentData.currencycode = "048";
            this.paymentData.trackid = referenceNumber;
            this.paymentData.errorURL = baseUrl+ "/payments/BenefitCallBack/"+urlIds
            this.paymentData.responseURL = baseUrl + "/payments/BenefitCallBack/"+urlIds
            this.paymentData.id = this.transportalID;
            this.paymentData.password = this.transportalPass;



            let paymentData: any = this.paymentData
            for (var propName in paymentData) {
                if (paymentData[propName] == null || paymentData[propName] == undefined) {
                    delete paymentData[propName];
                }
            }

            let encryptData = this.aesEncrypt(JSON.stringify([paymentData]), this.terminalResourseKey)


            let data = [{
                id: this.transportalID,
                trandata: encryptData
            }]

            let reqConfig = {
                method: 'post',
                url: this.getBaseUrl(),
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
            let paymentResponse = (await axios(reqConfig)).data[0]

            if (paymentResponse.status == "1") {
                const urlParams = paymentResponse.result
                return new ResponseData(true, "", { url: urlParams })
            } else {
                return new ResponseData(false, paymentResponse.error + " " + paymentResponse.errorText, [])
            }
        } catch (error: any) {
            
            throw new Error(error)
        }
    }

    public getDecryptedData(data: any) {
        let decryptedData = this.AESdecryption(data, this.terminalResourseKey);
      let  cleanData = decodeURIComponent(decryptedData);
 
      cleanData = cleanData.substring(0, cleanData.indexOf(']') + 1);
      cleanData = JSON.parse(cleanData);
        return cleanData
    }

}