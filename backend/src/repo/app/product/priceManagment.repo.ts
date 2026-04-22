import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { PriceLabel } from "@src/models/product/PriceLabel";
import { PriceManagement } from "@src/models/product/PriceManagment";
import { ResponseData } from "@src/models/ResponseData";
import { PriceManagmentValidation } from "@src/validationSchema/product/PriceManagment.Schema";
import { PoolClient } from "pg";

import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketPriceManagment } from "@src/repo/socket/priceManagment.socket";
import { RedisClient } from '@src/redisClient';

export class priceManagmentRepo {

    public static async checkIfPriceLableNameExist(client: PoolClient, priceLabelId: string | null, name: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "PriceLabels" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
                values: [
                    name,
                    priceLabelId,
                    companyId,
                ],
            };
            if (priceLabelId == null) {
                query.text = `SELECT count(*) as qty FROM "PriceLabels" where LOWER(name) = LOWER($1) and "companyId" = $2`;
                query.values = [name, companyId];
            }

            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }

            return false;
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async validatePriceManagmentDate(client: PoolClient, priceManagmentId: string | null, company: Company, fromDate: Date, toDate: Date) {
        try {
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "PriceManagement"
                        where(( "fromDate"::date = $1::date or "toDate"::date= $2::date or("fromDate"::date>=$1::date and "fromDate"::date<$2::date)or ("toDate"::date>=$1::date and "toDate"::date<$2::date) ) and id <> $3) and "companyId" = $4`,
                values: [
                    fromDate,
                    toDate,
                    priceManagmentId,
                    companyId,
                ],
            };
            if (priceManagmentId == null) {
                query.text = `SELECT count(*) as qty FROM "PriceManagement" where "fromDate" = $1 or "toDate"= $2 or("fromDate">=$1 and "fromDate"<$2)or ("toDate">=$1 and "toDate"<$2)  and "companyId" = $3`;
                query.values = [fromDate, toDate, companyId];
            }

            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }

            return false;
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async checkIfPriceManagementTitleExist(client: PoolClient, priceManagmentId: string | null, title: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "PriceManagement" where LOWER(title) = LOWER($1) and id <> $2 and "companyId" = $3`,
                values: [
                    title,
                    priceManagmentId,
                    companyId,
                ],
            };
            if (priceManagmentId == null) {
                query.text = `SELECT count(*) as qty FROM "PriceManagement" where LOWER(title) = LOWER($1) and "companyId" = $2`;
                query.values = [title, companyId];
            }

            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }
