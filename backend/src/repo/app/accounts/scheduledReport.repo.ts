import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";
import fs from 'fs';


import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";

import moment from "moment";


import { ScheduledReportValidator } from "@src/validationSchema/account/scheduledReport.Schema";
import { ScheduledReport } from "@src/models/account/scheduledReport";
import { ScheduledReportQueue } from "@src/repo/triggers/scheduledReportQueue";
import { SesService } from "@src/utilts/SES";
import { ComparisonReportsRepo } from "@src/repo/reports/Comparison.report";
import { ReportRepo } from "@src/repo/reports/reports.repo";
import { MenuReports } from "@src/repo/reports/menu.report";
import { SalesRepots } from "@src/repo/reports/Sales.reports";
import { InvenoryReports } from "@src/repo/reports/inventory.reports";
import { CustomerReports } from "@src/repo/reports/customer.report";
import { SuppliersReports } from "@src/repo/reports/supplier.reports";
import { vatReportRepo } from "@src/repo/reports/vatReports.report";
import { purchaseReport } from "@src/repo/reports/Purchase.report";
import { EmployeeReports } from "@src/repo/reports/employee.reports";
import { PaymentMethodReports } from "@src/repo/reports/paymentMethod.reports";
import { CustomerRepo } from "./customer.repo";
import { AccountsRepo } from "./account.repo";
import { SupplierRepo } from "./supplier.repo";
import { AttendanceRepo } from "../settings/attendance.repo";
import { ReportsPDFGenerator } from "@src/utilts/ReportPDFGenerator";
import { FileStorage } from "@src/utilts/fileStorage";
import _ from "lodash";
import { SummaryReport } from "@src/repo/reports/Summary.report";
import { dailySalesReport } from "@src/repo/reports/dailySalesReport";
import { XLSXGenerator } from "@src/utilts/xlsxGenerator";
import { Braket } from "aws-sdk";
import { EmailService } from "@src/utilts/EmailService";
import { BranchesRepo } from "@src/repo/admin/branches.repo";


type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ScheduleInput {
  startDate: string;      // e.g. "2025-01-30"
  scheduleTime: string;   // e.g. "00:00"
  frequency: Frequency;
  offset: number
}

export class scheduledReportRepo {

  public static async scheduleReport(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const companyId = company.id;
      data.companyId = company.id
      data.employeeId = employeeId

      // ############## scheduled Report Validation  ##############  
      const validate = await ScheduledReportValidator.scheduledReportValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }

      // ##################### Prepare Data   ##################### 
      const scheduledReport = new ScheduledReport();
      scheduledReport.ParseJson(data);
      scheduledReport.companyId = companyId
      let s: ScheduleInput = {
        startDate: scheduledReport.startDate,
        scheduleTime: scheduledReport.scheduleTime,
        frequency: scheduledReport.frequency,
        offset: Number(company.timeOffset) ?? 0
      }
      scheduledReport.nextRun = this.getNextRun(s)
      scheduledReport.previousRun = this.getPreviousRun(s)
      const filter: any = scheduledReport.filter ?? {};

      if (filter.applyOpeningHour == true && !filter?.hasOwnProperty('branches') && !filter?.hasOwnProperty('branchId')) {
        filter.branches = await BranchesRepo.getbranchesIds(company.id);
      }


      // ###################### Insert Data #######################
      const query: { text: string, values: any } = {
        text: `INSERT INTO public."ScheduledReports"(
                        "reportType", "attachmentType", "companyId", frequency, "startDate", "scheduleTime", "previousRun", "nextRun", recipients, "additionalRecipients", "isActive", "employeeId", filter)
                        VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id `,
        values: [
          scheduledReport.reportType,
          scheduledReport.attachmentType,
          scheduledReport.companyId,
          scheduledReport.frequency,
          scheduledReport.startDate,
          scheduledReport.scheduleTime,
          scheduledReport.previousRun,
          scheduledReport.nextRun,

          scheduledReport.recipients,
          scheduledReport.additionalRecipients,
          scheduledReport.isActive,
          scheduledReport.employeeId,
          JSON.stringify(scheduledReport.filter)
        ]
      }

      const insert = await client.query(query.text, query.values);

      // ###################### Response #######################
      if (insert.rows && insert.rows.length > 0) {
        const scheduledReportId = (<any>insert.rows[0]).id;
        scheduledReport.id = scheduledReportId
        return new ResponseData(true, "scheduled Report Added Successfully", { scheduledReport })
      }

