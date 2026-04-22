import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { ReportModule } from "@src/models/account/ReportModule"
import { Company } from "@src/models/admin/company";
import { ReportQueriesValidation } from "@src/validationSchema/account/reportQuery.Schema";


export class ReportModuleRepo {

    public static async saveReportModule(data: any, companyId: string) {
        try {
        
            const validate = await ReportQueriesValidation.validateReportQuery(data);
            if (!validate.valid) {
                return new ResponseData(false, validate.error, [])
            }

            const module = new ReportModule();
            module.ParseJson(data)
            const query : { text: string, values: any } = {
                text: `INSERT INTO "ReportModules" ("companyId","text",name) VALUES($1,$2,$3) RETURNING id`,
                values: [companyId, module.text, module.name]
            }

            const resault =   await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", {dataSources:{id:(<any>resault.rows[0]).id}})
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getReportModule(moduleId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `Select * FROM "ReportModules"  WHERE id=$1`,
                values: [moduleId]
            }

            const module = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", module.rows[0])
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async editModule(data: any, id:any) {
        try {
            const module = new ReportModule();
        
            module.ParseJson(data)
            const query : { text: string, values: any } = {
                text: `UPDATE "ReportModules" SET name =$1,"text"=$2  WHERE id=$3`,
                values: [module.name,module.text,id]
            }

         await DB.excu.query(query.text, query.values)
         return new ResponseData(true, "", {dataSources:{id:module.id}})
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async deleteModule(moduleId: string) {
        try {
     
            const query : { text: string, values: any } = {
                text: `DELETE FROM  "ReportModules" WHERE id=$1`,
                values: [moduleId]
            }

         await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "",[] )
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getReportModules(data:any,company: Company) {
        try {
            const query={
                text:`SELECT id,name,text,updated FROM "ReportModules" WHERE "companyId"=$1`,
                values:[company.id]
            }
            const modules:any = await DB.excu.query(query.text,query.values);
            for (let index = 0; index < modules.rows.length; index++) {
                const element = modules.rows[index];
                modules.rows[index].text =JSON.stringify(modules.rows[index].text )
            }
            return new ResponseData(true,"",{dataSources:modules.rows})
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
}