import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { PriceLabel } from '@src/models/product/PriceLabel';
import { priceManagmentRepo } from '@src/repo/app/product/priceManagment.repo';
import { Request, Response, NextFunction } from 'express';
import { RedisClient } from '@src/redisClient';
export class PriceManagmentController {
    public static async savePriceLabel(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;
            let resault;
            if (data.id == null || data.id == "") {
                resault = await priceManagmentRepo.addPriceLabel(client, data, company)
            } else {
                resault = await priceManagmentRepo.editPriceLabel(client, data, company)
            }
            await client.query("COMMIT")
            res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }





    public static async getPriceLabelBulkImportProgress(req: Request, res: Response, next: NextFunction) {

        try {
            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;
            const priceLabelId = req.params.priceLabelId;
            let isBulkImport = await redisClient.get("PriceLabelBulkImport" + priceLabelId)
            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false, "A Previouse  Import is Still In Progress", {}))
            }
            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {
            throw error
        }
    }





    public static async importPriceLabel(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            let redisClient = RedisClient.getRedisClient();




            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;

            let isBulkImport = await redisClient.get("PriceLabelBulkImport" + data.id)
            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false, "A Previouse Import is Still In Progress: " + {}, []))
            }
            let savedData = (await priceManagmentRepo.getPriceLabelById(data.id)).data.productsPrices;
            const resault = await priceManagmentRepo.setIdsFromBarcodes(client, data, company);
            let incomingData = resault.process_products.productsPrices;

            interface MyObject {
                productId: number;
                price: string;
                // Add more properties as needed
            }
            const mergeArrays = (arr1: MyObject[], arr2: MyObject[]): MyObject[] => {
                const map = new Map<number, MyObject>();

                // Add all items from arr1 to map
                arr1.forEach(item => map.set(item.productId, item));

                // Add or overwrite items from arr2 to map
                arr2.forEach(item => map.set(item.productId, item));

                // Convert map values back to array
                return Array.from(map.values());
            };
            const mergedArray = mergeArrays(savedData, incomingData);
            resault.process_products.productsPrices = mergedArray;

            let editResault = await priceManagmentRepo.editPriceLabel(client, resault.process_products, company)
            if (editResault.success) {
                await redisClient.deletKey("PriceLabelBulkImport" + data.id)
            }
            await client.query("COMMIT")
            res.send(new ResponseData(true, "", {}))
        } catch (error: any) {
            let redisClient = RedisClient.getRedisClient();
            const data = req.body;
            await redisClient.deletKey("PriceLabelBulkImport"+data.id)
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }



    public static async getPriceLabelList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const resault = await priceManagmentRepo.getPriceLabelList(data, company)

            res.send(resault)
        } catch (error: any) {

            throw error
        }
    }
    public static async getPriceLabelById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const priceLabelId = req.params.priceLabelId;
            const resault = await priceManagmentRepo.getPriceLabelById(priceLabelId)
            res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async savePriceManagment(req: Request, res: Response, next: NextFunction) {
        try {
            // const company = res.locals.company;
            // const data = req.body;
            // let resault;

            // if(data.id == null || data.id =="")
            // {
            //     resault = await priceManagmentRepo.addPriceManagement(data,company)
            // }else{
            //     resault = await priceManagmentRepo.editPriceManagement(data,company)
            // }

            res.send(new ResponseData(true, "", []))
        } catch (error: any) {
            throw error
        }
    }
    public static async getPriceManagmentList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            const resault = await priceManagmentRepo.getPriceManagmentList(data, company)
            res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async getPriceManagmentById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const priceManagmentId = req.params.priceManagmentId;
            const resault = await priceManagmentRepo.getPriceManagmentById(priceManagmentId)
            res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async validatePriceManagmentDate(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const data = req.body;
            const company = res.locals.company;
            let resault

            await client.query("BEGIN")
            if (data.id != null && data.id != "") {
                resault = await priceManagmentRepo.validatePriceManagmentDate(client, data.id, company, data.fromDate, data.toDate);
            } else {
                resault = await priceManagmentRepo.validatePriceManagmentDate(client, null, company, data.fromDate, data.toDate);
            }
            await client.query("COMMIT")

            if (resault) {
                return res.send(new ResponseData(false, "A price Managment Already Exist on the Same Interval Time Selected", []))
            } else {
                return res.send(new ResponseData(true, "", []))
            }

        } catch (error: any) {
            await client.query("ROLLBACK")

            throw error
        } finally {
            client.release();
        }
    }
}