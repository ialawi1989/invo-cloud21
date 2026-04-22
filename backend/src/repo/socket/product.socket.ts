import { SocketController } from "@src/socket";
import { PoolClient } from "pg";
import { ProductRepo } from "../app/product/product.repo";
import { Helper } from "@src/utilts/helper";
import { Socket } from 'socket.io'
import { RedisClient } from "@src/redisClient";


import { BranchesRepo } from "../admin/branches.repo";
import { FileStorage } from "@src/utilts/fileStorage";
import { DB } from "@src/dbconnection/dbconnection";
import { CategoryRepo } from "../app/product/category.repo";
import { DepartmentRepo } from "../app/product/department.repo";
import { S3Storage } from "@src/utilts/S3Storage";

import { ResponseData } from "@src/models/ResponseData";
import { KitProductRepo } from "../app/product/productTypes/kitProduct.repo";
import { Company } from "@src/models/admin/company";
import { CompanyRepo } from "../admin/company.repo";

import format from "pg-format";
import { Logger } from "@src/utilts/invoLogger";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketProductRepo {

    static redisClient: RedisClient;


    /**SEND NEW/UPDATED PRODUCT LIVE SYNC */
    public static async sendNewProduct(client: PoolClient, productId: string, branchId: string, companyId: string) {
        try {


            const product = await ProductRepo.getBranchProductById(client, productId, branchId);

            //send new  product

            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            const newData = await Helper.trim_nulls(product);
            console.log(newData)
            if (newData.mediaId != null && newData.mediaId != "" && newData.mediaId != undefined && newData.mediaUrl) {
                const mediaName = product.mediaUrl.defaultUrl.substring(newData.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, newData.companyId)
                if (imageData) {
                    imageData = imageData.split(';base64,').pop();
                    newData.imageUrl = imageData
                }

            }
            instance.io.of('/api').in(clientId).emit("newProduct", JSON.stringify(newData));
        } catch (error: any) {

          
            return null;
        }
    }
    public static async sendUpdatedProduct(client: PoolClient, productId: string, branchId: string, companyId: string) {
        try {

            const product = await ProductRepo.getBranchProductById(client, productId, branchId);



            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);

            const newData = await Helper.trim_nulls(product);


            if (newData.mediaId != null && newData.mediaId != "" && newData.mediaUrl && newData.mediaUrl.defaultUrl) {
                const mediaName = product.mediaUrl.defaultUrl.substring(newData.mediaUrl.defaultUrl.lastIndexOf('/') + 1)

                let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, newData.companyId)
                if (imageData) {
                    imageData = imageData.split(';base64,').pop();
                    newData.imageUrl = imageData
                }

            }


            instance.io.of('/api').in(clientId).emit("updateProduct", JSON.stringify(newData));
        } catch (error: any) {
            console.log(error)
          
            return null;
        }
    }

    /**EVENT TO RETRIVE BRANCH PRODUCTS */
    public static async getProducts(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {


            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            const products = await this.getBranchProductList(branchId, date);
            const productData = Helper.trim_nulls(products);

            callback(JSON.stringify(productData))

        } catch (error: any) {
            client.emit(error)
            callback(JSON.stringify(error.message))
          
            
            logPosErrorWithContext(error, data, branchId, null, "getProducts")
            return null;
        }
    }
    /**old get products*/
    // public static async getBranchProductList(branchId: string, date: any | null = null) {
    //     try {


    //         const query : { text: string, values: any } = {
    //             text: `SELECT
    //             BranchProducts.available,
    //             BranchProducts.price,
    //             BranchProducts. "onHand",
    //             BranchProducts."priceBoundriesFrom",
    //             BranchProducts."priceBoundriesTo",
    //             BranchProducts."buyDownPrice",
    //             BranchProducts."buyDownQty",
    //             BranchProducts."priceByQty",
    //             BranchProducts."selectedPricingType",
    //             Products.id ,
    //             Products."companyId" ,
    //             Products."parentId",
    //             Products."childQty",
    //             Products.name,
    //             Products.barcode,
    //             Products."defaultPrice",
    //             Products.description,
    //             Products."mediaId",
    //             Products.translation,
    //             Products."categoryId",
    //             Products. "preparationTime",
    //             Products."orderByWeight",
    //             Products. "preparationTime",
    //             Products.type,
    //             Products."taxId",
    //             Products.tags,
    //             Products.warning,
    //             Products."defaultImage",
    //             Products."weightUnit",
    //             Products."weightUnitEnabled",
    //             Products."serviceTime",
    //             products.nutrition,
    //             Products."UOM",
    //             Products."unitCost",
    //             Products."kitBuilder",
    //             Products."package",
    //             Products.selection,
    //             Products."optionGroups",
    //             Products."quickOptions",
    //             Products.recipes,
    //             Products."productMatrixId",
    //             Products."productMedia",
    //             Products."commissionPercentage",
    //             Products."commissionAmount",
    //             Products.color,
    //             Products."priceModel",
    //             "Media"."url",
    //             Products."sku",
    //             Products."alternativeProducts",
    //             Products."maxItemPerTicket",
    //             Products."kitchenName",
    //             Products."isDeleted",
    //             (select json_agg(json_build_object('batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate",'onHand',COALESCE("onHand",0))) AS batches from  "ProductBatches" as ProductBatches where BranchProducts.id = ProductBatches."branchProductId"),
    //             (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
    //             (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
    //             (select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId")
    //             FROM "Products" AS Products 
    //             inner JOIN "BranchProducts" AS BranchProducts
    //             ON BranchProducts."productId" = Products.id 
    //             left join "Media" on "Media".id = Products."mediaId"
    //             where BranchProducts."branchId"=$1
    //               `,
    //             values: [branchId]
    //         }


    //         if (date != null && date != "") {

    //             query.text = `SELECT
    //             BranchProducts.available,
    //             BranchProducts.price,
    //             BranchProducts. "onHand",
    //             BranchProducts."priceBoundriesFrom",
    //             BranchProducts."priceBoundriesTo",
    //             BranchProducts."buyDownPrice",
    //             BranchProducts."buyDownQty",
    //             "Media"."url",
    //             BranchProducts."priceByQty",
    //             BranchProducts."selectedPricingType",
    //             Products.id ,
    //             Products."companyId" ,
    //             Products."parentId",
    //             Products."childQty",
    //             Products.name,
    //             Products.barcode,
    //             Products."defaultPrice",
    //             Products.description,
    //             Products."mediaId",
    //             Products.translation,
    //             Products."categoryId",
    //             Products. "preparationTime",
    //             Products."orderByWeight",
    //             Products. "preparationTime",
    //             Products.type,
    //             Products."taxId",
    //             Products.tags,
    //             Products.warning,
    //             Products."defaultImage",
    //             Products."weightUnit",
    //             Products."weightUnitEnabled",
    //             Products."serviceTime",
    //             products.nutrition,
    //             Products."UOM",
    //             Products."unitCost",
    //             Products."kitBuilder",
    //             Products."package",
    //             Products.selection,
    //             Products."optionGroups",
    //             Products."quickOptions",
    //             Products.recipes,
    //             Products."productMatrixId",
    //             Products."productMedia",
    //             Products."commissionPercentage",
    //             Products."commissionAmount",
    //             Products."priceModel",
    //             Products.color,
    //             Products."sku",
    //             Products."alternativeProducts",
    //             Products."maxItemPerTicket",
    //             Products."kitchenName",
    //             Products."isDeleted",
    //             (select json_agg(json_build_object('batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate",'onHand',COALESCE("onHand",0))) AS batches from  "ProductBatches" as ProductBatches where BranchProducts.id = ProductBatches."branchProductId"),
    //             (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
    //             (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
    //             (select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId")
    //             FROM "Products" AS Products 
    //             inner JOIN "BranchProducts" AS BranchProducts
    //             ON BranchProducts."productId" = Products.id 
    //             left join "Media" on "Media".id = Products."mediaId"
    //             where BranchProducts."branchId" = $1
    //             AND (Products."updatedDate" >= $2)`,
    //                 query.values = [branchId, date]

    //         }


    //         const products: any = await DB.excu.query(query.text, query.values);
    //         for (let index = 0; index < products.rows.length; index++) {
    //             const element = products.rows[index];
    //             const storage = new FileStorage();

    //                 if(process.env.NODE_ENV != "production" && process.env.NODE_ENV != "development"  ){
    //                 if (element.mediaId != null && element.mediaId != "" && element.url.defaultUrl) {
    //                     const mediaName = element.url.defaultUrl.substring(element.url.defaultUrl.lastIndexOf('/') + 1)
    //                     let imageData: any = await S3Storage.getImageBase64(mediaName, element.companyId)
    //                     if (imageData) {
    //                         imageData = imageData.split(';base64,').pop();
    //                         products.rows[index].defaultImage = imageData
    //                     }

    //                 }}


    //         }

    //         return products.rows

    //     } catch (error: any) {
    //         console.log(error)
    //    
    //         throw new Error(error)
    //     }
    // }

    public static async getBranchProductList(branchId: string, date: any | null = null) {
        try {


            const query: { text: string, values: any } = {
                text: `with "products" as (
                    select
                    case when "isSaleItem" = false then false else  "BranchProducts".available end as "available",
                    "BranchProducts".price,
                    "BranchProducts". "onHand"  as "onHand",
                    "BranchProducts"."priceBoundriesFrom",
                    "BranchProducts"."priceBoundriesTo",
                    "BranchProducts"."buyDownPrice",
                    "BranchProducts"."buyDownQty",
                    "BranchProducts"."priceByQty",
                    "BranchProducts"."selectedPricingType",
                     "BranchProducts"."notAvailableOnlineUntil",
                   "BranchProducts"."excludedOptions",
                    "Products".id ,
                      "Products"."defaultOptions" ,
                    "Products"."companyId" ,
                    "Products"."parentId",
                    "Products"."childQty",
                      case when  "Products"."isDeleted" = true then "Products".name ||  "Products"."createdAt" else "Products".name end as "name",
                    "Products".barcode,
                    "Products"."defaultPrice",
                    "Products".description,
                    "Products"."mediaId",
                    "Products".translation,
                    "Products"."categoryId",
                    "Products". "preparationTime",
                    "Products"."orderByWeight",
                    "Products". "preparationTime",
                    "Products".type,
                    "Products"."taxId",
                    "Products".tags,
                    "Products".warning,
                     "Products"."measurements",
                    "Products"."defaultImage",
                    "Products"."weightUnit",
                    "Products"."weightUnitEnabled",
                    "Products"."serviceTime",
                    "Products".nutrition,
                    "Products"."UOM",
                    "Products"."unitCost",
                    "Products"."kitBuilder",
                    "Products"."package",
                    "Products".selection,
                    "Products"."optionGroups",
                    "Products"."quickOptions",
                    "Products".recipes,
                    "Products"."productMatrixId",
                    "Products"."productMedia",
                    "Products"."commissionPercentage",
                    "Products"."commissionAmount",
                    "Products".color,
                    "Products"."priceModel",
                    "Media"."url",
                    "Products"."sku",
                    "Products"."alternativeProducts",
                    "Products"."maxItemPerTicket",
                    "Products"."kitchenName",
                    "Products"."isDeleted",
                    "Products"."brandid",
                                              case when "customFields" is not null and jsonb_typeof("customFields") = 'object' then  (SELECT jsonb_agg(jsonb_build_object('id', key, 'value', value)) AS "customFields"
FROM      jsonb_each("customFields") AS kv(key, value)) else  "customFields" end  as "customFields",
                    "Products"."isDiscountable" ,
                       "Products"."productAttributes" ,
                    "BranchProducts".id as "branchProductId"
                    from "Products" 
                    INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id 
                    LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
                    LEFT JOIN "Brands" on "Brands".id = "Products"."brandid"
                    where "BranchProducts"."branchId" = $1
                    ),batches as(
                    select "products".id as "productId",
                          "products"."branchProductId",
                          json_agg(json_build_object('batch', batch , 'unitCost', "ProductBatches"."unitCost", 'expireDate', "expireDate",'onHand',COALESCE("ProductBatches"."onHand",0)::float)) as "batches"
                          from "ProductBatches"
                          inner join "products" on "products"."branchProductId" = "ProductBatches"."branchProductId"
                        group by "products".id , "products"."branchProductId"
                    ),serials as(
                    select "products".id as "productId",
                          "products"."branchProductId",
                          (select json_agg(json_build_object('serial', serial , 'status', "status"))) as serials
                          from "ProductSerials"
                          inner join "products" on "products"."branchProductId" = "ProductSerials"."branchProductId"
                        group by "products".id , "products"."branchProductId"
                    ), barcodes as (
                    select 
                         "products".id,
                    json_agg(json_build_object('barcode',"ProductBarcodes".barcode )) as barcodes	
                    from "ProductBarcodes" 
                    inner join "products" on "products".id =  "ProductBarcodes"."productId"
                    group by  "products".id
                    ),"employeePrices" as (
                    select 
                        "products".id,
                        json_agg(json_build_object('employeeId', "employeeId" ,'price',"EmployeePrices".price,'serviceTime',"EmployeePrices"."serviceTime")) as "employeePrices"
                        from  "EmployeePrices"
                        inner join "products" on "products".id =  "EmployeePrices"."productId"
                        group by  "products".id
                    )
                    select "products".*,
                            "batches"."batches",
                            "serials"."serials",
                            "barcodes"."barcodes",
                            "employeePrices"."employeePrices"
                    from "products"
                    left join "batches" on "products".id = "batches"."productId" and "batches"."branchProductId" = "products"."branchProductId"
                    left join "serials" on "products".id = "serials"."productId" and "serials"."branchProductId" = "products"."branchProductId"
                    left join "barcodes" on "products".id = "barcodes".id 
    
                    left join "employeePrices" on "products".id = "employeePrices".id 
                  `,
                values: [branchId]
            }


            if (date != null && date != "") {

                query.text = `with "products" as (
                    select
                     case when "isSaleItem" = false then false else  "BranchProducts".available end as "available",
                    "BranchProducts".price,
                     "BranchProducts". "onHand"  as "onHand",
                    "BranchProducts"."priceBoundriesFrom",
                    "BranchProducts"."notAvailableOnlineUntil",
                    "BranchProducts"."priceBoundriesTo",
                    "BranchProducts"."buyDownPrice",
                    "BranchProducts"."buyDownQty",
                    "BranchProducts"."priceByQty",
                    "BranchProducts"."selectedPricingType",
                    "BranchProducts"."excludedOptions",
                    "Products".id ,
                            "Products"."defaultOptions" ,
                    "Products"."companyId" ,
                     "Products"."isDiscountable" ,
                    "Products"."parentId",
                    "Products"."childQty",
                              case when  "Products"."isDeleted" = true then "Products".name ||  "Products"."createdAt" else "Products".name end as "name",
                    "Products".barcode,
                    "Products"."defaultPrice",
                    "Products".description,
                    "Products"."mediaId",
                    "Products".translation,
                    "Products"."categoryId",
                    "Products". "preparationTime",
                    "Products"."orderByWeight",
                    "Products". "preparationTime",
                    "Products".type,
                    "Products"."taxId",
                    "Products".tags,
                    "Products".warning,
                    "Products"."defaultImage",
                    "Products"."weightUnit",
                    "Products"."weightUnitEnabled",
                    "Products"."serviceTime",
                    "Products".nutrition,
                    "Products"."UOM",
                    "Products"."unitCost",
                    "Products"."kitBuilder",
                    "Products"."package",
                    "Products".selection,
                    "Products"."optionGroups",
                        "Products"."measurements",
                    "Products"."quickOptions",
                    "Products".recipes,
                    "Products"."productMatrixId",
                    "Products"."productMedia",
                    "Products"."commissionPercentage",
                    "Products"."commissionAmount",
                    "Products".color,
                    "Products"."priceModel",
                    "Media"."url",
                         "Products"."productAttributes" ,
                    "Products"."sku",
                    "Products"."alternativeProducts",
                    "Products"."maxItemPerTicket",
                    "Products"."kitchenName",
                    "Products"."isDeleted",
                    "Products"."brandid" ,
                    case when "customFields" is not null and jsonb_typeof("customFields") = 'object' then  (SELECT jsonb_agg(jsonb_build_object('id', key, 'value', value)) AS "customFields"
                     FROM      jsonb_each("customFields") AS kv(key, value)) else  "customFields" end  as "customFields",
                    "BranchProducts".id as "branchProductId"
                    from "Products" 
                    INNER JOIN "BranchProducts" ON "BranchProducts"."productId" = "Products".id 
                    LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
                    LEFT JOIN "Brands" on "Brands".id = "Products"."brandid"
                    where "BranchProducts"."branchId" = $1
                    and ("Products"."updatedDate">=$2 or  "BranchProducts"."updatedTime" >= $2 )
                    ),batches as(
                    select "products".id as "productId",
                          "products"."branchProductId",
                          json_agg(json_build_object('batch', batch , 'unitCost', "ProductBatches"."unitCost", 'expireDate', "expireDate",'onHand',COALESCE("ProductBatches"."onHand",0)::float)) as "batches"
                          from "ProductBatches"
                          inner join "products" on "products"."branchProductId" = "ProductBatches"."branchProductId"
                        group by "products".id , "products"."branchProductId"
                    ),serials as(
                    select "products".id as "productId",
                          "products"."branchProductId",
                          (select json_agg(json_build_object('serial', serial , 'status', "status"))) as serials
                          from "ProductSerials"
                          inner join "products" on "products"."branchProductId" = "ProductSerials"."branchProductId"
                        group by "products".id , "products"."branchProductId"
                    ), barcodes as (
                    select 
                         "products".id,
                    json_agg(json_build_object('barcode',"ProductBarcodes".barcode )) as barcodes	
                    from "ProductBarcodes" 
                    inner join "products" on "products".id =  "ProductBarcodes"."productId"
                    group by  "products".id
                    ),"employeePrices" as (
                    select 
                        "products".id,
                        json_agg(json_build_object('employeeId', "employeeId" ,'price',"EmployeePrices".price,'serviceTime',"EmployeePrices"."serviceTime")) as "employeePrices"
                        from  "EmployeePrices"
                        inner join "products" on "products".id =  "EmployeePrices"."productId"
                        group by  "products".id
                    )
                    select "products".*,
                            "batches"."batches",
                            "serials"."serials",
                            "barcodes"."barcodes",
                            "employeePrices"."employeePrices"
                    from "products"
                    left join "batches" on "products".id = "batches"."productId" and "batches"."branchProductId" = "products"."branchProductId"
                    left join "serials" on "products".id = "serials"."productId" and "serials"."branchProductId" = "products"."branchProductId"
                    left join "barcodes" on "products".id = "barcodes".id 
                    left join "employeePrices" on "products".id = "employeePrices".id 
                    `,
                    query.values = [branchId, date]

            }


            const products: any = await DB.excu.query(query.text, query.values);
            for (let index = 0; index < products.rows.length; index++) {
                const element = products.rows[index];
                const storage = new FileStorage();


                if (element.mediaId != null && element.mediaId != "" && element.url.defaultUrl) {
                    const mediaName = element.url.defaultUrl.substring(element.url.defaultUrl.lastIndexOf('/') + 1)
                    let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, element.companyId)
                    if (imageData) {
                        imageData = imageData.split(';base64,').pop();
                        products.rows[index].imageUrl = imageData
                    }

                }


            }

            return products.rows

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async branchesAvailability(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            /**initiate Client */
            await dbClient.query("BEGIN")
            const companyId: any = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;
            if (data) {
                data = JSON.parse(data)
            }
            const products = await ProductRepo.branchesAvailability(dbClient, data.productId, companyId);
            const productData = Helper.trim_nulls(products?.data);
            /**Commit Client */
            await dbClient.query("COMMIT")

            callback(JSON.stringify(productData))
        } catch (error: any) {
            /**RollBack Client */
            await dbClient.query("ROLLBACK")
            callback(JSON.stringify(error.message))
          
            
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "branchesAvailability")

        } finally {
            /**Release Client */
            dbClient.release()
        }
    }


    public static async getItemAvailability(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            const products = await ProductRepo.getItemAvailability(data, branchId);
            const productData = Helper.trim_nulls(products?.data);
            callback(JSON.stringify(productData))
        } catch (error: any) {
          
            
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "getItemAvailability")

        }
    }

    public static async seasonalPriceItems(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            let searchValue = data.searchTerm && data.searchTerm.trim() != '' && data.searchTerm != null ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : null;

            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 7 : data.limit);
            let offset = (limit * (page - 1))

            let categoryId = data.categoryId;
            let brandId = data.brandId;
            let type = data.type;
            let minPrice = data.minPrice;
            let maxPrice = data.maxPrice;

            const query: { text: string, values: any } = {
                text: `Select 
                    count(*) over() as "count",  
                    "Products"."id","Products".name , 
                   "BranchProducts"."price", 
                   "Products"."defaultPrice"
                    from "BranchProducts" 
                    inner join "Products" on "Products".id = "BranchProducts"."productId"
                    where "branchId" = $1
                    AND ($2::text IS NULL OR trim(Lower("Products".name))  ~ $2::text)
                     and($3::uuid is null or  "Products"."categoryId"=$3)
                     and($4::uuid is null or  "Products"."brandid"=$4)
                     and($5::text is null or  "Products"."type"=$5)
                     and($6::float is null or COALESCE( "BranchProducts"."price","Products"."defaultPrice" ) >= $6 )
                     and($7::float is null or COALESCE( "BranchProducts"."price","Products"."defaultPrice" ) <= $7 )
                    and "Products"."isDeleted" = false
                    order by "Products"."createdAt" DESC
                    limit $8
                    offset $9 
                    `,
                values: [branchId, searchValue, categoryId, brandId, type, minPrice, maxPrice, limit, offset]
            }
            const items = await DB.excu.query(query.text, query.values);

            let count = items.rows && items.rows.length > 0 ? Number((<any>items.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)


            callback(JSON.stringify({ items: items.rows, pageCount: pageCount }))

        } catch (error: any) {
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "seasonalPriceItems")

            throw new Error(error)
        }
    }


    public static async saveSeasonalPriceItems(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);


                for (let index = 0; index < data.length; index++) {
                    const element = data[index];

                    let query = {
                        text: `UPDATE "BranchProducts" set "price" =$1 where "productId" =$2 and "branchId"=$3 `,
                        values: [element.price, element.productId, branchId]
                    }
                    await DB.excu.query(query.text, query.values)
                }


            }




            callback(JSON.stringify({ success: true }))

        } catch (error: any) {
            console.log(error)

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "saveSeasonalPriceItems")
            throw new Error(error)
        }
    }



    /**EVENT TO UPDATE PRODUCT AVAILAIBILITY */
    public static async updateItemAvailaibility(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            await ProductRepo.setProductAvailaibility(data, branchId)
            callback(JSON.stringify({ success: true }));
        } catch (error: any) {
          
            
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "updateItemAvailaibility")

        }
    }

    public static async getOpeningBalance(client: PoolClient, productId: string, branchId: string) {
        try {
            const query = {
                text: `select "openingBalance"  from "BranchProducts" where "productId"=$1 and "branchId"=$2`,
                values: [productId, branchId]
            }

            let product = await client.query(query.text, query.values);

            return product.rows && product.rows.length > 0 && product.rows[0].openingBalance ? product.rows[0].openingBalance : 0
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**EVENT TO SEND PRODUCT ONHAND LIVE SYNC ON ONHAND UPDATED */
    public static async onHandsync(client: PoolClient, onHand: number, productId: any, branchId: any, batch: string | null = null, serial: any | null = null) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {
            // let opeiningBalance = await this.getOpeningBalance(client,productId,branchId);
            const data = {
                productId: productId,
                onHand: onHand,
                batch: batch,
                serial: serial
            }


            instance.io.of('/api').in(clientId).emit("onHandSync", JSON.stringify(data));
        } catch (error: any) {
          

            instance.io.of('/api').in(clientId).emit("error", JSON.stringify({ success: false, error: error }));
        }
    }



    public static async getCategories(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            let date;

            if (data) {
                data = JSON.parse(data)

                if (data.date == null && data.date == "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const categories = await CategoryRepo.getCategories(branchId, date)
            callback(JSON.stringify(categories.data))
        } catch (error: any) {
          
            ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getCategories")
        }
    }
    public static async getDepartments(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {
            let date;

            if (data) {
                data = JSON.parse(data)

                if (data.date == null && data.date == "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const categories = await DepartmentRepo.getDepartmentsByBranchId(branchId, date)
            callback(JSON.stringify(categories.data))

        } catch (error: any) {
            console.log(error)
          
            ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getDepartments")
        }

    }

    public static async breakKit(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {

            const company = new Company();
            const query: { text: string, values: any } = {
                text: `SELECT "companyId",country from "Companies" 
                      INNER JOIN "Branches" on   "Companies".id = "Branches"."companyId"
                    where "Branches".id =$1`,
                values: [branchId]
            }
            const branch = await DB.excu.query(query.text, query.values);
            company.id = (<any>branch.rows[0]).companyId;
            company.country = (<any>branch.rows[0]).country;
            company.afterDecimal = await CompanyRepo.getCountryAfterDecimal(company.country)

            if (data) {
                data = JSON.parse(data);
            }

            const employeeId = data.employeeId;
            const qty = data.qty;
            const productId = data.productId

            let kitData = {
                onHand: qty,
                productId: productId,
                branchId: branchId
            }
            const categories = await KitProductRepo.breakKit(kitData, employeeId, company)
            callback(JSON.stringify(categories))

        } catch (error: any) {
            console.log(error)
     
            logPosErrorWithContext(error, data, branchId, null, "breakKit")
            callback(JSON.stringify(error.message))
        }

    }

    public static async getProductsImages(data: any, branchId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let page = data.page ?? 1;
            let pageCount = 0;
            let date = data.date;
            let limit = 1;
            let offset = 0;
            if (page != 0) {
                offset = (limit * (page - 1))
            }


            let countQuery = `select count(*) from "Products"
                inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId" = $1
                inner join "Media" on  "Media".id = "Products"."mediaId"
                `
            let countValues = [branchId]
            if (date != null && date != undefined) {
                countQuery = `select count(*) from "Products"
                    inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId" = $1
                    inner join "Media" on  "Media".id = "Products"."mediaId"
                    where "Products"."updatedDate" >= $2`
                countValues = [branchId, date]
            }

            let totalCount = await client.query(countQuery, countValues);
            let count = totalCount.rows[0].count;
            pageCount = Math.ceil(count / limit) - (limit * page);


            let productQuery = ` SELECT 
                                        "Products".id,
                                        "Media".id as "mediaId",
                                         "Media".url,
                                         "Products"."companyId",
                                         '' as "defaultImage"
                                  FROM "Products" 
                                  inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId" = $1
                                  inner join "Media" on  "Media".id = "Products"."mediaId"
                                  limit $2 offset $3
                                  `
            let values: any = [branchId, limit, offset];
            if (date != null) {
                productQuery = `select 
                                "Products".id,
                                "Products"."companyId",
                                "Media".id as "mediaId",
                                "Media".url,
                                '' as "defaultImage"
                    from "Products"
                    inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId" = $1
                    inner join "Media" on  "Media".id = "Products"."mediaId"
                    where "Products"."updatedDate" >= $2
                    limit $3 offset $4
                    `
                values = [branchId, date, limit, offset];
            }



            const products: any = await client.query(productQuery, values);

            let product = {
                id: "",
                url: "",
                defaultUrl: ""
            }
            for (let index = 0; index < products.rows.length; index++) {
                const element = products.rows[index];

                // if(process.env.NODE_ENV != "production" && process.env.NODE_ENV != "development"  ){
                product.id = element.id;
                product.url = element.url;

                if (element.mediaId != null && element.mediaId != "" && element.url.defaultUrl) {

                    const mediaName = element.url.defaultUrl.substring(element.url.defaultUrl.lastIndexOf('/') + 1)

                    let imageData: any = await S3Storage.getMediaImage(mediaName, element.companyId)

                    if (imageData) {

                        imageData = imageData.split(';base64,').pop();
                        product.defaultUrl = imageData
                    }

                }
                // }



            }

            await client.query("COMMIT")
            return new ResponseData(true, "", { product: product, pageCount: pageCount })

        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error);

        } finally {
            client.release()
        }
    }


    public static async getMaxQty(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {

            if (data) {
                data = JSON.parse(data);
            }
            const productId = data.productId
            const categories = await KitProductRepo.getMaximumAllowedQty(productId, branchId)
            callback(JSON.stringify(categories))

        } catch (error: any) {
            console.log(error)
          
            ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getMaxQty")
        }

    }


    public static async buildKit(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {

            const company = new Company();
            const query: { text: string, values: any } = {
                text: `SELECT "companyId",country from "Companies" 
                      INNER JOIN "Branches" on   "Companies".id = "Branches"."companyId"
                    where "Branches".id =$1`,
                values: [branchId]
            }
            const branch = await DB.excu.query(query.text, query.values);
            company.id = (<any>branch.rows[0]).companyId;
            company.country = (<any>branch.rows[0]).country;
            company.afterDecimal = await CompanyRepo.getCountryAfterDecimal(company.country)

            if (data) {
                data = JSON.parse(data);
            }


            const productId = data.productId
            const employeeId = data.employeeId;
            const qty = data.qty;

            let kitData = {
                onHand: qty,
                productId: productId,
                branchId: branchId
            }
            const categories = await KitProductRepo.buildKit(kitData, company, employeeId)
            callback(JSON.stringify(categories))

        } catch (error: any) {
            console.log(error)
          
            ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "buildKit")
        }

    }

    public static async getBrands(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const DBClient = await DB.excu.client();

        try {


            /**Begin */
            await DBClient.query("BEGIN");
            let date;

            if (data) {
                data = JSON.parse(data)

                if (data.date == null && data.date == "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const companyId: any = (await BranchesRepo.getBranchCompanyId(DBClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "Brands".id,
                                  "Brands".name
                     FROM "Brands" 
                          WHERE "Brands"."companyid" = $1
                          and($2::timestamp is null or ("createdAt" >= $2 or "updatedDate" >=$2))
                          `,
                values: [companyId, date]
            }



            const list = await DBClient.query(query.text, query.values);

            /**Commit */

            await DBClient.query("COMMIT")
            callback(JSON.stringify(list.rows))

        } catch (error: any) {
            console.log(error)
            /**ROLLBACK */
            await DBClient.query("ROLLBACK")
          
            logPosErrorWithContext(error, data, branchId, null, "shareInvoice")
            throw new Error(error.message)
        } finally {
            /**release */
            DBClient.release()
        }

    }

    public static async updateProductAvailability(data: any, branchId: string) {
        try {

            //send new  product

            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);
            console.log(data)
            instance.io.of('/api').in(clientId).emit("updateProductAvailability", JSON.stringify(data));
        } catch (error: any) {

          
            return null;
        }
    }



    public static async setItemAvailability(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            if (data) {
                data = JSON.parse(data);
            }

            console.log("setItemAvailabilitysetItemAvailability", data)
            const transactionValues = data.filter((f: any) => f.optionId == null).map((update: any) => [update.productId, update.available, update.availableOnline, branchId]);
            if (transactionValues && transactionValues.length > 0) {
                const updateQuery = `
                UPDATE "BranchProducts" 
                SET "available" = data."available"::boolean,
                    "availableOnline" = data."availableOnline"::boolean
                FROM (VALUES %L) AS data("productId","available","availableOnline","branchId")
                WHERE "BranchProducts"."productId"= data."productId"::uuid 
                and "BranchProducts"."branchId" =    data."branchId"::uuid 
              `;
                const formattedQuery = format(updateQuery, transactionValues);
                await DB.excu.query(formattedQuery);


            }

            const options = data.filter((f: any) => f.optionId)
            console.log(options)

            if (options && options.length > 0) {
                const productIds = options.map((f: any) => { return f.productId })
                const query = {
                    text: `SELECT "productId",
                                 "excludedOptions",
                                 "onlineExcludedOptions"
                            from "BranchProducts"
                         where "productId" = any($1)
                         and "branchId" = $2        
                     `,
                    values: [productIds, branchId]
                }
                const groupedData: any = options.reduce((acc: any, item: any) => {
                    // Check if the productId already exists in the accumulator object
                    if (!acc[item.productId]) {
                        acc[item.productId] = { productId: item.productId, options: [] };
                    }

                    // Push the current item into the options array of the corresponding productId
                    acc[item.productId].options.push({
                        optionId: item.optionId,
                        available: item.available,
                        availableOnline: item.availableOnline
                    });

                    return acc;
                }, {});

                let updatedLists: any[] = []
                for (const key in groupedData) {

                    updatedLists.push(groupedData[key])
                }
                let products = await DB.excu.query(query.text, query.values);
                let updatedProductsData = products.rows

                updatedProductsData = updatedProductsData.map((f: any) => {
                    if (!f.excludedOptions) {
                        f.excludedOptions = []
                    }

                    if (!f.onlineExcludedOptions) {
                        f.onlineExcludedOptions = []
                    }
                    let productOptions = updatedLists.find((op: any) => op.productId == f.productId)
                    console.log("===", productOptions)
                    if (productOptions) {

                        productOptions.options.forEach((option: any) => {
                            let optionData = {
                                optionId: option.optionId,
                                pauseUntil: null
                            }
                            console.log(option)
                            console.log(optionData)
                            console.log("avvvvvvvvvvvvvvvvvvvvvvvvvv", option.available && f.excludedOptions && f.excludedOptions.length > 0)
                            if (option.available && f.excludedOptions && f.excludedOptions.length > 0) {
                                console.log("avvvvvvvvvvvvvvvvvvvvvvvvvv", option.available && f.excludedOptions && f.excludedOptions.length > 0)
                                f.excludedOptions.splice(f.excludedOptions.indexOf(f.excludedOptions.find((temOp: any) => temOp.optionId == option.id)), 1)
                            } else if (!option.available) {
                                f.excludedOptions.push(optionData)
                            } else if (option.availableOnline && f.onlineExcludedOptions && f.onlineExcludedOptions.length > 0) {
                                f.onlineExcludedOptions.splice(f.onlineExcludedOptions.indexOf(f.onlineExcludedOptions.find((temOp: any) => temOp.optionId == option.id)), 1)
                            } else if (!option.availableOnline) {
                                f.onlineExcludedOptions.push(optionData)
                            }


                        });
                    }
                    return f
                })


                console.log(updatedProductsData)
                const transactionValues = updatedProductsData.map((update: any) => [update.productId, JSON.stringify(update.excludedOptions), JSON.stringify(update.onlineExcludedOptions), branchId]);
                console.log(transactionValues)
                if (transactionValues && transactionValues.length > 0) {
                    const updateQuery = `
                    UPDATE "BranchProducts" 
                    SET "excludedOptions" = data."excludedOptions"::jsonb,
                        "onlineExcludedOptions" = data."onlineExcludedOptions"::jsonb
                       
                    FROM (VALUES %L) AS data("productId","excludedOptions","onlineExcludedOptions","branchId")
                    WHERE "BranchProducts"."productId"= data."productId"::uuid 
                    and "BranchProducts"."branchId"= data."branchId"::uuid 
              
                  `;
                    const formattedQuery = format(updateQuery, transactionValues);
                    await DB.excu.query(formattedQuery);
                }

            }

            callback(JSON.stringify({ success: true }));
        } catch (error: any) {
            console.log(error)
          
            callback(JSON.stringify({ success: false, error: error.message }));
                    logPosErrorWithContext(error, data, data.branchId, null, "setItemAvailability")
            return null;
        }
    }

    public static async getProductsOnHand(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }
            const query: { text: string, values: any } = {
                text: `Select "Products".id as "productId", 
						       "BranchProducts"."onHand" ,
						        type, 
						        case when type = 'serialized' and count("ProductSerials".id)>0  then JSON_AGG(JSON_BUILD_OBJECT('serial', "ProductSerials"."serial", 'status',"ProductSerials"."status"))end as "serials",
						        case when type = 'batch' and count("ProductBatches".id)>0 then JSON_AGG(JSON_BUILD_OBJECT('batch', "ProductBatches"."batch", 'onHand',"ProductBatches"."onHand",'expireDate',"ProductBatches"."expireDate"))end as "batches"
                        from "Products" 
                        inner Join "BranchProducts" on "Products".id = "BranchProducts"."productId"
                        left join "ProductBatches" ON "ProductBatches"."branchProductId" = "BranchProducts".id
                        left join "ProductSerials" ON "ProductSerials"."branchProductId" = "BranchProducts".id
                        where "BranchProducts"."branchId" = $1 and "Products".type In ('inventory','kit','batch','serialized')
                        GROUP BY "Products".id , "BranchProducts"."onHand",type`,
                values: [branchId]
            }

            const list = await DB.excu.query(query.text, query.values);

            callback(JSON.stringify(new ResponseData(true, "", list.rows)));
        } catch (error: any) {
            console.log(error);
            callback(JSON.stringify(new ResponseData(false, error.message, [])));
          
            logPosErrorWithContext(error, data, branchId, null, "getProductsOnHand")

            throw new Error(error.message);
        }
    }
}