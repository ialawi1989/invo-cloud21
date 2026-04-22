import { ResponseData } from "@src/models/ResponseData";
import { Invoice } from "@src/models/account/Invoice";
import { Company } from "@src/models/admin/company";
import { AFSPayment } from "@src/paymentGateways/AFSPayment";
import { Benefit } from "@src/paymentGateways/Benefit";
import { BenefitPay } from "@src/paymentGateways/BenefitPay";
import { CrediMaxPayment } from "@src/paymentGateways/CrediMax";
import { InvoicePaymentRepo } from "../app/accounts/invoicePayment.repo";
import { InvoicePayment } from "@src/models/account/InvoicePayment";
import { InvoicePaymentLine } from "@src/models/account/InvoicePaymentLine";
import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo";

import { ThawaniPayment } from "@src/paymentGateways/Thawani";
import { PoolClient } from "pg";
import { DB } from "@src/dbconnection/dbconnection";
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { SocketInvoiceRepo } from "../socket/invoice.socket";
import { PaymentInterFace } from "@src/paymentGateways/paymentInterFace";
import { CartRepo } from "./cart.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";

import { Helper } from "@src/utilts/helper";
import { TapPayment } from "@src/paymentGateways/TapPaymnet";
import { Gatee } from "@src/paymentGateways/Gatee";
import { TriggerQueue } from "../triggers/triggerQueue";
import { Payment } from "@src/models/ecommerce/cart";
import { InvoiceStatuesQueue } from "../triggers/queue/workers/invoiceStatus.worker";
import { CompanyRepo } from "../admin/company.repo";
import { PromotionsPointsProvider } from "@src/routes/v1/promotions/promotions-point/promotions-point.business";
import { CouponProvider } from "@src/routes/v1/promotions/coupon/coupon.business";
import { jobStatus } from "@src/controller/app/jobs/viewJobs";
import { ApplePay } from "@src/paymentGateways/applePay";


export class PaymentRepo {

