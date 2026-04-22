import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { EmployeeSchaduleRepo } from "@src/repo/admin/employeeSchedule.repo";
import { Request, Response, NextFunction } from 'express';

export class EmployeeScheduleController {
    public static async getEmployeesSchedule(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            await client.query("BEGIN")
            let resault;
            resault = await EmployeeSchaduleRepo.getEmployeesSchedule(client, data)

            await client.query("COMMIT")
            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        }finally {
            client.release()
        }
    }
}