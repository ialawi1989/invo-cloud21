import { Socket } from "socket.io"

import { DB } from "@src/dbconnection/dbconnection";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class EventLogsSocket {
    static redisClient: RedisClient;

    public static async getIds(date: any, branchId: string, type: string) {
        try {
            let sources = ['POS', 'Online']
            const query = {
                text: `		
                    select JSON_AGG("EventLogs".id) as "ids" from "EventLogs"
                    WHERE "branchId" = $1
                    and "type" = $2
                    and "source" = any($3)
                    and ($4::timestamp is null or  "createdAt" >= $4)`,
                values: [branchId, type, sources, date]
            }

            const deleted = await DB.excu.query(query.text, query.values);
            const deletedIds = deleted.rows && deleted.rows.length > 0 && (<any>deleted.rows[0]).ids ? (<any>deleted.rows[0]).ids : []
            return deletedIds
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getDeletedCreditNotes(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }



            let ids = await this.getIds(date, branchId, 'CreditNote')
            callback(JSON.stringify({ success: true, data: ids }))

        } catch (error: any) {
          

            callback(JSON.stringify({ success: false, error: error.message }))
            
            logPosErrorWithContext(error, data, branchId, null, "getDeletedCreditNotes")

        }
    }
    public static async getDeletedInvoices(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            let ids = await this.getIds(date, branchId, 'Invoice')
            callback(JSON.stringify({ success: true, data: ids }))



        } catch (error: any) {
          

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getDeletedInvoices")

        }
    }
    public static async getDeletedPayments(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            let ids = await this.getIds(date, branchId, 'InvoicePayment')
            callback(JSON.stringify({ success: true, data: ids }))

        } catch (error: any) {
          

            callback(JSON.stringify({ success: false, error: error.message }))
            

            logPosErrorWithContext(error, data, branchId, null, "getDeletedPayments")
        }
    }
    public static async getDeletedAppliedCredits(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            let ids = await this.getIds(date, branchId, 'Applied Credit')
            callback(JSON.stringify({ success: true, data: ids }))

        } catch (error: any) {
          

            callback(JSON.stringify({ success: false, error: error.message }))
         
            logPosErrorWithContext(error, data, branchId, null, "getDeletedAppliedCredits")

        }
    }
    public static async getDeletedEstimates(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            let ids = await this.getIds(date, branchId, 'Estimate')
            callback(JSON.stringify({ success: true, data: ids }))

        } catch (error: any) {
          

            callback(JSON.stringify({ success: false, error: error.message }))
            

            logPosErrorWithContext(error, data, branchId, null, "getDeletedEstimates")
        }
    }

    public static async deleteInvoiceSync(branchId: string, invoiceId: string) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            instance.io.of('/api').in(clientId).emit("deleteInvoiceSync", JSON.stringify({ id: invoiceId }));

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async deleteCreditNoteSync(branchId: string, creditNoteId: string) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            instance.io.of('/api').in(clientId).emit("deleteCreditNoteSync", JSON.stringify({ id: creditNoteId }));

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async deleteInvoicePaymentSync(branchId: string, creditNoteId: string) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            instance.io.of('/api').in(clientId).emit("deleteInvoicePaymentSync", JSON.stringify({ id: creditNoteId }));

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async deleteApplyCreditSync(branchId: string, creditNoteId: string) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            instance.io.of('/api').in(clientId).emit("deleteApplyCreditSync", JSON.stringify({ id: creditNoteId }));

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async deleteEstimateSync(branchId: string, estimateId: string) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            instance.io.of('/api').in(clientId).emit("deleteEstimateSync", JSON.stringify({ id: estimateId }));

        } catch (error: any) {
            throw new Error(error)
        }
    }
}