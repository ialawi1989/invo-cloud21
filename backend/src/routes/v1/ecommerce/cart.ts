
require('module-alias/register');

import { ApiLimiterRepo } from '@src/apiLimiter';
import { CartController } from '@src/controller/ecommerce/cart.controlle';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import  express from 'express';
const router = createAsyncRouter();

router.post("/createCart",CartController.createCart)
router.get("/getCart/:sessionId",CartController.getCart)
router.post("/addItem",CartController.addItemToCart)
router.post("/removeItem",CartController.removeItemFromCart)
router.post("/clearCart",CartController.clearCartItems)
router.post("/changeItemQty",CartController.changeItemQty)
router.post("/checkBranchAvailabilty",CartController.checkBranchAvailability)
router.post("/checkOut",CartController.checkOut)
router.get("/getOrder/:sessionId",CartController.getOrderBySessionId)
router.post('/saveInvoiceScheduleTime',CartController.saveInvoiceScheduleTime); //not used yet 
router.post("/ChangeService",CartController.ChangeService)

export default router;