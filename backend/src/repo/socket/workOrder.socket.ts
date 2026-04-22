// import { Cashier } from "@src/models/account/cashier";
import { Socket } from "socket.io";


import { WorkOrderRepo } from "../app/accounts/workOrder.repo";
import { PoolClient } from "pg";
import { DB } from "@src/dbconnection/dbconnection";
import { TimeHelper } from "@src/utilts/timeHelper";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketWorkOrder {
    // public static async insert

    public static async checkIfWorkOrderIdExist(client: PoolClient, id: string) {
        try {
            const query = {
                text: `SELECT COUNT(*) as qty FROM "WorkOrders" where id = $1`,
                values: [id]
            }

            let workOrder = await client.query(query.text, query.values);
            if (workOrder.rows && workOrder.rows[0].qty > 0) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveWorkOrder(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {


            if (data) {
                data = JSON.parse(data);
            }
            /**BEGIN CLIENT */
            await dbClient.query("BEGIN")
            const workOrders = data;
            for (let index = 0; index < workOrders.length; index++) {
                const element = workOrders[index];
                let isIdExist = await this.checkIfWorkOrderIdExist(dbClient, element.id)
                element.updatedDate = element.updatedDate ? await TimeHelper.convertToDate(element.updatedDate) : null;
                element.createdAt = element.createdAt ? await TimeHelper.convertToDate(element.createdAt) : null;
                element.expectedEndDate = element.expectedEndDate ? await TimeHelper.convertToDate(element.expectedEndDate) : null;
                element.expectedStartDate = element.expectedStartDate ? await TimeHelper.convertToDate(element.expectedStartDate) : null;
                element.employeeId = element.employeeId == "" ? null : element.employeeId
                if (isIdExist) {
                    await WorkOrderRepo.editWorkOrder(dbClient, element, branchId);

                } else {
                    await WorkOrderRepo.saveWorkOrder(dbClient, element, branchId);

                }
            }
            /**COMMIT CLIENT */
            await dbClient.query("COMMIT")

            callback({ success: true })
        } catch (error: any) {
            /**ROLLBACK CLIENT */
            await dbClient.query("ROLLBACK")
            console.log(error)



       
            callback({ success: false, error: error.message })

        } finally {
            /**Release CLIENT */
            dbClient.release()
        }
    }
    public static async getWorkOrders(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }
            const date = new Date()
            date.setTime(data.date);

            const workOrders = await WorkOrderRepo.getWorkOrdes(branchId, date);

            callback({ success: true, workOrders: workOrders.data })
        } catch (error: any) {
        
       
            callback({ success: false, error: error.message })
            logPosErrorWithContext(error, data, branchId, null, "getWorkOrders")
        }
    }


}