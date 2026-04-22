import { DB } from '@src/dbconnection/dbconnection';
import { Company } from '@src/models/admin/company';
import { Employee } from '@src/models/admin/employee';
import { ResponseData } from '@src/models/ResponseData';
import { companyEmployeeRepo } from '@src/repo/admin/companyEmployees.repo';
import { EmployeeRepo } from '@src/repo/admin/employee.repo';
import { ValidationException } from '@src/utilts/Exception';
import { FileStorage } from '@src/utilts/fileStorage';
import { EmployeeValidation } from '@src/validationSchema/admin/employee.Schema';
import e, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto'
import { Logger } from '@src/utilts/invoLogger';

export class EmployeeController {
  //admin 
  public static async AddNewEmployee(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client()
    try {
      await client.query("BEGIN");
      const company = res.locals.company;
      const companyId = company.id;
      const userId = res.locals.user
      const add = await EmployeeRepo.InsertEmployee(client, req.body, companyId, userId);
      await client.query("COMMIT");
      return res.send(add)
    } catch (error: any) {
      await client.query("ROLLBACK");

           throw error
    } finally {
      client.release()
    }
  }
  public static async GetAllCompanyEmployee(req: Request, res: Response, next: NextFunction) {
    try {

      const companyId = req.params['companyId'];
      let company: Company;
      if (companyId) {
        company = new Company();
        company.id = req.params['companyId'];
      } else {
        company = res.locals.company
      }

      const data = req.body;

      const Employees = await companyEmployeeRepo.getCompanyEmployeeList(data, company);
      return res.send(Employees)
    } catch (error: any) {

           throw error
    }
  }


  public static async GetAllAdmins(req: Request, res: Response, next: NextFunction) {
    try {
      const Employees = await EmployeeRepo.getAllAdmins();
      return res.send(Employees)
    } catch (error: any) {

           throw error
    }
  }

  public static async getAdminById(req: Request, res: Response, next: NextFunction) {
    try {
      const adminId = req.params['adminId']
      const Employees = await EmployeeRepo.getAdminById(adminId);
      return res.send(Employees)
    } catch (error: any) {

           throw error
    }
  }

  public static async saveAdmin(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client()
    try {


      await client.query("BEGIN");

      let resault;
      if (req.body.id == "" || req.body.id == null) {
        resault = await EmployeeRepo.InsertAdmin(client, req.body);
      } else {
        resault = await EmployeeRepo.updateAdmin(client, req.body)
      }

      await client.query("COMMIT");
      return res.send(resault)
    } catch (error: any) {
      await client.query("ROLLBACK");

           throw error
    } finally {
      client.release()
    }
  }

