import { Socket } from "socket.io";
import { terminalRepo } from "../app/terminal/terminal.repo";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";

import { BranchesRepo } from "../admin/branches.repo";
import { Company } from "@src/models/admin/company";
import { sign, verify } from 'jsonwebtoken'

import { TimeHelper } from "@src/utilts/timeHelper";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketTerminal {
    /** TO INSERT CHILD TERMINAL */
    public static async addTerminals(client: Socket, data: any, branchId: string, decoded: any, callback: CallableFunction) {
        try {

            /**  
             * THE parentId is getted from socket token as follow 
             * decode.id => parentId
             * 
             * THE deviceId is getted from event data
             * data.deviceId => terminal.terminalId
             */

            let resault;
            if (data) {
                data = JSON.parse(data);
            }

            //TODO:
            /**
             * CHECK CONDITION WHERE BRANCH CANNOT ADD ANY EXTRA TERMINALS 
             */
            const isAllow = true;
            if (!isAllow) {
                callback(JSON.stringify(new ResponseData(false, "Not Allowed", [])))
                return;
            }

            const element = data
            element.branchId = branchId;
            element.parentId = decoded.id;
            element.terminalId = data.terminalId;
            element.name = data.terminalName;
            const terminal = await terminalRepo.checkIfTerminalIdExist(element.id, branchId)
            if (!terminal) {
                resault = await this.addTerminl(element);
            } else {
                resault = new ResponseData(false, "terminal Already Exist", [])
            }
            return callback(JSON.stringify(resault))
        } catch (error: any) {
            console.log(error)
       
         

            callback(JSON.stringify(error))
            logPosErrorWithContext(error, data, branchId, null, "addTerminals")
        }
    }
    /**Insert terminal */
    public static async addTerminl(data: any) {
        try {


            const query: { text: string, values: any } = {
                text: `INSERT INTO "Terminals" ("terminalType", "terminalId","branchId","parentId","name") VALUES ($1,$2,$3,$4,$5) Returning id`,
                values: [data.terminalType, data.terminalId, data.branchId, data.parentId, data.name]
            }


            const res = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", { id: (<any>res.rows[0]).id })

        } catch (error: any) {
            console.log(error)
       
         
            throw new Error(error)

        }
    }


    public static async getTerminals(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            // select main terminal 
            await dbClient.query("BEGIN")
            let terminals: any[] = [];
            const query: { text: string, values: any } = {
                text: `select * from "Terminals" 
                      where "token" is not null
                      and "branchId" = $1`,
                values: [branchId]
            }

            let mainTerminal = await dbClient.query(query.text, query.values);
            let mainId = mainTerminal && mainTerminal.rows && mainTerminal.rows.length > 0 ? (<any>mainTerminal.rows[0]).id : null

            if (mainId) {
                terminals.push(mainTerminal.rows[0])
                query.text = `SELECT * FROM "Terminals" where "parentId" = $1`;
                query.values = [mainId]

                let subTerminals = await dbClient.query(query.text, query.values);
                subTerminals.rows.forEach((element: any) => {
                    terminals.push(element)
                });
            }
            await dbClient.query("COMMIT")

            callback(JSON.stringify({ success: true, data: terminals }))

        } catch (error: any) {
       
         ;

            await dbClient.query("ROLLBACK")
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getTerminals")
        } finally {
            dbClient.release()
        }
    }


    public static async changeTerminalePrefix(data: any, company: Company) {

        const dbClient = await DB.excu.client();
        try {
            // select main terminal 
            let TOKEN = data.token;
            const decoded: any = verify(TOKEN, process.env.Terminal_TOKEN_SECRET as string);
            if (!decoded) {
                throw new Error("Invalid Token")
            }


            const branchId = decoded.branchId;
            const prefix = `'${decoded.prefix}'`;

            const transactionCount = {
                text: `WITH "totalTransactions" as
                        (select count(id) from "Estimates" 
                        where "branchId" =  $1
                        and "estimateNumber" ~ $2
                        and "source"  = 'POS'
                        limit 1
                      
                        ) ,"invoices" as (
                        select count(id) from "Invoices" 
                         where "branchId" =  $1
                        and  "invoiceNumber" ~ $2
                        and "source"  = 'POS'
                        limit 1
							
						)
						

                        select  "totalTransactions"."count" + "invoices"."count" as "count"
                        from "totalTransactions" , "invoices"`,
                values: [decoded.branchId, decoded.prefix]
            }
            let count = await dbClient.query(transactionCount.text, transactionCount.values)


            let isCount = count && count.rows && count.rows.length > 0 && count.rows[0].count > 0 ? true : false;
            if (isCount) {
                const companyId: any = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;
                let prefix = await terminalRepo.generateTerminalPrefix(companyId, dbClient);


                const query = {
                    text: `update "Terminals" set prefix =$1 where "branchId"=$2 and "token"  is not null and "parentId" is  null  RETURNING id,name,"terminalId",prefix,"branchId", "createdAt","parentId"`,
                    values: [prefix, branchId]
                }


                const update = await dbClient.query(query.text, query.values)


                const tokenData = update.rows[0];
                TOKEN = sign(JSON.stringify(tokenData), process.env.Terminal_TOKEN_SECRET as string);

            }

            return (JSON.stringify({ success: true, TOKEN: TOKEN }))

        } catch (error: any) {

       
         ;
            await dbClient.query("ROLLBACK")
            console.log(error)
            return (JSON.stringify({ success: false, error: error.message }))

        } finally {
            dbClient.release()
        }
    }
    public static async pushTerminals(client: Socket, data: any, branchId: string, decoded: any, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            // select main terminal 
            await dbClient.query("BEGIN")

            if (data) {
                data = JSON.parse(data);
            }

            console.log(data)
            const query = {
                text: `UPDATE "Terminals" set "name"=$1, "terminalId"=$2,"terminalType"=$3 , "updateTime" = $4 where id=$5`
            }
            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                console.log(element)
                element.updateTime = TimeHelper.convertToDate(element.updateTime);
                await dbClient.query(query.text, [element.name, element.terminalId, element.terminalType, element.updateTime, element.id])
            }


            await dbClient.query("COMMIT")

            callback(JSON.stringify({ success: true, data: [] }))

        } catch (error: any) {

            console.log(error)
       
         ;

            await dbClient.query("ROLLBACK")
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "pushTerminals")

        } finally {
            dbClient.release()
        }
    }

}