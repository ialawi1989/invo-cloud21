require('module-alias/register');
import { ApiLimiterRepo } from '@src/apiLimiter';
import { CustomerController } from '@src/controller/callCenter/customer.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from "express";

export const router = createAsyncRouter();
router.post('/GetSuggestion', CustomerController.getSuggestion);
router.get('/getCustomerById/:customerId', CustomerController.getCustomerById);
router.get('/getCustomerByNumber/:number', CustomerController.getCustomerByNumber);
router.post('/getBranchByCustomerAddress', CustomerController.getBranchByCustomerAddress);
router.post('/saveCustomer', CustomerController.addCustomer);
export default router;