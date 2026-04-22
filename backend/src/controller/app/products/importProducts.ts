import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { RedisClient } from '@src/redisClient';
import { ProductController } from "./product.controller";
import { ProductRepo } from "@src/repo/app/product/product.repo";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { DB } from "@src/dbconnection/dbconnection";
import format from 'pg-format'
import { PoolClient } from "pg";

export class ImportProductsRepo {

    public static async import(data: any, company: Company) {

        let redisClient = RedisClient.getRedisClient();
        try {
            let limit: any = 200
            let count = data.length; //3000
            let pageCount = Math.ceil(count / limit)
            let offset = 0;
            let errors: any[] = []


            //check duplicate name
            let duplicatedNames = ImportProductsRepo.findDuplicate(data, 'name')
            if (duplicatedNames && duplicatedNames.length > 0) {
                throw new Error(
                    `The following product names are duplicated  must be unique: ${duplicatedNames.join(", ")}`
                );
            }

            /**check if barcode is empty */
            let productsWithEmptyBarcode = data.filter((f: any) => !f.barcode || f.barcode.trim() === '');
            if (productsWithEmptyBarcode && productsWithEmptyBarcode.length > 0) {
                throw new Error(
                    `Some products have empty barcodes. Please ensure all products have a valid barcode.`
                );
            }
            //check duplicate barcode
            let duplicatedBarcodes = ImportProductsRepo.findDuplicateBarcodes(data)
            if (duplicatedBarcodes && duplicatedBarcodes.length > 0) {
                throw new Error(
                    `The following product barcodes are duplicated  must be unique: ${duplicatedBarcodes.join(", ")}`
                );
            }
            //check duplicate SKU
            let duplicatedSKU = ImportProductsRepo.findDuplicate(data, 'sku')
            if (duplicatedSKU && duplicatedSKU.length > 0) {
                throw new Error(
                    `The following product SKUs are duplicated and must be unique: ${duplicatedSKU.join(", ")}`
                );
            }
            let categories = data.filter((f: any) => f.categoryName && f.departmentName).map((f: any) => {
                return {
                    categoryName: f.categoryName,
                    departmentName: f.departmentName,
                }
            })

            categories = await this.manageDepartments(categories, company.id)
            categories = await this.manageCategories(categories, company.id)

            data = data.map((m: any) => {
                if (m.categoryName) {
                    let category = categories.find((f: any) => f.categoryName == m.categoryName)
                    if (category)
                        m.categoryId = category.categoryId
                }
                return m
            })
            const categoryCounter: any = {};

            data = data.map((p: any) => {
                categoryCounter[p.categoryId] = (categoryCounter[p.categoryId] || 0) + 1;

                return {
                    ...p,
                    categoryIndex: categoryCounter[p.categoryId]
                };
            });
            //array of Brands
            let brandNames = data.filter((f: any) => f.brand).map((f: any) => {
                return {
                    name: f.brand
                }
            })

            let brandes = await this.manageBrands(brandNames, company.id)
            data = data.map((m: any) => {
                if (m.brand) {
                    let brand = brandes.find((f: any) => f.name == m.brand)
                    if (brand)
                        m.brandid = brand.brandId
                }
                return m
            })
            //Branch Array
            const branches = await this.getCompanyBranchIds(company.id);

            //Default Tax
            let taxId = (await this.getDefaultTax(company.id)).data.id;

            if (taxId) {
                data = data.map((m: any) => {
                    m.taxId = m.defaultTax ? taxId : null;
                    return m
                })
            }

            for (let index = 0; index < pageCount; index++) {
                console.log("===================", index)
                let processed = Math.min((index + 1) * limit, count); // processed so far
                let progress = Math.floor((processed / count) * 100) + "%";


                await redisClient.set("BulkImport" + company.id, JSON.stringify({ progress: progress }))
                let products: any = data.splice(offset, limit)
                /** getProductIds */
                products = await this.productIds(products, company.id)


                //* check barcode/ sku duplicated data in db */
                products = await this.checkBarcodeSku(products, company.id)
                products.filter((f: any) => f.barcodeExist || f.aliasBarcodeExist).map((m: any) => {
                    errors.push({
                        "productName": m.name,
                        "error": `Barcode Already used  `
                    })
                })
                products.filter((f: any) => f.skuExist).map((m: any) => {
                    errors.push({
                        "productName": m.name,
                        "error": `SKU Already used `
                    })
                })

                products = products.filter((f: any) => !f.skuExist && !f.barcodeExist)
                let response = await this.importProducts(products, company, branches)

                if (response && response.newProducIds && response.newProducIds.length > 0) {
                    let queueInstance = TriggerQueue.getInstance();
                    queueInstance.createJob({ journalType: "Movment", type: "newProductCost", ids: response.newProducIds, branchId: null })
                }
            }

            await redisClient.deletKey("BulkImport" + company.id)
            return new ResponseData(true, "", { errors: errors })
        } catch (error: any) {
            await redisClient.deletKey("BulkImport" + company.id)
            throw new Error(error)
        }
    }


