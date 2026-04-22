import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Collection } from "@src/models/Settings/Collection"
import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";

import { Segment } from "@src/models/Settings/CustomerSegmentations";

export class CustomerSegmentsRepo{
   
    public static async isTitleExist(client: PoolClient, companyId: string, title: string, id: string | null = null) {

 // when editing  existing  
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "CustomerSegments" where LOWER(title) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                title,
                id,
                companyId,
            ],
        };
               // when adding new  
        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "CustomerSegments" where LOWER(title) = LOWER($1) and "companyId" = $2`;
            query.values = [title, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }

    public static async isSlugExist(client: PoolClient, companyId: string, slug: string, id: string | null = null) {
        // when editing 

        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "CustomerSegments" where LOWER(slug) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                slug,
                id,
                companyId,
            ],
        };
        // when adding new
        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "CustomerSegments" where LOWER(slug) = LOWER($1) and "companyId" = $2`;
            query.values = [slug, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }

    public static async addCustomerSegment(data:any,company:Company)
    {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let CustomerSegment = new Segment();
            CustomerSegment.ParseJson(data);
            
            const isTitleExist =await this.isTitleExist(client,company.id,CustomerSegment.title,null)
            if(isTitleExist)
            {
                throw new Error("Title already used")
            }

            const isSlugExist =await this.isSlugExist(client,company.id,CustomerSegment.slug,null)
            if(isSlugExist)
            {
                throw new Error("Slug already used")
            }

            const query : { text: string, values: any }={
                text:`INSERT INTO "CustomerSegments" ("title",
                                                        "slug",
                                                        "type",
                                                        "data",
                                                        description,
                                                        "companyId",
                                                        "createdAt") VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                values:[CustomerSegment.title,CustomerSegment.slug,CustomerSegment.type,CustomerSegment.data,CustomerSegment.description,company.id,CustomerSegment.createdAt]
            }

            let insert = await client.query(query.text,query.values);


            await client.query("COMMIT")

            return new ResponseData(true,"",{id:insert.rows[0].id})
        } catch (error:any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        }finally{
             client.release()
        }
    } 


    public static async editCustomerSegment(data:any,company:Company)
    {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let CustomerSegment = new Collection();
            CustomerSegment.ParseJson(data);
            
            const isTitleExist =await this.isTitleExist(client,company.id,CustomerSegment.title,CustomerSegment.id)
            if(isTitleExist)
            {
                throw new Error("Title already used")
            }

            const isSlugExist =await this.isSlugExist(client,company.id,CustomerSegment.slug,CustomerSegment.id)
            if(isSlugExist)
            {
                throw new Error("Slug already used")
            }

            const query : { text: string, values: any }={
                text:`Update "CustomerSegments" set "title"=$1,
                                                        "slug"=$2,
                                                        "type"=$3,
                                                        "data"=$4,
                                                        description=$5
                                                    WHERE id =$6
                                                        `,
                values:[CustomerSegment.title,CustomerSegment.slug,CustomerSegment.type,CustomerSegment.data,CustomerSegment.description,CustomerSegment.id]
            }

             await client.query(query.text,query.values);


            await client.query("COMMIT")

            return new ResponseData(true,"",[])
        } catch (error:any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        }finally{
             client.release()
        }
    } 


    public static async getCustomerSegmentById(CustomerSegmentId:string,company:Company)
    {
        try {
     

            const query={
                text:`SELECT "CustomerSegments".id , "CustomerSegments".type ,"CustomerSegments".title ,"CustomerSegments".slug ,"CustomerSegments".description ,
                                case 
                                when "CustomerSegments".type = 'Manual' then 
                                data || jsonb_build_object('customers', jsonb_agg(jsonb_build_object('customerId', trim ('"' from ids::text)::uuid, 
                                                                                                    'CustomerName', "Customers".name, 
                                                                                                    'phone', "Customers".phone,
                                                                                                    'saluation', "Customers".saluation)) )
                                else data
                                end as "data"
                                
                        FROM "CustomerSegments"  as "CustomerSegments"
                        LEFT JOIN jsonb_array_elements(data->'ids') as ids ON "CustomerSegments".type = 'Manual'
                        LEFT JOIN "Customers" ON "CustomerSegments".type = 'Manual' AND "Customers".id = (trim ('"' from ids::text)::uuid)
                        WHERE "CustomerSegments".id = $1
                        AND "CustomerSegments"."companyId" = $2
                        GROUP BY  "CustomerSegments".id
                        `,
                values:[CustomerSegmentId,company.id]
            }

            let collection =   await DB.excu.query(query.text,query.values)
            return new ResponseData(true,"",collection.rows[0])
        } catch (error:any) {
            throw new Error(error)
        }
    } 

    public static async getCustomerSegmentList(data:any,company:Company)
    {
        try {
            let companyId=company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;
            let selectCount;
            let pageCount = 0;

            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const selectText = `SELECT id,title  FROM "CustomerSegments"`;
            const countText = `SELECT COUNT(*) FROM "CustomerSegments"`;

            let filterQuery = ` where "companyId"=$1`;
            filterQuery += ` and (LOWER("CustomerSegments".slug) ~ $2 or LOWER("CustomerSegments".title) ~ $2) `
            let orderByQuery = ` Order By ` + sortTerm



            const limitQuery = ` limit $3 offset $4`
            selectQuery = selectText + filterQuery
            selectValues = [companyId, searchValue]
            if (data != null && data != '' && JSON.stringify(data) != '{}') {

                sort = data.sortBy;
                sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? " DESC " : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection;
                orderByQuery = " ORDER BY " + sortTerm

                if (data.searchTerm != "" && data.searchTerm != null) {
                    searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
                }
                selectQuery = selectText + filterQuery + limitQuery
                selectValues = [companyId, searchValue, limit, offset]
                countQuery = countText + filterQuery
                countValues = [companyId, searchValue]
                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }


            const selectList = await DB.excu.query(selectQuery, selectValues)



            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (selectList.rows.length < data.limit || data.page == pageCount) {
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
          
            throw new Error(error)
        }
      
    } 
}