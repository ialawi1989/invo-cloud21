import { DB } from "@src/dbconnection/dbconnection";
import { Category } from "@src/models/product/Category";
import { ResponseData } from "@src/models/ResponseData";
import { CategoryValidation } from "@src/validationSchema/product/category.Schema";

import { DepartmentRepo } from "./department.repo";


import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { ValidationException } from "@src/utilts/Exception";
import { S3Storage } from "@src/utilts/S3Storage";
export class CategoryRepo {

    public static async checkCategoryNameExist(client:PoolClient,id: string | null, name: string, companyId: string) {
       
   
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Categories" where id <> $1 and LOWER(name) = LOWER($2) and "companyId" = $3 `,
            values: [
                id,
                name,
                companyId,

            ],
        };

        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "Categories" where  LOWER(name) = LOWER($1) and "companyId" = $2 `
            query.values = [name,
                companyId]
        }
        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }
        return false;
    }






    public static async updateTranslation(data: any) {
        try {
            const query : { text: string } = {
                text: `UPDATE "Categories" SET  translation=$2 WHERE id=$1;`
            }
    
            data.list.forEach(async (element: { id: any; translation: any; }) => {
                await DB.excu.query(query.text, [element.id, element.translation]);
            });
            
            return new ResponseData(true, "nope", [])
        } catch (error: any) {
    
            console.log(error);
          
            throw new Error(error)
        }
    }
    
    
    






    public static async getLastIndex(client:PoolClient,companyId:string){
        try {
            const query : { text: string, values: any } = {
                text:`select max(index) as "maxIndex" from "Categories"
                where "companyId" =$1`,
                values:[companyId]
            }

            let payment = await client.query(query.text,query.values);
            if(payment.rows&&payment.rows.length>0)
            { 
                return (<any>payment.rows[0]).maxIndex
            }else{
               return null
            }
        } catch (error:any) {
            throw new Error(error)
        }
    }
    public static async addCategory(client: PoolClient, data: any, company: Company) {
        try {
            const companyId = company.id;
            const validate = await CategoryValidation.categoreSchema(data);
            if (!validate.valid) {
                return new ResponseData(false, validate.error, [])
            }


            const category = new Category();
            category.ParseJson(data);
            category.companyId = companyId;
            if (category.departmentId) {
                const isDepartmentIdExist = await DepartmentRepo.checkDepartmentIdExist(client, category.departmentId, category.companyId);
                if (!isDepartmentIdExist) {
                    throw new ValidationException("Department Id dosnt Exist")
                }
            }


            const isCategoryNameExist = await this.checkCategoryNameExist(client,null, category.name, category.companyId);
            if (isCategoryNameExist) {
                throw new ValidationException('Category Name Already Used')
            }

            let Index = await this.getLastIndex(client,companyId);
            if(Index!=null)
            {
                category.index  = Index +1

            }else{
                category.index = 0;
            }
            const query : { text: string, values: any } = {
                text: 'INSERT INTO public."Categories"(name, "departmentId", "companyId","mediaId","translation","index") VALUES($1, $2,$3,$4,$5,$6) RETURNING id ',
                values: [category.name, category.departmentId, category.companyId, category.mediaId,category.translation,category.index],
            };
            const add = await client.query(query.text, query.values);
            return new ResponseData(true, "", { id: (<any>add.rows[0]).id })
        } catch (error: any) {
            console.log(error)
          
           throw new Error(error)
        }
    }
    public static async editCategory(client: PoolClient, data: any, company: Company) {

        try {


            const companyId = company.id;
            const validate = await CategoryValidation.categoreSchema(data);
            if (!validate.valid) {
                return new ResponseData(false, validate.error, [])
            }

            if (data.id == null || data.id == "") {
                throw new ValidationException("Category id Is Required")
            }
            const category = new Category();
            category.ParseJson(data);
            category.companyId = companyId;
            if (category.departmentId) {
                const isDepartmentIdExist = await DepartmentRepo.checkDepartmentIdExist(client, category.departmentId, category.companyId);
                if (!isDepartmentIdExist) {
                    throw new ValidationException("Department Id dosnt Exist")
                }
            }

            const isCategoryNameExist = await this.checkCategoryNameExist(client,category.id, category.name, category.companyId);
            if (isCategoryNameExist) {
                throw new ValidationException("Categroy name already used ")
            }
            const query : { text: string, values: any } = {
                text: `UPDATE "Categories" SET name=$1, "departmentId"=$2,"mediaId"=$3 ,"translation"=$4 WHERE id=$5 AND "companyId"=$6`,
                values: [category.name, category.departmentId, category.mediaId,category.translation, category.id, category.companyId],
            };
            const edit = await client.query(query.text, query.values);


            return new ResponseData(true, "Updated Successfully", null);
        } catch (error: any) {


          
            throw new Error(error)
        }
    }
    public static async getCategory(categoryId: string, company: Company) {
        try {

            const companyId = company.id;
            const query : { text: string, values: any } = {
                text: `SELECT "Categories".*, 
                              "Media".url as "mediaUrl"
                        FROM "Categories"
                        left join "Media" on   "Categories"."mediaId" = "Media".id 
                        WHERE "Categories".id=($1) AND 
                        "Categories"."companyId"= $2`,
                values: [categoryId, companyId],
            };

            const category = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", category.rows[0]);
        } catch (error: any) {
            
          
          throw new Error(error)
        }
    }
    public static async getCategoryList(data:any,company: Company) {
        try {
            const companyId = company.id;
            const departmentId = data.departmentId??null;
            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
            let page = data.page??1;
            let offset =0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            let sort = data.sortBy;
            let sortValue = !sort ? ' "Categories"."index"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " ASC " : sort.sortDirection;
 
            if (data.categoryId != null && data.categoryId != "") {
                sortValue = ` ("Categories".id = ` + "'" + data.categoryId + "'" + ` )`
            }
        
             let sortTerm = sortValue + " " + sortDirection;
             let orderByQuery = " ORDER BY " + sortTerm
            const query : { text: string, values: any } = {
                text: `SELECT Count(*)over(),
                          "Categories".name,"Categories".id,"Categories"."translation",
                            case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end as "mediaUrl"

