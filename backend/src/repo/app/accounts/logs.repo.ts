import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class LogsRepo {


    public static async getLogs(data: any, company: Company) {
        try {
            let id = data.id;

            const logs = await LogsManagmentRepo.getLogs(null, id, company.id)
            return new ResponseData(true, "", logs)
        } catch (error: any) {
            throw new Error(error)
        }
    }
}