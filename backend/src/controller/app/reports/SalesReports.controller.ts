import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { SalesRepots } from '@src/repo/reports/Sales.reports';
import { dailySalesReport } from '@src/repo/reports/dailySalesReport';
import { EmployeeReports } from '@src/repo/reports/employee.reports';
import { InvenoryReports } from '@src/repo/reports/inventory.reports';
import { MenuReports } from '@src/repo/reports/menu.report';
import { ReportRepo } from '@src/repo/reports/reports.repo';
import { Request, Response, NextFunction } from 'express';
export class salesReportsController {
    public static async salesByProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByProduct(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async getSalesByCategory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.SalesByCategory(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async getSalesByDepartment(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.SalesByDepartment(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async getSalesByService(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesByService(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getSalesBySource(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesBySource(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async shortOverReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.shortOverReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async SalesByDeliveryArea(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.SalesByDeliveryArea(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async getSalesByPeriod(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesByPeriod(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByTerminal(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await SalesRepots.salesByTerminal(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByTables(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByTables(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByTableGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByTableGroups(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async preparedTimeSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.preparedTimeSummary(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async productPreparedTimeSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.productPreparedTimeSummary(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }


    //Employee Reports 
    public static async salesByEmployee(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await EmployeeReports.salesByEmployee(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByEmployeeVsProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await EmployeeReports.salesByEmployeeVsProducts(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async cashierReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.cashierReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async driverReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.driverReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async driverDetailsReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.driverDetailsReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //Menu Reports
    public static async salesByMenu(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenu(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByMenuSections(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuSections(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByMenuProductsCategory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuProductsCategory(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByAggregator(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const resault = await ReportRepo.salesByAggregator(data, company)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByMenuItemsProductsVsOptions(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuItemsProductsVsOptions(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByServiceVsMenuItemProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await MenuReports.salesByServiceVsMenuItemProducts(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //Inventory  Reports 
    public static async generalInventoryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await InvenoryReports.generalInventoryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async productMovment(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.productMovment(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesVsInventoryUsage(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await InvenoryReports.salesVsInventoryUsage(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async productSalesVsInventoryUsage(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await InvenoryReports.productSalesVsInventoryUsage(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async productInventoryUsage(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.productInventoryUsage(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async productWastageSummaryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.wastageReportSummary(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async productWastageReports(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.wastageReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    /** new reports routes */

    //sales 
    public static async salesByServices(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByServices(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByItemReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches
            const resault = await MenuReports.salesByProductReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByDepartments(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByDepartments(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getSalesByCategoryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.SalesByCategoryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByMenuReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByMenuSectionsReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuSectionsReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByProductCategory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByProductCategory(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByMenuProductVsOptions(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuProductVsOptions(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByMenuProductVsService(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.salesByMenuProductVsService(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByTerminals(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByTerminals(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getSalesByDeliveryArea(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesByDeliveryArea(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByAggregatorReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByAggregatorReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //employee
    public static async salesByEmployeeReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.salesByEmployeeReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByProductVsEmployee(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.salesByProductVsEmployee(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getDriverReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.getDriverReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getDriverDetailsReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.getDriverDetailsReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getCashierReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.getCashierReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async shortOver(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.shortOver(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async cashierList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.cashierList(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async cashierReportByCashierId(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await EmployeeReports.cashierReportByCashierId(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //Tables
    public static async getSalesByTableGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.getSalesByTableGroups(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getSalesByTables(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await SalesRepots.getSalesByTables(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async tableUsage(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await SalesRepots.tableUsage(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async tableUsageSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await SalesRepots.tableUsageSummary(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //period
    public static async salesByPeriodReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByPeriodReport(data, company, null, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //Inventory
    public static async getGeneralInventoryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.getGeneralInventoryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesVsInventoryUsageReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.salesVsInventoryUsageReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async productInventoryUsageReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.productInventoryUsageReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async productSalesVsInventoryUsageReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.productSalesVsInventoryUsageReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async productMovementReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.productMovmentReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async wastageSummaryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.wastageSummaryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async productWastageReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.productWastageReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

     public static async expiredProductsReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.expiredProductsReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async reorderReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.reorderReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async inventoryTransferReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.inventoryTransferReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getManualAdjusmentInventoryMovment(req: Request, res: Response, next: NextFunction) {
        try {
            const movmentLineId = req.params.movmentLineId;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await InvenoryReports.getManualAdjusmentInventoryMovment(company, movmentLineId)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    //others
    public static async productPreparedTimeSummaryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.productPreparedTimeSummaryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async preparedTimeSummaryReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.preparedTimeSummaryReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByInvoice(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getdailySalesReport(req: Request, res: Response, next: NextFunction) {

        try {

            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await dailySalesReport.getdailySalesReport(data, company, branches)


            return res.send(resault)
        } catch (error: any) {


              throw error
        }



    }


    public static async salesByAggregatorSubReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.aggregatorSubReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }




    public static async SalesByBrand(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.SalesByBrandReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }



    public static async zeroSalesProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await MenuReports.zeroSalesProducts(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async salesByServiceId(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            const resault = await SalesRepots.salesByServiceId(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }


  
}