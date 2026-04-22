
require('module-alias/register');
import { CompanyController } from "@src/controller/admin/company.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

import express from 'express';

const router = createAsyncRouter();
router.get('/getShippingSetting',CompanyController.getEcommorceShippingCountries)
router.get('/getShippingOptions/:cartId',CompanyController.getShippingOptions)
router.post('/setShippingPrice',CompanyController.setShippingPrice)
export default router;