  public static async EditEmployeeInfo(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN");
      const company = res.locals.company;
      const companyId = company.id;
      const userId = res.locals.user
      const update = await EmployeeRepo.updateEmployee(client, req.body, companyId, userId)
      await client.query("COMMIT");

      return res.send(update)
    } catch (error: any) {
      await client.query("ROLLBACK");

           throw error
    } finally {
      client.release()
    }
  }


  public static async GetEmployeeByID(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.params['employeeId']
      const companyId = req.params['companyId'];

      const localEmployeeId = res.locals.user
      const employee = await EmployeeRepo.getEmployeeById(localEmployeeId, employeeId, companyId);
      return res.send(employee)
    } catch (error: any) {

           throw error
    }
  }


  //Marchent
  public static async getEmployeeList(req: Request, res: Response, next: NextFunction) {
    try {


      const company = res.locals.company;
      const companyId = company.id;
      const data = req.body
      const Employees = await EmployeeRepo.getEmployeeList(data, companyId);
      return res.send(Employees)

    } catch (error: any) {

           throw error
    }
  }
  public static async getEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.params['employeeId']
      const company = res.locals.company;
      const companyId = company.id;
 
      const localEmployeeId = res.locals.user
      const employee = await EmployeeRepo.getEmployeeById(localEmployeeId, employeeId, companyId);
      return res.send(employee)
    } catch (error: any) {
     Logger.error(`Error in getEmployee: ${error.message}`, { stack: error.stack });
           throw error
    }
  }
  public static async saveEmployee(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client()
    try {


      await client.query("BEGIN");
      const company = res.locals.company;
      const companyId = company.id;
      const userId = res.locals.user
      let resault;
      if (req.body.id == "" || req.body.id == null) {
        req.body.companyId = companyId
        resault = await EmployeeRepo.InsertEmployee(client, req.body, companyId, userId);
      } else {
        resault = await EmployeeRepo.updateEmployee(client, req.body, companyId, userId)
      }

      await client.query("COMMIT");
      return res.send(resault)
    } catch (error: any) {
      await client.query("ROLLBACK");

           throw error
    } finally {
      client.release()
    }
  }

  public static async getEmployeeImage(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId;
      const employeeId = req.params.employeeId;
      const storage = new FileStorage();
      const image = await storage.getemployeeImage(companyId, employeeId)
      if (image) {
                const etag = crypto.createHash('md5').update(image).digest('hex');
                        res.setHeader('ETag', etag);
                        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(image)
      } else {
        return res.send(new ResponseData(true, "Image Not Found", []))
      }

    } catch (error: any) {

           throw error
    }
  }

  public static async setNewPassword(req: Request, res: Response, next: NextFunction) {
    try {
      let data = req.body;
      let company = res.locals.company;

      let employee = await EmployeeRepo.setNewPassword(data, company)
      return res.send(employee)
    } catch (error: any) {
      console.log(error)
           throw error
    }
  }

  public static async setEmployeeDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body
      const company = res.locals.company
      const employee = res.locals.user
      let dashboard = await EmployeeRepo.setEmployeeDashboard(data, employee, company)

      return res.send(dashboard)
    } catch (error: any) {
           throw error
    }
  }

  public static async getEmployeeDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body
      const company = res.locals.company
      const employee = res.locals.user
      let dashboard = await EmployeeRepo.getEmployeeDashboard(employee, company)

      return  res.send(dashboard)
    } catch (error: any) {
           throw error
    }
  }






  //invitedEmployee


  public static async getEmployeeByEmail(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {

      const company = res.locals.company;
      const email = req.body.email?.trim() ?? null;

      if (!email) { throw new ValidationException("email is reqired") }
      await client.query("BEGIN");
      const result = await companyEmployeeRepo.getEmployeeByEmail(client, email, company.id)
      await client.query("COMMIT");
      return res.send(result)

    } catch (error: any) {
      await client.query("ROLLBACK");
           throw error
    } finally {
      client.release()
    }
  }

  public static async saveCompanyEmployee(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN");
      const company = res.locals.company;
      const data = req.body;
      const result = await companyEmployeeRepo.saveEmployeeCompany(client, data, company.id)
      await client.query("COMMIT");
      return res.send(result)

    } catch (error: any) {
      await client.query("ROLLBACK");
           throw error
    } finally {
      client.release()
    }
  }



  public static async getCompanyEmployee(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN");
      const companyId = req.params.companyId;
      const employeeId = req.params.employeeId;

      const employee = await companyEmployeeRepo.getEmployeeCompany(client, employeeId, companyId)
      await client.query("COMMIT");
      return res.send(employee)

    } catch (error: any) {
      await client.query("ROLLBACK");
           throw error
    } finally {
      client.release()
    }
  }

  public static async getCompanyGroupEmployees(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN");
      const company = res.locals.company;
      const employeeId = res.locals.user;
      let data = req.body
      const result = await companyEmployeeRepo.getCompanyGroupEmployees(client, data, employeeId, company)
      await client.query("COMMIT");
      return res.send(result)

    } catch (error: any) {
      await client.query("ROLLBACK");
           throw error
    } finally {
      client.release()
    }
  }

  public static async getCompanyList(req: Request, res: Response, next: NextFunction) {

    try {

      const company = res.locals.company;
      const employeeId = res.locals.user;
      const result = await companyEmployeeRepo.getCompanyList(employeeId, company)

      return res.send(result)

    } catch (error: any) {
           throw error
    }
  }





  public static async sendEmployeeInvention(req: Request, res: Response, next: NextFunction) {
    try {
      let employeeId = req.params.employeeId;
      let company = res.locals.company;

      let employee = await EmployeeRepo.sendEmployeeInvention(employeeId, company)
      return  res.send(employee)
    } catch (error: any) {
      console.log(error)
           throw error
    }
  }

  public static async setEmployeeOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body
      const company = res.locals.company
      const employee = res.locals.user
      let dashboard = await EmployeeRepo.setEmployeeOptions(data, employee, company.id)

      return res.send(dashboard)
    } catch (error: any) {
      return res.send(new ResponseData(false, error.message, []))
    }
  }

  public static async getEmployeeOptions(req: Request, res: Response, next: NextFunction) {
    try {

      const company = res.locals.company
      const employee = res.locals.user
      let dashboard = await EmployeeRepo.getEmployeeOptions(employee, company.id)

      return  res.send(dashboard)
    } catch (error: any) {
      return res.send(new ResponseData(false, error.message, []))
    }
  }
}