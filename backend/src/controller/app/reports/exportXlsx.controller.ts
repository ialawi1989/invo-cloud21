import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { ComparisonReportsRepo } from '@src/repo/reports/Comparison.report';
import { ReportRepo } from '@src/repo/reports/reports.repo';
import { vatReportRepo } from '@src/repo/reports/vatReports.report';
import { expenseReport } from '@src/repo/reports/ExpenseReports.report';
import express, { Request, Response, NextFunction } from 'express';
import { purchaseReport } from '@src/repo/reports/Purchase.report';

import fs from 'fs';
import { DataColumn, ReportData, TableReportData, XLSXGenerator } from '@src/utilts/xlsxGenerator';
import { MenuReports } from '@src/repo/reports/menu.report';
import { SalesRepots } from '@src/repo/reports/Sales.reports';
import { buffer } from 'stream/consumers';
import { InvenoryReports } from '@src/repo/reports/inventory.reports';
import { CustomerReports } from '@src/repo/reports/customer.report';
import { EmployeeReports } from '@src/repo/reports/employee.reports';
import { options } from 'pdfkit';
import { PaymentMethodReports } from '@src/repo/reports/paymentMethod.reports';
import { SummaryReport } from '@src/repo/reports/Summary.report';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import { CustomerRepo } from '@src/repo/app/accounts/customer.repo';
import { SupplierRepo } from '@src/repo/app/accounts/supplier.repo';
import { SuppliersReports } from '@src/repo/reports/supplier.reports';
import { dailySalesReport } from '@src/repo/reports/dailySalesReport';
import { ReportsPDFGenerator } from '@src/utilts/ReportPDFGenerator';
import { AttendanceRepo } from '@src/repo/app/settings/attendance.repo';


export class xlsxExportController {


