

require('module-alias/register');

import { BranchController } from '@src/controller/admin/branch.controller';
import { CompanyController } from '@src/controller/admin/company.controller';
import { AddressController } from '@src/controller/callCenter/address.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import  express from 'express';

const router = createAsyncRouter();

router.get("/getBranchCoveredAddresses/:branchId",AddressController.getBranchCoveredAddresses);
router.get("/getCompanyAddresses",CompanyController.getCompanyAddresses);



export default router;