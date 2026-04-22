require('module-alias/register');

import { whatsappOrderController } from '@src/controller/ecommerce/whatsappOrder.controller';

import  express from 'express';

import { AuthController } from '@src/controller/app/auth.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';

const router =  createAsyncRouter();
router.post("/login",whatsappOrderController.login)
router.use(AuthController.Whatsappauthintcate);


router.post("/pushBranch",whatsappOrderController.pushBranch)

router.post('/menu/getMenuList',whatsappOrderController.getMenuList)
router.post('/pushMenu',whatsappOrderController.pushMenu)

router.get('/pushOptions',whatsappOrderController.pushOptions)
router.post('/pushMenuProducts',whatsappOrderController.pushMenuProducts)

router.post('/getServies',whatsappOrderController.getServiceList)
router.post('/setServies',whatsappOrderController.setServices)

router.get('/getCatalogList',whatsappOrderController.getCatalog)

router.post('/orderStatus',whatsappOrderController.OrderStatus)

// router.post('/pushSections',whatsappOrderController.pushSections)


//router.get('/getLoginInfo',whatsappOrderController.getCredintal);




export default router;