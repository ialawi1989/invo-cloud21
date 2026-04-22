

require('module-alias/register');
import { AuthController } from '@src/controller/app/auth.controller';
import express from 'express';
 import Customer from './customer';
import menu from '@src/routes/v1/callCenter/menu';
import order from '@src/routes/v1/callCenter/order';
import address from '@src/routes/v1/callCenter/address';
import company from '@src/routes/v1/callCenter/company';
import { ApiLimiterRepo } from '@src/apiLimiter';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import { authenticatedContextMiddleware } from '@src/middlewear/authenticatedContextMiddleware';

const router = createAsyncRouter();
router.use(authenticatedContextMiddleware("CallCenter"))
router.post('/login',AuthController.login);
router.post('/refreshToken',AuthController.refreshToken)
router.get('/tryHash',AuthController.testHash)
router.use(AuthController.authintcate)
router.use('/customer',Customer)
router.use('/menu',menu) 
router.use('/order',order) 
router.use('/address',address) 
router.use('/company',company) 

export default router;