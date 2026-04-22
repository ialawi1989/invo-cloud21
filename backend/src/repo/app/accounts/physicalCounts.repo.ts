import { DB } from "@src/dbconnection/dbconnection";

import { PhysicalCount } from "@src/models/account/PhysicalCount";
import { PhysicalCountLine } from "@src/models/account/PhysicalCountLine";
import { ResponseData } from "@src/models/ResponseData";
import { PhysicalCountValidations } from "@src/validationSchema/account/physicalCount.Schema";
import { PoolClient } from "pg";
import { ProductRepo } from "../product/product.repo";

import { InventoryMovmentRepo } from "./InvoiceInventoryMovment.repo";





import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";
import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";
import { Helper } from "@src/utilts/helper";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class PhysicalCountRepo {

    /**
     * 
     * @param data 
     * @param employeeId 
     * @param company 
     * @returns 
     * 
     * Product Types [inventory,batch,serial]
     * 
     * status: [calculated, open , closed]
     * 
     */
    public static async addNewPhysicalCount(data: any, employeeId: string, company: Company) {

        const client = await DB.excu.client();
        const afterDecimal = company.afterDecimal
        try {
            await client.query("BEGIN")
            const validate = await PhysicalCountValidations.physicalCountValidation(data);
            if (!validate.valid) {

                throw new ValidationException(validate.error);
            }

            const physicalCount = new PhysicalCount();
            physicalCount.ParseJson(data);



            if (physicalCount.status == 'Calculated') {
                physicalCount.calculatedDate = new Date();
                physicalCount.calculatedEmployeeId = employeeId;
                physicalCount.createdEmployeeId = employeeId;
            } else if (physicalCount.status == 'Closed') {
                physicalCount.closedDate = new Date()
                physicalCount.closedEmployeeId = employeeId;
                physicalCount.createdEmployeeId = employeeId;
            } else if (physicalCount.status == 'Open') {
                physicalCount.createdEmployeeId = employeeId;
                physicalCount.closedEmployeeId = null;
                physicalCount.calculatedEmployeeId = null;
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "PhysicalCounts" (reference,status,note,type,"createdEmployeeId","branchId","calculatedEmployeeId",  "closedEmployeeId", "calculatedDate", "closedDate" ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
                values: [physicalCount.reference, physicalCount.status, physicalCount.note, physicalCount.type, physicalCount.createdEmployeeId, physicalCount.branchId, physicalCount.calculatedEmployeeId, physicalCount.closedEmployeeId, physicalCount.calculatedDate, physicalCount.closedDate]
            }

            const insert = await client.query(query.text, query.values);



            physicalCount.id = (<any>insert.rows[0]).id;

            for (let index = 0; index < physicalCount.lines.length; index++) {
                const element = physicalCount.lines[index];
                const temp = new PhysicalCountLine();
                temp.ParseJson(element);
                temp.physicalCountId = physicalCount.id;

                const productData = await ProductRepo.getProductOnHandAndUnitCost(client, temp.productId, physicalCount.branchId);
                temp.expectedQty = Number(productData.onHand)
                temp.unitCost = Number(productData.unitCost);
                const insertPhysicalCount = await this.addPhysicalCountLine(client, temp, physicalCount.branchId);
                temp.id = insertPhysicalCount.id;

                if (temp.serials && temp.serials.length > 0) {
                    await this.addSerialLines(client, physicalCount, temp, company)
                } else if (temp.batches && temp.batches.length > 0) {
                    await this.addBatchLines(client, physicalCount, temp, company)

                }


                if (physicalCount.status == 'Closed') {
                    await this.commit(client, temp, physicalCount.branchId, afterDecimal, employeeId)
                }
            }
            await client.query("COMMIT")
            return new ResponseData(true, "Added Successfully", { id: physicalCount.id })

        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async addSerialLines(client: PoolClient, physicalCount: PhysicalCount, line: PhysicalCountLine, company: Company) {
        try {

            // let serials = line.serials.filter((f:any)=>f.isAvailable==false || f.isAvailable == null || f.isAvailable == undefined)
            for (let index = 0; index < line.serials.length; index++) {
                let serial: any = line.serials[index];
                let serialLine = new PhysicalCountLine();

                serialLine.ParseJson(serial)

                if (serialLine.id != null && serialLine.id != "") {
                    serialLine.parentId = line.id;
                    serialLine.productId = line.productId;
                    serialLine.expectedQty = 1
                    serialLine.enteredQty = (serialLine.isAvailable) ? 1 : 0
                    serialLine.unitCost = (await SerialProductRepo.getSerialUnitCost(client, serial.serial, physicalCount.branchId, serialLine.productId)).unitCost
                    await this.editPhysicalCountLine(client, serialLine, physicalCount.branchId)
                } else {
                    serialLine.serial = serial.serial

                    serialLine.expectedQty = 1
                    serialLine.physicalCountId = line.physicalCountId
                    serialLine.enteredQty = (serialLine.isAvailable) ? 1 : 0

                    serialLine.parentId = line.id;
                    serialLine.productId = line.productId;
                    serialLine.unitCost = (await SerialProductRepo.getSerialUnitCost(client, serial.serial, physicalCount.branchId, serialLine.productId)).unitCost
                    await this.addPhysicalCountLine(client, serialLine, physicalCount.branchId)
                }

                if (physicalCount.status == 'Closed' && (physicalCount.currentStatus == "" || physicalCount.currentStatus != 'Closed')) {
                    if (physicalCount.closedEmployeeId) {
                        await this.commit(client, serialLine, physicalCount.branchId, company.afterDecimal, physicalCount.closedEmployeeId)
                    }
                }

            }
        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async addBatchLines(client: PoolClient, physicalCount: PhysicalCount, line: PhysicalCountLine, company: Company) {
        try {
            for (let index = 0; index < line.batches.length; index++) {
                let batch: any = line.batches[index];
                let batchLine = new PhysicalCountLine();
                let batchData = (await BatchProductRepo.getBatchOnhandAndUnitCost(client, batch.batch, line.productId, physicalCount.branchId))

                batchLine.ParseJson(batch)
                if (batchLine.id != null && batchLine.id != "") {
                    batchLine.parentId = line.id;
                    batchLine.productId = line.productId;
                    batchLine.unitCost = batchData.unitCost;
                    batchLine.expectedQty = batchData.onHand;
                    await this.editPhysicalCountLine(client, batchLine, physicalCount.branchId)

                } else {

                    batchLine.parentId = line.id;
                    batchLine.productId = line.productId;
                    batchLine.physicalCountId = line.physicalCountId
                    batchLine.unitCost = batchData.unitCost;
                    batchLine.expectedQty = batchData.onHand;
                    await this.addPhysicalCountLine(client, batchLine, physicalCount.branchId)
                }

                if (physicalCount.status == 'Closed' && (physicalCount.currentStatus == "" || physicalCount.currentStatus != 'Closed')) {
                    if (physicalCount.closedEmployeeId) {
                        await this.commit(client, batchLine, physicalCount.branchId, company.afterDecimal, physicalCount.closedEmployeeId)
                    }
                }
            }
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getLogs(client: PoolClient, physicalCountId: string) {
        try {
            const query = {
                text: `SELECT logs from "PhysicalCounts" where id =$1`,
                values: [physicalCountId]
            }

            let physicalCount = await client.query(query.text, query.values);
            return physicalCount.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setLogs(client: PoolClient, physicalCountId: string, logs: Log[], branchId: string, companyId: string, source: string) {
        try {
            //await LogsManagmentRepo.manageLogs(client, "PhysicalCount", physicalCountId, logs, branchId, companyId, source)

        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async getPhysicalCountCurrentStatus(client: PoolClient, physicalCountId: string) {
        try {
            const query = {
                text: `SELECT status FROM "PhysicalCounts" where id=$1 `,
                values: [physicalCountId]
            }

            const physicalCount = await client.query(query.text, query.values);
            return physicalCount.rows[0].status
        } catch (error: any) {
          

            throw new Error(error);
        }
    }
    public static async addPhysicalCountLine(client: PoolClient, physicalCountLine: PhysicalCountLine, branchId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `INSERT INTO "PhysicalCountLines" ( "enteredQty","expectedQty",    "physicalCountId",  "productId" ,serial,batch,"parentId","unitCost") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                values: [physicalCountLine.enteredQty, physicalCountLine.expectedQty, physicalCountLine.physicalCountId, physicalCountLine.productId, physicalCountLine.serial, physicalCountLine.batch, physicalCountLine.parentId, physicalCountLine.unitCost]
            }


            const insert = await client.query(query.text, query.values);
            return { id: (<any>insert.rows[0]).id }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }
    public static async editPhysicalCount(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client();

        try {
            const companyId = company.id;
            await client.query("BEGIN")
            const validate = await PhysicalCountValidations.physicalCountValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const physicalCount = new PhysicalCount();
            physicalCount.ParseJson(data);
            const afterDecimal = company.afterDecimal
            if (physicalCount.id == null || physicalCount.id == "") {
                throw new ValidationException("Physical Count ID is Required")
            }
            let deletedLines = physicalCount.lines.filter(f => f.isDeleted);
            if (deletedLines && deletedLines.length == physicalCount.lines.length) {
                throw new ValidationException("Physical Count Cannot be Empty")
            }
            physicalCount.currentStatus = await this.getPhysicalCountCurrentStatus(client, physicalCount.id)
            if (physicalCount.status == 'calculated') {
                physicalCount.calculatedEmployeeId = employeeId;
                physicalCount.calculatedDate = new Date();
            } else if (physicalCount.status == 'Closed') {
                physicalCount.closedEmployeeId = employeeId;
                physicalCount.closedDate = new Date();
            }

            //physicalCount.logs = await this.getLogs(client, physicalCount.id)
            physicalCount.logs = []

            if (physicalCount.currentStatus == physicalCount.status) {
                Log.addLog(physicalCount, "Edit PhysicalCount", "Edit", employeeId)
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "PhysicalCounts" SET reference=$1,
                                                          status=$2,
                                                          note=$3,
                                                          type=$4,
                                                          "calculatedEmployeeId"=$5,
                                                          "closedEmployeeId"=$6,
                                                          "closedDate"=$7,
                                                          "calculatedDate"=$8
                                                          WHERE id = $9 AND "branchId"=$10 `,
                values: [physicalCount.reference, physicalCount.status, physicalCount.note, physicalCount.type, physicalCount.calculatedEmployeeId, physicalCount.closedEmployeeId, physicalCount.closedDate, physicalCount.calculatedDate, physicalCount.id, physicalCount.branchId]
            }

            const update = await client.query(query.text, query.values);
            for (let index = 0; index < physicalCount.lines.length; index++) {
                const element = physicalCount.lines[index];
                const temp = new PhysicalCountLine();
                temp.ParseJson(element);
                temp.physicalCountId = physicalCount.id;

                const productData: any = await ProductRepo.getProductOnHandAndUnitCost(client, temp.productId, physicalCount.branchId);
                temp.expectedQty = Number(productData.onHand);
                temp.unitCost = Number(productData.unitCost);


                if (temp.id == null || temp.id == "") {
                    const line = await this.addPhysicalCountLine(client, temp, physicalCount.branchId);
                    temp.id = line.id;
                } else {
                    if (physicalCount.currentStatus != 'Closed' && temp.isDeleted) {
                        await this.deletePhysicalCountLines(client, temp.id)
                        continue
                    }

                    await this.editPhysicalCountLine(client, temp, physicalCount.branchId);
                }


                if (temp.serials && temp.serials.length > 0) {
                    await this.addSerialLines(client, physicalCount, temp, company)
                }


                if (temp.batches && temp.batches.length > 0) {
                    await this.addBatchLines(client, physicalCount, temp, company)

                }


                if ((physicalCount.status == 'Closed' && physicalCount.currentStatus != 'Closed') && (temp.parentId == null && ((temp.serials == null || temp.serials.length == 0) && (temp.batches == null || temp.batches.length == 0)))) {
                    await this.commit(client, temp, physicalCount.branchId, afterDecimal, employeeId)
                }
            }

            if (employeeId && physicalCount.logs.length == 0) {
                Log.addLog(physicalCount, "Edit ", "Edit", employeeId)
            }

            await this.setLogs(client, physicalCount.id, physicalCount.logs, physicalCount.branchId, company.id, "Cloud")



            await client.query("COMMIT")
            return new ResponseData(true, "Updated Successfully", { id: physicalCount.id })
        } catch (error: any) {
            await client.query("ROLLBACK")
            console.log(error)
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async editPhysicalCountLine(client: PoolClient, physicalCountLine: PhysicalCountLine, branchId: string) {
        try {

            // const productData: any = await ProductRepo.getProductOnHandAndUnitCost(client, physicalCountLine.productId, branchId);
            // const expectedQty = productData.onHand;
            const query: { text: string, values: any } = {
                text: `UPDATE "PhysicalCountLines"  SET "enteredQty"=$1,"expectedQty"=$2 ,serial=$3,batch=$4 WHERE id=$5`,
                values: [physicalCountLine.enteredQty, physicalCountLine.expectedQty, physicalCountLine.serial, physicalCountLine.batch, physicalCountLine.id]
            }


            const insert = await client.query(query.text, query.values);
            return { unitCost: physicalCountLine.unitCost, id: physicalCountLine.id, onHand: physicalCountLine.expectedQty }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }


    // commit is o confirm the physical count (will affect on branch inventory movment)
    public static async commit(client: PoolClient, physicalCountLine: PhysicalCountLine, branchId: string, afterDecimal: number, employeeId: string) {
        try {


            const productType = await ProductRepo.getProductType(client, physicalCountLine.productId);
            if (productType == 'inventory' || productType == 'kit') {
                await this.inventoryProductCount(client, branchId, physicalCountLine, afterDecimal, employeeId)
            } else if (productType == 'batch') {
                await this.batchProductCount(client, branchId, physicalCountLine, afterDecimal, employeeId)

            } else if (productType == 'serialized') {

                await this.serialProductCount(client, branchId, physicalCountLine, afterDecimal, employeeId)

            }


        } catch (error: any) {
          
            console.log(error)

            throw new Error(error.message)
        }
    }


    private static async inventoryProductCount(client: PoolClient, branchId: string, physicalCountLine: PhysicalCountLine, afterDecimal: number, employeeId: string) {
        try {
            const productData = await ProductRepo.getProductOnHandAndUnitCost(client, physicalCountLine.productId, branchId)
            if (productData) {
                const currentOnHand = productData.onHand;
                const currentCost = Helper.multiply(currentOnHand, productData.unitCost, afterDecimal)
                // const openingBalance = productData.openingBalance ?? 0 
                /**Entered Qty - total On Hand  */
                // let onHand =   Helper.sub(physicalCountLine.enteredQty, currentOnHand + openingBalance, afterDecimal)
                // onHand =  Helper.add(onHand, currentOnHand, afterDecimal)
                // const qtyDifference = Helper.sub(currentOnHand, physicalCountLine.enteredQty , afterDecimal)
                // const cost = Helper.multiply(qtyDifference, productData.unitCost, afterDecimal)
                // await BranchProductsRepo.setNewOnHand(client, branchId, physicalCountLine.productId, physicalCountLine.enteredQty)
                // await this.insertMovment(client, cost, qtyDifference, physicalCountLine.id, branchId, currentOnHand, currentCost, physicalCountLine.productId, employeeId)
            }

        } catch (error: any) {
            throw new Error(error.message)
        }
    }
    private static async serialProductCount(client: PoolClient, branchId: string, physicalCountLine: PhysicalCountLine, afterDecimal: number, employeeId: string) {
        try {

            if ((!physicalCountLine.isAvailable) || physicalCountLine.isAvailable == null || physicalCountLine.isAvailable == undefined) {
                await SerialProductRepo.deleteSerial(client, physicalCountLine.serial, branchId, physicalCountLine.productId)
            }



        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    private static async batchProductCount(client: PoolClient, branchId: string, physicalCountLine: PhysicalCountLine, afterDecimal: number, employeeId: string) {
        try {

            const productId = physicalCountLine.productId;


            const element: any = physicalCountLine
            if (element.batch != null && element.batch != "") {

                const batchData = await BatchProductRepo.getBatchOnhandAndUnitCost(client, element.batch, productId, branchId);
                const currentOnHand = batchData.onHand;
                if (currentOnHand != element.enteredQty) {

                    // await BatchProductRepo.setBatchOnHand(client, element.batch, productId, branchId, element.enteredQty)
                }
            }



        } catch (error: any) {
          
            console.log(error)

            throw new Error(error.message)
        }
    }




    public static async getPhysicalCountList(data: any, company: Company, branchList: any[]): Promise<ResponseData> {
        try {
            const companyId = company.id
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList

            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let sort = data.sortBy;
            const filter: any = data.filter;
            let sortValue = !sort ? '"createdDate"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm
            let status = ['Calculated', 'Closed', 'Open']

            if (filter && filter.status != "" && filter.status != null) {

                status = filter.status
            }

            let page = data.page ?? 1
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query = {
                text: `SELECT      count(*) over(),
                        "PhysicalCounts".id,
                        "PhysicalCounts".reference,
                        "PhysicalCounts".status,
                        "PhysicalCounts".note,
                        "PhysicalCounts".type,
                        "PhysicalCounts"."createdDate",
                        "PhysicalCounts"."calculatedDate",
                        "PhysicalCounts"."closedDate",
                        "PhysicalCounts"."createdEmployeeId",
                        "PhysicalCounts"."calculatedEmployeeId",
                        "PhysicalCounts"."closedEmployeeId",
                        "Branches".name as "branchName"
            FROM "PhysicalCounts"
            INNER JOIN "Branches" ON "Branches".id ="PhysicalCounts"."branchId" 
			 Where "Branches"."companyId"=$1
			 AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
			 and   "PhysicalCounts".status = any($3)
			and (LOWER( "PhysicalCounts".type) ~ $4 
            OR LOWER("PhysicalCounts".status) ~ $4 
            OR LOWER("PhysicalCounts"."refrenceNumber") ~ $4 
            OR LOWER("PhysicalCounts".note) ~ $4 )
            and (($5::date is null) or ("createdDate"::date >= $5::date))
            AND  (($6::date is null) or ("createdDate"::date <= $6::date))
                        ${orderByQuery}
			  limit $7 offset $8`,
                values: [companyId, branches, status, searchValue, fromDate, toDate, limit, offset]
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







    public static async getPhysicalCountListByStatus(data: any, company: Company, branchList: String[]) {
        try {
            const companyId = company.id
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList

            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let sort = data.sortBy;
            const filter: any = data.filter;
            let sortValue = !sort ? '"createdDate"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm
            let status = data.status;

            if (filter && filter.status != "" && filter.status != null) {

                status = filter.status
            }

            let page = data.page ?? 1
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query = {
                text: `SELECT      count(*) over(),
                        "PhysicalCounts".id,
                        "PhysicalCounts".reference,
                        "PhysicalCounts".status,
                        "PhysicalCounts".note,
                        "PhysicalCounts".type,
                        "PhysicalCounts"."createdDate",
                        "PhysicalCounts"."calculatedDate",
                        "PhysicalCounts"."closedDate",
                        "PhysicalCounts"."createdEmployeeId",
                        "PhysicalCounts"."calculatedEmployeeId",
                        "PhysicalCounts"."closedEmployeeId"
            FROM "PhysicalCounts"
            INNER JOIN "Branches" ON "Branches".id ="PhysicalCounts"."branchId" 
			 Where "Branches"."companyId"=$1
			 AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
			 and   "PhysicalCounts".status = any($3)
			and (LOWER( "PhysicalCounts".type) ~ $4 
            OR LOWER("PhysicalCounts".status) ~ $4 
            OR LOWER("PhysicalCounts"."refrenceNumber") ~ $4 
            OR LOWER("PhysicalCounts".note) ~ $4 )
            and (($5::date is null) or ("createdDate"::date >= $5::date))
            AND  (($6::date is null) or ("createdDate"::date <= $6::date))
                        ${orderByQuery}
			  limit $7 offset $8`,
                values: [companyId, branches, status, searchValue, fromDate, toDate, limit, offset]
            }
            const selectList = await DB.excu.query(query.text, query.values)

            console.log(selectList.rows);

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
















    public static async getPhysicalCountByID(physicalCountId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT 
                PhysicalCounts.id,
                PhysicalCounts.reference,
                PhysicalCounts."branchId",
                PhysicalCounts.status,
                PhysicalCounts.note,
                PhysicalCounts.type,
                PhysicalCounts."createdDate",
                PhysicalCounts."calculatedDate",
                PhysicalCounts."closedDate",
                PhysicalCounts."createdEmployeeId",
                "calculatedEmployee".name as "calculatedEmployeeName",
                "createdEmployee".name as "createdEmployeeName",
                "closedEmployee".name as "closedEmployeeName",
                PhysicalCounts."calculatedEmployeeId",
                PhysicalCounts."closedEmployeeId",
                "Branches".name as "branchName",
                (SELECT json_agg(
                json_build_object('id',"PhysicalCountLines".id,
                                  'enteredQty',"enteredQty",
                                  'expectedQty', case when "InventoryMovmentRecords"."referenceId" is not null then ("PhysicalCountLines"."enteredQty" - "InventoryMovmentRecords"."qty") else case when      PhysicalCounts.status <> 'Closed'   then case when "Products"."type" = 'inventory' then
								                                                                               "BranchProducts"."onHand"
								                                                                       when  "Products"."type" = 'batch' then 
								     "ProductBatches"."onHand"
								  else 1 end 
								                                  else "PhysicalCountLines"."expectedQty" end end,
                                  'productId',"PhysicalCountLines"."productId",
                                  'productType',"Products"."type",
                                  'productName',"Products".name,
                                  'barcode',"Products".barcode,
                                  'categoryName',"Categories".name,
                                  'UOM',"Products"."UOM",
                                   'unitCost',case when "InventoryMovmentRecords"."referenceId" is not null then "InventoryMovmentRecords"."cost"  else "PhysicalCountLines"."unitCost" end,
                                    'onHand', case when "InventoryMovmentRecords"."referenceId" is not null then ("PhysicalCountLines"."enteredQty" - "InventoryMovmentRecords"."qty") else case when      PhysicalCounts.status <> 'Closed'   then case when "Products"."type" = 'inventory' then
								                                                                               "BranchProducts"."onHand"
								                                                                       when  "Products"."type" = 'batch' then 
								     "ProductBatches"."onHand"
								  else 1 end 
								                                  else "PhysicalCountLines"."expectedQty" end end,
                                    'serial',"PhysicalCountLines".serial,
                                    'batch',"PhysicalCountLines".batch,
                                    'parentId',"PhysicalCountLines"."parentId" )
                )FROM "PhysicalCountLines" 
                INNER JOIN "Products"
                ON  "Products".id = "PhysicalCountLines"."productId"
                LEFT JOIN "Categories"
                ON "Categories".id = "Products"."categoryId"
                INNER JOIN "BranchProducts" 
                ON "BranchProducts"."branchId" = PhysicalCounts."branchId" and"BranchProducts"."productId" = "Products".id
				LEFT join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id and "ProductBatches"."batch" = "PhysicalCountLines"."batch"
				AND "BranchProducts"."productId" = "Products".id
                LEFT JOIN "InventoryMovmentRecords" on  "InventoryMovmentRecords"."companyId" = $2  and "InventoryMovmentRecords"."branchId" =  PhysicalCounts."branchId"  and  "InventoryMovmentRecords"."productId" =  "PhysicalCountLines"."productId" and "InventoryMovmentRecords"."referenceId" = "PhysicalCountLines".id
				WHERE  "PhysicalCountLines"."physicalCountId" = $1
                )as "lines"
                FROM "PhysicalCounts" AS PhysicalCounts
                INNER JOIN "Branches" ON "Branches".id = PhysicalCounts."branchId"
                LEFT JOIN "Employees" "calculatedEmployee" ON "calculatedEmployee"."id" = PhysicalCounts."calculatedEmployeeId"
                INNER JOIN "Employees" "createdEmployee" ON "createdEmployee"."id" = PhysicalCounts."createdEmployeeId"
                LEFT JOIN "Employees" "closedEmployee" ON "closedEmployee"."id" = PhysicalCounts."closedEmployeeId"
				WHERE PhysicalCounts.id=$1
                AND "Branches"."companyId"=$2
                    `,
                values: [physicalCountId, companyId]
            }
            const physicalCountData = await DB.excu.query(query.text, query.values);
            let physicalCount = new PhysicalCount();
            physicalCount.ParseJson(physicalCountData.rows[0]);
            if (physicalCount.lines.filter(f => f.parentId != null) && physicalCount.lines.filter(f => f.parentId != null).length > 0) {
                physicalCount.lines.filter(f => f.parentId != null).forEach((element: any) => {
                    const Line = physicalCount.lines.find(f => f.id == element.parentId);

                    if (Line != null) {
                        const index = physicalCount.lines.indexOf(Line);
                        if (Line.productType == "batch") {

                            physicalCount.lines[index].batches.push(element)
                        } else if (Line.productType == "serialized") {
                            physicalCount.lines[index].serials.push(element)
                        }
                        physicalCount.lines.splice(physicalCount.lines.indexOf(element), 1);
                    }

                });
            }

            return new ResponseData(true, "", physicalCount)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async insertMovment(client: PoolClient, cost: number, qtyDifference: number, lineId: string, branchId: string, currentOnHand: number, currentCost: number, productId: string, employeeId: string) {
        try {


            //  qty up
            // cogs credit,inventroy assets debit


            // qty down
            // cogs debit,inventroy assets credit
            const movmentData = {
                qty: qtyDifference,
                cost: cost,
                lineId: lineId,
                refrenceTable: "PhysicalCount",
                currentCost: currentCost,
                currentOnHand: currentOnHand,
                productId: productId,
                branchId: branchId,
                employeeId: employeeId

            }
            await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    //return only inventory - kit - batch - serial Products  
    public static async getPhysicalCountProducts(data: any, company: Company) {
        try {
            const branchId = data.branchId;
            const categoryId = data.categoryId;
            const types = ['kit', 'inventory', 'serialized', 'batch']


            let selectQuery;
            let selectValues;
            let countValues;
            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;

            let count = 0;
            let pageCount = 0;

            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const countText = `select
                COUNT(*) 
            from "Products"
            INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id
            where "branchId" = $1
            AND (lower ("Products".name) ~ $2 or lower ("Products".barcode) ~ $2)
            AND "Products".type = ANY($3)
            AND "isDeleted" = false
      
              `

            selectQuery = `select 
            "Products".id,
            "Products".name,
            "Products"."UOM",
            "Products".type,
            "Products"."unitCost",
            "Categories".id as "categoryId",
            "Categories".name as "categoryName",
                             case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end as "mediaUrl",

            "Products".barcode,
            CASE WHEN
               "Products".type = 'inventory' or    "Products".type = 'kit' 
            then 
               "BranchProducts"."onHand"
            ELSE
              case when 
                 "Products".type = 'batch'
              THEN
                 sum("ProductBatches"."onHand")
              else 
                count ("ProductSerials".id)
                END
            END	as "onHand"
            FROM "Products"
            INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id
            LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"
            LEFT JOIN "ProductSerials" ON "ProductSerials"."branchProductId" = "BranchProducts".id
            LEFT JOIN "ProductBatches" ON "ProductBatches"."branchProductId" = "BranchProducts".id 
                     LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
            where "BranchProducts"."branchId"=$1
            AND  "Products".type = any($2)
            AND (lower ("Products".name) ~ $3 or lower ("Products".barcode) ~ $3)
            AND "Products"."isDeleted" = false
            group by "Products".id ,"BranchProducts".id, "Categories".id,"Media".id
    limit $4 offset $5
            `
            if (data && data.searchTerm != "" && data.searchTerm != null) {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

            }
            selectValues = [branchId, types, searchValue, limit, offset]

            countValues = [branchId, searchValue, types]

            let selectCount = await DB.excu.query(countText, countValues)
            count = Number((<any>selectCount.rows[0]).count)
            pageCount = Math.ceil(count / limit)


            const selectList: any = await DB.excu.query(selectQuery, selectValues)


            let inventoryIds = selectList.rows.map((f: any) => { if (f.type == 'inventory') return f.id })

            if (inventoryIds && inventoryIds.length > 0) {
                let costs = await ProductRepo.getLatestFIFOProductUnitCost(inventoryIds, branchId)
                console.log(costs)
                if (costs && costs.length > 0) {
                    selectList.rows = selectList.rows.map((product: any) => {
                        const productCost: any = costs.find((item: any) => item.productId == product.id)
                        console.log("=================")
                        console.log(productCost)
                        if (productCost) {
                            product.unitCost = productCost.cost

                        }
                        return product
                    })
                }

            }
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
          

            throw new Error(error.message)
        }
    }







    public static async getProductBatches(branchId: string, productId: string, client: PoolClient) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT batch,"unitCost","ProductBatches"."onHand","prodDate","expireDate"
                       FROM "ProductBatches"
                       INNER JOIN "BranchProducts"
                       ON "BranchProducts".id = "ProductBatches"."branchProductId"
                       WHERE "BranchProducts"."branchId" =$1
                       AND "BranchProducts"."productId" =$2`,
                values: [branchId, productId]
            }

            const data = await client.query(query.text, query.values)
            return new ResponseData(true, "", data.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }




    public static async getBranchProductByBarcode(data: any, company: Company, client: PoolClient) {
        try {
            const companyId = company.id;
            const branchId = data.branchId;

            let selectValues;
            const types = ['kit', 'inventory', 'serialized', 'batch']
            let searchValue = data.searchTerm.trim().toLowerCase()

            const selectText = `SELECT 
           "Products".name, 
            type, 
            "Categories"."name" as "categoryName",
            "onHand" ,
            barcode,
            case when COALESCE("BranchProducts".price,0) = 0 then  "Products"."defaultPrice" else "BranchProducts".price end  as "defaultPrice",
            "taxId",
            "Products".id, 
            "commissionPercentage",
            "commissionAmount",
            "description",
            "unitCost" 
            FROM "Products"
            INNER JOIN "BranchProducts" ON "Products".id = "BranchProducts"."productId"
            left JOIN "Categories" ON "Products"."categoryId" = "Categories"."id"
            WHERE "branchId" =$1
            AND "Products"."isDeleted" = false
            AND (  LOWER ("Products".barcode) = $2) 
            AND "Products".type = any($3)`



            selectValues = [branchId, searchValue, types]




            const selectList: any = await client.query(selectText, selectValues)

            /**TODO REMOVE THIS FROM HERE MAKE AS INDIVADUAL ROUTE */
            // for (let index = 0; index < selectList.rows.length; index++) {
            //   const element = selectList.rows[index];
            //   if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
            //     const branchSummary = await this.getProductAvailability(element.id, companyId);
            //     if (branchSummary?.data) {
            //       selectList.rows[index].branchSummary = branchSummary.data
            //     }
            //   }
            // }

            let product = selectList.rows && selectList.rows.length > 0 ? selectList.rows[0] : null;


            return new ResponseData(true, "", product)

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }






















    public static async getPhysicalCountProductsbyInventory(data: any) {
        try {
            const branchId = data.branchId;
            const inventorylocationsid = data.inventorylocationsid;
            const types = ['kit', 'inventory', 'serialized', 'batch']

            const query: { text: string, values: any } = {
                text: `select 
                "Products".id,
                "Products".name,
                "Products"."UOM",
                "Products".type,
                "Products"."unitCost",
                "Categories".id as "categoryId",
                "Categories".name as "categoryName",
                "Products".barcode,
                CASE WHEN
				   "Products".type = 'inventory' or    "Products".type = 'kit' 
				then 
				   "BranchProducts"."onHand"
				ELSE
				  case when 
				     "Products".type = 'batch'
				  THEN
				     sum("ProductBatches"."onHand")
				  else 
				    count ("ProductSerials".id)
					END
				END	as "onHand"
                FROM "Products"
                INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id
                LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"
                LEFT JOIN "ProductSerials" ON "ProductSerials"."branchProductId" = "BranchProducts".id
				LEFT JOIN "ProductBatches" ON "ProductBatches"."branchProductId" = "BranchProducts".id 
                where "BranchProducts"."branchId"=$1
                AND  "Products".type = any($2)
                AND "Products"."isDeleted" = false
                AND "BranchProducts"."locationId" = any($3)
                group by "Products".id ,"BranchProducts".id, "Categories".id`,
                values: [branchId, types, inventorylocationsid]
            }

            const products = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", products.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }







    public static async getPhysicalCountProductsbyCategory(data: any) {
        try {
            const branchId = data.branchId;
            const categoryId = data.categoryId;
            const types = ['kit', 'inventory', 'serialized', 'batch']

            const query: { text: string, values: any } = {
                text: `select 
                "Products".id,
                "Products".name,
                "Products"."UOM",
                "Products".type,
                "Products"."unitCost",
                "Categories".id as "categoryId",
                "Categories".name as "categoryName",
                "Products".barcode,
                CASE WHEN
				   "Products".type = 'inventory' or    "Products".type = 'kit' 
				then 
				   "BranchProducts"."onHand"
				ELSE
				  case when 
				     "Products".type = 'batch'
				  THEN
				     sum("ProductBatches"."onHand")
				  else 
				    count ("ProductSerials".id)
					END
				END	as "onHand"
                FROM "Products"
                INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id
                LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"
                LEFT JOIN "ProductSerials" ON "ProductSerials"."branchProductId" = "BranchProducts".id
				LEFT JOIN "ProductBatches" ON "ProductBatches"."branchProductId" = "BranchProducts".id 
                where "BranchProducts"."branchId"=$1
                AND  "Products".type = any($2)
                AND "Products"."isDeleted" = false
                AND "Products"."categoryId" =any($3)
                group by "Products".id ,"BranchProducts".id, "Categories".id`,
                values: [branchId, types, categoryId]
            }

            const products = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", products.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getPhysicalCountJournal(physicalCountId: string, company: Company) {

        try {

            //Return invoice payment journal
            //when normal payment
            // paymentMethod account (Bank or Cash):==> Credit
            // account receivable :==> Debit 
            // const defaultJournals = await JournalRepo.getJournal(physicalCountId, company)

            const journalQuery = {
                text: `select sum("qty" * "cost") as "cost"  from "InventoryMovmentRecords" where "companyId" = $2 and "transactionId" = $1`,
                values: [physicalCountId, company.id]
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
                        referenceId: physicalCountId
                    }
                    const inevntoryData = {
                        accountType: "Inventory Assets",
                        credit: 0,
                        debit: 0,
                        dbTable: "Physical Count Note",
                        referenceId: physicalCountId
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
          

            throw new Error(error.message)
        }
    }


    public static async returnSerialsLines(client: PoolClient, physicalCountId: string, companyId: string) {
        try {
            const query = {
                text: `SELECT "PhysicalCountLines".serial, "PhysicalCountLines"."unitCost","BranchProducts"."productId","BranchProducts".id as "branchProductId" FROM "PhysicalCountLines" 
                      inner join "PhysicalCounts" on "PhysicalCounts".id = "PhysicalCountLines"."physicalCountId"
                      inner join "Products" on "Products".id = "PhysicalCountLines"."productId"
                      inner join "BranchProducts" on  "BranchProducts"."productId"  = "PhysicalCountLines"."productId"  and "BranchProducts"."branchId" = "PhysicalCounts"."branchId" 
                      where "physicalCountId" = $1
                       and "Products"."type" = 'serialized'
                       and "PhysicalCountLines"."serial" is not null 
                       and "PhysicalCountLines"."parentId" is not null
                       and "enteredQty" = 0`,
                values: [physicalCountId]
            }

            let serials = await client.query(query.text, query.values);

            if (serials && serials.rows && serials.rows.length > 0) {
                for (let index = 0; index < serials.rows.length; index++) {
                    const element = serials.rows[index];
                    await SerialProductRepo.createAndInsertSerial(client, element, companyId, element.branchProductId, element.productId)

                }

            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async deletePhysicalCount(physicalCountId: string, company: Company, employeeId:string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")



            await this.returnSerialsLines(client, physicalCountId, company.id)
            let lines = await client.query(`select JSON_AGG("PhysicalCountLines".id) as  "ids", 
                                        "PhysicalCounts"."reference","PhysicalCounts"."branchId", "Employees"."name" as "employeeName"  
                                        from "PhysicalCountLines" 
                                        INNER JOIN "PhysicalCounts" on "PhysicalCounts".id = "PhysicalCountLines"."physicalCountId"
                                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2  
                                        where "physicalCountId"=$1
                                        group by "PhysicalCounts".id, "Employees".id`, 
                                        [physicalCountId, employeeId, company.id]
                                    )
            let lineIds = lines.rows && lines.rows.length > 0 && lines.rows[0].ids ? lines.rows[0].ids : []
            let branchId = lines.rows && lines.rows.length > 0 && lines.rows[0].branchId ? lines.rows[0].branchId : ''
            let employeeName = lines.rows && lines.rows.length > 0 && lines.rows[0].employeeName ? lines.rows[0].employeeName : ''
            let physicalNumber = lines.rows && lines.rows.length > 0 && lines.rows[0].reference ? lines.rows[0].reference : ''


            await client.query('DELETE FROM "PhysicalCountLines" WHERE "physicalCountId" = $1 ', [physicalCountId])
            await client.query('DELETE FROM "PhysicalCounts" WHERE "id" = $1 ', [physicalCountId])

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Physical Count Deleted'
            log.comment = `${employeeName} has deleted physical count ref number ${physicalNumber}`
            log.metaData = { "deleted": true }
            await LogsManagmentRepo.manageLogs(client, "PhysicalCounts", physicalCountId, [log], branchId, company.id, employeeId, physicalNumber, "Cloud")



            await client.query("COMMIT")

            return new ResponseData(true, "", { ids: lineIds })
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }

    }

    public static async deletePhysicalCountLines(client: PoolClient, lineId: string) {
        try {
            await client.query('delete from "PhysicalCountLines" where id = $1 or "parentId"= $1', [lineId])
        } catch (error: any) {
            throw new Error(error)
        }
    }
}