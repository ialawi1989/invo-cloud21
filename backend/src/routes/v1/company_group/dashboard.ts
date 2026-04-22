import express from "express";
import { MiddleWareHelper } from "@src/middlewear/middilewareHelper";
import { DashboardController } from "@src/controller/companyGroup/dashboard/dashboard.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

const router = createAsyncRouter();
router.use(MiddleWareHelper.setTimeOffset())

router.post('/companiesSales', DashboardController.companiesSales)
router.post('/companiesPaymentsOverview', DashboardController.companiesPaymentsOverview)

export default router;