// import { Cashier } from "@src/models/account/cashier";
import { Socket } from "socket.io";
import { CashierRepo } from "../app/accounts/cashier.repo";



import { DB } from "@src/dbconnection/dbconnection";
import { Cashier } from "@src/models/account/Cashier";
import { PoolClient } from "pg";

import { ResponseData } from "@src/models/ResponseData";
import { publishEvent } from "@src/utilts/system-events";
import { BranchesRepo } from "../admin/branches.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";
import { CompanyRepo } from "../admin/company.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketCashier {

    public static async saveCashier(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        /** intiate client */
        const dbClient = await DB.excu.client();
        let companyId;
        try {
            const company = (await BranchesRepo.getBranchCompanyId(dbClient, branchId));

            companyId = company.compayId;


            let settings = await CompanyRepo.getCompanySettings(company.country);
            let timeOffset = settings.timeOffset;




            let resault;
            if (data) {
                data = JSON.parse(data);
            }
            const cashiers = data;
            /** begin client */


            await dbClient.query("BEGIN")
            resault = new ResponseData(true, "", []);

            const getCompanyNotification = {
                text: `SELECT id
                    FROM "Companies"
                    WHERE id = $1
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text("features") f
                        WHERE lower(f) = 'notifications'
                    )`,
                values: [companyId],
            }

            const companyNotification = await DB.excu.query(getCompanyNotification.text, getCompanyNotification.values)
            const cNotification = companyNotification.rows.length > 0 ? companyNotification.rows[0] : null

            for (let index = 0; index < cashiers.length; index++) {
                const element = cashiers[index];

                const isCashierIdExist = await CashierRepo.checkIfCashierIdExist(dbClient, element.id, branchId)
                element.branchId = branchId;
                if (isCashierIdExist.success) {
                    if (isCashierIdExist.data.branchId != branchId) {
                        continue;
                    } else {
                        resault = await CashierRepo.editCashier(dbClient, element, branchId);
                    }
                } else {
                    resault = await CashierRepo.addCashier(dbClient, element, branchId);
                }
                const branchName = (await BranchesRepo.getBranchName(branchId))

                if (cNotification && element.cashierOut != null) {
                    element.cashierIn = TimeHelper.convertToDate(element.cashierIn);
                    element.cashierOut = element.cashierOut
                        ? moment(TimeHelper.convertToDate(element.cashierOut))
                            .utcOffset(parseInt(timeOffset))
                            .format('YYYY-MM-DD HH:mm')
                        : null;
                    publishEvent("cashierOut", { ...element, companyId, branchName });
                }
            }
            /**Commit Client */
            await dbClient.query("COMMIT")


            callback(JSON.stringify(resault))
        } catch (error: any) {
            /**RollBack Client */
            await dbClient.query("ROLLBACK")

            ;
            
            console.log(error)
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, companyId, "saveCashier")

        } finally {
            /**Release Client */
            dbClient.release()
        }
    }

    public static async getOpenCashiers(client: PoolClient, branchId: string) {
        try {
            const query = {
                text: `SELECT * FROM "Cashiers" where "branchId" = $1 and "cashierOut" is null`,
                values: [branchId]
            }

            let cashiers = await client.query(query.text, query.values);
            return cashiers.rows
        } catch (error: any) {
            logPosErrorWithContext(error, null, branchId, null, "getOpenCashiers")

            throw new Error(error)
        }
    }
    /**To return Last 3Days Cahsiers for POS RECOVER DB */
    // public static async getCashiers(client:Socket, data:any,branchId:string,callback:CallableFunction){
    //     const dbClient = await DB.excu.client();
    //     try {

    //         await dbClient.query("BEGIN")
    //         const query : { text: string, values: any } = {
    //             text:`SELECT * FROM "Cashiers"
    //             where  "Cashiers". "branchId" =$1
    //             and (("Cashiers"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' AND "Cashiers"."createdAt" <= CURRENT_DATE) OR "Cashiers"."cashierOut" is null  )`,
    //             values:[branchId]
    //         }

    //         const cashiers = await dbClient.query(query.text,query.values)

    //         let cashiersTemp = [];
    //         for (let index = 0; index < cashiers.rows.length; index++) {
    //             const element  = cashiers.rows[index];
    //             const cashier = new Cashier();
    //             cashier.ParseJson(element);
    //             query.text =`SELECT * FROM "CashierLines" where    "cashierId"=$1`
    //             query.values =[cashier.id]
    //             const lines = await dbClient.query(query.text,query.values);
    //             cashier.lines = lines.rows;

    //             cashiersTemp.push(cashier)
    //         }

    //         await dbClient.query("COMMIT")

    //         callback(JSON.stringify({ success: true, data: cashiersTemp}))
    //     } catch (error:any) {
    //         await dbClient.query("ROLLBACK")
    //         callback(JSON.stringify({ success: false, data: []}))
    //    
    //      ;

    //         throw new Error(error)
    //     }finally{
    //         dbClient.release()

    //     }
    // }

    public static async getCashiers(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client(500);
        try {
            callback(JSON.stringify({ success: true, data: [] }))
            return;
            await dbClient.query("BEGIN")

            // const invoiceIds = new Set();
            // const cashierIds = new Set();
            // let invoiceData: any = await SocketInvoiceRepo.getOpenInvoiceIds(dbClient, branchId)
            // invoiceData.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });

            // invoiceData = await SocketInvoiceRepo.getLastThreeDaysInvoices(dbClient, branchId)
            // invoiceData.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });

            // invoiceData = await SocketEstimateRepo.getLatestEstimate(dbClient, branchId)
            // if (invoiceData) {
            //     invoiceIds.add(invoiceData.invoiceId)
            // }

            // invoiceData = await SocketCreditNoteRepo.getLatestCreditNote(dbClient, branchId)
            // if (invoiceData.length > 0) {
            //     invoiceData.forEach((element: any) => {
            //         invoiceIds.add(element.invoiceId)
            //     });
            // }

            // let openCashiers = await SocketCashier.getOpenCashiers(dbClient, branchId);
            // if (openCashiers.length > 0) {
            //     openCashiers.forEach((element: any) => {
            //         cashierIds.add(element.id)
            //     });
            // }

            // let ids = Array.from(invoiceIds);
            // let cashierIdList = Array.from(cashierIds);

            // const query: { text: string, values: any } = {
            //     text: `SELECT "InvoicePayments".id FROM "InvoicePayments"
            //     INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
            //     where "InvoicePaymentLines"."invoiceId" = any($1) or "InvoicePayments"."cashierId" = any($2)
            //          `,
            //     values: [ids, cashierIdList]
            // }


            // const payments: any = await dbClient.query(query.text, query.values);
            // let paymentCashierIds = new Set();
            // payments.rows.forEach((element: any) => {
            //     paymentCashierIds.add(element.cashierIds)
            // });
            // cashierIdList = Array.from(paymentCashierIds);
            let query = {
                text: `with "values" as(
select 
$1::uuid as "branchId"
),"openCashiers" as (
select distinct "Cashiers".id from "Cashiers"
JOIN "values" on true
where "cashierOut" is null 
and "Cashiers"."branchId" = "values"."branchId"
)

select JSON_AGG( "openCashiers".id) as  "openCashierIds" from "openCashiers"`,
                values: [branchId]
            }

            const cashierIds = await dbClient.query(query.text, query.values)
            const cashierIdList = cashierIds.rows && cashierIds.rows.length > 0 ? cashierIds.rows[0].openCashierIds : []

            query.text = `SELECT * FROM "Cashiers"
                            where id = any($1)`
            query.values = [cashierIdList]


            const cashiers = await dbClient.query(query.text, query.values)

            let cashiersTemp = [];
            for (let index = 0; index < cashiers.rows.length; index++) {
                const element = cashiers.rows[index];
                const cashier: any = new Cashier();
                cashier.ParseJson(element);
                query.text = `SELECT * FROM "CashierLines" where    "cashierId"=$1`
                query.values = [cashier.id]
                const lines = await dbClient.query(query.text, query.values);
                cashier.lines = lines.rows;

                cashiersTemp.push(cashier)
            }

            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true, data: cashiersTemp }))
        } catch (error: any) {
            await dbClient.query("ROLLBACK")
            callback(JSON.stringify({ success: false, data: [] }))
          
            ;
            logPosErrorWithContext(error, data, branchId, null, "getCashiers")
            throw new Error(error)
        } finally {
            dbClient.release()

        }
    }

}