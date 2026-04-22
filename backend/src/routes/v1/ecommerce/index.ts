
require('module-alias/register');
import { CompanyController } from '@src/controller/admin/company.controller';

import Shop from './shop';
import Cart from './cart';
import Payments from './payment';
import branch from './branch';
import employee from './employee';
import whatsappOrder from './whatsappOrder'
import  theme from './theme'
import  shipping from './shipping'
import  shopper from './shopper'
import  reservation from './reservation'
import  notification from './notification'
import  images from './images'
import express from 'express';
import { BranchController } from '@src/controller/admin/branch.controller';
import { ShopperController } from '@src/controller/ecommerce/shopper.controller';
import { WebManifestController } from '@src/controller/ecommerce/webManifest.controller';
import { websiteRouter as promotions } from '../promotions';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import { authenticatedContextMiddleware } from '@src/middlewear/authenticatedContextMiddleware';



const router = createAsyncRouter();
router.use(authenticatedContextMiddleware("ecommerce"))
router.get('/manifest.webmanifest',WebManifestController.getWebManifest)
router.get('/getCompanyPrefrences', CompanyController.getCompanyEcommerceSetting);
router.get('/getCompanyBranches', BranchController.getBranchesList);

/**
 * TODO:
 */
router.use(ShopperController.authinticateLogin)
router.get('/load/:branchId/:tableId',BranchController.loadQrData)
router.get('/pager/:branchId/:tableId',BranchController.loadPagerQrData)

router.get('/getCompanyDeliveryAddresses',BranchController.getCompanyDeliveryAddresses)
router.use("/branch", branch)
router.use("/employee", employee)

router.use("/shop", Shop)
router.use("/cart", Cart)
router.use("/payments", Payments)
router.use("/whatsappOrder",whatsappOrder)
router.use("/theme", theme)
router.use("/shipping", shipping)
router.use("/reservation", reservation)
router.use("/shopper", shopper)
router.use("/images", images)
router.use("/notification", notification)
router.use('/promotions', promotions);

export default router;