import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import relations from "@src/models/account/customizeReports"

export class reportOptionRepo {

    public static async getSuggest(fieldName: string,companyId: string) {
        try {
            const [part1, part2] = fieldName.split('.'); // split the string into two parts using the '.' separator
            let sql = 'SELECT  "' + [part1] + '"."' + [part2] + '"  as "id" FROM "' + [part1] + '"'
            let filter=``;
            let join=``;
   
            if(relations[part1]["companyId"])
            {
                filter= 'WHERE "'  +part1+'"."companyId"=$1'
            }else if(relations[part1]["branchId"]){
               join = `INNER JOIN "Branches" on "Branches".id = "` +part1+'"."branchId"' 
               filter = `WHERE "Branches"."companyId"=$1`
            }
            const values =[companyId];
            sql+=join+filter;
            const result = await DB.excu.query(sql,values)
            const resaults:any =[];
            result.rows.forEach((element:any) => {
                resaults.push(element.id)
          });
            return new ResponseData(true,"",{dataSources:resaults})
        } catch (error:any) {

            throw new Error(error)
        }
    }

    public static async getOptions(fieldName: string,companyId: string) {
        try {
            const [part1, part2] = fieldName.split('.'); // split the string into two parts using the '.' separator
            let sql:any;
            let filter=``;
            let join=``;
        

    
            if(relations[part1][part2] == undefined) {
                sql = ' SELECT "'+part1 +'".id , "' +part1 +'"."' + part2+ '" as "value"   FROM "' + part1 + '"';
                if(relations[part1]["companyId"]){
                    filter= ' WHERE "'  + part1+'"."companyId"=$1'
                }else{
                    join = `INNER JOIN "Branches" on "Branches".id = "` + part1+'"."branchId"' 
                    filter = ` WHERE "Branches"."companyId"=$1`
                }
            }else{
               
                if(relations[relations[part1][part2].table]["companyId"])
                {
                    filter= ' WHERE "'  + relations[part1][part2].table+'"."companyId"=$1'
                }else if(relations[relations[part1][part2].table]["branchId"]  &&  relations[part1][part2].table != "Branches"){
                   join = `INNER JOIN "Branches" on "Branches".id = "` + relations[part1][part2].table+'"."branchId"' 
                   filter = ` WHERE "Branches"."companyId"=$1`
                }else if(   relations[part1][part2].table == "Branches"){
                    filter = ` WHERE "Branches"."companyId"=$1`
                }
    
                if (relations[part1][part2] !== undefined) {
                    sql = ' SELECT "'+relations[part1][part2].table +'"."' + relations[part1][part2].linkField + '"  as "id" ,  "' +relations[part1][part2].table +'"."' + relations[part1][part2].returnField + '" as "value"   FROM "' + relations[part1][part2].table + '"'
                }
          
            }
            
            sql+=join+filter

        
            const result = await DB.excu.query(sql,[companyId])

     
               return new ResponseData(true,"",{dataSources:result.rows})
        } catch (error: any) {

            throw new Error(error)
        }
    }
}