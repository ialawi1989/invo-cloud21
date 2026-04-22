import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { EmployeePrivilegeRepo } from '@src/repo/admin/EmployeePrivilege.repo';
import { SocketCustomerRepo } from '@src/repo/socket/customer.socket';
import { SocketEmployee } from '@src/repo/socket/employee.socket';
import e, { Request, Response, NextFunction } from 'express';
export class EmployeePrivilegesController {
    public static async savePrivileges(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;
            const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId)
            await client.query("BEGIN")
            if (data.id != "" && data.id != null) {
                resault = await EmployeePrivilegeRepo.editPrivilege(client, data, companyId)
                await SocketEmployee.sendUpdatePrivilage(branchIds, resault.data.role)
            } else {
                resault = await EmployeePrivilegeRepo.savePrivilege(client, data, companyId)
                await SocketEmployee.sendNewPrivilage(branchIds, resault.data.role)
            }
            await client.query("COMMIT")


          
        
            return res.send(resault)
        } catch (error: any) {

            client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
    }

    public static async getEmployeePrivilageList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;

            const resault = await EmployeePrivilegeRepo.getEmployeePrivileges(data, companyId)

            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getEmployeePrivilageById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const id = req.params['employeePrivilegeid'];

            const resault = await EmployeePrivilegeRepo.getEmployeePrivilegeById(id)

            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }
}