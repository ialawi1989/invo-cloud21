import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { RedisClient } from '@src/redisClient';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { ShopRepo } from '@src/repo/ecommerce/shop.repo';
import { Request, Response, NextFunction } from 'express';


export class ShopController {

    public static async getMenuSections(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getMenuSections(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
    public static async getMenuProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getMenuProducts(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }



    public static async getMenuProductTags(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const cacheKey = `menuProductTags:${company.id}:${JSON.stringify(data)}`;
            const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds
            const redisClient = RedisClient.getRedisClient()
            const cached = await redisClient.get(cacheKey);
            await redisClient.deletKey(cacheKey)
            if (cached) {
                return res.send(JSON.parse(cached));
            }
            let sections = await ShopRepo.getMenuProductTags(data, company.id)

            if (!cached) {
           
                    await redisClient.set(cacheKey, JSON.stringify(sections), CACHE_TTL);

                
            }
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
    public static async getCatgorieProductsTags(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getCatgorieProductsTags(data, company.id)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }


    public static async getCompanyCategories(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const types: any[] = ["inventory", "kit", "batch", "serialized", "menuItem", "menuSelection", "package"]
            let sections = await ShopRepo.getCompanyCategories(data, company, types)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
    public static async getServicesListById(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getServicesListById(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getServicesList(req: Request, res: Response, next: NextFunction) {

        try {
            const data = req.body;
            const company = res.locals.company;

            let sections = await ShopRepo.getServicesList(data, company)

            return res.send(sections)
        } catch (error: any) {

              throw error
        }
    }

    public static async getServiceProductCategories(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const types: any[] = ["service"]
            let sections = await ShopRepo.getCompanyCategories(data, company, types)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
    public static async getCategoriesProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const types: any[] = ["inventory", "kit", "batch", "serialized", "menuItem", "menuSelection", "package"]

            let sections = await ShopRepo.getCategoriesProducts(data, company, types)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getServiceProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            // const types:any[] = ["inventory","kit","package","menuItem","menuSelection","batch","serialized"]
            const types: any[] = ["service"]
            let sections = await ShopRepo.getCategoriesProducts(data, company, types)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getProduct(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getaAlternativeProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getaAlternativeProducts(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }



    public static async getBrands(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getBrands(client, company)
            await client.query("COMMIT")

            return res.send(sections)
        } catch (error: any) {
            await client.query("ROLLBACK")

              throw error
        } finally {
            client.release()
        }
    }

    public static async search(req: Request, res: Response, next: NextFunction) {

        try {

            const data = req.body;
            const company = res.locals.company;
            let resault = await ShopRepo.generalSearch(data, company)


            return res.send(resault)
        } catch (error: any) {

              throw error
        } finally {

        }
    }


    public static async getCompanyMenu(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await ShopRepo.getCompanyMenu(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getProductMedia(req: Request, res: Response, next: NextFunction) {
        try {
            const productId = req.params.id;
            const company = res.locals.company;
            let sections = await ShopRepo.getProductMedia(company,productId)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }
}