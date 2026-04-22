import { ApiLimiterRepo } from "@src/apiLimiter";
import { BranchController } from "@src/controller/admin/branch.controller";
import { ServiceController } from "@src/controller/admin/service.controller";
import { TerminalController } from "@src/controller/app/Terminal/terminal.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

import express from 'express';
const router = createAsyncRouter();

router.get('/getBranchList',BranchController.getBranchesList)
router.get('/getAllCompanyBranches',BranchController.getAllCompanyBranches)
router.post('/getBranches',BranchController.getBranches)
router.post('/rearrangeBranches',BranchController.rearrangeBranches)
router.post('/getBranchConnectionList',BranchController.getBranchConnectionList)
router.get('/getBranch/:branchId',BranchController.getBranch)
router.post('/saveBranch',BranchController.addBranch)
router.post('/setBranchWorkingHours',BranchController.setBranchWorkingHours)
router.post('/setDefaultEcommerceBranch',BranchController.setDefaultEcommerceBranch)
router.post('/setMainBranch',BranchController.setMainBranch)
router.post('/setBranchLocation',BranchController.setBranchLocation)
router.post('/setCompanyZones',BranchController.setCompanyZones)
router.get('/getCoveredZones',BranchController.getCoveredZones)
// router.get('/getBranchServices/:branchId',ServiceController.getBranchServices)

router.post('/getServicList',ServiceController.getServicesList)
router.get('/getService/:serviceId',ServiceController.getService)
router.post('/saveService',ServiceController.saveService)
router.post('/arrangeServices',ServiceController.arrangeServices)
router.delete('/deleteService/:serviceId',ServiceController.deleteService)

router.post("/getTerminalToken",TerminalController.getTerminalToken)
export default router;