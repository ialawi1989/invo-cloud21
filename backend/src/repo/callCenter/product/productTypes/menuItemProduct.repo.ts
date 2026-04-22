// import { DB } from "@src/dbconnection/dbconnection";
// import { FileStorage } from "@src/utilts/fileStorage";
// import { Product } from "@src/models/product/Product";
// import { ResponseData } from "@src/models/ResponseData";
// import { CompanyRepo } from "@src/repo/admin/company.repo";
// import { ProductValidation } from "@src/validationSchema/product/product.Schema";
// import { BranchProductsRepo } from "../branchProduct.repo";
// import { OptionRepo } from "../option.repo";
// import { ProductRepo } from "../product.repo";
// import { RecipeRepo } from "../recipe.repo";
// import { InventoryProductRepo } from "./inventoryProduct.repo";

// 
// import { PoolClient } from "pg";
// import { Company } from "@src/models/admin/company";
// export class MenuItemProductRepo {

  
//   public static async getRecipeTotalUnitCost(client:PoolClient,inventoryIds:any[],recipeIds:any[]){
//     try {
//       const query={
//         text:`SELECT sum( "Products"."unitCost")as "unitCost"
//         FROM "Recipe", jsonb_array_elements("Recipe".items) with ordinality arr(items, position) 
//         INNER JOIN "Products"
//         ON "Products".id = (arr.items->>'inventoryId')::uuid
//         where "Recipe".id = any($1)
//         or "Products".id= any($2)`,
//         values:[recipeIds,inventoryIds]
//       }

//       const unitCost = await client.query(query.text,query.values)
  
//       return unitCost.rows[0].unitCost
//     } catch (error:any) {
//        throw new Error(error.message)
//     }
//   }
//   public static async addMenuItem(client:PoolClient,data: any, company: Company,employeeId:string) {

//     try {
//       const companyId =company.id;

//       const validate = await ProductValidation.MenuItemValidation(data);
//       if (!validate.valid) {

//         throw new Error(validate.error)
//       }
   
//       const afterDecimal =  company.afterDecimal
//       const product: Product = new Product();
//       product.ParseJson(data);
//       product.companyId = companyId;
//       const totalUnitCost=0;
//       const recipeIds: any[string] = [];
//       const inventoryIds: any[string] = [];
//       if (product.recipes.length > 0) {
//         product.recipes.forEach((element: any) => {
//           if (element.recipeId) {
//             recipeIds.push(element.recipeId);
    
//           } else {
//             inventoryIds.push(element.inventoryId);
//           }

//       });

//       // let unitCost = await this.getRecipeTotalUnitCost(client,inventoryIds,recipeIds)


//       // product.unitCost = +(unitCost).toFixed(afterDecimal);
//       product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
//       const isNameExists = await ProductRepo.checkIfProductNameExists(null, product.name, product.companyId);
//       if (isNameExists) {
//         throw new Error("Product Name Already used");
//       }


    

//         const isRecipeIdExist = await RecipeRepo.checkIfRecipeIdExist(recipeIds, product.companyId);
//         if (!isRecipeIdExist) {
//           throw new Error("Recipe Id dosnt Exist")
//         }

//         const isInventory = await InventoryProductRepo.checkInventoryType(inventoryIds, companyId);
//         if (!isInventory) {
//           throw new Error("Error In Recipe Inventroy Id")
//         }
//       }
//       const optionGroupsIds: any[string] = [];

//       if (product.optionGroups.length > 0) {
//         product.optionGroups.forEach((element: any) => {
//           optionGroupsIds.push(element.optionGroupId);
//         });

//         const isOptionGroupIdExist = await OptionRepo.checkIfOptionGroupsExist(client,optionGroupsIds, companyId);
//         if (!isOptionGroupIdExist) {
//           throw new Error("Option Group not Exist")
//         }
//       }
//       const optionIds: any[string] = [];
//       if (product.quickOptions.length > 0) {

//         product.quickOptions.forEach((element: any) => {
//           optionIds.push(element.id);
//         });

//         const isOptionIdExist = await OptionRepo.checkIfOptioIdExist(client,optionIds, companyId);
//         if (!isOptionIdExist) {
//           throw new Error("Option not Exist")
//         }
//       }

//       product.updatedDate = new Date();

//       const query : { text: string, values: any } = {
//         text: `INSERT INTO "Products"
//                    (name, "barcode", "defaultPrice", description,
//                    translation, "categoryId", tags, type, warning, "serviceTime","optionGroups","quickOptions",recipes,
//                    "companyId","productMedia","commissionPercentage","commissionAmount",color,"taxId","preparationTime","isDiscountable",  nutrition,"mediaId","productAttributes","updatedDate") 
//                    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
//         values: [
//           product.name,
//           product.barcode,
//           product.defaultPrice,
//           product.description,
//           product.translation,
//           product.categoryId,
//           product.tags,
//           product.type,
//           product.warning,
//           product.serviceTime,
//           JSON.stringify(product.optionGroups),
//           JSON.stringify(optionIds),
//           JSON.stringify(product.recipes),
//           product.companyId,
//           JSON.stringify(product.productMedia),
//           product.commissionPercentage,
//           product.commissionAmount,
//           product.color,
//           product.taxId,
//            product.preparationTime,
//            product.isDiscountable,
//           product.nutrition,
//           product.mediaId,
//         JSON.stringify(product.productAttributes),
//       product.updatedDate  
//       ],
//       };
//       const insert = await client.query(query.text, query.values);

//       //assign Option Group