      return new ResponseData(false, "Failed to add scheduled report", {})

    } catch (error: any) {

    
      throw new Error(error.message)

    }
  }

  public static async rescheduledReport(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {

      // ############## scheduled Report Validation  ##############  
      if (data.id == "" || data.id == null || data.id == undefined) { throw new ValidationException("Schedule Report Id is Required") }
      data.companyId = company.id
      data.employeeId = employeeId

      const validate = await ScheduledReportValidator.scheduledReportValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }

      // ##################### Prepare Data   ##################### 
      const scheduledReport = new ScheduledReport();
      scheduledReport.ParseJson(data);
      let s: ScheduleInput = {
        startDate: scheduledReport.startDate,
        scheduleTime: scheduledReport.scheduleTime,
        frequency: scheduledReport.frequency,
        offset: Number(company.timeOffset) ?? 0
      }


      scheduledReport.nextRun = this.getNextRun(s)
      scheduledReport.previousRun = this.getPreviousRun(s)
      let filter: any = scheduledReport.filter ?? {}

      if (filter.applyOpeningHour == true && !filter?.hasOwnProperty('branches') && !filter?.hasOwnProperty('branchId')) {
        filter.branches = await BranchesRepo.getbranchesIds(company.id);
      }

      // ###################### Insert Data #######################
      const query: { text: string, values: any } = {
        text: `UPDATE public."ScheduledReports" SET  
                        "previousRun" = $2,  
                        "nextRun" = $3,  
                        frequency = $4, 
                        recipients = $5,
                        "companyId" = $6,
                        "startDate" = $7, 
                        "reportType" = $8,
                        "scheduleTime" = $9,
                        "attachmentType" = $10,
                        "additionalRecipients" = $11,
                        "isActive" = $12,
                        "employeeId"= $13,
                        filter = $14
                      WHERE  id = $1  RETURNING *`,

        values: [
          scheduledReport.id,
          scheduledReport.previousRun,
          scheduledReport.nextRun,
          scheduledReport.frequency,
          scheduledReport.recipients,
          scheduledReport.companyId,
          scheduledReport.startDate,
          scheduledReport.reportType,
          scheduledReport.scheduleTime,
          scheduledReport.attachmentType,
          scheduledReport.additionalRecipients,
          scheduledReport.isActive,
          scheduledReport.employeeId,
          JSON.stringify(scheduledReport.filter)

        ]
      }

      const insert = await client.query(query.text, query.values);

      // ###################### Response #######################
      if (insert.rows && insert.rows.length > 0) {
        const scheduledReportId = (<any>insert.rows[0]).id;
        scheduledReport.id = scheduledReportId
        return new ResponseData(true, "Updated Successfully", { scheduledReport })
      }
      return new ResponseData(false, "", {})

    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }

  public static async getScheduledReportById(scheduledReportId: string, company: Company) {
    try {

      // ##################### select Data   ##################### 
      const query: { text: string, values: any } = {
        text: `SELECT  "ScheduledReports".id,
                        "ScheduledReports"."companyId",
                        "ScheduledReports"."employeeId",
                        "ScheduledReports"."reportType",
                        "ScheduledReports"."attachmentType",
                        "ScheduledReports"."startDate"::text,
                        "ScheduledReports"."scheduleTime",
                        "ScheduledReports"."frequency",
                        "ScheduledReports"."recipients",
                        "ScheduledReports"."additionalRecipients",
                        "ScheduledReports"."nextRun",
                        "ScheduledReports"."previousRun",
                        "ScheduledReports"."isActive",
                        "ScheduledReports"."filter"
                        from "ScheduledReports"
                        WHERE "ScheduledReports".id =$1 AND "ScheduledReports"."companyId"=$2
                      `,
        values: [scheduledReportId, company.id]
      }

      const data = await DB.excu.query(query.text, query.values);

      // ###################### Response #######################
      if (data.rows && data.rows.length > 0) {
        const scheduledReport = new ScheduledReport();
        scheduledReport.ParseJson(data.rows[0]);
        return new ResponseData(true, "", scheduledReport);
      }

      return new ResponseData(false, "", {});

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async deleteScheduledReport(id: string) {
    try {

      const query: { text: string, values: any } = {
        text: `Delete FROM "ScheduledReports" where id = $1  `,
        values: [id]
      }

      const data = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", data.rows[0]);

    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async getDueReports() {

    try {

      // #####################   select Data   ##################### 
      const now = new Date();
      const query = {
        text: `SELECT "ScheduledReports".id,
                        "ScheduledReports"."companyId",
                        "ScheduledReports"."employeeId",
                        "ScheduledReports"."reportType",
                        "ScheduledReports"."attachmentType",
                        "ScheduledReports"."startDate"::text,
                        "ScheduledReports"."scheduleTime",
                        "ScheduledReports"."frequency",
                        "ScheduledReports"."recipients",
                        "ScheduledReports"."additionalRecipients",
                        "ScheduledReports"."nextRun",
                        "ScheduledReports"."previousRun",
                        "ScheduledReports"."isActive",
                        "ScheduledReports"."filter"
                FROM "ScheduledReports"
               WHERE "nextRun" <= $1 AND "isActive" = true`,
        values: [now]
      }

      let reportsToSend: any = await DB.excu.query(query.text, query.values)

      // ############### add Scheduled Report to Queue ##############
      const reportQueue = new ScheduledReportQueue();

      for (const report of reportsToSend?.rows) {
        // only if there is a recipient add Scheduled Report to Queue
        if (report.recipients?.length > 0 || report.additionalRecipients?.length > 0) {
          await reportQueue.addReportJob(report);
        }

      }


    } catch (error: any) {
      throw new Error(error);
    }
  }


  private static getPreviousRun(data: ScheduleInput): Date {
    try {
      const { startDate, scheduleTime, frequency, offset } = data;
      const [hour, minute] = scheduleTime.split(':').map(Number);

      // Initialize base date with the start date and apply the scheduled time
      let base = moment(startDate).set({ hour, minute, second: 0, millisecond: 0 });

      // Apply the offset
      base = base.subtract(offset, 'hours');

      // Get the current date and time
      const now = moment();

      // Adjust base to the previous occurrence based on frequency
      let previousRun = base.clone();
      const targetDay = base.date();

      while (previousRun.isSameOrAfter(now, 'minute')) {
        switch (frequency) {
          case 'daily':
            previousRun.subtract(1, 'days');
            break;
          case 'weekly':
            previousRun.subtract(1, 'weeks');
            break;
          case 'monthly':
            previousRun.subtract(1, 'months');
            previousRun.date(Math.min(targetDay, previousRun.daysInMonth()));
            break;
          case 'yearly':
            previousRun.subtract(1, 'years');
            previousRun.date(Math.min(targetDay, previousRun.daysInMonth()));
            break;
          default:
            throw new Error(`Unsupported frequency: ${frequency}`);
        }

        // Restore the scheduled time
        previousRun.set({ hour, minute, second: 0, millisecond: 0 });

        // Apply the offset
        previousRun = previousRun.subtract(offset, 'hours');
      }

      return previousRun.toDate();
    } catch (error: any) {
    
      throw new Error(error.message);
    }
  }


  private static getNextRun(data: ScheduleInput): Date {
    try {
      const { startDate, scheduleTime, frequency, offset } = data;
      const [hour, minute] = scheduleTime.split(':').map(Number);
      const targetDay = new Date(startDate).getDate();

      // Create a Moment object for the base date and time
      let nextRun = moment(startDate)
        .set({ hour, minute, second: 0, millisecond: 0 })
        .subtract(offset, 'hours');

      // Adjust the target day if necessary
      nextRun.set('date', targetDay);

      // Loop until the next run is in the future
      while (nextRun.isBefore(moment())) {
        switch (frequency) {
          case 'daily':
            nextRun.add(1, 'days');
            break;
          case 'weekly':
            nextRun.add(1, 'weeks');
            break;
          case 'monthly':
            nextRun.add(1, 'months');
            nextRun.set('date', Math.min(targetDay, nextRun.daysInMonth()));
            break;
          case 'yearly':
            nextRun.add(1, 'years');
            nextRun.set('date', Math.min(targetDay, nextRun.daysInMonth()));
            break;
          default:
            throw new Error('Invalid frequency');
        }
      }

      return nextRun.toDate();
    } catch (error: any) {
    
      throw new Error(error);
    }
  }

  private static async updateNextRun(id: string, frequency: Frequency, nextRun: Date, startDate: string, scheduleTime: string, offset: number) {
    try {
      if (!nextRun) { throw new ValidationException("nextRun time cannot be empty") }
      const previousRun = nextRun
      nextRun = this.getNextRun({ startDate, scheduleTime, frequency, offset })

      const query: { text: string, values: any } = {
        text: `UPDATE "ScheduledReports"  SET "previousRun" = $2 , "nextRun" = $3 WHERE id = $1`,
        values: [id, previousRun, nextRun]
      }

      const data = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", data.rows[0]);

    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  private static async getRecipientEmails(recipients: string[], additionalRecipients: string[]) {
    try {

      // ######################## define variables ########################
      let recipientEmails: any[] = []

      // ##################### get non-employee Emails ####################
      recipientEmails = [...recipientEmails, ...additionalRecipients]

      // ####################### get employee Emails ######################
      if (recipients.length > 0) {

        const query: { text: string, values: any } = {
          text: `select "Employees".email 
                      from "Employees"
                      where "Employees".id = any($1::uuid[])`,
          values: [recipients]
        }

        const employees = await DB.excu.query(query.text, query.values);
        if (employees.rows && employees.rows.length > 0) {
          const employeeEmails: any[] = employees.rows
          const emails = employeeEmails.map(employee => employee.email);
          recipientEmails = [...recipientEmails, ...emails]
        }
      }

      // ###################### get recipient emails ######################
      return recipientEmails

    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getfile(company: Company, filter: any, branches: [], report: string, attachmentType: 'pdf' | 'xlsx') {
    try {

      let data = filter
      if (data.filter != null && data.filter != undefined) {
        data.filter.export = true
      } else {
        data.export = true
      }

      let orientation
      let reportData;
      let vatReport;
      let reportType: 'normal' | 'multiTables' | 'balanceSheet' = 'normal'
      //report = report.replace(/-/g, '');


      switch (report.toLowerCase()) {

        // ################# Business overview ####################
        case "profit-and-loss":
          reportData = (await ComparisonReportsRepo.getProfitAndLossReport(data, company, branches));
          break;
        case "balance-sheet":
          reportData = (await ComparisonReportsRepo.balanceSheetReport(data, company, branches));
          reportType = 'balanceSheet'
          break;
        case "trial-balance-basis-accrual":
          reportData = (await ComparisonReportsRepo.trialBalanceReport(data, company, branches));
          break;
        case "general-ledger-report":
          reportData = (await ComparisonReportsRepo.generalLedgerReport(data, company, branches));
          break;
        case "journal-entries":
          reportData = (await ReportRepo.journalEntriesReports(data, company, branches));
          break;

        // ########################## sales ##########################
        case "sales-summary":
          let mainData = (await SummaryReport.getSalesByCategory(data, company, branches)).data
          reportData = (await SummaryReport.getSalesByCategory(data, company, branches))
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
          };
          reportData.data.records = reportRecords;
          reportType = 'multiTables'
          break;
        case "sales-by-department":
          reportData = (await MenuReports.salesByDepartments(data, company, branches));
          break;
        case "sales-by-category-report":
          reportData = (await MenuReports.SalesByCategoryReport(data, company, branches));
          break;
        case "sales-by-product-report":
          reportData = (await MenuReports.salesByProductReport(data, company, branches));
          break;
        case "sales-by-products-category":
          reportData = (await MenuReports.salesByProductCategory(data, company, branches));
          break;
        case "sales-by-menu-products-vs-options":
          reportData = (await MenuReports.salesByMenuProductVsOptions(data, company, branches));
          break;
        case "sales-by-service":
          reportData = (await MenuReports.salesByServices(data, company, branches));
          break;
        case "sales-by-menu-product-vs-service":
          reportData = (await MenuReports.salesByMenuProductVsService(data, company, branches));
          break;
        case "sales-by-menu":
          reportData = (await MenuReports.salesByMenuReport(data, company, branches));
          break;
        case "sales-by-menu-sections":
          reportData = (await MenuReports.salesByMenuSectionsReport(data, company, branches));
          break;
        case "sales-by-terminal":
          reportData = (await SalesRepots.salesByTerminals(data, company, branches));
          break;
        case "sales-by-delivery-area":
          reportData = (await SalesRepots.getSalesByDeliveryArea(data, company, branches));
          break;
        case "sales-by-aggregator-report":
          reportData = (await SalesRepots.salesByAggregatorReport(data, company, branches));
          break;
        case "sales-by-invoice":
          reportData = (await SalesRepots.salesByInvoice(data, company, branches));
          break;
        case "daily-closing-report":
          reportData = (await dailySalesReport.getdailySalesReport(data, company, branches));
          reportType = 'multiTables'
          break;
        case "sales-by-brands":
          reportData = (await MenuReports.SalesByBrandReport(data, company, branches));
          break;
        case "department-sales-and-payments-overview":
          reportData = await ReportRepo.departmentSalesAndPaymentsOverview(data, company, branches)
          attachmentType = 'xlsx'
          break;

        case "sales-by-service-details":
          reportData = (await SalesRepots.salesByServiceId(data, company, branches));
          break;
        case "sales-by-aggregator-sub-report":
          reportData = (await SalesRepots.aggregatorSubReport(data, company, branches));
          break;

        // ####################### sales Period #######################
        case "daily-sales":
        case "hourly-sales":
        case "weekday-sales":
        case "monthly-sales":
        case "weekly-sales":
        case "quarterly-sales":
        case "yearly-sales":
          data.filter.period = report.split('-')[0]
          reportData = (await SalesRepots.salesByPeriodReport(data, company, null, branches));
          break;

        // ######################### Inventory #########################
        case "general-inventory-report":
          reportData = (await InvenoryReports.getGeneralInventoryReport(data, company, branches));
          orientation = 'landscape'
          break;
        case "sales-vs-inventory-usage":
          reportData = (await InvenoryReports.salesVsInventoryUsageReport(data, company, branches));
          break;
        case "product-sales-vs-inventory-usage":
          reportData = (await InvenoryReports.productSalesVsInventoryUsageReport(data, company, branches));
          break;
        case "product-movment":
          reportData = (await InvenoryReports.productMovmentReport(data, company, branches));
          break;
        case "wastage-summary-report":
          reportData = (await InvenoryReports.wastageSummaryReport(data, company, branches));
          break;
        case "detailed-wastage-report":
          reportData = (await InvenoryReports.productWastageReport(data, company, branches));
          break;
        case "reorder-alert-report":
          reportData = await ReportRepo.reorderAlertReport(data, company, branches)
          attachmentType = 'xlsx'
          break;
        case "expired-products-report":
          reportData = (await InvenoryReports.expiredProductsReport(data, company, branches));
          break;
        case "reorder-report":
          reportData = (await InvenoryReports.reorderReport(data, company, branches));
          break;

        // #########################  Customer  #########################
        case "customer-order-history":
          reportData = (await CustomerReports.customerOrderHistory(data, company, branches));
          break;
        case "sales-by-customers-summary":
          reportData = (await CustomerReports.salesByCustomer(data, company, branches));
          break;
        case "customer-aging-report":
          reportData = (await ReportRepo.customerAgingReport(data, company, branches));
          break;
        case "customer-aging-summary-report":
          reportData = (await ReportRepo.customerAgingReportSummary(data, company, branches));
          break;
        case "payment-received-report":
          reportData = (await CustomerReports.paymentReceived(data, company, branches));
          break;
        case "credit-notes-report":
          reportData = (await CustomerReports.creditNoteReport(data, company, branches));
          break;
        case "refunds-report":
          reportData = (await CustomerReports.refundReport(data, company, branches));
          break;
        case "customerwiseitemsalesreport":
          reportData = (await CustomerReports.clientWiseItemSalesReport(data, company, branches));
          break;
        case "customerwisediscountreport":
          reportData = (await CustomerReports.clientWiseDiscountReport(data, company, branches));
          break;

        case "salesbycustomerid":
          reportData = (await CustomerReports.salesByCustomerId(data, company, branches));
          break;
        case "customer-balance-summary":
          reportData = (await CustomerReports.customerBalance(data, company, branches));
          break;

        // #########################  Employee  #########################
        case "sales-by-employee-report":
          reportData = (await EmployeeReports.salesByEmployeeReport(data, company, branches));
          break;
        case "sales-by-employee-vs-products":
          reportData = (await EmployeeReports.salesByProductVsEmployee(data, company, branches));
          break;
        case "cashierreportbycashierid":
          reportData = (await EmployeeReports.cashierReportByCashierId(data, company, branches));
          reportType = 'multiTables'
          break;
        case "cashier-summary-report":
          reportData = (await EmployeeReports.getCashierReport(data, company, branches));
          break;
        case "short-over-report":
          reportData = (await EmployeeReports.shortOver(data, company, branches));
          break;
        case "driver-report":
          reportData = (await EmployeeReports.getDriverReport(data, company, branches));
          break;
        case "driver-details-report":
          reportData = (await EmployeeReports.getDriverDetailsReport(data, company, branches));
          break;
        case "attendence-report":
          reportData = (await AttendanceRepo.attendanceReport(data, company, branches));
          break;

        case "cashierlist":
          reportData = (await EmployeeReports.cashierList(data, company, branches));
          break;


        // #########################  Supplier  #########################
        case "supplier-aging-report":
          reportData = (await ReportRepo.supplierAgingReport(data, company, branches));
          break;
        case "supplier-aging-summary-report":
          reportData = (await ReportRepo.supplierAgingReportSummary(data, company, branches));
          break;
        case "supplier-balances-report":
          reportData = (await ReportRepo.supplierBalances(data, company, branches));
          break;
        case "payment-made-report":
          reportData = (await SuppliersReports.paymentMade(data, company, branches));
          break;
        case "supplier-credits-report":
          reportData = (await SuppliersReports.supplierCreditReport(data, company, branches));
          break;
        case "supplier-refunds-report":
          reportData = (await SuppliersReports.supplierRefundReport(data, company, branches));
          break;
        case "supplier-change-price-report":
          reportData = (await SuppliersReports.supplierChangePriceReport(data, company, branches));
          break;

        // ########################### Tax ###########################
        case "vat-audit-report":
          reportData = (await vatReportRepo.vatDetailsReport(data, company, branches));
          break;
        case "vatdetailsbyvatid":
          if (data.filter && data.filter.type == 'purchase')
            reportData = (await vatReportRepo.purchaseVatDetailsByVatIdReport(data, company, branches));
          else
            reportData = (await vatReportRepo.salesVatDetailsByVatIdReport(data, company, branches));
          break;
        case "product-wise-vat-report":
          if (data.filter && data.filter.productId)
            reportData = (await vatReportRepo.vatReportByProductId(data, company, branches));
          else
            reportData = (await vatReportRepo.productWiseVatReport(data, company, branches));
          break;
        case "vat-report":
          vatReport = true
          reportData = (await vatReportRepo.exportTaxReport(data, company, branches));
          reportType = 'multiTables'
          break;

        // ######################### purchase #########################
        case "purchase-by-supplier":
          reportData = (await purchaseReport.purchaseBySupplier(data, company, branches));
          break;
        case "purchase-by-category":
          reportData = (await purchaseReport.purchaseByCategory(data, company));
          break;
        case "open-pending-po-report":
          reportData = (await purchaseReport.openPendingPOReport(data, company, branches));
          break;
        case "purchase-by-supplier-sub-report":
          reportData = (await purchaseReport.purchaseBySupplierId(data, company, branches));
          break;
        case "purchase-by-item":
          if (data.filter && data.filter.productId)
            reportData = await purchaseReport.purchaseByItemId(data, company, data.filter.productId, branches)
          else
            reportData = await purchaseReport.purchaseByItem(data, company, branches);
          break;

        // ########################### Table ###########################
        case "sales-by-tables":
          reportData = (await SalesRepots.getSalesByTables(data, company, branches));
          break;
        case "sales-by-table-groups":
          reportData = (await SalesRepots.getSalesByTableGroups(data, company, branches));
          break;
        case "table-usage-report":
          reportData = (await SalesRepots.tableUsage(data, company, branches));
          break;
        // need to checkFormat
        case "table-usage-summary-report":
          reportData = (await SalesRepots.tableUsageSummary(data, company, branches));
          break;

        // ########################### Other ###########################
        case "payment-method-report":
          reportData = await PaymentMethodReports.getPaymentMethodReport2(data, company, branches)
          break;
        case "product-prepared-time-summary":
          reportData = (await MenuReports.productPreparedTimeSummaryReport(data, company, branches));
          break;
        case "prepared-time-summary":
          reportData = (await MenuReports.preparedTimeSummaryReport(data, company, branches));
          break;
        case "discount-report":
          reportData = (await ReportRepo.salesDiscountReport(data, company, branches));
          break;
        case "salesbydiscountid":
          reportData = (await ReportRepo.salesByDiscountId(data, company, branches));
          break;
        case "monthly-bld-breakdown-report":
          orientation = 'landscape'
          reportData = (await ReportRepo.monthlyBLDBreakdownReport(data, company, branches));
          break;
        case "void-transactions":
          reportData = (await ReportRepo.voidTransactionsReport(data, company, branches));
          break;
        case "unsold-products-report":
          reportData = (await MenuReports.zeroSalesProducts(data, company, branches));
          break;
        case "daily-payment-report":
          orientation = 'landscape'
          reportData = await PaymentMethodReports.dailyPaymentReport(data, company, branches)
          break;

        // ########################### unknown ###########################
        case "payment-method-sub-report":
          reportData = await PaymentMethodReports.paymentTransactions(data, company, branches)
          break;
        case "accountjournal":
          reportData = (await AccountsRepo.getAccountJournals(data, company, branches));
          break;
        case "account-journals":
          reportData = (await ReportRepo.accountJournal(data, company, branches));
          break;
        case "customerstatment":
          reportData = (await CustomerRepo.customerStatement(data, company));
          break;
        case "supplierstatment":
          reportData = (await SupplierRepo.supplierStatement(data, company));
          break;
        case "billofentrydetailsvatreport":
          reportData = (await vatReportRepo.billOfEntryDetailsVatReport(data, company, branches));
          break;

        default:
          break;
      }

      const agingReports = ["/customeragingreport", "/supplieragingreport"];
      const agingSummaryReports = ["/customeragingsummaryreport", "/supplieragingsummaryreport"]
      if (reportData) {
        let resData

        if (attachmentType == 'xlsx') {

          if (vatReport == true) {
            await XLSXGenerator.exportVatReport(reportData.data, company)
          } else if (reportType == "balanceSheet") {
            resData = await XLSXGenerator.exportBalanceSheet(reportData.data, company);
          } else if (reportType == "multiTables") {
            resData = await XLSXGenerator.exportSalesSummary(reportData.data, company);
          } else if (agingReports.includes(report.toLowerCase())) {
            resData = await XLSXGenerator.exportGroupedDynamicToExcel(reportData.data, company);
          } else if (agingSummaryReports.includes(report.toLowerCase())) {
            resData = await XLSXGenerator.exportDynamicAgingSummaryReport(reportData.data.records, reportData.data.ranges, reportData.data.filter, reportData.data.showFilter, company, reportData.data.options);
          } else {
            resData = await XLSXGenerator.exportToExcel(reportData.data, company);
          }

        } else {

          if (reportType == "balanceSheet") {
            resData = await ReportsPDFGenerator.exportBalanceSheetPdf(reportData.data, company);
          } else if (reportType == "multiTables") {
            resData = await ReportsPDFGenerator.exportPdf2(reportData.data, company, vatReport ? { vatReport: vatReport } : undefined);
          } else if (agingReports.includes(report.toLowerCase())) {
            resData = await ReportsPDFGenerator.exportGroupedDynamicToPdf(reportData.data, company, { orientation: orientation ?? null });
          } else if (agingSummaryReports.includes(report.toLowerCase())) {
            resData = await ReportsPDFGenerator.exportDynamicAgingSummaryReportPdf(reportData.data.records, reportData.data.ranges, reportData.data.filter, reportData.data.showFilter, company, reportData.data.options, { orientation: orientation ?? null });
          } else {
            resData = await ReportsPDFGenerator.exportPdf(reportData.data, company, { orientation: orientation ?? null });
          }
        }



        if (resData) {
          return new ResponseData(true, "", resData)
        }

        return new ResponseData(false, "", {})

      }
      return new ResponseData(false, "", {})

    } catch (error: any) {
      return new ResponseData(false, error.message, []);
    }
  }

  public static async sendScheduledReport(data: any) {
    let fileName: string | undefined;
    try {

      // get recipition emails (uuid + emails)
      let emails = await this.getRecipientEmails(data.recipients, data.additionalRecipients)

      // get companyInfo
      const query: { text: string, values: any } = {
        text: `SELECT  "Companies".id, "Companies".name , "Companies".slug , country , 
                      "Media".url as "mediaUrl"
                  from "Companies"
                  left join "Media" on "Media".id = "Companies"."mediaId"
                  where "Companies".id = $1`,
        values: [data.companyId]
      }
      let company = new Company()
      company.id = data.companyId
      const companyInfo = await DB.excu.query(query.text, query.values);
      if (companyInfo.rows && companyInfo.rows.length > 0) {
        company.ParseJson(companyInfo.rows[0]);
        let fileStorage = new FileStorage();
        const settings = (await fileStorage.getCompanySettings(company.country))?.settings
        company.timeOffset = settings.timeOffset
        company.afterDecimal = settings.afterDecimal

      }



      // get reportfilter from, to 
      let reportFilter: any = data.filter ? { filter: data.filter } : { filter: {} }

      //TODO : from, to +timeOffset
      reportFilter.filter.fromDate = moment.utc(data.previousRun).utcOffset(+company.timeOffset).format('YYYY-MM-DD')
      reportFilter.filter.toDate = moment.utc(data.nextRun).utcOffset(+company.timeOffset).subtract(1, 'day').format('YYYY-MM-DD')
      //reportFilter.filter.toDate = moment.utc(data.nextRun).utcOffset(+company.timeOffset).format('YYYY-MM-DD')

      let reportDate: Date | null = new Date()
      if (data.frequency === 'daily') {
        reportDate = new Date(reportFilter.filter.fromDate)
      } else {
        reportDate = null
      }

      //get report
      let report: any = (await this.getfile(company, reportFilter, [], data.reportType, data.attachmentType)).data
      fileName = report.fileName

      // Email html data
      const template = await EmailService.loadTemplate();
      const reportName = _.startCase(data.reportType?.replaceAll('-', ' '))
      const emailData = {
        // Recipient info
        recipientName: 'Recipient',
        recipientEmail: emails,



        // Company branding
        companyName: company.name,
        logoUrl: company.mediaUrl?.defaultUrl ?? null, // Optional
        primaryColor: '#32acc1',
        secondaryColor: '#26a0b4',
        attachmentBgStart: '#e6f7f9',
        attachmentBgEnd: '#d1f0f3',

        // Report details
        headerReportName: 'Scheduled Report ' + reportName,
        reportName: reportName,
        reportDate: reportDate ? reportDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : null,
        frequency: data.frequency,
        fileName: data.reportType + new Date().toISOString().slice(0, 10),
        fileExtension: data.attachmentType,

        // Email content
        headerSubtitle: 'Automated Report Delivery',
        closingMessage: 'Best regards,',

        // Footer
        generationTimestamp: new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),

      };
      const htmlBody = template(emailData);

      //send emails
      let email = new SesService();
      email.sender = company.name + '<' + company.slug + '@invopos.co>'
      email.receivers.push(emails);
      email.subject = 'Scheduled Report ' + reportName + '-' + (new Date()).toISOString().slice(0, 10);
      email.htmlContent = htmlBody

      let res = await email.sendEmailWithAttachment(report.fileName, company.slug);
      fs.unlinkSync(report.fileName);

      //update Next Run
      if (res?.$metadata.httpStatusCode == 200) {
        const timeOffset = Number(company.timeOffset) ?? 0
        await this.updateNextRun(data.id, data.frequency, data.nextRun, data.startDate, data.scheduleTime, timeOffset)
        return true
      }
      return false

    } catch (error: any) {

      // Safely delete the file if it exists
      if (fileName && fs.existsSync(fileName)) {
        try {
          fs.unlinkSync(fileName);
          console.log('Deleted file:', fileName);
        } catch (deleteError) {
          console.error('Failed to delete file:', deleteError);
        }
      }


    
      throw new Error(error)
    }
  }

  public static async getScheduledReportTypes(company: Company) {
    try {

      // ##################### select Data   ##################### 
      const query: { text: string, values: any } = {
        text: ` SELECT  distinct "ScheduledReports"."reportType"    
                from "ScheduledReports"
                WHERE"ScheduledReports"."companyId"=$1`,
        values: [company.id]
      }

      const data = await DB.excu.query(query.text, query.values);

      // ###################### Response #######################
      if (data.rows && data.rows.length > 0) {
        const scheduledReportTypes = data.rows;
        return new ResponseData(true, "", scheduledReportTypes);
      }

      return new ResponseData(true, "", []);

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async getScheduledReportBytype(scheduledReportType: string, company: Company) {
    try {

      // ##################### select Data   ##################### 
      const query: { text: string, values: any } = {
        text: `SELECT  "ScheduledReports".id,
                        "ScheduledReports"."companyId",
                        "ScheduledReports"."employeeId",
                        "ScheduledReports"."reportType",
                        "ScheduledReports"."attachmentType",
                        "ScheduledReports"."startDate"::text,
                        "ScheduledReports"."scheduleTime",
                        "ScheduledReports"."frequency",
                        "ScheduledReports"."recipients",
                        "ScheduledReports"."additionalRecipients",
                        "ScheduledReports"."nextRun",
                        "ScheduledReports"."previousRun",
                        "ScheduledReports"."isActive",
                        "ScheduledReports"."filter"
                        from "ScheduledReports"
                        WHERE lower("reportType") = lower($1::text) AND "ScheduledReports"."companyId"=$2
                      `,
        values: [scheduledReportType, company.id]
      }

      const data = await DB.excu.query(query.text, query.values);

      // ###################### Response #######################
      if (data.rows && data.rows.length > 0) {
        const scheduledReport = data.rows;
        return new ResponseData(true, "", scheduledReport);
      }

      return new ResponseData(true, "", []);

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async getDueReportsTest(id: string) {

    try {

      // #####################   select Data   ##################### 
      const now = new Date();
      const query = {
        text: `SELECT "ScheduledReports".id,
                        "ScheduledReports"."companyId",
                        "ScheduledReports"."employeeId",
                        "ScheduledReports"."reportType",
                        "ScheduledReports"."attachmentType",
                        "ScheduledReports"."startDate"::text,
                        "ScheduledReports"."scheduleTime",
                        "ScheduledReports"."frequency",
                        "ScheduledReports"."recipients",
                        "ScheduledReports"."additionalRecipients",
                        "ScheduledReports"."nextRun",
                        "ScheduledReports"."previousRun",
                        "ScheduledReports"."isActive",
                        "ScheduledReports"."filter"
                FROM "ScheduledReports"
               WHERE "nextRun" <= $1 AND "isActive" = true and id = $2`,
        values: [now, id]
      }

      let reportsToSend: any = await DB.excu.query(query.text, query.values)

      // ############### add Scheduled Report to Queue ##############

      for (const report of reportsToSend?.rows) {
        // only if there is a recipient add Scheduled Report to Queue
        if (report.recipients?.length > 0 || report.additionalRecipients?.length > 0) {
          const isSent = await scheduledReportRepo.sendScheduledReport(report);
          if (isSent) {
            return new ResponseData(true, 'Scheduled Report sent successfully', {})
          }
          return new ResponseData(false, 'Scheduled Report faild to send', { rows: reportsToSend.rows[0] })

        }

      }

      return new ResponseData(false, 'Scheduled Report not found', {})


    } catch (error: any) {
      throw new Error(error);
    }
  }



}