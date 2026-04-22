


import { Socket } from "socket.io";
import { PoolClient } from "pg";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Payout } from '@src/models/account/PayOut';
import { TimeHelper } from '@src/utilts/timeHelper';
import { PaymnetMethodRepo } from '../app/accounts/paymentMethod.repo';
import { AccountsRepo } from '../app/accounts/account.repo';
import { TriggerQueue } from '../triggers/triggerQueue';
import { BranchesRepo } from '../admin/branches.repo';
import { logPosErrorWithContext } from '@src/middlewear/socketLogger';

export class PayOutSocketRepo {


    //TODO:CHECK IF ACCOUNT EXIST 


    public static async checkIfIdExist(client: PoolClient, payOutId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) AS qty FROM "Payouts" where id =$1`,
                values: [payOutId]
            }

            let payout = await client.query(query.text, query.values);
            if (payout.rows[0].qty > 0) {
                return true;
            }
            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async savePayout(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {

            let resault;
            if (data) {
                data = JSON.parse(data);
            }
            const cashiers = data;
            await dbClient.query("BEGIN")
            const companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            await AccountsRepo.addAccountIfNotExist(dbClient, "Payout", null, branchId)
            resault = new ResponseData(true, "", []);
            let payOutIds: any[] = [];
            for (let index = 0; index < cashiers.length; index++) {
                const element = cashiers[index];
                element.branchId = branchId;
                let isExist = await this.checkIfIdExist(dbClient, element.id);

                element.accountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(dbClient, element.paymentMethodId, element.branchId)).id
                payOutIds.push(element.id)
                if (isExist) {
                    await this.updatePayOut(dbClient, element,branchId)
                } else {
                    await this.insertPayOut(dbClient, element,branchId)

                }

            }
            await dbClient.query("COMMIT")

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "PayOut", id: payOutIds, companyId: companyId })

            callback(JSON.stringify(resault))

            return resault
        } catch (error: any) {
            console.log(error)
            await dbClient.query("ROLLBACK")

       
         

            callback(JSON.stringify({ success: false, error: error.message }))
        } finally {
            dbClient.release()
        }
    }

    public static async insertPayOut(client: PoolClient, data: any,branchId:string) {
        try {
            let payout = new Payout()
            payout.ParseJson(data);
            payout.createdAt = TimeHelper.convertToDate(payout.createdAt)
            payout.updatedAt = TimeHelper.convertToDate(payout.updatedAt)
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Payouts" (id,
                                             description,
                                             "employeeId",
                                             "cashierId",
                                             "amount",
                                             "paymentMethodId",
                                             "accountId",
                                             "createdAt",
                                             "updatedAt",
                                             "branchId"
                                             ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) `,
                values: [payout.id,
                payout.description,
                payout.employeeId,
                payout.cashierId,
                payout.amount,
                payout.paymentMethodId,
                payout.accountId,
                payout.createdAt,
                payout.updatedAt,
                payout.branchId]
            }

            await client.query(query.text, query.values);

            return new ResponseData(true, "", [])
        } catch (error: any) {
                        logPosErrorWithContext(error, data, branchId, null, "updatePayOut")

            throw new Error(JSON.stringify({ error: error.message, payOutId: data.id, cashierId: data.cashierId }))
        }
    }
    public static async updatePayOut(client: PoolClient, data: any,branchId:string) {
        try {
            let payout = new Payout()
            payout.ParseJson(data);
            payout.createdAt = TimeHelper.convertToDate(payout.createdAt)
            payout.updatedAt = TimeHelper.convertToDate(payout.updatedAt)
            const query: { text: string, values: any } = {
                text: `UPDATE "Payouts" SET   description=$1,
                                             "employeeId"=$2,
                                             "cashierId"=$3,
                                             "amount"=$4,
                                             "paymentMethodId"=$5,
                                             "accountId"=$6,
                                             "updatedAt"=$7
                                             WHERE id =$8`,
                values: [
                    payout.description,
                    payout.employeeId,
                    payout.cashierId,
                    payout.amount,
                    payout.paymentMethodId,
                    payout.accountId,
                    payout.updatedAt,
                    payout.id]
            }

            await client.query(query.text, query.values);

            return new ResponseData(true, "", [])
        } catch (error: any) {
            logPosErrorWithContext(error, data, branchId, null, "updatePayOut")

            throw new Error(JSON.stringify({ error: error.message, payOutId: data.id, cashierId: data.cashierId }))
        }
    }

}