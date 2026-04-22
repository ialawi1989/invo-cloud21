import { ResponseData } from '@src/models/ResponseData';
import { Request, Response, NextFunction, response } from 'express';
import { DB } from '@src/dbconnection/dbconnection';
import { DriverRepo } from '@src/repo/deliveryApp/driver';
import { AuthRepo } from '@src/repo/app/auth.repo';
import { EmployeeRepo } from '@src/repo/admin/employee.repo';



export class DriverController {

    public static async startShift(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const employeeId =res.locals.user;
            const emplyeeShift = (await DriverRepo.saveEmployeeShift({ employeeId: employeeId }))
            await client.query("COMMIT")
            return res.send(emplyeeShift)

        } catch (error: any) {

            await client.query("ROLLBACK")
              throw error

        } finally {
            client.release()
        }
    }

    public static async endShift(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const employeeId =res.locals.user;
            let resault = await DriverRepo.endShift(client, employeeId);
            await client.query("COMMIT")
            return res.send(resault)

        } catch (error: any) {

            await client.query("ROLLBACK")
              throw error

        } finally {
            client.release()
        }
    }


    public static async logOut(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const employeeId =res.locals.user;
            let resault = await DriverRepo.endShift(client, employeeId);
            const emailResult = await EmployeeRepo.getEmployeeEmail(employeeId, null);
            const email = emailResult?.email;
            await AuthRepo.deleteRedis(`session:${email.toLowerCase()}`)
            await client.query("COMMIT")
            return res.send(resault)

        } catch (error: any) {

            await client.query("ROLLBACK")
              throw error

        } finally {
            client.release()
        }
    }

    public static async pendingOrders(req: Request, res: Response, next: NextFunction) {
        try {

          

            const employeeId = res.locals.user;
            let resault = await DriverRepo.pendingOrders(employeeId);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    public static async clamiedOrders(req: Request, res: Response, next: NextFunction) {
        try {
            
            const employeeId = res.locals.user;
            let resault = await DriverRepo.clamiedOrders(employeeId);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    public static async pickedOrders(req: Request, res: Response, next: NextFunction) {
        try {
            
            const employeeId = res.locals.user;
            let resault = await DriverRepo.pickedOrders(employeeId);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    public static async deliveredOrders(req: Request, res: Response, next: NextFunction) {
        try {
            
            const employeeId = res.locals.user;
            let resault = await DriverRepo.deliveredOrders(employeeId);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    public static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
        try {
            
            const employeeId = res.locals.user;
            const data = req.body
            let resault = await DriverRepo.updateOrderStatus(employeeId, data);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    public static async getOrderById(req: Request, res: Response, next: NextFunction) {
        
        try {
          
            const invoiceId =req.params.invoiceId;
            let  sections = await DriverRepo.getOrderById(invoiceId);
            return res.send(sections)
              
 
        } catch (error: any) {
             throw error
        } 
    }

    public static async invoicePayment(req: Request, res: Response, next: NextFunction) {
        try {
            
            const employeeId = res.locals.user;
            const invoiceId = req.params.invoiceId;
            let resault = await DriverRepo.invoicePayment(employeeId, invoiceId);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    public static async pickupOrder(req: Request, res: Response, next: NextFunction) {
        try {

            console.log(req)
            
            const invoiceId = req.params.invoiceId;
            //const invoiceCode = req.params.invoiceCode;
            let resault = await DriverRepo.pickupOrder(null, invoiceId);
            return res.send(resault)

        } catch (error: any) {
              throw error
        }
    }

    // public static async addInvoicePayment(req: Request, res: Response, next: NextFunction) {
    //         const client = await DB.excu.client()
    //         try {
    //             await client.query("BEGIN")
    //             const company = res.locals.company;
    //             const employeeId = res.locals.user;
    //             const data = req.body;
    //             let resault;
    //             if (!data.id || data.id == undefined ) {

    //                 data.employeeId = employeeId
    //                 data.paymentMethodId = await  PaymnetMethodRepo.getDefaultPaymentMethod(company.id)

    //                 if(!data.paymentMethodId){ throw new ValidationException("paymentMethodId is required")}    
    //                 resault = await InvoicePaymentRepo.addInvoicePayment(client, data, company)
    //             } else {
    //                 throw new ValidationException("cannot edit Invoice Payment")
    //             }

    //             console.log(resault)
    
    //             await client.query("COMMIT")
    //             const queue = ViewQueue.getQueue();
    //             queue.pushJob()
    
    //             let queueInstance = TriggerQueue.getInstance();
    //             queueInstance.createJob({ type: "InvoicePayments", invoiceIds: resault.data.invoiceIds, id: [resault.data.id], companyId: company.id })
    //             queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: resault.data.invoiceIds })
    //             return res.send(resault)
    //         } catch (error: any) {
    //             await client.query("ROLLBACK")
    
    
    //              throw error
    //         } finally {
    //             client.release()
    //         }
    
    //     }




}