import { Customer } from "@src/models/account/Customer";
import { Company } from "@src/models/admin/company";
import { Reservation } from "@src/models/Settings/reservation";
import { ValidationException } from "@src/utilts/Exception";
import { PoolClient } from "pg";
import { CustomerRepo } from "../callCenter/customer.repo";
import { DB } from "@src/dbconnection/dbconnection";
import { Helper } from "@src/utilts/helper";
import { ResponseData } from "@src/models/ResponseData";
import { ReservationSocket } from "../socket/reservation.socket";
import { ShopperRepo } from "./shopper.repo";

export class EcommerceTableReservation{

   public static async checkCustomer(client:PoolClient,phone:string,name:string,company:Company)
   {
    try {
        const query={
            text:`SELECT id from "Customers" where "phone" = $1 and "companyId" = $2`,
            values: [phone,company.id]
        }

        let customer = await client.query(query.text,query.values);
        if(customer && customer.rows && customer.rows.length>0 )
        {
            return customer.rows[0].id
        }else{
            let newCustomer = new Customer();
            newCustomer.name = name;
            newCustomer.phone = phone
            if(!name)
            {
                throw new ValidationException("Customer Name Is Require");
            }

           let customerData =  await CustomerRepo.addCustomer(client,newCustomer,company)
           if(customerData.success)
           {
            return  customerData.data.id
           }

           throw new ValidationException("Error at Saving Customer")
        }
    } catch (error:any) {
        throw new Error(error)
    }
   }
   
   public static async saveReservation(data:any,company:Company,userSessionId:string){
    const client = await DB.excu.client()
    try {

        console.log("saveReservationsaveReservationsaveReservationsaveReservationsaveReservationsaveReservation")
        await client.query("BEGIN")
        let reservationData = new Reservation();
        reservationData.ParseJson(data);
        reservationData.customerId = await this.checkCustomer(client,reservationData.phone,reservationData.name,company)
        reservationData.status = 'Placed'
        reservationData.onlineData = {
            onlineSessionId : Helper.createGuid(),
        }

      let loggedInUser = await ShopperRepo .getShopper(userSessionId, company)




      
             if(loggedInUser&&!loggedInUser.isPhoneValidated){
                throw new ValidationException("User Phone Number Must Be Validated")
             }

             if(loggedInUser && (loggedInUser.phoneNumber == "" || loggedInUser.phoneNumber == null)){
                loggedInUser.phone = reservationData.phone
                await ShopperRepo.setShopperPhone(client,loggedInUser,company,userSessionId)
            }

        const query={
            text:`INSERT INTO "TableReservations" ("branchId","reservationDate","status","onlineData","customerId","note","guests","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            values:[reservationData.branchId,reservationData.reservationDate,reservationData.status,reservationData.onlineData,reservationData.customerId,reservationData.note,reservationData.guests,reservationData.createAt]
        }

      let insert =   await client.query(query.text,query.values)

        await client.query("COMMIT")
        reservationData.id = insert.rows[0].id
        await ReservationSocket.sendReservation(reservationData,reservationData.branchId,company)
        return new ResponseData(true, "", {reservationSessionId:reservationData.onlineData.onlineSessionId})

    } catch (error:any) {
        await client.query("ROLLBACK")
        throw new Error(error)
    }finally{
        client.release()
    }
   }


   public static async getReservationBySessionId(onlineSessionId:string)
   {
    try {

        console.log(onlineSessionId)
        const query={
            text:`SELECT "TableReservations".*,
              "Customers".phone ,
                          "Customers".name as "customerName",
                          "Branches".name as "branchName",
                          "Tables".name as "tableName"
                  FROM "TableReservations"
                  inner join "Customers" on "Customers".id = "TableReservations"."customerId" 
                  inner join "Branches" on "Branches".id = "TableReservations"."branchId" 
                  left join "Tables" on "Tables".id = "TableReservations"."tableId" 
                  WHERE "onlineData"->> 'onlineSessionId' = $1
            `,
            values :[onlineSessionId]
        }

        let reservation = await DB.excu.query(query.text,query.values)

        return new ResponseData(true,"",reservation.rows[0])
    } catch (error:any) {
        throw new Error(error)
    }
   }
}