import { ResponseData } from '@src/models/ResponseData';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { EinvoiceRepo } from '@src/repo/E-invoice/E-invoice.repo';
import { PaymentRepo } from '@src/repo/ecommerce/pament.repo';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { CustomizationRepo } from '@src/repo/app/settings/Customization.repo';

import { Request, Response, NextFunction } from 'express';
import { Logger } from '@src/utilts/invoLogger';

export class EInvoiceController {



  public static async getInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceId = req.params.invoiceId;
      const companyId = req.params.companyId;
      const company = (await CompanyRepo.getMiniCompany(companyId));
      if (company) {
        const invoice = (await EinvoiceRepo.getInvoice(invoiceId, company)).data
        return res.send(new ResponseData(true, "", { company: company, invoice: invoice }))

      } else {
        return res.send(new ResponseData(false, "Company Not Found", []))
      }

    } catch (error: any) {
      throw error

    }
  }

  public static async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;
      const payments = await PaymentRepo.getPaymentMethods(companyId)
      return res.send(payments)

    } catch (error: any) {
      throw error

    }
  }

  public static async getInvoiceTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;
      let resault = await CustomizationRepo.getInvoiceTemplate(companyId)
      return res.send(resault)
    } catch (error: any) {
      throw error
    }
  }


  public static async payInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId;
      const data = req.body;
      const company = (await CompanyRepo.getMiniCompany(companyId));
      if (company) {
        const payment = await EinvoiceRepo.payInvoice(data, company)
        return res.send(payment)
      } else {
        return res.send(new ResponseData(false, "Company Not Found", []))
      }

    } catch (error: any) {
      throw error

    }
  }

  public static async CrediMaxPaymentCallBack(req: Request, res: Response, next: NextFunction) {
    const data = { resultIndicator: req.query.resultIndicator };
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {


      if (company) {
        const services = await PaymentRepo.CrediMaxPaymentCallBack(referenceId, data, company);
        // let queueInstance = TriggerQueue.getInstance();
        // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
        InvoiceStatuesQueue.get().createJob({
          id: invoiceId
        } as any);
        return res.redirect(redirectUrl + '?success=true')
      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }



    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }


  public static async CrediMaxCancelCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {



      if (company) {
        const services = await PaymentRepo.CrediMaxCancelCallBack(referenceId, data, company);

        return res.redirect(redirectUrl + '?success=false&errorMsg="Payment Is Cancelled"')

      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }


    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }

  public static async CrediMaxTimeoutCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {


      if (company) {
        const services = await PaymentRepo.CrediMaxTimeoutCallBack(referenceId, data, company);

        return res.redirect(redirectUrl + '?success=false&errorMsg="Timeout"')

      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }



    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }



  public static async BenefitCallBack(req: Request, res: Response, next: NextFunction) {

    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token


    try {


      //change this url based on stage (dev or test)

      const company = (await CompanyRepo.getMiniCompany(companyId));


      if (company) {
        const services = await PaymentRepo.BenefitCallBack(data, company, referenceId);
        if (services.success) {
          // let queueInstance = TriggerQueue.getInstance();
          // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
          InvoiceStatuesQueue.get().createJob({
            id: invoiceId
          } as any);
          return res.redirect(redirectUrl + '?success=true')

        } else {
          return res.redirect(redirectUrl + '?success=false&errorMsg=' + services.msg)

        }

      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }


    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)

    }
  }

  public static async thawaniCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {


      const sessionId = req.sessionID;
      if (company) {
        const services = await PaymentRepo.ThawaniSuccessResponse(invoiceId, data, company, sessionId);
        // let queueInstance = TriggerQueue.getInstance();
        // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
        InvoiceStatuesQueue.get().createJob({
          id: invoiceId
        } as any);
        return res.redirect(redirectUrl + '?success=true')
      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }





    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)

    }
  }

  public static async ThawaniCancelResponse(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {


      const sessionId = req.sessionID;
      if (company) {
        const services = await PaymentRepo.ThawaniCancelResponse(invoiceId, data, company, sessionId);

        return res.redirect(redirectUrl + '?success=false$errorMsg="Payment Cancelled by User"')
      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }




    } catch (error: any) {
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }
  public static async AFSPaymentCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)

    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {


      if (company) {
        const services = await PaymentRepo.AFSPaymentCallBack(referenceId, data, company);
        // let queueInstance = TriggerQueue.getInstance();
        // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
        InvoiceStatuesQueue.get().createJob({
          id: invoiceId
        } as any);
        return res.redirect(redirectUrl + '?success=true')
      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }



    } catch (error: any) {
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }
  public static async AFSTimeoutCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {

      if (company) {
        const services = await PaymentRepo.AFSTimeoutCallBack(referenceId, data, company);

        return res.redirect(redirectUrl + '?success=false&errorMsg="Payment TimeOut"')
      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }

    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }
  public static async AFSCancelCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    try {


      if (company) {
        const services = await PaymentRepo.AFSCancelCallBack(referenceId, data, company);
        return res.redirect(redirectUrl + '?success=false&errorMsg="Payment is Cancelled By User"')
      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }


    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }


  public static async checkBenefitPayStatus(req: Request, res: Response, next: NextFunction) {
    try {


      let data = req.body;
      const companyId = data.companyId
      const referenceId = data.referenceId;
      const company = await CompanyRepo.getMiniCompany(companyId);
      if (company) {
        const methods = await PaymentRepo.checkBenefitPayStatus(referenceId, company);

        if (methods.success) {
          // let queueInstance = TriggerQueue.getInstance();
          // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [methods.data.invoiceId] })
          InvoiceStatuesQueue.get().createJob({
            id: methods.data.invoiceId
          } as any);
          return res.send(new ResponseData(true, "", []))
        } else {
          return res.send(new ResponseData(false, 'Status: ' + methods.data.error.status + ', ' + 'Message: ' + methods.data.error.message, []))

        }
      }

    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      throw error;
    }
  }
  public static async tapPaymentResponse(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const referenceId = req.params.id;
    const companyId = req.params.companyId;
    const invoiceId = req.params.invoiceId;
    const company = (await CompanyRepo.getMiniCompany(companyId));
    let token = btoa(companyId + '|+|' + invoiceId)
    let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
    let chargeId: any = req.query.tap_id;
    try {


      if (company) {
        const methods = await PaymentRepo.tapPaymentResponse(referenceId, chargeId, company);
        if (methods.success) {
          // let queueInstance = TriggerQueue.getInstance();
          // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
          InvoiceStatuesQueue.get().createJob({
            id: invoiceId
          } as any);
          return res.redirect(redirectUrl + '?success=true')

        } else {
          return res.redirect(redirectUrl + '?success=false&errorMsg=' + methods.msg)

        }

      } else {

        return res.redirect(redirectUrl + '?success=false&errorMsg="Company Not Found"')
      }



    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + + '?errorMsg=' + error.message)
    }
  }

  public static async authenticate(req: Request, res: Response, next: NextFunction) {
    try {

      let accessToken: any = req.headers['token'];

      if (accessToken == "" || accessToken == null) {
        return res.status(401).json(new ResponseData(false, "Unauthorized", []))
      }
      const auth = await EinvoiceRepo.authenticateToken(accessToken);


      if (auth?.success) {
        res.locals.invoiceId = auth.data.invoiceId;
        res.locals.companyId = auth.data.company.id;
        next();
      } else {
        return res.status(401).json(new ResponseData(false, "Unauthorized", []))
      }

    } catch (error: any) {
      const err: any = new Error(error.message)
      err.statusCode = 401
      throw err
    }
  }



  public static async getInvoiceForSignature(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceId = res.locals.invoiceId;
      const companyId = res.locals.companyId;
      const company = (await CompanyRepo.getMiniCompany(companyId));
      if (company) {
        const invoice = (await EinvoiceRepo.getInvoice(invoiceId, company)).data
        return res.send(new ResponseData(true, "", { company: company, invoice: invoice }))

      } else {
        return res.send(new ResponseData(false, "Company Not Found", []))
      }

    } catch (error: any) {
      throw error

    }
  }
  public static async saveInvoiceSignature(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const invoiceId = res.locals.invoiceId;
      const companyId = res.locals.companyId;
      const resData = await InvoiceRepo.saveInvoiceSignature(data, invoiceId, companyId)

      // Send the PDF buffer as the response
      res.send(resData);



    } catch (error: any) {
      console.log(error);
      throw error
    }
  }

  public static async validateApplePay(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const companyId = data.companyId;
      const resData = await EinvoiceRepo.ValidateApplePay(companyId, data)

      // Send the PDF buffer as the response
      res.send(resData);



    } catch (error: any) {
      console.log(error);
      throw error
    }
  }
}