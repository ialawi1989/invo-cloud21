import { DB } from "@src/dbconnection/dbconnection";
import { Socket } from "socket.io";

import { PoolClient } from "pg";

import { TimeHelper } from "@src/utilts/timeHelper";
import { WaitingList } from "@src/models/Settings/waitingList";
import { Customer } from "@src/models/account/Customer";
import { BranchesRepo } from "../admin/branches.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class WaitingListSocket {

    public static async checkWaitingListId(client: PoolClient, id: string) {
        try {
            const query = {
                text: `SELECT COUNT(ID) FROM "WaitingList" where id =$1`,
                values: [id]
            }

            let reservation = await client.query(query.text, query.values);
            if (reservation && reservation.rows && reservation.rows.length > 0 && reservation.rows[0].count > 0) {
                return true
            }
            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveWaitingLists(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client();
        try {
            if (data) {
                data = JSON.parse(data);
            }
            /**Begin Client */
            await dBClient.query("BEGIN")
            console.log("saveWaitingListssaveWaitingListssaveWaitingListssaveWaitingLists", data)
            const refunds = data;
            for (let index = 0; index < refunds.length; index++) {
                const element = refunds[index];
                // const isExist = await this.checkReservationId(dBClient,element.id)
                console.log(element)
                element.branchId = branchId;
                element.createdAt = TimeHelper.convertToDate(element.createdAt);
                element.updateTime = TimeHelper.convertToDate(element.updateTime);
                await this.saveWaitingList(dBClient, element)
            }

            await dBClient.query("COMMIT")
            callback(JSON.stringify({ success: true }))
        } catch (error: any) {
            console.log(error)
            /**ROLLBACK Client */
            await dBClient.query("ROLLBACK")


            callback(JSON.stringify({ success: false, error: error.message }))
        } finally {
            /**Release Client */
            dBClient.release()
        }
    }

    public static async saveWaitingList(client: PoolClient, data: any) {
        try {
            const waitingList = new WaitingList();
            waitingList.ParseJson(data)
        
            if (waitingList.customerId == "") {
                waitingList.customerId = null
            }
            const companyId = (await BranchesRepo.getBranchCompanyId(client, waitingList.branchId)).compayId;
            if (waitingList.customerId) {
                const isCustomerIdExist = await CustomerRepo.chekIfCustomerIdExists(client, waitingList.customerId, companyId)
                if (!isCustomerIdExist && waitingList.customer && waitingList.customer.phone) {
                    const customer = new Customer();
                    customer.ParseJson(waitingList.customer);
                    await CustomerRepo.addPosCustomer(client, customer, companyId)
                }
            }


            const query = {
                text: `INSERT INTO "WaitingList" (id, "ticketNo", "name",phone, "customerId", "guests","createdAt","seated","updateTime","branchId") 
                            VALUES ($1, $2, $3,$4,$5,$6,$7,$8,$9,$10)
                            ON CONFLICT (id) 
                            DO UPDATE SET "name" = EXCLUDED."name",
                                           phone = EXCLUDED.phone,
                                           seated = EXCLUDED.seated,
                                           guests = EXCLUDED.guests,
                                           "updateTime" = EXCLUDED."updateTime"
                                          `,
                values: [waitingList.id, waitingList.ticketNo, waitingList.name, waitingList.phone, waitingList.customerId, waitingList.guests, waitingList.createdAt, waitingList.seated, waitingList.updateTime, waitingList.branchId]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          
            ;
            logPosErrorWithContext(error, data, data.branchId, null, "saveWaitingList")
            throw new Error(error)
        }
    }

    public static async getWaitingLists(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            const query = {
                text: `SELECT * FROM "WaitingList" where "branchId" =$1 and ($2::timestamp is null or ("createdAt" >=$2 and "reservationDate" >=$2))`,
                values: [branchId, date]
            }

            let reservations = await DB.excu.query(query.text, query.values)
            callback(JSON.stringify({ success: true, data: reservations.rows }))

        } catch (error: any) {
          
            ;

            callback(JSON.stringify({ success: false, error: error.message }))

        }
    }


    // public static async recoverWaitingLists(client: Socket, data: any, branchId: string, callback: CallableFunction){
    //     try {



    //         const query={
    //             text:`SELECT * FROM "WaitingList" where "branchId" =$1 and "createdAt" >=$2 `,
    //             values:[branchId,new Date()]
    //         }

    //         let reservations = await DB.excu.query(query.text,query.values)
    //         callback(JSON.stringify({ success: true, data: reservations.rows }))

    //     } catch (error:any) {
    //    
    //      ;

    //         callback(JSON.stringify({ success: false, error: error.message }))

    //     }
    // }
}