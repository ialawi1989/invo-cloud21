import { ResponseData } from '@src/models/ResponseData';
import { CustomerRepo } from '@src/repo/app/accounts/customer.repo';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { SalesRepots } from '@src/repo/reports/Sales.reports';
import { DashboardRepo } from '@src/repo/reports/dashboard';
import { EmployeeReports } from '@src/repo/reports/employee.reports';
import { MenuReports } from '@src/repo/reports/menu.report';
import { PaymentMethodReports } from '@src/repo/reports/paymentMethod.reports';
import { Request, Response, NextFunction } from 'express';

export class DashboardController {
    static async topCategoryBySales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            data.limit = 10;
            data.filter = {
                fromDate: data.interval.from,
                toDate: data.interval.to,
                limit: 10,
                topSales: true,
                         branches: data.branchId? [data.branchId] : null 
            }
            const resault = await MenuReports.SalesByCategoryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async topDepartmentBySales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            data.limit = 10;
            const branches = res.locals.branches;
            data.filter = {
                fromDate: data.interval.from,
                toDate: data.interval.to,
                limit: 10,
                topSales: true,
                branches: data.branchId ? [data.branchId] : null
            }
            const resault = await MenuReports.salesByDepartments(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }
    /** Brand name + sales */
    static async topBrandBySales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            data.limit = 10;
            data.filter = {
                fromDate: data.interval.from,
                toDate: data.interval.to,
                limit: 10,
                topSales: true,
                branches: data.branchId ? [data.branchId] : null
            }
            const resault = await MenuReports.SalesByBrandReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async salesByDay(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            data.period = 'daily'
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesByPeriod(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async salesByTime(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            data.period = 'hourly'
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesByPeriod(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }


    /**ALL */
    static async salesBySource(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await SalesRepots.getSalesBySource(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }
    /**NUmber of online iNVOICES HOW MANY REJECTED HOW MANY ACCEPTED */
    static async onlineInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resault = await DashboardRepo.getTotalOnlineInvoicesSummary(data, company)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }


    static async PaymentMethodOverView(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await PaymentMethodReports.paymentMethodReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async Last12MonthSales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await SalesRepots.Last12MonthSales(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async BranchSales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await SalesRepots.getSalesByBranch(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async TopCustomers(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            data.limit = 10;
            const resault = await SalesRepots.getTopSalesCustomer(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }


    /**LIMIT 10 */
    static async NewCustomers(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resault = await CustomerRepo.newCustomers(data, company)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async AgeingReport(req: Request, res: Response, next: NextFunction) {
        throw new Error("Method not implemented.");
    }
    /** Item name + sales +qty */
    static async topItemBySales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            data.limit = 10;
            data.filter = {
                fromDate: data.interval.from,
                toDate: data.interval.to,
                limit: 10,
                topSales: true,
                branches: data.branchId ? [data.branchId] : null
            }
            const resault = await MenuReports.salesByProductReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async getSalesByService(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            data.limit = 10;
            const resault = await SalesRepots.getSalesByService(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async getSalesByEmployee(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            data.limit = 10;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.salesByEmployee(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }

    static async getTotalOpenInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await DashboardRepo.getTotalOpenInvoices(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }


    /** IF NULL OR 0 THEN 1  */
    public static async getTotalGuests(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resault = await DashboardRepo.getTotalGuests(data, company)
            return res.send(resault)
        } catch (error: any) {
              throw error
        } finally {

        }
    }


    public static async numberOfOpenCashiers(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const branches = res.locals.branches;
            const data = req.body
            const accounts = await DashboardRepo.numberOfOpenCashiers(data, company.id, branches);
            return res.send(accounts)
        } catch (error: any) {

              throw error
        }
    }
}