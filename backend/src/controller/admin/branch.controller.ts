import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { Request, Response, NextFunction } from 'express';


import fs from 'fs'
import path from 'path'
import { order } from "@src/Integrations/whatsapp/Order"
import { Logger } from "@src/utilts/invoLogger";

export class BranchController {


    public static async addBranch(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let adminId;
            if (res.locals.admin) {
                adminId = res.locals.admin
            } else {
                adminId = null
            }

            let data = req.body;
            let resault;
            let companyId = res.locals.company ? res.locals.company.id : null;
            if (data.id == null || data.id == "") {
                resault = await BranchesRepo.InsertBranch(client, req.body, true, adminId)
            } else {
                resault = await BranchesRepo.editBranch(client, data, companyId);
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

    public static async getBranchesList(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = res.locals.company.id;
            const branches = await BranchesRepo.getBranchList(client, companyId);
            await client.query("COMMIT");
            return res.send(branches)

        } catch (error: any) {

            await client.query("ROLLBACK")

            await client.query("rollback");
            throw error
        } finally {
            client.release();
        }
    }





    public static async getBranchesListByCompanyId(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = req.params.companyId;
            const branches = await BranchesRepo.getBranchList(client, companyId);
            await client.query("COMMIT");
            return res.send(branches)

        } catch (error: any) {

            await client.query("ROLLBACK")

            await client.query("rollback");
            throw error
        } finally {
            client.release();
        }
    }





    public static async BranchesListByCompanyId(companyId: any) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const branches = await BranchesRepo.getBranchList(client, companyId);
            await client.query("COMMIT");
            return (branches.data)

        } catch (error: any) {

            await client.query("ROLLBACK")
            await client.query("rollback");
            return (error);
        } finally {
            client.release();
        }
    }




    public static async getAllBranchesList(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            const branches = await BranchesRepo.getAllBranchesList(client);
            await client.query("COMMIT");
            return res.send(branches)

        } catch (error: any) {

            await client.query("ROLLBACK")

            await client.query("rollback");
            throw error
        } finally {
            client.release();
        }
    }














    public static async getBranches(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = res.locals.company.id;
            const employeeId = res.locals.user;
            const data = req.body
            const branches = await BranchesRepo.getBranches(data, companyId, employeeId);
            return res.send(branches)
        } catch (error: any) {


            throw error
        }
    }





    public static async rearrangeBranches(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body
            const branches = await BranchesRepo.rearrangeBranches(data);
            return res.send(branches)
        } catch (error: any) {


            throw error
        }
    }


    public static async getBranchConnectionList(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const branches = await BranchesRepo.getBranchConnectionList(company, employeeId);
            return res.send(branches)
        } catch (error: any) {


            throw error
        }
    }

    public static async getBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId'];

            const company = res.locals.company
            const branch = await BranchesRepo.getBranchById(branchId, company)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }

    public static async setBranchWorkingHours(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body

            const branch = await BranchesRepo.setBranchWorkingHour(data)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }


    public static async getBranchesWithStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company

            const branch = await BranchesRepo.getBranchesWithStatus(company)

            return res.send(branch)
        } catch (error: any) {

            console.log(error);
            throw error
        }
    }
    public static async getBranchStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const branchId = req.params.branchId

            const branch = await BranchesRepo.getBranchesStatus(branchId, company)

            return res.send(branch)
        } catch (error: any) {

            console.log(error);
            throw error
        }
    }

    public static async getBranchCoveredAddresses(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const branchId = req.params.branchId

            const company = res.locals.company
            const branch = await BranchesRepo.getBranchAddresses(client, branchId, company)
            await client.query("COMMIT");
            return res.send(branch)
        } catch (error: any) {

            await client.query("ROLLBACK");

            throw error
        } finally {
            client.release()
        }
    }

    public static async loadQrData(req: Request, res: Response, next: NextFunction) {
        try {

            let tableId = req.params.tableId;
            let branchId = req.params.branchId;
            let sessionId = req.sessionID;

            let company = res.locals.company

            let branches = await BranchesRepo.hasActiveBranches(company.id, branchId);
            if (!branches) {
                const filePath = path.join(__dirname, '../../../src/' + process.env.STORAGE_PATH + '/Views/error.html');
                let html = fs.readFile(filePath, 'utf8', (err, html) => {

                    if (html) {

                        const updatedHtml = html.replace('{{errorMessage}}', "The branch is currently inactive. Please check back later.");
                        return res.send(updatedHtml);
                    }
                })
            } else {
                let redirect = await BranchesRepo.loadQrData(branchId, tableId, sessionId, company)
                console.log(redirect.data)
                return res.redirect(redirect.data)
            }

        } catch (error: any) {

            Logger.error(error.message, { stack: error.stack });
            const filePath = path.join(__dirname, '../../../src/' + process.env.STORAGE_PATH + '/Views/error.html');
            let html = fs.readFile(filePath, 'utf8', (err, html) => {

                if (html) {
                    error.message = error.message.replace(/(Error:\s*)+/gi, '').replace(/(ERROR:\s*)+/gi, '').trim();
                    const updatedHtml = html.replace('{{errorMessage}}', error.message);
                    return res.send(updatedHtml);
                }
            })

        }
    }
    public static async loadPagerQrData(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('hi')
            let tableId = req.params.tableId;
            let branchId = req.params.branchId;
            let company = res.locals.company

            let redirect = await BranchesRepo.loadPagerQrData(branchId, tableId, company)
            console.log(redirect.data)
            return res.redirect(redirect.data)
        } catch (error: any) {
            Logger.error(error.message, { stack: error.stack });

            const filePath = path.join(__dirname, '../../../src/' + process.env.STORAGE_PATH + '/Views/error.html');
            let html = fs.readFile(filePath, 'utf8', (err, html) => {

                if (html) {
                    error.message = error.message.replace(/(Error:\s*)+/gi, '').replace(/(ERROR:\s*)+/gi, '').trim();
                    const updatedHtml = html.replace('{{errorMessage}}', error.message);
                    return res.send(updatedHtml);
                }
            })

        }
    }

    public static async getCompanyDeliveryAddresses(req: Request, res: Response, next: NextFunction) {
        try {


            let company = res.locals.company
            let addressesKeys = await BranchesRepo.getCompanyDeliveryAddresses(company)

            res.send(addressesKeys)
        } catch (error: any) {


            throw error
        }
    }

    public static async setDefaultEcommerceBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company: any = res.locals.company
            const branch = await BranchesRepo.setDefaultEcommerceBranch(data.branchId, company.id)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }


    public static async setMainBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company: any = res.locals.company
            const branch = await BranchesRepo.setMainBranch(data.branchId, data.mainBranch, company.id)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }


    public static async setBranchLocation(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company: any = res.locals.company
            const branch = await BranchesRepo.saveBranchLocation(data, company.id)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }

    public static async setCompanyZones(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company: any = res.locals.company
            const branch = await BranchesRepo.setCompanyZones(data, company.id)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }

    public static async getCoveredZones(req: Request, res: Response, next: NextFunction) {
        try {

            const company: any = res.locals.company
            const branch = await BranchesRepo.getCompanyZones(company.id)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }

    public static async setBranchSubscription(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body
            const id = req.params.id
            const branch = await BranchesRepo.setBranchSubscription(data, id)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }

    public static async getAllCompanyBranches(req: Request, res: Response, next: NextFunction) {
        try {


            const company = res.locals.company
            const employeeId = res.locals.user
            const branch = await BranchesRepo.getAllBranches(company.id, employeeId)

            return res.send(branch)
        } catch (error: any) {


            throw error
        }
    }
}