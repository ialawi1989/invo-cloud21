import { DB } from "@src/dbconnection/dbconnection";
import { Dimension } from "@src/models/product/Dimension";
import { ResponseData } from "@src/models/ResponseData";
import { ProductDimensionRepo } from "@src/repo/app/product/productDimensions.repo";
import { Request, Response, NextFunction } from 'express';
export class DimensionController {
    
    public static async saveDimension(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();

        try {

            const company = res.locals.company;
            const data = req.body;
            let resault

            await client.query("BEGIN")


            if (data.id) {
                resault = await ProductDimensionRepo.updateDimension(client, data, company.id);
            } else {
                resault = await ProductDimensionRepo.addDimension(client, data, company.id);
            }

            await client.query("COMMIT")
            return res.send(new ResponseData(true, "", resault))


        } catch (error: any) {
            await client.query("ROLLBACK")

            throw error
        } finally {
            client.release()
        }
    }

    public static async getDimensionById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const dimensionId = req.params['dimensionId'];
            const matrix = await ProductDimensionRepo.getDimensionById(company.id, dimensionId)
            return res.send(matrix);

        } catch (error: any) {
            throw error
        }
    }

    public static async getDimensionList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const matrix = await ProductDimensionRepo.getDimensionList(data, company.id);
            return res.send(matrix)

        } catch (error: any) {
            throw error
        }
    }
}