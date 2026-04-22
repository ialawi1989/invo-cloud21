import { DB } from "@src/dbconnection/dbconnection";
import { Pool, PoolClient } from "pg";

import { BatchProductRepo } from "../app/product/productTypes/batchProduct.reps";
import { BranchProductsRepo } from "../app/product/branchProduct.repo";
import format from 'pg-format'
import { UnitCostQueue } from "./UnitCostQueue";
import { Helper } from "@src/utilts/helper";
import { JournalTriggers } from "./journalTriggers";
import moment from "moment";
import { query } from "express";
export class Movment {
    id = "";
    employeeId: string | null
    productId = "";
    branchId = "";
    createdAt: Date = new Date();
    referenceId = ""; // physicalCount or transfer out or manualAdjusment , invoice , creditnote , bill (Lines)
    transactionId = ""; // physicalCount or transfer out or manualAdjusment , invoice , creditnote , bill
    referenceTable = "";
    costDate: Date | null = null /** used only for credit note due to its cost must be linked to invoice cost in here line cost will be saved  */
    cost = 0;
    qty = 0
    remainingQty = 0 // for voided
    companyId = "";
    costId: string | null;
    referenceCostId: string | null;
    isAllocated = true;
    childQty: number | null  /**CHILD QTY WILL BE SAVED INCASE COST IS CHANGED WE DIRCTLY DIVIDE COST BY QTY */
    qtyBalance = 0
    productType = ""
    skip = false;
    constructor() {
        this.costId = null;
        this.childQty = null
        this.referenceCostId = null;
        this.employeeId = null
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    toString() {
        return this.referenceTable + " " + this.qty + " " + this.cost;
    }
}
export class CostLogs {
    actionDate = new Date();
    reason = ""
}
export class CostModel {
    id = "";
    referenceId = "";
    dbTable = "";
    branchId = "";
    createdAt = new Date();
    cost = 0;
    qty = 0
    avgCost = 0
    logs: CostLogs[] = [];
    productIds: any[] = [];
    productId = ""
    isDeleted = false
    oldCreatedAt = new Date()
    totalCost = 0;
    oldCost = 0;
    changeInDate = false;
    lineId = ""
    actionDate = new Date()
    employeeId = ""
    isActive = true
    referenceCostId = ""
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}
export class InventoryMovmentTrigger {