    public static findDuplicate(arr: any[], field: string): string[] {
        const names = arr.filter(f => f[field]).map(i => String(i[field]).trim().toLowerCase());
        return names && names.length > 0 ? [...new Set(names.filter((n, i) => names.indexOf(n) !== i))] : [];
    }
    public static findDuplicateBarcodes(arr: any[]): string[] {
        // collect all barcodes from either `barcode` or `barcodes`
        const allCodes = arr.flatMap(item => {
            if (item.barcode) return [item.barcode.trim().toLowerCase()];
            if (item.barcodes) return item.barcodes.map((b: any) => b.trim().toLowerCase());
            return [];
        });

        // detect duplicates
        return [...new Set(allCodes.filter((b, i) => allCodes.indexOf(b) !== i))];
    }
    public static async manageDepartments(arr: any[], companyId: string) {

        try {
            let distinctDepartments = [...new Set(arr.map(i => i.departmentName.trim().toLowerCase()))];

            let query = {
                text: `SELECT id , name from "Departments" where "companyId"=$1 and trim(lower("name")) = any($2)`,
                values: [companyId, distinctDepartments]
            }

            let res = await DB.excu.query(query.text, query.values)
            if (res && res.rows.length > 0) {
                arr = arr.map(f => {
                    let dep = res.rows.find(item => item.name && f.departmentName && item.name.trim().toLowerCase() == f.departmentName.trim().toLowerCase())
                    if (dep) {
                        f.departmentId = dep.id
                    }
                    return f
                })

            }
            const baseDate = new Date();
            let newDepartments = arr.filter(f => !f.departmentId);
            if (newDepartments && newDepartments.length > 0) {
                newDepartments = [...new Set(newDepartments.map(i => i.departmentName.trim()))];
                if (newDepartments && newDepartments.length > 0) {
                    const transactionValues = newDepartments.map((name, index: number) => [name, companyId, new Date(baseDate.getTime() + (newDepartments.length - index) ), new Date()]);
                    query.text = `INSERT INTO "Departments" ("name", "companyId", "createdAt","updatedDate")
                               VALUES %L
                               RETURNING name, id `

                    const formattedQuery = format(query.text, transactionValues);
                    let insertedDepartments = await DB.excu.query(formattedQuery);
                    if (insertedDepartments && insertedDepartments.rows.length > 0) {
                        arr = arr.map(f => {
                            let dep = insertedDepartments.rows.find(item => item.name.trim().toLowerCase() == f.departmentName.trim().toLowerCase())
                            if (dep) {
                                f.departmentId = dep.id
                            }
                            return f
                        })

                    }
                }
            }

            return arr
        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async manageCategories(arr: any[], companyId: string) {

        try {
            let distinctCategories = [...new Set(arr.map(i => i.categoryName.trim().toLowerCase()))];

            let query = {
                text: `SELECT id , name from "Categories" where "companyId"=$1 and trim(lower("name")) = any($2)`,
                values: [companyId, distinctCategories]
            }

            let res = await DB.excu.query(query.text, query.values)
            if (res && res.rows.length > 0) {
                arr = arr.map(f => {
                    let cat = res.rows.find(item => item.name.trim().toLowerCase() == f.categoryName.trim().toLowerCase())
                    if (cat) {
                        f.categoryId = cat.id
                    }
                    return f
                })

            }

            let newCategories = arr.filter(f => !f.categoryId);
            const maxIndex = await DB.exec.query('Select max(index) from "Categories" where "companyId"=$1', [companyId])
            const startIndex = maxIndex.rows && maxIndex.rows.length > 0 && maxIndex.rows[0].max ? maxIndex.rows[0].max : 0
            if (newCategories && newCategories.length > 0) {
                newCategories = [...new Set(newCategories.map(i => i.categoryName.trim()))];

                newCategories = newCategories
                    .map(m => {
                        let cat = arr.find(f => f.categoryName.trim().toLowerCase() === m.trim().toLowerCase());
                        if (cat) {
                            return {
                                categoryName: m,
                                departmentId: cat.departmentId
                            };
                        }
                        return null; // explicitly return null if not found
                    })
                    .filter(Boolean); // removes null/undefined
                if (newCategories && newCategories.length > 0) {


                    const transactionValues = newCategories.map((update: any, index: number) => [update.categoryName, update.departmentId, companyId, new Date(), new Date(), index + startIndex]);
                    query.text = `  INSERT INTO "Categories" ("name", "departmentId","companyId", "createdAt","updatedDate","index")
                               VALUES %L
                               RETURNING name, id `

                    const formattedQuery = format(query.text, transactionValues);
                    let insertedCategories = await DB.excu.query(formattedQuery);
                    if (insertedCategories && insertedCategories.rows.length > 0) {
                        arr = arr.map(f => {
                            let cat = insertedCategories.rows.find(item => item.name == f.categoryName)
                            if (cat) {
                                f.categoryId = cat.id
                            }
                            return f
                        })

                    }
                }
            }

            return arr
        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async manageBrands(arr: any[], companyId: string) {

        try {
            let distinctBrands = [...new Set(arr.map(i => i.name.trim().toLowerCase()))];

            let query = {
                text: `SELECT id , name from "Brands" where "companyid"=$1 and trim(lower("name")) = any($2)`,
                values: [companyId, distinctBrands]
            }

            let res = await DB.excu.query(query.text, query.values)
            if (res && res.rows.length > 0) {
                arr = arr.map(f => {
                    let brand = res.rows.find(item => item.name.trim().toLowerCase() == f.name.trim().toLowerCase())
                    if (brand) {
                        f.brandId = brand.id
                    }
                    return f
                })

            }

            let newBrands = arr.filter(f => !f.brandId);
            if (newBrands && newBrands.length > 0) {
                newBrands = [...new Set(newBrands.map(i => i.name.trim()))];
                const transactionValues = newBrands.map(name => [name, companyId, new Date(), new Date()]);
                query.text = `  INSERT INTO "Brands" ("name", "companyid", "createdAt","updatedDate")
                               VALUES %L
                               RETURNING name, id `

                const formattedQuery = format(query.text, transactionValues);
                let insertedBrands = await DB.excu.query(formattedQuery);
                if (insertedBrands && insertedBrands.rows.length > 0) {
                    arr = arr.map(f => {
                        let cat = insertedBrands.rows.find(item => item.name == f.name)
                        if (cat) {
                            f.brandId = cat.id
                        }
                        return f
                    })

                }
            }
            return arr
        } catch (error: any) {
            throw new Error(error)
        }

    }
    public static async manageProductBarcodes(client: PoolClient, barcodes: any[]) {
        try {
            if (!barcodes || barcodes.length === 0) return;

            const values = barcodes.map(b => [
                b.productId,
                b.companyId,
                b.barcode
            ]);

            const query = format(`
        INSERT INTO "ProductBarcodes" ("productId","companyId","barcode")
        VALUES %L
        ON CONFLICT ("productId","barcode") DO NOTHING
      `, values);

            await client.query(query);
        } catch (error: any) {
            throw new Error(error.message || error);
        }
    }
    public static async getDefaultTax(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT id , "taxPercentage", "taxes" from "Taxes" where "companyId" = $1 AND "default"=$2  `,
                values: [companyId, true]
            }

            const data = await DB.excu.query(query.text, query.values);
            let tax: any = data.rows[0]
            let returnData = {
                id: null,
                taxPercentage: 0,
                taxes: []
            }

            if (tax != null) {
                returnData.id = tax.id;
                returnData.taxPercentage = tax.taxPercentage;
                returnData.taxes = tax.taxes;
                return new ResponseData(true, "", returnData)
            } else {
                return new ResponseData(true, "", returnData)
            }

        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async getCompanyBranchIds(companyId: string) {
        try {
            const query: { name: string, text: string, values: any } = {
                name: "getCompanyBranchIds",
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
    public static async productIds(arr: any[], companyId: string) {
        try {
            let productNames = arr.map(i => { return { "productName": i.name ? i.name.trim().toLowerCase() : null, "barcode": i.barcode ? i.barcode.trim().toLowerCase() : null } })
            const query: { text: string, values: any } = {

                text: `WITH input AS (
                        SELECT jsonb_array_elements($2::jsonb) AS elem
                        )
						
						SELECT 
                         "Products".id,
						elem->>'productName' as "productName",
                        elem->>'barcode' as "productBarcode"
                        FROM "Products"
						inner join "input" on lower(trim("Products"."barcode")) =   trim(lower(elem->>'barcode')) or  trim(lower("Products"."name")) = elem->>'productName' 
						where "Products"."companyId" = $1 `,
                values: [companyId, JSON.stringify(productNames)]
            }
            const list = await DB.excu.query(query.text, query.values);
            if (list && list.rows.length > 0) {
                arr = arr.map(f => {
                    let cat = list.rows.find(item => (item.productName && f.name && item.productName.trim().toLowerCase() == f.name.trim().toLowerCase()) || (item.productBarcode && f.barcode && item.productBarcode.trim().toLowerCase() == f.barcode.trim().toLowerCase()))
                    if (cat) {
                        f.id = cat.id
                    }
                    return f
                })

            }
            return arr
        } catch (error: any) {
            console.log(error)

            return null
        }
    }

    public static async checkBarcodeSku(arr: any[], companyId: string) {
        try {
            const products = arr.map(f => ({
                companyId: companyId,
                productId: f.id || null,
                productName: f.name,         // ✅ add productName since you group by it
                barcode: f.barcode || null,

                barcodes: [
                    ...(f.barcode ? [f.barcode] : []),              // add main barcode if not null
                    ...((f.barcodes || []).map((b: any) => b.barcode))  // add alias barcodes
                ],
                sku: f.sku || null
            }));
            const query = {
                text: `WITH input AS (
                            SELECT
                                (elem->>'productId')::uuid    AS product_id,
                                elem->>'productName'          AS product_name,
                                (elem->>'companyId')::uuid    AS company_id,
                                elem->>'sku'                  AS sku,
                                b.barcode                     AS barcode_to_check
                            FROM jsonb_array_elements($1::jsonb) elem
                            LEFT JOIN LATERAL jsonb_array_elements_text(elem->'barcodes') b(barcode) ON TRUE
                        ),
                        products_cte AS (
                            SELECT p.id,
                                p."companyId",
                                p."barcode",
                                TRIM(LOWER(p."sku")) AS norm_sku
                            FROM "Products" p
                            WHERE p."companyId" = $2::uuid
                            AND p."isDeleted" = false
                        )
                        SELECT 
                            i.product_id   AS id,
                            i.product_name AS "productName",
                            i.company_id   AS "input_company_id",
                            (COUNT(DISTINCT p1.id) > 0) AS "barcodeExist",
                            (COUNT(DISTINCT p2.id) > 0) AS "skuExist"
                        FROM input i
                        LEFT JOIN products_cte p1
                            ON p1."barcode" = i.barcode_to_check
                        AND (i.product_id IS NULL OR p1.id <> i.product_id)
                        LEFT JOIN products_cte p2
                            ON p2.norm_sku = TRIM(LOWER(i.sku))
                        AND (i.product_id IS NULL OR p2.id <> i.product_id)
                        GROUP BY i.product_id, i.product_name, i.company_id;

                            `,
                values: [JSON.stringify(products), companyId]
            }

            let res = await DB.excu.query(query.text, query.values);
            if (res && res.rows.length > 0) {
                arr = arr.map(item => {
                    let pro = res.rows.find(f => f.productName == item.name)
                    if (pro) {
                        item.barcodeExist = pro.barcodeExist
                        item.skuExist = pro.skuExist
                    }
                    return item
                })
            }
            let validProducts = arr.filter(f => !f.skuExist && !f.barcodeExist);
            validProducts = validProducts.map(f => ({
                companyId: companyId,
                productId: f.id || null,
                productName: f.name,         // ✅ add productName since you group by it

                barcodes: [
                    ...(f.barcode ? [f.barcode] : []),              // add main barcode if not null
                    ...((f.barcodes || []).map((b: any) => b.barcode))  // add alias barcodes
                ],
                sku: f.sku || null
            }));
            if (validProducts && validProducts.length > 0) {
                const aliasQuery = {
                    text: `WITH input AS (
                                            SELECT
                                                (elem->>'productId')::uuid    AS product_id,
                                                elem->>'productName'          AS product_name,
                                                (elem->>'companyId')::uuid    AS company_id,
                                                b.barcode_to_check
                                            FROM jsonb_array_elements($1::jsonb) elem
                                            LEFT JOIN LATERAL jsonb_array_elements_text(elem->'barcodes') b(barcode_to_check) ON TRUE
                                            ),
                                            check_all AS (
                                            SELECT DISTINCT
                                                i.product_id,
                                                i.product_name,
                                                i.company_id,
                                                i.barcode_to_check,
                                                CASE WHEN EXISTS (
                                                    SELECT 1
                                                    FROM "ProductBarcodes" pb
                                                    WHERE pb."companyId" = i.company_id
                                                        AND pb."barcode"   = i.barcode_to_check
                                                        AND (i.product_id IS NULL OR pb."productId" <> i.product_id)
                                                ) THEN true ELSE false END AS barcode_exists
                                            FROM input i
                                            WHERE i.barcode_to_check IS NOT NULL
                                            )
                                            SELECT
                                                product_id   AS id,
                                                product_name AS "productName",
                                                company_id   AS "input_company_id",
                                                BOOL_OR(barcode_exists) AS "barcodeExist"
                                            FROM check_all
                                            GROUP BY product_id, product_name, company_id;

                            `,
                    values: [JSON.stringify(validProducts)]
                }

                let res = await DB.excu.query(aliasQuery.text, aliasQuery.values);
                if (res && res.rows.length > 0) {
                    arr = arr.map(item => {
                        let pro = res.rows.find(f => f.productName == item.name)
                        if (pro) {
                            item.aliasBarcodeExist = pro.aliasBarcodeExist

                        }
                        return item
                    })
                }
            }

            return arr
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async importProducts(data: any, company: Company, branches: any[]) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let newProducts = data.filter((f: any) => !f.id)
            let updateProducts = data.filter((f: any) => f.id)
            let newProducIds;
            if (newProducts && newProducts.length > 0) {
                newProducIds = await this.saveNewProducts(client, newProducts, company, branches)
            }
            if (updateProducts && updateProducts.length > 0) {
                await this.updateProducts(client, updateProducts, company)
            }

            await client.query("COMMIT")
            return { newProducIds: newProducIds };
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async saveNewProducts(client: PoolClient, data: any, company: Company, branches: any[]) {
        try {
            const baseDate = new Date();
            const transactionValues = data.map((update: any, index: number) => {
                const createdAt = new Date(baseDate.getTime() + (data.length - index)); // +1 ms per row;
                return [update.name,
                update.barcode,
                update.defaultPrice,
                update.description,
                update.categoryId,
                update.tags && Array.isArray(update.tags) ? `{${update.tags.join(',')}}` : null,
                update.type,
                update.warning,
                update.UOM,
                update.unitCost,
                company.id,
                update.commissionPercentage,
                update.commissionAmount,
                update.isDiscountable,
                    createdAt,
                update.serviceTime,
                    false,
                update.taxId,
                    createdAt,
                update.translation,
                update.brandid,
                update.kitchenName,
                update.isTaxable,
                update.sku,
                update.categoryIndex
                ]
            });

            let query = `INSERT INTO "Products"
                                    (name,
                                    "barcode",
                                    "defaultPrice",
                                    description,
                                    "categoryId",
                                    tags,
                                    type,
                                    warning,
                                    "UOM",
                                    "unitCost",
                                    "companyId",
                                    "commissionPercentage",
                                    "commissionAmount",
                                    "isDiscountable",
                                    "updatedDate",
                                    "serviceTime",
                                    "isDeleted",
                                    "taxId",
                                    "createdAt",
                                    "translation",
                                    "brandid",
                                    "kitchenName",
                                    "isTaxable",
                                    "sku",
                                "categoryIndex")
                                    VALUES %L
                                    RETURNING  id,name,"unitCost"
                     `

            const formattedQuery = format(query, transactionValues);
            let insertedProducts = await client.query(formattedQuery);
            if (insertedProducts && insertedProducts.rows.length > 0) {
                const branchProducts = insertedProducts.rows.flatMap(p =>
                    branches.map(b => ({
                        productId: p.id,
                        branchId: b,
                        companyId: company.id,
                        openingBalanceCost: p.unitCost
                    }))
                );
                const transactionValues = branchProducts.map((update: any) => [update.productId, update.branchId, update.companyId, update.openingBalanceCost])
                query = `INSERT INTO "BranchProducts" ("productId","branchId","companyId","openingBalanceCost") 
                                    VALUES %L
                                   `
                const formattedQuery = format(query, transactionValues);
                await client.query(formattedQuery);
                let productWithBarcodes = data.filter((f: any) => f.barcodes && f.barcodes.length > 0)
                if (productWithBarcodes && productWithBarcodes.length > 0) {
                    let barcodes = productWithBarcodes.flatMap((temp: any) => {
                        let pro = insertedProducts.rows.find(f => f.name === temp.name);

                        return temp.barcodes.map((barcode: any) => ({
                            barcode: barcode.barcode,
                            productId: pro.id,
                            companyId: company.id
                        }));
                    });


                    await this.manageProductBarcodes(client, barcodes)

                }
            }


            return insertedProducts.rows.map(p => { return p.id }) ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async updateProducts(client: PoolClient, data: any, company: Company) {
        try {
            const updateValues = data.map((u: any) => [
                u.barcode ?? null,                   // $1
                u.defaultPrice ?? null,              // $2
                u.description ?? null,               // $3
                u.categoryId ?? null,                // $4
                u.tags && Array.isArray(u.tags) ? `{${u.tags.join(',')}}` : null,        // $5 (assuming jsonb column)
                u.warning ?? null,                   // $6
                u.UOM ?? null,                       // $7
                u.commissionPercentage ?? null,      // $9
                u.commissionAmount ?? null,          // $10
                u.isDiscountable ?? null,            // $11
                new Date(),            // $12
                u.serviceTime ?? null,               // $13
                false,                               // $14
                u.taxId ?? null,                     // $15
                u.translation ?? null, // $16 (jsonb)
                u.brandid ?? null,                   // $17
                u.sku ?? null,                       // $18
                u.kitchenName ?? null,               // $19
                u.name ?? null,                      // $20
                u.id                                 // $21
            ]);
            const query = format(`
            UPDATE "Products" AS p
            SET
                "barcode"              = v.barcode,
                "defaultPrice"         = v.defaultPrice::numeric,
                description            = v.description,
                "categoryId"           = v.categoryId::uuid,
                tags                   = string_to_array(v.tags, ',')::varchar[],
                warning                = v.warning,
                "UOM"                  = v.UOM,
                "commissionPercentage" = v.commissionPercentage::boolean,
                "commissionAmount"     = v.commissionAmount::numeric,
                "isDiscountable"       = v.isDiscountable::boolean,
                "updatedDate"          = v.updatedDate::timestamp,
                "serviceTime"          = v.serviceTime::int,
                "isDeleted"            = v.isDeleted::boolean,
                "taxId"                = v.taxId::uuid,
                "translation"          = v.translation::jsonb,
                "brandid"              = v.brandid::uuid,
                "sku"                  = case when "p"."productMatrixId" is null then v.sku else  "p"."sku"  end  ,
                "kitchenName"          = v.kitchenName,
                "name"                 = v.name
                FROM (VALUES %L) AS v(
                barcode,
                defaultPrice,
                description,
                categoryId,
                tags,
                warning,
                UOM,
                commissionPercentage,
                commissionAmount,
                isDiscountable,
                updatedDate,
                serviceTime,
                isDeleted,
                taxId,
                translation,
                brandid,
                sku,
                kitchenName,
                name,
                id
            )
            WHERE p.id::text = v.id
            `, updateValues);

            await client.query(query);
            let productWithBarcodes = data.filter((f: any) => f.barcodes && f.barcodes.length > 0)
            if (productWithBarcodes && productWithBarcodes.length > 0) {
                let barcodes = productWithBarcodes.flatMap((temp: any) =>
                    temp.barcodes.map((barcode: any) => ({
                        barcode: barcode.barcode,
                        productId: temp.id,
                        companyId: company.id
                    }))
                );

                await this.manageProductBarcodes(client, barcodes)

            }



        } catch (error: any) {
            throw new Error(error)
        }
    }


}