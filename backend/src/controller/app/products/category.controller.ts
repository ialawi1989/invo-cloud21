
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { PaymnetMethodRepo } from '@src/repo/app/accounts/paymentMethod.repo';
import { CategoryRepo } from '@src/repo/app/product/category.repo';
import { Request, Response, NextFunction } from 'express';
export class CategoryController {
  public static async addCategory(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {

      await client.query("BEGIN")
      const company =res.locals.company;
      const data = req.body;
      let resault;
      if (data.id == null || data.id == "") {
        resault = await CategoryRepo.addCategory(client,data, company);
      } else {
        resault = await CategoryRepo.editCategory(client,data, company);
      }

      await client.query("COMMIT")
      return res.send(resault)
    } catch (error: any) {
      await client.query("ROLLBACK")
           throw error
    }finally{
      client.release()
    }

  }

  public static async editCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const company =res.locals.company;
      // const edit = await CategoryRepo.editCategory(req.body, company);
      // return res.send(edit)
    } catch (error: any) {
           throw error
    }

  }




  public static async updateTranslation(req: Request, res: Response, next: NextFunction) {
    try {
        const update = await CategoryRepo.updateTranslation(req.body)
        return res.send(update)
    } catch (error: any) {
             throw error
    }
}


  public static async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.params['categoryId'];
      const company =res.locals.company;
      const category = await CategoryRepo.getCategory(categoryId, company);
      return res.send(category);
    } catch (error: any) {
           throw error
    }
  }

  public static async getCategoryList(req: Request, res: Response, next: NextFunction) {
    try {
      const company =res.locals.company;
      const data =req.body
      const list = await CategoryRepo.getCategoryList(data,company);
      return res.send(list)
    } catch (error: any) {
           throw error
    }

  }

  public static async getDepartmentCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const company =res.locals.company;
      const list = await CategoryRepo.getDepartmnetsCategory(company);
      return res.send(list)
    } catch (error: any) {
           throw error
    }

  }

  public static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId =req.params.categoryId;
      const list = await CategoryRepo.deleteCategory(categoryId);
      return res.send(list)
    } catch (error: any) {
           throw error
    }

  }
    public static async rearrangeCategories(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;

            const list = await CategoryRepo.rearrangeCategories(data,company)
            return res.send(list)
        } catch (error:any) {
            
            throw error 
        }
    }


}