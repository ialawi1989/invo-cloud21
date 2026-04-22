import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { ThemeRepo } from '@src/repo/ecommerce/theme.repo';
import { Request, Response, NextFunction } from 'express';

export class ThemeController {

    public static async getMenus(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            let sections = await ThemeRepo.getMenus(company)
            return  res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getHomeSections(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            let sections = await ThemeRepo.getHomeSections(company)
            return  res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
    public static async getMenuProducts2(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const types: any[] = ["inventory", "kit", "batch", "serialized", "menuItem"]
            let sections = await ThemeRepo.getMenuProducts2(data, company, types)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getMenuProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body


            /** Cached Data 
             * its used when data.chach = true 
             * when an edit happen on the productCollection the cached will be remove from edited collection  
             * 
             */
            let sections
            if (data.cache) {
                let collection = await ThemeRepo.getCacheCollection('Collection_' + company.id + '_' + data.slug);
                if (collection) {
                    let responseData = JSON.parse(collection)
                    sections = new ResponseData(true, "", responseData)
                }
            }


            if (!sections) {
                const types: any[] = ["inventory", "kit", "batch", "serialized", "menuItem", "menuSelection"]

                sections = await ThemeRepo.getMenuProducts(data, company, types)
            }

            return   res.send(sections)
        } catch (error: any) {
             throw error
        }
    }
    public static async getPage(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const slug = req.params["slug"]
            if (slug == null || slug == "") {
                res.send(new ResponseData(false, "slug is required", []));
                return;
            }
            let sections = await ThemeRepo.getPageSlug(slug, company)
            return  res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
    public static async getSectionData(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body

            let sections = await ThemeRepo.getSectionData(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    // public static async getMenu(req: Request, res: Response, next: NextFunction){
    //     try {
    //         const company = res.locals.company;
    //         const slug  = req.params.slug

    //         let sections = await ThemeRepo.getPageSlug(slug, company)
    //         res.send(sections) 
    //     } catch (error:any) {
    //         res.send(new ResponseData(false, error.message, []))
    //     }
    // } 
}