
require('module-alias/register');
import { ApiLimiterRepo } from '@src/apiLimiter';
import { AuthController } from '@src/controller//deliveryApp/auth.Controller';
import { DriverController } from '@src/controller/deliveryApp/driver.Controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import { authenticatedContextMiddleware } from '@src/middlewear/authenticatedContextMiddleware';
import * as express from 'express';


const router = createAsyncRouter();
router.use(authenticatedContextMiddleware("DriverApp"))
router.post("/checkOTP",AuthController.checkOTP)
router.post("/resetPassword",AuthController.resetPassword)
router.post("/setNewPassword",AuthController.setNewPassword2)

router.post('/login', AuthController.login);
router.use(AuthController.authenticate)
 // one request every 30 sec
router.get('/startShift',ApiLimiterRepo.getCustomLimiterByPath(1,30),   DriverController.startShift);
router.get('/endShift',ApiLimiterRepo.getCustomLimiterByPath(1,30),  DriverController.endShift);
router.get('/logout',ApiLimiterRepo.getCustomLimiterByPath(1,30), DriverController.logOut);
router.post('/refreshToken',ApiLimiterRepo.getCustomLimiterByPath(1,30), AuthController.refreshToken)

router.get('/pendingOrders',  DriverController.pendingOrders);
router.get('/clamiedOrders',ApiLimiterRepo.getCustomLimiterByPath(5,30),  DriverController.clamiedOrders);
router.get('/shippedOrders',ApiLimiterRepo.getCustomLimiterByPath(5,30),  DriverController.pickedOrders);
router.get('/deliveredOrders',ApiLimiterRepo.getCustomLimiterByPath(5,30),  DriverController.deliveredOrders);
router.get('/getOrderById/:invoiceId',ApiLimiterRepo.getCustomLimiter(3,10), DriverController.getOrderById);

router.post('/updateOrderStatus',ApiLimiterRepo.getCustomLimiter(10,30), DriverController.updateOrderStatus);
//router.post('/updateDriverStatus', DriverController.updateOrderStatus);
router.get('/invoicePayment/:invoiceId', DriverController.invoicePayment);
router.get('/setPickupOrder/:invoiceId', DriverController.pickupOrder);
// router.post('/saveInvoicePayment', DriverController.addInvoicePayment);

export default router;