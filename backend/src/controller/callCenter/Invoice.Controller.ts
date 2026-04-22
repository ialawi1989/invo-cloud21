/* eslint-disable prefer-const */
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { MenuRepo } from '@src/repo/callCenter/product/menu.repo';
import { ShopRepo } from '@src/repo/ecommerce/shop.repo';
import { SocketMenu } from '@src/repo/socket/menu.socket';
import { Request, Response, NextFunction } from 'express';
import { InvoiceController } from "@src/repo/callCenter/Invoices.repo";
import { InvoiceValidation } from '@src/validationSchema/account/invoice.Schema';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import crypto from 'crypto';
import { RedisClient } from '@src/redisClient';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';

export class InvoiceController_callCenter {

    public static async getInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;

            const tenantId = company.id;
            const cacheKey = `tenant:${tenantId}:callCenterGetInvoices`;
            const lockKey = `${cacheKey}:lock`;

            let redis = RedisClient.getRedisClient();

            // Try to get from Redis cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                return res.send(JSON.parse(cached));
            }

            // Step 2: Use distributed lock to avoid race
            const result = await redis.withLock(lockKey, async () => {
                // Double-check cache after acquiring lock
                const cachedInsideLock = await redis.get(cacheKey);
                if (cachedInsideLock) {
                    return JSON.parse(cachedInsideLock);
                }

                const sections = await InvoiceController.getInvoices(data, company, branches);
                await redis.set(cacheKey, JSON.stringify(sections), 10); // Cache for 10 seconds
                return sections;
            });

            return res.send(result);
        } catch (error: any) {
              throw error;
        }
    }

    public static hash(input: string) {
        return crypto.createHash('md5').update(input).digest('hex');
    }


    public static async getFullInvoice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const invoiceId = req.params.invoiceId;

            await client.query("BEGIN")
            let sections = await InvoiceController.getFullInvoice(client, invoiceId, company);
            await client.query("COMMIT")

            return res.send(sections)


        } catch (error: any) {
            await client.query("ROLLBACK")

              throw error
        } finally {
            client.release()
        }
    }



    public static async getInvoicesByCustomerID(req: Request, res: Response, next: NextFunction) {
        try {
            // const data = req.body;
            const company = res.locals.company;
            const customerId = req.params['customerId'];
            const branches = res.locals.branches
            let sections = await InvoiceController.getInvoicesByCustomerID(customerId, company, branches)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }





    public static async addInvoice(req: Request, res: Response, next: NextFunction) {

        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;

            data.employeeId = data.id != "" && data.id != null ? data.employeeId : employeeId

            // const validate = await InvoiceValidation.invoiceValidation(data);

            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }

            let invoice = await InvoiceController.saveInvoices(data, company)



            if (invoice.success) {
                if (data.status != 'Draft') {
                    let queueInstance = TriggerQueue.getInstance();
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoice.data.invoice.id] })
                    InvoiceStatuesQueue.get().createJob({
                        id: invoice.data.invoice.id
                    } as any);
                    queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [invoice.data.invoice.id] })
                    queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [invoice.data.invoice.id] })
                    queueInstance.createJob({ type: "Invoices", id: [invoice.data.invoice.id], companyId: company.id })
                }
                let redis = RedisClient.getRedisClient();
                await redis.deletKey(`tenant:${company.id}:callCenterGetInvoices`);
            }
            return res.send(new ResponseData(true, "", [{ "InvoiceId:": invoice.data.invoice.id }]))


        } catch (error: any) {
              throw error
        }
    }





}
