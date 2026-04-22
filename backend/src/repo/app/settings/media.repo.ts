import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { S3Storage } from "@src/utilts/S3Storage";
import { MediaValidation } from "@src/validationSchema/media.Schema";

import { PoolClient } from "pg";

import { ValidationException } from "@src/utilts/Exception";
import format from "pg-format";
export class MediaRepo {

    public static async checkIfMediaNameExist(client: PoolClient, mediaId: null | string, name: string, companyId: string) {
        try {

            const nameString = '%' + name.toLowerCase() + '%'
            const query: { text: string, values: any } = {
                text: `SELECT name  FROM "Media" where 
                                LOWER(name) like $1 and "companyId" = $2
                                order by "Media"."createdAt" DESC limit 1`,
                values: [nameString, companyId]
            };

            const resault = await client.query(query.text, query.values);
            const copyNumber = "Copy-1";
            let mediaName;
            if (resault.rowCount != null && resault.rowCount > 0) {
                const regexp = new RegExp(/Copy-(\d+)\D*$/g)
                mediaName = (<any>resault.rows[0]).name;
                if (regexp.test(mediaName)) {
                    const number = Number(mediaName.split("Copy-")[1])

                    mediaName = name + 'Copy-' + (number + 1)
                } else {
                    mediaName = name + copyNumber
                }

                return mediaName;
            } else {

                return null
            }



        } catch (error: any) {
            console.log(error)



            throw new Error(error.message)
        }
    }

    //image-cropper 
    //   public static async importMedia(data: any, company: Company) {

    //     const client = await DB.excu.client(100);
    //     try {
    //         const companyId = company.id
    //         const ids: any[] = [];
    //         const validate = await MediaValidation.validateMedia(data);
    //         if (!validate.valid) {
    //             throw new ValidationException(validate.error);
    //         }

    //         //create folder for company if not exist 
    //         await S3Storage.createFolder(companyId);
    //         await client.query("BEGIN")
    //         for (let index = 0; index < data.length; index++) {

    //             const element: any = data[index];
    //             element.createdAt = new Date()

    //             element.name = element.name.split(".")[0];
    //             const isNameExist = await this.checkIfMediaNameExist(client, null, element.name, companyId);

    //             if (isNameExist != null) {
    //                 element.name = isNameExist;
    //             }
    //             const query: { text: string, values: any } = {
    //                 text: `INSERT INTO "Media" (name,"companyId","createdAt") VALUES($1,$2,$3) RETURNING id`,
    //                 values: [element.name, companyId, element.createdAt],
    //             }
    //             const insert = await client.query(query.text, query.values);
    //             const id = (<any>insert.rows[0]).id;
    //             ids.push(id)
    //             let media;

    //             media = await S3Storage.saveMediaImage(element.media, id, companyId, element.mediaType);
    //             if (media) {
    //                 query.text = `UPDATE "Media" SET url=$1,size=$2,"mediaType"=$3,"mediaSize"=$4 where id =$5`

    //                 query.values = [media.urls, media.size, element.mediaType, Number(media.size.size), id]
    //                 await client.query(query.text, query.values);
    //             }

    //         }

    //         await client.query("COMMIT")

    //         return new ResponseData(true, "", { lastId: ids })

    //     } catch (error: any) {
    //         console.log(error);
    //         client.query("ROLLBACK")
    //       

    //         throw new Error(error.message)

