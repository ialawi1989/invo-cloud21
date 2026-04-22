
import { Request, Response, NextFunction } from "express";
import { ResponseData } from "@src/models/ResponseData";
import { CompanyGroupRepo } from "@src/repo/admin/companyGroups.repo";

export class CompanyGroupController {
  public static async AddNewCompanyGroup(req: Request,res: Response,next: NextFunction ) {
    try {
      let data = req.body;
      let adminId;
      if(res.locals.admin){
        adminId = res.locals.admin
      }else{
        adminId = null
      }
     
      const companyinsert: any = await CompanyGroupRepo.InsertCompanyGroup(data,adminId);
      return res.send(companyinsert)
    } catch (error:any) {
      
        throw error   
    }
  }

  public static async getAllCompanyGroups(req: Request,res: Response, next: NextFunction) {
    try {
      const resault = await CompanyGroupRepo.getAllCompanyGroups();
      return res.send(resault);
    } catch (error:any) {
      
        throw error   
    }
  }







  public static async getAllAdminInvoices(req: Request,res: Response, next: NextFunction) {
    try {
      const resault = await CompanyGroupRepo.getAllAdminInvoices();
      res.send(resault);
    } catch (error:any) {
      
        throw error   
    }
  }



  public static async getAdminLog(req: Request,res: Response, next: NextFunction) {
    try {
      const resault = await CompanyGroupRepo.getAdminLog();
      return  res.send(resault);
    } catch (error:any) {
        throw error   
    }
  }



  public static async getSocketLog(req: Request,res: Response, next: NextFunction) {
    try {
      let data = req.body;
      const resault = await CompanyGroupRepo.getSocketLog(data);
      return  res.send(resault);
    } catch (error:any) {
        throw error   
    }
  }













  public static async editCompanyGroup(req: Request,res: Response,next: NextFunction) {
    try {

      const edit = await CompanyGroupRepo.EditCompanyGroup(req.body);
      return res.send(edit)
    } catch (error:any) {
      
        throw error   
    }
  }

  public static async getCompanyGroupById(req: Request, res: Response,next: NextFunction ) {
    try {
      const companyId = req.params.companyGroupId;
      const company = await CompanyGroupRepo.getCompanyGroupById(companyId);
      return res.send(company);
    } catch (error:any) {
      
        throw error   
    }
  }

  public static async TestingDelete(req: Request, res: Response,next: NextFunction) {
    try {
      const response = await CompanyGroupRepo.TestingDelete(req.body)
      return  res.send(response)
    } catch (error) {
      
    }
  }

  
  public static async getCompanyGroupSuperAdmin(req: Request,res: Response, next: NextFunction) {
    try {
      let id = req.params.companyGroupId
      const resault = await CompanyGroupRepo.getCompanyGroupSuperAdmin(id);
      return res.send(resault);
    } catch (error:any) {
      
        throw error   
    }
  }

}