    public static async getPaymentMethods(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT id, name,"translation", "settings"->>'icon' as "icon" ,"isEnabled", 
                              case when "name" = 'ApplePay' then JSON_BUILD_OBJECT('Merchant_Identifier', "settings"->>'Merchant_Identifier') else null end as "settings"
                from "PaymentMethods" where "companyId"=$1 and ("PaymentMethods".settings is not null or "PaymentMethods".settings != '{}') and "isEnabled" = true and (("settings" ->>'type')::text <> 'ecr' or  ("settings" ->>'type')::text is null ) `,
                values: [companyId]
            }

            let methods = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", methods.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }



    public static async PublicgetPaymentMethods(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `     
                    SELECT id, name,"translation", "settings"->>'icon' as "icon" ,"isEnabled"  from "PaymentMethods" where name != 'BenefitPay' and name != 'afs' and name != 'CrediMax' and "companyId"=$1 and ("PaymentMethods".settings is not null or "PaymentMethods".settings != '{}') and "isEnabled" = true and (("settings" ->>'type')::text <> 'ecr' or  ("settings" ->>'type')::text is null )`,
                values: [companyId]
            }

            let methods = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", methods.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getCompanyNameAndIcon(client: PoolClient, companyId: string) {
        try {
            const query = {
                text: `SELECT "Companies".name, "Media".url->>'defaultUrl'as "mediaUrl" from "Companies"
                left join "Media" ON "Media".id = "Companies"."mediaId" 
         where  "Companies".id=$1`,
                values: [companyId]
            }

            let data = await client.query(query.text, query.values);
            if (data.rows && data.rows.length > 0) {
                return { name: data.rows[0].name, mediaUrl: data.rows[0].mediaUrl }
            }
            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addPayments(client: PoolClient, paymentData: any, invoice: Invoice, company: Company, enInvoice: boolean = false) {
        try {

            let companyData = await this.getCompanyNameAndIcon(client, company.id);

            if (companyData) {
                company.name = companyData.name;
                company.logo = companyData.mediaUrl
            }
            let payment = new InvoicePayment();
            let paymentLine = new InvoicePaymentLine();
            let paymentName = paymentData.name;
            payment.tenderAmount = invoice.total;
            payment.branchId = invoice.branchId;
            payment.paymentMethodId = paymentData.id;
            payment.status = "PENDING"
            payment.paymentMethodAccountId = paymentData.accountId
            paymentLine.invoiceId = invoice.id;
            paymentLine.amount = invoice.total - (invoice.pointsDiscount ?? 0);

            invoice.toPaidAmount = paymentLine.amount;
            payment.lines.push(paymentLine)
            let paymentResponse;


            let selectedPayment: PaymentInterFace;
            let paymentSettings = paymentData.settings;


            switch (paymentName) {
                case "afs":
                    selectedPayment = new AFSPayment();
                    break;
                case "Benefit":
                    selectedPayment = new Benefit();
                    break;
                case "BenefitPay":
                    selectedPayment = new BenefitPay();
                    break;
                case "CrediMax":
                    selectedPayment = new CrediMaxPayment();
                    break;
                case "TapPayment":
                    selectedPayment = new TapPayment();
                    break;
                case "Gatee":
                    selectedPayment = new Gatee();
                    break;
                case "ApplePay":
                    selectedPayment = new ApplePay();
                    break;

                // case "Fatoorah":
                //     break;
                // case "Hesabe":
                //     break;
                // case "MaxWallet":
                //     break;
                case "ThawaniPayment":
                    selectedPayment = new ThawaniPayment();
                    // paymentResponse = await selectedPayment.initiatePayment(invoice, company, paymentSettings);

                    break;
                default:
                    selectedPayment = new Benefit();
                    break;
            }
            let referenceNumber = Helper.createGuid();

            paymentResponse = await selectedPayment.initiatePayment(invoice, company, paymentSettings, referenceNumber, enInvoice)

            if (paymentName == 'TapPayment' || (paymentName == 'ApplePay' && paymentSettings.settings.host == 'TapPayment')) {
                payment.onlineData = { chargeId: paymentResponse.data.referenceId }
            }

            if (paymentName == 'Gatee') {
                payment.onlineData = paymentResponse.data
            }

            if (paymentResponse?.success) {
                if (paymentResponse.data.referenceId != null && paymentResponse.data.referenceId) {
                    payment.referenceId = paymentResponse.data.referenceId
                }

                if (paymentResponse.data.onlineData != null && paymentResponse.data.onlineData) {
                    payment.onlineData = paymentResponse.data.onlineData
                }
                payment.referenceNumber = referenceNumber;

                let paymentData = await InvoicePaymentRepo.addInvoicePayment(client, payment, company)
                return new ResponseData(true, "", paymentResponse.data)
            } else {
                throw new Error(paymentResponse?.msg)
            }



        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async addPointsPayments(
        client: PoolClient,
        paymentData: any,
        invoice: Invoice,
        company: Company,
        enInvoice: boolean = false
    ) {
        try {
            if (invoice.pointsDiscount) {



                let payment = new InvoicePayment();
                let paymentLine = new InvoicePaymentLine();

                payment.tenderAmount = invoice.pointsDiscount;
                payment.branchId = invoice.branchId;
                payment.paymentMethodId = paymentData.id;
                payment.status = "Success";
                payment.paymentMethodAccountId = paymentData.accountId;
                paymentLine.invoiceId = invoice.id;
                paymentLine.amount = invoice.pointsDiscount;
                payment.lines.push(paymentLine);

                let savePayment = await InvoicePaymentRepo.addInvoicePayment(
                    client,
                    payment,
                    company
                );
            }
            return new ResponseData(true, "", []);

        } catch (error: any) {
            console.log(error);
          
            throw new Error(error);
        }
    }

    public static async AFSPaymentCallBack(referenceNumber: string, data: any, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")

  
            let paymentData = await this.getPaymentByReferenceId(client, referenceNumber);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);

            if (data && payment.onlineData.successIndicator === data && payment.lines[0].invoiceId) {
                payment.status = 'SUCCESS'
                await this.updatePaymentData(client, payment, company)
                await this.saveAndSendInvoice(client, payment.lines[0].invoiceId, payment, company)
            } else {
                payment.status = 'FAILD'
                await this.updatePaymentData(client, payment, company)
            }
            if (payment.status == 'SUCCESS' && payment && payment.lines.length > 0 && payment.lines[0].invoiceId) {
                let queueInstance = TriggerQueue.getInstance();

                queueInstance.createJob({ type: "InvoicePayments", invoiceIds: payment.lines[0].invoiceId, id: [payment.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [payment.lines[0].invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: payment.lines[0].invoiceId
                } as any);
            }
            await client.query("COMMIT")

        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async AFSCancelCallBack(invoiceId: string, data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
    

            let paymentData = await this.getPaymentByReferenceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            payment.onlineData = data ?? 'Cancel Payment';
            payment.status = "FAILD"

            await this.updatePaymentData(client, payment, company)
            await client.query("COMMIT")
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async AFSTimeoutCallBack(invoiceId: string, data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")


            let paymentData = await this.getPaymentByReferenceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            payment.onlineData = data ?? 'Time Out  Payment';
            payment.status = "FAILD"

            await this.updatePaymentData(client, payment, company)
            await client.query("COMMIT")
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async CrediMaxPaymentCallBack(referenceId: string, data: any, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")


            let paymentData = await this.getPaymentByReferenceId(client, referenceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            const invoiceId = payment.lines[0].invoiceId
            if (payment.onlineData.successIndicator == data.resultIndicator && invoiceId) {
                payment.status = 'SUCCESS'
                await this.updatePaymentData(client, payment, company)
                await this.saveAndSendInvoice(client, invoiceId, payment, company)

            }

            await client.query("COMMIT")
            if (payment.status == 'SUCCESS') {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoiceId, id: [payment.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoiceId
                } as any);
            }
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async CrediMaxCancelCallBack(invoiceId: string, data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let paymentData = await this.getPaymentByReferenceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            payment.onlineData = data ?? 'FAILD PAYMENT';
            payment.status = "FAILD"

            await this.updatePaymentData(client, payment, company)
            await client.query("COMMIT")
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async CrediMaxTimeoutCallBack(invoiceId: string, data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let paymentData = await this.getPaymentByReferenceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            payment.onlineData = data ?? 'FAILD PAYMENT';
            payment.status = "FAILD"

            await this.updatePaymentData(client, payment, company)
            await client.query("COMMIT")
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async BenefitCallBack(data: any, company: Company, referenceId: string) {
        const client = await DB.excu.client()
        try {

            let errorMsg = "";
            let invoiceId = data.trackid;

            let paymentData = await this.getPaymentByReferenceId(client, referenceId);
            let pamentOnlineData;
            await client.query("BEGIN")
            if ('trandata' in data) {

                var BenefitSettings = await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, 'Benefit');
                let paymentMethod = new Benefit();
                paymentMethod.transportalID = BenefitSettings.data.paymentMethod.settings.transportalID;
                paymentMethod.transportalPass = BenefitSettings.data.paymentMethod.settings.transportalPass;
                paymentMethod.terminalResourseKey = BenefitSettings.data.paymentMethod.settings.terminalResourseKey;
                let trandata: any = paymentMethod.getDecryptedData(data.trandata);
                trandata = trandata[0];
                pamentOnlineData = trandata;
                if (trandata.result == "CAPTURED") {



                    let payment = new InvoicePayment();
                    payment.ParseJson(paymentData);
                    let invoiceId: any = payment.lines[0].invoiceId
                    payment.status = 'SUCCESS'
                    await this.updatePaymentData(client, payment, company)
                    await this.saveAndSendInvoice(client, invoiceId, payment, company)

                } else if (data.result == "NOT+CAPTURED") {
                    switch (data.authRespCode) {
                        case "05":
                            errorMsg = "Please contact issuer";
                            break;
                        case "14":
                            errorMsg = "Invalid card number";
                            break;
                        case "33":
                            errorMsg = "Expired card";
                            break;
                        case "36":
                            errorMsg = "Restricted card";
                            break;
                        case "38":
                            errorMsg = "Allowable PIN tries exceeded";
                            break;
                        case "51":
                            errorMsg = "Insufficient funds";
                            break;
                        case "54":
                            errorMsg = "Expired card";
                            break;
                        case "55":
                            errorMsg = "Incorrect PIN";
                            break;
                        case "61":
                            errorMsg = "Exceeds withdrawal amount limit";
                            break;
                        case "62":
                            errorMsg = "Restricted Card";
                            break;
                        case "65":
                            errorMsg = "Exceeds withdrawal frequency limit";
                            break;
                        case "75":
                            errorMsg = "Allowable number PIN tries exceeded";
                            break;
                        case "76":
                            errorMsg = "Ineligible account";
                            break;
                        case "78":
                            errorMsg = "Refer to Issuer";
                            break;
                        case "91":
                            errorMsg = "Issuer is inoperative";
                            break;
                        default:
                            // for unlisted values, please generate a proper user-friendly message
                            errorMsg = "Unable to process transaction temporarily. Try again later or try using another card.";
                            break;
                    }
                } else if (data.result == "CANCELED") {
                    errorMsg = "Transaction was canceled by user.";
                } else if (data.result == "DENIED+BY+RISK") {
                    errorMsg = "Maximum number of transactions has exceeded the daily limit.";
                } else if (data.result == "HOST+TIMEOUT") {
                    errorMsg = "Unable to process transaction temporarily. Try again later.";
                } else {
                    errorMsg = "Unable to process transaction temporarily. Try again later or try using another card.";
                }



            } else if ('ErrorText' in data) {
                errorMsg = data.ErrorText
            } else {
                errorMsg = `Unknown Exception`
            }
            // await this.failedPayment(client,invoiceId,errorMsg)
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            //TODO:
            /** delete payment */

            payment.status = errorMsg != "" && errorMsg != null ? 'FAILD' : 'SUCCESS'

            payment.onlineData = pamentOnlineData ?? { error: errorMsg };
            await this.updatePaymentData(client, payment, company);

            await client.query("COMMIT")

            if (payment.status == 'SUCCESS') {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoiceId, id: [payment.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoiceId
                } as any);
            }
            if (errorMsg != "" && errorMsg != null) {
                return new ResponseData(false, errorMsg, [])

            } else {
                return new ResponseData(true, errorMsg, [])

            }

        } catch (error: any) {
            console.log(error)
          

            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }




    public static async ThawaniSuccessResponse(invoiceId: string, data: any, company: Company, sessionId: string) {
        const client = await DB.excu.client()
        try {
            //TODO:ADD CHECK STATUS

            await client.query("BEGIN")

            let paymentData = await this.getPaymentByReferenceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);

            await this.updatePaymentStatus(client, payment.id, 'SUCCESS', payment.onlineData, null, company)
            await this.saveAndSendInvoice(client, invoiceId, payment, company)
            await client.query("COMMIT")

            let cart = await CartRepo.getRedisCart(company.id, sessionId)
            cart?.resetInvoice();
            if (payment.status == 'SUCCESS') {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoiceId, id: [payment.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoiceId
                } as any);
            }
            return new ResponseData(true, "", [])

        } catch (error: any) {
            console.log(error);
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async ThawaniCancelResponse(invoiceId: string, data: any, company: Company, sessionId: string) {
        const client = await DB.excu.client()
        try {
            //TODO:ADD CHECK STATUS

            await client.query("BEGIN")

            let paymentData = await this.getPaymentByReferenceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            //TODO:
            /** delete payment */
            await this.updatePaymentStatus(client, payment.id, 'FAILD', payment.onlineData ?? 'FAILD PAYMENT THAWANI', null, company)

            // await this.saveAndSendInvoice(client, invoiceId, payment, company)
            await client.query("COMMIT")

            // let cart = await CartRepo.getRedisCart(company.id, sessionId)

            // cart?.resetInvoice();


            return new ResponseData(true, "", [])

        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async updatePaymentStatus(client: PoolClient | null, paymentId: string, status: string, onlineData: any,
        invoiceId: string | null,
        company: Company) {
        try {


            const query: { text: string, values: any } = {
                text: `UPDATE  "InvoicePayments" SET status=$1 , "onlineData" =$2 where id =$3`,
                values: [status, onlineData, paymentId]
            }
            if (client) {
                if (status == 'FAILD' && invoiceId) {
                    await this.refundPoints(client, invoiceId, company);
                    await this.reActiveCoupon(client, invoiceId, company);
                }
                await client.query(query.text, query.values)
            } else {
                await DB.excu.query(query.text, query.values)
            }

        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }


    // public static async FatoorahPaymentSettings(invoice: Invoice, paymentData: any, company: Company) {
    //     try {
    //         let paymentMethod = new FatoorahPayment();

    //         let patmentSettings = paymentData.settings
    //         paymentMethod.token = patmentSettings.token // from payment Setting 

    //         //Payment Data
    //         paymentMethod.excutePaymentData.CallBackUrl = process.env.BASE_URL + "/ecommerce/" + company.slug + "/payments/FatoorahCallBack"
    //         paymentMethod.excutePaymentData.ErrorUrl = process.env.BASE_URL + "/ecommerce/" + company.slug + "/payments/FatoorahErrorCallBack"
    //         paymentMethod.excutePaymentData.ExpiryDate = ""
    //         paymentMethod.excutePaymentData.InvoiceItems = invoice.lines;
    //         paymentMethod.excutePaymentData.InvoiceValue = invoice.total;
    //         paymentMethod.excutePaymentData.CustomerMobile = invoice.customerContact;
    //         paymentMethod.excutePaymentData.CustomerName = invoice.customer.name;
    //         paymentMethod.excutePaymentData.DisplayCurrencyIso = company.settings.currencySymbol
    //         paymentMethod.excutePaymentData.MobileCountryCode = company.settings.contryCode

    //         return await paymentMethod.excutePaymnet();
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }
    // public static async getFatoorahPaymentMethodList(invoiceTotal: Number, paymentData: any, company: Company) {
    //     try {
    //         let paymentMethod = new FatoorahPayment();
    //         let patmentSettings = paymentData.settings
    //         paymentMethod.token = patmentSettings.token  // from payment Setting 

    //         //Payment Data
    //         paymentMethod.initiatePaymentData.InvoiceAmount = invoiceTotal;
    //         paymentMethod.initiatePaymentData.CurrencyIso = company.settings.currencySymbol


    //         return await paymentMethod.initiatePayment();
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }
    // public static async HesabePaymentSettings(invoice: Invoice, paymentData: any, company: Company) {
    //     try {
    //         let paymentMethod = new Hesabe();
    //         let paymentSettings = paymentData.settings;

    //         paymentMethod.accessCode = paymentSettings.accessCode
    //         paymentMethod.ivKey = paymentSettings.ivKey
    //         paymentMethod.merchantId = paymentSettings.merchantId
    //         paymentMethod.secret = paymentSettings.secret


    //         paymentMethod.paymentData.amount = invoice.total;
    //         paymentMethod.paymentData.currency = company.settings.currencySymbol;
    //         paymentMethod.paymentData.failureUrl = process.env.BASE_URL + "/ecommerce/" + company.slug + "/payments/HesabeFailCallBack"
    //         paymentMethod.paymentData.responseUrl = process.env.BASE_URL + "/ecommerce/" + company.slug + "/payments/HesabeCallBack"
    //         paymentMethod.paymentData.paymentType = 0;//Payment Type 0, 1 or 2; 0 - Indirect, 1 - Knet, 2 - MPGS
    //         paymentMethod.paymentData.merchantCode = paymentMethod.merchantId;
    //         paymentMethod.paymentData.orderReferenceNumber = invoice.id;
    //         paymentMethod.paymentData.mobile_number = invoice.customerContact;


    //         return await paymentMethod.checkOut();
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }
    // public static async MaxWalletSettings(invoice: Invoice, paymentData: any, company: Company) {
    //     try {
    //         let paymentMethod = new MaxWallet();
    //         //Payment Settings
    //         let paymentSettings = paymentData.settings
    //         paymentMethod.appId = paymentSettings.appId
    //         paymentMethod.merchantId = paymentSettings.merchantId
    //         paymentMethod.secretKey = paymentSettings.secretKey

    //         //Payment Data
    //         paymentMethod.transactionAmount = invoice.total;
    //         paymentMethod.transactionCurrency = company.settings.currencySymbol;
    //         paymentMethod.showResult = "1"
    //         paymentMethod.referenceNumber = invoice.id;
    //         paymentMethod.setSecureHashString();

    //         let data = paymentMethod.getPaymentData()
    //         return new ResponseData(true, "", data)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }
    // public static async TapPaymentSettings(invoice: Invoice, paymentData: any, company: Company) {
    //     try {
    //         let paymentMethod = new TapPayment();
    //         //Payment Settings
    //         let paymentSettings = paymentData.settings

    //         paymentMethod.secretKey = paymentSettings.secretKey
    //         //Payment Data
    //         paymentMethod.paymentData.amount = invoice.total;
    //         paymentMethod.paymentData.currency = company.settings.currencySymbol;
    //         paymentMethod.paymentData.customer.email = ""
    //         paymentMethod.paymentData.customer.first_name = invoice.customer.name;
    //         paymentMethod.paymentData.customer.phone.number = invoice.customerContact;
    //         paymentMethod.paymentData.customer.phone.country_code = company.settings.contryCode;
    //         paymentMethod.paymentData.post.url = process.env.BASE_URL + "/ecommerce/" + company.slug + "/payments/TapPaymentResponse"
    //         paymentMethod.paymentData.redirect.url = process.env.BASE_URL + "/ecommerce/" + company.slug + "/payments/TapPaymentResponse"
    //         paymentMethod.paymentData.source.id = "src_all";
    //         paymentMethod.paymentData.reference.order = invoice.id;


    //         let data = await paymentMethod.createCharge()
    //         return new ResponseData(true, "", data)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }



    public static async getPaymentByInvoiceId(client: PoolClient, invoiceId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT "InvoicePayments".* from 
                      "InvoicePayments" inner join "InvoicePaymentLines" on "InvoicePayments".id ="InvoicePaymentLines"."invoicePaymentId"
                      where "InvoicePaymentLines"."invoiceId" =$1 
                  `,
                values: [invoiceId]
            }

