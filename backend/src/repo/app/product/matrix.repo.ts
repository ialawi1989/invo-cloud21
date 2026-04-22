import { DB } from "@src/dbconnection/dbconnection";
import { BranchProducts } from "@src/models/product/BranchProducts";

import { Product } from "@src/models/product/Product";
import { ProductMatrix } from "@src/models/product/ProductMatrix";
import { ResponseData } from "@src/models/ResponseData";

import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { PoolClient } from "pg";
import { BranchProductsRepo } from "./branchProduct.repo";

import { ProductRepo } from "./product.repo";


import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { Dimension } from "@src/models/product/Dimension";
import { after } from "lodash";
import { ProductDimensionRepo } from "./productDimensions.repo";


export class MatrixRepo {

    public static async checkIfMatrixNameExists(client: PoolClient, productId: string | null, name: string, companyId: string) {

        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "ProductMatrix" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                productId,
                companyId,
            ],
        };
        if (productId == null) {
            query.text = `SELECT count(*) as qty FROM "ProductMatrix" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;



    }

    public static async updateTranslation(data: any) {
        try {
            const query: { text: string } = {
                text: `UPDATE "ProductMatrix" SET  translation=$2 WHERE id=$1;`
            }

            data.list.forEach(async (element: { id: any; translation: any; }) => {
                await DB.excu.query(query.text, [element.id, element.translation]);
            });

            return new ResponseData(true, "nope", [])
        } catch (error: any) {

            console.log(error);
          
            throw new Error(error)
        }
    }

    public static async checkIfMatrixBarcodeExists(client: PoolClient, productId: string | null, barcode: string, companyId: string) {
        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "ProductMatrix" where barcode = $1 and id <> $2 and "companyId" = $3`,
            values: [
                barcode,
                productId,
                companyId,
            ],
        };
        if (productId == null) {
            query.text = `SELECT count(*) as qty FROM "ProductMatrix" where barcode = $1 and "companyId" = $2`;
            query.values = [barcode, companyId];
        }
        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;

    }

    public static async addMatrix(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            //######### parse Data ##########
            const matrix: ProductMatrix = new ProductMatrix();
            matrix.ParseJson(data);

            matrix.companyId = company.id;
            matrix.defaultPrice = +(matrix.defaultPrice).toFixed(company.afterDecimal)

            //######### Data Validations ##########
            const validate = await ProductValidation.AddMatrixValidation2(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error)
            }

            const isNameExists = await this.checkIfMatrixNameExists(client, null, matrix.name, matrix.companyId);
            if (isNameExists) {
                throw new ValidationException("Matrix name already used.");
            }

            const isBarcodeExists = await this.checkIfMatrixBarcodeExists(client, null, matrix.barcode, matrix.companyId);
            if (isBarcodeExists) {
                throw new ValidationException("Matrix barcode already used.");
            }

            const generatedSKUs = this.generateSkusWithFlatAttributes(matrix.barcode, matrix.dimensions);
            if (generatedSKUs.length !== matrix.products.length) {
                throw new ValidationException(`Matrix must have ${generatedSKUs.length} products, but got ${matrix.products.length}.`);
            }

            const availableSKUMap = new Map(generatedSKUs.map(sku => [sku.sku, sku.attributes]));

            //#########  Insert new dimension and attributes ##########
            for (const dim of matrix.dimensions) {
                // If dimension has no ID, insert it
                if (!dim.id) {
                    const dimInsert = await ProductDimensionRepo.addDimension(client, dim, company.id);
                    dim.id = dimInsert.id;
                }

                // Loop through attributes of the dimension
                for (const attr of dim.attributes) {
                    if (!attr.id) {
                        attr.dimensionId = dim.id;
                        const attrInsert = await ProductDimensionRepo.addDimensionAttribute(client, attr, company.id, true);
                        attr.id = attrInsert.id;
                    }
                }
            }

            //#########  Insert Product Matrix ##########

            const query: { text: string, values: any } = {
                text: `INSERT INTO "ProductMatrix" 
                        (name, barcode, dimensions, "companyId", "defaultPrice", "unitCost", "mediaId", translation) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                values: [
                    matrix.name,
                    matrix.barcode,
                    JSON.stringify(matrix.dimensions),
                    matrix.companyId,
                    matrix.defaultPrice,
                    matrix.unitCost,
                    matrix.mediaId,
                    matrix.translation],
            };

            const insert = await client.query(query.text, query.values);
            if (insert.rows.length < 1) { throw new ValidationException(`Add Matrix faild`) }
            matrix.id = insert.rows[0].id;

            //#########  Insert Associated Products ##########
            const productIds: any[] = [];
            const matrixProducts: Product[] = []

            for (let index = 0; index < matrix.products.length; index++) {

                const product: any = matrix.products[index];
                const attributes = availableSKUMap.get(product.sku);
                if (!attributes) {
                    throw new ValidationException("Invalid or duplicate SKU: " + product.sku);
                }
                availableSKUMap.delete(product.sku);

                // Populate product data
                product.productAttributes = attributes;
                product.unitCost = matrix.unitCost;
                product.defaultPrice = matrix.defaultPrice;
                product.companyId = matrix.companyId;
                product.productMatrixId = matrix.id;
                product.createdAt = new Date();

                const tags = [product.attribute1, product.attribute2, product.attribute3].filter(tag => tag && tag !== "");
                product.tags = tags;

                const productId = await this.addInventoryProduct(client, product, company.afterDecimal, employeeId);
                if (productId) { productIds.push(productId) }

                const matrixProduct: any = {
                    productId: productId,
                    attributes: product.productAttributes,
                    attribute1: product.attribute1,
                    attribute2: product.attribute2,
                    attribute3: product.attribute3,
                }
                matrixProducts.push(matrixProduct)
            }

            //#########  Update Matrix Product ##########
            const updateQuery = {
                text: `UPDATE "ProductMatrix" SET products =$1,"defaultImage"=$2 WHERE id = $3 AND "companyId"= $4`,
                values: [
                    JSON.stringify(matrixProducts),
                    matrix.defaultImage,
                    matrix.id,
                    matrix.companyId,
                ],
            };
            const update = await client.query(updateQuery.text, updateQuery.values)

            await client.query("COMMIT")
            return new ResponseData(true, "Added Successfullly", { id: matrix.id, productIds: productIds })

        } catch (error: any) {
            await client.query("ROLLBACK")
          
            if (error instanceof ValidationException) {
                throw error;
            }
            throw new Error("An unexpected error occurred while adding the matrix.");
        } finally {
            client.release();
        }

    }

    public static async updateMatrix(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            //######### Data Validations ##########
            const matrixId = data.id;
            const companyId = company.id
            const afterDecimal = company.afterDecimal
            const currencySymbol= company.currencySymbol
            if (!matrixId) {
                throw new ValidationException("Matrix ID is required for editing.");
            }

            const oldMatrix = await this.getOldMatrix(matrixId, companyId)

            if (!oldMatrix) {
                throw new ValidationException("Matrix not found.");
            }

            const matrix: ProductMatrix = new ProductMatrix();
            matrix.ParseJson(data);
            matrix.companyId = companyId;

            const validate = await ProductValidation.AddMatrixValidation2(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const isNameExists = await this.checkIfMatrixNameExists(client, matrix.id, matrix.name, matrix.companyId);
            if (isNameExists) {
                throw new ValidationException("Matrix Name Already used");
            }

            const isBarcodeExists = await this.checkIfMatrixBarcodeExists(client, matrix.id, matrix.barcode, matrix.companyId);
            if (isBarcodeExists) {
                throw new ValidationException("Matrix Barcode  Already used");
            }

            let updateProductsSku = false

            const generatedSKUs = this.generateSkusWithFlatAttributes(matrix.barcode, matrix.dimensions);
            if (generatedSKUs.length !== matrix.products.length) {
                throw new ValidationException(`Matrix must have ${generatedSKUs.length} products, but got ${matrix.products.length}.`);
            }

            const availableSKUMap = new Map(generatedSKUs.map(sku => [sku.sku, sku.attributes]));
            if (oldMatrix.barcode !== matrix.barcode) {
                const generatedSKUs = this.generateSkusWithFlatAttributes(matrix.barcode, matrix.dimensions);

                const expectedCount = generatedSKUs.length;
                const actualCount = matrix.products.length;

                if (expectedCount !== actualCount) {
                    throw new ValidationException(`Matrix must have ${expectedCount} products, but got ${actualCount}.`);
                }

                const expectedSKUSet = new Set(generatedSKUs.map(s => s.sku));

                for (let product of matrix.products as { sku: string }[]) {
                    if (!expectedSKUSet.delete(product.sku)) {
                        throw new ValidationException(`Invalid or duplicate SKU: ${product.sku}`);
                    }
                }
                updateProductsSku = true

            }
            if(matrix.dimensions.length != oldMatrix.dimensions.length)
            {
                  throw new ValidationException("Cannot Add Dimension to an Existing Matrix")
            }
            // matrix.dimensions = oldMatrix.dimensions


            for (const dim of matrix.dimensions) {
                // If dimension has no ID, insert it
                if (!dim.id) {
                    const dimInsert = await ProductDimensionRepo.addDimension(client, dim, company.id);
                    dim.id = dimInsert.id;
                }

                // Loop through attributes of the dimension
                for (const attr of dim.attributes) {
                    if (!attr.id) {
                        attr.dimensionId = dim.id;
                        const attrInsert = await ProductDimensionRepo.addDimensionAttribute(client, attr, company.id, true);
                        attr.id = attrInsert.id;
                    }
                }
            }


            const productIds: any[] = [];
            const matrixProducts: Product[] = []


            //#########  Update Associated Products ##########
            let barcodeQuery = data.updateProductsBarcode == true ? ',barcode = $7 ' : ''
            for (let index = 0; index < matrix.products.length; index++) {
                const branchProduct = new BranchProducts()
                const product: any = matrix.products[index];

                const attributes = availableSKUMap.get(product.sku);
                if (!attributes) {
                    throw new ValidationException("Invalid or duplicate SKU: " + product.sku);
                }
                availableSKUMap.delete(product.sku);

                // let  imageUrl;
                // if(matrix.base64Image!= null)
                // {
                //     const storage =new FileStorage();
                //      imageUrl = await storage.saveItemImage(matrix.base64Image,matrix.companyId,matrix.id)  
                // }
                if (product.id) {


                    const productquery: { text: string, values: any[] } = {
                        text: `UPDATE "Products" SET "defaultPrice"=$3 ,"UOM"=$4,"unitCost"=$5, sku = COALESCE($6,sku) ${barcodeQuery} WHERE "companyId"=$1 AND id=$2`,
                        values: [
                            companyId,
                            product.id,
                            matrix.defaultPrice,
                            "Piece",
                            matrix.unitCost,
                            updateProductsSku == true ? product.sku : null
                        ]
                    };

                    if (data.updateProductsBarcode == true) { productquery.values.push(product.barcode) }
                    await client.query(productquery.text, productquery.values);

                    for (let index = 0; index < product.branchProduct.length; index++) {
                        const branch = product.branchProduct[index];
                        branchProduct.id = branch.id
                        branchProduct.onHand = branch.onHand;
                        branchProduct.available = true;
                        branchProduct.branchId = branch.branchId;
                        branchProduct.productId = product.id;
                        branchProduct.price = branch.price;
                        const price = (branch.price == null || branch.price == 0) ? +matrix.defaultPrice.toFixed(afterDecimal) : +branch.price.toFixed(afterDecimal)
                        await BranchProductsRepo.editBranchProduct(client, branchProduct, companyId, afterDecimal, price, employeeId, currencySymbol)
                    }
                } else {
                    product.productAttributes = attributes;
                    product.unitCost = matrix.unitCost;
                    product.defaultPrice = matrix.defaultPrice;
                    product.companyId = matrix.companyId;
                    product.productMatrixId = matrix.id;
                    product.createdAt = new Date();

                    const tags = [product.attribute1, product.attribute2, product.attribute3].filter(tag => tag && tag !== "");
                    product.tags = tags;

                    const productId = await this.addInventoryProduct(client, product, company.afterDecimal, employeeId);
                    if (productId) { productIds.push(productId) }

                    const matrixProduct: any = {
                        productId: productId,
                        attributes: product.productAttributes,
                        attribute1: product.attribute1,
                        attribute2: product.attribute2,
                        attribute3: product.attribute3,
                    }
                    matrixProducts.push(matrixProduct)
                }
            }

            //######### Update Product Matrix ##########

            const query: { text: string, values: any } = {
                text: `UPDATE "ProductMatrix" SET 
                        name=$1,
                        barcode=$2 ,
                        "defaultPrice" =$3,
                        "unitCost"=$4,
                        "mediaId"=$5,
                        "translation"=$6 ,
                        dimensions = $7,
                        "products" = "products" || $8::jsonb
                        WHERE "companyId"=$9 AND id=$10`,
                values: [
                    matrix.name,
                    matrix.barcode,
                    matrix.defaultPrice,
                    matrix.unitCost,
                    matrix.mediaId,
                    matrix.translation,
                    JSON.stringify(matrix.dimensions),
                    JSON.stringify(matrixProducts),
                    matrix.companyId,
                    matrix.id
                ]
            };
            await client.query(query.text, query.values);
            // if (matrix.base64Image != "") {
            //     const storage = new FileStorage();
            //     const imageUrl = await storage.saveItemImage(matrix.base64Image, matrix.companyId, matrix.id)
            //     query.text = `UPDATE "ProductMatrix" SET "defaultImage"=$1 WHERE id =$2 AND "companyId"=$3 `
            //     query.values = [imageUrl, matrix.id, matrix.companyId]
            // }
            await client.query("COMMIT")
            return new ResponseData(true, "Updated Successfully", {productIds:productIds})

        } catch (error: any) {
            await client.query("ROLLBACK")
          
            if (error instanceof ValidationException) {
                throw error;
            }
            throw new Error("An unexpected error occurred while editing the matrix. " + error);
        } finally {
            client.release();
        }

    }

    public static async getMatix(matixId: string, company: Company) {
        const client = await DB.excu.client();

        try {
            await client.query("BEGIN")
            //branchProduct
            //products

            const companyId = company.id
            const query: { text: string, values: any } = {
                text: `SELECT
                "ProductMatrix".barcode,
                "ProductMatrix"."defaultImage",
                "ProductMatrix"."defaultPrice",
                "ProductMatrix"."unitCost",
                "ProductMatrix".dimensions,
                "ProductMatrix".products as "matrixProducts",
                "ProductMatrix".id,
                "ProductMatrix".translation,
                "ProductMatrix"."name",
                "Media".id as "mediaId",
                "Media".url as "mediaUrl"
               FROM "ProductMatrix"
               left join "Media" on "Media".id = "ProductMatrix"."mediaId"
               WHERE 
               "ProductMatrix".id=$1 AND "ProductMatrix"."companyId"=$2`,
                values: [
                    matixId,
                    companyId
                ],
            };
            const matrix = await client.query(query.text, query.values);

            let matrixData: any = matrix.rows[0];

            query.text = `SELECT id,name,"defaultPrice",barcode,sku from "Products" where "productMatrixId" = $1`;
            query.values = [matixId]

            let products: any = (await client.query(query.text, query.values)).rows;

            for (let index = 0; index < products.length; index++) {
                const element = products[index];

                query.text = `SELECT id,available,"onHand",price,"branchId" from "BranchProducts" where "productId"= $1 `
                query.values = [element.id]
                let branches = (await client.query(query.text, query.values)).rows
                products[index].branchProduct = branches
            }

            matrixData.products = products
            await client.query("COMMIT")

            return new ResponseData(true, "", matrixData);
        } catch (error: any) {
            await client.query("ROLLBACK")

          
            throw new Error(error);
        } finally {
            client.release()
        }
    }

    public static async getAllCompnayMatrix(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "ProductMatrix" WHERE "companyId"=$1`,
                values: [
                    companyId
                ]
            };
            const matrix = await DB.excu.query(query.text, query.values);

            const data = {
                list: matrix.rows
            }
            return new ResponseData(true, "", data);
        } catch (error: any) {
          
            throw new Error(error);
        }
    }

    public static async getAllCompnayMatrixFilter(data: any, company: Company) {
        try {
            const companyId = company.id


            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';


            let sort = data.sortBy;
            let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm

            if (data.searchTerm != "" && data.searchTerm != null) {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
            }

            let offset = 0;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query: { text: string, values: any } = {
                text: `SELECT count(*) over(), 
                            id,
                            name,
                            barcode,
                            "translation",
                            "defaultPrice"
                    FROM "ProductMatrix"
                    where "companyId"=$1
                    and (LOWER("ProductMatrix".name) ~ $2
                            OR LOWER("ProductMatrix".barcode) ~ $2)
                            ${orderByQuery}
                            limit $3 offset $4
                            `,
                values: [company.id, searchValue, limit, offset]
            }

            let list = await DB.excu.query(query.text, query.values);
            let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (list.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            const resData = {
                list: list.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }


            return new ResponseData(true, "", resData)

        } catch (error: any) {
          
            return new ResponseData(false, error, null)
        }
    }


    public static async addInventoryProduct(client: PoolClient, product: Product, afterDecimal: number, employeeId: string) {
        try {


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


            product.tags
            const productquery: { text: string, values: any } = {
                text: `INSERT INTO "Products"
          (name, "barcode", "defaultPrice",
          type,"companyId", "productMatrixId","unitCost","UOM",tags, sku) 
          VALUES($1, $2, $3, $4, $5,$6,$7,$8,$9, $10) RETURNING id`,
                values: [
                    product.name,
                    product.barcode,
                    product.defaultPrice,
                    'inventory',
                    product.companyId,
                    product.productMatrixId,
                    product.unitCost,
                    'Piece',
                    product.tags,
                    product.sku
                ]
            };

            const insertProduct = await client.query(productquery.text, productquery.values);
            const productId = (<any>insertProduct.rows[0]).id


            // const companyBranches = await BranchesRepo.getBranchList(product.companyId);
            // const branches = companyBranches.data;

            // 
            for (let index = 0; index < product.branchProduct.length; index++) {
                const branchProduct = new BranchProducts();
                const element = product.branchProduct[index];

                branchProduct.openingBalance = element.openingBalance;
                branchProduct.openingBalanceCost = element.openingBalanceCost;
                branchProduct.available = true;
                branchProduct.branchId = element.branchId;
                branchProduct.productId = productId;
                branchProduct.price = element.price;
                const price = (branchProduct.price == null || branchProduct.price == 0) ? +product.defaultPrice.toFixed(afterDecimal) : +branchProduct.price.toFixed(afterDecimal)

                await BranchProductsRepo.addProductToBranch(client, branchProduct, 'inventory', product.companyId, afterDecimal, price, employeeId)


            }
            // if(product.base64Image != null || product.base64Image != "" ){
            //     const storage = new FileStorage();
            //     const imageUrl = await storage.saveItemImage(product.base64Image,product.companyId,productId);
            //     await ProductRepo.updateProductSDeafultImage(productId,imageUrl,client)
            // }
            return productId
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    // ###################### Helper Functions ######################
    public static generateProductSKUs(barcode: string, dimensions: Dimension[], attributes: any[]): string {
        if (!barcode || !dimensions?.length || !attributes?.length) {
            throw new Error("Barcode, dimensions, and attributes are required.");
        }

        // Flatten all attribute codes by name for quick lookup
        const codeMap = new Map<string, string>();

        dimensions.forEach(dimension => {
            dimension.attributes.forEach(attr => {
                codeMap.set(attr.name.toLowerCase(), attr.code.toLowerCase());
            });
        });

        console.log(codeMap)

        // Process each product

        const codes: string[] = [];

        for (const attr of attributes) {
            if (!attr) continue;
            const code = codeMap.get(attr.toLowerCase());
            if (code) {
                codes.push(code.toUpperCase());
            }
        }

        // Create SKU: barcode-CODE1-CODE2...
        const sku = `${barcode}-${codes.join('-')}`;
        return sku
    }

    public static generateSkusWithFlatAttributes(barcode: string, dimensions: Dimension[]) {
        type SkuWithFlatAttributes = {
            sku: string;
            attributes: Record<string, string>; // e.g., { color: "b", size: "s" }
        };

        const result: SkuWithFlatAttributes[] = [];

        function combine(index: number, codeParts: string[], attributeMap: Record<string, string>) {
            if (index === dimensions.length) {
                result.push({
                    sku: `${barcode}_${codeParts.join('_')}`,
                    attributes: { ...attributeMap }
                });
                return;
            }

            const dimension = dimensions[index];
            for (const attr of dimension.attributes) {
                combine(
                    index + 1,
                    [...codeParts, attr.code],
                    { ...attributeMap, [dimension.name]: attr.code }
                );
            }
        }

        combine(0, [], {});
        return result;
    }

    public static createVariantIndex(
        dimensions: Dimension[],
        variants: any[]
    ) {
        const byKey: Record<string, number> = {};
        const byAttr: Record<string, number[]> = {};

        variants.forEach((variant, index) => {
            // Index the variant by its unique key
            byKey[variant.id] = index;

            // For each dimension, index by attribute code
            for (const dimension of dimensions) {
                const dimName = dimension.name;
                const attrCode = variant.attributes[dimName];

                if (attrCode) {
                    const attrKey = `${dimName}:${attrCode}`;

                    if (!byAttr[attrKey]) {
                        byAttr[attrKey] = [];
                    }

                    byAttr[attrKey].push(index);
                }
            }
        });

        return { byKey, byAttr };
    }

    public static async getOldMatrix(matixId: string, companyId: string) {

        try {
            let matrixData
            const query: { text: string, values: any } = {
                text: `SELECT
                "ProductMatrix".barcode,
                "ProductMatrix"."defaultImage",
                "ProductMatrix"."defaultPrice",
                "ProductMatrix"."unitCost",
                "ProductMatrix".dimensions,
                "ProductMatrix".products as "matrixProducts",
                "ProductMatrix".id,
                "ProductMatrix".translation,
                "ProductMatrix"."name",
                "Media".id as "mediaId",
                "Media".url as "mediaUrl"
               FROM "ProductMatrix"
               left join "Media" on "Media".id = "ProductMatrix"."mediaId"
               WHERE 
               "ProductMatrix".id=$1 AND "ProductMatrix"."companyId"=$2`,
                values: [
                    matixId,
                    companyId
                ],
            };
            const matrix = await DB.excu.query(query.text, query.values);
            if (matrix.rows && matrix.rows.length > 0) {
                matrixData = matrix.rows[0]
            }

            return matrixData;
        } catch (error: any) {
          
            throw new Error(error);
        }
    }


}