//       const resdata = {
//         id: (<any>insert.rows[0]).id
//       }
//       // if (product.base64Image != "") {
//       //   const storage = new FileStorage();
//       //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
//       //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
//       // }
//       for (let index = 0; index < product.branchProduct.length; index++) {
//         const element = product.branchProduct[index];
//         element.productId = resdata.id;
//         let tempPrice =   element.price == null ? product.defaultPrice : element.price

//         const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId,afterDecimal, tempPrice,employeeId)
//       }


//       return new ResponseData(true, "", resdata)

//     } catch (error: any) {

//       console.log(error)
//       
//        throw new Error(error.message)
//     } 

//   }

//   // public static async editMenuItem(data: any, company: Company,employeeId:string) {
//   //   const client = await DB.excu.client();
//   //   try {
//   //     const companyId = company.id;
//   //     await client.query("BEGIN");
//   //     const validate = await ProductValidation.MenuItemValidation(data);
//   //     if (!validate.valid) {

//   //       throw new Error(validate.error)
//   //     }
   
//   //     const afterDecimal =  company.afterDecimal
//   //     const product = new Product();
//   //     product.ParseJson(data)
//   //     product.companyId = companyId
//   //     product.unitCost = +(product.unitCost).toFixed(afterDecimal);
//   //     product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
//   //     const isNameExists = await ProductRepo.checkIfProductNameExists(product.id, product.name, product.companyId);
//   //     if (isNameExists) {
//   //       throw new Error("Product Name Already used");
//   //     }

//   //     const optionGroupsIds: any[string] = [];

//   //     if (product.optionGroups.length > 0) {
//   //       product.optionGroups.forEach((element: any) => {
//   //         optionGroupsIds.push(element.optionGroupId);
//   //       });

//   //       const isOptionGroupIdExist = await OptionRepo.checkIfOptionGroupsExist(client,optionGroupsIds, companyId);
//   //       if (!isOptionGroupIdExist) {
//   //         throw new Error("Option Group not Exist")
//   //       }
//   //     }


//   //     const optionIds: any[string] = [];
//   //     if (product.quickOptions.length > 0) {
//   //       product.quickOptions.forEach((element: any) => {
//   //         optionIds.push(element.id);
//   //       });

//   //       const isOptionIdExist = await OptionRepo.checkIfOptioIdExist(client,optionIds, companyId,);
//   //       if (!isOptionIdExist) {
//   //         throw new Error("Option not Exist")
//   //       }
//   //     }

//   //     product.updatedDate = new Date();

//   //     const query : { text: string, values: any } = {
//   //       text: `UPDATE "Products" SET name = ($1),barcode=($2), 
//   //                                             "defaultPrice" = ($3),description = ($4),
//   //                                             tags = ($5),warning = ($6),
//   //                                             "serviceTime" = ($7),
//   //                                             "categoryId" = ($8),
//   //                                             "optionGroups" = ($9),
//   //                                             "quickOptions" = ($10),
//   //                                             recipes = ($11) ,
//   //                                             "productMedia"=($12), 
//   //                                             "updatedDate"=$13, 
//   //                                             "commissionPercentage" = $14,
//   //                                             "commissionAmount"=$15,
//   //                                             color =$16,
//   //                                             "taxId"=$17,
//   //                                             "preparationTime"=$18,
//   //                                             "isDiscountable"=$19,
//   //                                             nutrition=$20,
//   //                                             "mediaId"=$21,
//   //                                             "productAttributes"=$22,
//   //                                             translation=$23
//   //                                             WHERE id = $24 AND "companyId"=$25 RETURNING id`,
//   //       values: [
//   //         product.name,
//   //         product.barcode,
//   //         product.defaultPrice,
//   //         product.description,
//   //         product.tags,
//   //         product.warning,
//   //         product.serviceTime,
//   //         product.categoryId,
//   //         JSON.stringify(product.optionGroups),
//   //         JSON.stringify(optionIds),
//   //         JSON.stringify(product.recipes),
//   //         JSON.stringify(product.productMedia),
//   //         product.updatedDate,
//   //         product.commissionPercentage,
//   //         product.commissionAmount,
//   //         product.color,
//   //         product.taxId,
//   //         product.preparationTime,
//   //         product.isDiscountable,
//   //         product.nutrition,
//   //         product.mediaId,
//   //         JSON.stringify(product.productAttributes),
//   //         product.translation,
//   //         product.id,
//   //         product.companyId],
//   //     };
//   //     const update = await client.query(query.text, query.values);

//   //     for (let index = 0; index < product.branchProduct.length; index++) {
//   //       const branchProduct = product.branchProduct[index];
//   //       branchProduct.productId = product.id;
//   //       let tempPrice =   branchProduct.price == null ? product.defaultPrice : branchProduct.price
  
//   //       if (branchProduct.id == null || branchProduct.id =="") {
//   //         const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId,afterDecimal, tempPrice,employeeId)
//   //       } else {
//   //         const editToBranch = await BranchProductsRepo.editBranchProduct(client, branchProduct, product.companyId,afterDecimal, tempPrice,employeeId)
//   //       }

//   //     }
//   //     // if (product.base64Image != "") {
//   //     //   const storage = new FileStorage();
//   //     //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
//   //     //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
//   //     // }
//   //     await client.query("COMMIT");
//   //     return new ResponseData(true, "Updated Successfully", null);
//   //   } catch (error: any) {
//   //     
//   //     await client.query("ROLLBACK");
      
//   //      throw new Error(error.message)
//   //   } finally {
//   //     client.release()
//   //   }
//   // }
// }