

import { CustomerReportsController } from "@src/controller/app/reports/customerReports.controller";
import { PaymentMethodReoportsController } from "@src/controller/app/reports/paymentMethodReports.controller";
import { ReportController } from "@src/controller/app/reports/reports.Controller";
import { salesReportsController } from "@src/controller/app/reports/SalesReports.controller";
import { SummaryReportsController } from "@src/controller/app/reports/SummaryReports.controller";
import { ReportRepo } from "@src/repo/reports/reports.repo";
import customizedReports from './customizedReports'
import express from "express";
import { purchaseReportsController } from "@src/controller/app/reports/purchaseReports.Controller";

import exportXlsx from "./exportXlsx";
import { supplierReoportsController } from "@src/controller/app/reports/supplierReports.controller";
import exportPdf from "./exportPdf";
import { AttendanceController } from "@src/controller/app/Settings/attendance.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
const router = createAsyncRouter();

router.post("/getBalanceSheet",ReportController.getBalanceSheet)
router.post("/getLossAndProfit",ReportController.getLossAndProfit)
router.post("/getBalanceBasisAccrual",ReportController.getBalanceBasisAccrual)
router.post("/getJournalEntries",ReportController.getJournalEntries)


//Sales
router.post("/salesByService",salesReportsController.getSalesByService)
router.post("/salesByPeriod",salesReportsController.getSalesByPeriod)
router.post("/salesByTerminal",salesReportsController.salesByTerminal)
router.post("/salesByTables",salesReportsController.salesByTables)
router.post("/salesByTableGroups",salesReportsController.salesByTableGroups)
router.post("/preparedTimeSummary",salesReportsController.preparedTimeSummary)
router.post("/SalesByDeliveryArea",salesReportsController.SalesByDeliveryArea)
router.post("/salesByProductsVsOptions",salesReportsController.salesByMenuItemsProductsVsOptions)
router.post("/salesByServiceVsProducts",salesReportsController.salesByServiceVsMenuItemProducts)

//Employee
router.post("/salesByEmployeeVsProduct",salesReportsController.salesByEmployeeVsProduct)
router.post("/salesByEmployee",salesReportsController.salesByEmployee)
router.post("/cashierReport",salesReportsController.cashierReport)
router.post("/driverDetailsReport",salesReportsController.driverDetailsReport)
router.post("/driverReport",salesReportsController.driverReport)

//reports
router.post("/customerOrderHistory",CustomerReportsController.getCustomerOrderHistory)
router.post("/paymentMethodReport",PaymentMethodReoportsController.paymentMethodReport)
router.post("/payoutsReport",PaymentMethodReoportsController.payoutsReport)

//Menu Reports 
router.post("/salesByCategory",salesReportsController.getSalesByCategory)
router.post("/salesByDepartment",salesReportsController.getSalesByDepartment)
router.post("/salesByProduct",salesReportsController.salesByProduct)


router.post("/salesByMenu",salesReportsController.salesByMenu)
router.post("/salesByMenuSections",salesReportsController.salesByMenuSections)
router.post("/salesByProductsCategory",salesReportsController.salesByMenuProductsCategory)


//Inventoy Reports 
router.post("/generalInventoryReport",salesReportsController.generalInventoryReport)
router.post("/productMovment",salesReportsController.productMovment)
router.post("/salesVsInventoryUsage",salesReportsController.salesVsInventoryUsage)
router.post("/productSalesVsInventoryUsage",salesReportsController.productSalesVsInventoryUsage)
router.post("/productInventoryUsage",salesReportsController.productInventoryUsage)
router.post("/productWastageReports",salesReportsController.productWastageReports)
router.post("/productWastageSummaryReports",salesReportsController.productWastageSummaryReport)

//other Reports 
router.post("/productPreparedTimeSummary",salesReportsController.productPreparedTimeSummary)
router.post("/shortOverReport",salesReportsController.shortOverReport)
router.post("/getSalesDiscountReport",ReportController.getSalesDiscountReport);

router.use(customizedReports)

//summary Reports 
router.post("/summary/getSalesByCategory",SummaryReportsController.getSalesByCategory)
router.post("/summary/static",SummaryReportsController.stats)
router.post("/summary/paymentReceived",SummaryReportsController.paymentReceived)
router.post("/summary/discount",SummaryReportsController.discount)
router.post("/summary/getSalesByServices",SummaryReportsController.getSalesByServices)
router.post("/summary/taxDetails",SummaryReportsController.taxDetails)




