import { SalesTargetController } from "@src/controller/app/dashboard/salesTarget.controller";
import express from "express";
const router = express.Router();

router.post('/list', SalesTargetController.getSalesTargetList);
router.get('/getTargetSales/:id?/summary', SalesTargetController.getTargetSales)
router.get('/getDailySalesTarget/:id?/daily', SalesTargetController.getDailySalesTarget)//
router.get('/getBranchSalesTarget/:id?/branches', SalesTargetController.getBranchSalesTarget)
router.post('/saveSalesTarget', SalesTargetController.saveSalesTarget)
//router.post('/saveBranchSalesTarget/:id/branches', SalesTargetController.saveBranchSalesTarget)


export default router;