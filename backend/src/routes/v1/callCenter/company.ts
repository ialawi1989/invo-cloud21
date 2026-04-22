require('module-alias/register');
import { BranchController } from '@src/controller/callCenter/branch.controller';
import { CompanyController } from '@src/controller/admin/company.controller';
import { EmployeeController } from '@src/controller/admin/employee.controller';
import { TaxController } from '@src/controller/app/Accounts/tax.controller';
import { CallCenterCompanyController } from '@src/controller/callCenter/company.controller';


import express from "express";
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
// import { ProductController } from "@src/controller/app/products/product.controller";
export const router = createAsyncRouter();
router.get("/getCompanySetting",CompanyController.getCompanySetting);
router.get("/getCompanyPrefrences",CallCenterCompanyController .getCompanyPrefrences)
router.get("/getCoveredAddresses",CallCenterCompanyController .getCoveredAddresses)
router.get("/getDiscountList",CallCenterCompanyController .getDiscountList)
router.get("/getCoveredAddresses2",CallCenterCompanyController .getCoveredAddresses2)

router.post ('/getTaxesList',TaxController.getTaxesList)
router.post('/getEmployeeList',EmployeeController.getEmployeeList)
router.get('/getBranchList',BranchController.getBranchesList)
router.get('/getEmployeePrivielges', CallCenterCompanyController.getEmployeePrivielges)





export default router;