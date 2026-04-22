import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { ReportModule } from "@src/models/account/ReportModule";
import { Company } from "@src/models/admin/company";
import { ReportQueriesValidation } from "@src/validationSchema/account/reportQuery.Schema";


export class ReportQueriesRepo{
    public static async saveReportQueries(data: any, companyId: string) {
        try {
            const validate = await ReportQueriesValidation.validateReportQuery(data);
            if (!validate.valid) {
                return new ResponseData(false, validate.error, [])
            }

            const Queries = new ReportModule();
            
            Queries.ParseJson(data)
            const query : { text: string, values: any } = {
                text: `INSERT INTO "ReportQueries" ("companyId","text",name) VALUES($1,$2,$3) RETURNING id`,
                values: [companyId, Queries.text, Queries.name]
            }

          const resault =  await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", {dataSources:{id:(<any>resault.rows[0]).id}})
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getReportQuerie(querieId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `Select * FROM "ReportQueries"  WHERE id=$1`,
                values: [querieId]
            }

            const Queries = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", Queries.rows[0])
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async editQuerie(data: any) {
        try {
            const Queries = new ReportModule();
            Queries.ParseJson(data)
            const query : { text: string, values: any } = {
                text: `UPDATE "ReportQueries" SET name =$1,"text"=$2  WHERE id=$3`,
                values: [Queries.name,Queries.text,Queries.id]
            }

         await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "",[] )
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async deleteQuerie(querieId: string) {
        try {
     
            const query : { text: string, values: any } = {
                text: `DELETE FROM  "ReportQueries" WHERE id=$1`,
                values: [querieId]
            }

         await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "",[] )
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getReportQueries(data:any,company: Company) {
      

            try {
                const query={
                    text:`SELECT id,name,text FROM "ReportQueries" WHERE "companyId"=$1`,
                    values:[company.id]
                }
                const queries:any = await DB.excu.query(query.text,query.values);

                for (let index = 0; index < queries.rows.length; index++) {
                   
                    queries.rows[index].text = JSON.stringify(queries.rows[index].text)
                }
                return new ResponseData(true,"",{dataSources:queries.rows})
            } catch (error: any) {
              

                throw new Error(error)
            }
     
    }
}