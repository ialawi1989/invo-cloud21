import { DB } from "@src/dbconnection/dbconnection";
import { Socket } from "socket.io";

import { PoolClient } from "pg";
import { Reservation } from "@src/models/Settings/reservation";
import { TimeHelper } from "@src/utilts/timeHelper";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { Company } from "@src/models/admin/company";
import { BranchesRepo } from "../admin/branches.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { Customer } from "@src/models/account/Customer";
import { publishEvent } from "@src/utilts/system-events";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";


export class ReservationSocket {
    static redisClient: any;

    public static async checkReservationId(client: PoolClient, id: string) {
        try {
            const query = {
                text: `SELECT COUNT(ID) FROM "Reservations" where id =$1`,
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
    public static async saveReservations(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client();
        try {
            if (data) {
                data = JSON.parse(data);
            }
            /**Begin Client */
            await dBClient.query("BEGIN")

            const refunds = data;
            for (let index = 0; index < refunds.length; index++) {
                const element = refunds[index];
                // const isExist = await this.checkReservationId(dBClient,element.id)
                element.branchId = branchId;
                element.createAt = TimeHelper.convertToDate(element.createAt);
                element.reservationDate = TimeHelper.convertToDate(element.reservationDate);
                element.tableId = element.tableId ? element.tableId : null;
                await this.saveReservation(dBClient, element)
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

    public static async saveReservation(client: PoolClient, data: any) {
        try {
            const reservation = new Reservation();
            let companyId
            reservation.ParseJson(data)
            if (reservation.customerId == "") {
                reservation.customerId = null
            }
            if (reservation.customerId) {
                companyId = (await BranchesRepo.getBranchCompanyId(client, reservation.branchId)).compayId;
                const isCustomerIdExist = await CustomerRepo.chekIfCustomerIdExists(client, reservation.customerId, companyId)
                if (!isCustomerIdExist && reservation.customer && reservation.customer.phone) {
                    let customer = new Customer();
                    customer.ParseJson(reservation.customer);
                    await CustomerRepo.addPosCustomer(client, customer, companyId)
                }

            }
            const branchInfo = (await BranchesRepo.getBranchById(reservation.branchId, companyId)).data

            const query = {
                text: `INSERT INTO "TableReservations" (id, "customerId",guests, "tableId",note, status, "reservationDate","createAt","branchId") 
                        VALUES ($1, $2, $3,$4,$5,$6,$7,$8,$9)
                        ON CONFLICT (id) 
                        DO UPDATE SET "tableId" = EXCLUDED."tableId",
                                       note = EXCLUDED.note,
                                       status = EXCLUDED.status,
                                       "reservationDate" = EXCLUDED."reservationDate"
                                      `,
                values: [reservation.id, reservation.customerId, reservation.guests, reservation.tableId ?? null, reservation.note, reservation.status, reservation.reservationDate, reservation.createAt, reservation.branchId]
            }

            await client.query(query.text, query.values);

            const getCustomerEmail = {
                text: `SELECT "Customers"."email","Customers"."name" as "customerName", "TableReservations"."status" as "reservationStatus"
                        FROM "Customers"
                        INNER JOIN "TableReservations" ON "TableReservations".id = $2
                        INNER JOIN "Companies" on "Companies".id = "Customers"."companyId"
                        WHERE "Customers".id =$1
                        AND EXISTS (
                            SELECT 1
                            FROM jsonb_array_elements_text("features") f
                            WHERE lower(f) = 'notifications'
                        )
                        `,
                values: [reservation.customerId, reservation.id]
            };

            const getCustomerEmailResult = await DB.excu.query(getCustomerEmail.text, getCustomerEmail.values);
            let customerEmail = getCustomerEmailResult.rows && getCustomerEmailResult.rows.length > 0 ? getCustomerEmailResult.rows[0].email : null;
            let customerName = getCustomerEmailResult.rows && getCustomerEmailResult.rows.length > 0 ? getCustomerEmailResult.rows[0].customerName : null;
            let reservationStatus = getCustomerEmailResult.rows && getCustomerEmailResult.rows.length > 0 ? getCustomerEmailResult.rows[0].reservationStatus : null;


            if (reservationStatus && reservation.status != reservationStatus) {

                let reservationDetails = {
                    "reservation": reservation,
                    "companyId": companyId,
                    "customerEmail": customerEmail,
                    "customerName": customerName,
                };

                if (reservation.status == 'Accept') {
                    await publishEvent("ReservationAccepted", { ...reservationDetails, branchInfo });
                }
                else if (reservation.status == 'Rejected') {
                    await publishEvent("ReservationRejected", { ...reservationDetails, branchInfo });
                }
                else {
                    await publishEvent(`Reservation${reservation.status}`, { ...reservationDetails, branchInfo });
                }
            }

        } catch (error: any) {
            console.log(error)
          
            ;
            logPosErrorWithContext(error, data, data.branchId, null, "saveReservations")
            throw new Error(error)
        }
    }

    public static async getReservations(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            const query = {
                text: `SELECT * FROM "Reservations" where "branchId" =$1 and ($2::timestamp is null or ("createdAt" >=$2 and "reservationDate" >=$2)) `,
                values: [branchId, date]
            }

            let reservations = await DB.excu.query(query.text, query.values)
            callback(JSON.stringify({ success: true, data: reservations.rows }))

        } catch (error: any) {
          
            ;

            callback(JSON.stringify({ success: false, error: error.message }))

        }
    }


    public static async recoverReservations(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {



            const query = {
                text: `SELECT * FROM "Reservations" where "branchId" =$1 and "reservationDate " >= $2 `,
                values: [branchId, new Date()]
            }

            let reservations = await DB.excu.query(query.text, query.values)
            callback(JSON.stringify({ success: true, data: reservations.rows }))

        } catch (error: any) {
          
            ;

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, data.branchId, null, "recoverReservations")
        }
    }


    public static async getPalcedReservations(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }
            const query = {
                text: `SELECT     id,
                                "customerId" ,
                                guests,
                                "tableId" ,
                                note,
                                 'Pending' as status ,
                                "reservationDate",
                                "branchId",
                                "onlineData" ,
                                "createdAt"
                       FROM "TableReservations" where "branchId" =$1 and "status" = 'Placed' `,
                values: [branchId]
            }


            let reservations = await DB.excu.query(query.text, query.values)

            let reservationList = reservations.rows;
            let customerIds: any = reservationList.map((f: any) => { return f.customerId })


            if (customerIds) {
                query.text = `SELECT * FROM "Customers" where id = any($1)`
                query.values = [customerIds];

                let customers = await DB.excu.query(query.text, query.values);
                let customerList = customers.rows
                if (customerList && customerList.length > 0) {
                    reservationList = reservationList.map((f: any) => {
                        let customer = customerList.find((customer: any) => customer.id == f.customerId)
                        if (customer) {
                            f.customer = customer
                        }
                        return f
                    })
                }
            }
            console.log(reservationList)

            callback(JSON.stringify({ success: true, data: reservationList }))

        } catch (error: any) {
            console.log(error)
          
            ;

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, data.branchId, null, "getPalcedReservations")
        }
    }


    public static async sendReservation(reservation: Reservation, branchId: string, company: Company) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()

        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {
            if (reservation.customerId) {
                const customer = await CustomerRepo.getCustomerById(reservation.customerId, company)
                reservation.customer = customer.data
            }

            reservation.status = 'Pending'

            instance.io.of('/api').in(clientId).emit("newReservation", JSON.stringify(reservation));
        } catch (error) {
          

            instance.io.of('/api').in(clientId).emit("newReservation", JSON.stringify({ success: false, error: error }));
        }
    }


    public static async setOnlineStatus(data: any, status: string) {
        try {
            data = JSON.parse(data)
            console.log(data)
            const query: any = {
                text: `UPDATE "TableReservations" set "status"=$1 where id =$2`,
                values: ['Pending']
            }


            if (data.id.length > 0) {
                for (let index = 0; index < data.id.length; index++) {
                    const element: any = data.id[index];
                    query.values = [status, element]
                    await DB.excu.query(query.text, query.values);

                }
            }



        } catch (error: any) {
          
            ;
            logPosErrorWithContext(error,null,null, null, "setReservationOnlineStatus")
            throw new Error(error)
        }
    }
}