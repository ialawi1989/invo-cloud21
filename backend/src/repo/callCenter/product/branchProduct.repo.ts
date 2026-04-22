import { DB } from "@src/dbconnection/dbconnection";

import { BranchProducts } from "@src/models/product/BranchProducts";

import { SocketProductRepo } from "@src/repo/socket/product.socket";

import { BranchProductsValidation } from "@src/validationSchema/product/branchProducts.Schema";

import { PoolClient } from "pg";

// import { InvoiceInventoryMovmentRepo } from "../accounts/InvoiceInventoryMovment.repo";

// import { ManualAdjusmentRepo } from "../accounts/manualAdjusment.Repo";




// import { BatchProductRepo } from "./productTypes/batchProduct.reps";
// import { SerialProductRepo } from "./productTypes/serilizedProduct.repo";

export class BranchProductsRepo {


  public static async checkIfProductAlreadyExistInBarnch(client:PoolClient,productId: string, branchId: string | null) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "BranchProducts" where  "productId" = $1 and "branchId"=$2  `,
      values: [
        productId,
        branchId
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkBranchProductIdExist(id: string, companyId: string) {
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "BranchProducts" where  id = $1 and "companyId" = $2 `,
      values: [
        id,
        companyId,

      ],
    };
    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async pricingValidation(branchProduct: BranchProducts, afterDecimal: number, price: number) {


    if (branchProduct.selectedPricingType == 'buyDownPrice') {
      branchProduct.priceByQty = null;
      branchProduct.buyDownPrice = +(branchProduct.buyDownPrice).toFixed(afterDecimal)
    } else if (branchProduct.selectedPricingType == 'priceByQty') {
      if (branchProduct.priceByQty == null) {
        throw new Error("price By Qty is required");
      }
      branchProduct.buyDownPrice = null;
      branchProduct.buyDownQty = null;
      for (let index = 0; index < branchProduct.priceByQty.length; index++) {
        branchProduct.priceByQty[index].price = +(branchProduct.priceByQty[index].price).toFixed(afterDecimal)
      }
    } else if (branchProduct.selectedPricingType == "priceBoundary") {
      if (branchProduct.priceBoundriesFrom != null) {
        if ( branchProduct.priceBoundriesTo != null && branchProduct.priceBoundriesFrom > branchProduct.priceBoundriesTo) {
          throw new Error("Invalid Price Boundries Price Boundries From must be less than Price Boundries To")
        }
        if (price < branchProduct.priceBoundriesFrom) {
          throw new Error("Invalid Price  must be greater than  or equal " + branchProduct.priceBoundriesFrom)
        }

        if (branchProduct.priceBoundriesTo != null  && price > branchProduct.priceBoundriesTo) {
          throw new Error("Invalid Price  must be less than or equal " + branchProduct.priceBoundriesTo)
        }
        branchProduct.priceBoundriesFrom = +(branchProduct.priceBoundriesFrom).toFixed(afterDecimal)
        branchProduct.priceBoundriesTo =branchProduct.priceBoundriesTo? +(branchProduct.priceBoundriesTo).toFixed(afterDecimal):null
      } else {
        throw new Error("Price Boundaries are Required");
      }
    }

    return branchProduct;
  }

  public static async validateBranchProduct(branchProduct: BranchProducts, productType: string) {

    let validate: any;

    if (productType == 'batch') {
      validate = await BranchProductsValidation.batchesBranchProduct(branchProduct);
    } else if (productType == 'serialized') {
      validate = await BranchProductsValidation.serialBranchProduct(branchProduct);

    } else if (productType == 'inventory') {
      validate = await BranchProductsValidation.inventoryBranchProduct(branchProduct);
    } else {
      validate = await BranchProductsValidation.branchProductValidation(branchProduct);
    }

    if (!validate.valid) {

      throw new Error(validate.error)
    }
  }
  public static async insertBranchProduct(client: PoolClient, branchProduct: BranchProducts) {
    try {
      const query : { text: string, values: any } = {
        text: `INSERT INTO "BranchProducts"
                   ( "productId", "branchId" , available, price,
                   "onHand", "priceBoundriesFrom", "priceBoundriesTo", "buyDownPrice","priceByQty", "buyDownQty", "companyId","selectedPricingType","availableOnline") 
                   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12,$13) RETURNING id`,
        values: [
          branchProduct.productId,
          branchProduct.branchId,
          branchProduct.available,
          branchProduct.price,
          branchProduct.onHand,
          branchProduct.priceBoundriesFrom,
          branchProduct.priceBoundriesTo,
          branchProduct.buyDownPrice,
          JSON.stringify(branchProduct.priceByQty),
          branchProduct.buyDownQty,
          branchProduct.companyId,
          branchProduct.selectedPricingType,
          branchProduct.availableOnline 
        ],
      };

      const insert = await client.query(query.text, query.values);

      return (insert.rows[0]).id
    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  
  public static async setNewOnHand(client: PoolClient, branchId: string | null, productId: string | null, newOnHand: number) {
    try {

      const query : { text: string, values: any } = {
        text: `UPDATE "BranchProducts" 
                SET "onHand"=$1 
                WHERE "branchId"=$2 AND "productId"=$3 `,
        values: [newOnHand, branchId, productId]
      }

      await client.query(query.text, query.values)

      await SocketProductRepo.onHandsync(client,newOnHand, productId, branchId)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getBranchProductAndUnitCost(client: PoolClient, productId: string | null, branchId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT
        "BranchProducts".available,
        "BranchProducts"."branchId",
        "BranchProducts"."buyDownPrice",
        "BranchProducts"."buyDownQty",
        "BranchProducts"."companyId",
        "BranchProducts".id,
        "BranchProducts"."onHand",
        "BranchProducts".price,
        "BranchProducts"."priceBoundriesFrom",
        "BranchProducts"."priceBoundriesTo",
        "BranchProducts"."priceByQty",
        "BranchProducts"."productId",
        "selectedPricingType",
        "Products"."unitCost"
        FROM "BranchProducts"
        INNER JOIN "Products"
        ON "BranchProducts"."productId" ="Products".id
        AND "BranchProducts"."productId"=$1
        AND "BranchProducts"."branchId"=$2`,
        values: [productId, branchId]
      }
      const branchProduct = await client.query(query.text, query.values);
      return branchProduct.rows[0]
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getBranchProductId(client: PoolClient, productId: string | null, branchId: string) {
    try {

      const query : { text: string, values: any } = {
        text: `SELECT id 
        from "BranchProducts"
        where "BranchProducts"."productId"=$1
        AND "BranchProducts"."branchId"=$2`,
        values: [productId, branchId]
      }
      const branchProduct = await client.query(query.text, query.values);
      return branchProduct.rows[0].id
    } catch (error: any) {
    
      throw new Error(error)
    }
  }

}