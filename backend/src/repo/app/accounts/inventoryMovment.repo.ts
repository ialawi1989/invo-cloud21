
import { DB } from '@src/dbconnection/dbconnection';
import { InventoryMovment } from '@src/models/account/InventoryMovment';
import { InventoryMovmentLine } from '@src/models/account/InventoryMovmentLine';
import { Company } from '@src/models/admin/company';
import { ResponseData } from '@src/models/ResponseData';
import { Helper } from '@src/utilts/helper';
import { PoolClient, QueryResult } from 'pg';
import { ProductRepo } from '../product/product.repo';
import { ValidationException } from '@src/utilts/Exception';
export class InventoryMovmentRepo {


    /**
     * Inventory Movment 
     * cost => COGS
     * Increase in qty => Credit *(-1)
     * Decrease in qty => Depit +
     * 
     * 
     * Inventory Movment line 
     * cost => Inventory Assets 
     * Increase in qty => Debit 
     * Decrease in qty => Credit *(-1) (qty and cost)
     */

    /**
     * 
     * @param qty 
     * @param cost 
     * @param lineId 
     * @param refrenceTable 
     * @param productId 
     * @param batch 
     * @param serial 
     * @param currentCost 
     * @param currentOnHand 
     */
    public static async createAndInsertMovment(client: PoolClient, data: any) {
        try {


            /**
             * cost < 0 =>(-) increase on onHand 
             * inventory movment => - (Credit)
             * iventory MovmentLine => + (Debit)
             
             * cost > 0 =>(+) decrease on onHand 
             * inventory movment => + (Debit)
             * iventory MovmentLine => -(Credit)
             */
            const movment = new InventoryMovment();
            movment.referenceId = data.lineId;
            movment.lineId = data.refrenceTable;
            movment.cost = data.cost;
            movment.branchId = data.branchId;
            movment.cost = data.cost;
            movment.employeeId = data.employeeId;

            const insertMovment = await this.insertMovment(client, movment)

            const movmentLine = new InventoryMovmentLine();
            movmentLine.cost = data.cost;
            movmentLine.qty = data.qty;
            movmentLine.cost = data.cost * (-1);
            movmentLine.qty = data.qty * (-1);

            movmentLine.productId = data.productId;
            movmentLine.batch = data.batch;
            movmentLine.serial = data.serial;
            movmentLine.currentCost = data.currentCost;
            movmentLine.currentOnHand = data.currentOnHand;
            movmentLine.inventoryMovmentId = insertMovment.id;


            await this.insertMovmentLine(client, movmentLine)

        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }

    //Insert Of Movment and Movment Line 
    public static async insertMovment(client: PoolClient, inventoryMovmnet: InventoryMovment) {
        try {

            const query: { text: string, values: any } = {
                text: `INSERT INTO "InventoryMovments" ("createdAt","inventoryMovmentDate","branchId","invoiceLineId",cost,"physicalCountLineId","inventoryTransferLineId","creditNoteLineId","billingLineId","supplierCreditLineId","employeeId","type", "adjustmentType") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12,$13) RETURNING id`,
                values: [new Date(), inventoryMovmnet.inventoryMovmentDate, inventoryMovmnet.branchId, inventoryMovmnet.invoiceLineId, inventoryMovmnet.cost, inventoryMovmnet.physicalCountLineId, inventoryMovmnet.inventoryTransferLineId, inventoryMovmnet.creditNoteLineId, inventoryMovmnet.billingLineId, inventoryMovmnet.supplierCreditLineId, inventoryMovmnet.employeeId, inventoryMovmnet.type, inventoryMovmnet.adjustmentType]
            }

            const insert = await client.query(query.text, query.values);
            const inventoryMovmentId = (<any>insert.rows[0]).id
            return { id: inventoryMovmentId };
        } catch (error: any) {
            console.log(error)
          


            throw new Error(error.message)
        }
    }
    public static async insertMovmentLine(client: PoolClient, inventoryMovmentLine: InventoryMovmentLine) {
        try {

            const query: { text: string, values: any } = {
                text: `INSERT INTO "InventoryMovmentLines" ("productId","inventoryMovmentId",qty,cost,"currentOnHand","currentCost",batch,serial,"parentChildId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
                values: [inventoryMovmentLine.productId, inventoryMovmentLine.inventoryMovmentId, inventoryMovmentLine.qty, inventoryMovmentLine.cost, inventoryMovmentLine.currentOnHand, inventoryMovmentLine.currentCost, inventoryMovmentLine.batch, inventoryMovmentLine.serial, inventoryMovmentLine.parentChildId]
            }

            const insert = await client.query(query.text, query.values);
            const inventoryMovmentLineId = (<any>insert.rows[0]).id
            return { id: inventoryMovmentLineId };
        } catch (error: any) {
          


            throw new Error(error.message)
        }
    }

    //For Billing 
    public static async updateMovmentCost(client: PoolClient, movmentId: string, cost: number) {
        try {

            const query: { text: string, values: any } = {
                text: `UPDATE "InventoryMovments" SET cost= $1 WHERE id =$2 `,
                values: [cost, movmentId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async updateMovmentLineCostQty(client: PoolClient, movmentLineId: string, cost: number, qty: number, currentOnHand: number, currentCost: number) {
        try {

            const query: { text: string, values: any } = {
                text: `UPDATE "InventoryMovmentLines" SET cost= $1 , qty=$2 ,"currentOnHand"=$3,"currentCost"=$4 WHERE id =$5 `,
                values: [cost, qty, currentOnHand, currentCost, movmentLineId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async deleteInventoryMovmentLine(client: PoolClient, movmentLineId: string, movmentId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `Delete from "InventoryMovmentLines" where id =$1   `,
                values: [movmentLineId]
            }
            await client.query(query.text, query.values)

            query.text = `SELECT COUNT(*) FROM "InventoryMovments" WHERE id=$1`
            query.values = [movmentId];

            const movment = await client.query(query.text, query.values);
            if (movment.rows[0].count > 0) {
                query.text = `delete from "InventoryMovments" WHERE id=$1`
                query.values = [movmentId];
                await client.query(query.text, query.values)
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getBranchProductOnHandByDate(productId: string, branchId: string, createdAt: Date | string) {
        try {

            const query: { text: string, values: any } = {
                text: `select sum(qty::text::numeric)::float as "currentOnHand"
                        from "InventoryMovmentRecords" 
                        where "productId"= $1 and "branchId" =$2 and "createdAt" < $3::timeStamp  `,
                values: [productId, branchId, createdAt]
            }
            const data = await DB.excu.query(query.text, query.values)
            const onHand = (data.rows && data.rows.length > 0) ? (<any>data.rows[0]).currentOnHand : 0
            return onHand

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getBranchProductUnitCostByDate(productId: string, branchId: string, createdAt: Date | string) {
        try {
            console.log("createddddddddddddd", createdAt)
            const query: { text: string, values: any } = {
                text: `select "cost" from "ProductCosts" 
                where "ProductCosts"."productId" = $1 and "ProductCosts"."branchId" =   $2 and "ProductCosts"."createdAt" <=  $3
                order by "createdAt" desc 
               limit 1 `
                ,

                values: [productId, branchId, createdAt]
            }
            console.log(query.values)
            const data = await DB.excu.query(query.text, query.values)
            console.log(data.rows)

            const ProductCosts = (data.rows && data.rows.length > 0) ? (<any>data.rows[0]).cost : 0
            console.log("hereee", ProductCosts)
            return ProductCosts

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async getManualAdjustmentProducts(data: any, company: Company) {
        try {
            const branchId = data.branchId;
            const categoryId = data.categoryId;
            const types = ['inventory']
            let filterQuery = ``
            let movmentCreatedAt = data.inventoryMovmentDate ? new Date(data.inventoryMovmentDate) : new Date()


            let selectQuery;
            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

            if (searchValue) {
                filterQuery = `and (LOWER("Products".name)  ~ ${searchValue}
                                        OR LOWER("Products".barcode)  ~ ${searchValue}
                                 )`
            }


            let countValues;

            let offset = 0;

            let count = 0;
            let pageCount = 0;

            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const countQuery = `select
                COUNT(*) 
            FROM "Products"
            INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id AND "BranchProducts"."branchId" = $1
            ${filterQuery}
      
              `

            selectQuery = `	
WITH prod AS (
                            SELECT 
                                "Products".id,
                                "Products".name,
                                "Products"."UOM",
                                "Products".type,
                                "Products"."unitCost",  
                                "BranchProducts"."onHand", 
                                "Categories".id AS "categoryId",
                                "Categories".name AS "categoryName", 
                                "BranchProducts"."branchId",
                                case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end as "mediaUrl",
                 
                                "Products".barcode
                            FROM "Products"
                            INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id AND "BranchProducts"."branchId" = $1
                            LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                            LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"
                            WHERE "Products".type = 'inventory'
                                AND "Products"."isDeleted" = false
                     ${filterQuery}
                                
                                       Limit $2 offset $3
                         

                        ), "onHand" as (
						select "prod".id, sum("qty"::text::numeric)::float as "onHand" from "prod" 
					    left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "prod".id and "InventoryMovmentRecords"."branchId" = "prod"."branchId" 						
						group by "prod".id
						),"unitCost" as(
						select distinct  on ("prod".id)  "prod".id , COALESCE("cost") as "unitCost" from "prod" 
					    left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "prod".id and "InventoryMovmentRecords"."branchId" = "prod"."branchId" 						
                         where "InventoryMovmentRecords"."qty" >0 
							order by "prod".id,"InventoryMovmentRecords"."createdAt" DESC 
						)
						
						select  "prod".*,"onHand"."onHand","unitCost"."unitCost" from "prod"
						left join "onHand" on "onHand"."id" = "prod".id
						left join "unitCost" on "unitCost"."id" = "prod".id						
            `

            const selectValues = [branchId, limit, offset]

            countValues = [branchId]

            let selectCount = await DB.excu.query(countQuery, countValues)
            count = Number((<any>selectCount.rows[0]).count)
            pageCount = Math.ceil(count / limit)
            offset += 1
            let lastIndex = ((page) * limit)



            const selectList: any = await DB.excu.query(selectQuery, selectValues)
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

    public static async getManualAdjustmentProductsByBarcodes(company: Company, branchId: string, products: string[]) {
        try {
            const query = `--sql
            WITH prod AS (
                SELECT 
                    p.id,
                    p.name,
                    p."unitCost",
                    p.barcode,
                    bp."branchId"
                FROM "Products" p
                INNER JOIN "BranchProducts" bp 
                    ON bp."productId" = p.id 
                AND bp."branchId" = $1
                WHERE  p."companyId" = $3 
                    AND p.type = 'inventory'
                    AND p."isDeleted" = FALSE
                    AND p.barcode = ANY($2)
                ), onHand AS (
                SELECT pr.id, SUM((imr."qty")::numeric)::float AS "onHand"
                FROM prod pr
                LEFT JOIN "InventoryMovmentRecords" imr
                    ON imr."productId" = pr.id 
                AND imr."branchId" = pr."branchId"
                GROUP BY pr.id
                ), unitCost AS (
                SELECT DISTINCT ON (pr.id)
                        pr.id, COALESCE(imr."cost") AS "unitCost"
                FROM prod pr
                LEFT JOIN "InventoryMovmentRecords" imr
                    ON imr."productId" = pr.id 
                AND imr."branchId" = pr."branchId"
                WHERE imr."qty" > 0
                ORDER BY pr.id, imr."createdAt" DESC
                )
                SELECT pr.id, pr.name,pr.barcode, uc."unitCost", oh."onHand"
                FROM prod pr
                LEFT JOIN onHand oh ON oh.id = pr.id
                LEFT JOIN unitCost uc ON uc.id = pr.id;
        `;

            const values = [branchId, products, company.id];

            const list: QueryResult<any> = await DB.excu.query(query, values);
            return new ResponseData(true, "", list.rows);
        } catch (error: any) {
            console.log(error)
          
            return new ResponseData(false, error, []);
        }
    }

    public static async getCompanyBranchIds(companyId: string) {
        try {
            const query: { text: string, values: any } = {

                text: `SELECT id from "Branches" where "companyId" = $1`,
                values: [companyId]
            }
            const list = await DB.excu.query(query.text, query.values);
            const branchIds: any = [];
            list.rows.forEach((element: any) => {
                branchIds.push(element.id)
            });
            return branchIds
        } catch (error: any) {
            console.log(error)
          
            return null
        }
    }
    //set ManualAdjustmentMovement
    public static async addManualAdjustmentMovement(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client();
        try {





            const companyId = company.id
            const afterDecimal = company.afterDecimal
            //validation
            // const validate = await InventoryTransfersValidations.inventoryTransfersValidation(data);
            // if (!validate.valid) {
            //     throw new ValidationException(validate.error);
            // }
            data.createdAt = new Date()
            const inventoryMovment = new InventoryMovment();
            inventoryMovment.ParseJson(data)
            inventoryMovment.inventoryMovmentDate = inventoryMovment.inventoryMovmentDate ?? new Date()

            //***********products type validation ***********/
            let productIds: string[] = [];
            inventoryMovment.lines.forEach((elem: any) => { if (elem.productId) productIds.push(elem.productId); })
            const types: any[string] = ["inventory"];
            inventoryMovment.createdAt = new Date()
            const isProductTypeValid = await ProductRepo.checkIfProductsTypeValid(client, productIds ?? [], types, companyId);
            if (!isProductTypeValid) {
                throw new ValidationException("Invalid Product Type")
            }

            // throw exeption => when there is non inventory products in the line 


            inventoryMovment.calculateTotal(afterDecimal)

            inventoryMovment.employeeId = employeeId;
            inventoryMovment.type = 'Manual Adjustment';
            inventoryMovment.createdAt = new Date();

            const insertInventoryMovment = await InventoryMovmentRepo.insertMovment(client, inventoryMovment);
            inventoryMovment.id = insertInventoryMovment.id;

            //add inventory Movment lines 
            for (let index = 0; index < inventoryMovment.lines.length; index++) {
                const element = inventoryMovment.lines[index];
                const inventoryMovmentLine = new InventoryMovmentLine();
                inventoryMovmentLine.ParseJson(element)
                inventoryMovmentLine.inventoryMovmentId = inventoryMovment.id;
                const currentData = await ProductRepo.getProductOnHandAndUnitCost(client, inventoryMovmentLine.productId ?? "", inventoryMovment.branchId);

                inventoryMovmentLine.currentCost = await this.getBranchProductUnitCostByDate(inventoryMovmentLine.productId ?? "", inventoryMovment.branchId, inventoryMovment.inventoryMovmentDate)// need to get cost from ProductCost ;
                inventoryMovmentLine.currentOnHand = await this.getBranchProductOnHandByDate(inventoryMovmentLine.productId ?? "", inventoryMovment.branchId, inventoryMovment.inventoryMovmentDate) ?? currentData.onHand



                if (inventoryMovment.adjustmentType == 'unitCost adjustment') { inventoryMovmentLine.qty = 0 }
                else { inventoryMovmentLine.cost = currentData.unitCost }


                inventoryMovmentLine.parentChildId = currentData.parentId

                if (inventoryMovmentLine.qty > 0) {// Increase 
                    inventoryMovmentLine.cost = inventoryMovmentLine.cost // Inventory Debit => when Increase in OnHand
                } else if (inventoryMovmentLine.qty < 0) {// Decrease 
                    inventoryMovmentLine.cost = inventoryMovmentLine.cost * (-1);
                }
                await InventoryMovmentRepo.insertMovmentLine(client, inventoryMovmentLine)
            }


            await client.query("COMMIT")
            return new ResponseData(true, "Added Successflly", { id: (<any>inventoryMovment.id), adjustmentType: inventoryMovment.adjustmentType })
        } catch (error: any) {
            await client.query("ROLLBACK")
            console.log(error)
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async editManualAdjustmentMovement(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            //validation
            const companyId = company.id;
            const afterDecimal = company.afterDecimal

            // const validate = await InventoryTransfersValidations.inventoryTransfersValidation(data);
            // if (!validate.valid) {
            //     throw new ValidationException(validate.error);
            // }

            const inventoryMovment = new InventoryMovment();
            inventoryMovment.ParseJson(data);
            let deletedLines = inventoryMovment.lines.filter((f) => f.isDeleted == true)

            if (deletedLines.length == inventoryMovment.lines.length) {
                throw new ValidationException("Inventory Movment must has at least one line")
            }

            //***********products type validation ***********/
            let productIds: string[] = [];
            inventoryMovment.lines.forEach((elem: any) => { if (elem.productId) productIds.push(elem.productId); })
            const types: any[string] = ["inventory"];

            const isProductTypeValid = await ProductRepo.checkIfProductsTypeValid(client, productIds ?? [], types, companyId);
            if (!isProductTypeValid) {
                throw new ValidationException("Invalid Product Type")
            }

            if (inventoryMovment.adjustmentType == 'unitCost adjustment') {
                throw new ValidationException("Cannot Edit on  UnitCost Adjustment Transactions")
            }

            inventoryMovment.calculateTotal(afterDecimal)
            inventoryMovment.employeeId = employeeId;
            inventoryMovment.type = 'Manual Adjustment';

            if (inventoryMovment.id == null || inventoryMovment.id == "") {
                throw new ValidationException("Inventory Movment ID Is Required ")
            }

            await client.query("BEGIN")

            const query: { text: string, values: any } = {
                text: `UPDATE "InventoryMovments" set cost =$1, "employeeId"=$2, "type"=$3 , "inventoryMovmentDate"=$4 WHERE id=$5 `,
                values: [inventoryMovment.cost,
                inventoryMovment.employeeId,
                inventoryMovment.type,
                inventoryMovment.inventoryMovmentDate,
                inventoryMovment.id
                ]
            }

            const insert = await client.query(query.text, query.values);
            //add inventory transfer lines 
            for (let index = 0; index < inventoryMovment.lines.length; index++) {
                const element = inventoryMovment.lines[index];

                const inventoryMovmentLine = new InventoryMovmentLine();
                inventoryMovmentLine.ParseJson(element)
                inventoryMovmentLine.inventoryMovmentId = inventoryMovment.id;
                if (element.isDeleted == true) {
                    await this.deleteInventoryMovmentLine(client, inventoryMovmentLine.id, inventoryMovmentLine.inventoryMovmentId)
                    continue;
                }

                console.log(inventoryMovmentLine)
                inventoryMovmentLine.currentCost = await this.getBranchProductUnitCostByDate(inventoryMovmentLine.productId ?? "", inventoryMovment.branchId, inventoryMovment.createdAt)// need to get cost from ProductCost ;
                const currentOnHand = await this.getBranchProductOnHandByDate(inventoryMovmentLine.productId ?? "", inventoryMovment.branchId, inventoryMovment.createdAt)
                inventoryMovmentLine.currentOnHand = currentOnHand ?? 0;


                if (inventoryMovmentLine.qty > 0)// Increase 
                {
                    inventoryMovmentLine.cost = inventoryMovmentLine.cost // Inventory Debit => when Increase in OnHand
                } else if (inventoryMovmentLine.qty < 0) {// Decrease 
                    inventoryMovmentLine.cost = inventoryMovmentLine.cost * (-1);
                }



                if (inventoryMovmentLine.id == "" || inventoryMovmentLine.id == null) {
                    const line = await InventoryMovmentRepo.insertMovmentLine(client, inventoryMovmentLine)
                    inventoryMovmentLine.id = line.id;
                } else {
                    await this.editMovmentLine(client, inventoryMovmentLine)
                }


            }


            await client.query("COMMIT")
            return new ResponseData(true, "Updated Successfully", { id: inventoryMovment.id, adjustmentType: inventoryMovment.adjustmentType })
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
          
            throw new Error(error.message)

        } finally {
            client.release()
        }
    }

    public static async editMovmentLine(client: PoolClient, inventoryMovmentLine: InventoryMovmentLine) {
        try {

            const query: { text: string, values: any } = {
                text:
                    ` UPDATE "InventoryMovmentLines" SET  qty=$1 ,
                                                            "cost"=$2 ,
                                                            "currentOnHand"=$3,
                                                            "currentCost"=$4
                                                           
                        WHERE id = $5
                          `,
                values: [inventoryMovmentLine.qty, inventoryMovmentLine.cost, inventoryMovmentLine.currentOnHand, inventoryMovmentLine.currentCost, inventoryMovmentLine.id]
            }

            const insert = await client.query(query.text, query.values);

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    //get ManualAdjustmentMovement
    public static async getManualAdjustmentMovementList(data: any, company: Company, branchList: []) {

        try {


            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? `and "InventoryMovments"."createdAt"::date >= '${filter.fromDate}'::date ` : ''
            const toDate = filter && filter.toDate ? `and "InventoryMovments"."createdAt"::date <= '${filter.toDate}'::date ` : ''

            let filterQuery = `Where "Branches"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                                AND ("InventoryMovments"."type" = 'Manual Adjusment' or   "InventoryMovments"."type" = 'Manual Adjustment')
                                ${fromDate}
                                ${toDate}
                                `

            if (searchValue) {
                filterQuery += `and LOWER("Branches".name) ~ ${searchValue}`
            }


            let sort = data.sortBy;
            let sortValue = !sort ? '"InventoryMovments"."createdAt"' : '"' + sort.sortValue + '"';

            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const counterQuery: { text: string, values: any } = {

                text: `select count(*)
                        from "InventoryMovments" 
                        inner join "Branches" on "Branches".id = "InventoryMovments"."branchId"
                        ${filterQuery}
                        `,
                values: [company.id, branches]
            }
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values)


            const query: { text: string, values: any } = {

                text: `select 
                        "InventoryMovments".*, 
                        "Branches".name as "branchName",
                        "Employees".name as "employeeName"
                        from "InventoryMovments" 
                        inner join "Branches" on "Branches".id = "InventoryMovments"."branchId"
                        left join "Employees" on "Employees".id = "InventoryMovments"."employeeId"
                        ${filterQuery}
                        ${orderByQuery}
                        limit $3 offset $4 `,
                values: [company.id, branches, limit, offset]
            }
            const selectList = await DB.excu.query(query.text, query.values)


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: (selectList.rows && selectList.rows.length > 0) ? selectList.rows : [],
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

    public static async getManualAdjustmentMovementById(movmentId: any, company: Company) {

        try {


            const query: { text: string, values: any } = {

                text: `SELECT
                "InventoryMovments".id,     
				"InventoryMovments"."createdAt",
				"InventoryMovments"."branchId",
                "InventoryMovments"."cost",
				"InventoryMovments"."adjustmentType",
				"InventoryMovments"."employeeId",
                "InventoryMovments".type,
                "InventoryMovments"."inventoryMovmentDate",
                "Branches".name as "branchName",
                "Employees".name as "employeeName",
                (SELECT json_agg(
                json_build_object('id',"InventoryMovmentLines".id,
								  'productId',"InventoryMovmentLines"."productId",
								  'inventoryMovmentId', "InventoryMovmentLines"."inventoryMovmentId",
								  'qty',"InventoryMovmentLines".qty,
                                  'cost',"InventoryMovmentLines"."cost",
                                  'currentCost',"InventoryMovmentLines"."currentCost",
                                  'cost',"InventoryMovmentLines"."cost",
                                  'productName',"Products".name,
                                  'UOM',"Products"."UOM",
                                  'barcode',"Products".barcode)
                )FROM "InventoryMovmentLines"
                 INNER JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
                 WHERE "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
                 
                 )
                 as "lines"
                 FROM "InventoryMovments"
                 INNER JOIN "Employees" on "InventoryMovments"."employeeId" ="Employees".id 
                 INNER JOIN "Branches" on "Branches".id = "InventoryMovments"."branchId"
                 where "InventoryMovments".id = $1
                 and "Branches"."companyId"=$2
                                 `,
                values: [movmentId, company.id]
            }


            const data = await DB.excu.query(query.text, query.values)



            let inventoryMovment = new InventoryMovment();
            inventoryMovment.ParseJson(data.rows[0]);

            for (let index = 0; index < inventoryMovment.lines.length; index++) {
                const element = inventoryMovment.lines[index];
                const currentOnHand = await this.getBranchProductOnHandByDate(element.productId ?? "", inventoryMovment.branchId, inventoryMovment.createdAt)
                element.currentOnHand = currentOnHand ?? 0;

            }


            return new ResponseData(true, "", inventoryMovment)


        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    //delete ManualAdjustmentMovement

    public static async deleteManualAdjustmentMovement(movmentId: string, employeeId: string) {
        try {

            let movmentLinesQuery = {
                text: `SELECT JSON_AGG("InventoryMovmentLines".id) as "ids" , "adjustmentType" FROM "InventoryMovmentLines" where "InventoryMovmentLines"."inventoryMovmentId" = $1`,
                values: [movmentId]
            }

            let movmentLineIds = await DB.excu.query(movmentLinesQuery.text, movmentLinesQuery.values);
            let lineIds = []
            let adjustmentType = "qty"
            if (movmentLineIds.rows && movmentLineIds.rows.length > 0) {
                lineIds = (<any>movmentLineIds.rows[0]).ids ?? []
                adjustmentType = (<any>movmentLineIds.rows[0]).adjustmentType ?? adjustmentType
            }


            const query: { text: string, values: any } = {
                text: `delete from "InventoryMovmentLines" using "InventoryMovments"
                where "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id 
                and  "InventoryMovments".id = $1 and "InventoryMovments".type = 'Manual Adjustment'   `,
                values: [movmentId]
            }
            await DB.excu.query(query.text, query.values)


            query.text = `delete from "InventoryMovments" 
                          where  "InventoryMovments".id = $1 and "InventoryMovments".type = 'Manual Adjustment'    `
            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", { ids: lineIds, adjustmentType: adjustmentType })

        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getManualAdjustmentMovementJournal(manualAdjustmentId: string) {
        try {

            const journalQuery = {
                text: `select sum("qty" * "cost") as "cost"  from "InventoryMovmentRecords" where "transactionId" = $1`,
                values: [manualAdjustmentId]
            }
            const defaultJournalData = await DB.excu.query(journalQuery.text, journalQuery.values)
            const defaultJournals = []
            if (defaultJournalData && defaultJournalData.rows && defaultJournalData.rows.length > 0) {
                const cost = +(<any>defaultJournalData.rows[0]).cost

                if (cost && cost != 0) {
                    const costData = {
                        accountType: "Costs Of Goods Sold",
                        debit: 0,
                        credit: 0,
                        dbTable: "Physical Count",
                        referenceId: manualAdjustmentId
                    }
                    const inevntoryData = {
                        accountType: "Inventory Assets",
                        credit: 0,
                        debit: 0,
                        dbTable: "Physical Count Note",
                        referenceId: manualAdjustmentId
                    }

                    if (cost < 0) {
                        costData.debit = Math.abs(cost)
                        inevntoryData.credit = Math.abs(cost)
                    } else {
                        inevntoryData.debit = Math.abs(cost)
                        costData.credit = Math.abs(cost)
                    }
                    defaultJournals.push(inevntoryData)
                    defaultJournals.push(costData)
                }

            }

            return new ResponseData(true, "", { defaultJournals: defaultJournals })
        } catch (error: any) {
            throw new Error(error)
        }
    }







} 