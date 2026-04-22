import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { CustomerRepo } from '@src/repo/app/accounts/customer.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { Request, Response, NextFunction } from 'express';
import { RedisClient } from '@src/redisClient';
import fs from 'fs';
import { CustomerBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
export class CustomerController {
    public static async addCustomer(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            const company = res.locals.company;
            const data = req.body;
            const employeeId = res.locals.user
            let resault;
            await client.query("BEGIN")
            if (data.id == null || data.id == "") {
                resault = await CustomerRepo.addCustomer(client, req.body, company);

                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "CustomerOpeningBalance", id: resault.data.id, companyId: company.id })

                let userBalancesQueue = CustomerBalanceQueue.getInstance();
                userBalancesQueue.createJob({ userId: resault.data.id, dbTable: 'CustomerOpeningBalance' })
            } else {
                resault = await CustomerRepo.editCustomer(client, req.body, company, employeeId);
            }
            await client.query("COMMIT")

            return res.send(resault)
        } catch (error: any) {

            await client.query("ROLLBACK")

                throw error
        } finally {
            client.release()
        }
    }
    public static async editCustomer(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")

            const company = res.locals.company;
            const employeeId = res.locals.user
            const edit = await CustomerRepo.editCustomer(client, req.body, company, employeeId);
            await client.query("COMMIT")

            return res.send(edit)
        } catch (error: any) {
            await client.query("ROLLBACK")
                throw error
        } finally {
            client.release()
        }
    }
    public static async getCutomerList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const list = await CustomerRepo.getCutomerList(data, company);
            return res.send(list)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const customerId = req.params['customerId'];
            const customer = await CustomerRepo.getCustomerById(customerId, company);
            return res.send(customer)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerCredit(req: Request, res: Response, next: NextFunction) {
        try {

            const customerId = req.params['customerId'];
            const company = res.locals.company;
            const customer = await CustomerRepo.getCustomerCredit(customerId, company);
            return res.send(customer)
        } catch (error: any) {

                throw error
        }
    }

    public static async getCustomerOverView(req: Request, res: Response, next: NextFunction) {
        try {


            const company = res.locals.company;
            const data = req.body
            const overView = await CustomerRepo.getCustmerOverView(data, company);
            return res.send(overView)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerInvoiceTransactions(req: Request, res: Response, next: NextFunction) {
        try {


            const data = req.body
            const invoices = await CustomerRepo.getCustomerInvoiceTransactions(data);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerEstimateTransactions(req: Request, res: Response, next: NextFunction) {
        try {


            const data = req.body
            const invoices = await CustomerRepo.getCustomerEstimateTransactions(data);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerCreditNoteTransactions(req: Request, res: Response, next: NextFunction) {
        try {


            const data = req.body
            const invoices = await CustomerRepo.getCustomerCreditNoteTransactions(data);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerPaymentTransactions(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body
            const invoices = await CustomerRepo.getCustomerPaymentTransactions(data);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }
    public static async customerLastPayment(req: Request, res: Response, next: NextFunction) {
        try {

            const customerId = req.params['customerId']
               const company = res.locals.company;
            const invoices = await CustomerRepo.customerLastPayment(customerId,company.id);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }
    public static async customerStatement(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company
            const data = req.body
            const invoices = await CustomerRepo.customerStatement(data, company);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }
    public static async getCustomerAddresses(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company
            const customerId = req.params.customerId
            const addresses = await CustomerRepo.getCustomerAddress(customerId, company.id);
            return res.send(new ResponseData(true, "", { addresses: addresses }))
        } catch (error: any) {

                throw error
        }
    }
    public static async importFromCsv(req: Request, res: Response, next: NextFunction) {
        let redisClient = RedisClient.getRedisClient();
        let company = res.locals.company;
        try {

            let data = req.body;

            let employeeId = res.locals.user;
            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            let count = data.length; //3000
            let pageCount = Math.ceil(count / limit)

            let offset = 0;
            let resault = new ResponseData(true, "", [])


            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("CustomerBulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false, "A Previouse Import is Still In Progress: " + {}, []))
            }


            for (let index = 0; index < pageCount; index++) {

                // if (page != 0) {
                //     offset = (limit * (page - 1))
                // }


                let customers: any = data.splice(offset, limit)

                resault = await CustomerRepo.importFromCVS(customers, company, employeeId, index + 1, count)

                if (index + 1 == pageCount) {
                    await redisClient.deletKey("CustomerBulkImport" + company.id)
                }
            }



            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {
            await redisClient.deletKey("CustomerBulkImport" + company.id)
                throw error
        }
    }
    public static async getBulkImportProgress(req: Request, res: Response, next: NextFunction) {

        try {


            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;

            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("CustomerBulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;

                return res.send(new ResponseData(false, "A Previouse  Import is Still In Progress: " + progress, { progress: progress }))
            }




            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {

                throw error
        }
    }

    public static async exportCustomers(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const type = req.params.type;

            const result = await CustomerRepo.exportCustomers(company, type);
            res.download(company.id + `customers.${type}`)

            //   // Send the file as a response
            //   res.set('Content-Disposition', 'attachment; filename="customers.csv"');
            //   res.set('Content-Type', 'text/csv');

            //   const fileStream = fs.createReadStream(company.id+'customers.csv');
            //   fileStream.pipe(res);

            res.on('finish', () => {
                fs.unlinkSync(company.id + 'customers.csv');
            });
        } catch (error: any) {
                throw error;
        }
    }

    public static async getMiniCustomerList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let resData = await CustomerRepo.getCustomerMiniList(data, company);
            return res.send(resData);
        } catch (error: any) {
                throw error;
        }
    }

    public static async getCustomerReceivableByBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId;
            const customerId = req.params.customerId;

            let resData = await CustomerRepo.getCustomerRecivableByBranch(branchId, customerId);
            return res.send(resData);
        } catch (error: any) {
                throw error;
        }
    }


    public static async getMiniCustomersByIds(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let resData = await CustomerRepo.getMiniCustomersByIds(data, company);
            return res.send(resData);
        } catch (error: any) {
                throw error;
        }
    }

    public static async saveCustomerNotes(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const journals = await CustomerRepo.saveCustomerNotes(req.body, employeeId);
            return res.send(journals)
        } catch (error: any) {

                throw error
        }
    }

    public static async getParentCustomers(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const resData = await CustomerRepo.getParentCustomers(data, company.id);
            return res.send(resData)
        } catch (error: any) {

                throw error
        }
    }

    public static async getSubCustomerOverView(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const customeId = req.params.customerId;
            const resData = await CustomerRepo.getSubCustomerOverView(customeId, company.id);
            return res.send(resData)
        } catch (error: any) {

                throw error
        }
    }
    public static async exportCustomerOpeningBalance(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const type = req.params.type;
            const branchId = req.params.branchId;
            const resData = await CustomerRepo.exportCustomerOpeningBalance(branchId, company, type);

            res.download(resData)
            try {
                res.on('finish', () => {
                    fs.unlinkSync(resData);
                });

            } catch (error: any) {
                    throw error;
            }


        } catch (error: any) {

                throw error
        }
    }
    public static async importCustomersOpeningBalance(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const resData = await CustomerRepo.importCustomersOpeningBalance(data, company);
            return res.send(resData)
        } catch (error: any) {

                throw error
        }
    }
    public static async miniCustomerList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const resData = await CustomerRepo.customerListMini( company,data);
            return res.send(resData)
        } catch (error: any) {

                throw error
        }
    }

}