
require('module-alias/register');
import { InvoiceController_callCenter } from "@src/controller/callCenter/Invoice.Controller";
import { InvoiceController } from '@src/controller/app/Accounts/Invoice.controller';
import express from 'express';
import { ApiLimiterRepo } from "@src/apiLimiter";
import rateLimit from "express-rate-limit";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

const router = createAsyncRouter();


// router.post('/SaveOrder'/*,ApiLimiterRepo.apiLimiter*/, InvoiceController.addInvoice);
router.get('/getOrders/:customerId'/*,ApiLimiterRepo.apiLimiter*/, InvoiceController.getCustomerInvoices);
// router.get('/getOrder/:invoiceId'/*,ApiLimiterRepo.apiLimiter*/,InvoiceController.getInvoiceById);

router.post('/getInvoices', rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 6, // Limit each IP to 6 requests per `window` (here, per 10 seconds)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}), InvoiceController_callCenter.getInvoices);

router.get('/getOrder/:invoiceId'/*,ApiLimiterRepo.apiLimiter*/, InvoiceController_callCenter.getFullInvoice);
router.get('/getInvoicesByCustomerId/:customerId'/*,ApiLimiterRepo.apiLimiter*/, InvoiceController_callCenter.getInvoicesByCustomerID);
router.post('/saveInvoice'/*,ApiLimiterRepo.apiLimiter*/, InvoiceController_callCenter.addInvoice);


export default router;