//z
            return false;
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async addPriceLabel(client: PoolClient, data: any, company: Company) {
        try {
            const companyId = company.id;
            const validate = await PriceManagmentValidation.priceLabelValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error)
            }

            const priceLabel = new PriceLabel();
            priceLabel.ParseJson(data)
            priceLabel.companyId = companyId;
            priceLabel.updatedDate = new Date();
            const isNameExist = await this.checkIfPriceLableNameExist(client, null, priceLabel.name, companyId)
            if (isNameExist) {
                throw new ValidationException("Price Label name already Exist")
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "PriceLabels" (name,"companyId", "productsPrices","createdAt","optionsPrices","updatedDate") VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
                values: [priceLabel.name, priceLabel.companyId, JSON.stringify(priceLabel.productsPrices), priceLabel.createdAt, JSON.stringify(priceLabel.optionsPrices), priceLabel.updatedDate]
            }

            const label = await client.query(query.text, query.values);
            priceLabel.id = (<any>label.rows[0]).id
            const branchIds = await BranchesRepo.getCompanyBranchIds(client, priceLabel.companyId);
            await SocketPriceManagment.sendnewPriceLabel(priceLabel, branchIds)
            return new ResponseData(true, "", { id: (<any>label.rows[0]).id })
        } catch (error: any) {
          

            throw new Error(error)
        }
    }








    public static async setIdsFromBarcodes(client: PoolClient, data: any, company: Company) {
        try {
            let redisClient = RedisClient.getRedisClient();
            await redisClient.set("PriceLabelBulkImport" + data.id,true)
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT process_products( $1, $2);`,
                values: [data, companyId]
            }

            const label = await client.query(query.text, query.values);
            return label.rows[0];
        } catch (error: any) {
          

            throw new Error(error)
        }
    }




    public static async editPriceLabel(client: PoolClient, data: any, company: Company) {
        try {
        
            const companyId = company.id;
            const validate = await PriceManagmentValidation.priceLabelValidation(data);
            if (!validate.valid) {
                console.log(validate.error);
                throw new ValidationException(validate.error)
            }

            const priceLabel = new PriceLabel();
       
            priceLabel.ParseJson(data)
       
            priceLabel.companyId = companyId;
            priceLabel.updatedDate = new Date();

            const isNameExist = await this.checkIfPriceLableNameExist(client, priceLabel.id, priceLabel.name, companyId)
            if (isNameExist) {
                throw new ValidationException("Price Label name already Exist")
            }
            const query: { text: string, values: any } = {
                text: `UPDATE "PriceLabels" SET name=$1, "productsPrices"=$2, "updatedDate"=$3,"optionsPrices"=$4 WHERE id=$5`,
                values: [priceLabel.name, JSON.stringify(priceLabel.productsPrices), priceLabel.updatedDate, JSON.stringify(priceLabel.optionsPrices), priceLabel.id]
            }
            const branchIds = await BranchesRepo.getCompanyBranchIds(client, priceLabel.companyId);
            await SocketPriceManagment.sendUpdatedPriceLabel(priceLabel, branchIds)
            const label = await client.query(query.text, query.values);
            return new ResponseData(true, "", {})
        } catch (error: any) {
          
            console.error(error);
            throw new Error(error)
        }
    }
    public static async getPriceLabelList(data: any | null, company: Company) {
        try {
            const companyId = company.id;

            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }




            const countText = `select count(*)
            from "PriceLabels"`

            const selectText = `select  id,name 
            from "PriceLabels" `;


            let filterQuery = ` WHERE "PriceLabels"."companyId"=$1 `

            filterQuery += ` AND (LOWER ("PriceLabels".name) ~ $2)`

            const limitQuery = ` Limit $3 offset $4`
            let selectCount;
            let orderByQuery;
            selectQuery = selectText + filterQuery;
            selectValues = [companyId, searchValue]
            if (data != null && data != '' && JSON.stringify(data) != '{}') {

       
                sort = data.sortBy;
                sortValue = !sort ? '"PriceLabels"."createdAt"' : '"' + sort.sortValue + '"';

                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by ` + sortTerm;
                if (data.searchTerm != "" && data.searchTerm != null) {
                    searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
                }

                selectQuery = selectText + filterQuery + orderByQuery + limitQuery
                selectValues = [companyId, searchValue, limit, offset]
                countQuery = countText + filterQuery
                countValues = [companyId, searchValue]



                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }



            const selectList = await DB.excu.query(selectQuery, selectValues)



            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (selectList.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }


            const resData = {
                list: selectList.rows,
                count: +count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async getPriceLabelById(priceLabelId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select  "PriceLabels".id,  "PriceLabels".name, 
                                (select 
                                    jsonb_agg(elem ||jsonb_build_object('name', "Products".name, 'defaultPrice', "Products"."defaultPrice",
                                                                        'type', "Products".type, 'categoryName', "Categories"."name",
                                                                        'UOM', "Products"."UOM", 'barcode',"Products"."barcode"
                                            )) 
                                from jsonb_array_elements("productsPrices") as elem
                                left join "Products" on "Products".id = (elem ->>'productId')::uuid
                                left join "Categories" on "Categories".id = "Products"."categoryId"
                                ) as "productsPrices",
                                (select 
                                    jsonb_agg("optionPrice"::text::jsonb ||jsonb_build_object('name', "Options".name, 'defaultPrice', "Options"."price"))
                                from json_array_elements("optionsPrices") as "optionPrice"
                                left join "Options" on "Options".id = ("optionPrice" ->>'optionId')::uuid
                                ) as "optionsPrices"
                        from "PriceLabels" 
                        where "PriceLabels".id=$1`,
                values: [priceLabelId]
            }
            const labels = await DB.excu.query(query.text, query.values);
            const label = new PriceLabel();
            label.ParseJson(labels.rows[0])

            return new ResponseData(true, "", label)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addPriceManagement(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id;
            const validate = await PriceManagmentValidation.priceManagmentValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error)
            }

            const priceManagment = new PriceManagement();
            priceManagment.ParseJson(data)
            priceManagment.companyId = companyId;

            await client.query("BEGIN")
            const isNameExist = await this.checkIfPriceManagementTitleExist(client, null, priceManagment.title, companyId)
            if (isNameExist) {
                throw new ValidationException("Price  Managment already Exist")
            }

            const isDateUsed = await this.validatePriceManagmentDate(client, null, company, priceManagment.fromDate, priceManagment.toDate)
            if (isDateUsed) {
                throw new ValidationException("A price Managment Already Exist on the Same Interval Time Selected")
            }
            priceManagment.updatedDate = new Date();
            const query: { text: string, values: any } = {
                text: `INSERT INTO "PriceManagement" (title,
                                                     "companyId",
                                                     repeat,
                                                     "priceLabelId",
                                                     "branchIds",
                                                     "fromDate",
                                                     "toDate",
                                                     "chargeId",
                                                     "discountId",
                                                     "createdAt",
                                                     "repeatDays",
                                                     "fromTime",
                                                     "toTime",
                                                     "updatedDate") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
                values: [priceManagment.title,
                priceManagment.companyId,
                priceManagment.repeat,
                priceManagment.priceLabelId,
                JSON.stringify(priceManagment.branchIds),
                priceManagment.fromDate,
                priceManagment.toDate,
                priceManagment.chargeId,
                priceManagment.discountId,
                priceManagment.createdAt,
                priceManagment.repeatDays,
                priceManagment.fromTime,
                priceManagment.toTime]
            }

            const managment = await client.query(query.text, query.values);
            await client.query("COMMIT")

            return new ResponseData(true, "", { id: (<any>managment.rows[0]).id })
        } catch (error: any) {
            await client.query("ROLLBACK")

          

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async editPriceManagement(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id;
            const validate = await PriceManagmentValidation.priceManagmentValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error)
            }

            const priceManagment = new PriceManagement();
            priceManagment.ParseJson(data)
            priceManagment.companyId = companyId;
            await client.query("BEGIN")
            const isNameExist = await this.checkIfPriceManagementTitleExist(client, priceManagment.id, priceManagment.title, companyId)
            if (isNameExist) {
                throw new ValidationException("Price Label name already Exist")
            }


            const isDateUsed = await this.validatePriceManagmentDate(client, priceManagment.id, company, priceManagment.fromDate, priceManagment.toDate)
            if (isDateUsed) {
                throw new ValidationException("A price Managment Already Exist on the Same Interval Time Selected")
            }

            priceManagment.updatedDate = new Date();
            const query: { text: string, values: any } = {
                text: `UPDATE  "PriceManagement" SET title=$1,
                                                     repeat=$2,
                                                     "priceLabelId"=$3,
                                                     "branchIds"=$4,
                                                     "fromDate"=$5,
                                                     "toDate"=$6,
                                                     "chargeId"=$7,
                                                     "discountId"=$8,
                                                     "repeatDays"=$9,
                                                     "updatedDate"=$10,
                                                     "fromTime" = $11,
                                                     "toTime"=$12
                                                     WHERE id=$13`,
                values: [priceManagment.title,
                priceManagment.repeat,
                priceManagment.priceLabelId,
                JSON.stringify(priceManagment.branchIds),
                priceManagment.fromDate,
                priceManagment.toDate,
                priceManagment.chargeId,
                priceManagment.discountId,
                JSON.stringify(priceManagment.repeatDays),
                priceManagment.updatedDate,
                priceManagment.fromTime,
                priceManagment.toTime,
                priceManagment.id]
            }

            const managment = await client.query(query.text, query.values);
            await client.query("COMMIT")

            return new ResponseData(true, "", [])
        } catch (error: any) {
          
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getPriceManagmentById(priceManagmentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * From "PriceManagement"
                      where id =$1`,
                values: [priceManagmentId]
            }

            const price = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", price.rows[0])
        } catch (error: any) {
          

            throw new Error(error)
        }

    }
    public static async getPriceManagmentList(data: any, company: Company) {

        try {
            const companyId = company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue;
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }


            const countText = `select count(*)
            from "PriceManagement" `;
            const selectText = `select 
            "PriceManagement".id,
            title,
            repeat,
            "priceLabelId",
            "branchIds",
            "fromDate",
            "toDate",
            "fromTime",
            "toTime",
            "chargeId",
            "discountId" ,
            "Discounts".name as "discountName",
            "Surcharges".name as "chargeName"
            from "PriceManagement"
            LEFT JOIN "Discounts" on "Discounts".id = "PriceManagement". "discountId" 
            LEFT JOIN "Surcharges" ON  "Surcharges".id = "PriceManagement". "chargeId"`;
            const filterQuery = ` WHERE "PriceManagement"."companyId"=$1 `

            const searchQuery = ` AND (LOWER ("PriceManagement".title) LIKE $2
      OR LOWER("Discounts".name) like $2 
      OR LOWER("Surcharges".name) like $2)`

            let limitQuery = ` Limit $2 offset $3`
            let selectCount;
            let orderByQuery;
            selectQuery = selectText + filterQuery;
            selectValues = [companyId]
            if (data != null && data != '' && JSON.stringify(data) != '{}') {
                if (data.searchTerm) {
                    searchValue = '%' + data.searchTerm.trim().toLowerCase() + '%'
                }
                offset = data.page - 1
                sort = data.sortBy;
                sortValue = !sort ? '"PriceManagement"."createdAt"' : '"' + sort.sortValue + '"';

                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by ` + sortTerm;

                selectQuery = selectText + filterQuery + orderByQuery + limitQuery
                selectValues = [companyId, limit, offset]
                countQuery = countText + filterQuery
                countValues = [companyId]

                if (data.searchTerm != "" && data.searchTerm != null) {
                    orderByQuery = ` ORDER BY (LOWER("PriceManagement".title) like $2
                                          OR LOWER("Discounts".name) like $2 
                                          OR LOWER("Surcharges".name) like $2) DESC `
                    limitQuery = ` LIMIT $3 OFFSET $4`
                    selectQuery = selectText + filterQuery + searchQuery + orderByQuery + limitQuery
                    selectValues = [companyId, searchValue, limit, offset]
                    countQuery = countText + filterQuery + searchQuery
                    countValues = [companyId, searchValue]
                }

                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }


            const selectList = await DB.excu.query(selectQuery, selectValues)



            offset += 1
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



