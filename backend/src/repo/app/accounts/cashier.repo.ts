
import { Cashier } from "@src/models/account/Cashier";

import { CashierLine } from "@src/models/account/CashierLine";
import { PoolClient } from "pg";
import { CompanyRepo } from "../../admin/company.repo";


import { ResponseData } from "@src/models/ResponseData";
import { TimeHelper } from "@src/utilts/timeHelper";
export class CashierRepo {


    public static async checkIfCashierIdExist(client:PoolClient,cashierId: string, branchId: string) {
        try {
            
            const query : { text: string, values: any } = {
                text: `SELECT id, "branchId" FROM "Cashiers" where id = $1`,
                values: [cashierId]
            }
            const cashier = await client.query(query.text, query.values);
        
            if (cashier.rows && cashier.rows.length>0 ) {
                return new ResponseData(true,"",{branchId:cashier.rows[0].branchId})
            } else {
                return new ResponseData(false,"",{branchId:null})
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async checkCashireLineIdExist(client:PoolClient,cashireLineId: string, cashierId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "CashierLines" where id = $1 and "cashierId"=$2`,
                values: [cashireLineId, cashierId]
            }
            const cashier = await client.query(query.text, query.values);

            if ((<any>cashier.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error) {
          
        }
    }



    public static async getCashierLogs(client: PoolClient, cashierId: string) {
        try {
            const query = {
                text: `SELECT "logs" FROM "Cashiers" where id=$1`,
                values: [cashierId]
            }

            let cahsierLogs = await client.query(query.text, query.values);

            return cahsierLogs.rows && cahsierLogs.rows.length > 0 && cahsierLogs.rows[0] && cahsierLogs.rows[0].logs ? cahsierLogs.rows[0].logs : []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addCashier(client:PoolClient,data: any, branchId: string) {
       
        try {
    
   
            const country = (await CompanyRepo.getCompanyCountry(client,branchId)).country;
            const afterDecimal = await CompanyRepo.getCountryAfterDecimal(country);

            const cashier = new Cashier();
            cashier.ParseJson(data);
            cashier.branchId = branchId;
            cashier.setlogs([])
            const startAmount = +(cashier.startAmount).toFixed(afterDecimal);
            const endAmount = +(cashier.endAmount).toFixed(afterDecimal);



            
            cashier.cashierIn =  await TimeHelper.convertToDate(data.cashierIn)
            cashier.cashierOut = data.cashierOut?  await TimeHelper.convertToDate(data.cashierOut):null
  
            const query : { text: string, values: any } = {
                text: `INSERT INTO "Cashiers" (id,"employeeId","cashierIn","cashierOut","startAmount", "endAmount","branchId","cashierOutBy", "cashierNumber",    "terminalId","logs") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                values: [cashier.id,
                cashier.employeeId,
                cashier.cashierIn,
                cashier.cashierOut,
                startAmount,
                endAmount,
                cashier.branchId,
                cashier.cashierOutBy,
                cashier.cashierNumber,
                cashier.terminalId,
             JSON.stringify(cashier.logs)
            ]
            }
            const insert = await client.query(query.text, query.values);

            cashier.id = (<any>insert.rows[0]).id;

            for (let index = 0; index < cashier.lines.length; index++) {
                const line = cashier.lines[index];
                line.cashierId = cashier.id;
       
                const isLineIdExist = await this.checkCashireLineIdExist(client,line.id,line.cashierId)
          
                if(isLineIdExist)
                {
                    await this.editCashierLine(client, line, afterDecimal)

                }else{
                    await this.addCashierLine(client, line, afterDecimal)

                }
            }
           return new ResponseData(true,"",[])
        } catch (error: any) {
         
            
          
            throw new Error(JSON.stringify({cashierId:data.cashierId, error:error.message}))
        }
    }
    public static async addCashierLine(client: PoolClient, cashierLine: CashierLine, afterDecimal: number) {
        try {

            const startAmount = +(cashierLine.startAmount).toFixed(afterDecimal);
            const endAmount = +(cashierLine.endAmount).toFixed(afterDecimal);
            const query : { text: string, values: any } = {
                text: `INSERT INTO  "CashierLines" (id,"cashierId","paymentMethodId",rate, "startAmount","endAmount" ) VALUES($1,$2,$3,$4,$5,$6)`,
                values: [
                cashierLine.id,    
                cashierLine.cashierId,
                cashierLine.paymentMethodId,
                cashierLine.rate,
                    startAmount,
                    endAmount
                ]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async editCashier(client:PoolClient,data: any, branchId: string) {
      
        try {
    
            const country = (await CompanyRepo.getCompanyCountry(client,branchId)).country;
            const afterDecimal = await CompanyRepo.getCountryAfterDecimal(country);

            const cashier = new Cashier();
            cashier.ParseJson(data);
            cashier.branchId = branchId;
            const startAmount = +(cashier.startAmount).toFixed(afterDecimal);
            const endAmount = +(cashier.endAmount).toFixed(afterDecimal);
 

            cashier.cashierIn = await TimeHelper.convertToDate(data.cashierIn)
            cashier.cashierOut = data.cashierOut? await TimeHelper.convertToDate(data.cashierOut):null
            let cahsierLogs = await this.getCashierLogs(client, cashier.id)
            cashier.setlogs(cahsierLogs)
            const query : { text: string, values: any } = {
                text: `UPDATE "Cashiers" SET "cashierIn"=$1,"cashierOut"=$2,"startAmount"=$3, "endAmount"=$4,"terminalId"=$5,"cashierOutBy"=$6,"cashierNumber" =$7 ,"logs"=$8 WHERE id = $9 and "employeeId"=$10 and "branchId"=$11`,
                values: [
                    cashier.cashierIn,
                    cashier.cashierOut,
                    startAmount,
                    endAmount,
                    cashier.terminalId,
                    cashier.cashierOutBy,
                    cashier.cashierNumber,
                    JSON.stringify(cashier.logs),
                    cashier.id,
                    cashier.employeeId,
                    cashier.branchId]
            }

            await client.query(query.text, query.values);

            for (let index = 0; index < cashier.lines.length; index++) {
                const line = cashier.lines[index];
                line.cashierId = cashier.id;
                const isLineIdExist = await this.checkCashireLineIdExist(client,line.id, line.cashierId)
                if (isLineIdExist) {
                    await this.editCashierLine(client, line, afterDecimal)

                } else {
                    await this.addCashierLine(client, line, afterDecimal)
                }
            }
    

            return new ResponseData(true,"",[])
        } catch (error: any) {
            
           
          
            throw new Error(JSON.stringify({cashierId:data.cashierId, error:error.message}))
        }
    }
    public static async editCashierLine(client: PoolClient, cashierLine: CashierLine, afterDecimal: number) {
        try {

            const startAmount = +(cashierLine.startAmount).toFixed(afterDecimal);
            const endAmount = +(cashierLine.endAmount).toFixed(afterDecimal);
            const query : { text: string, values: any } = {
                text: `UPDATE "CashierLines" SET "paymentMethodId"=$1,rate=$2, "startAmount"=$3,"endAmount"=$4 WHERE "cashierId"=$5 AND id =$6 `,
                values: [
                    cashierLine.paymentMethodId,
                    cashierLine.rate,
                    startAmount,
                    endAmount,
                    cashierLine.cashierId,
                    cashierLine.id
                ]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {

          

            throw new Error(error)
        }
    }
}