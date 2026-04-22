import { Request, Response, Application } from 'express';
import v1 from './v1';
import admin from './v1/admin';
import publicApi from './Public/ecommerce';
import aggrigator from './v1/aggrigator';

import { ShopifyService } from '@src/Integrations/shopify/shopify';

import { Helper } from '@src/utilts/helper';
import fileUpload from "express-fileupload";
import { CleanupMiddleware } from '@src/middlewear/cleanupMiddleware';
import { SentryMiddlware } from '@src/middlewear/Sentry';
import { ValidationException } from '@src/utilts/Exception';

import { Health } from '@src/utilts/health';
import { InvoiceController } from "@src/controller/app/Accounts/Invoice.controller";
import { PurchaseOrderController } from '@src/controller/app/Accounts/purchaseOrder.controller';
import { BillingController } from '@src/controller/app/Accounts/billing.controller';
import { BillingPaymentController } from '@src/controller/app/Accounts/billingPayment.controller';
import { InvoicePaymentController } from '@src/controller/app/Accounts/invoicePaymnet.controller';
import { EstimateController } from '@src/controller/app/Accounts/estimate.controller';
import { CreditNoteController } from '@src/controller/app/Accounts/creditNote.controller';
import { SupplierCreditController } from '@src/controller/app/Accounts/supplierCredit.controller';
import { ExpenseController } from '@src/controller/app/Accounts/expense.controller';
import { JournalViewController } from '@src/controller/Journals/JournalViewController';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { CompanyController } from '@src/controller/admin/company.controller';
import { errorHandler } from '@src/middlewear/errorHandler';

const recentErrors = new Set();
export class Routes {

  public routes(app: Application): void {


    app.route('/_status')
      .get((req: Request, res: Response) => {
        res.status(200).send('Healthy!!!');
      });

    app.get('/.well-known/:file', CompanyController.getFileByName)
    app.get('/getInvoicePdf/:invoiceId', InvoiceController.getInvoicePdf);
    app.get('/getpoPdf/:id', PurchaseOrderController.getPoPdf);
    app.get('/getbillPdf/:id', BillingController.getBillPdf);
    app.get('/getbillpaymentPdf/:id', BillingPaymentController.getBillpaymentPdf);
    app.get('/getInvoicepaymentPdf/:id', InvoicePaymentController.getInvoicepaymentPdf);
    app.get('/getEstimatePdf/:id', EstimateController.getEstimatePdf);
    app.get('/getcreditNotePdf/:id', CreditNoteController.getcreditNotePdf);
    app.get('/getSupplierCreditPdf/:id', SupplierCreditController.getSupplierCreditPdf);
    app.get('/getExpensePdf/:id', ExpenseController.getExpensePdf);

    // if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
    // init({
    //   dsn: (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") ? process.env.SENTRY_DNS : process.env.SENTRY_DNS
    //   , beforeSend: (event: any, hint: EventHint) => {
    //     const errorObj: any = hint.originalException;
    //     if (errorObj instanceof ValidationException) {
    //       return null
    //     } else {
    //       if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing" || process.env.NODE_ENV === "development") {

    //         const errorFingerprint = `${errorObj.name}:${errorObj.message}`;
    //         if (recentErrors.has(errorFingerprint)) {
    //           return null; // Drop duplicate
    //         }

    //         recentErrors.add(errorFingerprint);
    //         setTimeout(() => recentErrors.delete(errorFingerprint), 10000); // 10 seconds

    //         return event;
    //       } else {
    //         return null; // this drops the event and nothing will be send to sentry
    //       }
    //     }
    //   }
    //   ,
    //   integrations: [
    //     // enable HTTP calls tracing
    //     new Integrations.Http({ tracing: true }),
    //     // Automatically instrument Node.js libraries and frameworks
    //     // (This function is slow because of file I/O, consider manually adding additional integrations instead)
    //     ...autoDiscoverNodePerformanceMonitoringIntegrations(),
    //     // Or manually add integrations of your choice. For example:
    //     new Integrations.Apollo(),
    //     new Integrations.Postgres(),

    //   ],


    //   // To set a uniform sample rate
    //   tracesSampleRate: 0.5,
    //   profilesSampleRate: 1.0,

    // });

    // app.use(Handlers.requestHandler());
    // }


    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => { // 'finish' event is emitted when the response is sent
        const duration = Date.now() - start; // Calculate the duration
        // console.log(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        if (duration > 1000) { // Log if the request takes longer than 1 second (1000ms)
          console.log(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
      });
      console.warn(req.originalUrl)
      next();
    });








    app.get('/', async (req: Request, res: Response) => {
      res.status(200).send({});
    });
    app.get('/time', (req, res) => {
      const now = new Date();
      res.json({ utc: now.toISOString() });
    });
    app.get('/tesssssstttttttt/', JournalViewController.tesssssstttttttt);

    app.get('/health', Health.serverHealth);

    app.post('/systemEvents/:eventname', async (req: Request, res: Response) => {
      try {
        let eventname = req.params.eventname
        let body = req.body
        console.log(eventname);
        console.log(body);
      } catch (error) {
        console.log(error);
      }

    });


    app.get('/shopify', async (req: Request, res: Response) => {
      let result = await ShopifyService.testQuiry();
      return res.send(result)
    });
    app.get('/shopify/AddProduct', async (req: Request, res: Response) => {
      let result = await ShopifyService.AddProduct('balboool1998');
      return res.send(result)
    });


    app.post('/shopifyhook', async (req: Request, res: Response) => {
      console.log(req.body);
    });


    app.use('/aggrigator', aggrigator);










    app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }))
    app.use((req, res, next) => {
      if (req.body) {
        Helper.trim_nulls(req.body);
      }
      next();
    })
    // app.use((req, res, next) => {
    //   console.log(`Received ${req.method} request: ${req.url}`, 'Time Received :' , new Date());
    //   next();
    // });

    app.use('/api/admin', admin);
    app.use('/Public/ecommarce', publicApi);
    app.use(SentryMiddlware.middleware)

    app.use('/v1', v1);
    if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {

      // app.use(Handlers.errorHandler());
    }

    // app.use((req, res, next) => {
    //   console.log(`Ended ${req.method} request: ${req.url}`, 'Time Ended :' , new Date());
    //   next();
    // });

    app.use(CleanupMiddleware.cleanupMiddleware)
    app.use(errorHandler);
    // eslint-disable-next-line @typescript-eslint/no-var-requires


    /****   Function To Print All EndPoints of the System 
  function print (path:any, layer:any) {
    if (layer.route) {
      layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
    } else if (layer.method) {
      console.log('%s /%s',
        layer.method.toUpperCase(),
        path.concat(split(layer.regexp)).filter(Boolean).join('/'))
    }
  }
  
  function split (thing:any) {

    if (typeof thing === 'string') {
      return thing.split('/')
    } else if (thing.fast_slash) {
      return ''
    } else {
      let match = thing.toString()
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '$')
        .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
      return match
        ? match[1].replace(/\\(.)/g, '$1').split('/')
        : '<complex:' + thing.toString() + '>'
    }
  }
  
  app._router.stack.forEach(print.bind(null, []))

*/


  }
}