    //     } finally {
    //         client.release()
    //     }
    // }
    public static async importMedia(data: any, company: Company) {
        let currentMedia;
        const client = await DB.excu.client(100);
        try {
            const companyId = company.id
            const ids: any[] = [];
            const validate = await MediaValidation.validateMedia(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            //create folder for company if not exist 
            await S3Storage.createFolder(companyId);
            await client.query("BEGIN")
            // for (let index = 0; index < data.length; index++) {

            const element: any = data
            element.createdAt = new Date()

            element.name = element.name.split(".")[0];
            const isNameExist = await this.checkIfMediaNameExist(client, null, element.name, companyId);

            if (isNameExist != null) {
                element.name = isNameExist;
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Media" (name,"companyId","contentType","createdAt") VALUES($1,$2,$3,$4) RETURNING id`,
                values: [element.name, companyId, element.contentType, element.createdAt],
            }
            const insert = await client.query(query.text, query.values);
            const id = (<any>insert.rows[0]).id;
            ids.push(id)
            let media;
            currentMedia = id
            media = await S3Storage.saveMediaImage(element.media, id, companyId, element.mediaType);

            if (media) {
                query.text = `UPDATE "Media" SET url=$1,size=$2,"mediaType"=$3,"mediaSize"=$4 where id =$5`
                query.values = [media.urls, media.size, element.mediaType, Number(media.size.size), id]
                await client.query(query.text, query.values);
                if (media.urls == null || element.mediaType == null) {
                    throw new ValidationException("Error Uploading Media")
                }
            } else {
                throw new ValidationException("Error Uploading Media")
            }

            // }

            await client.query("COMMIT")

            return new ResponseData(true, "", { lastId: ids })

        } catch (error: any) {
            console.log(error);
            client.query("ROLLBACK")


            return new ResponseData(false, "", { mediaName: data.name, currentMedia: currentMedia })

        } finally {
            client.release()
        }
    }
    public static async editMedia(data: any, company: Company) {

        const client = await DB.excu.client();
        try {
            const companyId = company.id;
            data.updatedDate = new Date();
            await client.query("BEGIN")

            const media = await S3Storage.saveUpdatedImage(data.media, data.id, companyId);
            const query: { text: string, values: any } = {
                text: `UPDATE "Media" SET name=$1 ,"updatedDate"=$2 where id =$3`,
                values: [data.name, data.updatedDate, data.id]
            }
            await client.query(query.text, query.values);

            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error.message)

        } finally {
            client.release()
        }
    }


