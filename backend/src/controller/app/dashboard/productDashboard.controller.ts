import { ResponseData } from '@src/models/ResponseData';
import { ProductDashboardRepo } from '@src/repo/app/product/ProductDashboard.repo';
import { Request, Response, NextFunction } from 'express';

export class ProductDashboardController {

    static async productHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;


            const resault = await ProductDashboardRepo.productHistory(data, company)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    static async salesByService(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await ProductDashboardRepo.salesByService(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    static async salesByTime(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await ProductDashboardRepo.salesByTime(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    static async Last12MonthsSales(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await ProductDashboardRepo.Last12MonthsSales(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    static async wastageReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await ProductDashboardRepo.wasteReport(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    static async salesBySource(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const resault = await ProductDashboardRepo.salesBySource(data, company, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    //post method to get product sales
    static async getProductSales(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;
            const branch = req.body.branchId ? req.body.branchId : null;
          
            const page = req.body.page ? req.body.page : 1;
            const limit = req.body.limit ? req.body.limit : 10;

            const result = await ProductDashboardRepo.getProductSales(productId, company, branch, page, limit);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }

    static async getProductSalesByDay(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;

            const result = await ProductDashboardRepo.getProductSalesByDay(productId, company);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }

    static async getProductSalesByService(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;

            const result = await ProductDashboardRepo.getProductSalesByService(productId, company);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }

     static async getProductDetails(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;

            const result = await ProductDashboardRepo.getProductDetails(productId, company);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }

    static async getProductStats(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;

            const result = await ProductDashboardRepo.getProductStats(productId, company);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }

    static async getProductActivity(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;

            const result = await ProductDashboardRepo.getProductActivity(productId, company);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }

    static async getProductLast12MonthSales(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.productId;
            const company = res.locals.company;

            const result = await ProductDashboardRepo.getProductLast12MonthSales(productId, company);
            return res.send(result);
        } catch (error: any) {
            throw error;
        }
    }
}