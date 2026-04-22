import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { ComparisonReportsRepo } from '@src/repo/reports/Comparison.report';
import { ReportRepo } from '@src/repo/reports/reports.repo';
import { vatReportRepo } from '@src/repo/reports/vatReports.report';
import { expenseReport } from '@src/repo/reports/ExpenseReports.report';
import { Request, Response, NextFunction } from 'express';
import { purchaseReport } from '@src/repo/reports/Purchase.report';

import fs from 'fs';
import { DataColumn, ReportData, XLSXGenerator } from '@src/utilts/xlsxGenerator';
import { MenuReports } from '@src/repo/reports/menu.report';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import { scheduledReportRepo } from '@src/repo/app/accounts/scheduledReport.repo';
import { Employee } from '@src/models/admin/employee';

export class ReportController {

    public static async getBalanceSheet(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches;
            const report = await ReportRepo.getBalanceSheet(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
    public static async getLossAndProfit(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company: Company =res.locals.company
            const branches = res.locals.branches;
            const report = await ReportRepo.profitAndLoss(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
    public static async getBalanceBasisAccrual(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches;
            const report = await ReportRepo.getBalanceBasisAccrual(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
    public static async getJournalEntries(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.getJournalEntries(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async customerAgingReportGraph(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
    
            const report = await ReportRepo.customerAgingReportGraph(data,company);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async customerAgingReportRecordes(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.customerAgingReportRecordes(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }


    public static async agingReportByCustomer(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
    
            const report = await ReportRepo.aginingReportByCustomer(data,company);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }


    public static async customerSummaryAgingReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;

            const report = await ReportRepo.customerSummaryAgingReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async supplierAgingReportGraph(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
    
            const report = await ReportRepo.supplierAgingReportGraph(data,company);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async supplierAgingReportRecordes(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.supplierAgingReportRecordes(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async suppliersSummaryAgingReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
            const report = await ReportRepo.suppliersSummaryAgingReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async aginigReportBySupplier(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
    
            const report = await ReportRepo.aginingReportBySupplier(data,company);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async salesVatReport (req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
            const report = await vatReportRepo.salesVatReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async purchaseVatReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches

            const report = await vatReportRepo.purchaseVatReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async getVatDetailsReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches

            const report = await vatReportRepo.getVatDetailsReport(data,company, branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async getPurchaseVatDetailsByVatId(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
    
            const report = await vatReportRepo.getPurchaseVatDetailsByVatId(data,company, branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async getSalesVatDetailsByVatId(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches

            const report = await vatReportRepo.getSalesVatDetailsByVatId(data,company, branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async profitAndLossMonthWiseComparison(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ComparisonReportsRepo.profitAndLossMonthWiseComparison(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async monthlyBLDBreakdown(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
    

            const report = await ReportRepo.monthlyBLDBreakdown(data,company);
            return res.send(report)
        } catch (error:any) {
            console.log(error)
            throw error
        }
    }

    /**New Reports  Routes*/

    //overview
    public static async balanceSheetReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
            const report = await ComparisonReportsRepo.balanceSheetReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async profitAndLossReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ComparisonReportsRepo.getProfitAndLossReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async trialBalanceReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ComparisonReportsRepo.trialBalanceReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async journalEntriesReports(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;

            const report = await ReportRepo.journalEntriesReports(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    //customers
    public static async customerAgingReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.customerAgingReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async customerAgingReportSummary(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.customerAgingReportSummary(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    //suppliers
    public static async supplierAgingReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.supplierAgingReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async supplierAgingReportSummary(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.supplierAgingReportSummary(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async supplierBalances(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.supplierBalances(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    //vat Report
    public static async getSalesVatReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.getSalesVatReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async getPurchaseVatReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.getPurchaseVatReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async vatDetailsReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.vatDetailsReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async productWiseVatReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.productWiseVatReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async taxTransactionDetailsReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.taxTransactionDetailsReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    //others
    public static async monthlyBLDBreakdownReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.monthlyBLDBreakdownReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async salesDiscountReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.salesDiscountReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async salesByDiscountId(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.salesByDiscountId(data,company,branches);
            

            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async voidTransactionsReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.voidTransactionsReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async getSalesDiscountReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
  
            const report = await ReportRepo.getSalesDiscountReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async departmentSalesAndPaymentsOverview(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.departmentSalesAndPaymentsOverview(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async reorderAlertReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ReportRepo.reorderAlertReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    //subReport
    public static async accountJournal(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;

            let account = await AccountsRepo.checkAccountJournal(data.filter.accountId);
            let report;
            if(account.type == 'Inventory Assets' && account.default  )
            {
                report    = await ReportRepo.getInventoryAssetsJournals(data,company,branches);
            }else if (account.type == 'Costs Of Goods Sold' && account.default  ){
                report    = await ReportRepo.getCostOfGoodSolds(data,company,branches);
            }else{
                report    = await ReportRepo.accountJournal(data,company,branches);
            }

            
         
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async salesVatDetailsByVatIdReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.salesVatDetailsByVatIdReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
    public static async purchaseVatDetailsByVatIdReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.purchaseVatDetailsByVatIdReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async billOfEntryDetailsVatReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.billOfEntryDetailsVatReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }

    public static async vatReportByProductId(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await vatReportRepo.vatReportByProductId(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }


    public static async expenseByCategory(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await expenseReport.expenseByCategory(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }


    public static async exportReport(req: Request, res: Response, next: NextFunction) {
        try {
          const company = res.locals.company;
          const data = req.body;
          let fileName  = 'voidTransactionsReport'
          const branches = res.locals.branches ;
          const result = await ReportRepo.exprotReport(data, fileName, company,branches);
          
          
      
          // Send the file as a response
          res.set('Content-Disposition', 'attachment; filename="'+fileName+'.xlsx"');
          res.set('Content-Type', 'application/vnd.ms-excel');
      
          const fileStream = fs.createReadStream(company.id+fileName+'.xlsx');
          fileStream.pipe(res);

          res.on('finish', () => {
            fs.unlinkSync(company.id+ fileName +'.xlsx');
          });
        } catch (error: any) {
          throw error;
        }
      }

    public static async generalLedgerReport(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ComparisonReportsRepo.generalLedgerReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }
   

    

    public static async vatReportE(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await ComparisonReportsRepo.generalLedgerReport(data,company,branches);
            return res.send(report)
        } catch (error:any) {
            throw error
        }
    }



   

}