    private static async checkTransactions(client: PoolClient, transaction: Movment) {
        try {
            const query = {
                text: `select 
                         case when "createdAt" <> $4 
                                    or "qty" <> $5 
                                    or "cost" <> $6
                              then true end "edit",
                             case when "createdAt" <> $4 then true else false end as "createdAtChange",
                             case when "qty" <> $5 or "cost" <> $6 then true else false end as "qtyChange",
                             case when "cost" <> $6  then true else false end as "costChange"

                      from "InventoryMovmentRecords" 
                      where "productId" =$1 
                      and "branchId"=$2
                      and "referenceId" = $3
                      `,
                values: [transaction.productId, transaction.branchId, transaction.referenceId, transaction.createdAt, transaction.qty, transaction.cost]
            }

            const transactionData = await client.query(query.text, query.values);
            if (transactionData && transactionData.rows && transactionData.rows.length > 0) {
                return transactionData.rows[0]
            }
            return null
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async checkIsCostTransactionExist(client: PoolClient, lineId: string, referenceId: string, createdAt: Date) {
        try {
            const query = {
                text: `SELECT 
                              "referenceId", 
                              "cost",
                              "qty",
                        
                              "createdAt",
                 case when "createdAt"::date <> $3::date then true else false end as "changeInDate" 
                from "InventoryMovmentRecords" where "referenceId" = $1 and "transactionId" =$2 `,
                values: [referenceId, lineId, createdAt]
            }

            let exist = await client.query(query.text, query.values);

            if (exist && exist.rows && exist.rows.length > 0) {

                const changeInCost = exist.rows[0].changeInCost
                const changeInDate = exist.rows[0].changeInDate
                const createdAt = exist.rows[0].createdAt
                const cost = exist.rows[0].cost
                const qty = exist.rows[0].qty

                const lineId = exist.rows[0].referenceId
                return { isExist: true, changeInCost: changeInCost, changeInDate: changeInDate, oldCost: cost, oldQty: qty, oldDate: createdAt, lineId: lineId }
            }

            return { isExist: false }
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async setBranchUnitCostJob(data: any[]) {
        try {
            let queueInstance = UnitCostQueue.getInstance();
            data.forEach(element => {
                queueInstance.createJob({ type: 'setBranchUnitCost', data: element })
            });
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**This function is used to getOld Invoice Branch Id to adjust Both Branch Qty after invoice branch is changed  */
    private static async getOldBranches(client: PoolClient, transactionsId: any[], branchId: string) {
        try {
            const query = {
                text: `SELECT case when "branchId" <>  $2 then "branchId"  end as "oldBranchId" from "InventoryMovmentRecords" where "referenceId" = any($1)`,
                values: [transactionsId, branchId]
            }

            let changeBranch = await client.query(query.text, query.values);
            return changeBranch && changeBranch.rows && changeBranch.rows.length > 0 && changeBranch.rows[0].oldBranchId ? changeBranch.rows[0].oldBranchId : null
        } catch (error: any) {

            throw new Error(error)
        }
    }
    private static async pushCostJobs(jobs: any[]) {
        try {
            let queueInstance = UnitCostQueue.getInstance();
            jobs.forEach(element => {

                queueInstance.createJob(element)
            });
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /** Opening Balance Movment */
    private static async ProductOpeiningBalanceMovment(productId: any[]) {
        const client = await DB.excu.client(5 * 60);
        try {
            productId = productId && productId.length > 0 ? productId.filter(f => f != "" && f != null) : []

            await client.query("BEGIN")
            const query = {
                text: ` SELECT 
                'Opening Balance'::text AS "referenceTable",
                "BranchProducts".id   AS "referenceId",
                "Products".id AS "transactionId",
                NULL::uuid AS "employeeId",
                "Products".id AS "productId",
                COALESCE("BranchProducts"."openingBalanceCost"::text::numeric ::float ,0)AS cost,
               COALESCE( ("BranchProducts"."openingBalance"::text::numeric)::float,0) AS qty,
                "Branches".id AS "branchId",
                case when "Branches"."openingBalanceDate" is null then   CAST("Companies"."createdAt" - interval '1 Day' as text) else    CAST("Branches"."openingBalanceDate" as text) end  AS "createdAt",
                "Branches"."companyId" 
                 FROM "Companies"
                 JOIN "Products" ON "Products"."companyId" = "Companies".id
                 JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id
                 JOIN "Branches" ON "Branches".id = "BranchProducts"."branchId"
              WHERE "Products".id =any($1)
              and ("BranchProducts"."openingBalanceCost" <> 0  or "BranchProducts"."openingBalanceCost" is not  null )
              GROUP BY "Branches".id, "BranchProducts".id, "Products".id,"Companies"."createdAt" `,
                values: [productId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const costs: any[] = [];
            const companyId = journals.length > 0 ? journals[0].companyId : null;
            const branchId = journals.length > 0 ? journals[0].branchId : null;

            const setBranhcUnitCostProducts = journals.map(f => {
                return {
                    "productId": f.productId,
                    "branchId": f.branchId
                }
            })
            if (journals.length > 0) {

                for (let index = 0; index < journals.length; index++) {
                    const element = journals[index];
                    const checkTransaction = await this.checkTransactions(client, element) /** check transaction for edit */
                    if ((element.qty == 0 && element.cost != 0) || (element.qty != 0 && element.cost == 0) || (element.qty != 0 && element.cost != 0)) {
                        const cost = await this.productCost(client, [element], "Opening Balance")
                        if (cost && cost.length > 0) {
                            costs.push(cost[0])
                        }
                        if (checkTransaction && checkTransaction.edit) {
                            await this.updateJournal(client, element)
                        } else if (checkTransaction == null) {
                            await this.insertJournal(client, element)
                        }

                    }

                }

                if (companyId) {
                    await JournalTriggers.calcualteOpeningBalanceAdjusment(client, companyId)
                }
                let productIds = journals.map(f => { return { productId: f.productId } })
                let branchJournals = journals.filter(f => f.qty > 0)
                if (branchJournals && branchJournals.length > 0) {
                    for (let index = 0; index < branchJournals.length; index++) {
                        const element = branchJournals[index];
                        await this.setOnHand(client, [{ productId: element.productId }], element.branchId, companyId)

                    }
                }

            }


            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                await this.pushCostJobs(costs)
            }
            if (setBranhcUnitCostProducts && setBranhcUnitCostProducts.length > 0) {
                await this.setBranchUnitCostJob(setBranhcUnitCostProducts)
            }
        } catch (error: any) {
            await client.query("ROLLBACK")
            console.log(error)

            throw new Error(error)
        } finally {
            client.release()
        }
    }


    /** Insert Product Costs [Bill,Voided Invoice,CreditNote,transfer In , transafer out to another branch]  */
    public static async productCost(client: PoolClient, transactions: any[], dbTable: string | null) {
        try {


            const costTransactions: CostModel[] = [];
            const references: any[] = []
            let branchId;
            /** Parse the journal data into  CostModel */
            // for (let index = 0; index < transactions.length; index++) {
            //     const element = transactions[index];


            //     let costTransaction = new CostModel();
            //     branchId = element.branchId;
            //     costTransaction.ParseJson(element);
            //     costTransaction.lineId = element.referenceId;
            //     costTransaction.referenceId = element.transactionId;
            //     costTransaction.dbTable = dbTable ?? "";
            //     costTransaction.createdAt = element.createdAt
            //     references.push(costTransaction.referenceId)
            //     costTransaction.cost = element.cost
            //     costTransaction.qty = element.qty
            //     costTransaction.referenceCostId = element.referenceCostId
            //     costTransactions.push(costTransaction)

            // }



            /** Logs To show edits on cost [date/qty/cost] */
            let log = new CostLogs()

            const costs: any[] = []
            for (let index = 0; index < transactions.length; index++) {
                const element = transactions[index];

                /** check if cost already exist */
                const isExist = await this.checkIsCostTransactionExist(client, element.transactionId, element.referenceId, element.createdAt)

                let changeFlag = false;
                let onlyCostUpdate = false;

                if (isExist) {
                    if (isExist.isExist) {

                        if (isExist.oldCost != element.cost) {

                            changeFlag = true
                            onlyCostUpdate = true
                        }

                        if (isExist.changeInDate) {

                            changeFlag = true
                        }


                        if (isExist.oldQty != element.qty) {

                            changeFlag = true
                        }

                        /** if cost is changed then update */

                    } else {
                        /** Add new Cost */

                        changeFlag = true

                        // await this.insertProductCostLine(client, element)

                    }


                } else {
                    /** Add new Cost */

                    changeFlag = true

                    // await this.insertProductCostLine(client, element)

                }



                /** reallocate qty only when qty/date change */
                if (changeFlag || dbTable == 'CreditNote' || dbTable == 'OnHand Adjustment') {
                    const costData = {
                        costId: element.referenceId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId,
                        isDeleted: false,
                        changeFlag: dbTable == 'CreditNote' || dbTable == 'OnHand Adjustment' ? true : changeFlag
                    }
                    // let queueInstance = UnitCostQueue.getInstance();
                    // queueInstance.createJob({ type: "checkForCostReallocation", data: costData })
                    costs.push({ type: "checkForCostReallocation", data: costData })
                    // await this.checkForCostReallocation(client, element.lineId, false, changeFlag)

                }

            }

            return costs


        } catch (error: any) {

            throw new Error(error)
        }
    }

    /** Delete  Product Costs [Bill,Voided Invoice,CreditNote,transfer In , transafer out to another branch]  */
    // public static async deleteProductCost(client: PoolClient, costId: string, productId: string) {
    //     try {

    //         const costData = {
    //             costId: costId,
    //             productId: productId,
    //             isDeleted: true,
    //             changeFlag: false
    //         }
    //         // let queueInstance = UnitCostQueue.getInstance();
    //         // queueInstance.createJob({ type: "checkForCostReallocation", data: costData })
    //         // await this.checkForCostReallocation(client, costId, true)

    //         return { type: "deleteCostReallocation", data: costData }

    //     } catch (error: any) {
    //       
    //         throw new Error(error)
    //     }
    // }


    public static async checkForCostReallocation(costId: string, productId: string, branchId: string | null, isDeleted = false, isEdited = false) {

        const client = await DB.excu.client(5 * 60)
        try {

            await client.query("BEGIN")


            const onHandQuery = {
                text: `with "cost" as (
                  select "productId", "branchId" from "InventoryMovmentRecords" where "referenceId" =$1 and "productId" = $2
                )
                select "onHand" from "cost"  
                inner join "BranchProducts" on "BranchProducts"."branchId" = "cost"."branchId" and "BranchProducts"."productId" = "cost"."productId"
                `,
                values: [costId, productId]
            }

            let totalOnhand = await client.query(onHandQuery.text, onHandQuery.values);
            let onHand = 0
            if (totalOnhand && totalOnhand.rows && totalOnhand.rows.length > 0) {
                onHand = totalOnhand.rows[0].onHand
            }
            console.log(costId, isDeleted)
            if (onHand < 0 || isDeleted || isEdited) {
                const query = {
                    text: `		 with "cost" as (
						   select "createdAt","productId","branchId" from "InventoryMovmentRecords"  where ($1::uuid is null or "productId" = $1) and "referenceId" =$2 and($3::uuid is null or "branchId" = $3)
						   
						   ),"inventory" as (
						   
						   	   select "InventoryMovmentRecords"."createdAt","InventoryMovmentRecords"."productId", "InventoryMovmentRecords"."branchId"  from "cost" 
						        inner join "InventoryMovmentRecords" on  "cost"."productId" = "InventoryMovmentRecords"."productId" and "cost"."branchId" = "InventoryMovmentRecords"."branchId"   and "InventoryMovmentRecords" ."createdAt" >= "cost"."createdAt"
						        where "InventoryMovmentRecords"."qty" >0 
			
						   order by "InventoryMovmentRecords"."createdAt" asc 
						   limit 1 
						   ),"older" as (
						   	select min("InventoryMovmentRecords"."createdAt")  as "createdAt", "InventoryMovmentRecords"."productId" , "InventoryMovmentRecords"."branchId"  from "inventory"
						   inner join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "inventory"."productId" and  "InventoryMovmentRecords"."branchId" = "inventory"."branchId"  and  "InventoryMovmentRecords"."createdAt" <= "inventory"."createdAt"
                            where "InventoryMovmentRecords"."qty" >0 

                           group by "InventoryMovmentRecords"."productId" , "InventoryMovmentRecords"."branchId","inventory"."createdAt" 
						   
						   ), "allcosts" as(
						        select * from "cost"
							   union all 
							    select * from "inventory" 
							   union all 
							   select * from "older"
						   )
						     select min("createdAt") as "minimumDate" , "branchId","productId"
							 from "allcosts"
							 group by "branchId","productId"
						 
                
                    `,
                    values: [productId, costId, branchId]
                }

                let costs = await client.query(query.text, query.values)

                if (costs && costs.rows && costs.rows.length > 0) {
                    console.log(costs.rows)
                    const costList = costs.rows[0];

                    await this.reallocateCost(client, costList)
                }
            }

            await client.query("COMMIT")
        } catch (error: any) {
            console.log(error)

            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async deleteCostReallocation(costId: string, productId: string, branchId: string, isDeleted = false, isEdited = false) {

        const client = await DB.excu.client(5 * 60)
        try {

            await client.query("BEGIN")


            const query = {
                text: `		with "cost" as (
                            select * from "InventoryMovmentRecords" where "referenceId" =$1
                            ), "older" as (
                            select "InventoryMovmentRecords".* from "InventoryMovmentRecords" 
                                inner join "cost" on "cost"."productId" ="InventoryMovmentRecords"."productId" and  "cost"."branchId" ="InventoryMovmentRecords"."branchId" and "InventoryMovmentRecords"."createdAt" <= "cost"."createdAt" 
                                where "InventoryMovmentRecords"."qty">0 
							)

                            select "older"."productId","older"."branchId","older"."companyId", JSON_AGG("older"."referenceId") as"costIds", min("older"."createdAt") as "minimumDate"  from "older"
                            group by "older"."productId","older"."branchId","older"."companyId"
                    `,
                values: [costId]
            }

            let costs = await client.query(query.text, query.values)
            await client.query('DELETE FROM "InventoryMovmentRecords" where "referenceId" = $1 and "productId"=$2 returning *', [costId, productId])

            console.log("111111111111111111111111111111", costs.rows)
            const costList = costs.rows[0];
            if (costList) {
                const companyId = costList.companyId
                await this.reallocateCost(client, costList, true)
                await this.setOnHand(client, [{ productId: productId }], branchId, companyId)

                await client.query("COMMIT")

                if (costList) {
                    this.setBranchUnitCostJob([{ "productId": productId, "branchId": costList.branchId }])

                }
            }



        } catch (error: any) {
            console.log(error)

            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    private static async reallocateCost(client: PoolClient, costsList: any, isDeleted = false) {
        try {

            const costIds = costsList ? costsList.costIds : []

            const updatedTransactions: any[] = []


            let minimumDate = costsList.minimumDate
            let productId = costsList.productId
            let branchId = costsList.branchId
            let hasPhysicalCount = false
            let dateFilter = isDeleted ? '>=' : '>'
            const addedUnitCostAdjustments: any[] = [];
            const deletedUnitCostAdjustments: any[] = [];
            let unitCostAdjustments: any[] = []

            console.log("======", isDeleted, "======??????", minimumDate)
            await client.query(`DELETE FROM "InventoryMovmentRecords" where "productId" = $1 and  "referenceTable" = 'FIFO Cost Adjusment'  and "createdAt" ${dateFilter} $2 `, [productId, minimumDate])


            const adjustments: any[] = [];

            const query = {
                text: `SELECT SUM("qty") over() as "qtyOpeningBalnace" from "InventoryMovmentRecords" where "productId" = $1 and "branchId"=$2 and "createdAt" < $3`,
                values: [productId, branchId, minimumDate]
            }


            let openingBalanceQty = 0;

            const openingBalance = await client.query(query.text, query.values);
            if (openingBalance && openingBalance.rows && openingBalance.rows.length > 0) {
                openingBalanceQty = openingBalance.rows[0].qtyOpeningBalnace
            }


            query.text = `
            select "referenceId" , "branchId" ,"companyId" ,"referenceCostId", "transactionId" , "referenceTable" , "qty" as "qty" ,  "cost" , "costId" , cast("createdAt" as text) , sum("qty") over(order by "createdAt" asc  ,"incrementalId" asc )  as "qtyBalance" FROM "InventoryMovmentRecords" 
            where "branchId" = $1 
            and "productId" = $2 
            and "createdAt" >= $3 
            and  "referenceTable" <> 'FIFO Cost Adjusment' 
       
            order by "createdAt" asc , "incrementalId" asc 
           `
            query.values = [branchId, productId, minimumDate]

            const transactionsData = await client.query(query.text, query.values);
            let physicalCountOpeningQty = openingBalanceQty;

            let physicalCountIds = transactionsData.rows.filter((f: any) => f.referenceTable == 'PhysicalCount').map(f => { return f.referenceId });
            let physicalCountTransactions: { id: string, enteredQty: number }[] = []
            if (physicalCountIds) {
                const physicalCountQuery = {
                    text: `SELECT id , "enteredQty" from "PhysicalCountLines" where "id" =ANY($1)`,
                    values: [physicalCountIds]
                }
                let physicalCountRows = await client.query(physicalCountQuery.text, physicalCountQuery.values);
                physicalCountTransactions = physicalCountRows.rows.map(f => { return { id: f.id, enteredQty: f.enteredQty } })
            }



            if (transactionsData && transactionsData.rows && transactionsData.rows.length > 0) {

                const listOfTransactions: any = transactionsData.rows
                let inTransactions: any[] = []
                let lastCost = 0
                let lastCostId = ''
                let totalUsages = 0;
                let lastTransactionCost = 0
                for (let index = 0; index < listOfTransactions.length; index++) {
                    const current = listOfTransactions[index];
                    const element = new Movment();
                    element.ParseJson(current)

                    let cost = 0

                    // if((element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)' && element.qty>=0)|| element.referenceTable == 'Manual Adjustment' || element.referenceTable == 'Manual Adjusment') {
                    //    inTransactions = [] 
                    // }
                    if (openingBalanceQty < 0 && element.qty > 0) {
                        openingBalanceQty += element.qty
                    }



                    // if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {


                    //     if (element.qty > 0) {
                    //         inTransactions = []
                    //     }
                    //     if(element.qty<0)
                    //     {
                    //         element.cost = lastCost
                    //     }
                    //     if (!(element.skip)) {
                    //         let manualAdjustment = transactionsData.rows.filter(f => f.transactionId == element.transactionId)
                    //         if (manualAdjustment && manualAdjustment.length > 1) {

                    //             let otherMnualAdjustmentTransaction = manualAdjustment.find(f => f.referenceId != element.referenceId)
                    //             let indexOfOther = listOfTransactions.indexOf(otherMnualAdjustmentTransaction);

                    //             if (physicalCountOpeningQty <= 0) {
                    //                 element.qty = 0;
                    //                 listOfTransactions[indexOfOther].qty = 0
                    //             } else {



                    //                 element.qty = element.qty < 0 ? physicalCountOpeningQty * -1 : physicalCountOpeningQty;
                    //                 listOfTransactions[indexOfOther].qty = listOfTransactions[indexOfOther].qty < 0 ? physicalCountOpeningQty * -1 : physicalCountOpeningQty;

                    //                 listOfTransactions[indexOfOther].skip = true
                    //                 updatedTransactions.push(listOfTransactions[indexOfOther])
                    //             }


                    //         }
                    //     }
                    // }

                    if (element.referenceTable == 'PhysicalCount') {
                        let currentPhysicalCount = physicalCountTransactions.find(f => f.id == element.referenceId);
                        if (currentPhysicalCount && !isNaN(currentPhysicalCount.enteredQty)) {
                            let oldQty = element.qty;

                            element.qty = currentPhysicalCount.enteredQty - physicalCountOpeningQty
                            physicalCountOpeningQty = currentPhysicalCount.enteredQty
                            if (oldQty != element.qty) {
                                hasPhysicalCount = true
                            }

                        }
                    } else {
                        physicalCountOpeningQty += element.qty;
                    }


                    // if (element.referenceTable = 'Manual Adjustment (UnitCost Adjustment)') {
                    //     element.qty = element.qty < 0 ? physicalCountOpeningQty * -1 : physicalCountOpeningQty;
                    // }
                    const transactionQty = element.qty
                    if (transactionQty >= 0) {
                        element.qty = element.referenceTable == 'PhysicalCount' ? element.qty : element.qtyBalance && element.qtyBalance > 0 ? element.qty + openingBalanceQty > element.qtyBalance ? element.qtyBalance : element.qty + openingBalanceQty : 0
                        let newProductCost = lastCost
                        if (lastCost == 0 && inTransactions.length > 0) {
                            newProductCost = inTransactions[inTransactions.length - 1].cost
                        }
                        if (element.referenceTable == 'CreditNote' || element.referenceTable == 'Invoice' || element.referenceTable == 'Manual Adjusment' || element.referenceTable == 'Manual Adjustment'
                            || element.referenceTable == 'PhysicalCount') {
                            if (element.cost == 0 && lastTransactionCost != 0) {
                                element.cost = lastTransactionCost
                            }

                            updatedTransactions.push({ ...element })
                        }
                        if (element.referenceTable == 'Child Inventory Movment' && element.cost == 0) {
                            element.cost = newProductCost
                            updatedTransactions.push({ ...element })
                        }



                        if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {
                            let totalAdjQty = 0
                            for (const adj of unitCostAdjustments) {
                                deletedUnitCostAdjustments.push(adj.referenceId);
                            }
                            deletedUnitCostAdjustments.push(element.referenceId)
                            if (inTransactions.length > 0) {
                                const groupedByCost = new Map<number, number>();

                                for (const tx of inTransactions) {
                                    const cost = Number(tx.cost);
                                    const qty = Number(tx.qty || 0);
                                    groupedByCost.set(cost, (groupedByCost.get(cost) || 0) + qty);
                                }

                                for (const [cost, totalQty] of groupedByCost.entries()) {
                                    if (totalQty <= 0) continue;
                                    totalAdjQty += totalQty
                                    addedUnitCostAdjustments.push({
                                        ...element,
                                        qty: totalQty * -1,
                                        cost
                                    });
                                }
                            }
                            element.qty = totalAdjQty;

                            physicalCountOpeningQty = totalAdjQty
                            unitCostAdjustments = []
                            inTransactions = []
                            addedUnitCostAdjustments.push({ ...element })
                        }

                        inTransactions.push(element)

                        totalUsages += element.qty;
                        if (index > 0) {
                            const lastTransaction = listOfTransactions[index - 1]
                            if (lastTransaction) {
                                if (physicalCountOpeningQty - element.qty < 0) {
                                    let adjustment = {
                                        oldCost: lastTransaction.qty < 0 ? lastCost : lastTransaction.cost,
                                        oldCostId: lastTransaction.qty < 0 ? lastTransaction.costId : lastTransaction.referenceId,
                                        newCost: element.cost,
                                        newCostId: element.referenceId,
                                        adjustedQty: Math.abs(physicalCountOpeningQty - element.qty),
                                        greatestDate: element.createdAt,
                                        productId: productId,
                                        branchId: branchId,
                                        companyId: element.companyId
                                    }

                                    adjustments.push(adjustment)
                                }

                            }

                        }
                    } else {

                        if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {
                            unitCostAdjustments.push(element);
                            continue;
                        }


                        let remainingUsage = Math.abs(transactionQty);
                        let totalCost = 0;
                        if (inTransactions.length == 0) {
                            element.cost = lastCost;
                            updatedTransactions.push({ ...element })
                            const linkedTransactions = listOfTransactions.filter((f: any) => f.referenceCostId == element.referenceId && f.createdAt >= element.createdAt);
                            if (linkedTransactions && linkedTransactions.length > 0) {
                                for (let index = 0; index < linkedTransactions.length; index++) {
                                    const linkedElement = linkedTransactions[index];
                                    const elementIndex = listOfTransactions.indexOf(listOfTransactions.find((f: any) => f.referenceId == linkedElement.referenceId));
                                    if (elementIndex >= 0) {
                                        listOfTransactions[elementIndex].cost = element.cost
                                    }
                                }
                            }
                        } else {
                            while (remainingUsage > 0 && inTransactions.length > 0) {
                                const currentCost = inTransactions[0];

                                if (currentCost.qty < 0) {
                                    inTransactions.shift()
                                    continue;
                                }
                                // if(inTransactions.length>1 && )
                                // {

                                // }

                                if (currentCost.qty <= remainingUsage) {

                                    totalCost += currentCost.qty * currentCost.cost;
                                    lastCost = currentCost.cost;
                                    lastCostId = currentCost.referenceId;
                                    remainingUsage -= currentCost.qty;
                                    totalUsages -= currentCost.qty;
                                    inTransactions.shift();
                                } else {
                                    totalCost += remainingUsage * currentCost.cost;
                                    lastCost = currentCost.cost;
                                    lastCostId = currentCost.referenceId;
                                    currentCost.qty -= remainingUsage;
                                    totalUsages -= remainingUsage;
                                    remainingUsage = 0;
                                }


                            }
                            let remainingQtyWithNoInventory = (remainingUsage * lastCost);



                            cost = totalCost + remainingQtyWithNoInventory

                            if (element.referenceTable != 'Supplier Credit') {
                                element.cost = element.qty !== 0 ? cost / Math.abs(element.qty) : 0;
                            }


                            updatedTransactions.push({ ...element })
                            // const linkedTransactions = listOfTransactions.filter((f: any) => f.referenceCostId == element.referenceId && f.createdAt >= element.createdAt);
                            // if (linkedTransactions && linkedTransactions.length > 0) {
                            //     for (let index = 0; index < linkedTransactions.length; index++) {
                            //         const linkedElement: any = linkedTransactions[index];
                            //         const temp = listOfTransactions.find((f: any) => f.referenceId == linkedElement.referenceId)
                            //         if (temp) {
                            //             const elementIndex = listOfTransactions.indexOf(temp);
                            //             if (elementIndex >= 0) {
                            //                 listOfTransactions[elementIndex].cost = element.cost
                            //             }
                            //         }
                            //     }

                            // }


                        }
                    }
                    lastTransactionCost = element.cost
                }




            }


            const transactionValues = updatedTransactions.map(update => [update.referenceId, update.cost, productId, update.qty, update.branchId]);
            const inTransactionsChanges = updatedTransactions.filter(e => e.qty > 0).map(update => [update.referenceId, update.cost, productId]);
            if (deletedUnitCostAdjustments.length > 0) {

                const deleteQuery = `
                        DELETE FROM "InventoryMovmentRecords" imr
                        WHERE imr."referenceId" = any($1)
                        AND imr."productId" =$2
                        AND imr."referenceTable" = 'Manual Adjustment (UnitCost Adjustment)'
                        `;

                await client.query(deleteQuery, [deletedUnitCostAdjustments, productId])
            }
            if (addedUnitCostAdjustments.length > 0) {
                const insertQuery = `
                        INSERT INTO "InventoryMovmentRecords" (
                            "referenceId",
                            "productId",
                            "branchId",
                            "qty",
                            "cost",
                            "createdAt",
                            "referenceTable",
                            "companyId"
                        )
                        SELECT
                            data."referenceId"::uuid,
                            data."productId"::uuid,
                            data."branchId"::uuid,
                            data.qty::real,
                            data.cost::real,
                            data."createdAt"::timestamp,
                            data."referenceTable",
                            data."companyId"::uuid
                        FROM (VALUES %L) AS data(
                            "referenceId",
                            "productId",
                            "branchId",
                            qty,
                            cost,
                            "createdAt",
                            "referenceTable",
                            "companyId"
                        );
                        `;

                const insertValues = addedUnitCostAdjustments.map(t => [
                    t.referenceId,
                    productId,
                    t.branchId,
                    t.qty,
                    t.cost,
                    t.createdAt,
                    t.referenceTable,
                    t.companyId

                ]);

                if (insertValues.length > 0) {
                    const formattedInsert = format(insertQuery, insertValues);
                    await client.query(formattedInsert);
                }
            }
            if (transactionValues.length > 0) {
                const updateQuery = `
                UPDATE "InventoryMovmentRecords" 
                SET "cost" = data.cost::real,
                    "qty" = case when  "InventoryMovmentRecords"."referenceTable" = 'PhysicalCount' or  "InventoryMovmentRecords"."referenceTable" =  'Manual Adjustment (UnitCost Adjustment)' then data."qty"::numeric else "InventoryMovmentRecords"."qty" end
                FROM (VALUES %L) AS data("referenceId", cost,"productId","qty","branchId")
                WHERE "InventoryMovmentRecords"."referenceId"= data."referenceId"::uuid
                AND "InventoryMovmentRecords"."productId"= data."productId"::uuid
                AND "InventoryMovmentRecords"."productId"= data."productId"::uuid
                AND "InventoryMovmentRecords"."branchId"= data."branchId"::uuid
                ;
              `;
                const formattedQuery = format(updateQuery, transactionValues);
                await client.query(formattedQuery);

                await this.setAdjusment(client, adjustments)
            }

            let totalQty = physicalCountOpeningQty;
            /** Because the difference of physical count is recalculated we have to reset the on hand of the product if it happened 
             * only if the difference is changed 
             */
            if (hasPhysicalCount) {
                await client.query('UPDATE "BranchProducts" SET "onHand" = $1 where "branchId"=$2 and "productId" = $3', [totalQty, branchId, productId])

            }

        } catch (error: any) {
            console.log(error)


            throw new Error(error)

        }
    }

    public static async checkUpdatedCosts(costId: string, productId: string) {

        const client = await DB.excu.client(5 * 60)
        try {

            await client.query("BEGIN")

            const query = {
                text: ` with "cost" as (
                           select "branchId","productId", "createdAt" from "InventoryMovmentRecords" 
                           where "referenceId" = $1 and ($2::uuid is null or "productId" = $2) )       
                           
                           select  "InventoryMovmentRecords"."branchId","InventoryMovmentRecords"."productId", min( "InventoryMovmentRecords"."createdAt") as "minimumDate" , JSON_AGG("InventoryMovmentRecords"."referenceId") as "costIds" from "InventoryMovmentRecords" 
                           inner join "cost" on "cost"."branchId" =  "InventoryMovmentRecords"."branchId" and "cost"."productId" =  "InventoryMovmentRecords"."productId" and "cost"."createdAt" <= "InventoryMovmentRecords"."createdAt"
                           group by "InventoryMovmentRecords"."branchId","InventoryMovmentRecords"."productId"

                       
                         `,
                values: [costId, productId]
            }

            let costsData = await client.query(query.text, query.values);
            /** in case the cost list length = 0 or 1 then the cost applied is the last cost therefore no need to proceed  */
            if (costsData && costsData.rows && costsData.rows.length > 0) {
                const costList = costsData.rows[0]
                const costIds = costList.costIds;
                // const temp = costIds.filter((f: any) => f != costId);
                // if (temp && temp.length > 0) {
                await this.reallocateCost(client, costList)
                // }

            }

            await client.query("COMMIT")
        } catch (error: any) {
            console.log(error)

            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /** to save adjustments */
    private static async setAdjusment(client: PoolClient, data: any[]) {
        try {

            let costAdjsument: any[] = [];
            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                let adjument = {
                    cost: element.oldCost,
                    qty: Math.abs(element.adjustedQty),
                    costId: element.oldCostId,
                    adjustedWithCostId: element.newCostId,
                    createdAt: element.greatestDate,
                    productId: element.productId,
                    branchId: element.branchId,
                    companyId: element.companyId,
                    referenceTable: 'FIFO Cost Adjusment'
                }
                costAdjsument.push(adjument)
                let adjument2 = {
                    cost: element.newCost,
                    qty: Math.abs(element.adjustedQty) * -1,
                    costId: element.newCostId,
                    adjustedWithCostId: element.oldCostId,
                    createdAt: element.greatestDate,
                    productId: element.productId,
                    branchId: element.branchId,
                    companyId: element.companyId,
                    referenceTable: 'FIFO Cost Adjusment'
                }



                costAdjsument.push(adjument2)
            }

            const adjustmentValues = costAdjsument.map(p => [p.productId, p.createdAt, p.branchId, p.referenceTable, p.qty, p.cost, p.costId, p.adjustedWithCostId]);

            //  const queryText = format(`
            //     INSERT INTO "InventoryMovmentRecords" 
            //     ("productId", "branchId", "referenceTable", "qty", "cost", "costId", "adjustedWithCostId")
            //     VALUES %L
            //   `, adjustmentValues);
            //   await client.query(queryText);

            const query = `
                   INSERT INTO "InventoryMovmentRecords" 
                ("productId","createdAt", "branchId", "referenceTable", "qty", "cost", "costId", "adjustedWithCostId","companyId") 
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            `
            for (let index = 0; index < costAdjsument.length; index++) {
                const element = costAdjsument[index];
                await client.query(query, [element.productId, element.createdAt, element.branchId, element.referenceTable, element.qty, element.cost, element.costId, element.adjustedWithCostId, element.companyId])

            }
        } catch (error: any) {

            throw new Error(error)
        }
    }





    /** retrun current cost of transaction on save  */
    public static async getProductCosts(client: PoolClient, productId: string, branchId: string, totalQty: number, referenceId: string | null) {

        try {
            /**
             * the following will edit on all transaction links to the edited invoice if invoice date is change and cost is changed
             * voided lines and creditNoteLines
             */


            const query = {
                text: `
   
                  WITH qty_total AS (
                    SELECT SUM(qty) AS available_qty
                    FROM "InventoryMovmentRecords"
                    WHERE "productId" = $1
                        AND "branchId" = $2
                        AND ($3::uuid IS NULL OR "referenceId" <> $3)
                    ), running_total AS (
                    SELECT
                        "referenceId" AS cost_id,
                        qty,
                        cost,
                        "createdAt",
                        SUM(qty) OVER (ORDER BY "createdAt" DESC) AS cumulative_qty
                    FROM "InventoryMovmentRecords"
                    WHERE "productId" = $1
                        AND "branchId" = $2
                        AND qty >= 0
                        AND cost IS NOT NULL
                        AND "referenceTable"  IN ( 'InventoryTransfers',
                                                        'Billing',
                                                        'Opening Balance',
                                                        'Manual Adjustment (UnitCost Adjustment)')
                    ), qtys AS (
                    SELECT
                        r.cost_id,
                        r."createdAt",
                        SUM(
                        CASE
                            WHEN r.cumulative_qty <= qt.available_qty THEN r.qty
                            WHEN r.cumulative_qty > qt.available_qty AND r.cumulative_qty - r.qty < qt.available_qty
                            THEN r.qty - (r.cumulative_qty - qt.available_qty)
                            ELSE 0
                        END
                        ) AS qty,
                        r.cost
                    FROM running_total r
                    CROSS JOIN qty_total qt
                    WHERE r.cumulative_qty <= qt.available_qty
                        OR (r.cumulative_qty - r.qty < qt.available_qty)
                    GROUP BY r.cost_id, r.cost, r."createdAt"
                    )
                    SELECT *
                    FROM qtys
                    WHERE qty > 0
                    ORDER BY "createdAt" ASC;
        
                            `,
                values: [productId, branchId, referenceId]
            };
            let values = await client.query(query.text, query.values);
            let resault
            if (values && values.rows && values.rows.length > 0) {
                resault = values.rows



                let remainingQty = Math.abs(totalQty);
                let totalCost = 0;
                let lastCostId = '';
                let lastCostIndex = 0
                let lastCost = 0
                let firstCostId = ''
                for (let index = 0; index < resault.length; index++) {
                    const element = resault[index];
                    lastCost = element.cost
                    if (index == 0) {
                        firstCostId = element.costId
                    }
                    if (remainingQty <= 0)
                        break
                    if (element.qty > Math.abs(remainingQty)) {
                        totalCost = Helper.add(totalCost, Helper.multiply((Math.abs(remainingQty)), element.cost))
                        remainingQty = Helper.sub(remainingQty, Math.abs(remainingQty))
                        lastCostId = element.costId
                        lastCostIndex = index
                    } else {
                        totalCost = Helper.add(totalCost, Helper.multiply(element.qty, element.cost))
                        remainingQty = Helper.sub(remainingQty, element.qty)
                    }

                }

                if (remainingQty > 0) {
                    totalCost = Helper.add(totalCost, Helper.multiply(remainingQty, lastCost));

                }

                let costRemaining = remainingQty
                let adjustments: any[] = []
                if (lastCostId && remainingQty < 0) {
                    for (let index = lastCostIndex; index < resault.length; index++) {
                        const element = resault[index];
                        const nextCost = resault[index + 1]
                        if (!nextCost) {
                            break
                        }
                        if (costRemaining < 0) {
                            let adjustment = {
                                oldCost: element.cost,
                                oldCostId: element.costId,
                                newCost: nextCost.cost,
                                newCostId: nextCost.costId,
                                adjustedQty: Math.abs(remainingQty),
                                greatestDate: element.createdAt,
                                productId: productId,
                                branchId: branchId
                            }
                            adjustments.push(adjustment)
                        }

                        if (element.qty > adjustments) {
                            break;
                        } else {
                            costRemaining = element.qty + costRemaining
                        }
                    }
                }

                const cost = totalQty == 0 || totalQty == null ? 0 : Helper.division(totalCost, Math.abs(totalQty));
                const returnedData = {
                    cost: cost,
                    allocatedqty: totalQty,
                    adjustement: adjustments,
                    costId: firstCostId
                }
                resault = returnedData
                resault = returnedData


            } else {
                query.text = `SELECT 
                                  "InventoryMovmentRecords"."referenceId" as  "costId", 
                                  "InventoryMovmentRecords"."cost",
                                  "InventoryMovmentRecords"."createdAt",
                                    $3::float as "allocatedqty"
                FROM "InventoryMovmentRecords" where "productId" = $1 and "branchId" = $2
                	          and "InventoryMovmentRecords"."qty" >= 0 
                            and "cost" <> 'Nan'
                            		  and  "InventoryMovmentRecords"."referenceTable"  IN ( 'InventoryTransfers',
                                                        'Billing',
                                                        'Opening Balance',
                                                        'Manual Adjustment (UnitCost Adjustment)')
                order by "createdAt" DESC
                limit 1
                `
                const queryvalues = [productId, branchId, totalQty]

                values = await client.query(query.text, queryvalues);

                resault = values.rows

                const returnedData = {
                    cost: values.rows && values.rows.length > 0 ? values.rows[0].cost : 0,
                    allocatedqty: totalQty,
                    costId: values.rows && values.rows.length > 0 ? values.rows[0].costId : null,
                    adjustement: []
                }
                resault = returnedData



            }

            return resault;
        }
        catch (error: any) {

            throw new Error(error);
        }
    }
    /** when transaction date is changed the returned cost will be  the previous cost base on transaction date */
    private static async getCostByDate(client: PoolClient, productId: string, branchId: string, date: Date) {
        try {
            console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
            const query = {
                text: `select "referenceId" as "costId" , "cost" , "createdAt"
                        from "InventoryMovmentRecords" where "productId" =$1
                        and "branchId" =$2
                        and "createdAt" <= $3
						          and "InventoryMovmentRecords"."qty" >= 0 
                        	  and  "InventoryMovmentRecords"."referenceTable"  IN ( 'InventoryTransfers',
                                                        'Billing',
                                                        'Opening Balance',
                                                        'Manual Adjustment (UnitCost Adjustment)')
                        order by "createdAt"  DESC 
                        limit 1`,
                values: [productId, branchId, date]
            }
            const values = await client.query(query.text, query.values);
            let resault
            if (values && values.rows && values.rows.length > 0) {
                resault = values.rows[0]


            }
            if (resault) {
                return {
                    cost: resault.cost,
                    costId: resault.costId
                }
            } else {
                return {
                    cost: 0,
                    costId: null
                }
            }


        } catch (error: any) {

            throw new Error(error)
        }
    }
    private static async getLeatestCost(client: PoolClient, productId: string, branchId: string) {
        try {
            const query = {
                text: `select "InventoryMovmentRecords"."referenceId" as "lineId", "cost" from "InventoryMovmentRecords" 
                    where "productId" = $2
                    and "branchId" = $1
                    and ("qty">=0 )
                    	  and  "InventoryMovmentRecords"."referenceTable"  IN ( 'InventoryTransfers',
                                                        'Billing',
                                                        'Opening Balance',
                                                        'Manual Adjustment (UnitCost Adjustment)')
                    order by "createdAt" DESC 
                    limit 1`,
                values: [branchId, productId]
            }
            let cost = await client.query(query.text, query.values)
            const returnedData = {
                cost: cost && cost.rows && cost.rows.length > 0 ? cost.rows[0].cost : 0,
                costId: cost && cost.rows && cost.rows.length > 0 ? cost.rows[0].lineId : null,
                adjustement: []
            }

            return returnedData
        } catch (error: any) {

            throw new Error(error)
        }
    }
    private static async getAllAvailableQty(client: PoolClient, productId: string, branchId: string, createdAt: string) {
        try {
            const query = {
                text: `    WITH "qtyTotal" as (
                            select sum(qty) as "availableQty"
                            from "InventoryMovmentRecords"
                            where "productId" = $1
                            and "branchId" = $2
                            and "createdAt"<=$3
                        )
                        , "RunningTotal" AS (
                            SELECT 
                                "InventoryMovmentRecords"."referenceId" as "costId",
                                qty, 
                                "cost",
                                "createdAt",
                                SUM(qty) OVER (ORDER BY "createdAt" DESC) AS cumulative_qty
                            FROM "InventoryMovmentRecords"
                            WHERE "productId" = $1
                            AND "branchId" = $2
                            AND "qty" > 0
                                and  "InventoryMovmentRecords"."referenceTable"  IN ( 'InventoryTransfers',
                                                        'Billing',
                                                        'Opening Balance',
                                                        'Manual Adjustment (UnitCost Adjustment)')
                                              and "createdAt"<=$3
                        )
                        , "qtys" as (
                            SELECT "RunningTotal"."costId",
                                "createdAt",
                                sum(
                                    CASE
                                        WHEN cumulative_qty <= "availableQty" THEN qty
                                        WHEN cumulative_qty > "availableQty" AND cumulative_qty - qty < "availableQty" THEN qty - (cumulative_qty - "availableQty")
                                        ELSE 0
                                    END
                                ) as qty, 
                                "cost"
                            FROM "RunningTotal"
                            join "qtyTotal" on true
                            WHERE cumulative_qty <= "availableQty" OR (cumulative_qty - qty < "availableQty")
                            GROUP BY "RunningTotal"."costId", "cost", "createdAt"
                            ORDER BY "createdAt" ASC
                        )   
                        SELECT "qtys".*     
                        FROM "qtys"
                        WHERE "qty" > 0
                        ORDER BY "createdAt" ASC`,
                values: [productId, branchId, createdAt]
            }

            const costsProducts = await client.query(query.text, query.values);
            if (costsProducts && costsProducts.rows && costsProducts.rows.length > 0) {
                return costsProducts.rows;
            }
            return null
        } catch (error: any) {

            throw new Error(error)
        }
    }



    /** Physical Count Movments */
    private static async PhysicalCountMovment(physicalCountId: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: ` SELECT
                'PhysicalCount'::text AS "referenceTable",
                "PhysicalCountLines".id AS "referenceId",
                "PhysicalCounts".id AS "transactionId",
                "PhysicalCounts"."closedEmployeeId" AS "employeeId",
                "PhysicalCountLines"."productId",
                 0 AS cost,
                sum("PhysicalCountLines"."enteredQty"::text::numeric - "PhysicalCountLines"."expectedQty"::text::numeric) AS qty,
                "PhysicalCounts"."branchId",
                CAST("PhysicalCounts"."closedDate" as text) AS "createdAt",
                "Branches"."companyId"
                FROM "PhysicalCounts"
                 JOIN "PhysicalCountLines" ON "PhysicalCountLines"."physicalCountId" = "PhysicalCounts".id
                 JOIN "Products" ON "PhysicalCountLines"."productId" = "Products".id
                 JOIN "Branches" ON "Branches".id =  "PhysicalCounts"."branchId"
                 WHERE "PhysicalCounts".status = 'Closed'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "PhysicalCountLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "PhysicalCountLines"."parentId" IS NOT NULL)
                  and "PhysicalCountLines"."enteredQty" <>  "PhysicalCountLines"."expectedQty"
                  and "PhysicalCounts".id = $1 
              GROUP BY "PhysicalCounts".id, "PhysicalCountLines"."productId" ,  "Branches"."companyId" ,"PhysicalCountLines".id
              `,

                values: [physicalCountId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];

            await this.deleteMovments(client, referenceIds)
            let costs = await this.savePhyicalCountMovment(client, journals, physicalCountId)

            if (journals.length > 0) {
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                let productIds = journals.map(f => { return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })
                await this.setOnHand(client, productIds, branchId, companyId)
                // await this.recalculateUnitCost(client, productIds)
            }
            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    private static async savePhyicalCountMovment(client: PoolClient, journalList: any[], physicalCountId: string) {

        try {

            /**GET COST FOR EACH PRODUCT */
            const costProducts: any[] = []
            for (let index = 0; index < journalList.length; index++) {
                const element = journalList[index];
                let journal = new Movment()
                journal.ParseJson(element)
                let costData;
                if (journal.qty < 0) {
                    costData = await this.getProductCosts(client, element.productId, element.branchId, journal.qty, null);
                } else {
                    costData = await this.getLeatestCost(client, element.productId, element.branchId);
                }
                const cost = costData ? costData.cost : null;
                journal.id = element.referenceId + '_' + element.branchId + '_' + element.productId;

                journal.cost = isNaN(costData.cost) ? 0 : costData.cost,
                    journal.costId = costData.costId


                if (Math.abs(journal.qty) != 0)
                    await this.insertJournal(client, journal)
                if (journal.qty > 0) {
                    costProducts.push(journal)
                } else {
                    const costData = {
                        costId: journal.costId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId,
                    }
                    // let queueInstance = UnitCostQueue.getInstance();
                    // queueInstance.createJob({ type: "checkUpdatedCosts", data: costData })
                    costProducts.push({ type: "checkUpdatedCosts", data: costData })
                }


            }


            let costs = await this.productCost(client, costProducts, "PhysicalCount")
            return [...costs, ...costProducts]
            /** SAVE JOURNALS */
        } catch (error: any) {

            throw new Error(error)
        }
    }




    /** Billing  Movments */
    private static async billingMovment(billingId: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: `  SELECT 
                'Billing'::text AS "referenceTable",
                "BillingLines".id AS "referenceId",
                   "Billings".id AS "transactionId",
                "BillingLines"."employeeId",
                "Products".id AS "productId",
                 ("BillingLines"."baseAmount"::text::numeric - "BillingLines"."discountTotal"::text::numeric) / "qty"::text::numeric as "cost",
                "BillingLines".qty::text::numeric AS qty,
                "Billings"."branchId",
                cast (("Billings"."billingDate"::date + "BillingLines"."createdAt"::time) as text) as "createdAt",
                "Branches"."companyId"
                FROM "BillingLines"
                 JOIN "Products" ON "BillingLines"."productId" = "Products".id
                 JOIN "Billings" ON "BillingLines"."billingId" = "Billings".id AND( "Products".type::text = 'inventory'::text OR "Products".type::text = 'batch'::text AND "BillingLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "BillingLines"."parentId" IS NOT NULL)
                 JOIN "Branches" ON "Branches".id = "Billings"."branchId"
                 JOIN "Accounts" ON "BillingLines"."accountId" = "Accounts".id AND "Accounts"."companyId" = "Branches"."companyId" AND "Accounts"."parentType"::text = 'Other Current Assets'::text AND "Accounts".type::text = 'Inventory Assets'::text
                 where "Billings" .id =$1
                 and "Billings"."status" <> 'Draft'
                 GROUP BY "BillingLines".id, "Products".id, "Billings"."branchId" ,"Branches".id ,"Billings"."createdAt" , "Billings".id `,
                values: [billingId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            const companyId = journals.length > 0 ? journals[0].companyId : null;
            const branchId = journals.length > 0 ? journals[0].branchId : null;
            const productCosts = journals.map(f => {
                return {
                    "branchId": f.branchId,
                    "productId": f.productId
                }
            })


            let costs;
            let productIds = journals.map(f => { return { productId: f.productId } })
            if (journals.length > 0) {


                costs = await this.productCost(client, journals, "Billing")

            }
            await this.deleteMovments(client, referenceIds)
            await this.saveJournal(client, journals);
            if (productIds && productIds.length > 0) {
                await this.setOnHand(client, productIds, branchId, companyId)
            }

            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (productCosts && productCosts.length > 0) {
                this.setBranchUnitCostJob(productCosts)
            }
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /** Supplier Credit  Movments */
    private static async supplierCreditMovment(supplierCreditId: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: `  SELECT
                'Supplier Credit'::text AS "referenceTable",
                "SupplierCreditLines".id AS "referenceId",
                "SupplierCredits".id AS "transactionId",
                "SupplierCreditLines"."employeeId",
                "Products".id AS "productId",
                ("SupplierCreditLines"."baseAmount"::text::numeric - "SupplierCreditLines"."discountTotal"::text::numeric) /"SupplierCreditLines"."qty"::text::numeric  AS cost,
                "SupplierCreditLines".qty::text::numeric::double precision * '-1'::integer::double precision AS qty,
                "SupplierCredits"."branchId",
                 CAST( "SupplierCreditLines"."createdAt"  as text) as "createdAt",
                 "Branches"."companyId",
                    "BillingLines"."id" as "costId"
               FROM "SupplierCreditLines"
                 JOIN "Products" ON "SupplierCreditLines"."productId" = "Products".id
                 JOIN "SupplierCredits" ON "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'batch'::text AND "SupplierCreditLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "SupplierCreditLines"."parentId" IS NOT NULL)
                 Inner JOIN "BillingLines" on "BillingLines"."id" = "SupplierCreditLines"."billingLineId"
                 JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                 JOIN "Accounts" ON "SupplierCreditLines"."accountId" = "Accounts".id AND "Accounts"."companyId" = "Branches"."companyId" AND "Accounts"."parentType"::text = 'Other Current Assets'::text AND "Accounts".type::text = 'Inventory Assets'::text
                 where "SupplierCredits".id =$1
                GROUP BY "SupplierCreditLines".id,"BillingLines"."id" ,    "Products".id, "SupplierCredits"."branchId","Branches".id , "SupplierCredits".id`,
                values: [supplierCreditId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds)

            await this.saveJournal(client, journals);
            const costUpdates: any[] = [];
            for (let index = 0; index < journals.length; index++) {
                const element = journals[index];
                if (element.costId) {
                    // await this.checkUpdatedCosts(client, element.costId)
                    const costData = {
                        costId: element.costId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId,
                    }
                    // let queueInstance = UnitCostQueue.getInstance();
                    // queueInstance.createJob({ type: "checkUpdatedCosts", data: costData })

                    costUpdates.push({ type: "checkUpdatedCosts", data: costData })

                }
            }
            if (journals.length > 0) {
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                let productIds = journals.map(f => { return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })
                await this.setOnHand(client, productIds, branchId, companyId)
                // await this.recalculateUnitCost(client, productIds)
            }

            // await this.supplierCreditunitCost(client, supplierCreditId)
            await client.query("COMMIT")
            if (costUpdates && costUpdates.length > 0) {
                this.pushCostJobs(costUpdates)
            }
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    private static async oldJournals(client: PoolClient, companyId: string, referenceIds: any[]) {
        try {
            const query = {
                text: `SELECT "companyId","branchId","referenceId","qty",cast("createdAt" as text) as "createdAt", "productId" FROM "InventoryMovmentRecords" where "companyId"=$1 and "referenceId" = any($2) `,
                values: [companyId, referenceIds]
            }

            const journals = await client.query(query.text, query.values)
            return journals;
        } catch (error: any) {
            throw new Error(error)
        }
    }
    /** Invoice Movments */
    private static async invoicesMovment(invoiceIds: any[]) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")

            let costs;
            for (let index = 0; index < invoiceIds.length; index++) {
                const invoiceId = invoiceIds[index];
                const query = {
                    text: ` WITH "invoiceLines" AS (
                            SELECT "InvoiceLines".id FROM "InvoiceLines"
                            WHERE "InvoiceLines"."invoiceId" =$1
                            ), "linesMovmentTemp" AS (
							select 
							 	 'Invoice'::text AS "referenceTable",
                                "InvoiceLines".id AS "referenceId",
                                "InvoiceLines"."invoiceId" AS "transactionId",
                                "InvoiceLines"."employeeId",
                                 CAST("InvoiceLines"."createdAt" as text),
                                "InvoiceLines"."voidFrom",
                                "InvoiceLines"."waste",
								el->>'productId' as "productId",
								case when sum((el->>'qty')::numeric )>0 then sum(abs((el->>'cost')::numeric) ) else  sum(abs((el->>'cost')::numeric)  *-1) end  * '-1'  AS "cost",
								sum((el->>'qty')::numeric)  *-1  as "qty",
							    "Invoices"."branchId",
                                "Branches"."companyId",
                                 CAST("voidFrom"."createdAt" as text) as "costDate"
							from "InvoiceLines"
								       cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("InvoiceLines"."recipe") AS el
								         INNER JOIN "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId"
                                         left JOIN "InvoiceLines" "voidFrom" on  "InvoiceLines"."voidFrom" = "voidFrom".id
                                INNER JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
								where "InvoiceLines"."id" in (select * from "invoiceLines")
								
								group by     "voidFrom"."createdAt", "InvoiceLines"."id",el->>'productId' , "Invoices"."branchId",     "Branches".id, "InvoiceLines"."invoiceId"
							), "optionsMovments" AS (
                            SELECT
                                'Invoice'::text AS "referenceTable",
                                "InvoiceLineOptions"."invoiceLineId" AS "referenceId",
                                     "InvoiceLines"."invoiceId" AS "transactionId",
                                "InvoiceLines"."employeeId",
                                CAST("InvoiceLines"."createdAt" as text) as "createdAt",
                            
                                  "InvoiceLines"."voidFrom",
                                  "InvoiceLines"."waste",
                                el->>'productId' as "productId",
                                case when sum((el->>'qty')::numeric )>0 then sum(abs((el->>'cost')::numeric) ) else  sum(abs((el->>'cost')::numeric)  *-1) end  * '-1'  AS "cost",
								sum((el->>'qty')::numeric)  *-1  as "qty",
                                "Invoices"."branchId",
                                "Branches"."companyId",
                                 CAST("voidFrom"."createdAt" as text) as "costDate"
                          
                            FROM
                                "InvoiceLineOptions"
									    cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("InvoiceLineOptions"."recipe") AS el
                                INNER JOIN "InvoiceLines" ON "InvoiceLines".id = "InvoiceLineOptions"."invoiceLineId"
                                left JOIN "InvoiceLines" "voidFrom" on  "InvoiceLines"."voidFrom" = "voidFrom".id
                                INNER JOIN "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId"
                                INNER JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
                              WHERE "InvoiceLines".id IN   (SELECT * FROM "invoiceLines")
									group by      "voidFrom"."createdAt",  "InvoiceLines"."invoiceId" ,"InvoiceLines"."id",el->>'productId' , "Invoices"."branchId",     "Branches".id, "InvoiceLineOptions"."invoiceLineId" 
                            ), "all" as (
							select * from "linesMovmentTemp" 
							union all 
							select * from "optionsMovments")
                            select "referenceTable",
                                   "referenceId",
                                   "employeeId",
                                   "createdAt",
                                   "productId",
                                   "branchId",
                                   "companyId",
                                   "transactionId",
                                    "costDate",
                                    "voidFrom",
                                   sum( "cost"::text::numeric) as "cost",
                                   sum("qty"::text::numeric)as "qty"

                            from "all"
                            group by "referenceTable",
                                   "referenceId",
                                   "employeeId",
                                   "createdAt",
                                    "branchId",
                                   "companyId",
                                    "costDate",
                                    "voidFrom",
                                   "productId",
                                    "transactionId"
                            having   sum("qty"::text::numeric) <> 0 
                            
                            `,
                    values: [invoiceId]
                }
                let journal = await client.query(query.text, query.values);
                const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
                const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
                const branchId = journals && journals.length > 0 ? journals[0].branchId : null




                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const old = await this.oldJournals(client, companyId, referenceIds);
                const oldJournals = old && old.rows.length > 0 ? old.rows : []
                let oldBranches = old && oldJournals.length > 0 ? oldJournals[0].branchId : null
                costs = await this.saveInvoicJournal(client, journals, invoiceId, oldJournals, companyId, branchId);
                /** to recalculate unitCost + onHand only if branch is change */
                if (oldBranches) {
                    let productIds = journals.map(f => { return { productId: f.productId, branchId: oldBranches, createdAt: f.createdAt } })
                    await this.setOnHand(client, productIds, oldBranches, companyId)
                    let notvoidedproductIds = journals.map(f => { if (f.voidFrom == null) return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })
                    // await this.recalculateUnitCost(client, notvoidedproductIds, oldBranches)
                }

                /** for current branch unitCost and onHand */
                if (journals.length > 0) {

                    let productIds = journals.map(f => { return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })
                    await this.setOnHand(client, productIds, branchId, companyId)
                    // let notvoidedproductIds = journals.filter(f => f.voidFrom == null).map(f => { if (f.voidFrom == null) return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })
                    // console.log("notvoidedproductIds items", notvoidedproductIds)
                    // await this.recalculateUnitCost(client, notvoidedproductIds)
                    // let voidedJournals = journals.filter(f => f.voidFrom);

                    // console.log("voided items", voidedJournals)
                    // if (voidedJournals && voidedJournals.length > 0) {
                    //     this.updateCost(client, voidedJournals, invoiceId, false, 'Invoice');
                    // }
                }
            }



            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    private static async getExcludedProducts(client: PoolClient, productIds: any[], companyId: string, branchId: string, id: string) {
        try {

            const query = {
                text: `SELECT 
                            "Products".id AS "productId"
                        FROM "Invoices"
                        INNER JOIN "Products"
                            ON "Products"."companyId" = $1 and "Products"."type" = 'inventory' and "Products".id = any($4)
                        WHERE "Invoices"."companyId" = $1
                        AND "Invoices"."branchId" = $2
                        AND "Invoices".id = $3
                        AND "Invoices"."serviceId" IS NOT NULL 
                         AND  (
                            "Products"."productDeduction" @> to_jsonb(ARRAY["Invoices"."serviceId"]::text[])
                        );`,

                values: [companyId, branchId, id, productIds]

            }

            let ids = await client.query(query.text, query.values);
            return ids.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static async saveInvoicJournal(client: PoolClient, journalList: any[], invoiceId: string, oldJournals: any[], companyId: string, branchId: string) {
        try {




            const costs: any[] = []

            const prductIds = journalList.map(f => f.productId);

            const excludedProducts = await this.getExcludedProducts(client, prductIds, companyId, branchId, invoiceId)
            for (let index = 0; index < journalList.length; index++) {
                const element: any = journalList[index];
                const journal = new Movment();
                journal.ParseJson(element);

                if (excludedProducts && excludedProducts.length > 0) {
                    const pro = excludedProducts.find(f => f.productId == element.productId)
                    if (pro) continue
                }

                let isLineJournalExist = oldJournals.find(f => f.referenceId == journal.referenceId && f.productId == journal.productId)


                let now = moment().format('DD-MM-YYYY');
                let journalDate = moment(journal.createdAt).format('DD-MM-YYYY');
                console.log(!isLineJournalExist)
                console.log(moment(now, 'DD-MM-YYYY').isAfter(moment(journalDate, 'DD-MM-YYYY')))
                let changeFlag = false;
                if ((!isLineJournalExist) && moment(now, 'DD-MM-YYYY').isAfter(moment(journalDate, 'DD-MM-YYYY'))) {
                    const costData = await this.getCostByDate(client, journal.productId, journal.branchId, journal.createdAt)
                    journal.cost = costData.cost
                    journal.costId = costData.costId
                    journal.transactionId = invoiceId
                    const costToUpdate = {
                        costId: journal.costId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId
                    }
                    // let queueInstance = UnitCostQueue.getInstance();
                    // queueInstance.createJob({ type: "checkUpdatedCosts", data: costData })
                    costs.push({ type: "checkUpdatedCosts", data: costToUpdate })
                    changeFlag = true;
                } else if (!isLineJournalExist) {
                    if (journal.qty < 0) {
                        const costData = await this.getProductCosts(client, journal.productId, journal.branchId, journal.qty, journal.referenceId)
                        journal.cost = costData.cost
                        journal.costId = costData.costId
                        journal.transactionId = invoiceId
                    } else {/** voided Invoices */
                        const costData = await this.getLeatestCost(client, journal.productId, journal.branchId)
                        journal.cost = costData.cost
                        journal.costId = costData.costId
                        journal.transactionId = invoiceId
                        let cost = await this.productCost(client, [journal], 'Voided Invoice')
                        if (cost && cost.length > 0) {
                            costs.push(cost[0])
                        }
                    }
                    changeFlag = true;
                } else if (journal.qty != isLineJournalExist.qty) {
                    const costData = await this.getCostByDate(client, journal.productId, journal.branchId, journal.createdAt)
                    journal.cost = costData.cost
                    journal.costId = costData.costId
                    journal.transactionId = invoiceId
                    const costToUpdate = {
                        costId: journal.costId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId
                    }
                    costs.push({ type: "checkUpdatedCosts", data: costToUpdate })
                    changeFlag = true;
                } else {
                    continue;
                }


                if (changeFlag) {
                    await client.query('DELETE FROM "InventoryMovmentRecords" where "referenceId" = $1 and "productId" = $2', [journal.referenceId, journal.productId])
                    if (Math.abs(journal.qty) != 0)
                        await this.insertJournal(client, journal)
                }


            }
            return costs
        } catch (error: any) {
            console.log(error)

            throw new Error(error)
        }
    }


    /** CreditNote Movments */
    private static async creditNoteMovment(crediteNoteIds: any[]) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            let costs;
            for (let index = 0; index < crediteNoteIds.length; index++) {
                const crediteNoteId = crediteNoteIds[index];
                let query = {
                    text: `  SELECT 
												  "InventoryMovmentRecords"."productId",
                                                  "InventoryMovmentRecords"."branchId",
	                                              "CreditNoteLines"."id" as "referenceId",
	                                              "CreditNoteLines"."creditNoteId" as "transactionId",
                                                   COALESCE("InventoryMovmentRecords"."referenceCostId","InvoiceLines".id) as "referenceCostId",
                                                   "InventoryMovmentRecords".cost as "cost",
                                                   "CreditNoteLines".qty *    ( ABS("InventoryMovmentRecords"."qty") / "InvoiceLines"."qty") as "qty",
                                            	   "InventoryMovmentRecords"."costId",
												   'CreditNote'::text AS "referenceTable",
												       "CreditNoteLines"."employeeId",
													   "CreditNoteLines"."createdAt",
													     "Branches"."companyId",
                                                         "CreditNotes"."invoiceId"
                                            FROM "CreditNoteLines"
											INNER JOIN "CreditNotes" ON "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                            inner join "InvoiceLines" on "InvoiceLines"."id" = "CreditNoteLines"."invoiceLineId"
                                            inner join "InventoryMovmentRecords" on "InvoiceLines"."id" = "InventoryMovmentRecords"."referenceId" 
											 INNER JOIN "Branches" ON "Branches".id = "CreditNotes"."branchId"

                                            where "CreditNoteLines"."creditNoteId" =$1
                         `,
                    values: [crediteNoteId]
                }
                let journal = await client.query(query.text, query.values);
                const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];





                const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
                await this.deleteMovments(client, referenceIds)
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                const invoiceId = journals.length > 0 ? journals[0].invoiceId : null;
                costs = await this.saveCreditNoteJournal(client, journals, crediteNoteId, companyId, branchId, invoiceId)

                if (journals.length > 0) {
                    let productIds = journals.map(f => { return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })

                    await this.setOnHand(client, productIds, branchId, companyId)
                    // await this.updateCost(client, journals, crediteNoteId, false, 'Credit Note')
                    // await this.recalculateUnitCost(client, productIds)
                }
            }

            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
        } catch (error: any) {
            console.log(error)

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    private static async saveCreditNoteJournal(client: PoolClient, journalList: any[], crediteNoteId: string, companyId: string, branchId: string, invoiceId: string) {
        try {
            const costs: any[] = []
     
            for (let index = 0; index < journalList.length; index++) {
                const element = journalList[index];
             
                const journal = new Movment()
                journal.ParseJson(element)
                let now = moment().format('DD-MM-YYYY');
                let journalDate = moment(journal.createdAt).format('DD-MM-YYYY');

                if (now > journalDate) {
                    const costData = await this.getCostByDate(client, journal.productId, journal.branchId, journal.createdAt)
                    element.cost = costData.cost
                    element.costId = costData.costId
                    element.transactionId = crediteNoteId
                } else {
                    const productCost = await this.getLeatestCost(client, journal.productId, journal.branchId);


                    element.costId = productCost.costId;
                    element.cost = productCost.cost;
                    element.transactionId = crediteNoteId;
                }




                if (Math.abs(element.qty) != 0)
                    await this.insertJournal(client, element)
                let cost = await this.productCost(client, [element], "CreditNote")
                costs.push(cost[0])
            }
            return costs

        } catch (error: any) {

            throw new Error(error)
        }
    }





    /** Transfer Movments */
    /** Transfer Movments */
    /** Transfer Movments */
    private static async inventortTransferMovment(transferId: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: ` 
               select
                'InventoryTransfers'::text AS "referenceTable",
                 "InventoryTransferLines".id AS "referenceId",
                 "InventoryTransfers".id AS "transactionId",
                "InventoryTransfers"."employeeId",
                "InventoryTransferLines"."productId",
                 0 ::numeric AS cost,
                "InventoryTransferLines".qty::text::numeric::text::numeric * '-1'::integer::numeric AS qty,
                "InventoryTransfers"."branchId",
                  CAST("InventoryTransfers"."confirmDatetime" as text)  AS "createdAt",
                "InventoryTransfers".type,
                 "InventoryTransfers"."destinationBranch",
                "Branches"."companyId"
               FROM "InventoryTransfers"
                 JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
                 JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
                 JOIN "Branches" ON "Branches".id =  "InventoryTransfers"."branchId"
              WHERE "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text  OR "Products".type::text = 'kit' OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
              AND  "InventoryTransfers".id =$1
                       and  "InventoryTransferLines".qty <> 0 
              GROUP BY "InventoryTransfers".id, "InventoryTransferLines"."productId","Branches".id ,"InventoryTransferLines".id
            UNION ALL
             SELECT
                'InventoryTransfers'::text AS "referenceTable",
                "InventoryTransferLines".id AS "referenceId",
                "InventoryTransfers".id AS "transactionId",
                "InventoryTransfers"."employeeId",
                "InventoryTransferLines"."productId",
                0 AS cost,
               "InventoryTransferLines".qty AS qty,
                "InventoryTransfers"."destinationBranch" AS "branchId",
               cast ( "InventoryTransfers"."confirmDatetime" as text)  AS "createdAt",
                     "InventoryTransfers".type,
                     "InventoryTransfers"."destinationBranch",
                "Branches"."companyId"
               FROM "InventoryTransfers"
                 JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
                 JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
                 JOIN "Branches" ON "Branches".id =  "InventoryTransfers"."branchId"
              WHERE "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("InventoryTransfers"."destinationBranch" IS NOT NULL AND "Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
              AND  "InventoryTransfers".id =$1
                       and  "InventoryTransferLines".qty <> 0 
                        and "InventoryTransfers"."destinationBranch" IS NOT NULL
              GROUP BY "InventoryTransfers".id, "InventoryTransferLines"."productId","Branches".id,"InventoryTransferLines".id
            UNION ALL
             SELECT 
             'InventoryTransfers'::text AS "referenceTable",
             "InventoryTransferLines".id AS "referenceId",
             "InventoryTransfers".id AS "transactionId",
             "InventoryTransfers"."employeeId",
             "InventoryTransferLines"."productId",
                 "InventoryTransferLines"."unitCost" AS cost,
             "InventoryTransferLines".qty::text::numeric AS qty,
             "InventoryTransfers"."branchId",
             CAST("InventoryTransfers"."confirmDatetime" as text) AS "createdAt",
             "InventoryTransfers".type,
              "InventoryTransfers"."destinationBranch",
             "Branches"."companyId"
             FROM "InventoryTransfers"
                 LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
                 LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
                 JOIN "Branches" ON "Branches".id =  "InventoryTransfers"."branchId"
              WHERE "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer In'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
              AND  "InventoryTransfers".id =$1
              and  "InventoryTransferLines".qty <> 0 
              GROUP BY "InventoryTransfers".id, "InventoryTransferLines"."productId" ,"Branches".id ,"InventoryTransferLines".id`,
                values: [transferId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds)
            let costs = await this.saveinventoryTransferJournal(client, journals, transferId);
            const branchCosts = journals.filter(f => f.qty > 0).map(t => { return { "productId": t.productId, "branchId": t.branchId } })
            if (journals.length > 0) {
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                const distBranch = journals.find(f => f.destinationBranch)
                const distBranchId = distBranch ? distBranch.destinationBranch : null
                let productIds = journals.map(f => { return { productId: f.productId } })
                await this.setOnHand(client, productIds, branchId, companyId)

                if (distBranchId) {
                    await this.setOnHand(client, productIds, distBranchId, companyId)
                }
                // const inventoryTransferOutJournals = journals.filter(f => f.type == 'Transfer Out')
                // console.log(inventoryTransferOutJournals)
                // const inventoryTransferInJournals = journals.filter(f => f.type == 'Transfer In')
                // console.log(inventoryTransferInJournals, inventoryTransferOutJournals.length, (inventoryTransferOutJournals && inventoryTransferOutJournals.length > 0))
                // // if (inventoryTransferOutJournals && inventoryTransferOutJournals.length > 0) {
                //     let productIds = inventoryTransferOutJournals.map(f => { return { productId: f.productId, branchId: f.branchId, createdAt: f.createdAt } })
                //     await this.recalculateUnitCost(client, productIds)
                // }

                // if (inventoryTransferInJournals && inventoryTransferInJournals.length > 0) {
                //     await this.updateCost(client, inventoryTransferInJournals, transferId, false, 'Inventory Transfer')
                // }

            }
            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }

    }


    private static async saveinventoryTransferJournal(client: PoolClient, journalList: any[], invoiceId: string) {
        try {

            let transfersIn = journalList.filter(f => f.qty > 0)
            let transfersOut = journalList.filter(f => f.qty < 0)
            const costs: any[] = [];

            let journals: any[] = [];
            if (transfersOut && transfersOut.length > 0) {
                for (let index = 0; index < transfersOut.length; index++) {
                    const element = transfersOut[index];
                    const journal = new Movment()
                    journal.ParseJson(element)

                    const productCost = await this.getProductCosts(client, element.productId, element.branchId, element.qty, null);
                    console.log("hereeeeeeeeeeeee", productCost)
                    journal.cost = productCost.cost
                    journal.costId = productCost.costId
                    journals.push(journal)
                    const costData = {
                        costId: journal.costId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId,
                    }
                    costs.push({ type: "checkUpdatedCosts", data: costData })
                }
            }

            for (let index = 0; index < transfersIn.length; index++) {
                const element = transfersIn[index];
                const journal = new Movment()
                journal.ParseJson(element)
                if (element.type == 'Transfer Out') {
                    let movment = journals.find(f => f.referenceId == journal.referenceId);

                    if (movment) {
                        journal.cost = movment.cost;
                        journal.referenceCostId = movment.referenceId;
                    }
                }
                let cost = await this.productCost(client, [journal], "Transfer In")
                costs.push(cost[0])
                journals.push(journal)
            }

            for (let index = 0; index < journals.length; index++) {
                const element = journals[index];
                if (Math.abs(element.qty) != 0)
                    await this.insertJournal(client, element)

            }
            return costs;

        } catch (error: any) {
            console.log(error)

            throw new Error(error)
        }
    }

    /** Adjustment Movments */
    private static async manualAdjusmentMovment(movmentIds: string, adjustmentType: string | null) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: ` 
            SELECT 
            CASE
             WHEN "childParents".id IS NOT NULL THEN ("InventoryMovments".type::text || ' '::text) || "childParents".name::text
                    ELSE "InventoryMovments".type::text
            END AS "referenceTable",
            "InventoryMovmentLines".id AS "referenceId",
            "InventoryMovments".id AS "transactionId",
            "InventoryMovments"."employeeId",
            "InventoryMovmentLines"."productId",
            "InventoryMovmentLines". "cost" AS cost,
            "InventoryMovmentLines".qty ,
             "InventoryMovments"."branchId",
             CAST(( case when "InventoryMovments"."inventoryMovmentDate" is not null then"InventoryMovments"."inventoryMovmentDate"::date + "InventoryMovments"."createdAt"::time else  "InventoryMovments"."createdAt" end) as text) as "createdAt",
             "Branches"."companyId",
                          "Products"."type" as "productType"
             FROM "InventoryMovments"
             JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
             JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
             JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"
            
             LEFT JOIN "Products" "childParents" ON "childParents".id = "InventoryMovmentLines"."parentChildId"
             where "InventoryMovments".id = any($1)
                     
             `,
                values: [movmentIds]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds)








            let costs = await this.saveManualAdjustmentMovment(client, journals, adjustmentType);

            const branchCosts = journals.filter(f => f.qty >= 0).map(t => {
                return {
                    "productId": t.productId,
                    "branchId": t.branchId
                }
            })
            if (journals.length > 0) {
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                let productIds = journals.map(f => { return { productId: f.productId } })
                if (adjustmentType != 'unitCost adjustment') {
                    await this.setOnHand(client, productIds, branchId, companyId)
                }

            }

            await client.query("COMMIT")
            if (adjustmentType == 'unitCost adjustment' && branchCosts && branchCosts.length > 0) {
                await this.setBranchUnitCostJob(branchCosts)
            }
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    private static async saveManualAdjustmentMovment(client: PoolClient, journalList: any[], type: string | null) {
        try {
            const productIds: any[] = []
            const costs: any[] = []
            let companyId;
            let branchId;
            for (let index = 0; index < journalList.length; index++) {
                const element = journalList[index];
                let currentMovment = new Movment()
                currentMovment.ParseJson(element);
                let totalQty = 0
                companyId = element.companyId;
                branchId = element.branchId;
                if (type == 'unitCost adjustment') {


                    let availableCostQty = await this.getAllAvailableQty(client, element.productId, element.branchId, element.createdAt);

                    if (availableCostQty && availableCostQty.length > 0) {
                        totalQty = availableCostQty.filter(f => f.qty > 0).reduce((total, obj) => total + obj.qty, 0);

                        if (totalQty && !isNaN(totalQty) && totalQty > 0) {

                            for (let costIndex = 0; costIndex < availableCostQty.length; costIndex++) {
                                const cost = availableCostQty[costIndex];
                                const movment = new Movment();
                                movment.ParseJson(element)
                                movment.qty = cost.qty * (-1)
                                movment.cost = isNaN(cost.cost) ? 0 : cost.cost
                                movment.costId = cost.costId
                                movment.referenceId = element.referenceId
                                movment.transactionId = element.transactionId
                                movment.employeeId = element.employeeId
                                movment.companyId = element.companyId
                                movment.referenceTable = 'Manual Adjustment (UnitCost Adjustment)'

                                await this.insertJournal(client, movment)
                                if (costIndex == 0) {
                                    const costToUpdate = {
                                        costId: movment.costId,
                                        productId: movment.productId,
                                        branchId: movment.branchId,
                                        companyId: movment.companyId
                                    }
                                    costs.push({ type: "checkUpdatedCosts", data: costToUpdate })
                                }

                            }

                        }


                    }
                    currentMovment.referenceTable = 'Manual Adjustment (UnitCost Adjustment)'
                    currentMovment.qty = totalQty
                    currentMovment.cost = isNaN(currentMovment.cost) ? 0 : currentMovment.cost
                    currentMovment.referenceId = currentMovment.transactionId

                    await this.insertJournal(client, currentMovment)
                    element.qty = totalQty
                    // let cost = await this.productCost(client, [element], "UnitCost Adjustment")
                    // costs.push(cost[0])
                } else {

                    let availableCostQty
                    if (currentMovment.productType != "batch" && currentMovment.productType != "serialized") {
                        if (currentMovment.qty < 0) {
                            availableCostQty = await this.getProductCosts(client, element.productId, element.branchId, currentMovment.qty, null);
                        } else {
                            availableCostQty = await this.getLeatestCost(client, element.productId, element.branchId);
                        }
                        if (availableCostQty) {
                            let productCost = availableCostQty
                            currentMovment.cost = productCost.cost
                            currentMovment.costId = productCost.costId
                        }
                    }


                    await this.insertJournal(client, currentMovment)
                    if (currentMovment.qty > 0) {
                        let cost = await this.productCost(client, [currentMovment], "OnHand Adjustment")
                        costs.push(cost[0])
                    }
                    productIds.push({ productId: currentMovment.productId })
                }
            }
            await this.setOnHand(client, productIds, branchId, companyId)
            return costs
        } catch (error: any) {

            throw new Error(error)
        }
    }

    private static async deleteProductManualAdustment(movmentIds: string) {
        const client = await DB.excu.client(5 * 60);
        try {
            console.log("deleteProductdeleteProductdeleteProductdeleteProduct", movmentIds)
            await client.query("BEGIN")
            const query = {
                text: ` 
            SELECT 
            CASE
             WHEN "childParents".id IS NOT NULL THEN ("InventoryMovments".type::text || ' '::text) || "childParents".name::text
                    ELSE "InventoryMovments".type::text
            END AS "referenceTable",
            "InventoryMovmentLines".id AS "referenceId",
            "InventoryMovments".id AS "transactionId",
            "InventoryMovments"."employeeId",
            "InventoryMovmentLines"."productId",
            "InventoryMovmentLines". "cost" AS cost,
            "InventoryMovmentLines".qty ,
             "InventoryMovments"."branchId",
             CAST(( case when "InventoryMovments"."inventoryMovmentDate" is not null then"InventoryMovments"."inventoryMovmentDate"::date + "InventoryMovments"."createdAt"::time else  "InventoryMovments"."createdAt" end) as text) as "createdAt",
             "Branches"."companyId"
             FROM "InventoryMovments"
             JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
             JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
             JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"
            
             LEFT JOIN "Products" "childParents" ON "childParents".id = "InventoryMovmentLines"."parentChildId"
             where "InventoryMovments".id = any($1)
            
             `,
                values: [movmentIds]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const companyId = journals.length > 0 ? journals[0].companyId : null;
            const branchId = journals.length > 0 ? journals[0].branchId : null;
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds)
            for (let index = 0; index < journals.length; index++) {
                const element = journals[index];
                if (Math.abs(element.qty) != 0)
                    await this.insertJournal(client, element)
            }
            const branchCosts = journals.filter(f => f.qty >= 0).map(t => {
                return {
                    "productId": t.productId,
                    "branchId": t.branchId
                }
            })

            let productIds = journals.map(f => { return { productId: f.productId } })
            await this.setOnHand(client, productIds, branchId, companyId)

            await client.query("COMMIT")
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }



    /** Parent Movments */
    public static async parentChildMovment(invoiceIds: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: ` 
                SELECT 
            "InventoryMovments".type AS "referenceTable",
            "InventoryMovmentLines".id AS "referenceId",
            "InventoryMovments".id AS "transactionId",
            "InventoryMovments"."employeeId",
            "InventoryMovmentLines"."productId",
             0 AS cost,
            sum("InventoryMovmentLines".qty::text::numeric) AS qty,
            "InventoryMovments"."branchId",
            CAST("InvoiceLines"."createdAt" as text ) "createdAt",
            "Branches"."companyId",
           "InventoryMovments"."type", 
           "Products"."childQty" ,
            "Products"."parentId"  as "productCostId",
            "InventoryMovments"."invoiceLineId" as "referenceWithId",
             "Products"."parentId" 
            FROM "InventoryMovments"
             JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
             JOIN "InvoiceLines" on "InvoiceLines".id = "InventoryMovments"."invoiceLineId"
             JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
             JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"
             where "InvoiceLines"."invoiceId" = any($1)
             group by "referenceTable" , "InventoryMovmentLines".id , "Products".id, "InvoiceLines".id,   "InventoryMovments".id ,  "Branches"."companyId","InventoryMovmentLines"."productId"
             `,
                values: [invoiceIds]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds)
            const companyId = journals.length > 0 ? journals[0].companyId : null;
            const branchId = journals.length > 0 ? journals[0].branchId : null;
            let costs = await this.saveParentChildMovment(client, journals);
            const branchCosts = journals.filter(f => f.qty >= 0).map(m => {
                return {
                    "productId": m.productId,
                    "branchId": m.branchId
                }
            })
            if (journals.length > 0) {

                let productIds = journals.map(f => { return { productId: f.productId } })
                await this.setOnHand(client, productIds, branchId, companyId)

            }
            await client.query("COMMIT")

            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    private static async saveParentChildMovment(client: PoolClient, journalList: any[]) {
        try {

            const journals: any[] = []
            const costs: any[] = []

            const duplicates: any[] = [];
            const uniques: any[] = [];
            const noParent: any[] = [];

            const productCount: Record<string, number> = {};
            journalList.forEach(p => {
                if (p.parentId) {
                    productCount[p.productId] = (productCount[p.productId] || 0) + 1;
                }
            });
            journalList.forEach(p => {

                if (productCount[p.productId] > 1) {
                    duplicates.push(p);
                } else if (!p.parentId) {
                    noParent.push(p);
                } else {
                    uniques.push(p);
                }
            });

            let parentUnitCost = 0
            let parentId = ""
            let parent
            if (noParent && noParent.length > 0) {
                parent = noParent[0];
                parentId = parent.productId
                const productCost = await this.getProductCosts(client, parentId, parent.branchId, parent.qty, parent.referenceId)
                parentUnitCost = productCost.cost
                parent.cost = productCost.cost
                parent.costId = productCost.costId
                journals.push(parent)
            } else if (duplicates && duplicates.length) {
                parent = duplicates.find(f => f.qty < 0)
                parentId = parent.productId
                const productCost = await this.getProductCosts(client, parentId, parent.branchId, parent.qty, parent.referenceId)
                parentUnitCost = productCost.cost ?? 0
                parent.cost = productCost.cost ?? 0
                parent.costId = productCost.costId
                journals.push(parent)
            } else if (uniques && uniques.length > 1) {
                parent = uniques.find(f => f.qty < 0)
                parentId = parent.productId
                const productCost = await this.getProductCosts(client, parentId, parent.branchId, parent.qty, parent.referenceId)
                parentUnitCost = productCost.cost ?? 0
                parent.cost = productCost.cost ?? 0
                parent.costId = productCost.costId
                journals.push(parent)
            }


            if (duplicates && duplicates.length > 0) {
                let middleParent = duplicates.find(f => f.qty > 0);
                if (middleParent) {
                    let cost = parentUnitCost && parentUnitCost > 0 ? parent.cost / middleParent.qty : 0;
                    middleParent.cost = cost;
                    journals.push(middleParent)
                }

                let temp = duplicates.find(f => f.qty < 0);
                if (temp) {
                    temp.cost = parentUnitCost && parentUnitCost > 0 ? middleParent.cost : 0
                    journals.push(temp)
                    parent = temp;
                    parentUnitCost = parent.cost
                }

            }

            if (uniques && uniques.length > 0) {
                let child = uniques.find(f => f.qty > 0)
                if (child) {
                    let cost = parentUnitCost && parentUnitCost > 0 ? parent.cost / child.qty : 0
                    child.cost = cost
                    journals.push(child)
                }
            }

            // for (let index = 0; index < parentMovments.length; index++) {
            //     const element = parentMovments[index];
            //     const journal = new Movment()
            //     journal.ParseJson(element)
            //     const productCost = await this.getProductCosts(client, element.productId, element.branchId, element.qty, null);
            //     journal.cost = productCost.cost
            //     journal.costId = productCost.costId
            //     journals.push(journal)

            // }
            // for (let index = 0; index < childMovments.length; index++) {
            //     const element = childMovments[index];
            //     const journal = new Movment()
            //     journal.ParseJson(element)
            //     const parent = journals.find(f => f.productId == element.productCostId);
            //     journal.cost = journal.childQty && journal.childQty != 0 ? parent.cost / journal.childQty : parent.cost
            //     journal.childQty = element.childQty
            //     journals.push(journal)
            //     // let datat = await client.query(`UPDATE "InventoryMovmentRecords" set "costId" = $1 ,"cost"=$2 where "referenceId"=$3 returning "referenceId"`, [journal.referenceId,journal.cost,element.referenceWithId])
            //     // console.log(datat.rows)
            // }

            console.log(journals)
            for (let index = 0; index < journals.length; index++) {
                const element = journals[index];
                if (Math.abs(element.qty) != 0)
                    await this.insertJournal(client, element)
                if (element.qty > 0) {
                    let cost = await this.productCost(client, [element], "Child Movment")
                    if (cost && cost.length > 0)
                        costs.push(cost)
                }

            }

            return costs
        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }
    private static async parentChildMovmentInventoryTransfer(transferId: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: ` 
                
                SELECT 
                "InventoryMovments".type AS "referenceTable",
            "InventoryMovmentLines".id AS "referenceId",
            "InventoryMovments".id AS "transactionId",
            "InventoryMovments"."employeeId",
            "InventoryMovmentLines"."productId",
            0  AS cost,
            sum("InventoryMovmentLines".qty::text::numeric) AS qty,
            "InventoryMovments"."branchId",
             CAST( "InventoryMovments"."createdAt" as text) as "createdAt",
            "Branches"."companyId",
                 "InventoryMovments"."type", 
            "Products"."childQty",
          COALESCE("Products"."parentId" ,"Products".id) as "productCostId",
           "InventoryMovments"."inventoryTransferLineId" as "referenceWithId",
           "Products"."parentId"
           FROM "InventoryMovments"
             JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
             JOIN "InventoryTransferLines" on "InventoryTransferLines".id = "InventoryMovments"."inventoryTransferLineId"
             JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"

             JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"            
               where "InventoryTransferLines"."inventoryTransferId" = any($1)
             group by "referenceTable","Products"."parentId" ,"Products".id, "Products"."childQty", "InventoryMovmentLines".id ,     "InventoryMovments".id ,  "Branches"."companyId","InventoryMovmentLines"."productId"
             `,
                values: [transferId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            const branchCosts = journals.filter(f => f.qty >= 0).map(m => {
                return {
                    "productId": m.productId,
                    "branchId": m.branchId
                }
            })
            await this.deleteMovments(client, referenceIds)

            let costs = await this.saveParentChildMovment(client, journals);

            if (journals.length > 0) {
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                let productIds = journals.map(f => { return { productId: f.productId } })
                await this.setOnHand(client, productIds, branchId, companyId)

            }
            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    private static async kitChildMovment(transferId: string) {
        const client = await DB.excu.client(5 * 60);
        try {

            await client.query("BEGIN")
            const query = {
                text: ` 
                
                SELECT 
                "InventoryMovments".type AS "referenceTable",
            "InventoryMovmentLines".id AS "referenceId",
            "InventoryMovments".id AS "transactionId",
            "InventoryMovments"."employeeId",
            "InventoryMovmentLines"."productId",
            0  AS cost,
            sum("InventoryMovmentLines".qty::text::numeric) AS qty,
            "InventoryMovments"."branchId",
             CAST( "InventoryMovments"."createdAt" as text) as "createdAt",
            "Branches"."companyId",
                 "InventoryMovments"."type", 
            "Products"."childQty",
          COALESCE("Products"."parentId" ,"Products".id) as "productCostId",
           "InventoryMovments"."inventoryTransferLineId" as "referenceWithId",
           "Products"."parentId"
           FROM "InventoryMovments"
             JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
             JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
             JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"            
               where "InventoryMovments"."id" = any($1)
             group by "referenceTable","Products"."parentId" ,"Products".id, "Products"."childQty", "InventoryMovmentLines".id ,     "InventoryMovments".id ,  "Branches"."companyId","InventoryMovmentLines"."productId"
             `,
                values: [transferId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds)

            let costs = await this.saveParentChildMovment(client, journals);

            if (journals.length > 0) {
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                let productIds = journals.map(f => { return { productId: f.productId } })
                await this.setOnHand(client, productIds, branchId, companyId)

            }
            const branchCosts = journals.filter(f => f.qty >= 0).map(m => {
                return {
                    "productId": m.productId,
                    "branchId": m.branchId
                }
            })
            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /** Kit Movments */
    private static async kitBuildProductCost(id: string) {
        const client = await DB.excu.client()
        try {

            let costs: any[] = []
            await client.query("BEGIN")
            const query = {
                text: ` SELECT 
                        CASE
                        WHEN "childParents".id IS NOT NULL THEN ("InventoryMovments".type::text || ' '::text) || "childParents".name::text
                        ELSE "InventoryMovments".type::text
                        END AS "referenceTable",
                        "InventoryMovmentLines".id AS "referenceId",
                        "InventoryMovmentLines".id AS "transactionId",
                        "InventoryMovments"."employeeId",
                        "InventoryMovmentLines"."productId",
                        "InventoryMovmentLines". "cost" AS cost,
                        "InventoryMovmentLines".qty ,
                        "InventoryMovments"."branchId",
                        CAST(( case when "InventoryMovments"."inventoryMovmentDate" is not null then"InventoryMovments"."inventoryMovmentDate"::date + "InventoryMovments"."createdAt"::time else  "InventoryMovments"."createdAt" end) as text) as "createdAt",
                        "Branches"."companyId",
                        "Products"."type" as "productType"
                        FROM "InventoryMovments"
                        JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
                        JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
                        JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"
                        LEFT JOIN "Products" "childParents" ON "childParents".id = "InventoryMovmentLines"."parentChildId"
                        where "InventoryMovments".id = any($1)
                     `,
                values: [id]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds);

            const kitProduct = journals.find(f => f.qty > 0)
            const kitBuilderProduct = journals.filter(f => f.qty < 0)


            let totalCost = 0
            const journalList: any[] = [];
            for (let index = 0; index < kitBuilderProduct.length; index++) {
                const element = kitBuilderProduct[index];
                const movment = new Movment();
                movment.ParseJson(element);


                const productCost = await this.getProductCosts(client, element.productId, element.branchId, element.qty, null);

                movment.cost = productCost.cost
                movment.costId = productCost.costId

                totalCost += (movment.cost * Math.abs(movment.qty))
                journalList.push(movment)

            }
            kitProduct.cost = totalCost / Math.abs(kitProduct.qty)
            journalList.push(kitProduct)

            for (let index = 0; index < journalList.length; index++) {
                const element = journalList[index];
                if (Math.abs(element.qty) != 0)
                    await this.insertJournal(client, element)

                if (element.qty > 0) {
                    const cost = await this.productCost(client, [element], 'Kit Build')
                    costs.push(cost[0])
                }

            }
            if (journals.length > 0) {
                let productIds = journals.map(f => { return { productId: f.productId } })
                const companyId = journals.length > 0 ? journals[0].companyId : null;
                const branchId = journals.length > 0 ? journals[0].branchId : null;
                await this.setOnHand(client, productIds, branchId, companyId)


            }
            const branchCosts = journals.filter(f => f.qty >= 0).map(m => {
                return {
                    "productId": m.productId,
                    "branchId": m.branchId
                }
            })
            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    private static async kitBreakProductCost(id: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let costs: any[] = [];
            const query = {
                text: ` SELECT 
                        CASE
                        WHEN "childParents".id IS NOT NULL THEN ("InventoryMovments".type::text || ' '::text) || "childParents".name::text
                        ELSE "InventoryMovments".type::text
                        END AS "referenceTable",
                        "InventoryMovmentLines".id AS "referenceId",
                        "InventoryMovmentLines".id AS "transactionId",
                        "InventoryMovments"."employeeId",
                        "InventoryMovmentLines"."productId",
                        "InventoryMovmentLines". "cost" AS cost,
                        "InventoryMovmentLines".qty ,
                        "InventoryMovments"."branchId",
                        CAST(( case when "InventoryMovments"."inventoryMovmentDate" is not null then"InventoryMovments"."inventoryMovmentDate"::date + "InventoryMovments"."createdAt"::time else  "InventoryMovments"."createdAt" end) as text) as "createdAt",
                        "Branches"."companyId",
                        "Products"."type" as "productType"
                        FROM "InventoryMovments"
                        JOIN "InventoryMovmentLines" ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
                        JOIN "Products" ON "Products".id = "InventoryMovmentLines"."productId"
                        JOIN "Branches" ON "Branches".id = "InventoryMovments"."branchId"
                        LEFT JOIN "Products" "childParents" ON "childParents".id = "InventoryMovmentLines"."parentChildId"
                        where "InventoryMovments".id = any($1)
                     `,
                values: [id]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            const referenceIds = journals.map((obj: any) => obj.referenceId) ?? [];
            await this.deleteMovments(client, referenceIds);

            const kitBuilderProduct = journals.filter(f => f.qty > 0)
            const kitProduct = journals.find(f => f.qty < 0)


            let totalCost = 0
            if (kitProduct && kitBuilderProduct.length > 0) {


                const journalList: any[] = [];
                for (let index = 0; index < kitBuilderProduct.length; index++) {
                    const element = kitBuilderProduct[index];
                    const movment = new Movment();
                    movment.ParseJson(element);

                    const productCost = await this.getProductCosts(client, element.productId, element.branchId, element.qty, null);
                    movment.cost = productCost.cost
                    movment.costId = productCost.costId
                    totalCost += (movment.cost * Math.abs(movment.qty))
                    journalList.push(movment)

                }
                kitProduct.cost = totalCost / Math.abs(kitProduct.qty)
                journalList.push(kitProduct)

                for (let index = 0; index < journalList.length; index++) {
                    const element = journalList[index];
                    if (Math.abs(element.qty) != 0)
                        await this.insertJournal(client, element)

                    if (element.qty > 0) {
                        const cost = await this.productCost(client, [element], 'Kit Break')
                        if (cost && cost.length > 0) {
                            costs.push(cost[0])
                        }
                    }

                }
                if (journals.length > 0) {
                    let productIds = journals.map(f => { return { productId: f.productId } })
                    const companyId = journals.length > 0 ? journals[0].companyId : null;
                    const branchId = journals.length > 0 ? journals[0].branchId : null;
                    await this.setOnHand(client, productIds, branchId, companyId)


                }

            }
            const branchCosts = journals.filter(f => f.qty >= 0).map(m => {
                return {
                    "productId": m.productId,
                    "branchId": m.branchId
                }
            })
            await client.query("COMMIT")
            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
            if (branchCosts && branchCosts.length > 0) {
                this.setBranchUnitCostJob(branchCosts)
            }
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /** For Import Product or adding new branch */
    private static async checkIfExist(client: PoolClient, productId: string) {
        try {
            const query = {
                text: `SELECT COUNT(id) from "InventoryMovmentRecords" where "productId" = $1 and "referenceTable" = 'Opening Balance'`,
                values: [productId]
            }

            let product = await client.query(query.text, query.values);
            if (product.rows && product.rows.length > 0 && product.rows[0].count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    private static async newProdcutCost(ids: any[], branchId: string | null, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const costs: any[] = [];
            const query = {
                text: `select 
                            'Opening Balance'::text AS "referenceTable",
                            "BranchProducts".id   AS "referenceId",
                            "Products".id AS "transactionId",
                            "Products".id AS "productId",
                           case when "Branches"."openingBalanceDate" is not null  then "Branches"."openingBalanceDate" else "Companies"."createdAt" - interval '1 day' end as "createdAt",
                                  "Products"."companyId",
                            "BranchProducts"."branchId" AS "branchId",
                            "Products"."unitCost" as "cost",
                            COALESCE("BranchProducts"."onHand",0) as "qty",
                            $3 as "employeeId"
                            from "Products" 
                            inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id
                            inner join "Branches" on "Branches".id = "BranchProducts"."branchId" 
                            inner join "Companies" on "Companies".id = "Branches"."companyId"
                            where  "Products".id = any($1)
                            and ($2::uuid is null  or "BranchProducts"."branchId" = $2)
                            `,
                values: [ids, branchId, employeeId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            for (let index = 0; index < journals.length; index++) {
                const element = journals[index];
                const journal = new Movment();
                journal.ParseJson(element);
                journal.referenceTable = 'Opening Balance'
                const isExist = await this.checkIfExist(client, journal.productId)
                if (!isExist) {
                    if (Math.abs(element.qty) != 0)
                        await this.insertJournal(client, journal)
                    let cost = await this.productCost(client, [journal], 'Opening Balance')
                    if (cost) {
                        costs.push(cost[0])

                    }
                }
            }

            await client.query("COMMIT")
            if (costs && costs.length) {
                this.pushCostJobs(costs)
            }
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async movmentQueue(data: any) {
        try {
            switch (data.type) {
                case 'openingBalance':
                    await this.ProductOpeiningBalanceMovment(data.id)
                    break;
                case 'physicalCount':
                    await this.PhysicalCountMovment(data.id)
                    break;
                case 'billing':
                    await this.deleteCost(data.deleteLines)
                    await this.billingMovment(data.id)
                    break;
                case 'supplierCredit':
                    await this.supplierCreditMovment(data.id)
                    break;
                case 'invoice':
                    await this.parentChildMovment(data.id)
                    await this.invoicesMovment(data.id)
                    break;
                case 'creditNote':
                    await this.creditNoteMovment(data.id)
                    break;
                case 'trensfer':
                    await this.inventortTransferMovment(data.id)
                    break;
                case 'manualAdjusment':
                    await this.manualAdjusmentMovment(data.ids, data.adjustmentType)
                    break;
                case 'Delete':
                    await this.deleteMovment(data.ids)
                    break;

                case 'DeletePhysicalCount':
                    await this.deletePhysicalCountMovment(data.ids)
                    break;
                case 'parentChildMovment':

                    break;
                case 'parentChildMovmentInventoryTransfer':
                    await this.parentChildMovmentInventoryTransfer(data.ids)
                    break;
                case 'kitBuildProductCost':
                    await this.kitChildMovment(data.movmentIds)
                    await this.kitBuildProductCost(data.ids)
                    break;
                case 'kitBreakProductCost':
                    await this.kitBreakProductCost(data.ids)
                    break;
                case 'newProductCost':
                    await this.ProductOpeiningBalanceMovment(data.ids)
                    break;
                case 'deleteProductManualAdustment':
                    await this.deleteProductManualAdustment(data.ids)
                    break;
                case 'DeleteCost':
                    await this.deleteCost(data.ids)
                    break;

                default:
                    break;
            }

            return true
        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }


    /** save movment */
    private static async saveJournal(client: PoolClient, journalList: any[], isOpeningBalance: boolean = false) {
        try {

            for (let index = 0; index < journalList.length; index++) {
                const element: any = journalList[index];
                const journal = new Movment();
                journal.ParseJson(element);
                let jounrnalId = journal.referenceTable + '_' + journal.productId + '_' + journal.referenceId + '_' + journal.branchId
                let isExist = false;
                journal.id = jounrnalId
                if (Math.abs(journal.qty) != 0)
                    await this.insertJournal(client, journal);
                // if (isExist) {
                //     if (isOpeningBalance) {
                //         await this.updateProductOpeningBalanceJournal(client, journal);
                //     } else {
                //         await this.updateJournal(client, journal);
                //     }

                // } else {
                //     if (journal.qty != 0) {
                //         await this.insertJournal(client, journal);

                //     }
                // }
            }

        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }
    private static async insertJournal(client: PoolClient, journal: Movment) {
        try {

            const query: { text: any, values: any } = {
                text: `INSERT INTO "InventoryMovmentRecords" ("id",
                                                     "employeeId",
                                                     "productId",
                                                     "createdAt",
                                                     "referenceId",
                                                     "referenceTable",
                                                     "cost",
                                                     "qty",
                                                     "companyId",
                                                    "branchId",
                                                    "costDate",
                                                    "transactionId",
                                                    "costId",
                                                    "referenceCostId",
                                                    "isAllocated",
                                                    "childQty"
                                                    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) `,
                values: [journal.id,
                journal.employeeId,
                journal.productId,
                journal.createdAt,
                journal.referenceId,
                journal.referenceTable,
                journal.cost,
                journal.qty,
                journal.companyId,
                journal.branchId,
                journal.costDate,
                journal.transactionId,
                journal.costId,
                journal.referenceCostId,
                journal.isAllocated,
                journal.childQty
                ]
            }
            await client.query(query.text, query.values);
        } catch (error: any) {
            console.log(error)



            throw new Error(error)
        }
    }
    private static async updateJournal(client: PoolClient, journal: Movment) {
        try {
            const query: { text: any, values: any } = {
                text: `UPDATE "InventoryMovmentRecords" SET "createdAt"=$1,"cost"=$2,"qty"=$3 ,"costId"= $4  where "referenceId"=$5 and "productId"=$6 and "branchId" = $7 `,
                values: [journal.createdAt, journal.cost, journal.qty, journal.costId, journal.referenceId, journal.productId, journal.branchId]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async deleteMovment(dbIds: any[]) {
        const client = await DB.excu.client();
        try {
            const costs: any[] = []
            await client.query("BEGIN");

            // let productQuery = {
            //     text: `with "pro" as (select "productId","branchId" FROM "InventoryMovmentRecords" 
            //             WHERE "referenceId" = any($1)
            //                         )

            //                         select "InventoryMovmentRecords"."productId", "InventoryMovmentRecords"."branchId", sum("qty") from "InventoryMovmentRecords"
            //                         INNER JOIN "pro" ON "pro"."branchId" =  "InventoryMovmentRecords"."branchId" and "pro"."productId" = "InventoryMovmentRecords"."productId"
            //                         WHERE  not ("referenceId" =any($1))
            // 								   group by "InventoryMovmentRecords"."productId","InventoryMovmentRecords"."branchId"`,
            //     values: [dbIds]
            // }

            // let productList = await client.query(productQuery.text, productQuery.values)
            // let products = productList && productList.rows && productList.rows.length > 0 ? productList.rows : []

            let query = {
                text: `select * FROM "InventoryMovmentRecords" where "referenceId" =any($1)   `,
                values: [dbIds]
            }


            let transactions = await client.query(query.text, query.values)
            // if (products.length > 0) {

            //     await this.setOnHand(client, products)
            // }
            const branchCosts = transactions.rows.filter(f => f.qty >= 0).map(t => {
                return {
                    "productId": t.productId,
                    "branchId": t.branchId
                }
            })
            for (let index = 0; index < transactions.rows.length; index++) {
                const element = transactions.rows[index];
                const costData = {
                    costId: element.referenceId,
                    productId: element.productId,
                    branchId: element.branchId,
                    companyId: element.companyId,
                    isDeleted: true,
                    changeFlag: false
                }
                // let queueInstance = UnitCostQueue.getInstance();
                // queueInstance.createJob({ type: "checkForCostReallocation", data: costData })
                costs.push({ type: "deleteCostReallocation", data: costData })

            }

            await client.query("COMMIT")

            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }


        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async deletePhysicalCountMovment(dbIds: any[]) {
        const client = await DB.excu.client();
        try {
            const costs: any[] = []
            await client.query("BEGIN");

            // let productQuery = {
            //     text: `with "pro" as (select "productId","branchId" FROM "InventoryMovmentRecords" 
            //             WHERE "referenceId" = any($1)
            //                         )

            //                         select "InventoryMovmentRecords"."productId", "InventoryMovmentRecords"."branchId", sum("qty") from "InventoryMovmentRecords"
            //                         INNER JOIN "pro" ON "pro"."branchId" =  "InventoryMovmentRecords"."branchId" and "pro"."productId" = "InventoryMovmentRecords"."productId"
            //                         WHERE  not ("referenceId" =any($1))
            // 								   group by "InventoryMovmentRecords"."productId","InventoryMovmentRecords"."branchId"`,
            //     values: [dbIds]
            // }

            // let productList = await client.query(productQuery.text, productQuery.values)
            // let products = productList && productList.rows && productList.rows.length > 0 ? productList.rows : []

            let query = {
                text: `select * FROM "InventoryMovmentRecords" where "referenceId" =any($1)   `,
                values: [dbIds]
            }


            let transactions = await client.query(query.text, query.values)
            // if (products.length > 0) {

            //     await this.setOnHand(client, products)
            // }
            for (let index = 0; index < transactions.rows.length; index++) {
                const element = transactions.rows[index];
                const costData = {
                    costId: element.referenceId,
                    productId: element.productId,
                    branchId: element.branchId,
                    companyId: element.companyId,
                    isDeleted: true,
                    changeFlag: false
                }
                // let queueInstance = UnitCostQueue.getInstance();
                // queueInstance.createJob({ type: "checkForCostReallocation", data: costData })
                costs.push({ type: "deleteCostReallocation", data: costData })

            }


            await client.query("COMMIT")

            if (costs && costs.length > 0) {
                this.pushCostJobs(costs)
            }
        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async deleteCost(dbIds: any[]) {
        const client = await DB.excu.client();
        try {

            const jobs: any[] = []
            await client.query("BEGIN");
            //checkForCostReallocation

            let deleted = await client.query(`SELECT *  FROM "InventoryMovmentRecords" where "referenceId" = any($1) `, [dbIds]);
            const productCosts = deleted.rows && deleted.rows.length > 0 ? deleted.rows.map(f => { return { "productId": f.productId, "branchId": f.branchId } }) : []
            if (deleted && deleted.rows && deleted.rows.length > 0) {
                for (let index = 0; index < deleted.rows.length; index++) {
                    const element = deleted.rows[index];
                    const costData = {
                        costId: element.referenceId,
                        productId: element.productId,
                        branchId: element.branchId,
                        companyId: element.companyId,
                        isDeleted: true,
                        changeFlag: false
                    }
                    // let queueInstance = UnitCostQueue.getInstance();
                    // queueInstance.createJob({ type: "checkForCostReallocation", data: costData })
                    jobs.push({ type: "deleteCostReallocation", data: costData })
                    // await this.checkForCostReallocation(client, element.referenceId, true)
                }
                // let productIds = deleted.rows.map(f => { return { productId: f.productId } })
                // await this.setOnHand(client, productIds)
            }

            await client.query("COMMIT")
            if (jobs && jobs.length > 0) {
                this.pushCostJobs(jobs)
            }

        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }




    public static async deleteMovments(client: PoolClient, dbIds: any[]) {

        try {



            let query = {
                text: `DELETE FROM "InventoryMovmentRecords" where "referenceId" =any($1)`,
                values: [dbIds]
            }

            await client.query(query.text, query.values)

        } catch (error: any) {



            throw new Error(error)
        }
    }
    public static async setOnHand(client: PoolClient, productIds: any[], branchId: string, companyId: string) {
        try {

            let ids = productIds.map(f => { return f.productId })
            console.log(ids)
            const query = {
                text: `   with products as (
                        select distinct  id, type from "Products"
                        where "companyId" =$1
                        and "Products"."id" = any ($2::uuid[])
                        and "Products".type = any(array['inventory','kit', 'batch']::text[] )
                        ),"batches" as(
						  select id,"type" from "products"
							where "type" = 'batch'
						),
						 "inventories" AS(
						   select id ,"type"from "products"
						 where "type" in ('inventory','kit')
						 )

                        select COALESCE(sum( "InventoryMovmentRecords"."qty"::text::numeric),0) as "onHand" ,"BranchProducts" ."branchId","BranchProducts"."productId", batches.type,
                        NULLIF(COALESCE("InvoiceLines"."batch","BillingLines"."batch","CreditNoteLines"."batch","PhysicalCountLines"."batch","InventoryTransferLines"."batch","SupplierCreditLines"."batch","InventoryMovmentLines"."batch"),'') as "batchTemp"
                        from batches
                        INNER join "BranchProducts" on "BranchProducts"."companyId" = $1 and "BranchProducts"."productId" = batches.id 
                        left join "InventoryMovmentRecords"  on "InventoryMovmentRecords"."companyId" = $1 and batches.id = "InventoryMovmentRecords"."productId" and "InventoryMovmentRecords"."branchId" = "BranchProducts"."branchId"
                        left join "InvoiceLines" on "InvoiceLines"."id" ="InventoryMovmentRecords"."referenceId" and "InvoiceLines"."productId" = "InventoryMovmentRecords"."productId"
                        left join "BillingLines" on "BillingLines"."id" ="InventoryMovmentRecords"."referenceId"  and "BillingLines"."productId" = "InventoryMovmentRecords"."productId"
                        left join "CreditNoteLines" on "CreditNoteLines"."id" ="InventoryMovmentRecords"."referenceId" and "CreditNoteLines"."productId" = "InventoryMovmentRecords"."productId"
                        left join "PhysicalCountLines" on "PhysicalCountLines"."id" ="InventoryMovmentRecords"."referenceId" and "PhysicalCountLines"."productId" = "InventoryMovmentRecords"."productId"
                        left join "InventoryTransferLines" on  "InventoryTransferLines"."id" ="InventoryMovmentRecords"."referenceId" and "InventoryTransferLines"."productId" = "InventoryMovmentRecords"."productId"
                        left join "SupplierCreditLines" on  "SupplierCreditLines"."id" ="InventoryMovmentRecords"."referenceId" and "SupplierCreditLines"."productId" = "InventoryMovmentRecords"."productId"
                        LEFT JOIN "InventoryMovmentLines" on "InventoryMovmentLines"."id" ="InventoryMovmentRecords"."referenceId" and "InventoryMovmentLines"."productId" = "InventoryMovmentRecords"."productId"
                        where "BranchProducts"."companyId"=$1
                        and "BranchProducts"."branchId" = $3
                        group by "BranchProducts"."branchId","BranchProducts"."productId","batchTemp", batches.type
                        union
                        select 
                            COALESCE(sum( "InventoryMovmentRecords"."qty" ::text::numeric),0)::float as "onHand" ,
                            "BranchProducts" ."branchId",
                            "BranchProducts"."productId",
                            inventories.type, 
                            null as "batchTemp"
                        from  inventories
                        INNER join "BranchProducts" on "BranchProducts"."productId" = inventories.id 
                        left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."companyId" = $1 and
                        inventories.id = "InventoryMovmentRecords"."productId" and "InventoryMovmentRecords"."branchId" = "BranchProducts"."branchId"
                        where "BranchProducts"."branchId" = $3
                        group by "BranchProducts"."branchId","BranchProducts"."productId", inventories.type`,
                values: [companyId, ids, branchId]
            }

            let products = await client.query(query.text, query.values);

            if (products.rows && products.rows.length > 0) {

                for (let index = 0; index < products.rows.length; index++) {
                    const element = products.rows[index];
                    if (element.type == 'batch') {
                        await BatchProductRepo.setBatchOnHand(client, element.batchTemp, element.productId, element.branchId, element.onHand)
                    } else {
                        await BranchProductsRepo.setNewOnHand(client, element.branchId, element.productId, element.onHand, true)

                    }
                }
            }

            const nonBatchRows = products.rows.filter(p => p.type !== 'batch');
            const inventoryProducts = nonBatchRows.map(update => [update.branchId, update.productId, update.onHand]);
            if (inventoryProducts.length > 0) {
                const updateQuery = `
                    UPDATE "BranchProducts" 
                    SET "onHand" = data."onHand"::real
                    FROM (VALUES %L) AS data("branchId", "productId","onHand")
                    WHERE "BranchProducts"."branchId"= data."branchId"::uuid
                    AND "BranchProducts"."productId"= data."productId"::uuid
                    ;
                  `;
                const formattedQuery = format(updateQuery, inventoryProducts);
                await client.query(formattedQuery);
            }
        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }

    public static async companyUnitCostAllocate(data: any, companyId: string) {
        try {
            let queueInstance = UnitCostQueue.getInstance();


            if (data.branchId) {
                let pageNumber = data.page
                let limit = data.limit
                let offset = limit * (pageNumber - 1)
                const branchId = data.branchId
                const query = {
                    text: `with "pro" as  (select "Products".id  
                               from "Products"
							   where "companyId" =$1
                                  and ("type" in ('inventory','kit'))
                               order by "createdAt" asc
                               limit $2
                               offset $3)
							   
                                select $4::uuid As "branchId",
                                    json_agg(id) as "productsIds" from "pro"
                           `,
                    values: [companyId, limit, offset, branchId]
                }
                let products = await DB.excu.query(query.text, query.values);
                if (products && products.rows && products.rows.length > 0) {
                    queueInstance.createJob({ type: "CompanyUnitCostAllocation", data: products.rows[0] })
                }

            } else {
                const query = {
                    text: `select "branchId" , json_agg("Products".id) as "productsIds" from "Products" 
                            inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id
                            where "Products"."companyId" = $1
                            and "isDeleted" = false
                            and ("type" in ('inventory','kit'))
                            group by "branchId"
                `,
                    values: [companyId]
                }
                let products = await DB.excu.query(query.text, query.values);
                if (products && products.rows && products.rows.length > 0) {
                    for (let index = 0; index < products.rows.length; index++) {
                        const element = products.rows[index];
                        queueInstance.createJob({ type: "CompanyUnitCostAllocation", data: element })
                    }
                }
            }

        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async ProductUnitCostAllocation(data: any) {
        try {

            let branchId = data.branchId;
            let products = data.productsIds
            if (products && products.length > 0) {
                console.log("======ProductUnitCostAllocation===", data)
                for (let index = 0; index < products.length; index++) {
                    const element = products[index];
                    await this.allocate(branchId, element)
                }
            }

        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async allocate(branchId: string, productId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let hasPhysicalCount = false
            let updatedPhysicalCounts: any[] = []
            await client.query(`Delete from "InventoryMovmentRecords" where "productId" = $1 AND "branchId" =$2 and "referenceTable" ='FIFO Cost Adjusment' `, [productId, branchId])
            const updatedTransactions = new Set()
            let openingBalanceQty = 0;
            const adjustments: any[] = []
            const addedUnitCostAdjustments: any[] = [];
            const deletedUnitCostAdjustments: any[] = [];
            let unitCostAdjustments: any[] = []
            const query = {
                text: `select "referenceId" , "branchId" ,"companyId" ,"referenceCostId", "transactionId" , "referenceTable" , "qty" as "qty" ,  "cost" , "costId" , cast("createdAt" as text) , sum("qty") over(order by "createdAt" asc  ,"incrementalId" asc )  as "qtyBalance" from "InventoryMovmentRecords" 
                      where "productId" = $1 
                      and "branchId" = $2 
                      and "referenceTable" <>'FIFO Cost Adjusment'
                      order by "createdAt" asc , "incrementalId" asc
                     `,
                values: [productId, branchId]
            }

            const transactionsData = await client.query(query.text, query.values);
            let physicalCountOpeningQty = openingBalanceQty;

            let physicalCountIds = transactionsData.rows.filter((f: any) => f.referenceTable == 'PhysicalCount').map(f => { return f.referenceId });
            let physicalCountTransactions: { id: string, enteredQty: number }[] = []
            if (physicalCountIds) {
                const physicalCountQuery = {
                    text: `SELECT id , "enteredQty" from "PhysicalCountLines" where "id" =ANY($1)`,
                    values: [physicalCountIds]
                }
                let physicalCountRows = await client.query(physicalCountQuery.text, physicalCountQuery.values);
                physicalCountTransactions = physicalCountRows.rows.map(f => { return { id: f.id, enteredQty: f.enteredQty } })
            }



            if (transactionsData && transactionsData.rows && transactionsData.rows.length > 0) {

                const listOfTransactions: any = transactionsData.rows
                let inTransactions: any[] = []
                let lastCost = 0
                let lastCostId = ''
                let totalUsages = 0;
                let lastTransactionCost = 0
                for (let index = 0; index < listOfTransactions.length; index++) {
                    const current = listOfTransactions[index];
                    const element = new Movment();
                    element.ParseJson(current)

                    let cost = 0

                    // if((element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)' && element.qty>=0)|| element.referenceTable == 'Manual Adjustment' || element.referenceTable == 'Manual Adjusment') {
                    //    inTransactions = [] 
                    // }
                    if (openingBalanceQty < 0 && element.qty > 0) {
                        openingBalanceQty += element.qty
                    }



                    // if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {


                    //     if (element.qty > 0) {
                    //         inTransactions = []
                    //     }
                    //     if(element.qty<0)
                    //     {
                    //         element.cost = lastCost
                    //     }
                    //     if (!(element.skip)) {
                    //         let manualAdjustment = transactionsData.rows.filter(f => f.transactionId == element.transactionId)
                    //         if (manualAdjustment && manualAdjustment.length > 1) {

                    //             let otherMnualAdjustmentTransaction = manualAdjustment.find(f => f.referenceId != element.referenceId)
                    //             let indexOfOther = listOfTransactions.indexOf(otherMnualAdjustmentTransaction);

                    //             if (physicalCountOpeningQty <= 0) {
                    //                 element.qty = 0;
                    //                 listOfTransactions[indexOfOther].qty = 0
                    //             } else {



                    //                 element.qty = element.qty < 0 ? physicalCountOpeningQty * -1 : physicalCountOpeningQty;
                    //                 listOfTransactions[indexOfOther].qty = listOfTransactions[indexOfOther].qty < 0 ? physicalCountOpeningQty * -1 : physicalCountOpeningQty;

                    //                 listOfTransactions[indexOfOther].skip = true
                    //                 updatedTransactions.push(listOfTransactions[indexOfOther])
                    //             }


                    //         }
                    //     }
                    // }

                    if (element.referenceTable == 'PhysicalCount') {
                        let currentPhysicalCount = physicalCountTransactions.find(f => f.id == element.referenceId);
                        if (currentPhysicalCount && !isNaN(currentPhysicalCount.enteredQty)) {
                            element.qty = currentPhysicalCount.enteredQty - physicalCountOpeningQty
                            physicalCountOpeningQty = currentPhysicalCount.enteredQty
                            hasPhysicalCount = true;
                            updatedPhysicalCounts.push({ ...element })
                        }
                    } else {
                        physicalCountOpeningQty += element.qty;
                    }


                    // if (element.referenceTable = 'Manual Adjustment (UnitCost Adjustment)') {
                    //     element.qty = element.qty < 0 ? physicalCountOpeningQty * -1 : physicalCountOpeningQty;
                    // }
                    const transactionQty = element.qty
                    if (transactionQty >= 0) {
                        // if (element.referenceTable !== 'PhysicalCount') {
                        //     if (element.qtyBalance > 0) {
                        //         const available = element.qtyBalance - openingBalanceQty;
                        //         element.qty = Math.max(0, Math.min(element.qty, available));
                        //     }
                        // }

                        let newProductCost = lastCost
                        if (lastCost == 0 && inTransactions.length > 0) {
                            newProductCost = inTransactions[inTransactions.length - 1].cost
                        }
                        if (element.referenceTable == 'CreditNote' || element.referenceTable == 'Invoice' || element.referenceTable == 'Manual Adjusment' || element.referenceTable == 'Manual Adjustment'
                            || element.referenceTable == 'PhysicalCount') {
                            if (element.cost == 0 && lastTransactionCost != 0) {
                                element.cost = lastTransactionCost
                            }

                            updatedTransactions.add({ ...element })
                        }
                        if (element.referenceTable == 'Child Inventory Movment' && element.cost == 0) {
                            element.cost = newProductCost
                            updatedTransactions.add({ ...element })
                        }



                        if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {
                            let totalAdjQty = 0
                            for (const adj of unitCostAdjustments) {
                                deletedUnitCostAdjustments.push(adj.referenceId);
                            }
                            deletedUnitCostAdjustments.push(element.referenceId)
                            if (inTransactions.length > 0) {
                                const groupedByCost = new Map<number, number>();

                                for (const tx of inTransactions) {
                                    const cost = Number(tx.cost);
                                    const qty = Number(tx.qty || 0);
                                    groupedByCost.set(cost, (groupedByCost.get(cost) || 0) + qty);
                                }

                                for (const [cost, totalQty] of groupedByCost.entries()) {
                                    if (totalQty <= 0) continue;
                                    totalAdjQty += totalQty
                                    addedUnitCostAdjustments.push({
                                        ...element,
                                        qty: totalQty * -1,
                                        cost
                                    });
                                }
                            }
                            element.qty = totalAdjQty;

                            physicalCountOpeningQty = totalAdjQty
                            unitCostAdjustments = []
                            inTransactions = []
                            addedUnitCostAdjustments.push({ ...element })
                        }

                        inTransactions.push(element)

                        totalUsages += element.qty;

                        if (index > 0) {
                            const lastTransaction = listOfTransactions[index - 1]
                            if (lastTransaction) {
                                if (physicalCountOpeningQty - element.qty < 0) {
                                    let adjustment = {
                                        oldCost: lastTransaction.qty < 0 ? lastCost : lastTransaction.cost,
                                        oldCostId: lastTransaction.qty < 0 ? lastTransaction.costId : lastTransaction.referenceId,
                                        newCost: element.cost,
                                        newCostId: element.referenceId,
                                        adjustedQty: Math.abs(physicalCountOpeningQty - element.qty),
                                        greatestDate: element.createdAt,
                                        productId: productId,
                                        branchId: branchId,
                                        companyId: element.companyId
                                    }

                                    adjustments.push(adjustment)
                                }

                            }

                        }
                    } else {



                        if (element.referenceTable == 'Manual Adjustment (UnitCost Adjustment)') {
                            unitCostAdjustments.push(element);
                            continue;
                        }


                        let remainingUsage = Math.abs(transactionQty);
                        let totalCost = 0;
                        if (inTransactions.length == 0) {
                            element.cost = lastCost;
                            updatedTransactions.add({ ...element })
                            const linkedTransactions = listOfTransactions.filter((f: any) => f.referenceCostId == element.referenceId && f.createdAt >= element.createdAt);
                            if (linkedTransactions && linkedTransactions.length > 0) {
                                for (let index = 0; index < linkedTransactions.length; index++) {
                                    const linkedElement = linkedTransactions[index];
                                    const elementIndex = listOfTransactions.indexOf(listOfTransactions.find((f: any) => f.referenceId == linkedElement.referenceId));
                                    if (elementIndex >= 0) {
                                        listOfTransactions[elementIndex].cost = element.cost
                                    }
                                }
                            }
                        } else {
                            while (remainingUsage > 0 && inTransactions.length > 0) {
                                const currentCost = inTransactions[0];

                                if (currentCost.qty < 0) {
                                    inTransactions.shift()
                                    continue;
                                }
                                // if(inTransactions.length>1 && )
                                // {

                                // }

                                if (currentCost.qty <= remainingUsage) {

                                    totalCost += currentCost.qty * currentCost.cost;
                                    lastCost = currentCost.cost;
                                    lastCostId = currentCost.referenceId;
                                    remainingUsage -= currentCost.qty;
                                    totalUsages -= currentCost.qty;
                                    inTransactions.shift();
                                } else {
                                    totalCost += remainingUsage * currentCost.cost;
                                    lastCost = currentCost.cost;
                                    lastCostId = currentCost.referenceId;
                                    currentCost.qty -= remainingUsage;
                                    totalUsages -= remainingUsage;
                                    remainingUsage = 0;
                                }


                            }
                            let remainingQtyWithNoInventory = (remainingUsage * lastCost);



                            cost = totalCost + remainingQtyWithNoInventory
                            if (element.referenceTable != 'Supplier Credit') {
                                element.cost = element.qty !== 0 ? cost / Math.abs(element.qty) : 0;
                            }


                            updatedTransactions.add({ ...element })
                            // const linkedTransactions = listOfTransactions.filter((f: any) => f.referenceCostId == element.referenceId && f.createdAt >= element.createdAt);
                            // if (linkedTransactions && linkedTransactions.length > 0) {
                            //     for (let index = 0; index < linkedTransactions.length; index++) {
                            //         const linkedElement: any = linkedTransactions[index];
                            //         const temp = listOfTransactions.find((f: any) => f.referenceId == linkedElement.referenceId)
                            //         if (temp) {
                            //             const elementIndex = listOfTransactions.indexOf(temp);
                            //             if (elementIndex >= 0) {
                            //                 listOfTransactions[elementIndex].cost = element.cost
                            //             }
                            //         }
                            //     }

                            // }


                        }
                    }
                    lastTransactionCost = element.cost
                }


                console.log(lastCost, lastCostId)
                console.log(totalUsages)


            }

            let updatedList: any[] = Array.from(updatedTransactions);
            const transactionValues = updatedList.map(update => [update.referenceId, update.cost, productId]);
            const physicalCounts = updatedPhysicalCounts.map(update => [update.referenceId, update.qty, productId]);
            const inTransactionsChanges = updatedList.filter(e => e.qty > 0).map(update => [update.referenceId, update.cost, productId]);
            if (deletedUnitCostAdjustments.length > 0) {

                const deleteQuery = `
                        DELETE FROM "InventoryMovmentRecords" imr
                        WHERE imr."referenceId" = any($1)
                        AND imr."productId" =$2
                        AND imr."referenceTable" = 'Manual Adjustment (UnitCost Adjustment)'
                        `;

                await client.query(deleteQuery, [deletedUnitCostAdjustments, productId])
            }
            if (addedUnitCostAdjustments.length > 0) {
                const insertQuery = `
                        INSERT INTO "InventoryMovmentRecords" (
                            "referenceId",
                            "productId",
                            "branchId",
                            "qty",
                            "cost",
                            "createdAt",
                            "referenceTable",
                            "companyId"
                        )
                        SELECT
                            data."referenceId"::uuid,
                            data."productId"::uuid,
                            data."branchId"::uuid,
                            data.qty::real,
                            data.cost::real,
                            data."createdAt"::timestamp,
                            data."referenceTable",
                            data."companyId"::uuid
                        FROM (VALUES %L) AS data(
                            "referenceId",
                            "productId",
                            "branchId",
                            qty,
                            cost,
                            "createdAt",
                            "referenceTable",
                            "companyId"
                        );
                        `;

                const insertValues = addedUnitCostAdjustments.map(t => [
                    t.referenceId,
                    productId,
                    t.branchId,
                    t.qty,
                    t.cost,
                    t.createdAt,
                    t.referenceTable,
                    t.companyId

                ]);

                if (insertValues.length > 0) {
                    const formattedInsert = format(insertQuery, insertValues);
                    await client.query(formattedInsert);
                }
            }
            if (transactionValues.length > 0) {
                const updateQuery = `
                UPDATE "InventoryMovmentRecords" 
                SET "cost" = data.cost::real
                FROM (VALUES %L) AS data("referenceId", cost,"productId")
                WHERE "InventoryMovmentRecords"."referenceId"= data."referenceId"::uuid
                AND "InventoryMovmentRecords"."productId"= data."productId"::uuid
                ;
              `;
                const formattedQuery = format(updateQuery, transactionValues);
                await client.query(formattedQuery);
                //update physicalCount qty 
                if (physicalCounts && physicalCounts.length > 0) {
                    const updatePhysicalCountQuery = `
                UPDATE "InventoryMovmentRecords" 
                SET "qty" = data."qty"::real
                FROM (VALUES %L) AS data("referenceId", "qty","productId")
                WHERE "InventoryMovmentRecords"."referenceId"= data."referenceId"::uuid
                AND "InventoryMovmentRecords"."productId"= data."productId"::uuid
                ;
              `;
                    const formattedPhysicalCountQuery = format(updatePhysicalCountQuery, physicalCounts);
                    await client.query(formattedPhysicalCountQuery);
                }
                await this.setAdjusment(client, adjustments)
            }


            await client.query('UPDATE "BranchProducts" SET "onHand" = $1 where "branchId"=$2 and "productId" = $3', [physicalCountOpeningQty, branchId, productId])

            await client.query("COMMIT")


        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async setBranchUnitCost(data: any) {
        try {
            const branchId = data.branchId;
            const productId = data.productId;

            const query = {
                text: `with "pro" as (
                select "cost", "productId" from "InventoryMovmentRecords" 
                where "productId" = $1
                and "qty">=0
                order by "createdAt" DESC 
                limit 1 
                ), "generalUnitCost" as(
                  update "Products" set "unitCost" = t."cost" from (select * from "pro")t 
				where "id" = $1 RETURNING "Products".id 
                ), "branchUnitCost" as (
                 select "productId", "branchId" ,"cost" from "InventoryMovmentRecords" 
                where "productId" = $1
                and "branchId" = $2
                and "qty">=0
                    order by "createdAt" DESC 
                    LIMIT 1 
                ), "setBranchUnitCost" as 
                (
                  update "BranchProducts" set "productUnitCost" = t."cost" from (select * from "branchUnitCost" ) t
                  where "BranchProducts"."productId" = t."productId"
                  and  "BranchProducts"."branchId" =  t."branchId"
                  returning "BranchProducts".id 
                )

                select * from  "generalUnitCost"
                `,
                values: [productId, branchId]
            }

            await DB.excu.query(query.text, query.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }

}


/** consider this 
 * 
 * 
 * WITH raw_data AS (
  SELECT * FROM (VALUES
    ('Billing', 1, 0.4, 1),
    ('Manual Adjustment', 5, 0, 2),
    ('Manual Adjustment (UnitCost Adjustment)', -5, 0.08, 3),
    ('Manual Adjustment (UnitCost Adjustment)', 5, 0.5, 4),
    ('Transfer', 1, 0.3, 5),
    ('Manual Adjustment (UnitCost Adjustment)', -6, 0.09, 6),
    ('Manual Adjustment (UnitCost Adjustment)', 6, 0.6, 7),
    ('Billing', 1, 0.4, 8)
  ) AS t(referenceTable, qty, cost, createdAt)
),
-- Step 1: Identify each reset point (negative UnitCost Adjustments)
unit_cost_resets AS (
  SELECT createdAt AS reset_time
  FROM raw_data
  WHERE referenceTable = 'Manual Adjustment (UnitCost Adjustment)' AND qty < 0
),
-- Step 2: Find the max reset time (latest reset)
latest_reset AS (
  SELECT MAX(reset_time) AS reset_after
  FROM unit_cost_resets
),
-- Step 3: Keep only positive qtys after the latest reset
filtered_data AS (
  SELECT rd.*
  FROM raw_data rd, latest_reset lr
  WHERE rd.createdAt > lr.reset_after
    AND rd.qty > 0
)
SELECT *
FROM filtered_data
ORDER BY createdAt;
 */