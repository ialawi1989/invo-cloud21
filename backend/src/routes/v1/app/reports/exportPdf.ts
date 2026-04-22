

import { CustomerReportsController } from "@src/controller/app/reports/customerReports.controller";
import { PaymentMethodReoportsController } from "@src/controller/app/reports/paymentMethodReports.controller";
import { ReportController } from "@src/controller/app/reports/reports.Controller";
import { salesReportsController } from "@src/controller/app/reports/SalesReports.controller";
import { SummaryReportsController } from "@src/controller/app/reports/SummaryReports.controller";
import { ReportRepo } from "@src/repo/reports/reports.repo";
import customizedReports from './customizedReports'
import express from "express";
import { purchaseReportsController } from "@src/controller/app/reports/purchaseReports.Controller";

import { vatReportRepo } from "@src/repo/reports/vatReports.report";
import { pdfExportController } from "@src/controller/app/reports/exportPdf.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
const router = createAsyncRouter();
router.post("/accountJournal",pdfExportController.export);
router.post("/accountJournals",pdfExportController.export);
 //overview
 router.post("/profitAndLoss",pdfExportController.exportProfitAndLoss);
 router.post("/balanceSheet",pdfExportController.exportBalanceSheet);
 router.post("/journalEntries",pdfExportController.export)
 router.post("/trialBalanceReport",pdfExportController.export)
 router.post("/generalLedgerReport",pdfExportController.export)
//sales 
 router.post("/salesSummary",pdfExportController.export2)
 router.post("/dailyClosingReport",pdfExportController.export2)
router.post("/salesByDepartment",pdfExportController.export)
router.post("/salesByCategory",pdfExportController.export)
router.post("/salesByProduct",pdfExportController.export)
router.post("/salesByProductCategory",pdfExportController.export)
router.post("/salesByProductVsOptions",pdfExportController.export)
router.post("/salesByService",pdfExportController.export)
router.post("/salesByProductVsService",pdfExportController.export)
router.post("/salesByMenu",pdfExportController.export)
router.post("/salesByMenuSections",pdfExportController.export)
router.post("/salesByTerminal",pdfExportController.export)
router.post("/salesByDeliveryArea",pdfExportController.export)
router.post("/salesByAggregator",pdfExportController.export)
router.post("/salesByAggregatorSubReport",pdfExportController.export)
router.post("/salesByInvoice",pdfExportController.export)
router.post("/salesByBrand",pdfExportController.export)
router.post("/zeroSalesProducts",pdfExportController.export)
router.post("/salesByServiceId",pdfExportController.export)

//inventory Reports
router.post("/generalInventoryReport",pdfExportController.export)
router.post("/salesVsInventoryUsage",pdfExportController.export)
router.post("/productSalesVsInventoryUsage",pdfExportController.export)
router.post("/productMovment",pdfExportController.export)
router.post("/wastageReport",pdfExportController.export)
router.post("/wastageSummaryReport",pdfExportController.export)
router.post("/inventoryTransferReport",pdfExportController.export)
router.post("/expiredProductsReport",pdfExportController.export)
router.post("/reorderReport",pdfExportController.export)



//customers Reports
router.post("/salesByCustomer",pdfExportController.export)
router.post("/customerBalanceSummary",pdfExportController.export)
router.post("/customerOrderHistory",pdfExportController.export)
router.post("/customerBalanceSummary",pdfExportController.export)
router.post("/customerOrderHistory",pdfExportController.export)
router.post("/customerWiseDiscountReport",pdfExportController.export)
router.post("/customerWiseItemSalesReport",pdfExportController.export)
router.post("/customerAgingReport",pdfExportController.export)
router.post("/paymentReceived",pdfExportController.export)
router.post("/creditNoteReport",pdfExportController.export)
router.post("/refundReport",pdfExportController.export)
router.post("/customerAgingSummaryReport",pdfExportController.export)




//suppliers Reports
router.post("/supplierBalanceSummary",pdfExportController.export)
router.post("/supplierAgingReport",pdfExportController.export)
router.post("/supplierChangePriceReport",pdfExportController.export)
router.post("/paymentMade",pdfExportController.export)
router.post("/supplierCreditReport",pdfExportController.export)
router.post("/supplierRefundReport",pdfExportController.export)
router.post("/supplierAgingSummaryReport",pdfExportController.export)


//employees Reports
router.post("/salesByEmployee",pdfExportController.export)
router.post("/salesByEmployeeVsProducts",pdfExportController.export)
router.post("/cashierReport",pdfExportController.export)
router.post("/shortOver",pdfExportController.export)
router.post("/cashierReportOverView",pdfExportController.export)
router.post("/cashierReportByCashierId",pdfExportController.export2)

router.post("/driverReport",pdfExportController.export)
router.post("/driverSummaryReport",pdfExportController.export)
router.post("/attendenceReport",pdfExportController.export)

//purchase Reports
router.post("/purchaseBySupplier",pdfExportController.export)
router.post("/purchaseByCategory",pdfExportController.export)

router.post("/purchaseByItem",pdfExportController.export)


//Tables Reports
router.post("/salesByTableGroup",pdfExportController.export)
router.post("/salesByTable",pdfExportController.export)
router.post("/tableUsage",pdfExportController.export)
router.post("/tableUsageSummary",pdfExportController.export)
router.post("/preparedTimeSummaryReport",pdfExportController.export)

//vat Reports
router.post("/vatReport",pdfExportController.export2);
router.post("/vatDetailsReport",pdfExportController.export);
router.post("/productWiseVatReport",pdfExportController.export);
router.post("/billOfEntryDetailsVatReport",pdfExportController.export);
router.post("/vatDetailsByVatId",pdfExportController.export);
router.post("/getPurchaseVatReport",ReportController.getPurchaseVatReport);

//others Reports
router.post("/paymentMethodReport",pdfExportController.export)
router.post("/productPreparedtimeSummary",pdfExportController.export)
router.post("/discountReport",pdfExportController.export);

router.post("/salesByDiscountId",pdfExportController.export);
router.post("/voidTransactions",pdfExportController.export);
router.post("/monthlyBLDBreakdown",pdfExportController.export)

router.post("/paymentTransactions",pdfExportController.export)
router.post("/salesByCustomerId",pdfExportController.export)
router.post("/purchaseBySupplierId",pdfExportController.export)
router.post("/dailyPaymentReport",pdfExportController.export)
//statments 
router.post("/customerStatment",pdfExportController.export);
router.post("/supplierStatment",pdfExportController.export);

//period Reports
router.post("/salesByPeriodReport",pdfExportController.export)

//expense
router.post("/expenseByCategory",ReportController.expenseByCategory);

//subReport
router.post("/salesVatDetailsByVatId",ReportController.salesVatDetailsByVatIdReport);







export default router;