
require('module-alias/register');

import { whatsappOrderController } from '@src/controller/ecommerce/whatsappOrder.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import  express from 'express';

const router = createAsyncRouter();
router.post("/addOrder",whatsappOrderController.addOrder)
router.get('/test',whatsappOrderController.test )


export default router;