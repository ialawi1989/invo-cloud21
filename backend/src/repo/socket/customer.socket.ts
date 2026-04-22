import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";

import { SocketController } from "@src/socket";
import { Customer } from "@src/models/account/Customer";
import { RedisClient } from "@src/redisClient";
import { Helper } from "@src/utilts/helper";
import { DB } from "@src/dbconnection/dbconnection";
import { PoolClient } from "pg";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketCustomerRepo {
    static redisClient: RedisClient;

    /**GET ALL CUSTOMERS */
    public static async getCustomer(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        let companyId;
        try {
            /**Begin Client */
            await dbClient.query("BEGIN")
             companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;


            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const customers = await CustomerRepo.getCustomers(dbClient, companyId, date)
            callback(JSON.stringify(customers.data.list))
            /**Commit Client */
            await dbClient.query("COMMIT")
        } catch (error: any) {
            /**ROLLBACK Client */
            await dbClient.query("ROLLBACK")
          
            

            callback(JSON.stringify({ success: true, error: error.message }))

            logPosErrorWithContext(error, data, branchId, companyId, "getCustomers")

        } finally {
            /**Release Client */
            dbClient.release()
        }
    }

    /**AN EVENT TO SEND NEW CUTOMERS ADDED FROM CLOUD TO POS */
    public static async getCustomerbyId(client: PoolClient | null, id: string) {
        try {
            let query = {
                text: `select * from "Customers" where id = $1`,
                values: [id]
            }
            const customer = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
            return customer && customer.rows.length > 0 ? customer.rows[0] : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async sendNewCustomer(client: PoolClient, branchIds: [string], customer: any) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            if (customer.id) {
                let customerInfo = await this.getCustomerbyId(client, customer.id)

                if (customerInfo) {
                    for (let index = 0; index < branchIds.length; index++) {
                        const branchId = branchIds[index];
                        const clientId: any = await this.redisClient.get("Socket" + branchId);
                        const newData = await Helper.trim_nulls(customerInfo);
                        instance.io.of('/api').in(clientId).emit("newCustomer", JSON.stringify(newData));
                    }
                }
            }




        } catch (error: any) {
          


            throw new Error(error)
        }
    }

    /**AN EVENT TO SEND UPDATED CUTOMERS ADDED FROM CLOUD TO POS */
    public static async sendUpdatedCustomer(client: PoolClient, branchIds: [string], customer: any) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            if (customer.id) {
                let customerInfo = await this.getCustomerbyId(client, customer.id)

                if (customerInfo) {
                    for (let index = 0; index < branchIds.length; index++) {
                        const branchId = branchIds[index];
                        const clientId: any = await this.redisClient.get("Socket" + branchId);
                        const newData = await Helper.trim_nulls(customerInfo);
                        instance.io.of('/api').in(clientId).emit("newCustomer", JSON.stringify(newData));
                    }
                }
            }


        } catch (error: any) {
            ;

            throw new Error(error)
        }
    }

    /**AN EVENT TO ADD POS CUSTOMERS */
    public static async saveCustomer(data: any, branchId: string, callback: CallableFunction) {
        const client = await DB.excu.client();
        let companyId;
        try {
            if (data) {
                data = JSON.parse(data);
            }
            /**Begin Client */
            await client.query("BEGIN")
            companyId = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
            const customer = await CustomerRepo.addCustomer(client, data, companyId)
            /**Commit Client */
            await client.query("COMMIT")
            callback(customer)
        } catch (error: any) {
       
       
            /**RollBack Client */
            await client.query("ROLLBACK")
            callback(JSON.stringify(error.message))

            logPosErrorWithContext(error, data, branchId, companyId, "saveCustomer")

        } finally {
            /**Release Client */
            client.release()
        }
    }

    /**AN EVENT TO RETREIVE CUSTOMER BY PHONE NUMBER */
    public static async searchCustomerByPhone(data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            const query: { text: string, values: any } = {
                text: `SELECT 
                     id,
                     name,
                     phone,
                     addresses,
                     email,
                     "birthDay",
                     notes,
                     "MSR" 
                   from "Customers"
                   INNER JOIN "Branches" on "Branches"."companyId" = "Customers"."companyId"
                   WHERE "Branches".id = $1 AND "Customers".phone = $2
                  `,
                values: [branchId, data.phone]
            }

            const customer = await DB.excu.query(query.text, query.values);

            callback(JSON.stringify(customer.rows[0]))
        } catch (error: any) {
       



            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "searchCustomerByPhone")

        }
    }


}