//aging Report
router.post("/customerAgingReportGraph",ReportController.customerAgingReportGraph);
router.post("/customerAgingReport",ReportController.customerAgingReportRecordes);
router.post("/aginigReportByCustomer",ReportController.agingReportByCustomer);
router.post("/customerSummaryAgingReport",ReportController.customerSummaryAgingReport);
router.post("/supplierAgingReportGraph",ReportController.supplierAgingReportGraph);
router.post("/supplierAgingReport",ReportController.supplierAgingReportRecordes);
router.post("/supplierAgingSummaryReport",ReportController.suppliersSummaryAgingReport);
router.post("/aginigReportBySupplier",ReportController.aginigReportBySupplier);

router.post("/salesVatReport",ReportController.salesVatReport);
router.post("/purchaseVatReport",ReportController.purchaseVatReport);
router.post("/getVatDetailsReport",ReportController.getVatDetailsReport);
router.post("/getSalesVatDetailsByVatId",ReportController.getSalesVatDetailsByVatId);
router.post("/getPurchaseVatDetailsByVatId",ReportController.getPurchaseVatDetailsByVatId);

router.post("/monthlyBLDBreakdown",ReportController.monthlyBLDBreakdown)
router.post("/profitAndLossMonthWiseComparison",ReportController.profitAndLossMonthWiseComparison);

/**New Filter Reports */

 //overview
router.post("/balanceSheetReport",ReportController.balanceSheetReport);
router.post("/profitAndLossReport",ReportController.profitAndLossReport);
router.post("/trialBalanceReport",ReportController.trialBalanceReport)
router.post("/generalLedgerReport",ReportController.generalLedgerReport)
router.post("/journalEntriesReports",ReportController.journalEntriesReports)

//sales Reports
router.post("/salesByServices",salesReportsController.salesByServices)
router.post("/salesByItemReport",salesReportsController.salesByItemReport)
router.post("/salesByDepartments",salesReportsController.salesByDepartments)
router.post("/salesByCategoryReport",salesReportsController.getSalesByCategoryReport)
router.post("/salesByBrand",salesReportsController.SalesByBrand)
router.post("/zeroSalesProducts",salesReportsController.zeroSalesProducts)

router.post("/salesByMenuReport",salesReportsController.salesByMenuReport)
router.post("/salesByMenuSectionsReport",salesReportsController.salesByMenuSectionsReport)

router.post("/salesByProductCategory",salesReportsController.salesByProductCategory)
router.post("/salesByMenuProductVsOptions",salesReportsController.salesByMenuProductVsOptions)
router.post("/salesByMenuProductVsService",salesReportsController.salesByMenuProductVsService)

router.post("/salesByTerminals",salesReportsController.salesByTerminals)
router.post("/getSalesByDeliveryArea",salesReportsController.getSalesByDeliveryArea)
router.post("/salesByAggregatorReport",salesReportsController.salesByAggregatorReport)
router.post("/salesByInvoice",salesReportsController.salesByInvoice)

router.post("/getdailySalesReport",salesReportsController.getdailySalesReport)
router.post("/salesByServiceId",salesReportsController.salesByServiceId)

//customers Reports
router.post("/salesByCustomer",CustomerReportsController.salesByCustomer)
router.post("/salesByCustomerId",CustomerReportsController.salesByCustomerId)
router.post("/customerBalance",CustomerReportsController.customerBalance)
router.post("/customerAgingReports",ReportController.customerAgingReport)
router.post("/customerSummaryAgingReports",ReportController.customerAgingReportSummary)
router.post("/customerOrderHistoryReport",CustomerReportsController.customerOrderHistory) /**new reports */
router.post("/paymentReceived",CustomerReportsController.paymentReceived)
router.post("/creditNoteReport",CustomerReportsController.creditNoteReport)
router.post("/refundReport",CustomerReportsController.refundReport)
router.post("/customerWiseDiscountReport",CustomerReportsController.clientWiseDiscountReport)
router.post("/customerWiseItemSalesReport",CustomerReportsController.clientWiseItemSalesReport)

//suppliers Reports
router.post("/getSupplierAgingReport",ReportController.supplierAgingReport)
router.post("/supplierAgingReportSummary",ReportController.supplierAgingReportSummary)
router.post("/supplierBalances",ReportController.supplierBalances)
router.post("/paymentMade",supplierReoportsController.paymentMade)
router.post("/supplierCreditReport",supplierReoportsController.supplierCreditReport)
router.post("/supplierRefundReport",supplierReoportsController.supplierRefundReport)
router.post("/supplierChangePriceReport",supplierReoportsController.supplierChangePriceReport)

