import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Terminal } from "@src/models/Settings/Terminals";
import { Company } from "@src/models/admin/company";
import { RedisClient } from "@src/redisClient";
import { SocketController } from "@src/socket";
import { sign } from 'jsonwebtoken'

import { Log } from "@src/models/log";
import { PoolClient } from "pg";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class terminalRepo {


    public static async checkIfTerminalIsConnected(branchId: string, terminalId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT token from "Terminals" where "branchId"=$1 and id=$2`,
                values: [branchId, terminalId]
            }

            let terminal = await DB.excu.query(query.text, query.values);
            return (terminal.rowCount != null && terminal.rowCount > 0) && (<any>terminal.rows[0]).token != null ? true : false
        } catch (error: any) {
          
            throw new Error(error)
        }
    }


    public static async getTeminalPrefix(branchId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select "prefix" from "Terminals" where "branchId" =$1  and "token" is not null`,
                values: [branchId]
            }

            let terminal = await DB.excu.query(query.text, query.values);
            return (<any>terminal.rows[0]).prefix
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async checkIfTerminalIdExist(terminalId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT id,name,"terminalId",prefix,"branchId", "createdAt","parentId" FROM "Terminals" where "terminalId"=$1 and "branchId"=$2`,
                values: [terminalId, branchId],
            }

            const terminalData = await DB.excu.query(query.text, query.values);



            if (terminalData.rowCount != null && terminalData.rowCount > 0) {
                return terminalData.rows[0]

            } else {
                return null
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async connectTerminal(id: string, branchId: string, token: string) {

        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Terminals" set token = $1 where id= $2 and "branchId"= $3`,
                values: [token, id, branchId]
            }
            await DB.excu.query(query.text, query.values)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async checkIfBranchIsConnected(branchId: string) {
        try {

            const query = {
                text: `UPDATE "Terminals" SET "token" = null where "branchId" =$1`,
                values: [branchId]
            }

            await DB.excu.query(query.text, query.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getLogs(terminalId: string | null, branchId: string | null = null) {
        try {
            const query = {
                text: `SELECT logs FROM "Terminals" where id = $1`,
                values: [terminalId]
            }
            if (branchId != null && branchId != "") {

                query.text = `SELECT logs FROM "Terminals" where "branchId" = $1 and "token" is not null`
                query.values = [branchId]
            }

            let terminal = await DB.excu.query(query.text, query.values);
            return terminal.rows && terminal.rows.length > 0 && (<any>terminal.rows[0]).logs ? (<any>terminal.rows[0]).logs : []
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setLogs(client: PoolClient | null, terminalId: string, logs: Log[], branchId: string, companyId: string, employeeId: string | null, Number: string | null, source: string
    ) {
        try {
            // const query = {
            //     text: `UPDATE "Terminals" SET logs=$1  where id = $2`,
            //     values: [JSON.stringify(logs), terminalId]
            // }
            // await DB.excu.query(query.text, query.values);

            await LogsManagmentRepo.manageLogs(null, "Terminals", terminalId, logs, branchId, companyId, employeeId, Number, source)

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async addTerminalBranch(data: any, company: Company, employeeId: string) {
        try {
            /** SET TOKEN TO NULL IF BRANCH IS ALREADY CONNECTED */
            await this.checkIfBranchIsConnected(data.branchId)
            const checkTerminal = await this.checkIfTerminalIdExist(data.terminalId, data.branchId)
            let terminalData = checkTerminal ? checkTerminal : data;
            const terminal = new Terminal();
            terminal.ParseJson(terminalData)
            terminal.logs = [];

            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
                values: [employeeId, company.id]
            }
            let employeeNameResult = await DB.excu.query(getEmployeeName.text, getEmployeeName.values);
            let employeeName = employeeNameResult.rows && employeeNameResult.rows.length > 0 && employeeNameResult.rows[0].employeeName ? employeeNameResult.rows[0].employeeName : ''




            if (terminal.prefix == "" || terminal.prefix == null) {
                terminal.prefix = await this.generateTerminalPrefix(company.id)
                if (terminal.id != null && terminal.id != "") {
                    await this.setTerminalPrefix(terminal.prefix, terminal.id)
                }
            }
            if (terminal.id == null || terminal.id == "") {
                Log.addLog(terminal, `${employeeName} create new Terminal Connect`, "Connect", employeeId, {"branchId": terminal.branchId })

                const query: { text: string, values: any } = {
                    text: `INSERT INTO "Terminals" ("terminalType", "terminalId","branchId", "parentId","prefix" ) VALUES ($1,$2,$3,$4,$5) Returning id`,
                    values: [terminal.terminalType, terminal.terminalId, terminal.branchId, terminal.parentId, terminal.prefix]
                }
                const insert = await DB.excu.query(query.text, query.values);
                terminal.id = (<any>insert.rows[0]).id
            } else {
                Log.addLog(terminal, `${employeeName} Connect Terminal`, "Connect", employeeId, {"branchId": terminal.branchId })
                //terminal.logs = await this.getLogs(terminal.id);

                //await this.setLogs(terminal.id, terminal.logs)
            }
            const signedData = sign(JSON.stringify(terminal), process.env.Terminal_TOKEN_SECRET as string);
            let resData = {
                apiToken: signedData,
                terminalId: terminal.terminalId
            }
            await this.connectTerminal(terminal.id, data.branchId, signedData)

            await this.setLogs(null, terminal.id, terminal.logs, terminal.branchId, company.id, employeeId, "", "Cloud");


            return new ResponseData(true, "Connected Successfully", resData)

        } catch (error: any) {
          

            throw new Error(error.message)

        }
    }


    public static async setTerminalPrefix(prefix: string, terminalId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Terminals" SET prefix =$1 where id =$2`,
                values: [prefix, terminalId]
            }

            await DB.excu.query(query.text, query.values);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getTerminalToken(branchId: any) {
        try {
            const data = {
                branchId: branchId,
            }
            const signedData = sign(data, process.env.Terminal_TOKEN_SECRET as string);
            const url = process.env.appBaseUrl + "/terminals/connectTerminal/" + signedData;
            return new ResponseData(true, "", { token: signedData, url: url })
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async connectTerminalRedirect(code: String) {
        try {
            //change this url based on stage (dev or test)
            let baseUrl = process.env.CLOUD_BASE_URL;

            let httpString = baseUrl?.split('//')
            if (httpString) {
                let redirectUrl = "";
                redirectUrl = baseUrl + '/branchConnection?code=' + code;
                return new ResponseData(true, "", redirectUrl)

            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static getConnectTerminalUrl(code: String) {
        try {
            //change this url based on stage (dev or test)
            let baseUrl = process.env.APP_BASE_URL;

            let httpString = baseUrl?.split('//')
            if (httpString) {
                let redirectUrl = "";

                redirectUrl = baseUrl + '/connectTerminal/' + code;


                return new ResponseData(true, "", redirectUrl)

            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async generateTerminalPrefix(companyId: string, client: PoolClient | null = null) {
        try {
            const terminalPrefix = 'T'
            let terminalNumber = 1

            const query: { text: string, values: any } = {
                text: `SELECT  regexp_replace(COALESCE("prefix",'T0'), 'T', '')::int AS "terminalNumber" FROM "Terminals" 
                INNER JOIN "Branches" on "Terminals"."branchId"  = "Branches".id 
                inner join "Companies" on "Companies".id = "Branches"."companyId"
                where "Companies".id =$1
                order by regexp_replace(COALESCE("prefix",'T0'), 'T', '')::int desc 
                limit 1`,
                values: [companyId]
            }

            let terminal;
            if (client) {
                terminal = await client.query(query.text, query.values);

            } else {
                terminal = await DB.excu.query(query.text, query.values);

            }

            terminalNumber = terminal.rows.length > 0 && (<any>terminal.rows[0]).terminalNumber != 0 ? (<any>terminal.rows[0]).terminalNumber + 1 : terminalNumber;
            return terminalPrefix + terminalNumber
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async disconnectTerminal(branchId: string, employeeId: string, company: Company) {
        try {


            // let logs: Log[] = await this.getLogs(null, branchId);
            // let log = new Log()
            // log.action = "Disconnect"
            // log.comment = "Disconnect Terminal"
            // log.employeeId = employeeId;
            // log.createdAt = new Date()

            // logs.push(log)
            const query: { text: string, values: any } = {
                text: `UPDATE "Terminals" set token = null  where "branchId" =$1 and "parentId" is null `,
                values: [branchId]
            }

            await DB.excu.query(query.text, query.values);

            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
                values: [employeeId, company.id]
            }
            let employeeNameResult = await DB.excu.query(getEmployeeName.text, getEmployeeName.values);
            let employeeName = employeeNameResult.rows && employeeNameResult.rows.length > 0 && employeeNameResult.rows[0].employeeName ? employeeNameResult.rows[0].employeeName : ''

            let getTerminalId = {
                text: `SELECT id
                  FROM "Terminals"
                  WHERE "branchId" = $1 and "parentId" is null
                    `,
                values: [branchId]
            }

            let terminalIdResult = await DB.excu.query(getTerminalId.text, getTerminalId.values);
            let terminalId = terminalIdResult.rows && terminalIdResult.rows.length > 0 && terminalIdResult.rows[0].id ? terminalIdResult.rows[0].id : ''


            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Disconnect'
            log.comment = `${employeeName} has disconnect Terminal`

            await LogsManagmentRepo.manageLogs(null, "Terminals", terminalId, [log], branchId, company.id, employeeId, "", "Cloud")



            let redisClient: RedisClient;

            const instance = SocketController.getInstance();
            redisClient = RedisClient.getRedisClient()
            const clientId: any = await redisClient.get("Socket" + branchId);
            instance.io.of('/api').in(clientId).emit("disconnectClient", JSON.stringify("client is disconnected"));
            instance.io.of('/api').in(clientId).disconnectSockets(true)
            
           

            
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async checkIfCodeExprie(code: string) {
        try {
            const socketInstance = SocketController.getInstance();
            const terminalSocketData = socketInstance.pendingTerminals.find(f => f.data.terminalCode == code)

            if (terminalSocketData) {
                return new ResponseData(false, "", []);
            } else {
                return new ResponseData(true, "", []);

            }

        } catch (error: any) {
            throw new Error(error)
        }
    }
}