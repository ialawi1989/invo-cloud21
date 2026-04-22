import { DB } from "@src/dbconnection/dbconnection";

import { BranchProducts } from "@src/models/product/BranchProducts";
import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { PoolClient } from "pg";
import { InvoiceInventoryMovmentRepo } from "../../accounts/InvoiceInventoryMovment.repo";
import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";
import { ManualAdjusmentRepo } from "../../accounts/manualAdjusment.Repo";



import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { InventoryMovment } from "@src/models/account/InventoryMovment";
import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { Helper } from "@src/utilts/helper";
export class KitProductRepo {
  public static async addKit(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {

      const companyId = company.id;

      const validate = await ProductValidation.kitValidation(data);

      const afterDecimal = company.afterDecimal
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }




      const productIds: any[string] = [];

      const product: Product = new Product();
      product.ParseJson(data);
      let totalUnitCost = 0;
      product.companyId = companyId;
      for (let index = 0; index < product.kitBuilder.length; index++) {
        const element = product.kitBuilder[index];
        productIds.push(element.productId)
        const unitCost = (await ProductRepo.getProductUnitCost(client, element.productId)).unitCost;
        totalUnitCost += (element.qty * unitCost)
      }

      product.unitCost = Helper.roundNum(totalUnitCost, afterDecimal);

      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);

