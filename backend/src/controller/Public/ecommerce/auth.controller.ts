

import { CompanyRepo } from "@src/repo/admin/company.repo";
import { Request, Response, NextFunction } from "express";
import { ResponseData } from "@src/models/ResponseData";
export class CompanyController {

    public static async setCompany(req: Request, res: Response, next: NextFunction) {
        try {
            const slug = req.params.subDomain;
            const company = (await CompanyRepo.getCompanyBySubDomain(slug)).data
            if (company) {
                company.afterDecimal = company.settings.afterDecimal
                company.timeOffset = company.settings.timeOffset
                company.slug = slug
                res.locals.company = company
                next()
            }
        } catch (error: any) {
              throw error
        }
    }


}