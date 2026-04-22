import { EInvoiceController } from '@src/controller/app/E-Invoice/E-Invoice.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from 'express';

const router = createAsyncRouter();

// router.use(EInvoiceController.authenticateToken);
router.get("/getInvoice/:companyId/:invoiceId",EInvoiceController.getInvoice)
router.post("/validateApplePay/",EInvoiceController.validateApplePay)
router.get("/getPaymentMethods/:companyId",EInvoiceController.getPaymentMethods)
router.post("/payInvoice/",EInvoiceController.payInvoice)
router.get("/getInvoiceTemplate/:companyId",EInvoiceController.getInvoiceTemplate)




router.get("/payments/AFSPaymentCallBack/:companyId/:invoiceId/:id",EInvoiceController.AFSPaymentCallBack)
router.get("/payments/AFSCancelCallBack/:companyId/:invoiceId/:id",EInvoiceController.AFSCancelCallBack)
router.get("/payments/AFStimeoutCallBack/:companyId/:invoiceId/:id",EInvoiceController.AFSTimeoutCallBack)


router.get("/payments/CrediMaxPaymentCallBack/:companyId/:invoiceId/:id",EInvoiceController.CrediMaxPaymentCallBack)
router.get("/payments/CrediMaxCancelCallBack/:companyId/:invoiceId/:id",EInvoiceController.CrediMaxCancelCallBack)
router.get("/payments/CrediMaxTimeoutCallBack/:companyId/:invoiceId/:id",EInvoiceController.CrediMaxTimeoutCallBack)



router.post("/payments/BenefitCallBack/:companyId/:invoiceId/:id",EInvoiceController.BenefitCallBack)
router.post("/payments/checkBenefitPayStatus/",EInvoiceController.checkBenefitPayStatus)


router.get("/payments/thawaniCallBack/:companyId/:invoiceId/:id",EInvoiceController.thawaniCallBack)
router.get("/payments/ThawaniCancelResponse/:companyId/:invoiceId/:id",EInvoiceController.ThawaniCancelResponse)



router.get("/payments/tapPaymentResponse/:companyId/:invoiceId/:id",EInvoiceController.tapPaymentResponse)
router.get("/getInvoiceForSignature",EInvoiceController.authenticate, EInvoiceController.getInvoiceForSignature)
router.post("/saveInvoiceSignature",EInvoiceController.authenticate, EInvoiceController.saveInvoiceSignature)



export default router;