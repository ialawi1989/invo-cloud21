import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Service, ServiceSetting } from '@src/models/Settings/service';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { ServiceRepo } from '@src/repo/admin/services.repo';
import { SocketService } from '@src/repo/socket/service.socket';
import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
export class ServiceController {
  public static async getServicesList(req: Request, res: Response, next: NextFunction) {
    try {

      const company = res.locals.company;
      const companyId = company.id;
      const data = req.body;
      const services = await ServiceRepo.getServicesList(data, companyId);
      return res.send(services);

    } catch (error: any) {

      throw error;
    }
  }


  public static async getAdminServicesList(req: Request, res: Response, next: NextFunction) {
    try {


      const companyId = req.params.companyId;
      const data = req.body;
      const services = await ServiceRepo.getServicesList(data, companyId);
      return res.send(services);

    } catch (error: any) {

      throw error;
    }
  }

  public static async saveService(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {


      await client.query("BEGIN")
      const data = req.body
      let resault;

      const company = res.locals.company;
      const companyId = company.id;

      if (data.id == null || data.id == "") {
        resault = await ServiceRepo.AddBranchServices(client, data, companyId);
      } else {
        resault = await ServiceRepo.editBranchService(client, data, companyId);
      }
      await client.query("COMMIT")


      return res.send(resault);

    } catch (error: any) {

      await client.query("ROLLBACK")
      throw error;
    } finally {
      client.release()
    }
  }



  public static async addServiceToCompany(req: Request, res: Response, next: NextFunction) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN")
      const data = req.body
      const companyId = data.companyId;
      let branches = (await BranchesRepo.getBranchList(client, companyId)).data
      const element = req.body.service;
      const service = new Service();
      service.ParseJson(element);
      service.index = 1;
      for (let index = 0; index < branches.length; index++) {
        const id = branches[index].id;
        let serviceSetting = new ServiceSetting();
        serviceSetting.branchId = id;
        serviceSetting.setting = service.setting;
        service.branches.push(serviceSetting);
      }
      let resault = await ServiceRepo.AddBranchServices(client, service, companyId)
      await client.query("COMMIT")
      return res.send(resault);

    } catch (error: any) {

      await client.query("ROLLBACK")
      throw error;
    } finally {
      client.release()
    }
  }


  public static async getService(req: Request, res: Response, next: NextFunction) {
    try {

      const serviceId = req.params['serviceId'];
      const services = await ServiceRepo.getService(serviceId);
      return res.send(services);

    } catch (error: any) {

      throw error;
    }
  }
  public static async getPickUpAndDeliveryServicesList(req: Request, res: Response, next: NextFunction) {
    try {
      const company = res.locals.company;
      const companyId = company.id;
      const services = await ServiceRepo.getPickUpAndDeliveryServicesList(companyId);
      return res.send(services);

    } catch (error: any) {

      throw error;
    }
  }

  public static async arrangeServices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body.list;
      const services = await ServiceRepo.arrangeServices(data);
      return res.send(services);

    } catch (error: any) {

      throw error;
    }
  }



  public static async getBranchServices(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId

      const branch = await ServiceRepo.getBranchServices(branchId)

      return res.send(branch)
    } catch (error: any) {

      throw error
    }
  }

  public static async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      const serviceId = req.params.serviceId

      const branch = await ServiceRepo.deleteService(serviceId)

      return res.send(branch)
    } catch (error: any) {

      throw error
    }
  }
}