                              FROM "Categories" 
                              LEFT JOIN "Media" on "Media".id = "Categories"."mediaId"
                               WHERE "Categories"."companyId"=($1) 
                               AND (LOWER("Categories".name) ~ $2)
                               AND ($3::uuid is null  OR   "Categories"."departmentId" =$3)
                               ${orderByQuery}
                               limit $4
                               offset $5
                               `,
                values: [companyId,searchValue,departmentId,limit,offset],
            };

               let list = await DB.excu.query(query.text, query.values);
            let count = list.rows && list.rows.length>0 ? Number((<any>list.rows[0]).count) :0
           let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (list.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            const resData = {
                list: list.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true,"",resData)
        } catch (error: any) {
          
          throw new Error(error)
        }

    }
    public static async getCategoryListFilter(data: any, companyId: string) {
        try {
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

            const selectText = `SELECT name  FROM "Categories"`;
            const countText = `SELECT COUNT(*) FROM "Categories"`;

            let filterQuery = ` where "companyId"=$1`;
            filterQuery += ` and (LOWER("Categories".name) ~ $2) `
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
          
            return new ResponseData(false, error, null)
        }
    }
    public static async getDepartmnetsCategory(company: Company) {
        try {
            const companyId = company.id;
            const query : { text: string, values: any } = {
                text: `SELECT 
                Departments."name",
                Departments.id,
                (
                                                   SELECT json_agg(json_build_object('id',id,'name',"name"))
                                                   FROM "Categories" 
                                                   WHERE "Categories". "departmentId" = Departments.id
                                                   ) AS Categories
                FROM "Departments" AS Departments
                where Departments."companyId" = $1`,
                values: [companyId],
            };

            const list = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", list.rows);
        } catch (error: any) {
          
          throw new Error(error)
        }
    }
    public static async getCategoryIdByName(client:PoolClient,categoryName: string, companyId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT id from "Categories" where LOWER(name) = LOWER($1) and "companyId" = $2`,
                values: [categoryName, companyId]
            }

            const category = await client.query(query.text, query.values);
            if (category.rowCount != null && category.rowCount > 0) {
                return { id: (<any>category.rows[0]).id }
            } else {
                return { id: null }
            }
        } catch (error: any) {
            throw new Error(error.message)
        }
    }
    public static async getCategories(branchId: string, date: any | null = null) {

        const client = await DB.excu.client();
        try {
            /**Begin */
            await client.query("BEGIN");

            const companyId: any = (await BranchesRepo.getBranchCompanyId(client,branchId)).compayId;

            const query : { text: string, values: any } = {
                text: `SELECT "Categories".*,
                "Media".url as "mediaUrl"
                 FROM "Categories" 
                 LEFT JOIN "Media" on "Media".id = "Categories"."mediaId"
                      WHERE "Categories"."companyId" = $1`,
                values: [companyId]
            }

            if (date != null) {
                query.text = `SELECT "Categories".*,
                "Media".url as "mediaUrl"
                 FROM "Categories" 
                LEFT JOIN "Media" on "Media".id = "Categories"."mediaId"

                WHERE "Categories"."companyId" = $1 and ("Categories"."createdAt">=$2 or "Categories"."updatedDate">=$2)`
                query.values = [branchId, date]
            }

            const list = await client.query(query.text, query.values);
            for (let index = 0; index < list.rows.length; index++) {
                const newData: any = list.rows[index];

                if (newData.mediaId != null && newData.mediaId != "" && newData.mediaUrl && newData.mediaUrl.defaultUrl) {
                    const mediaName = newData.mediaUrl.defaultUrl.substring(newData.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                    let imageData: any = await S3Storage.getImageUrl(mediaName, newData.companyId)

                    if (imageData) {
                        // imageData = imageData.split(';base64,').pop();
                        (<any>list.rows[index]).imageUrl = imageData
                    }

                }

            }
                        /**Commit */

            await client.query("COMMIT")
            return new ResponseData(true, "", list.rows)
        } catch (error: any) {
            console.log(error)
              /**ROLLBACK */
            await client.query("ROLLBACK")
          

            throw new Error(error.message)
        }finally{
                 /**release */
            client.release()
        }
    }

    public static async unsetCategoriesProducts(client:PoolClient,categoryIds:any[])
    {
        try {
            const query={
                text:`UPDATE "Products" set "categoryId"=null where "categoryId"=any($1)`,
                values:[categoryIds]
            }

            await client.query(query.text,query.values)
        } catch (error:any) {
            throw new Error(error)
        }
    }

    public static async deleteCategories(client:PoolClient,categoryIds:any[])
    {
        try {
            const query={
                text:`UPDATE "Products" set "categoryId"=null where "categoryId"=any($1)`,
                values:[categoryIds]
            }

            await client.query(query.text,query.values)
        } catch (error:any) {
            throw new Error(error)
        }
    }
    public static async deleteCategory(categoryId:string){
        const client = await DB.excu.client();
        try {
            
            await client.query("BEGIN")
            await this.deleteCategories(client,[categoryId])
            const query={
                text:`DELETE FROM "Categories" where id =$1`,
                values :[categoryId]
            }
            await client.query(query.text,query.values)

            await client.query("COMMIT")
            return new ResponseData(true,"",[])
        } catch (error:any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        }finally{
            client.release()
        }
    }

    
    public static async rearrangeCategories(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let updateDate = new Date()

            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                let query = `UPDATE "Categories" set index=$1,"updatedDate"=$2 where id=$3`;
                let values = [element.index,updateDate, element.id];

                await client.query(query, values)
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }
}