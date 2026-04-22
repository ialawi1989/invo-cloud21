
import { ResponseData } from '@src/models/ResponseData';
import { WebSiteBuilderRepo } from '@src/repo/app/settings/webSiteBuilder.repo';
import { ThemeRepo } from '@src/repo/ecommerce/theme.repo';
import { Request, Response, NextFunction } from 'express';
export class WebsiteBuilderController {
    public static async saveWebsiteTheme(req: Request, res: Response, next: NextFunction) {
        try {
            let data = req.body;
            let company = res.locals.company
            let resault
            if (data.id != null && data.id != "") {
                resault = await WebSiteBuilderRepo.updateWebsiteTheme(data, company)
            } else {
                resault = await WebSiteBuilderRepo.insertWebSiteTheme(data, company)
            }

            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }


    public static async getWebSiteThemeSettings(req: Request, res: Response, next: NextFunction) {
        try {
            let data = req.body;
            let companyId = res.locals.company.id
            let resault = await WebSiteBuilderRepo.getWebSiteThemeSettings(companyId)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }

    public static async getWebsiteBuilderPageList(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company
            let resault = await WebSiteBuilderRepo.getWebsiteBuilderPageList(company)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }

    public static async getWebSitePageSettings(req: Request, res: Response, next: NextFunction) {
        try {
            let slug = req.params.slug;
            let companyId = res.locals.company.id
            let resault = await WebSiteBuilderRepo.getWebSitePageSettings(slug, companyId)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }

    public static async getMenuSettings(req: Request, res: Response, next: NextFunction) {
        try {

            let companyId = res.locals.company.id
            let resault = await WebSiteBuilderRepo.getMenuSettings(companyId)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }

    public static async getThemeByType(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company
            let data = req.body
            let resault = await WebSiteBuilderRepo.getThemesByType(data, company)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }




    public static async getThemeById(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company
            let id = req.params.id
            let resault = await WebSiteBuilderRepo.getById(id, company)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }


    public static async deleteThemeById(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company
            let id = req.params.id
            let resault = await WebSiteBuilderRepo.deleteTheme(id, company)
            return res.send(resault)
        } catch (error:any) {
            throw error
        }
    }

    public static async setHomePage(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company
            let id = req.params.id
            let resault = await WebSiteBuilderRepo.setHomePage(id, company.id)
            return res.send(resault)
            
        } catch (error:any) {
            throw error
        }
    }

    public static async getMenus(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company
            let id = req.params.id
            let menuSettings = (await ThemeRepo.getWebsiteMenu(company.id));
            return res.send(menuSettings)
            
        } catch (error:any) {
            throw error
        }
    }


    public static async deleteContentLibrary(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const id = req.params.id
            const result = await WebSiteBuilderRepo.deleteCollection(id, company)
            return res.send(result)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }

}