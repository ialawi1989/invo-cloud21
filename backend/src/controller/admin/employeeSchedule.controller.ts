import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { EmployeeSchaduleRepo } from "@src/repo/admin/employeeSchedule.repo";
import { Request, Response, NextFunction } from 'express';
export class EmployeeScheduleController {

    public static async saveEmployeeSchedule(req: Request, res: Response, next: NextFunction) {

        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;

     
                resault = await EmployeeSchaduleRepo.saveEmployeeSchedule(data, companyId)
            

            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
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
    public static async getEmployeeReqularSchedule(req: Request, res: Response, next: NextFunction) {

        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;
            resault = await EmployeeSchaduleRepo.getEmployeeRegularSchedule(data)


            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async getEmployeesScheduleForAppointment(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();

        try {
            await client.query("BEGIN");
            const company = res.locals.company;
            
            const data = req.body;

            let resault = await EmployeeSchaduleRepo.getEmployeesScheduleForAppointment(client, data, company)
            await client.query("COMMIT");
            return res.send(resault)

        } catch (error: any) {
            await client.query("ROLLBACK")
                 throw error
        }finally {
            client.release()
        }
    }

    // public static async test(req: Request, res: Response, next: NextFunction) {

    //     try {
    //         const company = res.locals.company;
    //         const companyId = company.id;
    //         const data = req.body;
    //         let resault;
    //         resault = await EmployeeSchaduleRepo.getNewSchedule(data.shift, data.busyTimes, company)


    //         return res.send(resault)
    //     } catch (error: any) {
    //         await client.query("ROLLBACK")

    //              throw error
    //     }finally{
    //         client.release()
    //     }
    // }

    public static async saveEmployeeOffDay(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;
            if (data.id != null && data.id != "") {
                resault = await EmployeeSchaduleRepo.editOffDay(data, companyId)
            } else {

                resault = await EmployeeSchaduleRepo.saveEmployeeOffDays(data, companyId)

            }


            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async getEmployeeOffDay(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const offDayId = req.params.offDayId;
            let resault;

            resault = await EmployeeSchaduleRepo.getEmployeeOffDays(offDayId)

            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async deleteEmployeeOffDays(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const offDayId = req.params.offDayId;
            let resault;

            resault = await EmployeeSchaduleRepo.deleteEmployeeOffDays(offDayId)

            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
    public static async saveShiftExceptions(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;
            resault = await EmployeeSchaduleRepo.setExceptionShifts(data, companyId)


            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async saveAdditionalShifts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;
            resault = await EmployeeSchaduleRepo.setAdditionalShifts(data, companyId)


            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
}