import { ShopperController } from "@src/controller/ecommerce/shopper.controller";
import express from "express";
import { Passport } from '@src/passport';
import passport from 'passport';
import { RedisClient } from '@src/redisClient';
import session from 'express-session'
import { ApiLimiterRepo } from "@src/apiLimiter";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
const router = createAsyncRouter();

router.post('/signUp', ShopperController.registration); 
router.post('/logIn', ShopperController.logIn);
router.post('/getOtp',ApiLimiterRepo.getCustomLimiter(1,25), ShopperController.setOtp);
router.post('/validateOtp', ShopperController.validateOtp);
router.post('/updateShopper', ShopperController.updateShopper);
router.post('/resetPassword', ShopperController.resetPassword);
// router.post('/getLoggedInUser', ShopperController.validateOtp);
router.post('/logOut', ShopperController.logOut);
router.post('/getLoggedInUser', ShopperController.getLoggedInUser);
router.post('/subscribe', ShopperController.subscribe);
router.post('/orderHistory', ShopperController.shopperOrderHistory);
router.post('/setPassword', ShopperController.updateShopperPassword);
router.post('/updateShopperEmailPhone', ShopperController.updateShopperEmailPhone);
router.get('/order/:orderId', ShopperController.getShopperOrderById);

router.use(session({
    secret: 'bz1P6EYH%q',
    store: RedisClient.getRedisClient().store,
    resave: false,
    saveUninitialized: true,
    cookie: { path: '/', secure: false, httpOnly: false, sameSite: "none", maxAge:  30 * 24 * 60 * 60 * 1000  } //30 days

  }))

  router.use(passport.initialize());
  router.use(passport.session());
  Passport.loadPassport(passport)
  router.post('/logInWithGoogle', ShopperController.logInWithGoogle);
  router.post('/logInWithApple', ShopperController.logInWithApple);
export default router;