//purchase Reports
router.post("/purchaseBySupplier",purchaseReportsController.purchaseBySupplier)
router.post("/purchaseBySupplierId",purchaseReportsController.purchaseBySupplierId)
router.post("/purchaseByItem",purchaseReportsController.purchaseByItem)
router.post("/purchaseByCategory",purchaseReportsController.purchaseByCategory)
router.post("/openPendingPOReport",purchaseReportsController.openPendingPOReport)

//employees Reports
router.post("/salesByEmployeeReport",salesReportsController.salesByEmployeeReport)
router.post("/salesByProductVsEmployee",salesReportsController.salesByProductVsEmployee)
router.post("/getDriverReport",salesReportsController.getDriverReport)
router.post('/getAttendanceReport',AttendanceController.getAttendanceReport)
router.post("/getDriverDetailsReport",salesReportsController.getDriverDetailsReport)
router.post("/getCashierReport",salesReportsController.getCashierReport)
router.post("/shortOver",salesReportsController.shortOver)
router.post("/cashierList",salesReportsController.cashierList)
router.post("/cashierReportByCashierId",salesReportsController.cashierReportByCashierId)

//Tables Reports
router.post("/getSalesByTableGroups",salesReportsController.getSalesByTableGroups)
router.post("/getSalesByTables",salesReportsController.getSalesByTables)
router.post("/tableUsage",salesReportsController.tableUsage)
router.post("/tableUsageSummary",salesReportsController.tableUsageSummary)

//vat Reports
router.post("/getSalesVatReport",ReportController.getSalesVatReport);
router.post("/getPurchaseVatReport",ReportController.getPurchaseVatReport);
router.post("/vatDetailsReport",ReportController.vatDetailsReport);
router.post("/productWiseVatReport",ReportController.productWiseVatReport);
router.post("/taxTransactionDetailsReport",ReportController.taxTransactionDetailsReport);

//period Reports
router.post("/salesByPeriodReport",salesReportsController.salesByPeriodReport)

//inventory Reports
router.post("/getGeneralInventoryReport",salesReportsController.getGeneralInventoryReport)
router.post("/salesVsInventoryUsageReport",salesReportsController.salesVsInventoryUsageReport)
router.post("/productInventoryUsageReport",salesReportsController.productInventoryUsageReport)
router.post("/productSalesVsInventoryUsageReport",salesReportsController.productSalesVsInventoryUsageReport)
router.post("/productMovementReport",salesReportsController.productMovementReport)
router.post("/productWastageReport",salesReportsController.productWastageReport)
router.post("/wastageSummaryReport",salesReportsController.wastageSummaryReport)
router.get("/getManualAdjusmentInventoryMovment/:movmentLineId",salesReportsController.getManualAdjusmentInventoryMovment)
router.post("/inventoryTransferReport",salesReportsController.inventoryTransferReport)
router.post("/expiredProductsReport",salesReportsController.expiredProductsReport)
router.post("/reorderReport",salesReportsController.reorderReport)


//others Reports
router.post("/getPaymentMethodReport",PaymentMethodReoportsController.getPaymentMethodReport)
router.post("/productPreparedTimeSummaryReport",salesReportsController.productPreparedTimeSummaryReport)
router.post("/preparedTimeSummaryReport",salesReportsController.preparedTimeSummaryReport)
router.post("/monthlyBLDBreakdownReport",ReportController.monthlyBLDBreakdownReport)
router.post("/salesDiscountReport",ReportController.salesDiscountReport);
router.post("/voidTransactionsReport",ReportController.voidTransactionsReport);
router.post("/dailyPaymentReport",PaymentMethodReoportsController.dailyPaymentReport);
router.post("/departmentSalesAndPaymentsOverview",ReportController.departmentSalesAndPaymentsOverview);
router.post("/reorderAlertReport",ReportController.reorderAlertReport);


//--subReports
router.post("/paymentTransactions",PaymentMethodReoportsController.paymentTransactions)




//expense
router.post("/expenseByCategory",ReportController.expenseByCategory);

//subReport
router.post("/accountJournal",ReportController.accountJournal);
router.post("/salesVatDetailsByVatId",ReportController.salesVatDetailsByVatIdReport);
router.post("/purchaseVatDetailsByVatId",ReportController.purchaseVatDetailsByVatIdReport);
router.post("/billOfEntryDetailsVatReport",ReportController.billOfEntryDetailsVatReport);
router.post("/vatReportByProductId",ReportController.vatReportByProductId);
router.post("/salesByAggregatorSubReport",salesReportsController.salesByAggregatorSubReport)
router.post("/salesByDiscountId",ReportController.salesByDiscountId);

router.use("/exportPdf",exportPdf)
router.use("/export",exportXlsx)
router.post("/exportReport",salesReportsController.salesByDepartments)


export default router;