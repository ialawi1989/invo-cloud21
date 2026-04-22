import { DB } from "@src/dbconnection/dbconnection";

import { Invoice } from "@src/models/account/Invoice";
import { InvoiceLine, InvoiceLineRecipe } from "@src/models/account/InvoiceLine";
import { Batches } from "@src/models/product/Batches";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { Product } from "@src/models/product/Product";

import { ResponseData } from "@src/models/ResponseData";

import { PoolClient } from "pg";
import { BranchProductsRepo } from "../product/branchProduct.repo";

import { RecipeRepo } from "../product/recipe.repo";




import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";
import { Helper } from "@src/utilts/helper";
import { InventoryMovmentRepo } from "./inventoryMovment.repo";
import { InventoryProductRepo } from "../product/productTypes/inventoryProduct.repo";
import { InvoiceLineOption } from "@src/models/account/invoiceLineOption";
import { OptionRepo } from "../product/option.repo";
import { SocketProductRepo } from "@src/repo/socket/product.socket";
export class InvoiceInventoryMovmentRepo {


    public static async getProduct(client: PoolClient, productId: string | null) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT id,type,"parentId","companyId","childQty","defaultPrice", "unitCost","kitBuilder","package",selection,"optionGroups",recipes FROM "Products" 
                      where id =($1)`,
                values: [productId]
            }
            const data = await client.query(query.text, query.values);

            if (data.rowCount == 0) {
                throw new Error("Product Not Found")
            }
            const product = new Product();
            product.ParseJson(data.rows[0])

            return product;
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    //Get Product Branch 
    public static async getBranchProduct(client: PoolClient, productId: string, branchId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT id,price,"onHand","branchId","openingBalance" FROM "BranchProducts" 
                      where "productId" =$1 AND "branchId" =$2`,
                values: [productId, branchId]
            }
            const data = await client.query(query.text, query.values);
            let branchData;
            if (data.rowCount == 0) { // if not found then add branch product
                //TODO: ADD PRODUCT TO BRANCH 
                // throw new Error("Branch Product Not Found")
                /** Will Add Branch Product if not exist */
                let branchProduct = await this.addBranchProductIfNotExist(client, branchId, productId);
                branchData = branchProduct
            } else {
                branchData = data.rows[0];
            }

            const branchProduct = new BranchProducts();
            branchProduct.ParseJson(data.rows[0])
            return branchProduct;
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    // Get Products Parents 
    public static async getParentsOfProduct(client: PoolClient, productId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `WITH RECURSIVE generation AS (
                    SELECT id,
                         name,
                         "parentId",
                         "childQty",
                         "unitCost",
                         0 AS generation_number
                    FROM "Products"
                    where id = $1
                   
                 
                UNION ALL
                 
                    SELECT parent.id,
                         parent.name,
                         parent."parentId",
                         parent."childQty",
                         parent."unitCost",
                         generation_number+1 AS generation_number
                    FROM "Products" as parent
                    JOIN generation g
                      ON g."parentId" = parent.id
                    
                 
                )
                 
                SELECT 
                        g.name AS child_name,
                        g.id AS "productId",
                        g."unitCost" as "childUnitCost",
                        g."childQty" As "childQty",
                        g.generation_number,
                        parent.name AS "parentName",
                        parent."unitCost" ,
                        parent.id AS "parentId"
                FROM generation g
                JOIN "Products" parent
                ON g."parentId" = parent.id
                ORDER BY generation_number;`,
                values: [productId]
            }

            const data = await client.query(query.text, query.values)
            return data.rows;
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    // Add Movment According to product type 
    public static async addInventoryMovment(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, acctualQty: number, afterDecimal: number) {

        try {
            const product = await this.getProduct(client, invoiceLine.productId);
            console.log(invoice)
            let resault;
            if (invoice.onlineStatus == 'Pending' || invoice.onlineStatus == 'Rejected') {
                return
            }
            if (product.type == "serialized" && invoice.onlineStatus != 'Rejected')
                if (product.type == "serialized" && (invoiceLine.serial == "" || invoiceLine.serial == null)) {
                    throw new Error(" Serial Number is  Required")
                }

            if (product.type == "batch" && invoice.onlineStatus != 'Rejected')
                if (product.type == "batch" && (invoiceLine.batch == "" || invoiceLine.batch == null)) {
                    throw new Error("Batch  Number is  Required")
                }

            if (invoiceLine.qty < 0 && invoiceLine.voidFrom != null && invoiceLine.voidFrom != '') {
                await this.voidedLineRecipe(client, invoiceLine)
            } else if (invoiceLine.isEditedLine && invoice.currentInvoiceStatus != 'Draft') {
                await this.editLineRecipe(client, invoiceLine, afterDecimal)
            } else {
                switch (product.type) {
                    case 'inventory':
                        resault = await this.inventoryProductMovment(client, invoiceLine, invoice, acctualQty, product, afterDecimal, null);
                        break;
                    case 'menuItem':
                        resault = await this.menuItemProductMovment(client, invoiceLine, invoice, acctualQty, product, afterDecimal, null);
                        break;
                    case 'kit':
                        resault = await this.inventoryProductMovment(client, invoiceLine, invoice, acctualQty, product, afterDecimal, null);
                        break;
                    case 'batch':
                        resault = await this.batchProductMovment(client, invoiceLine, acctualQty, product, afterDecimal);
                        break;
                    case 'serialized':
                        resault = await this.serialProductMovment(client, invoiceLine, product, afterDecimal);
                        break;
                    default:
                        break;
                }
            }


            return resault

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    // Add Inventory Product Movment 
    private static async inventoryProductMovment(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, acctualQty: number, product: Product, afterDecimal: number, productQty: number | null, invoiceLineOption: InvoiceLineOption | null = null) {
        try {
            let parentsData: any;
            let isAchild = false;
            let employeeId: any = invoice.employeeId;
            // //WHEN PRODUCT IS A PARENT CHILD PRODUCT UNIT COST IS CALCULATED 
            // if ((product.parentId != null && product.parentId != "")) {
            //     isAchild = true;
            //     /** the function return product calculated unit cost along with parents info */
            //     const childData = (await InventoryProductRepo.calculateChildCost(client, product.id));

            //     parentsData = childData.parentsData;//product parents data {unitCost , chidlQty}
            //     if (parentsData.length > 0) {
            //         product.unitCost = childData.productUnitCost;
            //     }
            // }

            console.log("====================================================")
            productQty = (productQty == null) ? 1 : productQty;
            console.log(invoiceLine.parentUsages)
            let parentUsages = (!invoiceLine.parentUsages) || (invoiceLine.parentUsages == 0) ? 1 : invoiceLine.parentUsages;
            acctualQty = acctualQty * parentUsages;
            const updatedQty = acctualQty * productQty


            let totalQty = invoiceLine.qty * parentUsages * productQty
            if (invoiceLineOption) {
                totalQty = totalQty * invoiceLineOption.qty
            }
            if (product.id) {
                await BranchProductsRepo.setOnHandNew(client, product.id, invoiceLine.branchId, updatedQty, employeeId, afterDecimal, invoiceLine.id, null)

            }

            // const totalCost = Math.abs(totalQty) * updateBranchProduct.unitCost

            let productMovment = new InvoiceLineRecipe()



            productMovment.productId = product.id;
            // productMovment.cost = totalCost;
            productMovment.qty = Math.abs(totalQty)
            // productMovment.unitCost = updateBranchProduct.unitCost;
            if (invoiceLineOption) {
                invoiceLineOption.recipe.push(productMovment);

            } else {
                invoiceLine.recipe.push(productMovment);

            }


            // return invoiceLine;

            // const productId = product.id;
            // const lineId = invoiceLine.id;
            // const refrenceTable = "Invoice";
            // const currentCost = updateBranchProduct.currentCost;
            // const currentOnHand = updateBranchProduct.currentOnHand;

            // const movmentData = {
            //     qty: totalQty,
            //     cost: totalCost,
            //     lineId: lineId,
            //     refrenceTable: refrenceTable,
            //     currentCost: currentCost,
            //     currentOnHand: currentOnHand,
            //     productId: productId,
            //     branchId: invoice.branchId,
            //     employeeId: invoiceLine.employeeId

            // }
            // await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    // Add MenuItem Product Movment 
    private static async menuItemProductMovment(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, acctualQty: number, product: Product, afterDecimal: number, productQty: number | null) {
        try {
            let inventoryProductData: any;
            if (product.recipes && product.recipes.length > 0) {
                for (let index = 0; index < product.recipes.length; index++) {
                    const recipeItem: any = product.recipes[index];
                    if (recipeItem.recipeId) {
                        const recipeData = await RecipeRepo.getRecipeProducts(client, recipeItem.recipeId, recipeItem.usages)


                        for (let index = 0; index < recipeData.length; index++) {
                            const recipeInventoryItem: any = recipeData[index];

                            inventoryProductData = {
                                id: recipeInventoryItem.id,
                                unitCost: recipeInventoryItem.unitCost,
                                parentId: recipeInventoryItem.parentId,
                                childQty: recipeInventoryItem.childQty
                            }
                            productQty = (productQty == null) ? 1 : productQty;

                            const totalUsage = recipeInventoryItem.totalUsage * productQty
                            await this.inventoryProductMovment(client, invoiceLine, invoice, acctualQty, inventoryProductData, afterDecimal, totalUsage);
                        }
                    } else if (recipeItem.inventoryId) {
                        console.log(recipeItem)
                        inventoryProductData = await this.getProduct(client, recipeItem.inventoryId)

                        await this.inventoryProductMovment(client, invoiceLine, invoice, acctualQty, inventoryProductData, afterDecimal, recipeItem.usages);
                    }
                }
            }

            return invoiceLine;
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    // Add Batch Product Movment 
    private static async getBatchUnitCost(client: PoolClient, productId: string, branchId: string, batch: string) {
        try {
            const query = {
                text: `SELECT "unitCost" from "BranchProducts"
                       inner join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id 
                       where "BranchProducts"."branchId" = $1
                       and "BranchProducts"."productId" =$2
                       and "ProductBatches"."batch" = $3
                 `,
                values: [branchId, productId, batch]
            }

            let product = await client.query(query.text, query.values);
            if (product && product.rows && product.rows.length > 0) {
                return product.rows[0].unitCost
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    private static async batchProductMovment(client: PoolClient, invoiceLine: InvoiceLine, acctualQty: number, product: Product, afterDecimal: number) {
        try {

            let unitCost = await this.getBatchUnitCost(client, product.id, invoiceLine.branchId, invoiceLine.batch)

            let productMovment = new InvoiceLineRecipe()

            if (invoiceLine.productId) {
                productMovment.productId = invoiceLine.productId
                productMovment.cost = unitCost
                productMovment.qty = invoiceLine.qty
                productMovment.unitCost = unitCost;

            }

            invoiceLine.recipe.push(productMovment)

            // const movmentData = {
            //     qty: acctualQty,
            //     cost: totalCost,
            //     lineId: invoiceLine.id,
            //     refrenceTable: "Invoice",
            //     currentCost: updateBatch.currentCost,
            //     currentOnHand: updateBatch.currentOnHand,
            //     productId: invoiceLine.productId,
            //     branchId: invoiceLine.branchId
            // }

            // await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)
            return invoiceLine;

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    // Add Serial Product Movment 
    private static async serialProductMovment(client: PoolClient, invoiceLine: InvoiceLine, product: Product, afterDecimal: number) {
        try {


            const serialUnitCost = await SerialProductRepo.getSerialUnitCost(client, invoiceLine.serial, invoiceLine.branchId, product.id)
            const branchProduct = await this.getBranchProduct(client, product.id, invoiceLine.branchId);
            await this.updateSerialProduct(client, invoiceLine, branchProduct);
            const totalCost = Helper.multiply(invoiceLine.qty, serialUnitCost.unitCost, afterDecimal);

            let productMovment = new InvoiceLineRecipe()

            if (invoiceLine.productId) {
                productMovment.productId = invoiceLine.productId
                productMovment.cost = totalCost
                productMovment.qty = invoiceLine.qty
                productMovment.unitCost = serialUnitCost.unitCost;

            }

            invoiceLine.recipe.push(productMovment)

            // const movmentData = {
            //     qty: invoiceLine.qty,
            //     cost: totalCost,
            //     lineId: invoiceLine.id,
            //     refrenceTable: "Invoice",
            //     currentCost: serialUnitCost.unitCost * updateSerial.currentOnHand,
            //     currentOnHand: updateSerial.currentOnHand,
            //     productId: invoiceLine.productId,
            //     branchId: invoiceLine.branchId
            // }
            // await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)
            return invoiceLine;
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    // Update Batch On Hand
    private static async updateBatch(client: PoolClient, invoiceLine: InvoiceLine, branchProduct: BranchProducts, acctualQty: number) {
        try {

            console.log(branchProduct.id, invoiceLine.batch)
            const query: { text: string, values: any } = {
                text: `SELECT "onHand" ,"unitCost" FROM  "ProductBatches" WHERE "branchProductId"= $1 AND batch=$2`,
                values: [branchProduct.id, invoiceLine.batch]
            }

            const batchData = await client.query(query.text, query.values);
            if (batchData.rowCount == 0) {
                throw new Error("Invalid Batch Number")
            }
            const batch = new Batches();
            batch.ParseJson(batchData.rows[0])
            const currentCost = batch.unitCost * batch.onHand;
            const currentOnHand = batch.onHand;
            let updatedOnHand: any = 0;

            if (acctualQty < 0) {
                updatedOnHand = currentOnHand + (acctualQty * (-1));
            } else {
                updatedOnHand = currentOnHand - acctualQty;
            }


            query.text = `UPDATE "ProductBatches" SET "onHand" = $1 WHERE "branchProductId"= $2 AND batch=$3 `
            query.values = [updatedOnHand, branchProduct.id, invoiceLine.batch];

            const update = await client.query(query.text, query.values)

            return {
                unitCost: batch.unitCost,
                currentCost: currentCost,
                currentOnHand: currentOnHand
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    // Update Serial  On Hand
    private static async updateSerialProduct(client: PoolClient, invoiceLine: InvoiceLine, branchProduct: BranchProducts) {
        try {

            const status = "Available"
            const query: { text: string, values: any } = {
                text: `SELECT serial FROM  "ProductSerials" WHERE "branchProductId"= $1 AND status=$2 `,
                values: [branchProduct.id, status]
            }

            const serialsData = await client.query(query.text, query.values);

            const currentOnHand = serialsData.rowCount;
            console.log(invoiceLine.qty)
            const updatedStatus: any = invoiceLine.qty == 1 ? "Sold" : "Available";

            query.text = `UPDATE "ProductSerials" SET status = $1 WHERE "branchProductId"= $2 AND serial=$3 `
            query.values = [updatedStatus, branchProduct.id, invoiceLine.serial];

            const update = await client.query(query.text, query.values)
            const serialData = {
                serial: invoiceLine.serial,
                status: updatedStatus
            }
            console.log(serialData)
            console.log(invoiceLine.branchId)
            await SocketProductRepo.onHandsync(client, 0, invoiceLine.productId, invoiceLine.branchId, null, serialData)
            return {
                currentOnHand: currentOnHand
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    // update movment and movment line when editing on invoice Line 

    public static async getProductInventoryMovment(branchId: string, productId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT 
                InventoryMovments.id,
                InventoryMovments."createdAt",
                (select sum("InventoryMovments".cost) from "InventoryMovments" INNER join "InventoryMovmentLines" on "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id and  "InventoryMovmentLines"."productId" =$2) as cost,
                (SELECT json_agg(
                    json_build_object('qty',qty,'cost',cost,'productId',"productId",'currentOnHand',"currentOnHand",'currentCost',"currentCost")
                    )FROM "InventoryMovmentLines"
                    where "InventoryMovmentLines"."productId" =$2
                    )as InventoryMovmentLines
                FROM "InventoryMovments" AS InventoryMovments
                INNER JOIN "InventoryMovmentLines" AS InventoryMovmentLinesTable on
                InventoryMovmentLinesTable."inventoryMovmentId"  = InventoryMovments.id 
                AND InventoryMovments."branchId" = $1 
                AND InventoryMovmentLinesTable."productId" = $2
                group by InventoryMovments.id`,
                values: [branchId, productId]
            }

            const movment = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", movment.rows)
        } catch (error: any) {
          
            return new ResponseData(false, error, [])
        }
    }

    public static async calculateOptionMovment(client: PoolClient, invoiceLineOption: InvoiceLineOption, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {
            let inventoryProductData: any;
            let optionId: any = invoiceLineOption.optionId;
            /**Select Option Recipe */
            invoiceLineOption.recipe = []
            if (invoiceLineOption.isEditedOption) {
                await this.editOPtionRecipe(client, invoiceLineOption, invoiceLine)
            } if (invoiceLine.qty < 0 && invoiceLine.voidFrom != null && invoiceLine.voidFrom != "") {
                await this.voidOPtionRecipe(client, invoiceLineOption, invoiceLine)
            } else {
                let optionRecipes: any = await OptionRepo.getOptionRecipe(client, optionId);
                if (optionRecipes && optionRecipes.length > 0) {

                    for (let index = 0; index < optionRecipes.length; index++) {
                        const recipeItem: any = optionRecipes[index];
                        if (recipeItem.recipeId) {
                            const recipeData = await RecipeRepo.getRecipeProducts(client, recipeItem.recipeId, recipeItem.usages)


                            for (let index = 0; index < recipeData.length; index++) {
                                const recipeInventoryItem: any = recipeData[index];

                                inventoryProductData = {
                                    id: recipeInventoryItem.id,
                                    unitCost: recipeInventoryItem.unitCost,
                                    parentId: recipeInventoryItem.parentId,
                                    childQty: recipeInventoryItem.childQty
                                }
                                const totalUsage = recipeInventoryItem.totalUsage
                                await this.inventoryProductMovment(client, invoiceLine, invoice, invoiceLine.qty * invoiceLineOption.qty, inventoryProductData, afterDecimal, totalUsage, invoiceLineOption);
                            }
                        } else if (recipeItem.inventoryId) {
                            recipeItem.inventoryId;
                            inventoryProductData = await this.getProduct(client, recipeItem.inventoryId)
                            console.table(inventoryProductData)
                            await this.inventoryProductMovment(client, invoiceLine, invoice, invoiceLine.qty * invoiceLineOption.qty, inventoryProductData, afterDecimal, recipeItem.usages, invoiceLineOption);
                        }
                    }
                }
            }


            return invoiceLine;
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }


    public static async getOptionQtyandRecipe(client: PoolClient, invoiceLineId: string | null, optionId: string | null) {
        try {
            console.log(optionId, invoiceLineId)
            const query = {
                text: `select "InvoiceLines"."qty" , "InvoiceLineOptions"."recipe" from "InvoiceLineOptions"
                    inner join "InvoiceLines" on "InvoiceLines".id = "InvoiceLineOptions"."invoiceLineId"
                        where "InvoiceLineOptions"."optionId" =$1 
                         and "InvoiceLineOptions"."invoiceLineId" =$2
                        `,
                values: [optionId, invoiceLineId]
            }

            const option = await client.query(query.text, query.values);
            return option.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async voidOPtionRecipe(client: PoolClient, invoiceLineOption: InvoiceLineOption, invoiceLine: InvoiceLine) {
        try {
            if (invoiceLine.voidFrom != null || invoiceLine.voidFrom != "") {
                let voidedoption = await this.getOptionQtyandRecipe(client, invoiceLine.voidFrom, invoiceLineOption.optionId);
                console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeeeee", voidedoption)
                if (voidedoption) {
                    const qty = voidedoption.qty;
                    const recipe = voidedoption.recipe
                    console.log(recipe)
                    if (recipe && recipe.length > 0) {

                        invoiceLineOption.recipe = []
                        for (let index = 0; index < recipe.length; index++) {
                            const element = recipe[index];
                            if (element.productId) {
                                console.log(element.productId, invoiceLine.qty)
                                let lineProductmovment = new InvoiceLineRecipe()
                                lineProductmovment.qty = (element.qty / qty) * invoiceLine.qty;
                                lineProductmovment.cost = ((element.qty / qty) * invoiceLine.qty * element.unitCost)
                                lineProductmovment.unitCost = element.unitCost
                                lineProductmovment.productId = element.productId;
                                invoiceLineOption.recipe.push(lineProductmovment)
                                const product = {
                                    id: element.productId
                                }
                                if (element.productId) {
                                    await this.updateBranchProduct(client, invoiceLine, product, lineProductmovment.qty * (-1), null)
                                }

                            }
                        }


                    }
                }
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editOPtionRecipe(client: PoolClient, invoiceLineOption: InvoiceLineOption, invoiceLine: InvoiceLine) {
        try {
            let voidedoption = await this.getOptionQtyandRecipe(client, invoiceLine.voidFrom, invoiceLineOption.optionId);
            if (voidedoption) {
                const qty = voidedoption.qty;
                const recipe = voidedoption.recipe
                console.log(recipe)
                if (recipe && recipe.length > 0) {

                    invoiceLineOption.recipe = []
                    for (let index = 0; index < recipe.length; index++) {
                        const element = recipe[index];
                        if (element.productId) {
                            console.log(recipe.productId)
                            let lineProductmovment = new InvoiceLineRecipe()
                            lineProductmovment.qty = (element.qty / qty) * invoiceLine.qty;
                            lineProductmovment.cost = ((element.qty / qty) * invoiceLine.qty * element.unitCost)
                            lineProductmovment.unitCost = element.unitCost
                            lineProductmovment.productId = element.productId;
                            invoiceLineOption.recipe.push(lineProductmovment)
                            const product = {
                                id: element.productId
                            }
                            const acctualQty = (element.qty / qty) * invoiceLine.qty - element.qty
                            if (element.productId) {
                                await this.updateBranchProduct(client, invoiceLine, product, acctualQty, null)
                            }

                        }
                    }


                }
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    private static async addBranchProductIfNotExist(client: PoolClient, branchId: string, productId: string) {
        try {
            // check if product exist in the same company as branch 

            const query = {
                text: `
                select count("Products".id) as "count", "Products"."companyId" from "Products" 
                inner join "Branches" on "Branches"."companyId" = "Products"."companyId"
                where "Products".id = $1
                and "Branches".id =$2
                group by "Products"."companyId"`,
                values: [productId, branchId]
            }

            let product = await client.query(query.text, query.values);

            if (product.rows && product.rows.length > 0 && product.rows[0].count > 0) {
                const companyId = product.rows[0].companyId
                const branchProduct = new BranchProducts();

                branchProduct.companyId = companyId,
                    branchProduct.price = null;
                branchProduct.productId = productId;
                branchProduct.branchId = branchId;
                branchProduct.onHand = 0;
                await BranchProductsRepo.insertBranchProduct(client, branchProduct)
                return branchProduct;
            }
            throw new Error("Product is not available")
        } catch (error: any) {
            throw new Error(error)
        }
    }


    private static async getInvoiceLineQtyRecipe(client: PoolClient, voidedFrom: string | null) {
        try {
            const query = {
                text: `SELECT "qty","recipe" from "InvoiceLines" where id=$1`,
                values: [voidedFrom]
            }

            let line = await client.query(query.text, query.values);
            console.log("==getInvoiceLineQtyRecipe===", line.rows[0])
            return line.rows[0]


        } catch (error: any) {
            throw new Error(error)
        }
    }
    private static async voidedLineRecipe(client: PoolClient, invoiceLine: InvoiceLine) {
        try {
            invoiceLine.recipe = []
            if (invoiceLine.voidFrom != null || invoiceLine.voidFrom != "") {
                let voidedLine = await this.getInvoiceLineQtyRecipe(client, invoiceLine.voidFrom);
                if (voidedLine) {
                    const qty = voidedLine.qty;
                    const recipe = voidedLine.recipe
                    if (recipe && recipe.length > 0) {
                        for (let index = 0; index < recipe.length; index++) {
                            const element = recipe[index];
                            if (element.productId) {
                                console.log(recipe.productId)
                                let lineProductmovment = new InvoiceLineRecipe()
                                lineProductmovment.qty = (element.qty / qty) * invoiceLine.qty;
                                lineProductmovment.cost = ((element.qty / qty) * invoiceLine.qty * element.unitCost)
                                lineProductmovment.unitCost = element.unitCost
                                lineProductmovment.productId = element.productId;
                                invoiceLine.recipe.push(lineProductmovment)


                                if (invoiceLine.serial != "" && invoiceLine.serial != null) {
                                    await this.setSerialstatus(client, invoiceLine.branchId, element.productId, invoiceLine.serial)
                                }

                                // const product = {
                                //     id: element.productId
                                // }
                                // if (element.productId) {
                                //     if (invoiceLine.batch != null && invoiceLine.batch != "") {
                                //         await this.setBatchOnhand(client, invoiceLine.branchId, element.productId, invoiceLine.batch, lineProductmovment.qty * (-1))
                                //     } else if (invoiceLine.serial != null && invoiceLine.serial != "") {
                                //         await this.setSerialstatus(client, invoiceLine.branchId, element.productId, invoiceLine.serial)

                                //     } else {
                                //         await this.updateBranchProduct(client, invoiceLine, product, lineProductmovment.qty * (-1), null)
                                //     }
                                // }

                            }
                        }


                    }
                }
            }
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    static async setBatchOnhand(client: PoolClient, branchId: string, productId: string, batch: string, onHand: number) {
        try {
            const query = {
                text: `update "ProductBatches"  set "onHand" = "onHand" + $4 where  "ProductBatches"."id" = (
                    select  "ProductBatches".id from "ProductBatches" 
                        inner join "BranchProducts" on "BranchProducts".id = "ProductBatches"."branchProductId"
                        where "BranchProducts"."branchId" = $1
                        and "BranchProducts"."productId" = $2
                        and "ProductBatches"."batch" = $3
                    )`,
                values: [branchId, productId, batch, onHand]
            };
            await client.query(query.text, query.values);
        }
        catch (error: any) {
            throw new Error(error);
        }
    }
    static async setSerialstatus(client: PoolClient, branchId: string, productId: string, serial: string) {
        try {
            const query = {
                text: `update "ProductSerials"  set "status" = 'Available' where "ProductSerials"."id" = (
                    select "ProductSerials".id from "ProductSerials" 
                        inner join "BranchProducts" on "BranchProducts".id = "ProductSerials"."branchProductId"
                        where "BranchProducts"."branchId" = $1
                        and "BranchProducts"."productId" = $2
                        and "ProductSerials"."serial" = $3
                    )`,
                values: [branchId, productId, serial]
            };
            await client.query(query.text, query.values);
        }
        catch (error: any) {
            throw new Error(error);
        }
    }
    private static async updateBranchProduct(client: PoolClient, invoiceLine: InvoiceLine, product: any, acctualQty: number, usages: number | null) {
        try {


            const branchProduct = await InvoiceInventoryMovmentRepo.getBranchProduct(client, product.id, invoiceLine.branchId);
            const currentOnHand = branchProduct.onHand;
            const currentCost = branchProduct.onHand * product.unitCost
            let updatedOnHand;
            if (usages == null) {
                updatedOnHand = currentOnHand + acctualQty;
            } else {
                updatedOnHand = currentOnHand + (acctualQty * usages);
            }

            //Update Product On Hand
            await BranchProductsRepo.setNewOnHand(client, invoiceLine.branchId, product.id, updatedOnHand)
            return {
                currentCost: currentCost,
                currentOnHand: currentOnHand
            }
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }


    private static async editLineRecipe(client: PoolClient, invoiceLine: InvoiceLine, afterDecimal: number) {
        try {

            let voidedLine = await this.getInvoiceLineQtyRecipe(client, invoiceLine.id);
            const employeeId: any = invoiceLine.employeeId
            invoiceLine.recipe = []
            if (voidedLine) {
                const qty = voidedLine.qty;
                const recipe = voidedLine.recipe
                console.log(recipe)
                if (recipe && recipe.length > 0) {

                    console.log(recipe.length)
                    for (let index = 0; index < recipe.length; index++) {
                        const element = recipe[index];
                        if (element.productId) {
                            console.log(recipe.productId)
                            let lineProductmovment = new InvoiceLineRecipe()
                            lineProductmovment.qty = (element.qty / qty) * invoiceLine.qty;
                            lineProductmovment.cost = ((element.qty / qty) * invoiceLine.qty * element.unitCost)
                            lineProductmovment.unitCost = element.unitCost
                            lineProductmovment.productId = element.productId;
                            invoiceLine.recipe.push(lineProductmovment)

                            const acctualQty = lineProductmovment.qty - element.qty;

                            const product = {
                                id: element.productId
                            }
                            if (invoiceLine.productId) {
                                if (invoiceLine.batch != null && invoiceLine.batch != "") {
                                    await this.setBatchOnhand(client, invoiceLine.branchId, invoiceLine.productId, invoiceLine.batch, element.qty)
                                } else if (invoiceLine.serial != null && invoiceLine.serial != "") {
                                    await this.setSerialstatus(client, invoiceLine.branchId, invoiceLine.productId, invoiceLine.serial)

                                } else {
                                    let parentsData: any;

                                    const childData = (await InventoryProductRepo.calculateChildCost(client, product.id));
                                    parentsData = childData.parentsData
                                    await BranchProductsRepo.updateProductOnHand(client, invoiceLine.branchId, acctualQty, product, afterDecimal, parentsData, null, employeeId, true, invoiceLine.id)
                                }
                            }

                        }
                    }


                }
            }

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
}

export { InventoryMovmentRepo };
