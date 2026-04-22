import { Request, Response, NextFunction } from 'express';
import { DepartmentRepo } from '@src/repo/app/product/department.repo'
import { ResponseData } from '@src/models/ResponseData';
import { DB } from '@src/dbconnection/dbconnection';
export class DepartmentController {
   public static async addDepartment(req: Request, res: Response, next: NextFunction) {
      const client = await DB.excu.client();
      try {

         await client.query("BEGIN")
         const company =res.locals.company;
         let resData;
         if (req.body.id == null || req.body.id == "") {
            resData = await DepartmentRepo.addDepartment(client,req.body, company);
         } else {
            resData = await DepartmentRepo.editDepartment(req.body, company);
         }

         res.send(resData);
         await client.query("COMMIT")
      } catch (error: any) {
         await client.query("ROLLBACK")      
                 throw error
      }finally{
         client.release()
      }
   }


   public static async updateTranslation(req: Request, res: Response, next: NextFunction) {
      try {
          const update = await DepartmentRepo.updateTranslation(req.body)
          return res.send(update)
      } catch (error: any) {
               throw error
      }
  }






   public static async getDepartment(req: Request, res: Response, next: NextFunction) {
      try {
         const departmentId = req.params['departmentId'];
         const company =res.locals.company;
         const department = await DepartmentRepo.getDepartment(departmentId, company);
         res.send(department);
      } catch (error: any) {
              throw error
      }

   }
   public static async getDepartmentList(req: Request, res: Response, next: NextFunction) {
      try {
         const company =res.locals.company
         const data = req.body;
        
       
          const  list = await DepartmentRepo.getDepartmentList(data, company)
         res.send(list);
      } catch (error: any) {
              throw error
      }

   }
   public static async getDepartments(req: Request, res: Response, next: NextFunction) {
      try {
         const company =res.locals.company
         const list = await DepartmentRepo.getDepartments(company)
         res.send(list);
      } catch (error: any) {
              throw error
      }

   }
   public static async editDepartment(req: Request, res: Response, next: NextFunction) {
      try {
         const company =res.locals.company;
         const edit = await DepartmentRepo.editDepartment(req.body, company)
         res.send(edit)
      } catch (error: any) {
              throw error
      }

   }

   public static async deleteDepartment(req: Request, res: Response, next: NextFunction) {
      try {
         const departmentId =req.params.departmentId;
         const edit = await DepartmentRepo.deleteDepartments(departmentId)
         res.send(edit)
      } catch (error: any) {
              throw error
      }

   }
}