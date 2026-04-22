
require('module-alias/register');

import { ApiLimiterRepo } from '@src/apiLimiter';
import { CartController } from '@src/controller/ecommerce/cart.controlle';
import { PaymentController } from '@src/controller/ecommerce/payment.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from 'express';


const router = createAsyncRouter();
router.get("/getPaymentMethods",PaymentController.getPaymentMethods)
router.post("/payInvoice",PaymentController.payInvoice)
router.get("/getCurrencyList",PaymentController.getCurrencyList)


router.get("/AFSPaymentCallBack/:id",PaymentController.AFSPaymentCallBack)
router.get("/AFSCancelCallBack/:id",PaymentController.AFSCancelCallBack)
router.get("/AFStimeoutCallBack/:id",PaymentController.AFSTimeoutCallBack)


router.get("/CrediMaxPaymentCallBack/:id",PaymentController.CrediMaxPaymentCallBack)
router.get("/CrediMaxCancelCallBack/:id",PaymentController.CrediMaxCancelCallBack)
router.get("/CrediMaxTimeoutCallBack/:id",PaymentController.CrediMaxTimeoutCallBack)



router.post("/BenefitCallBack/:id",PaymentController.BenefitCallBack)
router.post("/checkBenefitPayStatus/",PaymentController.checkBenefitPayStatus)


router.get("/thawaniCallBack/:invoiceId",PaymentController.thawaniCallBack)
router.get("/ThawaniCancelResponse/:invoiceId",PaymentController.ThawaniCancelResponse)



router.get("/tapPaymentResponse/:id",PaymentController.tapPaymentResponse)
router.get("/GateeCallBack/:id",PaymentController.gateePaymentResponse)






export default router;