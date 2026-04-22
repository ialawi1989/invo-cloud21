

import { CustomerReportsController } from "@src/controller/app/reports/customerReports.controller";
import { PaymentMethodReoportsController } from "@src/controller/app/reports/paymentMethodReports.controller";
import { ReportController } from "@src/controller/app/reports/reports.Controller";
import { salesReportsController } from "@src/controller/app/reports/SalesReports.controller";
import { SummaryReportsController } from "@src/controller/app/reports/SummaryReports.controller";
import { ReportRepo } from "@src/repo/reports/reports.repo";
import customizedReports from './customizedReports'
import express from "express";
import { purchaseReportsController } from "@src/controller/app/reports/purchaseReports.Controller";
import { xlsxExportController } from "@src/controller/app/reports/exportXlsx.controller";
import { vatReportRepo } from "@src/repo/reports/vatReports.report";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
const router = createAsyncRouter();
router.post("/accountJournal",xlsxExportController.export);
router.post("/accountJournals",xlsxExportController.export);
 //overview
 router.post("/profitAndLoss",xlsxExportController.exportProfitAndLoss);
 router.post("/balanceSheet",xlsxExportController.exportBlanceSheet);
 router.post("/journalEntries",xlsxExportController.export)
 router.post("/trialBalanceReport",xlsxExportController.export)
 router.post("/generalLedgerReport",xlsxExportController.export)
//sales 
router.post("/salesSummary",xlsxExportController.exportSalesSummary)
router.post("/dailyClosingReport",xlsxExportController.exportSalesSummary)
router.post("/salesByDepartment",xlsxExportController.export)
router.post("/salesByCategory",xlsxExportController.export)
router.post("/salesByProduct",xlsxExportController.export)
router.post("/salesByProductCategory",xlsxExportController.export)
router.post("/salesByProductVsOptions",xlsxExportController.export)
router.post("/salesByService",xlsxExportController.export)
router.post("/salesByProductVsService",xlsxExportController.export)
router.post("/salesByMenu",xlsxExportController.export)
router.post("/salesByMenuSections",xlsxExportController.export)
router.post("/salesByTerminal",xlsxExportController.export)
router.post("/salesByDeliveryArea",xlsxExportController.export)
router.post("/salesByAggregator",xlsxExportController.export)
router.post("/salesByAggregatorSubReport",xlsxExportController.export)
router.post("/salesByInvoice",xlsxExportController.export)
router.post("/salesByBrand",xlsxExportController.export)
router.post("/zeroSalesProducts",xlsxExportController.export)
router.post("/salesByServiceId",xlsxExportController.export)
//inventory Reports
router.post("/generalInventoryReport",xlsxExportController.export)
router.post("/salesVsInventoryUsage",xlsxExportController.export)
router.post("/productSalesVsInventoryUsage",xlsxExportController.export)
router.post("/productMovment",xlsxExportController.export)
router.post("/wastageReport",xlsxExportController.export)
router.post("/wastageSummaryReport",xlsxExportController.export)
router.post("/inventoryTransferReport",xlsxExportController.export)
router.post("/expiredProductsReport",xlsxExportController.export)
router.post("/reorderReport",xlsxExportController.export)


//customers Reports
router.post("/salesByCustomer",xlsxExportController.export)
router.post("/customerBalanceSummary",xlsxExportController.export)
router.post("/customerOrderHistory",xlsxExportController.export)
router.post("/customerBalanceSummary",xlsxExportController.export)
router.post("/customerOrderHistory",xlsxExportController.export)
router.post("/customerWiseDiscountReport",xlsxExportController.export)
router.post("/customerWiseItemSalesReport",xlsxExportController.export)
router.post("/customerAgingReport",xlsxExportController.export)
router.post("/paymentReceived",xlsxExportController.export)
router.post("/creditNoteReport",xlsxExportController.export)
router.post("/refundReport",xlsxExportController.export)
router.post("/customerAgingSummaryReport",xlsxExportController.export)
router.post("/getSupplierItems",xlsxExportController.export)




//suppliers Reports
router.post("/supplierBalanceSummary",xlsxExportController.export)
router.post("/supplierAgingReport",xlsxExportController.export)
router.post("/supplierChangePriceReport",xlsxExportController.export)
router.post("/paymentMade",xlsxExportController.export)
router.post("/supplierCreditReport",xlsxExportController.export)
router.post("/supplierRefundReport",xlsxExportController.export)
router.post("/supplierAgingSummaryReport",xlsxExportController.export)


//employees Reports
router.post("/salesByEmployee",xlsxExportController.export)
router.post("/salesByEmployeeVsProducts",xlsxExportController.export)
router.post("/cashierReport",xlsxExportController.export)
router.post("/shortOver",xlsxExportController.export)
router.post("/cashierReportOverView",xlsxExportController.export)
router.post("/cashierReportByCashierId",xlsxExportController.exportSalesSummary)

router.post("/driverReport",xlsxExportController.export)
router.post("/driverSummaryReport",xlsxExportController.export)

//purchase Reports
router.post("/purchaseBySupplier",xlsxExportController.export)
router.post("/purchaseByCategory",xlsxExportController.export)

router.post("/purchaseByItem",xlsxExportController.export)


//Tables Reports
router.post("/salesByTableGroup",xlsxExportController.export)
router.post("/salesByTable",xlsxExportController.export)
router.post("/tableUsage",xlsxExportController.export)
router.post("/tableUsageSummary",xlsxExportController.export)
router.post("/preparedTimeSummaryReport",xlsxExportController.export)

//vat Reports
router.post("/vatReport",xlsxExportController.vatReportExport);
router.post("/vatDetailsReport",xlsxExportController.export);
router.post("/productWiseVatReport",xlsxExportController.export);
router.post("/billOfEntryDetailsVatReport",xlsxExportController.export);
router.post("/vatDetailsByVatId",xlsxExportController.export);
router.post("/getPurchaseVatReport",ReportController.getPurchaseVatReport);

//others Reports
router.post("/paymentMethodReport",xlsxExportController.export)
router.post("/productPreparedtimeSummary",xlsxExportController.export)
router.post("/discountReport",xlsxExportController.export);
router.post("/salesByDiscountId",xlsxExportController.export);
router.post("/voidTransactions",xlsxExportController.export);
router.post("/monthlyBLDBreakdown",xlsxExportController.export)

router.post("/paymentTransactions",xlsxExportController.export)
router.post("/dailyPaymentReport",xlsxExportController.export)
router.post("/salesByCustomerId",xlsxExportController.export)
router.post("/purchaseBySupplierId",xlsxExportController.export)
router.post("/departmentSalesAndPaymentsOverview",xlsxExportController.export)
router.post("/reorderAlertReport",xlsxExportController.export)

//statments 
router.post("/customerStatment",xlsxExportController.export);
router.post("/supplierStatment",xlsxExportController.export);

//period Reports
router.post("/salesByPeriodReport",xlsxExportController.export)

//expense
router.post("/expenseByCategory",ReportController.expenseByCategory);

//subReport
router.post("/salesVatDetailsByVatId",ReportController.salesVatDetailsByVatIdReport);



router.post("/attendenceReport",xlsxExportController.export)



export default router;