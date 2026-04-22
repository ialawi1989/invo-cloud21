import { DashboardController } from "@src/controller/app/dashboard/dashboard.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import { MiddleWareHelper } from "@src/middlewear/middilewareHelper";
import express from "express";

const router = createAsyncRouter();
// router.get("/test", (req, res, next) => {

// });



router.use(MiddleWareHelper.setTimeOffset())

router.post('/AgeingReport', DashboardController.AgeingReport)


router.post('/BranchSales', DashboardController.BranchSales)
router.post('/getSalesByService', DashboardController.getSalesByService)
router.post('/getSalesByEmployee', DashboardController.getSalesByEmployee)
router.post('/topItemBySales', DashboardController.topItemBySales)
router.post('/topCategoryBySales', DashboardController.topCategoryBySales)
router.post('/topDepartmentBySales', DashboardController.topDepartmentBySales)
router.post('/salesByDay', DashboardController.salesByDay)
router.post('/salesByTime', DashboardController.salesByTime)
router.post('/getTotalGuests', DashboardController.getTotalGuests)
router.post('/getOpenInvoices', DashboardController.getTotalOpenInvoices)
router.post('/topBrandBySales', DashboardController.topBrandBySales)
router.post('/salesBySource', DashboardController.salesBySource)
router.post('/onlineInvoices', DashboardController.onlineInvoices) //pending accept reject
router.post('/TopCustomers', DashboardController.TopCustomers)
router.get('/NewCustomers', DashboardController.NewCustomers)
router.post('/PaymentMethodOverView', DashboardController.PaymentMethodOverView)
// router.post('/Last12MonthSales', DashboardController.Last12MonthSales)

router.post('/numberOfOpenCashiers/',DashboardController.numberOfOpenCashiers)

export default router;