      /* ***************** check Exist of barcode, sku, name ****************** */
      if (product.barcode != "") {
        const isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, null, product.barcode, product.companyId);
        if (isBarcodeExists) {
          throw new ValidationException("Barcode Already used");
        }
      }

      if (product.sku) {
        const isSKUExists = await ProductRepo.checkProductSKU(product.sku, product.companyId, product.id);
        if (isSKUExists) {
          throw new ValidationException("sku Already used");
        }
      }

      const isNameExists = await ProductRepo.checkIfProductNameExists(client, null, product.name, product.companyId);
      if (isNameExists) {
        throw new ValidationException("Product Name Already used");
      }


      const isProductIdExist = await ProductRepo.checkIfProductIdExist(client, productIds, companyId);
      if (!isProductIdExist) {
        throw new ValidationException("Invalid Product")
      }

      const types: any[string] = ["inventory", "service", "kit"];
      const isProductTypeValide = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
      if (!isProductTypeValide) {
        throw new ValidationException("Invalid Product Type")
      }
      product.updatedDate = new Date();

      if (product.categoryId) {
        const oldProductCategoryId = await client.query(`SELECT "categoryId" FROM "Products" WHERE id = $1 AND "companyId" = $2`, [product.id, companyId])
        if (oldProductCategoryId.rowCount && oldProductCategoryId.rowCount > 0) {
          const oldCategoryId = oldProductCategoryId.rows[0].categoryId
          if (oldCategoryId != product.categoryId) {
            product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
          }
        }
      }

      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
                       (name,
                        "barcode",
                        "defaultPrice",
                        description,
                       translation,
                        "categoryId",
                         tags,
                          type,
                           warning,
                       "kitBuilder",
                        "companyId",
                        "unitCost",
                        "productMedia",
                        "commissionPercentage",
                        "commissionAmount",
                        color,
                        "taxId",
                        "UOM",
                        "isDiscountable",
                        "mediaId",
                        "updatedDate",
                        "sku",
                        "alternativeProducts",
                        "maxItemPerTicket",
                        "kitchenName",
                        "reorderPoint",
                        "reorderLevel",
                        "productDeduction",
                        "logs",
                        "brandid",
                        "comparePriceAt",
                        "customFields",
                        "productAttributes",
                        "isSaleItem",
                        "isPurchaseItem",
                        "orderByWeight",
                        "threeDModelId",
                      "categoryIndex",
                      "tabBuilder")
                       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39) RETURNING id`,
        values: [
          product.name,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.translation,
          product.categoryId,
          product.tags,
          product.type,
          product.warning,
          JSON.stringify(product.kitBuilder),
          product.companyId,
          product.unitCost,
          JSON.stringify(product.productMedia),
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.UOM,
          product.isDiscountable,
          product.mediaId,
          product.updatedDate,
          product.sku,
          JSON.stringify(product.alternativeProducts),
          product.maxItemPerTicket,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          product.comparePriceAt,
          JSON.stringify(product.customFields),
          JSON.stringify(product.productAttributes),
          product.isSaleItem,
          product.isPurchaseItem,
          product.orderByWeight,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder)
        ]
      };
      const insert = await client.query(query.text, query.values);
      const resdata = {
        id: (<any>insert.rows[0]).id
      }

      //add To Branch

      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = resdata.id;
        let tempPrice = element.price == null ? product.defaultPrice : element.price

        const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }

      return new ResponseData(true, "", resdata)

    } catch (error: any) {



      throw new Error(error.message)
    }
  }

  public static async editKit(client: PoolClient, data: any, company: Company, employeeId: string) {


    try {
      const companyId = company.id;
      const currencySymbol = company.currencySymbol


      const validate = await ProductValidation.kitValidation(data);
      if (!validate.valid) {

        throw new Error(validate.error)
      }


      const afterDecimal = company.afterDecimal;
      const product = new Product();
      product.ParseJson(data)
      const productIds: any[string] = [];
      let totalUnitCost = 0;
      product.companyId = companyId;
      for (let index = 0; index < product.kitBuilder.length; index++) {
        const element = product.kitBuilder[index];
        productIds.push(element.productId)
        const unitCost = (await ProductRepo.getProductUnitCost(client, element.productId)).unitCost;
        totalUnitCost += (element.qty * unitCost)

      }
      let checkIfCurrentProductIdExist = productIds.filter((f: any) => f == product.id)

      if (checkIfCurrentProductIdExist && checkIfCurrentProductIdExist.length > 0) {
        throw new ValidationException("Invalid Selected Product")
      }
      const types: any[string] = ["inventory", "service", "kit"];
      const isProductTypeValide = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
      if (!isProductTypeValide) {
        throw new ValidationException("Invalid Product Type")
      }
      product.unitCost = Helper.roundNum(totalUnitCost, afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);

      /* ***************** check Exist of barcode, sku, name ****************** */
      if (product.barcode != "") {
        const isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, product.id, product.barcode, product.companyId);
        if (isBarcodeExists) {
          throw new ValidationException("Barcode Already used");
        }
      }

      if (product.sku) {
        const isSKUExists = await ProductRepo.checkProductSKU(product.sku, product.companyId, product.id);
        if (isSKUExists) {
          throw new ValidationException("sku Already used");
        }
      }
      const isNameExists = await ProductRepo.checkIfProductNameExists(client, product.id, product.name, product.companyId);
      if (isNameExists) {
        throw new ValidationException("Product Name Already used");
      }
      product.updatedDate = new Date();

      if (product.categoryId) {
        product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
      }

      const query: { text: string, values: any } = {
        text: `UPDATE "Products" SET name = ($1), barcode=($2),"defaultPrice" = ($3),description = ($4),
                                              tags = ($5),warning = ($6),"serviceTime" = ($7),"categoryId" = ($8),
                                              "kitBuilder" = ($9), "productMedia"=($10),
                                              "updatedDate"=$11
                                              ,"commissionPercentage"=$12,"commissionAmount"=$13,color=$14,
                                              "taxId"=$15,"UOM"=$16,
                                              "unitCost" = $17,
                                              "isDiscountable"=$18,
                                              "mediaId"=$19,
                                              translation=$20,
                                              "sku"=$21,
                                              "alternativeProducts"=$22,
                                              "maxItemPerTicket"=$23,
                                              "kitchenName"=$24,
                                              "reorderPoint"=$25,
                                              "reorderLevel"=$26,
                                              "productDeduction"=$27,
                                              "logs"=$28,
                                              "brandid"=$29,
                                              "comparePriceAt"=$30,
                                              "customFields"=$31,
                                              "productAttributes"=$32,
                                              "isSaleItem" = $33,
                                              "isPurchaseItem" =$34,
                                              "orderByWeight" = $35,
                                              "threeDModelId" = $36,
                                              "categoryIndex"= $37,
                                              "tabBuilder" = $38
                                               WHERE id = $39 AND "companyId"= $40 RETURNING id`,
        values: [
          product.name,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.tags,
          product.warning,
          product.serviceTime,
          product.categoryId,
          JSON.stringify(product.kitBuilder),
          JSON.stringify(product.productMedia),
          product.updatedDate,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.UOM,
          product.unitCost,
          product.isDiscountable,
          product.mediaId,
          product.translation,
          product.sku,
          JSON.stringify(product.alternativeProducts),
          product.maxItemPerTicket,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          product.comparePriceAt,
          JSON.stringify(product.customFields),
          JSON.stringify(product.productAttributes),
          product.isSaleItem,
          product.isPurchaseItem,
          product.orderByWeight,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder),
          product.id,
          product.companyId],
      };
      const update = await client.query(query.text, query.values);




      for (let index = 0; index < product.branchProduct.length; index++) {
        const branchProduct = product.branchProduct[index];
        branchProduct.productId = product.id
        let tempPrice = branchProduct.price == null ? product.defaultPrice : branchProduct.price

        if (branchProduct.id == null || branchProduct.id == "") {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
        } else {
          const insertToBranch = await BranchProductsRepo.editBranchProduct(client, branchProduct, companyId, afterDecimal, tempPrice, employeeId, currencySymbol);
        }

      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }

      return new ResponseData(true, "Updated Successfully", null);
    } catch (error: any) {


      throw new Error(error.message)
    }
  }

  public static async getKitProducts(client: PoolClient, kitBuilder: any) {
    try {
      const productIds: any[string] = [];
      for (let index = 0; index < kitBuilder.length; index++) {
        const kit = kitBuilder[index];
        productIds.push(kit.productId)
      }

      const products = await InvoiceInventoryMovmentRepo.getProduct(client, productIds)
      return products;
    } catch (error: any) {

      throw new Error(error.message)
    }
  }

  public static async getProductKitBuilder(client: PoolClient, productId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "kitBuilder","defaultPrice" FROM "Products" WHERE id = $1`,
        values: [productId]
      }
      const kitData = await client.query(query.text, query.values);
      if (kitData.rowCount == 0) {
        throw new ValidationException("Product not Found")
      }
      return kitData.rows[0]
    } catch (error: any) {

      throw new Error(error.message)
    }
  }


  public static async getMaximumAllowedQty(productId: string, branchId: string) {
    const client = await DB.excu.client();
    try {


      client.query("BEGIN")

      const query = {
        text: `
                with "kitProducts" as (
                SELECT Json_array_elements("kitBuilder")->>'productId' as "id" ,         JSON_ARRAY_ELEMENTS("kitBuilder")->>'qty' as "qty" FROM "Products"
                WHERE id = $1
                ),"kit" as (
                  select DISTINCT on ("kitProducts".id) "kitProducts".id, "kitProducts"."qty",COALESCE("InventoryMovmentRecords"."cost",0) as "unitCost"  from "kitProducts"
                  left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" =  "kitProducts"."id"::uuid
                  WHERE "InventoryMovmentRecords"."branchId" = $2
                  order by "kitProducts".id, "createdAt" desc
                  
                  )
				
                select   "Products".id as "productId"  , "kit"."qty","onHand" , "kit"."unitCost" ,  "Products".name AS "productName",  "Products"."UOM" ,  "Products"."parentId"  from "kit"
                inner join "BranchProducts" on "BranchProducts"."productId" =  kit.id ::uuid
                inner join "Products" on "Products".id =  kit.id ::uuid
                where "BranchProducts"."branchId" = $2`,
        values: [productId, branchId]
      }
      const productKitBuilder = await client.query(query.text, query.values)

      const kitBuilder = productKitBuilder.rows
      const kitQtys: any[number] = [];
      for (let index = 0; index < kitBuilder.length; index++) {
        const element = kitBuilder[index];
        const onHand = element.onHand
        if ((element.parentId == null) && (onHand == null || onHand == 0)) {
          return new ResponseData(false, element.productName + " is not Available in the Selected Branch", [])
        }

        let totalQty = Math.trunc((element.onHand) / element.qty);

        console.log(element)
        if (totalQty <= 0 && element.parentId == null) {
          return new ResponseData(false, "Available Qty for (" + element.productName + ") is not Enough to Build this Kit", [])
        } else if ((element.onHand == 0 || element.onHand < element.qty) && element.parentId) {
          let childQty = await BranchProductsRepo.setOnHandNew(client, element.id, branchId, element.qty, "", 3, null, null, false)
          console.log("childQtychildQty", childQty)
          if (childQty) {
            if (childQty.qty == 0) {
              return new ResponseData(false, "Available Qty for (" + element.productName + ") is not Enough to Build this Kit", [])
            }
            kitBuilder[index].onHand = childQty.qty
            kitBuilder[index].unitCost = childQty.cost
            totalQty = Math.trunc((childQty.qty) / element.qty);
            console.log(totalQty, element.qty, (childQty.qty) / element.qty, childQty.qty)
          }

        }
        kitQtys.push(totalQty)
      }


      let min = kitQtys[0];
      for (let index = 0; index < kitQtys.length; index++) {
        const element = kitQtys[index];
        if (element < min) {
          min = element;
        }
      }

      let kitBuilderUsages = kitBuilder


      client.query("COMMIT")
      return new ResponseData(true, "", { maximumQty: min, kitBuilderUsages: kitBuilderUsages })


    } catch (error: any) {
      console.log(error)
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async buildKit(data: any, company: Company, employeeId: string) {
    const companyId = company.id;
    const client = await DB.excu.client();

    // --- helpers: keep everything local to avoid changing external code ---
    const safeNum = (v: any, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const isUUID = (v: any) => typeof v === "string" && v.length >= 32; // soft check, no behavior change

    try {
      await client.query("BEGIN");

      // --- inputs (NaN/undefined safe) ---
      const afterDecimal = safeNum(company?.afterDecimal, 2);
      const onHand = safeNum(data?.onHand, 0);
      const productId = data?.productId;
      const branchId = data?.branchId;
      const branchProductData = data?.branchProduct;

      // ensure required ids (do not throw; keep function behavior consistent)
      if (!isUUID(productId) || !isUUID(branchId)) {
        // rollback below in catch will handle; return consistent ResponseData at end
        throw new Error("Invalid productId or branchId");
      }

      // --- fetch kit structure and branch-product state ---
      const kitData = await this.getProductKitBuilder(client, productId);
      const kitBuilder = Array.isArray(kitData?.kitBuilder) ? kitData.kitBuilder : [];
      const isBranchProductExist = await BranchProductsRepo.checkIfProductAlreadyExistInBarnch(
        client,
        productId,
        branchId
      );

      // --- prepare movement header (ensure lines array exists) ---
      let inventoryMovment = new InventoryMovment();
      inventoryMovment.branchId = branchId;
      inventoryMovment.employeeId = employeeId;
      inventoryMovment.type = "Kit Build";
      inventoryMovment.lines = Array.isArray(inventoryMovment.lines) ? inventoryMovment.lines : [];

      let movments: any[] = [];

      // --- if product doesn't exist in branch, add it (keep same logic, NaN-safe on price) ---
      if (!isBranchProductExist) {
        const branchProduct = new BranchProducts();
        branchProduct.ParseJson(branchProductData);
        branchProduct.productId = productId;
        branchProduct.branchId = branchId;
        branchProduct.onHand = 0;

        const defaultPrice = safeNum(kitData?.defaultPrice, 0);
        const givenPrice = safeNum(branchProduct?.price, NaN);
        const price = Number.isFinite(givenPrice) ? givenPrice : defaultPrice;

        await BranchProductsRepo.addProductToBranch(
          client,
          branchProduct,
          "kit",
          companyId,
          afterDecimal,
          price,
          employeeId
        );
      }

      // --- consume sub-products (children) ---
      const kit = await ProductRepo.getProductOnHandAndUnitCost(client, productId, branchId);
      let totalCost = 0;

      for (let index = 0; index < kitBuilder.length; index++) {
        const subProducts = kitBuilder[index];

        // fetch product data safely
        const subId = subProducts?.productId;
        if (!isUUID(subId)) continue; // skip invalid rows without altering main behavior

        const productData = await ProductRepo.getProductOnHandAndUnitCost(client, subId, branchId);

        const subQty = safeNum(subProducts?.qty, 0);
        const parentUnitCost = safeNum(productData?.unitCost, 0);
        const parentOnHand = safeNum(productData?.onHand, 0);
        const parentId = productData?.parentId ?? null;

        // qty to consume from child = subQty * build onHand
        const qty = safeNum(Helper.multiply(subQty, onHand, afterDecimal), 0);

        // accumulate kit total cost using child unit cost
        totalCost = safeNum(totalCost + subQty * parentUnitCost, 0);

        // if child of a parent-child product, update onHand via repo (keep same guard)
        if (parentId) {
          const updateProductOnHand = await BranchProductsRepo.setOnHandNew(
            client,
            subId,
            branchId,
            qty,
            employeeId,
            afterDecimal,
            null,
            null
          );
          if (updateProductOnHand?.id) {
            movments.push(updateProductOnHand.id);
          }
        }

        // create movement line for the sub-product (issue out)
        const currentOnHand = safeNum(parentOnHand, 0);
        const currentCost = safeNum(currentOnHand * parentUnitCost, 0);

        const inventoryLine = new InventoryMovmentLine();
        inventoryLine.cost = safeNum(parentUnitCost * -1, 0); // negative cost per unit for issue
        inventoryLine.qty = safeNum(qty * -1, 0);            // negative qty for issue
        inventoryLine.currentCost = currentCost;
        inventoryLine.currentOnHand = currentOnHand;
        inventoryLine.productId = subId;

        // avoid pushing NaN/undefined lines
        if (Number.isFinite(inventoryLine.cost) && Number.isFinite(inventoryLine.qty)) {
          inventoryMovment.lines.push(inventoryLine);
        }
      }

      // --- build the kit (parent) ---
      const kitOnHand = safeNum(kit?.onHand, 0);
      const kitUnitCost = safeNum(totalCost, 0); // keep original logic: totalCost as unitCost

      const currentCost = 0;       // original behavior kept
      const currentOnHand = 0;     // original behavior kept
      const qty = safeNum(onHand, 0);

      const kitNewOnHand = Helper.add(kitOnHand, qty, afterDecimal);
      const cost = safeNum(qty * kitUnitCost, 0); // computed but not used (kept for parity)

      // movement line for the built kit (receipt)
      const kitLine = new InventoryMovmentLine();
      kitLine.cost = kitUnitCost;
      kitLine.qty = qty;
      kitLine.currentCost = currentCost;
      kitLine.currentOnHand = currentOnHand;
      kitLine.productId = productId;

      if (Number.isFinite(kitLine.cost) && Number.isFinite(kitLine.qty)) {
        inventoryMovment.lines.push(kitLine);
      }

      // persist movement + serial/batches handling
      const movmentId = await ManualAdjusmentRepo.serialAndBatchesKitManualAdjusmnets(
        client,
        inventoryMovment,
        afterDecimal
      );

      await client.query("COMMIT");

      // trigger queues as in original (unchanged)
      const queueInstance = TriggerQueue.getInstance();
      queueInstance.createJob({
        type: "InventoryMovment",
        movmentIds: [movmentId],
        companyId: company.id,
        branchIds: [branchId],
      });

      queueInstance.createJob({
        journalType: "Movment",
        type: "kitBuildProductCost",
        ids: [movmentId],
        movmentIds: movments,
      });

      // return same shape (onHand includes new kit qty)
      return new ResponseData(true, "", { onHand: kitNewOnHand });
    } catch (error: any) {
      await client.query("ROLLBACK");

      return new ResponseData(false, error, []);
    } finally {
      client.release();
    }
  }

  public static async breakKit(data: any, employeeId: string, company: Company) {

    const client = await DB.excu.client()
    try {

      await client.query("BEGIN")
      const onHand = data.onHand;//break qty 

      const productId = data.productId;
      const branchId = data.branchId;
      const afterDecimal = company.afterDecimal;
      const kitBuilderData = await this.getProductKitBuilder(client, productId);
      const kit = await ProductRepo.getProductOnHandAndUnitCost(client, productId, branchId);

      let inventoryMovment = new InventoryMovment();
      inventoryMovment.branchId = branchId
      inventoryMovment.employeeId = employeeId
      inventoryMovment.type = "Kit Break"
      if (onHand > kit.onHand) {
        throw new Error("Break Qty is Greater than Product qty, Available Qty = " + kit.onHand)
      }


      const kitBuilder = kitBuilderData.kitBuilder
      let totalCost = 0;

      for (let index = 0; index < kitBuilder.length; index++) {
        const subProducts = kitBuilder[index];
        const productData = await ProductRepo.getProductOnHandAndUnitCost(client, subProducts.productId, branchId);

        const totalQty = onHand * subProducts.qty;

        const newOnHand = Helper.add(productData?.onHand, totalQty, afterDecimal);
        const product = {
          id: subProducts.productId,
          unitCost: productData?.unitCost,
          onHand: productData?.onHand,
        }
        totalCost += subProducts.qty * productData?.unitCost;
        await ProductRepo.setProductUnitCost(client, totalCost, productId, afterDecimal)
        // await BranchProductsRepo.setNewOnHand(client, branchId, subProducts.productId, newOnHand)
        const currentOnHand = product.onHand;
        const currentCost = product.unitCost * currentOnHand;
        const qty = totalQty;
        const cost = qty * product.unitCost
        let inventoryLine = new InventoryMovmentLine();
        inventoryLine.cost = product.unitCost;
        inventoryLine.qty = qty;
        inventoryLine.currentCost = currentCost;
        inventoryLine.currentOnHand = currentOnHand;
        inventoryLine.productId = subProducts.productId;
        inventoryMovment.lines.push(inventoryLine);
        // await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, product.unitCost, qty, branchId, currentOnHand, currentCost, subProducts.productId,afterDecimal,"Kit Break",null, null)
      }

      // const kitProduct={
      //   id:productId,
      //   unitCost:totalCost,
      //   onHand: onHand,
      // }
      const kitNewOnHand = Helper.sub(kit?.onHand, onHand, afterDecimal);
      // await BranchProductsRepo.setNewOnHand(client, branchId, productId, kitNewOnHand)

      const qty = onHand * (-1);
      const currentOnHand = onHand;
      const currentCost = currentOnHand * totalCost;
      const cost = qty * totalCost * (-1);

      let inventoryLine = new InventoryMovmentLine();
      inventoryLine.cost = totalCost * (-1);
      inventoryLine.qty = qty;
      inventoryLine.currentCost = currentCost;
      inventoryLine.currentOnHand = currentOnHand;
      inventoryLine.productId = productId;
      inventoryMovment.lines.push(inventoryLine);
      let movmentId = await ManualAdjusmentRepo.serialAndBatchesKitManualAdjusmnets(client, inventoryMovment, afterDecimal)

      // await ManualAdjusmentRepo.manualAdjustmentMovment(client,employeeId, totalCost , qty , branchId, currentOnHand, currentCost, productId,afterDecimal,"Kit Break",null, null)
      // await BranchProductsRepo.manualAdjustmentMovment(client,kitProduct,0,branchId)

      let queueInstance = TriggerQueue.getInstance();
      queueInstance.createJob({ type: "InventoryMovment", movmentIds: [movmentId], companyId: company.id, branchIds: [branchId] })

      queueInstance.createJob({ journalType: "Movment", type: "kitBreakProductCost", ids: [movmentId] })

      await client.query("COMMIT")
      return new ResponseData(true, "", { onHand: kitNewOnHand })
    } catch (error: any) {
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally {
      client.release()
    }
  }


  public static async getKitProductsUsages(client: PoolClient, productId: string, branchId: string) {
    try {


      const query = {
        text: `
              with "kitProducts" as (
              select JSON_ARRAY_ELEMENTS("kitBuilder")->>'productId' as "productId",
                JSON_ARRAY_ELEMENTS("kitBuilder")->>'qty' as "qty"
                from "Products"
              inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id
              where "Products".id = $1
              and "BranchProducts"."branchId" = $2
              ), "products" as (
              select "Products".id as "productId",
                    "Products".name as "productName",
                  "Products"."UOM",
                  "kitProducts".qty ,
                    "Products"."unitCost",
                    "BranchProducts"."onHand"
              from "kitProducts"
              inner join "Products" on "Products".id = "kitProducts"."productId"::uuid
                 inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id
        
              where "BranchProducts"."branchId" = $2
              ), "proUnitCost" as (

              select "ProductCosts"."avgCost" , "ProductCosts"."productId" from "products"
              inner join "ProductCosts"	 on  "ProductCosts"."productId" = "products"."productId"::uuid
              where "ProductCosts"."branchId" = $2
              order by "ProductCosts"."createdAt" asc
              limit 1 
              )
              select "products"."productId",
                      "products"."productName",
                  "products".qty::float,
                    "products"."UOM",
                     "products"."onHand",
                  case when "proUnitCost"."productId" is not null then"proUnitCost"."avgCost" else "products"."unitCost" end as "unitCost"
              from "products"
              left join "proUnitCost" on "proUnitCost"."productId" = "products"."productId" `,
        values: [productId, branchId]
      }

      let kitBuilder = await client.query(query.text, query.values);
      return kitBuilder.rows
    } catch (error: any) {
      throw new Error(error)
    }
  }

}