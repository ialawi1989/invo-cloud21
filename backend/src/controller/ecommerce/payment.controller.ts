
import { ResponseData } from '@src/models/ResponseData';
import { PaymentRepo } from '@src/repo/ecommerce/pament.repo';
import { Logger } from '@src/utilts/invoLogger';
import { Request, Response, NextFunction } from 'express';
export class PaymentController {


  public static async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const invoiceId = req.params.id;
      const company = res.locals.company
      const methods = await PaymentRepo.getPaymentMethods(company.id);
      return res.send(methods);

    } catch (error: any) {

      throw error;
    }
  }



  public static async PublicgetPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const invoiceId = req.params.id;
      const company = res.locals.company
      const methods = await PaymentRepo.PublicgetPaymentMethods(company.id);
      return res.send(methods);

    } catch (error: any) {

      throw error;
    }
  }





  public static async payInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const company = res.locals.company
      const methods = await PaymentRepo.payInvoice(data, company);
      return res.send(methods);

    } catch (error: any) {

      throw error;
    }
  }

  public static async CrediMaxPaymentCallBack(req: Request, res: Response, next: NextFunction) {
    try {
      const data = { resultIndicator: req.query.resultIndicator };
      const invoiceId = req.params.id;
      const company = res.locals.company
      const services = await PaymentRepo.CrediMaxPaymentCallBack(invoiceId, data, company);
      return res.send(services);

    } catch (error: any) {

      throw error;
    }
  }


  public static async CrediMaxCancelCallBack(req: Request, res: Response, next: NextFunction) {
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    const company = res.locals.company
    let redirectUrl = "";
    if (httpString) {
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
        redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
      } else {
        redirectUrl = httpString[0] + '//' + httpString[1]
      }
    }
    try {

      const data = req.body;
      const invoiceId = req.params.id;

      const services = await PaymentRepo.CrediMaxCancelCallBack(invoiceId, data, company);
      return res.redirect(redirectUrl + '/order/error?errorMsg=The payment was canceled by the user.')


    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }

  public static async CrediMaxTimeoutCallBack(req: Request, res: Response, next: NextFunction) {
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    const company = res.locals.company
    let redirectUrl = "";
    if (httpString) {
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
        redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
      } else {
        redirectUrl = httpString[0] + '//' + httpString[1]
      }
    }
    try {
      const data = req.body;
      const invoiceId = req.params.id;

      const services = await PaymentRepo.CrediMaxTimeoutCallBack(invoiceId, data, company);
      return res.redirect(redirectUrl + '/order/error?errorMsg=Payment TimeOut')

    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)

    }
  }



  public static async BenefitCallBack(req: Request, res: Response, next: NextFunction) {

    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let referenceId = req.params.id
    let httpString = baseUrl?.split('//')
    const company = res.locals.company
    let redirectUrl = "";
    if (httpString) {
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
        redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
      } else {
        redirectUrl = httpString[0] + '//' + httpString[1]
      }
    }
    try {
      const data = req.body;

      //change this url based on stage (dev or test)




      const services = await PaymentRepo.BenefitCallBack(data, company, referenceId);
      if (services.success) {
        return res.redirect(redirectUrl + '/order/complete')

      } else {
        return res.redirect(redirectUrl + '/order/error?errorMsg=' + services.msg)
      }

    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)

    }
  }

  public static async thawaniCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;

    var invoiceId = req.params.invoiceId;
    const sessionId = req.sessionID;
    const company = res.locals.company
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    try {

      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1]
        }
      }

      const services = await PaymentRepo.ThawaniSuccessResponse(invoiceId, data, company, sessionId);
      return res.redirect(redirectUrl + '/order/complete')

    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }

  public static async ThawaniCancelResponse(req: Request, res: Response, next: NextFunction) {
    const data = req.body;

    var invoiceId = req.params.invoiceId;
    const sessionId = req.sessionID;
    const company = res.locals.company
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    try {

      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '/' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '/' + httpString[1]
        }
      }

      const services = await PaymentRepo.ThawaniCancelResponse(invoiceId, data, company, sessionId);
      return res.redirect(redirectUrl + '/order/error?errorMsg=Payment Cancelled By User')

    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }
  public static async AFSPaymentCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.query.resultIndicator;
    const referenceNumber = req.params.id;
    const company = res.locals.company
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    if (httpString) {
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
        redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
      } else {
        redirectUrl = httpString[0] + '//' + httpString[1]
      }
    }

    try {

      const services = await PaymentRepo.AFSPaymentCallBack(referenceNumber, data, company);
      return res.redirect(redirectUrl + '/order/complete')
    } catch (error: any) {

      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }
  public static async AFSTimeoutCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const invoiceId = req.params.id;
    const company = res.locals.company
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    try {

      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1]
        }
      }
      const services = await PaymentRepo.AFSTimeoutCallBack(invoiceId, data, company);
      return res.redirect(redirectUrl + '/order/error?errorMsg=Payment Time Out')
    } catch (error: any) {


      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }
  public static async AFSCancelCallBack(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    const invoiceId = req.params.id;
    const company = res.locals.company
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    try {

      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1]
        }
      }
      const services = await PaymentRepo.AFSCancelCallBack(invoiceId, data, company);
      return res.redirect(redirectUrl + '/order/error?errorMsg=Payment Cancelled By User')
    } catch (error: any) {


      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }

  public static async getCurrencyList(req: Request, res: Response, next: NextFunction) {
    try {

      const company = res.locals.company
      const methods = await PaymentRepo.getCurrencyList(company);

      return res.send(methods);

    } catch (error: any) {

      throw error;
    }
  }


  public static async checkBenefitPayStatus(req: Request, res: Response, next: NextFunction) {
    try {

      const company = res.locals.company
      let data = req.body;

      const referenceId = data.referenceId;
      const methods = await PaymentRepo.checkBenefitPayStatus(referenceId, company);
      let baseUrl = process.env.ECOMMERCE_BASE_URL;
      let httpString = baseUrl?.split('//')
      let redirectUrl = "";
      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1]
        }
      }

      if (methods.success) {
        return res.send(new ResponseData(true, "", []))
      } else {
        return res.send(new ResponseData(false, 'Status: ' + methods.data.error.status + ', ' + 'Message: ' + methods.data.error.message, []))

      }
    } catch (error: any) {
      console.log(error)
      throw error;
    }
  }


  public static async tapPaymentResponse(req: Request, res: Response, next: NextFunction) {
    const company = res.locals.company
    const referenceId = req.params.id;
    let chargeId: any = req.query.tap_id;
    const methods = await PaymentRepo.tapPaymentResponse(referenceId, chargeId, company);
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    try {


      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1]
        }
      }
      if (methods.success) {
        return res.redirect(redirectUrl + '/order/complete')

      } else {
        return res.redirect(redirectUrl + `/order/error?errorMsg=${methods.msg}`)

      }


    } catch (error: any) {

      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }

  public static async gateePaymentResponse(req: Request, res: Response, next: NextFunction) {
    const company = res.locals.company
    const referenceId = req.params.id;
    let calculatedHash: any = req.query.calculated_hash;
    let data = req.query
    let paymentId = req.query.payment_id ?? ""

    const methods = await PaymentRepo.gateePaymentResponse(referenceId, calculatedHash, data, paymentId, company);
    let baseUrl = process.env.ECOMMERCE_BASE_URL;
    let httpString = baseUrl?.split('//')
    let redirectUrl = "";
    try {


      if (httpString) {
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1]
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1]
        }
      }
      if (methods.success) {
        return res.redirect(redirectUrl + '/order/complete')

      } else {
        return res.redirect(redirectUrl + `/order/error?errorMsg=${methods.msg}`)

      }


    } catch (error: any) {
      Logger.error(error.message, { stack: error.stack });
      return res.redirect(redirectUrl + '/order/error?errorMsg=' + error.msg)
    }
  }
}