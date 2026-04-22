import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Collection } from "@src/models/Settings/Collection"
import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";

import { ValidationException } from "@src/utilts/Exception";
import { RedisClient } from "@src/redisClient";

export class ProductCollectionRepo {

    public static async isTitleExist(client: PoolClient, companyId: string, title: string, id: string | null = null) {

        // when editing  existing  
        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "ProductCollections" where LOWER(title) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                title,
                id,
                companyId,
            ],
        };
        // when adding new  
        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "ProductCollections" where LOWER(title) = LOWER($1) and "companyId" = $2`;
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

        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "ProductCollections" where LOWER(slug) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                slug,
                id,
                companyId,
            ],
        };
        // when adding new
        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "ProductCollections" where LOWER(slug) = LOWER($1) and "companyId" = $2`;
            query.values = [slug, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }

    public static async addProdcutCollection(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let productCollection = new Collection();
            productCollection.ParseJson(data);

            const isTitleExist = await this.isTitleExist(client, company.id, productCollection.title, null)
            if (isTitleExist) {
                throw new Error("Title already used")
            }

            const isSlugExist = await this.isSlugExist(client, company.id, productCollection.slug, null)
            if (isSlugExist) {
                throw new Error("Slug already used")
            }

            if (productCollection.type == 'Auto') {
                const data: any = productCollection.data

                if (data.conditions && data.conditions.length == 0) {
                    throw new ValidationException("Condtions are required")
                }
                if (data.conditions) {
                    const checkTypeAndcondition = data.conditions.filter((f: any) => f.type == null || f.type == "" || f.condition == null || f.condition == "")
                    if (checkTypeAndcondition && checkTypeAndcondition.length > 0) {
                        throw new ValidationException("Condtion and type is required")
                    }
                }
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "ProductCollections" ("title",
                                                        "slug",
                                                        "translation",
                                                        "type",
                                                        "data",
                                                        description,
                                                        "companyId",
                                                        "createdAt",
                                                        "mediaId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
                values: [productCollection.title, productCollection.slug, productCollection.translation, productCollection.type, productCollection.data, productCollection.description, company.id, productCollection.createdAt, productCollection.mediaId]
            }

            let insert = await client.query(query.text, query.values);


            await client.query("COMMIT")

            return new ResponseData(true, "", { id: insert.rows[0].id })
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async editProdcutCollection(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let productCollection = new Collection();
            productCollection.ParseJson(data);


            const isTitleExist = await this.isTitleExist(client, company.id, productCollection.title, productCollection.id)
            if (isTitleExist) {
                throw new Error("Title already used")
            }

            const isSlugExist = await this.isSlugExist(client, company.id, productCollection.slug, productCollection.id)
            if (isSlugExist) {
                throw new Error("Slug already used")
            }

            if (productCollection.type == 'Auto') {
                const data: any = productCollection.data

                if (data.conditions && data.conditions.length == 0) {
                    throw new ValidationException("Condtions are required")
                }
                if (data.conditions) {
                    const checkTypeAndcondition = data.conditions.filter((f: any) => f.type == null || f.type == "" || f.condition == null || f.condition == "")
                    if (checkTypeAndcondition && checkTypeAndcondition.length > 0) {
                        throw new ValidationException("Condtion and type is required")
                    }
                }
            }
            const query: { text: string, values: any } = {
                text: `Update "ProductCollections" set "title"=$1,
                                                        "slug"=$2,
                                                        "translation"=$3,
                                                        "type"=$4,
                                                        "data"=$5,
                                                        description=$6,
                                                        "mediaId"=$7
                                                    WHERE id =$8
                                                        `,
                values: [productCollection.title, productCollection.slug, productCollection.translation, productCollection.type, productCollection.data, productCollection.description, productCollection.mediaId, productCollection.id]
            }

            await client.query(query.text, query.values);


            await client.query("COMMIT")
            

            await this.removeCacheCollection('Collection_' + company.id + '_' + data.slug)
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async removeCacheCollection(key: string) {
        try {
            let redisClient = RedisClient.getRedisClient();
            await redisClient.deletKey(key);
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getById(productCollectionId: string, company: Company) {
        try {


            const query = {
                text: `  SELECT "prodColl".id , "prodColl".type ,"prodColl".title , "prodColl"."translation", "prodColl".slug ,"prodColl".description ,
                        case 
                        when "prodColl".type = 'Manual' then 
                        data || jsonb_build_object('products', jsonb_agg(jsonb_build_object('productId'  , trim ('"' from ids::text)::uuid, 'productName', "Products".name)) )
                        else data
                        end as "data"
                        
                        FROM "ProductCollections"  as "prodColl"
                        LEFT JOIN jsonb_array_elements(data->'ids') as ids ON "prodColl".type = 'Manual'
                        LEFT JOIN "Products" ON "prodColl".type = 'Manual' AND "Products".id = (trim ('"' from ids::text)::uuid)
                        WHERE "prodColl".id = $1
                          AND "prodColl"."companyId" = $2
                        GROUP BY  "prodColl".id
                    `,
                values: [productCollectionId, company.id]
            }

            let collection = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", collection.rows[0])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getList(data: any, company: Company) {
        try {
            let companyId = company.id;
            let sort = data.sortBy;
            let sortValue = !sort ? '  "ProductCollections"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm

            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let offset = 0;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query = {
                text: `SELECT count(*) over(),
                             "ProductCollections".id,
                             "ProductCollections".title ,
                             "ProductCollections".slug,
                                              case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end as "mediaUrl"

                           FROM "ProductCollections"
                           left join "Media" on "Media".id = "ProductCollections"."mediaId"
                        where "ProductCollections"."companyId"=$1
                        and (LOWER("ProductCollections".slug) ~ $2 or LOWER("ProductCollections".title) ~ $2)
                        ${orderByQuery}
                        LIMIT $3 OFFSET $4`,
                values: [companyId, searchValue, limit, offset]

            }
            const selectList: any = await DB.excu.query(query.text, query.values)
            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)

            offset += 1
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
          
            throw new Error(error)
        }

    }
}