  public static async export(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      const branches = res.locals.branches


      if (data.filter != null && data.filter != undefined) {
        data.filter.export = true
      } else {
        data.export = true
      }
      const report = req.url

      let reportData;
      let salesVat;
      let purchaseVat;
      switch (report.toLowerCase()) {
        case "/profitandloss":
          reportData = (await ComparisonReportsRepo.getProfitAndLossReport(data, company, branches));
          break;
        case "/balancesheet":
          reportData = (await ComparisonReportsRepo.balanceSheetReport(data, company, branches));
          break;
        case "/trialbalancereport":
          reportData = (await ComparisonReportsRepo.trialBalanceReport(data, company, branches));
          break;
        case "/generalledgerreport":
          reportData = (await ComparisonReportsRepo.generalLedgerReport(data, company, branches));
          break;
        case "/journalentries":
          reportData = (await ReportRepo.journalEntriesReports(data, company, branches));
          break;

        //#########################################################
        case "/salesbydepartment":
          reportData = (await MenuReports.salesByDepartments(data, company, branches));
          break;
        case "/salesbycategory":
          reportData = (await MenuReports.SalesByCategoryReport(data, company, branches));
          break;
        case "/salesbyproduct":
          reportData = (await MenuReports.salesByProductReport(data, company, branches));
          break;
        case "/salesbyproductcategory":
          reportData = (await MenuReports.salesByProductCategory(data, company, branches));
          break;
        case "/salesbyproductvsoptions":
          reportData = (await MenuReports.salesByMenuProductVsOptions(data, company, branches));
          break;
        case "/salesbyservice":
          reportData = (await MenuReports.salesByServices(data, company, branches));
          break;
        case "/salesbyproductvsservice":
          reportData = (await MenuReports.salesByMenuProductVsService(data, company, branches));
          break;
        case "/salesbymenu":
          reportData = (await MenuReports.salesByMenuReport(data, company, branches));
          break;
        case "/salesbymenusections":
          reportData = (await MenuReports.salesByMenuSectionsReport(data, company, branches));
          break;
        case "/salesbyterminal":
          reportData = (await SalesRepots.salesByTerminals(data, company, branches));
          break;
        case "/salesbydeliveryarea":
          reportData = (await SalesRepots.getSalesByDeliveryArea(data, company, branches));
          break;
        case "/salesbyaggregator":
          reportData = (await SalesRepots.salesByAggregatorReport(data, company, branches));
          break;
        case "/salesbyinvoice":
          reportData = (await SalesRepots.salesByInvoice(data, company, branches));
          break;
        case "/salesbybrand":
          reportData = (await MenuReports.SalesByBrandReport(data, company, branches));
          break;
        case "/salesbyperiodreport":
          reportData = (await SalesRepots.salesByPeriodReport(data, company, null, branches));
          break;

        case "/salesbyaggregatorsubreport":
          reportData = (await SalesRepots.aggregatorSubReport(data, company, branches));
          break;
        case "/salesbyserviceid":
          reportData = (await SalesRepots.salesByServiceId(data, company, branches));
          break;

        //#########################################################
        case "/generalinventoryreport":
          reportData = (await InvenoryReports.getGeneralInventoryReport(data, company, branches));
          break;
        case "/salesvsinventoryusage":
          reportData = (await InvenoryReports.salesVsInventoryUsageReport(data, company, branches));
          break;
        case "/productsalesvsinventoryusage":
          reportData = (await InvenoryReports.productSalesVsInventoryUsageReport(data, company, branches));
          break;
        case "/productmovment":
          reportData = (await InvenoryReports.productMovmentReport(data, company, branches));
          break;
        case "/wastagereport":
          reportData = (await InvenoryReports.productWastageReport(data, company, branches));
          break;
        case "/wastagesummaryreport":
          reportData = (await InvenoryReports.wastageSummaryReport(data, company, branches));
          break;
        case "/inventorytransferreport":
          reportData = (await InvenoryReports.inventoryTransferReport(data, company, branches));
          break;
        case "/expiredproductsreport":
          reportData = (await InvenoryReports.expiredProductsReport(data, company, branches));
          break;
        case "/reorderreport":
          reportData = (await InvenoryReports.reorderReport(data, company, branches));
          break;
        //#########################################################
        case "/customerorderhistory":
          reportData = (await CustomerReports.customerOrderHistory(data, company, branches));
          break;
        case "/salesbycustomer":
          reportData = (await CustomerReports.salesByCustomer(data, company, branches));
          break;
        case "/customerbalancesummary":
          reportData = (await CustomerReports.customerBalance(data, company, branches));
          break;
        case "/customerwisediscountreport":
          reportData = (await CustomerReports.clientWiseDiscountReport(data, company, branches));
          break;
        case "/customerwiseitemsalesreport":
          reportData = (await CustomerReports.clientWiseItemSalesReport(data, company, branches));
          break;
        case "/customeragingreport":
          reportData = (await ReportRepo.customerAgingReport(data, company, branches));
          break;
        case "/paymentreceived":
          reportData = (await CustomerReports.paymentReceived(data, company, branches));
          break;
        case "/creditnotereport":
          reportData = (await CustomerReports.creditNoteReport(data, company, branches));
          break;
        case "/refundreport":
          reportData = (await CustomerReports.refundReport(data, company, branches));
          break;
        case "/salesbycustomerid":
          reportData = (await CustomerReports.salesByCustomerId(data, company, branches));
          break;
        case "/customeragingsummaryreport":
          reportData = (await ReportRepo.customerAgingReportSummary(data, company, branches));
          break;
        //#########################################################
        case "/supplierbalancesummary":
          reportData = (await ReportRepo.supplierBalances(data, company, branches));
          break;
        case "/supplierchangepricereport":
          reportData = (await SuppliersReports.supplierChangePriceReport(data, company, branches));
          break;
        case "/supplieragingreport":
          reportData = (await ReportRepo.supplierAgingReport(data, company, branches));
          break;
        case "/paymentmade":
          reportData = (await SuppliersReports.paymentMade(data, company, branches));
          break;
        case "/suppliercreditreport":
          reportData = (await SuppliersReports.supplierCreditReport(data, company, branches));
          break;
        case "/supplierrefundreport":
          reportData = (await SuppliersReports.supplierRefundReport(data, company, branches));
          break;


        case "/supplieragingsummaryreport":
          reportData = (await ReportRepo.supplierAgingReportSummary(data, company, branches));
          break;

        //#########################################################
        case "/salesbyemployee":
          reportData = (await EmployeeReports.salesByEmployeeReport(data, company, branches));
          break;
        case "/salesbyemployeevsproducts":
          reportData = (await EmployeeReports.salesByProductVsEmployee(data, company, branches));
          break;
        case "/cashierreport":
          reportData = (await EmployeeReports.getCashierReport(data, company, branches));
          break;
        case "/shortover":
          reportData = (await EmployeeReports.shortOver(data, company, branches));
          break;
        case "/cashierlist":
          reportData = (await EmployeeReports.cashierList(data, company, branches));
          break;

        case "/driversummaryreport":
          reportData = (await EmployeeReports.getDriverReport(data, company, branches));
          break;
        case "/driverreport":
          reportData = (await EmployeeReports.getDriverDetailsReport(data, company, branches));
          break;

        //#########################################################
        case "/purchasebysupplier":
          reportData = (await purchaseReport.purchaseBySupplier(data, company, branches));
          break;
        case "/purchasebycategory":
          reportData = (await purchaseReport.purchaseByCategory(data, company));
          break;
        case "/openPendingPOReport":
          reportData = (await purchaseReport.openPendingPOReport(data, company, branches));
          break;
        case "/purchasebysupplierid":
          reportData = (await purchaseReport.purchaseBySupplierId(data, company, branches));
          break;
        case "/purchasebyitem":
          if (data.filter && data.filter.productId)
            reportData = await purchaseReport.purchaseByItemId(data, company, data.filter.productId, branches)
          else
            reportData = await purchaseReport.purchaseByItem(data, company, branches);
          break;


        //#########################################################
        case "/vatdetailsreport":
          reportData = (await vatReportRepo.vatDetailsReport(data, company, branches));
          break;
        case "/vatdetailsbyvatid":

          if (data.filter && data.filter.type == 'purchase')
            reportData = (await vatReportRepo.purchaseVatDetailsByVatIdReport(data, company, branches));
          else
            reportData = (await vatReportRepo.salesVatDetailsByVatIdReport(data, company, branches));
          break;
        case "/productwisevatreport":

          if (data.filter && data.filter.productId)
            reportData = (await vatReportRepo.vatReportByProductId(data, company, branches));
          else
            reportData = (await vatReportRepo.productWiseVatReport(data, company, branches));
          break;


        //#########################################################
        case "/salesbytable":
          reportData = (await SalesRepots.getSalesByTables(data, company, branches));
          break;
        case "/salesbytablegroup":
          reportData = (await SalesRepots.getSalesByTableGroups(data, company, branches));
          break;
        case "/tableusage":
          reportData = (await SalesRepots.tableUsage(data, company, branches));
          break;
        // need to checkFormat
        case "/tableusagesummary":
          reportData = (await SalesRepots.tableUsageSummary(data, company, branches));
          break;

        //#########################################################
        case "/paymentmethodreport":
          reportData = await PaymentMethodReports.getPaymentMethodReport2(data, company, branches)
          break;
        case "/productpreparedtimesummary":
          reportData = (await MenuReports.productPreparedTimeSummaryReport(data, company, branches));
          break;
        case "/preparedtimesummaryreport":
          reportData = (await MenuReports.preparedTimeSummaryReport(data, company, branches));
          break;
        case "/discountreport":
          reportData = (await ReportRepo.salesDiscountReport(data, company, branches));
          break;
        case "/salesbydiscountid":
          reportData = (await ReportRepo.salesByDiscountId(data, company, branches));
          break;
        case "/monthlybldbreakdown":
          reportData = (await ReportRepo.monthlyBLDBreakdownReport(data, company, branches));
          break;
        case "/voidtransactions":
          reportData = (await ReportRepo.voidTransactionsReport(data, company, branches));
          break;
        case "/zerosalesproducts":
          reportData = (await MenuReports.zeroSalesProducts(data, company, branches));
          break;

        case "/dailypaymentreport":
          reportData = await PaymentMethodReports.dailyPaymentReport(data, company, branches)
          break;

        case "/departmentsalesandpaymentsoverview":
          reportData = await ReportRepo.departmentSalesAndPaymentsOverview(data, company, branches)
          break;

        case "/reorderalertreport":
          reportData = await ReportRepo.reorderAlertReport(data, company, branches)
          break;




        case "/paymenttransactions":
          reportData = await PaymentMethodReports.paymentTransactions(data, company, branches)
          break;

        case "/accountjournal":


          reportData = (await AccountsRepo.getAccountJournals(data, company, branches));
          break;
        case "/accountjournals":
          let account = await AccountsRepo.checkAccountJournal(data.filter.accountId);
          console.log(account)
          if (account.type == 'Inventory Assets' && account.default) {
            data.account = account
            reportData = (await ReportRepo.getInventoryAssetsJournals(data, company, branches));
          } else if (account.type == 'Costs Of Goods Sold' && account.default) {
            data.account = account
            reportData = (await ReportRepo.getCostOfGoodSolds(data, company, branches));
          } else {
            reportData = (await ReportRepo.accountJournal(data, company, branches));
          }

          break;
        case "/customerstatment":
          reportData = (await CustomerRepo.customerStatement(data, company));
          break;
        case "/supplierstatment":
          reportData = (await SupplierRepo.supplierStatement(data, company));
          break;
        case "/getsupplieritems":
          reportData = (await SupplierRepo.getSupplierItemsBySupplierId(data, company));
          break;
        case "/attendencereport":
          reportData = (await AttendanceRepo.attendanceReport(data, company, branches));
          break;
        case "/billofentrydetailsvatreport":
          reportData = (await vatReportRepo.billOfEntryDetailsVatReport(data, company, branches));
          break;
        default:
          break;
      }

      console.log(reportData)

      if (reportData) {
        let resData: any;
        const agingReports = ["/customeragingreport", "/supplieragingreport"];
        const agingSummaryReports = ["/customeragingsummaryreport","/supplieragingsummaryreport"]
        if (agingReports.includes(report.toLowerCase())) {
          resData = await XLSXGenerator.exportGroupedDynamicToExcel(reportData.data, company);
        } else if (agingSummaryReports.includes(report.toLowerCase())) {
          resData = await XLSXGenerator.exportDynamicAgingSummaryReport(reportData.data.records,reportData.data.ranges,reportData.data.filter,reportData.data.showFilter,company,reportData.data.options);
        } else {
          resData = await XLSXGenerator.exportToExcel(reportData.data, company);
        }

        // Send the file as a response
        res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
        res.setHeader('Content-Type', resData.type);
        const fileStream = fs.createReadStream(resData.fileName);
        fileStream.pipe(res);


        res.on('finish', () => {
          fs.unlinkSync(resData.fileName);
        });

        return new ResponseData(true, "", [])
      }

      return new ResponseData(false, "", [])







    } catch (error: any) {
        throw error
    }
  }

  public static async exportSalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      const branches = res.locals.branches
      data.filter.export = true
      const report = req.url
      let tt = new TableReportData;
      let reportData: any



      switch (report.toLowerCase()) {
        case "/salessummary":
          let mainData = (await SummaryReport.getSalesByCategory(data, company, branches)).data
          reportData = (await SummaryReport.getSalesByCategory(data, company, branches)).data
          let payment = (await SummaryReport.received(data, company, branches)).data
          let stats = (await SummaryReport.stats(data, company, branches)).data
          const totalActualAmountPaid = payment.records.reduce((sum: number, record: any) => {
            return sum + (record?.ActualAmountPaid ?? 0);
          }, 0);
          const refund = stats.refund || 0;
          const payout = stats.payout || 0;


          let reportRecords = {
            "SalesByCategory": mainData.records[0],
            "": stats,
            "PaymentReceived": payment,
            " ": {
              records: [{ "key": "Total Refund", "": "", "value": refund }, { "key": "Payout", "": "", "value": payout }, { "key": "Net Income", "": "", "value": totalActualAmountPaid - refund - payout }],
              columns: { 'key': {}, '': {}, 'value': { columnType: 'currency' } }
            },
            "Discount": (await SummaryReport.discount(data, company, branches)).data,
            "SalesByService": (await SummaryReport.getSalesByServices(data, company, branches)).data,
            "TaxDetails": (await SummaryReport.taxDetails(data, company, branches)).data
          }

          reportData.records = reportRecords;
          break;
        case "/dailyclosingreport":
          reportData = (await dailySalesReport.getdailySalesReport(data, company, branches)).data;
          break;

        case "/cashierreportbycashierid":
          reportData = (await EmployeeReports.cashierReportByCashierId(data, company, branches)).data;
          break;



        default:
          break;
      }


      if (reportData) {
        const resData = await XLSXGenerator.exportSalesSummary(reportData, company);
        // Send the file as a response
        res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
        res.setHeader('Content-Type', resData.type);
        const fileStream = fs.createReadStream(resData.fileName);
        fileStream.pipe(res);


        res.on('finish', () => {
          fs.unlinkSync(resData.fileName);
        });

        return new ResponseData(true, "", [])
      }
      return new ResponseData(true, "", [])

    } catch (error: any) {
        throw error
    }
  }

  public static async exportBlanceSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      const branches = res.locals.branches
      data.filter.export = true

      let reportData;

      reportData = (await ComparisonReportsRepo.balanceSheetReport(data, company, branches));

      if (reportData) {
        const resData = await XLSXGenerator.exportBalanceSheet(reportData.data, company);

        res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
        res.setHeader('Content-Type', resData.type);
        const fileStream = fs.createReadStream(resData.fileName);
        fileStream.pipe(res);


        res.on('finish', () => {
          fs.unlinkSync(resData.fileName);
        });

        return new ResponseData(true, "", [])

      }

      return new ResponseData(false, "", [])

    } catch (error: any) {
        throw error
    }
  }

  public static async exportProfitAndLoss(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      const branches = res.locals.branches
      data.filter.export = true

      let reportData;

      reportData = (await ComparisonReportsRepo.getProfitAndLossReport(data, company, branches));

      if (reportData) {
        const resData = await XLSXGenerator.exportProfitAndLoss(reportData.data, company);

        res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
        res.setHeader('Content-Type', resData.type);
        const fileStream = fs.createReadStream(resData.fileName);
        fileStream.pipe(res);


        res.on('finish', () => {
          fs.unlinkSync(resData.fileName);
        });

        return new ResponseData(true, "", [])

      }

      return new ResponseData(false, "", [])

    } catch (error: any) {
        throw error
    }
  }

  public static async vatReportExport(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const data = req.body;
      const branches = res.locals.branches
      data.filter.export = true
      const report = req.url
      let tt = new TableReportData;
      let reportData: any


      let mainData = (await vatReportRepo.exportTaxReport(data, company, branches)).data

      const resData = await XLSXGenerator.exportVatReport(mainData, company);
      // Send the file as a response
      res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
      res.setHeader('Content-Type', resData.type);
      const fileStream = fs.createReadStream(resData.fileName);
      fileStream.pipe(res);


      res.on('finish', () => {
        fs.unlinkSync(resData.fileName);
      });

      return new ResponseData(true, "", [])
      // reportData = {
      //   "SalesByCategory": mainData.records[0],
      //   "": (await SummaryReport.stats(data, company, branches)).data,
      //   "PaymentReceived": (await SummaryReport.received(data, company, branches)).data,
      //   "Discount": (await SummaryReport.discount(data, company, branches)).data,
      //   "SalesByService": (await SummaryReport.getSalesByServices(data, company, branches)).data
      // };

      // mainData.records = reportData

      // if (mainData) {
      //   const resData = await XLSXGenerator.exportSalesSummary(mainData, company);
      //   // Send the file as a response
      //   res.setHeader('Content-Disposition', `attachment; filename= "${resData.fileName}"`);
      //   res.setHeader('Content-Type', resData.type);
      //   const fileStream = fs.createReadStream(resData.fileName);
      //   fileStream.pipe(res);


      //   res.on('finish', () => {
      //     fs.unlinkSync(resData.fileName);
      //   });

      //   return new ResponseData(true, "", [])
      // }
      return res.send(new ResponseData(true, "", []));

    } catch (error: any) {
        throw error
    }
  }












}