    public static async getMediaById(mediaId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "Media" where id = $1`,
                values: [mediaId]
            }
            const media: any = await DB.excu.query(query.text, query.values);
            let mediaUrls = media.rows[0].url;
            let url = mediaUrls.defaultUrl ?? mediaUrls.downloadUrl
            const mediaName = url.substring(url.lastIndexOf('/') + 1)
            const imageData = await S3Storage.getImageBase64(mediaName, media.rows[0].companyId)
            // let mediaUrl = await S3Storage.getImageUrl("5af111da-1c4e-4352-97a2-a5c08f82b4c2_Edited.jpg", media.rows[0].companyId)
            media.rows[0].media = imageData
            return new ResponseData(true, "", media.rows[0])



        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    // public static async getMediaList(data: any, company: Company) {
    //     try {


    //         const companyId = company.id;
    //         const mediaId = data.mediaId;

    //         const searchValue = data.searchTerm ? '%' + data.searchTerm.trim().toLowerCase() + '%' : '[A-Za-z0-9]*';


    //         let offset = data.page - 1
    //         const sort: any = data.sortBy;
    //         let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';

    //         const sortDirection = !sort ? "DESC" : sort.sortDirection;
    //         const sortTerm = sortValue + " " + sortDirection
    //         let mediaType = ['image', 'application']
    //         if (data.mediaType != null && data.mediaType != "") {
    //             mediaType = data.mediaType;
    //         }

    //         const page = data.page??1;
    //         const limit = ((data.limit == null) ? 15 : data.limit);
    //         if (page != 1) {
    //             offset = (limit * (page - 1))
    //         }

    //         const query : { text: string, values: any } = {
    //             text: `Select count(id) from "Media"
    //                 where "companyId"=$1
    //                 and REPLACE(("Media"."mediaType"->'fileType')::text, '"'::text, ''::text)::text  = any ($2)
    //                   `,
    //             values: [companyId, mediaType]
    //         }

    //         if (data.searchTerm != null && data.searchTerm != "") {
    //             query.text = `Select count(id) 
    //             from "Media" where "companyId"=$1
    //             and REPLACE(("Media"."mediaType"->'fileType')::text, '"'::text, ''::text)  = any ($2)
    //             and LOWER(name) LIKE $3
    //              `,
    //                 query.values = [companyId, mediaType, searchValue]
    //         }

    //         let count: any = await DB.excu.query(query.text, query.values);
    //         count = Number((<any>count.rows[0]).count)
    //         const pageCount = Math.ceil(count / data.limit)


    //         query.text = `Select url,name,size,"mediaType", id 
    //                    from "Media" where "companyId"=$1
    //                    and REPLACE(("Media"."mediaType"->'fileType')::text, '"'::text, ''::text)::text  = any ($2)
    //                    ORDER BY `+ sortTerm + `
    //                    LIMIT $3
    //                    OFFSET $4
    //                    `;
    //         query.values = [companyId, mediaType, limit, offset]


    //         if (mediaId != null && mediaId != "") {

    //             if (data.page == 1) {
    //                 query.text = `select url,name,size,"mediaType", id  from "Media"
    //             where "companyId" =$1
    //             and REPLACE(("Media"."mediaType"->'fileType')::text, '"'::text, ''::text) = any ($2)
    //             order by  (id = $3)  DESC ,
    //             "Media"."createdAt" DESC
    //             limit $4
    //             offset 0 
    //             `
    //                 query.values = [companyId, mediaType, mediaId, limit]
    //             } else {
    //                 query.text = `select url,name,size,"mediaType", id  from "Media"
    //                 where "companyId" =$1 
    //                 and REPLACE(("Media"."mediaType"->'fileType')::text, '"'::text, ''::text) = any ($2)
    //                 order by (id = $3) DESC,
    //                       "Media"."createdAt" DESC
    //                 limit $4
    //                 offset $5
    //                 `
    //                 query.values = [companyId, mediaType, mediaId, limit, offset]
    //             }

    //         }


    //         if (data.searchTerm != null && data.searchTerm != "") {

    //             query.text = `Select url,name,size,"mediaType", id 
    //             from "Media" where "companyId"=$1
    //             and REPLACE(("Media"."mediaType"->'fileType')::text, '"'::text, ''::text)  = any ($2)
    //             and LOWER(name) like $3
    //             ORDER BY `+ sortTerm + `
    //             LIMIT $4
    //              `,
    //                 query.values = [companyId, mediaType, searchValue, limit]

    //         }

    //         const temp: any[] = [];



    //         const list: any = await DB.excu.query(query.text, query.values)

    //         if (mediaId == "" || mediaId == null) {
    //             for (let index = 0; index < list.rows.length; index++) {
    //                 const element = list.rows[index];

    //                 let attach: any = await this.getMedialinkedToList(element.id);

    //                 attach = attach.data;

    //                 const isAttached = (attach.length > 0) ? true : false
    //                 if (isAttached) {
    //                     list.rows[index].uploadTo = attach;
    //                 } else {
    //                     list.rows[index].uploadTo = null;
    //                 }
    //             }
    //         }



    //         offset += 1
    //         let lastIndex = ((data.page) * data.limit)
    //         if (list.rows.length < data.limit || data.page == pageCount) {
    //             lastIndex = count

    //         }


    //         return new ResponseData(true, "", { list: list.rows, count: count, pageCount: pageCount, startIndex: offset, lastIndex: lastIndex })
    //     } catch (error: any) {
    //       

    //         throw new Error(error.message)
    //     }
    // }
    public static async getMediaList(data: any, company: Company) {
        try {
            const companyId = company.id;
            const mediaId = data.mediaId;
            const ids = data.selectedIds && data.selectedIds.length > 0 && data.page == 1 ? data.selectedIds : null;
            const searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[a-zA-Z0-9!@#$%^&*()-_+=]*$';

            let offset = data.page - 1
            const sort: any = data.sortBy;
            let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
            let outerValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';

            if (!ids) {
                if (data.mediaId != null && data.mediaId != "") {
                    sortValue = ` ("Media".id = ` + "'" + data.mediaId + "'" + ` )`
                    outerValue = ` ("media".id = ` + "'" + data.mediaId + "'" + ` )`
                }
            }

            const sortDirection = !sort ? "DESC" : sort.sortDirection;
            const sortTerm = sortValue + " " + sortDirection
            const outerSortTerm = outerValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm
            let outerOrderByQuery = ` Order by` + outerSortTerm

            let contentType;
            if (data.contentType != null && data.contentType != "") {
                contentType = data.contentType;
            }

            // ── NEW: read advanced filter params (all optional) ─────────────────
            const minSize = data.minSize != null && data.minSize !== '' ? Number(data.minSize) : null;
            const maxSize = data.maxSize != null && data.maxSize !== '' ? Number(data.maxSize) : null;
            const dateFrom = data.dateFrom || null;   // expects 'yyyy-MM-dd' or null
            const dateTo = data.dateTo || null;   // expects 'yyyy-MM-dd' or null

            const page = data.page ?? 1;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let selectedMedia: any[] = []

            if (ids) {
                const selectQuery = {
                    text: `
            select
                   url,
                   name,
                   size,
                   "mediaType",
                   "contentType",
                   "createdAt",
                   id
            from "Media"
            where "companyId" =$1
            and ($2::text[] is null or "contentType" = any ($2))
            and "id" = any($3)
            `,
                    values: [company.id, contentType, ids]
                }

                const medias = await DB.excu.query(selectQuery.text, selectQuery.values);
                selectedMedia = medias.rows
                console.log(selectedMedia)
            }

            // ── countByType — now respects search + size + date filters ──────────
            let countByType = null;
            if (data.includeCountByType === true) {
                const countByTypeQuery = {
                    text: `
            select "contentType", count(*) as count
            from "Media"
            where "companyId" = $1
            and (LOWER(name) ~ $2)
            and ($3::bigint IS NULL OR (size->>'size')::bigint >= $3)
            and ($4::bigint IS NULL OR (size->>'size')::bigint <= $4)
            and ($5::date   IS NULL OR "createdAt" >= $5::date)
            and ($6::date   IS NULL OR "createdAt" <  ($6::date + INTERVAL '1 day'))
            group by "contentType"
            `,
                    values: [companyId, searchValue, minSize, maxSize, dateFrom, dateTo]
                }

                const countByTypeResult = await DB.excu.query(countByTypeQuery.text, countByTypeQuery.values);
                countByType = countByTypeResult.rows.reduce((acc: any, row: any) => {
                    acc[row.contentType] = parseInt(row.count);
                    return acc;
                }, {});
            }

            const query = {
                text: `with media as (
            select count(*) over(),
                   url::text,
                   name,
                   size,
                   "mediaType",
                   "contentType",
                   "createdAt",
                   id
            from "Media"
            where "companyId" = $1
            and ($2::text[] is null or "contentType" = any ($2))
            and ( LOWER(name) ~ $3)
            and ($4::uuid[] IS NULL OR id <> ALL ($4::uuid[]))
            and ($7::bigint IS NULL OR (size->>'size')::bigint >= $7)
            and ($8::bigint IS NULL OR (size->>'size')::bigint <= $8)
            and ($9::date   IS NULL OR "createdAt" >= $9::date)
            and ($10::date  IS NULL OR "createdAt" <  ($10::date + INTERVAL '1 day'))
            ${orderByQuery}
            limit  $5
            offset $6
            ),"linkedTo" as (
            
            select "Products".id , "Products".name , 'Product' as reference ,"media".id as "mediaId"
                            from "Products" 
                            inner join  "media" on "Products"."mediaId" = "media".id
                            union 
                            select "Employees".id , "Employees".name , 'Employee' as reference ,"media".id as "mediaId"
                            from "Employees" 
                            inner join  "media" on "Employees"."mediaId" = "media".id
                            union 
                            select "Companies".id , "Companies".name , 'Company' as reference,"media".id as "mediaId"
                            from "Companies" 
                           inner join  "media" on "Companies"."mediaId" = "media".id
                                   union 
                            select "Categories".id , "Categories".name , 'Category' as reference,"media".id as "mediaId"
                            from "Categories" 
                           inner join  "media" on "Categories"."mediaId" = "media".id
                                 union 
                            select "Options".id , "Options".name , 'Option' as reference,"media".id as "mediaId"
                            from "Options" 
                           inner join  "media" on "Options"."mediaId" = "media".id
                               union 
                                 select "PaymentMethods".id , "PaymentMethods".name , 'PaymentMethod' as reference,"media".id as "mediaId"
                            from "PaymentMethods" 
                           inner join  "media" on "PaymentMethods"."mediaId" = "media".id
union 
                                 select "ProductCollections".id , "ProductCollections"."title" as "name" , 'ProductCollection' as reference,"media".id as "mediaId"
                            from "ProductCollections" 
                           inner join  "media" on "ProductCollections"."mediaId" = "media".id
            
            )
            
            select  "media".*,
           CASE WHEN COUNT("linkedTo") = 0 THEN NULL else
             JSON_AGG(json_build_object('id',"linkedTo".id,'name',"linkedTo".name, 'reference',"linkedTo"."reference")) end as "uploadTo"        
            from "media"
            left join "linkedTo" on "linkedTo"."mediaId" = "media".id
      
            group by "media".count,
                      "media".url,
                      "media".size,
                      "media".name,
                      "media"."mediaType",
                      "media"."contentType",
                      "media"."id",
                      "media"."createdAt"
                      ${outerOrderByQuery}
            `,
                values: [companyId, contentType, searchValue, ids, limit, offset, minSize, maxSize, dateFrom, dateTo]
            }

            const selectList = await DB.excu.query(query.text, query.values)

            let list: any[] = []

            for (let index = 0; index < selectList.rows.length; index++) {
                const element: any = selectList.rows[index];
                element.url = JSON.parse(element.url)

                list.push(element)
            }
            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData: any = {
                list: [...selectedMedia, ...list],
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (countByType !== null) {
                resData.countByType = countByType;
            }

            return new ResponseData(true, "", resData)

        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }
    }

    public static async getMedialinkedToList(mediaId: string) {
        try {
            const uploadTo: any[] = [];
            const query: { text: string, values: any } = {
                text: ` select "Products".id , "Products".name , 'Product' as reference
                from "Products" where "Products"."mediaId" =$1 or  "Products"."threeDModelId" = $1
                union 
                select "Employees".id , "Employees".name , 'Employee' as reference
                from "Employees" where "Employees"."mediaId" =$1
                union 
                select "Companies".id , "Companies".name , 'Company' as reference
                from "Companies" where "Companies"."mediaId" =$1
                union 
                select "Categories".id , "Categories".name , 'Category' as reference  
                from "Categories" 
                where "Categories"."mediaId" =$1
                union 
                select "Options".id , "Options".name , 'Option' as reference 
                from "Options" 
                  where "Options"."mediaId" =$1
                    union 
                select "PaymentMethods".id , "PaymentMethods".name , 'PaymentMethod' as reference 
                from "PaymentMethods" 
                  where "PaymentMethods"."mediaId" =$1

                    union 
                select "ProductCollections".id , "ProductCollections"."title" as "name" , 'PaymentMethod' as reference 
                from "ProductCollections" 
                  where "ProductCollections"."mediaId" =$1
                `,
                values: [mediaId]
            }
            const list = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", list.rows)

        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async unlinkMedia(data: any) {
        try {
            for (let index = 0; index < data.length; index++) {
                const element = data[index];

                const id = element.id;
                const reference = element.reference;
                switch (reference) {
                    case "Product":
                        await this.unLinkMedia("Products", id)
                        break;
                    case "Employee":
                        await this.unLinkMedia("Employees", id)
                        break;
                    case "Company":
                        await this.unLinkMedia("Companies", id)
                        break;
                    case "Category":
                        await this.unLinkMedia("Categories", id)
                        break;
                    case "Option":
                        await this.unLinkMedia("Options", id)
                        break;
                    case "PaymentMethod":
                        await this.unLinkMedia("PaymentMethods", id)
                        break;
                    case "ProductCollection":
                        await this.unLinkMedia("ProductCollections", id)
                        break;
                    default:
                        break;
                }
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }
    // private static async unlikProductMedia(productId: string) {
    //     try {
    //         const query: { text: string, values: any } = {
    //             text: `UPDATE "Products" set "mediaId" =$1 where id =$2`,
    //             values: [null, productId]
    //         }
    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error.message)
    //     }
    // }
    private static async unlikEmployeeMedia(employeeId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Employees" set "mediaId" =$1 where id =$2`,
                values: [null, employeeId]
            }
            await DB.excu.query(query.text, query.values)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    private static async unlikCompanyMedia(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" set "mediaId" =$1 where id =$2`,
                values: [null, companyId]
            }
            await DB.excu.query(query.text, query.values)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    private static async unLinkMedia(dbTable: string, id: string) {
        try {
            let extraFilter = ''
            if(dbTable == 'Products')
            {
                extraFilter = ` , "threeDModelId" = $1`
            }
            const query: { text: string, values: any } = {
                text: `UPDATE "${dbTable}" set "mediaId" =$1 ${extraFilter}  where id =$2`,
                values: [null, id]
            }
            await DB.excu.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getDeafultImge(mediaId: string, company: Company) {
        try {
            const companyId = company.id;

            const query: { text: string, values: any } = {
                text: `select "mediaType" from "Media" where id =$1 `,
                values: [mediaId]
            }
            let type: any = await DB.excu.query(query.text, query.values);

            type = (<any>type.rows[0]).mediaType.extension;
            const extension = (type == 'jpeg') ? 'jpg' : type
            const defaultImage = await S3Storage.getDefaultImageBase64(mediaId, companyId, extension)
            return new ResponseData(true, "", defaultImage)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    public static async deleteMedia(data: any, company: Company) {
        try {
            const companyId = company.id;
            const mediaId = data.mediaId;
            const mediaType = data.mediaType;
            const extention = mediaType ? mediaType.extension : null

            const unlinkList = await this.getMedialinkedToList(mediaId);
            await this.unlinkMedia(unlinkList.data);

            const query: { text: string, values: any } = {
                text: `Delete from "Media" where id =$1`,
                values: [mediaId]
            }

            await DB.excu.query(query.text, query.values)


            await S3Storage.deleteImage(mediaId, companyId, extention)
            return new ResponseData(true, "", [])
        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }



    public static async setAttchments(data: any, company: Company) {
        try {
            let tableName;


            let reference = data.type;

            let id = data.id;
            let attachment = data.attachment;
            if (attachment == null || attachment.length == 0) {
                throw new ValidationException("No Attchment is Uploaded")
            }

            let attachmentTemps = []
            attachment.forEach((element: any) => {
                attachmentTemps.push({ id: element.id })
            });
            switch (reference) {
                case "invoice":
                    tableName = "Invoices"
                    break;
                case "bill":
                    tableName = "Billings"
                    break;
                case "invoicePayment":
                    tableName = "InvoicePayments"
                    break;
                case "billPayment":
                    tableName = "BillingPayments"
                    break;
                case "creditNote":
                    tableName = "CreditNotes"
                    break;
                case "supplierCredit":
                    tableName = "SupplierCredits"
                    break;
                case "journal":
                    tableName = "Journals"
                    break;
                case "expense":
                    tableName = "Expenses"
                    break;
                case "reconciliation":
                    tableName = "Reconciliations"
                    break;
                case "estimate":
                    tableName = "Estimates"
                    break;
                case "billOfEntry":
                    tableName = "BillOfEntries"
                    break;
                default:
                    break;
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "${tableName}" SET "attachment"=$1 where id=$2`,
                values: [JSON.stringify(attachment), id]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "Added Successfully", [])
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async getAttchments(data: any, company: Company) {
        try {
            let tableName;


            let reference = data.type;

            let id = data.id;

            switch (reference) {
                case "invoice":
                    tableName = "Invoices"
                    break;
                case "bill":
                    tableName = "Billings"
                    break;
                case "invoicePayment":
                    tableName = "InvoicePayments"
                    break;
                case "billPayment":
                    tableName = "BillingPayments"
                    break;
                case "creditNote":
                    tableName = "CreditNotes"
                    break;
                case "supplierCredit":
                    tableName = "SupplierCredits"
                    break;
                case "journal":
                    tableName = "Journals"
                    break;
                case "expense":
                    tableName = "Expenses"
                    break;
                case "reconciliation":
                    tableName = "Reconciliations"
                    break;
                case "estimate":
                    tableName = "Estimates"
                    break;
                case "billOfEntry":
                    tableName = "BillOfEntries"
                    break;
                default:
                    break;
            }

            const query: { text: string, values: any } = {
                text: `select 
                    case when  "attachment" = 'null' then  null else  (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("attachment") as attachments(attachments)
                inner join "Media" on "Media".id = (attachments->>'id')::uuid
                ) end as  "attachment"

                from "${tableName}" 
                 where id=$1`,
                values: [id]
            }

            let attachments = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", attachments.rows[0])
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async deleteAttchments(data: any, company: Company) {
        try {
            let tableName;


            let reference = data.type;
            let id = data.id;
            let mediaId = data.mediaId;



            switch (reference) {
                case "invoice":
                    tableName = "Invoices"
                    break;
                case "bill":
                    tableName = "Billings"
                    break;
                case "invoicePayment":
                    tableName = "InvoicePayments"
                    break;
                case "billPayment":
                    tableName = "BillingPayments"
                    break;
                case "creditNote":
                    tableName = "CreditNotes"
                    break;
                case "supplierCredit":
                    tableName = "SupplierCredits"
                    break;
                case "journal":
                    tableName = "Journals"
                    break;
                case "expense":
                    tableName = "Expenses"
                    break;
                case "reconciliation":
                    tableName = "Reconciliations"
                    break;
                case "estimate":
                    tableName = "Estimates"
                    break;
                case "billOfEntry":
                    tableName = "BillOfEntries"
                    break;
                default:
                    break;
            }

            const query = {
                text: `with "attachment" as (select "${tableName}".id, JSON_AGG(el) filter (where (el->>'id')::uuid <> $2) as "attachmentTemp" from  "${tableName}"
                                            inner join jsonb_array_elements("attachment") el on true
                                            where "${tableName}".id = $1
                                            group by  "${tableName}".id)

                                            update "${tableName}" set "attachment" = t."attachmentTemp" from (select * from "attachment") t
                                            where  "${tableName}".id = t.id `,
                values: [id, mediaId]
            }

            await DB.excu.query(query.text, query.values)

            const media = (await DB.excu.query('select "mediaType" from "Media" where id = $1', [mediaId]))
            const mediaType = (<any>media.rows[0]).mediaType

            let deleteData = {
                mediaId: mediaId,
                mediaType: mediaType
            }
            await this.deleteMedia(deleteData, company)

            return new ResponseData(true, "Added Successfully", [])
        } catch (error: any) {

            throw new Error(error)
        }
    }


    public static async getProductForMedia(data: any, companyId: string) {
        try {

            const page = data.page ?? 1;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let offset = page - 1
            const searchValue = data.searchTerm ? `%` + data.searchTerm.toLowerCase().trim() + '%' : null

            const query = {
                text: `SELECT
                        count(*) OVER() AS count,
                        p.id,
                        p.name,
                        (
                            SELECT json_agg(
                                    jsonb_build_object(
                                        'id', m.id,
                                        'defaultUrl', m."url"->>'defaultUrl'
                                    ) ORDER BY elem.index
                                ) AS "productMedia"
                            FROM json_array_elements_text(p."productMedia") WITH ORDINALITY AS elem(value, index)
                            INNER JOIN "Media" m ON m.id = elem.value::uuid
                        ) AS "mediaIds"
                    FROM "Products" p
                    WHERE p."companyId" = $1
                    and p."isDeleted" = false   
                    AND ($2::text is null or p.name ilike $2)
                    order by p."createdAt" DESC
                    limit $3
                    offset $4
                    `,
                values: [companyId, searchValue, limit, offset]
            }


            const products = await DB.excu.query(query.text, query.values)
            const count = products.rows && products.rows.length > 0 ? Number((<any>products.rows[0]).count) : 0
            const pageCount = Math.ceil(count / limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (products.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: products.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            return new ResponseData(true, "", resData)

        } catch (error) {
            throw error
        }
    }


    public static async setMedia(data: any, company: Company) {
        try {

            const chunkSize = 100;

            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);

                const transactionValues = chunk.map((item: any) => [
                    item.mediaIds[0],                 // mediaId
                    JSON.stringify(item.mediaIds),    // productMedia
                    item.productId,                   // product id
                    company.id                         // company id
                ]);

                const queryText = `
                        UPDATE "Products" AS p
                        SET 
                            "mediaId" = v."mediaId"::uuid,
                            "productMedia" = v."productMedia"::jsonb
                        FROM (VALUES %L) AS v("mediaId", "productMedia", "id", "companyId")
                        WHERE p.id = v.id::uuid AND p."companyId" = v."companyId"::uuid
                        RETURNING p.id, p."mediaId";
                        `;

                const formattedQuery = format(queryText, transactionValues);

                const result = await DB.excu.query(formattedQuery);
            }

            return new ResponseData(true, "Media linked to products successfully", [])
        } catch (error) {
            throw error
        }
    }

}