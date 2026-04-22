import { DB } from "@src/dbconnection/dbconnection";

import { InventoryTransfer } from "@src/models/account/InventoryTransfer";
import { InventoryTransferLine } from "@src/models/account/InventoryTransferLine";

import { ResponseData } from "@src/models/ResponseData";
import { InventoryTransfersValidations } from "@src/validationSchema/account/inventoryTransfers.Schema";
import { PoolClient } from "pg";
import { BranchProductsRepo } from "../product/branchProduct.repo";
import { ProductRepo } from "../product/product.repo";





import { BranchProducts } from "@src/models/product/BranchProducts";

import { Helper } from "@src/utilts/helper";
import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";

import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";

import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
export class inventoryTransferRepo {

    /**
     * Inventory Transfer => transfer Product In or Out branch 
     * 
     * Status=> (Open) : will not effect movment of inventory 
     *          (Confirmed): will effect movment 
     * 
     * product types allowed:[inventory, batch , serial]
     */

    public static async getInventoryTransferStatus(client: PoolClient, inventoryTransferId: string) {
        try {
            const query = {
                text: `SELECT status from "InventoryTransfers" where  id=$1`,
                values: [inventoryTransferId]
            }

            const invntory = await client.query(query.text, query.values);
            return invntory.rows[0].status
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async addNewInventoryTransfer(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id
            //validation
            const validate = await InventoryTransfersValidations.inventoryTransfersValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            if (data.reason == 'To Another Branch' && !data.destinationBranch) {
                throw new ValidationException('Please select a destination branch for the transfer')
            }
            const inventoryTransfer = new InventoryTransfer();
            inventoryTransfer.ParseJson(data);
            inventoryTransfer.employeeId = employeeId;

            if (inventoryTransfer.status == 'Confirmed') {
                inventoryTransfer.confirmDatetime = new Date();
                inventoryTransfer.confirmedEmployee = employeeId
            }

            // const zeroLines = inventoryTransfer.lines.filter(f=>f.qty == 0)
            // if(zeroLines && zeroLines.length == inventoryTransfer.lines.length)
            // {
            //     throw new ValidationException("Qty IS REQUIRED")
            // }
            await client.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InventoryTransfers" (reference,status,note,type,reason,"createdDate", "confirmDatetime", "employeeId", "branchId","destinationBranch","transferNumber","confirmedEmployee","source") 
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id `,
                values: [inventoryTransfer.reference,
                inventoryTransfer.status,
                inventoryTransfer.note,
                inventoryTransfer.type,
                inventoryTransfer.reason,
                inventoryTransfer.createdDate,
                inventoryTransfer.confirmDatetime,
                inventoryTransfer.employeeId,
                inventoryTransfer.branchId,
                inventoryTransfer.destinationBranch,
                inventoryTransfer.transferNumber,
                inventoryTransfer.confirmedEmployee,
                inventoryTransfer.source,
                ]
            }


            const insert = await client.query(query.text, query.values);
            const type = inventoryTransfer.type;
            inventoryTransfer.id = (<any>insert.rows[0]).id;
            //add inventory transfer lines 
            for (let index = 0; index < inventoryTransfer.lines.length; index++) {
                const element = inventoryTransfer.lines[index];
                const temp = new InventoryTransferLine();
                temp.ParseJson(element);
                temp.InventoryTransferId = inventoryTransfer.id;
                temp.onHand = await this.getProductOnHand(client, temp.productId, inventoryTransfer.branchId);
                const insertInventoryTransferLine: any = await this.insertInventoryTransferLine(client, temp)
                temp.id = insertInventoryTransferLine.id;
                // to insert inventory movment 
                if (temp.serials && temp.serials.length > 0) {
                    await this.addSerialLines(client, inventoryTransfer, temp, company)
                } else if (temp.batches && temp.batches.length > 0) {

                    await this.addBtahcesLines(client, inventoryTransfer, temp, company)

                }
                /**Set Product Actual UnitCost only when transfer out else unitCost en */
                if (inventoryTransfer.type != "Transfer In") {
                    // temp.unitCost = (await ProductRepo.getProductUnitCost(client, temp.productId)).unitCost
                }
                if ((inventoryTransfer.status == 'Confirmed' && inventoryTransfer.currentStatus != 'Confirmed') && (temp.parentId == null && ((temp.serials == null || temp.serials.length == 0) && (temp.batches == null || temp.batches.length == 0)))) {
                    await this.confirmed(client, temp, inventoryTransfer, company)
                }
            }


            await client.query("COMMIT")
            return new ResponseData(true, "Added Successflly", { id: (<any>insert.rows[0].id) })
        } catch (error: any) {
            await client.query("ROLLBACK")
            console.log(error)
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async insertInventoryTransferLine(client: PoolClient, inventoryTransferLine: InventoryTransferLine) {
        try {
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InventoryTransferLines" ("inventoryTransferId",
                                                                      "productId",
                                                                      qty, 
                                                                       "unitCost",
                                                                       serial,
                                                                       batch,
                                                                       "parentId",
                                                                       "onHand",
                                                                       "prodDate",
                                                                       "expireDate") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id `,
                values: [inventoryTransferLine.InventoryTransferId, inventoryTransferLine.productId, inventoryTransferLine.qty, inventoryTransferLine.unitCost, inventoryTransferLine.serial, inventoryTransferLine.batch, inventoryTransferLine.parentId, inventoryTransferLine.onHand, inventoryTransferLine.prodDate, inventoryTransferLine.expireDate]
            }

            const insert = await client.query(query.text, query.values);
            return {
                id: (<any>insert.rows[0]).id
            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }
    public static async editInventoryTransfer(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            //validation
            const companyId = company.id;

            const validate = await InventoryTransfersValidations.inventoryTransfersValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            if (data.reason == 'To Another Branch' && !data.destinationBranch) {
                throw new ValidationException('Please select a destination branch for the transfer')
            }
            const inventoryTransfer = new InventoryTransfer();
            inventoryTransfer.ParseJson(data);
            inventoryTransfer.employeeId = employeeId;
            inventoryTransfer.currentStatus = await this.getInventoryTransferStatus(client, inventoryTransfer.id)

            if (inventoryTransfer.id == null || inventoryTransfer.id == "") {
                throw new ValidationException("Inventory Transfer ID Is Required ")
            }
            if (inventoryTransfer.status == 'Confirmed') {

                inventoryTransfer.confirmDatetime = new Date();
                inventoryTransfer.confirmedEmployee = employeeId
            }


            await client.query("BEGIN")
            const deletedLines = inventoryTransfer.lines.filter(f => f.isDeleted)
            if (deletedLines && deletedLines.length > 0 && deletedLines.length == inventoryTransfer.lines.length) {
                throw new Error("Inventory Transfer Products Are Require")
            }
            const query: { text: string, values: any } = {
                text: `UPDATE  "InventoryTransfers" SET 
                         reference=$1,
                         status=$2,
                         note=$3,
                         type=$4,
                         reason=$5,
                         "confirmDatetime"=$6,
                          "employeeId"=$7,
                          "destinationBranch" = case when $8::text = 'Confirmed' then "destinationBranch" else   $9 end ,
                          "confirmedEmployee" = $10
                        WHERE id=$11 `,
                values: [inventoryTransfer.reference,
                inventoryTransfer.status,
                inventoryTransfer.note,
                inventoryTransfer.type,
                inventoryTransfer.reason,
                inventoryTransfer.confirmDatetime,
                inventoryTransfer.employeeId,
                inventoryTransfer.currentStatus,
                inventoryTransfer.destinationBranch,
                inventoryTransfer.confirmedEmployee,
                inventoryTransfer.id
                ]
            }

            const insert = await client.query(query.text, query.values);
            //add inventory transfer lines 
            for (let index = 0; index < inventoryTransfer.lines.length; index++) {
                const element = inventoryTransfer.lines[index];
                const temp = new InventoryTransferLine();
                temp.ParseJson(element);
                temp.InventoryTransferId = inventoryTransfer.id;
                temp.onHand = await this.getProductOnHand(client, temp.productId, inventoryTransfer.branchId);

                if (temp.id == "" || temp.id == null) {
                    const line = await this.insertInventoryTransferLine(client, temp)
                    temp.id = line.id;
                } else {
                    if (!temp.isDeleted) {
                        await this.edittInventoryTransferLine(client, temp)
                    }

                }

                if (temp.serials && temp.serials.length > 0) {
                    await this.addSerialLines(client, inventoryTransfer, temp, company)
                } else if (temp.batches && temp.batches.length > 0) {
                    await this.addBtahcesLines(client, inventoryTransfer, temp, company)
                }



                if ((inventoryTransfer.status == 'Confirmed' && inventoryTransfer.currentStatus != 'Confirmed') && (temp.parentId == null && ((temp.serials == null || temp.serials.length == 0) && (temp.batches == null || temp.batches.length == 0)))) {
                    await this.confirmed(client, temp, inventoryTransfer, company)
                }

                if (temp.isDeleted) {
                    await this.deleteInventoryTransferLine(client, temp.id)
                }

            }


            await client.query("COMMIT")
            return new ResponseData(true, "Updated Successfully", { id: inventoryTransfer.id })
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
          
            throw new Error(error.message)

        } finally {
            client.release()
        }
    }
    public static async edittInventoryTransferLine(client: PoolClient, inventoryTransferLine: InventoryTransferLine) {
        try {

            const query: { text: string, values: any } = {
                text: ` UPDATE "InventoryTransferLines" SET  qty=$1 ,
                                                            "unitCost"=$2 ,
                                                            serial=$3,
                                                            batch=$4,
                                                            "parentId"=$5,
                                                            "onHand" =$6,
                                                            "prodDate"=$7,
                                                            "expireDate"=$8
                        WHERE id = $9
                          `,
                values: [inventoryTransferLine.qty, inventoryTransferLine.unitCost, inventoryTransferLine.serial, inventoryTransferLine.batch, inventoryTransferLine.parentId, inventoryTransferLine.onHand, inventoryTransferLine.prodDate, inventoryTransferLine.expireDate, inventoryTransferLine.id]
            }

            const insert = await client.query(query.text, query.values);

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


    public static async addSerialLines(client: PoolClient, inventoryTransfer: InventoryTransfer, line: InventoryTransferLine, company: Company) {
        try {
            for (let index = 0; index < line.serials.length; index++) {
                let serial: any = line.serials[index];
                let serialLine = new InventoryTransferLine();

                serialLine.ParseJson(serial)

                if (serialLine.id != null && serialLine.id != "") {
                    serialLine.parentId = line.id;
                    serialLine.productId = line.productId;
                    if (!serialLine.isSelected || line.isDeleted) /** delete line if is not selected to tansfer when line already exist  */ {
                        await this.deleteInventoryTransferLine(client, serialLine.id);
                    } else {
                        await this.edittInventoryTransferLine(client, serialLine)
                    }

                } else {
                    if ((serialLine.isSelected)) /** Add line only when the serial is selected to transfer */ {
                        serialLine.unitCost = inventoryTransfer.type == 'Transfer In' ? serialLine.unitCost : (await SerialProductRepo.getSerialUnitCost(client, serial.serial, inventoryTransfer.branchId, line.productId)).unitCost
                        serialLine.productId = line.productId;
                        serialLine.qty = 1;
                        serialLine.InventoryTransferId = line.InventoryTransferId;
                        serialLine.parentId = line.id;

                        await this.insertInventoryTransferLine(client, serialLine)
                    }
                }

                if (serialLine.isSelected && inventoryTransfer.status == 'Confirmed' && (inventoryTransfer.currentStatus == "" || inventoryTransfer.currentStatus != 'Confirmed')) {


                    await this.confirmed(client, serialLine, inventoryTransfer, company)
                }
            }
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async addBtahcesLines(client: PoolClient, inventoryTransfer: InventoryTransfer, line: InventoryTransferLine, company: Company) {
        try {


            for (let index = 0; index < line.batches.length; index++) {
                let batch: any = line.batches[index];
                let batchLine = new InventoryTransferLine();
                batchLine.ParseJson(batch)

                if (batchLine.id != null && batchLine.id != "") {
                    batchLine.parentId = line.id;
                    batchLine.productId = line.productId;
                    if (!batchLine.isSelected || line.isDeleted) { /** delete line if its not selected on edit */
                        await this.deleteInventoryTransferLine(client, batchLine.id);
                    }
                    await this.edittInventoryTransferLine(client, batchLine)

                } else {
                    if ((batchLine.isSelected)) /** only save line when it is selected to transfer  */ {
                        const batchInfo = await BatchProductRepo.getBatch(client, batchLine.batch, line.productId, inventoryTransfer.branchId)
                        batchLine.unitCost = inventoryTransfer.type == 'Transfer In' ? batchLine.unitCost : batchInfo.unitCost;
                        batchLine.qty = batch.qty
                        batchLine.productId = line.productId;
                        batchLine.InventoryTransferId = line.InventoryTransferId;
                        batchLine.parentId = line.id
                        batchLine.expireDate = batchInfo.expireDate
                        batchLine.prodDate = batchInfo.prodDate
                        await this.insertInventoryTransferLine(client, batchLine)
                    }

                }
                if (batchLine.isSelected && inventoryTransfer.status == 'Confirmed' && (inventoryTransfer.currentStatus == "" || inventoryTransfer.currentStatus != 'Confirmed')) {
                    await this.confirmed(client, batchLine, inventoryTransfer, company)
                }
            }
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)

        }
    }

    public static async deleteInventoryTransferLine(client: PoolClient, inventoryTransferId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `DELETE FROM "InventoryTransferLines" where id =$1`,
                values: [inventoryTransferId]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    //When Inventory transform is confirmed movment will be added and the inventory will be affected 
    public static async confirmed(client: PoolClient, inventoryTransferLine: InventoryTransferLine, inventoryTransfer: InventoryTransfer, company: Company) {
        try {

            const companyId = company.id;
            const branchId = inventoryTransfer.branchId;
            const productType = await ProductRepo.getProductType(client, inventoryTransferLine.productId)
            const productId = inventoryTransferLine.productId;
            const destinationBranch = inventoryTransfer.destinationBranch

            // add product to destination branch if not exist 
            if (destinationBranch != "" && destinationBranch != null) {

                const isProductExistInBranch = await BranchProductsRepo.checkIfProductAlreadyExistInBarnch(client, productId, destinationBranch);

                if (!isProductExistInBranch) {

                    const branchProduct = new BranchProducts();
                    branchProduct.companyId = companyId;
                    branchProduct.onHand = 0;
                    branchProduct.branchId = destinationBranch;
                    branchProduct.productId = productId;
                    await BranchProductsRepo.insertBranchProduct(client, branchProduct);
                }
            }

            // insert movment 
            if (productType == "inventory" || productType == "kit") {
                await this.invntoryProductTransfer(client, inventoryTransferLine, inventoryTransfer, branchId, company)
            } else if (productType == "serialized") {

                await this.serialProductTransfer(client, inventoryTransferLine, inventoryTransfer, branchId, company)
            } else if (productType == "batch") {
                await this.batchProductInventoryTransfer(client, inventoryTransferLine, inventoryTransfer, branchId, company)
            }

        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }


    /**
     * 
     * @param client 
     * @param inventoryTransferLine 
     * @param inventoryTransfer 
     * @param branchId 
     * @param company 
     * 
     * In inventory product transfer 
     * cost calculated = inventoryTransfer.qty * unitCost of the product 
     */

    public static async checkOnHandBalance(client: PoolClient, productId: string, branchId: string | null, qty: number) {
        const query: { text: string, values: any } = {
            text: `SELECT cast (("onHand"::text::numeric)  as real) as "balance"  FROM "BranchProducts"
           inner join "Products" on "Products".id = "BranchProducts"."productId"
          where "productId"= ($1) AND "branchId"=$2 and "parentId" is null `,
            values: [productId, branchId],
        };

        const onHand = await client.query(query.text, query.values);
        if ((onHand.rowCount && onHand.rowCount > 0 && onHand.rows[0].balance < qty)) {
            throw new ValidationException("QTY Balance is Less Than Trasfered Out QTY")
        }
    }
    public static async invntoryProductTransfer(client: PoolClient, inventoryTransferLine: InventoryTransferLine, inventoryTransfer: InventoryTransfer, branchId: string, company: Company) {
        try {
            const productId = inventoryTransferLine.productId;
            const qty = inventoryTransferLine.qty;
            const destinationBranch = inventoryTransfer.destinationBranch;
            let currentOnHand;
            if (inventoryTransfer.type == 'Transfer In') { //increase on current branch product onHand

                // currentOnHand = await ProductRepo.getProductOnHandAndUnitCost(client, productId, branchId);
                // new Prodcut OnHand

                // let onHand =   Helper.sub(qty,( currentOnHand.onHand+ currentOnHand.openingBalance), company.afterDecimal)
                // onHand =  Helper.add(onHand, currentOnHand.onHand, company.afterDecimal)
                // let onHand = currentOnHand.onHand + qty;
                // await this.calculateUnitCostAvg(client, productId, branchId, qty, inventoryTransferLine.unitCost, company.afterDecimal)

            } else if (inventoryTransfer.type == 'Transfer Out') { //decrease on current branch product onHand
                await this.checkOnHandBalance(client, productId, branchId, qty)

                currentOnHand = await ProductRepo.getProductOnHand(client, productId, branchId);
                //  if(currentOnHand <qty)
                //  {
                //     throw new Error("Existing qty is less than transfered qty")
                //  }
                // const productQty = currentOnHand - qty;

                // const product = await InvoiceInventoryMovmentRepo.getProduct(client, productId);
                // let isAchild = false;
                // let parentsData;
                // if ((product.parentId != null && product.parentId != "")) {
                //     isAchild = true;
                //     /** the function return product calculated unit cost along with parents info */
                //     const childData = (await InventoryProductRepo.calculateChildCost(client, product.id));
                //     parentsData = childData.parentsData;//product parents data {unitCost , chidlQty}
                //     if (parentsData.length > 0) {
                //         product.unitCost = childData.productUnitCost;
                //     }
                // }
                // const updateBranchProduct = await BranchProductsRepo.updateProductOnHand(client, branchId, qty, product, company.afterDecimal, parentsData, null, inventoryTransfer.employeeId, false, inventoryTransferLine.id)

                // await BranchProductsRepo.setNewOnHand(client, branchId, productId, productQty);


                await BranchProductsRepo.setOnHandNew(client, productId, branchId, qty, inventoryTransfer.confirmedEmployee ?? inventoryTransfer.employeeId, company.afterDecimal, null, inventoryTransferLine.id)
                // check if transfer to another branch 
                if (destinationBranch != null && destinationBranch != "") { // transfer from branch to onther , add the transfered qty to the other branch with movment 

                    // const branchCurrentOnHand = await ProductRepo.getProductOnHand(client, productId, destinationBranch)
                    // const branchProductQty = branchCurrentOnHand + qty;
                    // await BranchProductsRepo.setNewOnHand(client, destinationBranch, productId, branchProductQty);

                }

            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }
    /**
     * 
     * @param client 
     * @param inventoryTransferLine 
     * @param inventoryTransfer 
     * @param branchId 
     * @param company
     * 
     * In serial Prodcut transfer 
     * inventoryTransferLine.serials => array of serials 
     * cost = sum of all serials unit cost 
     */
    public static async serialProductTransfer(client: PoolClient, inventoryTransferLine: InventoryTransferLine, inventoryTransfer: InventoryTransfer, branchId: string, company: Company) {
        try {
            const productId = inventoryTransferLine.productId;
            const companyId = company.id;

            if (inventoryTransfer.type == 'Transfer In') {
                const branchProductId = await BranchProductsRepo.getBranchProductId(client, productId, branchId);
                if (inventoryTransferLine.serial == null || inventoryTransferLine.serial == "") { throw new Error("Serial Number is Required") }
                await SerialProductRepo.createAndInsertSerial(client, inventoryTransferLine, companyId, branchProductId, productId)

            } else if (inventoryTransfer.type == 'Transfer Out') {

                if (inventoryTransfer.destinationBranch != "" && inventoryTransfer.destinationBranch != null) {

                    const branchProductId = await BranchProductsRepo.getBranchProductId(client, productId, inventoryTransfer.destinationBranch);

                    // await SerialProductRepo.createAndInsertSerial(client, inventoryTransferLine, companyId, branchProductId, productId)
                    // await SerialProductRepo.deleteSerial(client, inventoryTransferLine.serial, branchId, productId)

                    await SerialProductRepo.transferSerial(client, branchProductId, inventoryTransferLine.serial, productId, branchId)

                } else {
                    await SerialProductRepo.deleteSerial(client, inventoryTransferLine.serial, branchId, productId)
                }
            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }

    /**
     * 
     * @param client 
     * @param inventoryTransferLine 
     * @param inventoryTransfer 
     * @param branchId 
     * @param company
     * 
     * In Batch Product Transfer 
     * inventoryTransferLine.batches
     * cost = batch.unitCost * batch.onHand
     */
    public static async batchProductInventoryTransfer(client: PoolClient, inventoryTransferLine: InventoryTransferLine, inventoryTransfer: InventoryTransfer, branchId: string, company: Company) {
        try {
            const productId = inventoryTransferLine.productId;
            const afterDecimal = company.afterDecimal;
            const companyId = company.id;

            if (inventoryTransfer.type == "Transfer In") {
                const branchProductId = await BranchProductsRepo.getBranchProductId(client, productId, branchId);

                if (inventoryTransferLine.batch == null || inventoryTransferLine.batch == "") {
                    throw new ValidationException("Batch is required")
                }
                await BatchProductRepo.createAndInsertBatch(client, inventoryTransferLine, companyId, branchProductId);

            } else if (inventoryTransfer.type == "Transfer Out") {

                if (inventoryTransferLine.batch == null || inventoryTransferLine.batch == "") {
                    throw new ValidationException("Batch is required")
                }


                const batchData = await BatchProductRepo.getBatchOnhandAndUnitCost(client, inventoryTransferLine.batch, productId, branchId)
                const currentOnHand = batchData.onHand;
                if (currentOnHand < inventoryTransferLine.qty) {
                    throw new ValidationException("Existing qty is less than transfered qty")
                }
                const batchOnHand = currentOnHand - inventoryTransferLine.qty

                // await BatchProductRepo.setBatchOnHand(client, inventoryTransferLine.batch, productId, branchId, batchOnHand)
                if (inventoryTransfer.destinationBranch != null && inventoryTransfer.destinationBranch != "") {
                    const branchProductId = await BranchProductsRepo.getBranchProductId(client, productId, inventoryTransfer.destinationBranch);
                    const batchId = await BatchProductRepo.getBatchId(client, inventoryTransfer.destinationBranch, inventoryTransferLine.batch, productId);
                    if (!batchId) {
                        await BatchProductRepo.createAndInsertBatch(client, inventoryTransferLine, companyId, branchProductId);
                    } else {
                        const batchProduct = await BatchProductRepo.getBatchOnhandAndUnitCost(client, inventoryTransferLine.batch, productId, inventoryTransfer.destinationBranch);
                        let currentOnHand = batchProduct.onHand;
                        const batchQty = currentOnHand + inventoryTransferLine.qty;
                        // await BatchProductRepo.setBatchOnHand(client, inventoryTransferLine.batch, productId, inventoryTransfer.destinationBranch, batchQty)
                    }
                }


            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }

    public static async calculateUnitCostAvg(client: PoolClient, productId: any, branchId: string, qty: number, unitCost: number, afterDecimal: number) {
        const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, productId, branchId);
        const branchProduct = new BranchProducts();
        branchProduct.ParseJson(branchProductData);

        //calculate new unitCost by Avarage
        // average = (oldUnitCost * oldOnHand) + (UnitCostAtPurchased * QtyAtPurchased) /  (oldOnHand +QtyAtPurchased)
        const oldonHand = branchProductData.onHand;
        const oldUnitCost = Helper.roundDecimal(branchProductData.unitCost, afterDecimal)// existing unitCost 
        const newQty = qty + branchProduct.onHand;

        // const newQty = branchProductData.onHand + branchProductData.openingBalance < 0 ? qty : Helper.add(branchProduct.onHand, qty, afterDecimal)
        const oldCost = Helper.multiply(oldUnitCost, branchProduct.onHand, afterDecimal) // existing totalCost 
        const newCost = Helper.multiply(qty, unitCost, afterDecimal)  // new totalCost 
        const average = newQty == 0 || branchProduct.onHand < 0 || (oldCost + newCost) == 0 ? unitCost : Helper.division((oldCost + newCost), newQty, afterDecimal)

        //update the current product unitCost 
        await ProductRepo.setProductUnitCost(client, average, productId, afterDecimal)

        //update branchProduct on Hand 
        branchProduct.onHand = newQty
        // await BranchProductsRepo.setNewOnHand(client, branchId, productId, newQty)

        return {
            newCost: newCost,
            oldCost: oldCost,
            oldonHand: oldonHand
        }
    }

    // private static async insertTransferOutMovment(client: PoolClient, productId: string, branchId: string, lineId: string, qty: number, cost: number, currentCost: number, currentOnHand: number, batch: string | null = null, serial: string | null = null) {
    //     try {
    //         /**
    //         * Transfer out => decrease on onHand (stock)
    //         * Inventory Assets => credit => movment Lines cost (-)
    //         * Cost Of Good Sold => debit => movmet cost (+)
    //         * 
    //         * cost = product.unitCost * transferIn qty 
    //         */

    //         const movmentData = {
    //             qty: qty,
    //             cost: cost,
    //             lineId: lineId,
    //             refrenceTable: "InventoryTransfer",
    //             currentCost: currentCost,
    //             currentOnHand: currentOnHand,
    //             productId: productId,
    //             branchId: branchId
    //         }

    //         await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)
    //     } catch (error: any) {
    //       
    //         throw new Error(error.message)
    //     }
    // }
    // private static async insertTransferInMovment(client: PoolClient, employeeId: string, productId: string, branchId: string, lineId: string, qty: number, cost: number, currentCost: number, currentOnHand: number, batch: string | null = null) {
    //     try {
    //         /**
    //         * Transfer In => increase on onHand (stock)
    //         * Inventory Assets => debit => movment Lines cost (+)
    //         * Cost Of Good Sold => credit => movmet cost (-)
    //         * 
    //         * cost = product.unitCost * transferIn qty 
    //         */


    //         qty = qty * (-1);
    //         cost = cost * (-1);
    //         const movmentData = {
    //             qty: qty,
    //             cost: cost,
    //             lineId: lineId,
    //             refrenceTable: "InventoryTransfer",
    //             currentCost: currentCost,
    //             currentOnHand: currentOnHand,
    //             productId: productId,
    //             branchId: branchId,
    //             employeeId: employeeId
    //         }

    //         await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)


    //     } catch (error: any) {
    //       
    //         throw new Error(error.message)
    //     }
    // }



    public static async getInventoryTransferList(data: any, company: Company, branchList: []) {
        try {
            const companyId = company.id;

            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList



            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let filter = data.filter;
            let sort = data.sortBy;
            let sortValue = !sort ? '"createdDate"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm;
            let page = data.page ?? 1
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            let status = filter && filter.status && filter.status.length > 0 ? filter.status : ['Open', 'Confirmed']
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query = {
                text: `SELECT
                COUNT(*) OVER(),
               "InventoryTransfers".id,
               "InventoryTransfers".reference,
               "InventoryTransfers".status,
               "InventoryTransfers".note,
               "InventoryTransfers".reason,
               "InventoryTransfers".type,
               "InventoryTransfers"."createdDate",
               "InventoryTransfers"."confirmDatetime",
               "InventoryTransfers"."employeeId",
               "InventoryTransfers"."transferNumber",
               "Branches"."name" as "branchName",
               "disBranch"."name" as "destinationBranchName"
               FROM "InventoryTransfers"
               INNER JOIN "Branches"  ON "Branches".id = "InventoryTransfers"."branchId"
               left JOIN "Branches" "disBranch"  ON "disBranch".id = "InventoryTransfers"."destinationBranch"
               Where "Branches"."companyId"=$1
               AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
               AND status =any($3)
               and (LOWER( "InventoryTransfers".type) ~ $4 
                     OR LOWER("InventoryTransfers".status) ~ $4 
                     OR LOWER("InventoryTransfers"."transferNumber") ~ $4
                     OR LOWER("InventoryTransfers".reason) ~ $4
                     OR nullif(regexp_replace("InventoryTransfers"."transferNumber", '[A-Z]*-', ''),'') ~ $4)
              and (($5::date is null) or ("createdDate"::date >= $5::date))
              AND  (($6::date is null) or ("createdDate"::date <= $6::date))
              ${orderByQuery}
              limit $7 offset $8
              `,
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






    public static async getInventoryTransferOutList(data: any, company: Company, branchList: String[]) {
        try {
            const companyId = company.id;

            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList



            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let filter = data.filter;
            let sort = data.sortBy;
            let sortValue = !sort ? '"createdDate"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm;
            let page = data.page ?? 1
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            let status = filter && filter.status && filter.status.length > 0 ? filter.status : ['Open', 'Confirmed']
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query = {
                text: `SELECT
                COUNT(*) OVER(),
               "InventoryTransfers".id,
               "InventoryTransfers".reference,
               "InventoryTransfers".status,
               "InventoryTransfers".note,
               "InventoryTransfers".reason,
               "InventoryTransfers".type,
               "InventoryTransfers"."createdDate",
               "InventoryTransfers"."confirmDatetime",
               "InventoryTransfers"."employeeId",
               "InventoryTransfers"."transferNumber"
               FROM "InventoryTransfers"
               INNER JOIN "Branches"  ON "Branches".id = "InventoryTransfers"."branchId"
               Where "Branches"."companyId"=$1
               AND "InventoryTransfers".type = 'Transfer Out'
               AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
               AND status =any($3)
               and (LOWER( "InventoryTransfers".type) ~ $4 
                     OR LOWER("InventoryTransfers".status) ~ $4 
                     OR LOWER("InventoryTransfers"."transferNumber") ~ $4
                     OR LOWER("InventoryTransfers".reason) ~ $4
                     OR nullif(regexp_replace("InventoryTransfers"."transferNumber", '[A-Z]*-', ''),'') ~ $4)
              and (($5::date is null) or ("createdDate"::date >= $5::date))
              AND  (($6::date is null) or ("createdDate"::date <= $6::date))
              ${orderByQuery}
              limit $7 offset $8
              `,
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







    public static async getInventoryTransferById(inventoryTransfersId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT
                InventoryTransfers.id,
                InventoryTransfers."transferNumber",
                InventoryTransfers.reference,
                InventoryTransfers.status,
                InventoryTransfers.note,
                InventoryTransfers.type,
                InventoryTransfers."createdDate",
                InventoryTransfers."confirmDatetime",
                InventoryTransfers."employeeId",
                InventoryTransfers."branchId",
                InventoryTransfers."destinationBranch",
                "destinationBranch".name as "destinationBranchName",
                "Branches".name as "branchName",
                 "CFEmployee".name as "confirmedEmployeeName", 
                 InventoryTransfers."confirmedEmployee",
                InventoryTransfers.reason,
                "Employees".name as "employeeName",
                (SELECT json_agg(
                json_build_object('id',"InventoryTransferLines".id,
                                  'unitCost',COALESCE("InventoryMovmentRecords"."cost","InventoryTransferLines"."unitCost"),
                                   'qty',"InventoryTransferLines".qty,
                                  'productId',"InventoryTransferLines"."productId",
                                  'productName',"Products".name,
                                  'UOM',"Products"."UOM",
                                  'categoryName',"Categories".name,
                                  'barcode',"Products".barcode,
                                   'type', "Products".type,
                                   'serial',"InventoryTransferLines".serial,
                                   'batch',"InventoryTransferLines".batch,
                                   'parentId',"InventoryTransferLines"."parentId",
                                   'expireDate',"InventoryTransferLines"."expireDate",
                                   'prodDate',"InventoryTransferLines"."prodDate",
                                   'onHand',case when   InventoryTransfers.status <> 'Confirmed' then "BranchProducts"."onHand" else "InventoryTransferLines"."onHand" end )
                )FROM "InventoryTransferLines"
                 INNER JOIN "Products" ON "Products".id = "InventoryTransferLines"."productId"
                 left JOIN "InventoryMovmentRecords" ON "InventoryMovmentRecords"."referenceId"= "InventoryTransferLines"."id" and((InventoryTransfers."type" = 'Transfer Out' and "InventoryMovmentRecords"."qty" < 0 ) or (InventoryTransfers."type" = 'Transfer In' and "InventoryMovmentRecords"."qty" >0))
                 LEFT JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id AND  "BranchProducts"."branchId" =   InventoryTransfers."branchId"
                 LEFT JOIN "ProductBatches" ON "ProductBatches"."branchProductId" =  "BranchProducts".id and trim(lower("InventoryTransferLines".batch)) = trim(lower("ProductBatches".batch))
                 LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"
                 WHERE "InventoryTransferLines"."inventoryTransferId" = InventoryTransfers.id
                 
                 )
                 as "lines"
                 FROM "InventoryTransfers" AS InventoryTransfers
                 INNER JOIN "Employees" on InventoryTransfers."employeeId" ="Employees".id 
                 LEFT JOIN "Employees" "CFEmployee" on  InventoryTransfers."confirmedEmployee"  =  "CFEmployee".id
                 INNER JOIN "Branches" on "Branches".id = InventoryTransfers."branchId"
                 LEFT JOIN "Branches" "destinationBranch" on "destinationBranch".id = InventoryTransfers."destinationBranch"
                 where InventoryTransfers.id = $1
                 and "Branches"."companyId"=$2
                    `,
                values: [inventoryTransfersId, companyId]
            }

            const list = await DB.excu.query(query.text, query.values)
            let inventoryTransfer = new InventoryTransfer();
            inventoryTransfer.ParseJson(list.rows[0]);
            inventoryTransfer.lines.filter(f => f.parentId != null).forEach((element: any) => {
                const Line = inventoryTransfer.lines.find(f => f.id == element.parentId);

                if (Line != null) {
                    const index = inventoryTransfer.lines.indexOf(Line);
                    if (Line.type == "batch") {
                        element.isSelected = true;
                        inventoryTransfer.lines[index].batches.push(element)
                    } else if (Line.type == "serialized") {
                        element.isSelected = true;
                        inventoryTransfer.lines[index].serials.push(element)
                    }
                    inventoryTransfer.lines.splice(inventoryTransfer.lines.indexOf(element), 1);
                }

            });
            return new ResponseData(true, "", inventoryTransfer)
        } catch (error: any) {
          
            throw new Error(error.message)

        }
    }
    public static async getTransferNumber(branchId: string, company: Company) {
        try {
            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('InventoryTransfer', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width
            
            const query: { text: string, values: any[] } = {
                text: `  SELECT "transferNumber"
                            FROM "InventoryTransfers"
                                INNER JOIN "Branches"
                                 ON "Branches".id = "InventoryTransfers"."branchId"
                                 Where "Branches"."companyId" = $1
                              AND "transferNumber" LIKE $2
                              AND SUBSTRING("transferNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                            ORDER BY 
                              CAST(SUBSTRING("transferNumber" FROM LENGTH($3)+1) AS INT) DESC
                            LIMIT 1`,
                            values: [companyId, `${prefix}%`, prefix]
                        };
            
            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].transferNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)
            
            return new ResponseData(true, "", { transferNumber: newNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getProductOnHand(client: PoolClient, productId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select         CASE WHEN
                                        "Products".type = 'inventory' 
                                    or  "Products".type = 'kit' 
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
                                    
                        from "Products"
                        left join "BranchProducts" on "BranchProducts"."productId"  = "Products".id and "BranchProducts"."branchId" = $1
                        left join "ProductBatches" on "ProductBatches"."branchProductId" =  "BranchProducts".id 
                        left join "ProductSerials" on "ProductSerials"."branchProductId" =  "BranchProducts".id 
                        where "Products".id = $2
                        group by "Products".type,"BranchProducts"."onHand"`,
                values: [branchId, productId]
            }

            const product = await client.query(query.text, query.values);
            return product.rows[0].onHand;
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getBatchWastageProducts(data: any, comapny: Company) {
        try {

            const branchId = data.branchId ? data.branchId : null;
            const companyId = comapny.id;

            const currentDate = new Date();
            const currentHour = currentDate.getUTCHours();
            const currentMinutes = currentDate.getUTCMinutes();
            const currentSeconds = currentDate.getUTCSeconds();
            let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds



            const query: { text: string, values: any } = {
                text: `
                SELECT "BranchProducts"."productId", 
                prod.name,
                prod."UOM",
                prod.type,
                prod."categoryId",
				prod."unitCost",
				barcode,
	            sum("ProductBatches"."onHand") as "onHand",
                jsonb_agg(jsonb_build_object('batch',"ProductBatches".batch,
											 'onHand',"ProductBatches"."onHand", 
											 'unitCost',"ProductBatches"."unitCost" ,
											 'prodDate',"prodDate",
											 'expired', ("expireDate" < $3::timestamp AND  "ProductBatches"."onHand"> 0),
											 'expireDate',"expireDate"
											)) as "batches",
			    "BranchProducts"."branchId"
                FROM "ProductBatches" 
                INNER JOIN "BranchProducts" ON "BranchProducts".id = "ProductBatches"."branchProductId"
                INNER JOIN "Products" as prod ON prod.id = "BranchProducts"."productId"
                WHERE "ProductBatches"."companyId" = $1
                    AND "BranchProducts"."branchId" = $2 
                    AND EXISTS(
                        Select 1
                        FROM "ProductBatches" as b2
                        where b2."branchProductId" = "ProductBatches"."branchProductId"
                        AND b2."expireDate" < $3::timestamp
                        AND  b2."onHand"> 0
                    )
                  
				Group By "BranchProducts"."productId", 
                prod.name,
                prod."UOM",
                prod.type,
				barcode,
                prod."categoryId",
				prod."unitCost","BranchProducts"."branchId"
                    `,
                values: [companyId, branchId, currentDate]
            }


            const list = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", list.rows)
        } catch (error: any) {
          
            throw new Error(error.message)

        }
    }


    public static async getTransferJournal(transferId: string, company: Company) {

        try {

            //Return invoice payment journal
            //when normal payment
            // paymentMethod account (Bank or Cash):==> Credit
            // account receivable :==> Debit 


            const journalQuery = {
                text: `SELECT   
                              "Branches"."name" as "branchName",
                JSON_AGG(JSON_BUILD_OBJECT('accountType',"JournalRecords"."name",'debit',case when "JournalRecords"."amount" > 0 then "JournalRecords"."amount" end ,'credit',case when "JournalRecords"."amount" < 0 then ABS("JournalRecords"."amount")end  )) as "journals"
                
                           FROM "JournalRecords"
                      inner join "InventoryTransfers" on "InventoryTransfers".id = "JournalRecords"."referenceId"
                      inner join "Branches" on "Branches".id = "InventoryTransfers"."branchId"
                      where "JournalRecords"."referenceId" = $1
                      and "InventoryTransfers"."type" = 'Transfer In'
                      and "amount" <> 0 
                         group by "Branches"."name" `,
                values: [transferId]
            }


            const transferJournal = await DB.excu.query(journalQuery.text, journalQuery.values);


            if (transferJournal && transferJournal.rows && transferJournal.rows.length > 0) {
                return new ResponseData(true, "", { defaultJournals: transferJournal.rows })
            } else {
                let query = {
                    text: `select 
                                abs(sum("qty" * "cost")) as "cost",
                          
                                "Branches".name as "branchName",
								 case when "InventoryTransfers"."destinationBranch" = "Branches".id then true else false end "isDestinationBranch"
                                from "InventoryMovmentRecords"
								inner join "InventoryTransfers" on "InventoryTransfers".id =  "InventoryMovmentRecords"."transactionId"
                                inner  join "Branches" on  "Branches".id = "InventoryMovmentRecords"."branchId"
                                where  "InventoryMovmentRecords"."companyId" = $1
                                 and "InventoryMovmentRecords"."transactionId" = $2
                                group by   "Branches".id, "InventoryTransfers"."destinationBranch" `,
                    values: [company.id, transferId]
                }

                let journal = await DB.excu.query(query.text, query.values);
                const defaultJournals = journal.rows && journal.rows.length > 0 ? journal.rows : []
                const journals: any[] = []
                if (defaultJournals && defaultJournals.length > 0) {
                    for (let index = 0; index < defaultJournals.length; index++) {
                
                        let journal = defaultJournals[index];
                    let cost = +(<any>journal).cost
                    let isDestination = (<any>journal).isDestinationBranch
                    let branchName = (<any>journal).branchName

                    if (cost && cost != 0) {
                        if (!isDestination) {
                            const firstBranchJournal = {
                                "branchName": branchName,
                                journals: [
                                    {
                                        accountType: "Costs Of Goods Sold",
                                        debit: cost,
                                        credit: 0,
                                        dbTable: "Inventory Transfer",
                                        referenceId: transferId
                                    },
                                    {
                                        accountType: "Inventory Assets",
                                        credit: cost,
                                        debit: 0,
                                        dbTable: "Inventory Transfer",
                                        referenceId: transferId
                                    }

                                ]
                            }
                            journals.push(firstBranchJournal)
                        } else {

                            const secondBranchJournal = {
                                "branchName": branchName,
                                journals: [
                                    {
                                        accountType: "Costs Of Goods Sold",
                                        debit: 0,
                                        credit: cost,
                                        dbTable: "Inventory Transfer",
                                        referenceId: transferId
                                    },
                                    {
                                        accountType: "Inventory Assets",
                                        credit: 0,
                                        debit: cost,
                                        dbTable: "Inventory Transfer",
                                        referenceId: transferId
                                    }

                                ]
                            }
                            journals.push(secondBranchJournal)

                        }
                    } 
                    }
                   




                }
                return new ResponseData(true, "", { defaultJournals: journals })

            }

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
}