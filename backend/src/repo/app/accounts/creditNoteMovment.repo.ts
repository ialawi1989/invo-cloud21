import { CreditNote } from "@src/models/account/CreditNote";
import { CreditNoteLine } from "@src/models/account/CreditNoteLine";
import { InventoryMovment } from "@src/models/account/InventoryMovment";
import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
import { Batches } from "@src/models/product/Batches";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { Product } from "@src/models/product/Product";
import { PoolClient } from "pg";


import { InvoiceInventoryMovmentRepo } from "./InvoiceInventoryMovment.repo";


import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";


import { InvoiceLineRecipe } from "@src/models/account/InvoiceLine";

import { CreditNoteLineOption } from "@src/models/account/CreditNoteLineOptions";


export class CreditNoteMovmentRepo {
    /**
     * 
     * COGS => credit
     * Inventory Assets =>Debit
     * 
     */


    // Insert Credit Note Movment accordingly to product Type
    public static async insertInventoryMovment(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, afterDecimal: number, acctualQty: number) {
        try {

            const product = await InvoiceInventoryMovmentRepo.getProduct(client, creditNoteLine.productId);
            let resault;
            if (creditNote.invoiceOnlineStatus && creditNote.invoiceOnlineStatus == 'Rejected') {
                return
            }
            switch (product.type) {
                case 'inventory':
                    console.log(product,creditNoteLine.parentUsages)
                    resault = await this.inventoryProductMovment(client, creditNoteLine, creditNote, product, afterDecimal, acctualQty, null);
                    break;
                case 'menuItem':
                    resault = await this.menuItemProductMovment(client, creditNoteLine, creditNote, product, afterDecimal, acctualQty, null);
                    break;
                case 'kit':
                    resault = await this.inventoryProductMovment(client, creditNoteLine, creditNote, product, afterDecimal, acctualQty, null);
                    break;
                case 'batch':
                    resault = await this.batchProductMovment(client, creditNoteLine, creditNote, product, afterDecimal, acctualQty);
                    break;
                case 'serialized':
                    resault = await this.serialProductMovment(client, creditNoteLine, creditNote, product, afterDecimal);
                    break;
                default:
                    break;
            }

            return resault

        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }


    }

    // Movment for "inventory" products
    private static async inventoryProductMovment(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, product: Product, afterDecimal: number, acctualQty: number, productQty: number | null) {
        try {


            if (creditNoteLine.invoiceLine && creditNoteLine.invoiceLine.recipe.length > 0) {

                for (let index = 0; index < creditNoteLine.invoiceLine.recipe.length; index++) {
                    const element = creditNoteLine.invoiceLine.recipe[index];
                    if (creditNoteLine.productId && creditNoteLine.invoiceLine) {
                        let lineProductmovment = new InvoiceLineRecipe()
                        lineProductmovment.qty = (element.qty / creditNoteLine.invoiceLine?.qty ) * creditNoteLine.qty * (-1);
                        lineProductmovment.cost = ((element.qty / creditNoteLine.invoiceLine?.qty ) * creditNoteLine.qty * element.unitCost) * (-1)
                        lineProductmovment.unitCost = element.unitCost
                        lineProductmovment.productId = element.productId;
                        creditNoteLine.recipe.push(lineProductmovment)
                        const product = {
                            id: element.productId
                        }
                        await this.updateBranchProduct(client, creditNoteLine, product, lineProductmovment.qty * (-1), null)
                    }
                }

            }

            // if( creditNoteLine.invoiceLine && creditNoteLine.invoiceLine.recipe.length>0)
            // {
            //     let invoiceRecipe = creditNoteLine.invoiceLine.recipe; 

            //     let productData = invoiceRecipe.find(f=>f.productId == product?.id)
            //     console.log("productDataproductDataproductDataproductData",productData)
            //     let unitCost = 0;
            //     if(productData )
            //     {
            //         if(productData.unitCost)
            //         {
            //             unitCost = productData.unitCost
            //         }
            //     }

            //     await this.updateBranchProduct(client, creditNoteLine, product, acctualQty, null)
            //     productQty = (productQty == null) ? 1 : productQty;
            //     const totalCost = (creditNoteLine.qty * productQty) *unitCost;

            //     const qty = (creditNoteLine.qty * productQty);
            //     // const currentOnHand = updateBranchProduct.currentOnHand;
            //     // const currentCost = updateBranchProduct.currentCost;
            //     // const branchId = creditNoteLine.branchId;
            //     // const lineId: any = creditNoteLine.id;
            //     // const productId = product.id;



            //     if (creditNoteLine.productId) {
            //         let lineProductmovment = new InvoiceLineRecipe()
            //         lineProductmovment.qty = qty * (-1);
            //         lineProductmovment.cost = totalCost * (-1)
            //         lineProductmovment.unitCost = unitCost 
            //         lineProductmovment.productId = creditNoteLine.productId;
            //         creditNoteLine.recipe = creditNoteLine.recipe ?? [];
            //         creditNoteLine.recipe.push(lineProductmovment)

            //     }


            // }


            // await this.createCreditNoteMovment(client,creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)


        } catch (error: any) {
          
            console.log(error)

            throw new Error(error.message)
        }
    }


