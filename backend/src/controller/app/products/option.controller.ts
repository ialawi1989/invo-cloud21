
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { RedisClient } from "@src/redisClient";
import { OptionRepo } from "@src/repo/app/product/option.repo";
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
export class OptionsController {
    public static async getOptions(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const resault = await OptionRepo.getOptions(data, company)

            res.send(resault)
        } catch (error: any) {
            throw error
        }
    }




    public static async updateOptionGroupTranslation(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await OptionRepo.updateOptionGroupTranslation(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }
    public static async updateOptionTranslation(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await OptionRepo.updateOptionTranslation(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }



    public static async getOptionById(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const optionId = req.params['optionId'];
            const brandId = req.params['brandId']
            const option = await OptionRepo.getOption(company, optionId, brandId);
            return res.send(option)
        } catch (error: any) {

            throw error
        }
    }

    public static async addOption(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;
            let resault;
            if (data.id == "" || data.id == null) {
                resault = await OptionRepo.addOption(client, data, company)
            } else {
                resault = await OptionRepo.editOption(client, data, company)
            }
            res.send(resault)
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw error
        } finally {
            client.release()
        }
    }







    // public static async editOption(req: Request, res: Response, next: NextFunction) {
    //     try {
    //          const company = res.locals.company;
    //     const add = await OptionRepo.editOption(req.body,company)
    //     res.send(add) 
    //     }catch (error:any) {
    //         return res.send(new ResponseData(true,error.message,[]))
    //       }


    // }
    public static async getOptionGroupList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const optionGroupList = await OptionRepo.getOptionGroupsList(data, company);
            res.send(optionGroupList)
        } catch (error: any) {
            throw error
        }
    }
    public static async getOptionGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const optionGroupId = req.params['optionGroupId']
            const brandId = req.params['brandId']
            const optionGroup = await OptionRepo.getOptionGroups(company, optionGroupId, brandId);
            res.send(optionGroup)
        } catch (error: any) {

            throw error
        }
    }
    public static async addOptionGroup(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company = res.locals.company;

            const data = req.body;
            let resault;
            if (data.id == null || data.id == "") {
                resault = await OptionRepo.InsertOptionGroup(client, data, company)
            } else {
                resault = await OptionRepo.editOptionGroup(data, company)
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

    public static async editOptionGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const edit = await OptionRepo.editOptionGroup(req.body, company);
            res.send(edit);
        } catch (error: any) {

            throw error
        }
    }

    public static async importFromCsv(req: Request, res: Response, next: NextFunction) {
        let redisClient = RedisClient.getRedisClient();
        let company = res.locals.company;
        try {

            let data = req.body;

            let employeeId = res.locals.user;
            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            let count = data.length; //3000
            let pageCount = Math.ceil(count / limit)

            let offset = 0;
            let resault = new ResponseData(true, "", [])


            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("OptionBulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false, "A Previouse Option Import is Still In Progress: " + progress, []))
            }


            for (let index = 0; index < pageCount; index++) {

                // if (page != 0) {
                //     offset = (limit * (page - 1))
                // }


                let options: any = data.splice(offset, limit)

                resault = await OptionRepo.importFromCVS(options, company, employeeId, index + 1, count)

                if (resault.success && index + 1 == pageCount) {
                    await redisClient.deletKey("OptionBulkImport" + company.id)
                }
            }



            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {
            await redisClient.deletKey("OptionBulkImport" + company.id)
            throw error
        } finally {
            await redisClient.deletKey("OptionBulkImport" + company.id);
        }
    }

    public static async getBulkImportProgress(req: Request, res: Response, next: NextFunction) {

        try {


            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;

            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("OptionBulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;

                return res.send(new ResponseData(false, "A Previouse Option Import is Still In Progress: " + progress, { progress: progress }))
            }




            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {

            throw error
        }
    }

    public static async updateProductOptionsAvailability(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;
            const option = await OptionRepo.updateProductOptionsAvailability(client, company, data);

            await client.query("COMMIT")
            return res.send(option)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }
    public static async updateOnlineProductOptionsAvailability(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;
            const option = await OptionRepo.updateOnlineProductOptionsAvailability(client, company, data);

            await client.query("COMMIT")
            return res.send(option)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }
    public static async getOptionsProductAvailability(req: Request, res: Response, next: NextFunction) {

        try {
            const company = res.locals.company;
            const data = req.body;
            const branchProdId = req.params['branchProdId']
            const option = await OptionRepo.getOptionsProductAvailability(company, branchProdId);

            return res.send(option)

        } catch (error: any) {

            throw error
        }
    }

    public static async exportOptions(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const type = req.params.type

            const result = await OptionRepo.exportOptions(company, type);
            res.download(company.id + `options.${type}`)
            console.log(type)
            res.on('finish', () => {
                try {
                    fs.unlinkSync(company.id + `options.${type}`);
                } catch (error: any) {
                    res.send(new ResponseData(false, error.message, []));
                }

            });

        } catch (error: any) {
            throw error;
        }
    }


    public static async setOptionAvailability(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const type = req.params.type
            const data = req.body

            const result = await OptionRepo.setOptionAvailability(data, company.id);
            return res.send(result)

        } catch (error: any) {
            throw error;
        }
    }


    public static async deleteOption(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const type = req.params.type
            const optionId = req.params.optionId

            const result = await OptionRepo.deleteOptions(optionId, company.id);
            return res.send(result)

        } catch (error: any) {
            throw error;
        }
    }

    public static async deleteOptionGroup(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const type = req.params.type
            const optionGroupId = req.params.optionGroupId

            const result = await OptionRepo.deleteOptionGroup(optionGroupId, company);
            return res.send(result)

        } catch (error: any) {
            throw error;
        }
    }

     public static async getOptionRecipeItems(req: Request, res: Response, next: NextFunction) {
            try {
                const optionId = req.params['id'];
                const company =res.locals.company;
    
                const response = await OptionRepo.getOptionRecipeItems(optionId, company.id); 
                return res.send(new ResponseData(true, "", response?.recipe??[]));

            } catch (error: any) {
                throw error
            }
    
        }
}