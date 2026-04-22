
require('module-alias/register');

import { BranchController } from '@src/controller/admin/branch.controller';
import { ServiceController } from '@src/controller/admin/service.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from 'express';

const router = createAsyncRouter();
router.get("/getBranchList",BranchController.getBranchesWithStatus)
router.get("/getBranchStatus/:branchId", BranchController.getBranchStatus)

router.get("/getBranchCoveredAddresses/:branchId",BranchController.getBranchCoveredAddresses)
router.get("/getServices/:branchId",ServiceController.getBranchServices) //TODO check this

export default router;