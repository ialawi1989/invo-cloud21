
import { ResponseData } from '@src/models/ResponseData';
import { RedisClient } from '@src/redisClient';
import { RecipeRepo } from '@src/repo/app/product/recipe.repo';
import { Request, Response, NextFunction } from 'express';

export class RecipeController {

    public static async saveRecipe(req: Request, res: Response, next: NextFunction) {
        try {
            const data: any = req.body;
            const company =res.locals.company;
            const employeeId = res.locals.user;
            let resault;
            if (req.body.id == null || req.body.id == '') {
                resault = await RecipeRepo.addRecipe(data, company)
            } else {
                resault = await RecipeRepo.editRecipe(data, company, employeeId)
            }

            res.send(resault)
        } catch (error: any) {

              throw error
        }

    }
    public static async editRecipe(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const data = req.body;
            const employeeId = res.locals.user;
            const edit = await RecipeRepo.editRecipe(data, company, employeeId);
            return res.send(edit)
        } catch (error: any) {
            throw error
        }

    }
    public static async getRecipe(req: Request, res: Response, next: NextFunction) {
        try {
            const recipeId = req.params['recipeId'];
            const company =res.locals.company;

            const recipe = await RecipeRepo.getRecipe(recipeId, company);
            return res.send(recipe);
        } catch (error: any) {
            throw error
        }

    }
    public static async getAllRecipe(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const data = req.body;
            const recipes = await RecipeRepo.getRecipes(data,company);

            return res.send(recipes)
        } catch (error: any) {
            throw error
        }

    }
    public static async getMenuItemRecipeList(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company
           const data = req.body
            const list = await RecipeRepo.getMenuItemRecipeList(data,company)
            return res.send(list)
        } catch (error: any) {
            throw error
        }

    }

    public static async importFromCsv(req: Request, res: Response, next: NextFunction) {
        let redisClient = RedisClient.getRedisClient();
        let company = res.locals.company;
        try {

           
                

            let data = req.body;
            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;
            
            let count = data.length; //3000
            let pageCount = Math.ceil(count / limit)
          
            let offset = 0;
            let resault = new ResponseData(true, "", [])

            let isBulkImport = await redisClient.get("recipeBulkImport"+company.id)
               
            if(isBulkImport)
            {   let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false,"A Previouse Import is Still In Progress: " + progress,[]))
            }


            for (let index = 0; index < pageCount; index++) {
        
                let products: any = data.splice(offset, limit)

                resault = await RecipeRepo.importFromCVS( products,company, index+1,count)

                if(resault.success && index+1 == pageCount){
                    await redisClient.deletKey("recipeBulkImport"+company.id)
                }
            }



            return res.send(resault)
        } catch (error: any) {
            await redisClient.deletKey("recipeBulkImport"+company.id)
            throw error
        }
    }

    public static async exportFromXl(req: Request, res: Response, next: NextFunction) {

        let company = res.locals.company;
        try {

           
                          const data = req.body;
                          const companyId = res.locals.companyId;
                          const reference = data.reference;
                          const  resault = await RecipeRepo.exportXslForRecipeImport(company.id)
                       
              // Set the response headers for file download
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
           
              // Write workbook to the response stream
              await resault.xlsx.write(res);
              res.end();
                   return new ResponseData(true, "", [])
       
    
        } catch (error: any) {
  
            throw error
        }
    }

    public static async getRecipeItems(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const id = req.params['id'];
            const recipes = await RecipeRepo.getRecipeItems(id, company);

            return res.send(new ResponseData(true, '', recipes))
        } catch (error: any) {
            throw error
        }

    }

    

    
}