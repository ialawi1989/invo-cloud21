import { EventLog } from "@src/models/log"
import { PoolClient } from "pg"

export class EventLogsRepo{

    public static async addEventLogs(client:PoolClient,data:any){
        try {

            let log = new EventLog()
            log.ParseJson(data)
            const query={
                text:`INSERT INTO "EventLogs" ("type","id","action","createdAt","employeeId","companyId","branchId","source") values($1,$2,$3,$4,$5,$6,$7,$8)`,
                values :[log.type,log.id,log.action,log.createdAT,log.employeeId,log.companyId,log.branchId,log.source]
            }

            await client.query(query.text,query.values)
        } catch (error:any) {
            throw new Error(error)
        }
    }
}