            let payment = (await client.query(query.text, query.values)).rows[0];

            query.text = `SELECT * FROM "InvoicePaymentLines" where "invoicePaymentId" =$1`;
            query.values = [payment.id]

            payment.lines = (await client.query(query.text, query.values)).rows;
            return payment
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getPaymentByReferenceId(client: PoolClient, referenceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select * from "InvoicePayments"  where "referenceNumber"=$1`,
                values: [referenceId]
            }

            let payment = await client.query(query.text, query.values);
            let invoicePayment = new InvoicePayment();
            invoicePayment.ParseJson(payment.rows[0]);

            query.text = `SELECT * FROM "InvoicePaymentLines" where "invoicePaymentId"=$1`;
            query.values = [invoicePayment.id];

            invoicePayment.lines = (await client.query(query.text, query.values)).rows

            return invoicePayment
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async updatePaymentData(
        client: PoolClient,
        payment: InvoicePayment,
        company: Company
    ) {
        try {
            const query: { text: string, values: any } = {
                text: `Update "InvoicePayments" set "onlineData" =$1 ,"status"=$2 where id =$3`,
                values: [payment.onlineData, payment.status, payment.id]
            };
            //TODO: @maher check this condition
            if (payment.status == 'FAILD' && payment.lines[0].invoiceId) {
                await this.refundPoints(client, payment.lines[0].invoiceId, company)
                await this.reActiveCoupon(client, payment.lines[0].invoiceId, company)
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async saveAndSendInvoice(client: PoolClient, invoiceId: string, payment: InvoicePayment | null, company: Company) {
        try {
            let invoiceData = await InvoiceRepo.getFullInvoice(client, invoiceId)

            if (invoiceData) {
                let invoice = new Invoice();
                invoice.ParseJson(invoiceData);

                invoice.onlineData.onlineStatus = invoice.onlineData.onlineStatus == 'Pending Payments' ? 'Placed' : invoice.onlineData.onlineStatus

                let customerId = await CustomerRepo.addEcommerceCustomer(client, invoice.customerId, invoice.customer, company)


                if (customerId && invoice.customerContact != null && invoice.customerContact != "") {
                    invoice.customer.phone = invoice.customerContact;
                    invoice.customer.name = invoice.customer.name
                    invoice.customer.id = customerId
                    invoice.customerId = customerId
                }
                await InvoiceRepo.editInvoice(client, invoice, company)
                if (payment) {
                    invoice.invoicePayments.push(payment)
                }

                invoice.onlineData.onlineStatus = invoice.onlineData.onlineStatus == 'Pending Payments' ? 'Placed' : invoice.onlineData.onlineStatus

                await SocketInvoiceRepo.sendOnlineInvoice(invoice)




                await CartRepo.deleteRedisCart(company.id, invoice.onlineData.sessionId)



            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public static async failedPayment(client: PoolClient, invoiceId: string, data: any, company: Company) {
        try {
            let paymentData = await this.getPaymentByInvoiceId(client, invoiceId);
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            payment.onlineData = data;
            payment.status = "FAILD"

            await this.updatePaymentData(client, payment, company)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async payInvoice(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            let sessionId = data.sessionId;
            let invoice = (await CartRepo.getOrderBySessionId(client, sessionId, company)).data
            if (invoice) {
                let paymentData = (await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, data.payment.name)).data.paymentMethod
                let resault = await this.addPayments(client, paymentData, invoice, company)

                await client.query("COMMIT")
                return resault

            } else {
                return new ResponseData(false, "Invoice Not Found", [])
            }
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getCurrencyList(company: Company) {

        try {
            const query: { text: string, values: any } = {
                text: `Select "PaymentMethods".id,
                                "PaymentMethods".name,
                                "PaymentMethods".rate,
                                "PaymentMethods".symbol,
                                "PaymentMethods"."isEnabled",
                                "PaymentMethods"."index",
                                "PaymentMethods".type
                        from  "PaymentMethods"
                        where "PaymentMethods"."companyId"=$1 AND 
                            "PaymentMethods".type = 'Cash'  AND 
                            "PaymentMethods"."settings" is null `,
                values: [company.id]
            }

            let list = await DB.excu.query(query.text, query.values)

            if (list.rows.length > 0) {
                return new ResponseData(true, "", list.rows)
            } else {
                return new ResponseData(false, "No Payment Method available", {})
            }

        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }



    public static async checkBenefitPayStatus(referenceId: string, company: Company) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")
            const benefitPay = new BenefitPay()
            let paymentData = (await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, "BenefitPay")).data.paymentMethod
            let invoicePayment = await this.getPaymentByReferenceId(client, referenceId)

            let invoiceId = invoicePayment.lines[0].invoiceId;

            let status;
            if (invoiceId) {
                status = await benefitPay.checkPaymentStatus(referenceId, paymentData);

                if (status.success) {

                    invoicePayment.status = 'SUCCESS'
                    await this.updatePaymentData(client, invoicePayment, company)
                    await this.saveAndSendInvoice(client, invoiceId, invoicePayment, company)


                    invoicePayment.onlineData = status.data



                } else {
                    invoicePayment.onlineData = status.data
                    invoicePayment.status = 'FAILD'
                    await this.updatePaymentData(client, invoicePayment, company)


                }
            }
            await client.query("COMMIT")
            if (invoicePayment.status == 'SUCCESS') {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoiceId, id: [invoicePayment.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoiceId
                } as any);
            }

            if (invoicePayment.status == 'SUCCESS') {
                return new ResponseData(true, "", [])
            } else {
                return new ResponseData(false, "", invoicePayment.onlineData)
            }
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async checkPendingPaymentStatus() {
        try {

            jobStatus.isPendingPaymentRunning = true;
            const query = {
                text: `select "InvoicePayments".id,
                            "InvoicePayments"."referenceNumber",
                            "InvoicePayments"."createdAt",
                            "InvoicePayments"."onlineData",
                            "InvoicePaymentLines"."invoiceId" ,
                         "PaymentMethods".name as "paymentName",
                         "Branches"."companyId" 
                  from "InvoicePayments"
                INNER JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" =  "InvoicePayments".id
                INNER JOIN "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                INNER JOIN "Branches" On "Branches"."id" =  "InvoicePayments"."branchId"
                where status ='PENDING'
                AND "referenceNumber" is not null AND   "referenceNumber"<> ''
                AND "invoiceId" is not  null
                  AND "InvoicePayments"."createdAt" >= NOW() - INTERVAL '1 hour';
                `

            }

            let payment = await DB.exec.query(query.text)
            const company = new Company()
            for (let index = 0; index < payment.rows.length; index++) {
                const element: any = payment.rows[index];
                let miniCompany = await CompanyRepo.getMiniCompany(element.companyId)
                company.ParseJson(miniCompany)
                company.id = element.companyId;
                let createdAt = new Date(element.createdAt)
                let currentDate = new Date();
                let threeMinutes = 3 * 60 * 1000;
                let fifteenMinutes = 15 * 60 * 1000;
                let timeDifference = currentDate.getTime() - createdAt.getTime();

                if (timeDifference >= threeMinutes && timeDifference < fifteenMinutes) {// more than 3 min and less than 15 min
                    await PaymentRepo.checkStatus(element, company, false)
                } else if (timeDifference > fifteenMinutes) {//15 min
                    await PaymentRepo.checkStatus(element, company, true)
                }
            }
        } catch (error: any) {

            console.log(error)
            throw new Error(error);
        } finally {
            jobStatus.isPendingPaymentRunning = false
        }

    }


    public static async checkStatus(payment: any, company: Company, keepFailing: boolean) {
        try {
            let resault;

            switch (payment.paymentName) {
                case 'BenefitPay':
                    resault = await PaymentRepo.checkBenefitPayStatus(payment.referenceNumber, company)
                    break;
                case 'TapPayment':
                    resault = await PaymentRepo.tapPaymentResponse(payment.referenceNumber, payment.onlineData.chargeId, company)
                    break;
                case 'Gatee':
                    if (payment.onlineData) {
                        let data = {
                            hash: payment.onlineData.hash,
                            payment_id: payment.onlineData.payment_id
                        }
                        resault = await PaymentRepo.gateePaymentResponse(payment.referenceNumber, payment.onlineData.hash, data, payment.onlineData.payment_id, company)
                    }
                    break;
                default:
                    break;
            }


            if (resault == null || resault == undefined) return;

            if (resault && resault?.success == false) {
                if (keepFailing) {
                    await PaymentRepo.updatePaymentStatus(null, payment.id, 'FAILD', resault?.data ?? 'Faild'
                        , payment.invoiceId
                        , company)
                }
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getFullPayment(client: PoolClient, paymnetId: string) {
        try {
            const query = {
                text: `SELECT * FROM "InvoicePayments" where id = $1`,
                values: [paymnetId]
            }

            let payment = await client.query(query.text, query.values);
            let invoicePayment = new InvoicePayment();
            invoicePayment.ParseJson(payment.rows[0])

            query.text = `SELECT * FROM "InvoicePaymentLines" where "invoicePaymentId"=$1`,
                query.values = [paymnetId]

            let lines = await client.query(query.text, query.values);

            invoicePayment.lines = lines.rows;

            return invoicePayment
        } catch (error: any) {
            throw new Error(error)
        }
    }





    public static async tapPaymentResponse(id: string, chargeId: string, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")


            let paymentData = await this.getPaymentByReferenceId(client, id);
            let invoiceId: any = paymentData.lines[0].invoiceId;

            let paymentMethodSettings = (await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, "TapPayment")).data.paymentMethod

            let paymentMethod = new TapPayment()
            paymentMethod.chargeId = chargeId;
            paymentMethod.secretKey = paymentMethodSettings.settings.secretKey
            let paymentStatus = await paymentMethod.checkPaymentstatus();
            let payment = new InvoicePayment();
            payment.ParseJson(paymentData);
            if (paymentStatus.success) {
                payment.status = 'SUCCESS'
                await this.updatePaymentData(client, payment, company)
                await this.saveAndSendInvoice(client, invoiceId, payment, company)

            } else {
                payment.status = 'FAILD'
                payment.onlineData = { chargeId: chargeId, error: paymentStatus.msg, data: paymentStatus.data };
                await this.updatePaymentData(client, payment, company)

            }



            await client.query("COMMIT")
            if (payment.status == 'SUCCESS') {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoiceId, id: [payment.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoiceId
                } as any);
            }
            if (paymentStatus.success) {
                return new ResponseData(true, paymentStatus.msg, [])
            } else {
                return new ResponseData(false, paymentStatus.msg, [])
            }
        } catch (error: any) {
          
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }



    public static async gateePaymentResponse(id: string, hash: any, data: any, paymentId: any, company: Company) {
        const client = await DB.excu.client(5000)
        try {

            await client.query("BEGIN")


            let paymentData = await this.getPaymentByReferenceId(client, id);
            let invoiceId: any = paymentData.lines[0].invoiceId;

            let paymentMethodSettings = (await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, "Gatee")).data.paymentMethod

            let paymentMethod = new Gatee()
            paymentMethod.refeferenceNumber = paymentId;
            paymentMethod.hash = paymentMethodSettings.settings.secretKey
            paymentMethod.merchantId = paymentMethodSettings.settings.merchantId
            if (hash == paymentMethod.calculateHash(paymentMethod.hash, data)) {
                let paymentStatus = await paymentMethod.checkPaymentstatus();
                let payment = new InvoicePayment();
                payment.ParseJson(paymentData);
                let referenceId = paymentStatus.data.onlineData.field1;
                let successUrl = paymentStatus.data.onlineData.field4;
                let failureUrl = paymentStatus.data.onlineData.field5;
                let updatePayment = await paymentMethod.updatePayment();
                if (paymentStatus.success && paymentStatus.data.onlineData.processed == 0 && paymentStatus.data.onlineData.validated == "YES") {
                    if (updatePayment.data.data.status == "success" && paymentStatus.data.onlineData.status == 'completed') {
                        payment.status = 'SUCCESS'
                        await this.updatePaymentData(client, payment, company)
                        await this.saveAndSendInvoice(client, invoiceId, payment, company)
                    } else {
                        payment.status = 'FAILD'
                        payment.onlineData = { error: paymentStatus.msg, data: paymentStatus.data };
                        await this.updatePaymentData(client, payment, company)

                    }

                } else {
                    payment.status = 'FAILD'
                    payment.onlineData = { error: paymentStatus.msg, data: paymentStatus.data };
                    await this.updatePaymentData(client, payment, company)

                }



                await client.query("COMMIT")
                if (payment.status == 'SUCCESS') {
                    let queueInstance = TriggerQueue.getInstance();
                    queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoiceId, id: [payment.id], companyId: company.id })
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
                    InvoiceStatuesQueue.get().createJob({
                        id: invoiceId
                    } as any);
                }
                if (paymentStatus.success) {
                    return new ResponseData(true, paymentStatus.msg, [])
                } else {
                    return new ResponseData(false, paymentStatus.msg, [])
                }
            } else {
                return new ResponseData(false, "", [])
            }

        } catch (error: any) {
          
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async refundPoints(client: PoolClient, invoiceId: string, company: Company) {
        try {
            //TODO: fix with Maher 
            const promotionsPointsProvider = await PromotionsPointsProvider.Create(client);
            await promotionsPointsProvider.refundCustomerPointsByInvoiceId(
                client,
                company.id,
                invoiceId,
            );
            return;
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    //CouponProvider
    public static async reActiveCoupon(client: PoolClient, invoiceId: string, company: Company) {
        try {

            const couponProvider = await CouponProvider.Create(client);

            await couponProvider.ReActiveCoupon(
                company.id,
                {
                    en: "reActive coupon due to payment faild or rejected",
                    ar: "إعادة التنشيط الكوبون بسبب فشل الدفع أو رفضه"
                },
                undefined,
                invoiceId,
                "SYSTEM",
                client
            );
            return;
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
}