    /**
     * Movment for "menuItem" products
     * recipeId => Array of Inventory Product
     * inventoryId => invntory Product  
     */
    private static async menuItemProductMovment(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, product: Product, afterDecimal: number, acctualQty: number, productQty: number | null) {
        try {
            let inventoryProductData;
            let updateBranchProduct;
            let totalCost = 0;
            let qty = 0;
            let currentOnHand;
            let currentCost;
            let branchId = creditNoteLine.branchId;
            let lineId = creditNoteLine.id;
            let productId;
            let productUnitCost = 0
            await this.updateBranchProduct(client, creditNoteLine, product, acctualQty, null)

            if (creditNoteLine.invoiceLine && creditNoteLine.invoiceLine.recipe.length > 0) {
                console.log("recepieeeeeeeeeeeeeee", creditNoteLine.invoiceLine.recipe)
                creditNoteLine.recipe = []

                for (let index = 0; index < creditNoteLine.invoiceLine.recipe.length; index++) {
                    const element = creditNoteLine.invoiceLine.recipe[index];
                    if (creditNoteLine.productId && creditNoteLine.invoiceLine) {
                        let lineProductmovment = new InvoiceLineRecipe()
                        
                        lineProductmovment.qty = (element.qty / creditNoteLine.invoiceLine?.qty ) * creditNoteLine.qty * (-1);
                        lineProductmovment.cost = ((element.qty / creditNoteLine.invoiceLine?.qty ) * creditNoteLine.qty * element.unitCost) * (-1)
                        lineProductmovment.unitCost = element.unitCost
                        lineProductmovment.productId = element.productId;
                        creditNoteLine.recipe.push(lineProductmovment)
                        const product = {
                            id: element.productId
                        }
                        await this.updateBranchProduct(client, creditNoteLine, product, lineProductmovment.qty * (-1), null)
                    }

                }

            }
            // loop on product recipes
            // let invoiceRecipe = creditNoteLine.invoiceLine ? creditNoteLine.invoiceLine.recipe : [];

            // if (invoiceRecipe && invoiceRecipe.length > 0) {

            //     for (let index = 0; index < product.recipes.length; index++) {
            //         const recipeItem: any = product.recipes[index];

            //         if (recipeItem.recipeId) { // when menu Item recipe is a recipeId
            //             //get Recipe items 
            //             const recipeData = await RecipeRepo.getRecipeProducts(client, recipeItem.recipeId, recipeItem.usages)

            //             for (let index = 0; index < recipeData.length; index++) {
            //                 const recipeInventoryItem: any = recipeData[index];


            //                 inventoryProductData = {
            //                     id: recipeInventoryItem.id,
            //                     unitCost: recipeInventoryItem.unitCost
            //                 }
            //                 let productRecipe = invoiceRecipe.find(f => f.productId == recipeInventoryItem.id)
            //                 if (productRecipe) {
            //                     if (productRecipe.unitCost) {
            //                         productUnitCost = productRecipe.unitCost
            //                     }
            //                 }
            //                 productQty = (productQty == null) ? 1 : productQty;
            //                 const totalUsage = recipeInventoryItem.totalUsage * productQty;
            //                 updateBranchProduct = await this.updateBranchProduct(client, creditNoteLine, inventoryProductData, acctualQty, totalUsage);
            //                 totalCost = (creditNoteLine.qty * totalUsage) * productUnitCost;
            //                 qty = (creditNoteLine.qty * totalUsage);
            //                 currentOnHand = updateBranchProduct.currentOnHand;
            //                 currentCost = updateBranchProduct.currentCost;
            //                 branchId = creditNoteLine.branchId;
            //                 lineId = creditNoteLine.id;
            //                 productId = recipeInventoryItem.id
            //                 // if (lineId)
            //                 //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)

            //             }
            //         } else { // when Menu Item is Inventory 
            //             let productRecipe = invoiceRecipe.find(f => f.productId == recipeItem.inventoryId)
            //             if (productRecipe) {
            //                 if (productRecipe.unitCost) {
            //                     productUnitCost = productRecipe.unitCost
            //                 }
            //             }
            //             inventoryProductData = await InvoiceInventoryMovmentRepo.getProduct(client, recipeItem.inventoryId)
            //             updateBranchProduct = await this.updateBranchProduct(client, creditNoteLine, inventoryProductData, acctualQty, recipeItem.usages);
            //             totalCost = (creditNoteLine.qty * recipeItem.usages) * productUnitCost;
            //             currentOnHand = updateBranchProduct.currentOnHand;
            //             currentCost = updateBranchProduct.currentCost;
            //             productId = inventoryProductData.id;
            //             qty = (creditNoteLine.qty * recipeItem.usages);
            //             // if (lineId)
            //             //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)
            //         }


            //         if (creditNoteLine.productId) {
            //             let lineProductmovment = new InvoiceLineRecipe()
            //             lineProductmovment.qty = qty * (-1);
            //             lineProductmovment.cost = totalCost * (-1)
            //             lineProductmovment.productId = productId;
            //             lineProductmovment.unitCost = productUnitCost;
            //             creditNoteLine.recipe = creditNoteLine.recipe ?? [];
            //             creditNoteLine.recipe.push(lineProductmovment)
            //         }

            //     }


            // }
        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }
    // Movment for Batch Product 
    private static async batchProductMovment(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, product: Product, afterDecimal: number, acctualQty: number) {
        try {
            const inventoryMovment = new InventoryMovment();
            const inventoryMovmentLine = new InventoryMovmentLine();

            const branchProduct = await InvoiceInventoryMovmentRepo.getBranchProduct(client, product.id, creditNoteLine.branchId);


            const qty = creditNoteLine.qty;
            let productUnitcost = 0
            let invoiceRecipe = creditNoteLine.invoiceLine ? creditNoteLine.invoiceLine.recipe : [];
            if (creditNoteLine.invoiceLine && creditNoteLine.invoiceLine.recipe.length > 0) {
                for (let index = 0; index < creditNoteLine.invoiceLine.recipe.length; index++) {
                    const element = creditNoteLine.invoiceLine.recipe[index];
                    let lineProductmovment = new InvoiceLineRecipe()
                    lineProductmovment.qty = (element.qty / creditNoteLine.invoiceLine?.qty) * creditNoteLine.qty * (-1);
                    lineProductmovment.cost = ((element.qty / creditNoteLine.invoiceLine?.qty) * creditNoteLine.qty * element.unitCost) * (-1)
                    lineProductmovment.unitCost = element.unitCost
                    lineProductmovment.productId = element.productId;

                    creditNoteLine.recipe.push(lineProductmovment)
                    const updateBatch = await this.updateBatch(client, creditNoteLine, branchProduct, lineProductmovment.qty * (-1));
                }
             
            }
            // if (invoiceRecipe && invoiceRecipe.length > 0) {
            //     let productRecipe = invoiceRecipe.find(f => f.productId == creditNoteLine.productId)
            //     if (productRecipe) {
            //         if (productRecipe.unitCost) {
            //             productUnitcost = productRecipe.unitCost
            //         }
            //     }

            //     const totalCost = creditNoteLine.qty * productUnitcost;
            //     // const currentOnHand = updateBatch.currentOnHand;
            //     // const currentCost = updateBatch.currentCost;
            //     // const branchId = creditNoteLine.branchId;
            //     // const lineId: any = creditNoteLine.id;
            //     // const productId = product.id;
            //     if (creditNoteLine.productId) {
            //         let lineProductmovment = new InvoiceLineRecipe()
            //         lineProductmovment.qty = qty * (-1);
            //         lineProductmovment.cost = totalCost * (-1)
            //         lineProductmovment.productId = creditNoteLine.productId;
            //         lineProductmovment.unitCost = productUnitcost;
            //         creditNoteLine.recipe = creditNoteLine.recipe ?? [];
            //         creditNoteLine.recipe.push(lineProductmovment)
            //     }
            // }

            // await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)


        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }
    //Movment  for serial 
    private static async serialProductMovment(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, product: Product, afterDecimal: number) {
        try {


            const branchProduct = await InvoiceInventoryMovmentRepo.getBranchProduct(client, product.id, creditNoteLine.branchId);
            const updateSerial = await this.updateSerialProduct(client, creditNoteLine, branchProduct);
            const serialUnitCost = await SerialProductRepo.getSerialUnitCost(client, creditNoteLine.serial, creditNoteLine.branchId, product.id)


            const qty = creditNoteLine.qty;
            let productUnitcost = 0
            let invoiceRecipe = creditNoteLine.invoiceLine ? creditNoteLine.invoiceLine.recipe : [];
            if (creditNoteLine.invoiceLine && creditNoteLine.invoiceLine.recipe.length > 0) {

                creditNoteLine.invoiceLine.recipe.forEach(element => {
                    if (creditNoteLine.productId && creditNoteLine.invoiceLine) {
                        let lineProductmovment = new InvoiceLineRecipe()
                        lineProductmovment.qty = (element.qty / creditNoteLine.invoiceLine?.qty) * creditNoteLine.qty * (-1);
                        lineProductmovment.cost = ((element.qty / creditNoteLine.invoiceLine?.qty) * creditNoteLine.qty * element.unitCost) * (-1)
                        lineProductmovment.unitCost = element.unitCost
                        lineProductmovment.productId = element.productId;
                        creditNoteLine.recipe.push(lineProductmovment)
                    }

                });
            }
            // if (invoiceRecipe && invoiceRecipe.length > 0) {
            //     let productRecipe = invoiceRecipe.find(f => f.productId == creditNoteLine.productId)
            //     if (productRecipe) {
            //         if (productRecipe.unitCost) {
            //             productUnitcost = productRecipe.unitCost
            //         }
            //     }

            //     const totalCost = creditNoteLine.qty * productUnitcost;
            //     // const currentOnHand = serialUnitCost.unitCost * updateSerial.currentOnHand;
            //     // const currentCost = updateSerial.currentOnHand;
            //     // const branchId = creditNoteLine.branchId;
            //     // const lineId: any = creditNoteLine.id;
            //     // const productId = product.id;

            //     if (creditNoteLine.productId) {
            //         let lineProductmovment = new InvoiceLineRecipe()
            //         lineProductmovment.qty = qty * (-1);
            //         lineProductmovment.cost = totalCost * (-1)
            //         lineProductmovment.productId = creditNoteLine.productId;
            //         creditNoteLine.recipe = creditNoteLine.recipe ?? [];
            //         creditNoteLine.recipe.push(lineProductmovment)
            //     }
            // }

            // await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)


        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    //Update On Hand of batch  Products 
    private static async updateBatch(client: PoolClient, creditNoteLine: CreditNoteLine, branchProduct: BranchProducts, acctualQty: number) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "onHand" ,"unitCost" FROM  "ProductBatches" WHERE "branchProductId"= $1 AND batch=$2`,
                values: [branchProduct.id, creditNoteLine.batch]
            }


            const batchData = await client.query(query.text, query.values);

            const batch = new Batches();
            batch.ParseJson(batchData.rows[0])
            const currentCost = batch.unitCost * batch.onHand;
            const currentOnHand = batch.onHand;

            const updatedOnHand: any = currentOnHand + acctualQty;
            if (creditNoteLine.productId) {
                // await BatchProductRepo.setBatchOnHand(client, creditNoteLine.batch, creditNoteLine.productId, creditNoteLine.branchId, updatedOnHand)
            }


            return {
                unitCost: batch.unitCost,
                currentCost: currentCost,
                currentOnHand: currentOnHand
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    //Update Status  of serial  Products  
    private static async updateSerialProduct(client: PoolClient, creditNoteLine: CreditNoteLine, branchProduct: BranchProducts) {
        try {

            const status = "Available";
            const query: { text: string, values: any } = {
                text: `SELECT serial FROM  "ProductSerials" WHERE "branchProductId"= $1 AND status=$2 `,
                values: [branchProduct.id, status]
            }
            const serialsData = await client.query(query.text, query.values);
            const currentOnHand = serialsData.rowCount;
            const updatedStatus: any = creditNoteLine.isDeleted ? "Sold" : "Available";

            console.log(creditNoteLine.serial, creditNoteLine.isDeleted)
            if (creditNoteLine.productId) {
                await SerialProductRepo.setSerialStatus(client, creditNoteLine.branchId, creditNoteLine.productId, updatedStatus, creditNoteLine.serial);
            }


            if (creditNoteLine.isDeleted) {
                await this.deleteCreditNoteLine(client, creditNoteLine.id)
            }


            return {
                currentOnHand: currentOnHand
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    //Update On Hand of Inventory Products 
    private static async updateBranchProduct(client: PoolClient, creditNoteLine: CreditNoteLine, product: any, acctualQty: number, usages: number | null) {
        try {


            const branchProduct = await InvoiceInventoryMovmentRepo.getBranchProduct(client, product.id, creditNoteLine.branchId);
            const currentOnHand = branchProduct.onHand;
            const currentCost = branchProduct.onHand * product.unitCost
            let updatedOnHand;
            if (usages == null) {
                updatedOnHand = currentOnHand + acctualQty;
            } else {
                updatedOnHand = currentOnHand + (acctualQty * usages);
            }

            //Update Product On Hand
            // await BranchProductsRepo.setNewOnHand(client, creditNoteLine.branchId, product.id, updatedOnHand)
            return {
                currentCost: currentCost,
                currentOnHand: currentOnHand
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async calculateOptionMovment(client: PoolClient, creditNoteLineOption: CreditNoteLineOption, creditNoteLine: CreditNoteLine, acctualQty: number) {
        try {
            let inventoryProductData;
            let updateBranchProduct;
            let totalCost = 0;
            let qty = 0;
            let currentOnHand;
            let currentCost;
            let branchId = creditNoteLine.branchId;
            let lineId = creditNoteLine.id;
            let productId;
            let productUnitCost = 0;
            let invoiceOptione = creditNoteLineOption.invoiceOption;
                        let usages = creditNoteLine.parentUsages && creditNoteLine.parentUsages != 0 ?creditNoteLine.parentUsages : 1

            if (creditNoteLineOption.invoiceOption && creditNoteLineOption.invoiceOption.recipe&& creditNoteLineOption.invoiceOption.recipe.length > 0) {
                for (let index = 0; index < creditNoteLineOption.invoiceOption.recipe.length; index++) {
                    const element = creditNoteLineOption.invoiceOption.recipe[index];
                    if (creditNoteLine.productId && creditNoteLine.invoiceLine) {
                        let lineProductmovment = new InvoiceLineRecipe()
                        lineProductmovment.qty = (element.qty / creditNoteLine.invoiceLine?.qty *usages) * creditNoteLine.qty * (-1);
                        lineProductmovment.cost = ((element.qty / creditNoteLine.invoiceLine?.qty *usages) * creditNoteLine.qty * element.unitCost) * (-1)
                        lineProductmovment.unitCost = element.unitCost
                        lineProductmovment.productId = element.productId;
                        creditNoteLineOption.recipe.push(lineProductmovment)
                        const product = {
                            id: element.productId
                        }
                        await this.updateBranchProduct(client, creditNoteLine, product, lineProductmovment.qty * (-1), null)
                    }
                }

            }

            // loop on product recipes
            // if (creditNoteLineOption.optionId != null && invoiceOptione && invoiceOptione.recipe.length > 0) {
            //     let optionRecipes = await OptionRepo.getOptionRecipe(client, creditNoteLineOption.optionId);
            //     if (optionRecipes && optionRecipes.length > 0) {

            //         for (let index = 0; index < optionRecipes.length; index++) {
            //             const recipeItem: any = optionRecipes[index];

            //             if (recipeItem.recipeId) { // when menu Item recipe is a recipeId
            //                 //get Recipe items 
            //                 const recipeData = await RecipeRepo.getRecipeProducts(client, recipeItem.recipeId, recipeItem.usages)

            //                 for (let index = 0; index < recipeData.length; index++) {
            //                     const recipeInventoryItem: any = recipeData[index];

            //                     inventoryProductData = {
            //                         id: recipeInventoryItem.id,
            //                         unitCost: recipeInventoryItem.unitCost
            //                     }
            //                     let productRecipe = invoiceOptione.recipe.find((f: any) => f.productId == recipeInventoryItem.id)

            //                     const totalUsage = recipeInventoryItem.totalUsage;
            //                     updateBranchProduct = await this.updateBranchProduct(client, creditNoteLine, inventoryProductData, acctualQty, totalUsage);
            //                     totalCost = (creditNoteLine.qty * totalUsage) * productRecipe.unitCost;
            //                     qty = (creditNoteLine.qty * totalUsage);
            //                     currentOnHand = updateBranchProduct.currentOnHand;
            //                     currentCost = updateBranchProduct.currentCost;
            //                     branchId = creditNoteLine.branchId;
            //                     lineId = creditNoteLine.id;
            //                     productUnitCost = productRecipe.unitCost;
            //                     productId = recipeInventoryItem.id
            //                     // if (lineId)
            //                     //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)

            //                 }
            //             } else { // when Menu Item is Inventory 
            //                 let productRecipe = invoiceOptione.recipe.find((f: any) => f.productId == recipeItem.inventoryId)

            //                 inventoryProductData = await InvoiceInventoryMovmentRepo.getProduct(client, recipeItem.inventoryId)
            //                 updateBranchProduct = await this.updateBranchProduct(client, creditNoteLine, inventoryProductData, acctualQty, recipeItem.usages);
            //                 totalCost = (creditNoteLine.qty * recipeItem.usages) * productRecipe.unitCost;

            //                 currentOnHand = updateBranchProduct.currentOnHand;
            //                 currentCost = updateBranchProduct.currentCost;
            //                 productId = inventoryProductData.id;
            //                 productUnitCost = productRecipe.unitCost;
            //                 qty = (creditNoteLine.qty * recipeItem.usages);

            //                 // if (lineId)
            //                 //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)
            //             }
            //             if (creditNoteLine.productId) {
            //                 let lineProductmovment = new InvoiceLineRecipe()
            //                 lineProductmovment.qty = qty * (-1);
            //                 lineProductmovment.cost = totalCost * (-1)
            //                 lineProductmovment.productId = productId;
            //                 lineProductmovment.unitCost = productUnitCost;
            //                 creditNoteLine.recipe = creditNoteLine.recipe ?? [];
            //                 creditNoteLineOption.recipe.push(lineProductmovment)
            //             }

            //         }


            //     }
            // }

        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }


    public static async deleteCreditNoteLine(client: PoolClient, lineId: string) {
        try {
            const query = {
                text: `delete from "CreditNoteLines" where id =$1`,
                values: [lineId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async returnLineOptionsInventory(client: PoolClient, creditNoteLineOption: CreditNoteLineOption[], creditNoteLine: CreditNoteLine) {
        try {
            console.log("recipeeeeeeeeeeeeeeeeeeeeeee op", creditNoteLineOption)
            for (let index = 0; index < creditNoteLineOption.length; index++) {
                const option = creditNoteLineOption[index];
                console.log("recipeeeeeeeeeeeeeeeeeeeeeee op", option.recipe)
                if (option.recipe && option.recipe.length > 0) {
                    for (let index = 0; index < option.recipe.length; index++) {
                        const element = option.recipe[index];
                        if (element.productId) {

                            const product = {
                                id: element.productId
                            }
                            await this.updateBranchProduct(client, creditNoteLine, product, element.qty , null)
                        }
                    }

                }
            }


        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }
}