import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Service } from "@src/models/Settings/service";
import { PoolClient } from "pg";



import { SerialValidation } from "@src/validationSchema/product/serials.Schema";
import { ServiceValidation } from "@src/validationSchema/admin/service.schema";
import { values } from "lodash";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "./branches.repo";
import { SocketService } from "../socket/service.socket";
export class ServiceRepo {
    public static async checkIfServiceNameExists(client:PoolClient,serviceId: string | null, name: string, companyId: string): Promise<boolean> {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Services" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                serviceId,
                companyId,
            ],
        };
        if (serviceId == null) {
            query.text = `SELECT count(*) as qty FROM "Services" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;

    }

    public static async getServiceLastIndex(client:PoolClient,companyId:string)
    {
        try {
            const query : { text: string, values: any } = {
                text:`select max(index) as "maxIndex" from "Services"
                where "companyId" =$1`,
                values:[companyId]
            }

            let service = await client.query(query.text,query.values);
            if(service.rows&&service.rows.length>0)
            { 
                return (<any>service.rows[0]).maxIndex
            }else{
               return null
            }
        } catch (error:any) {
            throw new Error(error)
        }
    }

    public static async AddBranchServices(client: PoolClient, service: Service, companyId: string) {
        try {
            const validate = await ServiceValidation.validateService(service);
            if (!validate.valid) {
                throw new ValidationException(validate.error)
            }

            const isServiceNameExist = await this.checkIfServiceNameExists(client,null, service.name, companyId);
            if (isServiceNameExist) {
                throw new ValidationException("Service Name Already  Used")
            }
            let serviceIndex = await this.getServiceLastIndex(client,companyId);
            if(serviceIndex!=null)
            {
                service.index  = serviceIndex +1

            }else{
                service.index = 0;
            }
            service.updatedDate = new Date()
            const query : { text: string, values: any } = {
                text: `INSERT INTO "Services"
                     (name,type,index,"companyId","updatedDate",translation,"default","branches","mediaId","menuId","options")
                     VALUES 
                     ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                values: [service.name, service.type, service.index, companyId, service.updatedDate, service.translation, service.default, JSON.stringify(service.branches),service.mediaId,service.menuId,service.options]
            }
            const serviceData = await client.query(query.text, query.values)
            service.id = (<any>serviceData.rows[0]).id
            await SocketService.sendNewService(service)
            return new ResponseData(true, "", { id: (<any>serviceData.rows[0]).id })
        }
        catch (error: any) {

          
            throw new Error(error.message)
        }
    }
    public static async editBranchService(client:PoolClient,data: any, companyId: string) {

        try {
     
            const service = new Service();
            service.ParseJson(data);
       

            const validate = await ServiceValidation.validateService(service);
            if (!validate.valid) {
                throw new ValidationException(validate.error)
            }
            const isServiceNameExist = await this.checkIfServiceNameExists(client,service.id, service.name, companyId);
            if (isServiceNameExist) {
                throw new ValidationException("Service Name Already  Used")
            }
            service.updatedDate = new Date()
            const query : { text: string, values: any } = {
                text: `UPDATE  "Services" SET 
                                    name=$1,
                                    index=$2,
                                    "updatedDate"=$3,
                                    "translation" =$4,
                                    "branches" = $5,
                                    "mediaId"=$6,
                                    "menuId"=$7,
                                    "options"=$8
                                    WHERE "companyId"=$9 AND id=$10`,
                values: [service.name,  service.index, service.updatedDate, service.translation, JSON.stringify(service.branches),service.mediaId,service.menuId,service.options, companyId, service.id]
            }


            await client.query(query.text, query.values)
            await SocketService.sendupdatedService(service)
            return new ResponseData(true, "", []);

        }


        catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async getServicesList(data: any, companyId: string) {
        try {

         

            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

        
  

 
    
            let sort = data.sortBy;
            let sortValue = !sort ? '"Services"."index"' : '"' + sort.sortValue + '"';

            let sortDirection = !sort ? "ASC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by ` + sortTerm;


            let page= data.page??1
            let offset =0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query={
                text:`SELECT 
                COUNT(*) OVER(),
                "Services".id,
                "Services".name,
                "Services".type,
                "Services".index,
                "Services".translation,
                "Services"."mediaId",
                "Services"."default",
                "Media".url as "mediaUrl"
                FROM "Services"
                left join "Media" on "mediaId" = "Media".id 
                WHERE "Services"."companyId"=$1
                
                 AND (LOWER ("Services".name) ~ $2
                        OR LOWER ("Services".type) ~ $2)
                        and( "isDeleted" = false or "isDeleted" is null )
                        ${orderByQuery}
                 Limit $3 offset $4`,
                values:[companyId,searchValue,limit,offset]
            }

            const selectList = await DB.excu.query(query.text, query.values)

 
            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
              lastIndex = count
            }
      
      
      
      
            const resData = {
              list: selectList.rows,
              count: count,
              pageCount: pageCount,
              startIndex: offset,
              lastIndex: lastIndex
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }






    public static async getPickUpAndDeliveryServicesList( companyId: string) {
        try {

     
            const selectText = `SELECT 
            "Services".id,
            "Services".name,
            "Services".type,
            "Services".index,
            "Services".translation
            FROM "Services"`
            const filterQuery = ` WHERE "companyId"=$1 and( "type" = 'PickUp' or "type" = 'Delivery') `
           const selectQuery = selectText + filterQuery;
           const  selectValues = [companyId]

       
            const selectList = await DB.excu.query(selectQuery, selectValues)

   
        

            const resData = {
                list: selectList.rows
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }












    public static async getService(serviceId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT "Services".* ,
                "Media".url as "mediaUrl"
                FROM "Services" 
                left join "Media" on "mediaId" = "Media".id  

                WHERE  "Services".id=$1`,
                values: [serviceId]
            }
            const service = await DB.excu.query(query.text, query.values)
            var row: any = service.rows[0];


            if (row.branches != null) {
                for (let index = 0; index < row.branches.length; index++) {
                    const element = row.branches[index];

                }
            }

            return new ResponseData(true, "", service.rows[0])
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async arrangeServices(data: any) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                if (element.id == null || element.id == "") {
                    throw new ValidationException("Service Id is Required")
                }
                let updateTime = new Date()
                const query : { text: string, values: any } = {
                    text: `UPDATE "Services"
                                      SET index = $1,
                                      "updatedDate" =$2

                                      WHERE id = $3 `,
                    values: [element.index,updateTime, element.id]
                }

                await client.query(query.text, query.values)
            }

            await  client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }


    public static async getBranchServices(branchId: string) {
        try {

            const types = ["PickUp", "Delivery"]
            const query : { text: string, values: any } = {
                text: `SELECT id,name FROM "Services" 
                WHERE "branchId" =$1
                AND type =any($2)
                `,
                values: [branchId, types]
            }


            const services = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", services.rows)
        } catch (error: any) {

          

            throw new Error(error.message)
        }
    }

    public static async getDineInService(companyId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `SELECT id from "Services" where "companyId"=$1 and "type"= 'DineIn'`,

                values: [companyId]
            }
            let service = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, '', service.rows[0])
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async getDefaultServiceByName(companyId: string, name: string) {
        try {

            const query : { text: string, values: any } = {
                text: `SELECT id from "Services" where type = $1 and "default" = true and "companyId"=$2`,
                values: [name, companyId]
            }

            let service = await DB.excu.query(query.text, query.values);
            return  service.rows && service.rows.length>0 ?(<any>service.rows[0]).id : null

        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async isDefaultService(client:PoolClient,serviceId:string)
    {
        try {
            const query={
                text:`SELECT "default" from "Services" where id =$1`,
                values:[serviceId]
            }

            let service = await client.query(query.text,query.values);
            if(service && service.rows.length>0 &&service.rows[0].default)
            {
                return false
            }
            return true
        } catch (error:any) {
            throw new Error(error)
        }
    }

    public static async deleteService(serviceId:string){
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let isAllowed = await this.isDefaultService(client,serviceId)
            if(!isAllowed)
            {
                throw new Error("Delete Default Services is not allowed")
            }
            let updateTime = new Date()
            const query : { text: string, values: any }={
                text:`UPDATE "Services" SET "isDeleted" = true , name = "Services".name  || ' [Deleted]' , "updatedDate"=$1 where id =$2`,
                values:[updateTime,serviceId]
            }
            await client.query("COMMIT")
            await client.query(query.text,query.values)
            return new ResponseData(true,"",[])
        } catch (error:any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        }finally{
            client.release()
        }
    }




    public static async getServiceName(serviceId: string) {
        try {
            const query = {
                text: `SELECT  name FROM "Services" where id =$1`,
                values: [serviceId]
            }

            let service = await DB.excu.query(query.text, query.values);

            return service && (service).rows && service.rows.length > 0 ? (<any>service.rows[0]).name : 'Other'
        } catch (error: any) {
            throw new Error(error)
        }


    }

}