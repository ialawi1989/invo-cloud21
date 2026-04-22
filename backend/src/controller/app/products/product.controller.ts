import { FileStorage } from '@src/utilts/fileStorage';
import fs from 'fs';

import { Product } from '@src/models/product/Product';

import { ResponseData } from '@src/models/ResponseData';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { BranchProductsRepo } from '@src/repo/app/product/branchProduct.repo';
import { BatchProductRepo } from '@src/repo/app/product/productTypes/batchProduct.reps';
import { InventoryProductRepo } from '@src/repo/app/product/productTypes/inventoryProduct.repo';
import { KitProductRepo } from '@src/repo/app/product/productTypes/kitProduct.repo';
import { MenuItemProductRepo } from '@src/repo/app/product/productTypes/menuItemProduct.repo';
import { MenuSelectionProductRepo } from '@src/repo/app/product/productTypes/menuSelectionProduct.repo';
import { PackageProductRepo } from '@src/repo/app/product/productTypes/packageProduct.repo';
import { SerialProductRepo } from '@src/repo/app/product/productTypes/serilizedProduct.repo';
import { ServiceProductRepo } from '@src/repo/app/product/productTypes/serviceProduct.repo';

import { Request, Response, NextFunction } from 'express';

import { DB } from '@src/dbconnection/dbconnection';


import { MatrixRepo } from '@src/repo/app/product/matrix.repo';
import { DepartmentRepo } from '@src/repo/app/product/department.repo';
import { CategoryRepo } from '@src/repo/app/product/category.repo';
import { Department } from '@src/models/product/Department';
import { Category } from '@src/models/product/Category';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Company } from '@src/models/admin/company';
import { PoolClient } from 'pg';
import { TaxesRepo } from '@src/repo/app/accounts/taxes.repo';
import { is } from 'bluebird';
import { BranchController } from '@src/controller/admin/branch.controller';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { BranchProducts } from '@src/models/product/BranchProducts';
import { SocketProductRepo } from '@src/repo/socket/product.socket';
import { Log } from '@src/models/log';
import { Brands } from '@src/models/product/brands';
import { RedisClient } from '@src/redisClient';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { TailoringProduct } from '@src/repo/app/product/productTypes/tailoring.repo';
import { ThemeRepo } from '@src/repo/ecommerce/theme.repo';
import crypto from 'crypto'
import { InventoryMovmentTrigger } from '@src/repo/triggers/inventoryMovmentTrigger';
import { UnitCostQueue } from '@src/repo/triggers/UnitCostQueue';
import { ImportProductsRepo } from './importProducts';
import { QuickRecipeManagment } from '@src/repo/app/product/quickRecipeManagment.repo';
import { OptionRepo } from '@src/repo/app/product/option.repo';
import { LogsManagmentRepo } from '@src/repo/app/settings/LogSetting.repo';
import { MediaRepo } from '@src/repo/app/settings/media.repo';
//import { BranchProductsRepo } from '@src/repo/callCenter/product/branchProduct.repo';


interface RecipeRow {
    barcode: string;
    productName: string;
    recipeItemBarcode: string;
    recipeItemSku: string;
    recipeItemName: string;
    UOM: string;
    usages: number;
}

export interface GroupedRecipe {
    barcode: string;
    productName: string;
    recipe: {
        barcode: string;
        sku: string;
        name: string;
        UOM: string;
        usages: number;
    }[];
}
export class ProductController {

    public static async testGetImages(req: Request, res: Response, next: NextFunction) {
        try {


            const data = req.body;
            const product = await SocketProductRepo.getProductsImages(data, data.branchId);

            return res.send(product)


        } catch (error: any) {
            throw error
        }
    }



    public static async getProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params['id'];
            const company = res.locals.company;

            if (id == null || id == "null") {
                return res.send("Product Id is Required")
            }
            const product = await ProductRepo.getProduct(id, company);

            return res.send(product)


        } catch (error: any) {
            throw error
        }
    }

    public static async getProductBranchData(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const data = req.body;
            const company = res.locals.company;
            // const product = await ProductRepo.getProduct(id, company);
            const product = await ProductRepo.getProductBranchData(client, data.productId, data.branchId)
            await client.query("COMMIT")
            return res.send(product)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }

    public static async getProductByBarcode(req: Request, res: Response, next: NextFunction) {
        try {
            const barcode = req.params['barcode'];
            const branchId = req.params['branchId'];
            const company = res.locals.company;


            const product = await ProductRepo.getProductByBarcode(branchId, barcode, company);

            return res.send(product)


        } catch (error: any) {
            throw error
        }
    }

    public static async getBarcodesProducts(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const data = req.body
            const product = await ProductRepo.getBarcodesProducts(data, company);

            return res.send(product)


        } catch (error: any) {
            throw error
        }
    }

    public static async searchByBarcodes(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const data = req.body
            const product = await ProductRepo.searchByBarcodes(data, company);
            return res.send(product)

        } catch (error: any) {
            throw error
        }
    }

    public static async getCategoryProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params['id'];
            const company = res.locals.company;

            if (id == null || id == "null") {
                return res.send("Category Id is Required")
            }
            const product = await ProductRepo.getCategoryProducts(id, company);

            return res.send(product)


        } catch (error: any) {
            throw error
        }
    }

    public static async getProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.listProductFilter(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }

    public static async getProductListForBulk(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.listProductFilter2(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }

    public static async getNonBrandedProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.listProductFilterNonBranded(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }


    public static async getUnCategoriesedProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.getUnCategoriesedProductList(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }
    // public static async exprotProducts(req: Request, res: Response, next: NextFunction) {
    //     try {
    //         const company = res.locals.company
    //         const data = req.body;
    //         let resault;
    //         resault = await ProductRepo.exprotProducts(company);
    //         return res.send(resault)
    //     } catch (error: any) {

    //         throw error
    //     }

    // }





    public static async exprotProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const result = await ProductRepo.exprotProducts(company);

            // Send the file as a response
            res.set('Content-Disposition', 'attachment; filename="products.csv"');
            res.set('Content-Type', 'text/csv');

            const fileStream = fs.createReadStream(company.id + 'products.csv');
            fileStream.pipe(res);

            res.on('finish', () => {
                fs.unlinkSync(company.id + 'products.csv');
            });
        } catch (error: any) {
            throw error;
        }
    }










    public static async getInventoryProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const list = await InventoryProductRepo.listInventoryProducts(data, company);
            return res.send(list)
        } catch (error: any) {
            throw error
        }

    }

    public static async getInventoryChildProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const list = await InventoryProductRepo.getInventoryChildProducts(data, company);
            return res.send(list)
        } catch (error: any) {
            throw error
        }

    }


    public static async getChildProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await InventoryProductRepo.getChildProductList(data, company);
            return res.send(list)
        } catch (error: any) {
            throw error
        }

    }


    public static async getProductsListByType(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await ProductRepo.getListOfProductsbyType(company, data);
            return res.send(list)
        } catch (error: any) {
            throw error
        }

    }

    public static async getProductsListForSupplier(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await ProductRepo.getProductsListForSupplier(company, data);
            return res.send(list)
        } catch (error: any) {
            throw error
        }

    }

    public static async checkProductBarcodes(client: PoolClient, barcodes: any[], companyId: string, productId: string = '') {
        try {
            const query: { name: string, text: string, values: any } = {
                name: "checkProductBarcodes",
                text: `select count(*) from "Products" 
                left join "ProductBarcodes" on "ProductBarcodes"."productId" = "Products"."id" 
                where "Products"."companyId" = $2 and ("Products"."barcode" = any($1) or "ProductBarcodes".barcode = any($1))
                and "Products".id::text <> $3` ,
                values: [barcodes, companyId, productId]
            }

            let product = await client.query(query.text, query.values);

            if (product.rows && product.rows.length > 0, product.rows[0].count > 0) {
                return true
            }

            return false

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async getMenuProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const types: any[] = ["inventory", "kit", "batch", "serialized", "menuItem", "menuSelection"]

            let sections = await ThemeRepo.getMenuProducts(data, company, types)
            res.send(sections)
        } catch (error: any) {
            throw error
        }
    }
    // public static async importProducts(req: Request, res: Response, next: NextFunction) {
    //     const client = await DB.excu.client(500);
    //     try {
    //         let errors = [];
    //         await client.query("BEGIN")
    //         const data = req.body;

    //         const company = res.locals.company;
    //         const companyId = company.id;
    //         const employeeId = res.locals.user;
    //         let branchProducts: BranchProducts[] = [];
    //         const branches = await BranchesRepo.getCompanyBranchIds(client, company.id);
    //         branches.forEach((branchId: any) => {
    //             let brancProduct = new BranchProducts();
    //             brancProduct.branchId = branchId
    //             branchProducts.push(brancProduct)
    //         });
    //         let taxId = (await TaxesRepo.getDefaultTax(client, company.id)).data.id;
    //         let brands = [];
    //         let departments = [];
    //         let categories = [];


    //         for (let index = 0; index < data.length; index++) {
    //             console.log(((index / data.length) * 100) + "%")
    //             const element: Product = data[index];
    //             element.taxId = taxId;
    //             element.branchProduct = branchProducts;
    //             element.companyId = companyId;
    //             element.id = await ProductRepo.getProductIdByName(client, element.name, companyId)

    //             let barcodes: any[] = []
    //             barcodes.push(element.barcode)


    //             if (element.barcodes && element.barcodes.length > 0) {
    //                 element.barcodes.forEach((element) => {
    //                     barcodes.push(element.barcode);
    //                 });
    //             }
    //             const isBarcodeExist = await ProductController.checkProductBarcodes(client, barcodes, companyId, element.id)
    //             if (isBarcodeExist) {
    //                 errors.push({ productName: element.name, error: "barcode already used" })
    //                 continue;
    //             }
    //             // if (element.departmentName != "" && element.departmentName != null && element.categoryName != "" && element.categoryName != null) {
    //             //     let categoryRes = categories.find(f => f.name == element.categoryName);
    //             //     if (categoryRes !== undefined) {
    //             //         element.categoryId = categoryRes.id;
    //             //     } else {
    //             //         const categoryId: any = await CategoryRepo.getCategoryIdByName(client, element.categoryName.trim(), companyId);
    //             //         if (categoryId.id == null) {
    //             //             let departmentId: any = null;
    //             //             let departmentRes = departments.find(f => f.name == element.departmentName);
    //             //             if (departmentRes !== undefined) {
    //             //                 departmentId = departmentRes.id;
    //             //             } else {
    //             //                 departmentId = (await DepartmentRepo.getDepartmentId(client, element.departmentName, companyId)).id;
    //             //             }

    //             //             if (departmentId == null) {
    //             //                 const department = new Department();
    //             //                 department.companyId = companyId;
    //             //                 department.name = element.departmentName;
    //             //                 departmentId = (await DepartmentRepo.addDepartment(client, department, company)).data.id;
    //             //                 departments.push({ id: departmentId, name: element.departmentName });
    //             //             }
    //             //             element.departmentId = departmentId;

    //             //             const category = new Category();
    //             //             category.companyId = companyId;
    //             //             category.name = element.categoryName;
    //             //             category.departmentId = departmentId;
    //             //             const categoryId = await CategoryRepo.addCategory(client, category, company);
    //             //             element.categoryId = categoryId.data.id;
    //             //             categories.push({ id: element.categoryId, name: element.categoryName });
    //             //         } else {
    //             //             element.categoryId = categoryId.id;
    //             //             categories.push({ id: element.categoryId, name: element.categoryName });
    //             //         }
    //             //     }
    //             // }


    //             // if (element.brand != "" && element.brand != null) {
    //             //     //check local array
    //             //     let brandRes = brands.find(f => f.name == element.brand);
    //             //     if (brandRes !== undefined) {
    //             //         element.brandid = brandRes.id;
    //             //     } else {
    //             //         let brandId = await ProductRepo.getBrandIdByName(client, element.brand, company.id);
    //             //         if (brandId == null) {
    //             //             let brand = new Brands();
    //             //             brand.companyid = company.id;
    //             //             brand.name = element.brand;
    //             //             let brandData = await ProductRepo.insertBrand(client, brand, company);
    //             //             brandId = brandData.data.id
    //             //         }

    //             //         element.brandid = brandId
    //             //         brands.push({ id: brandId, name: element.brand });
    //             //     }
    //             // }


    //             let barcodeFlag = true;
    //             let barcodeExisted = "";

    //             if (!barcodeFlag) {
    //                 let error = "Product Barcode Already Used, Barcode = " + barcodeExisted;
    //                 errors.push({ productName: element.name, error: error })
    //             }

    //             let resault: any;
    //             //TODO check if product Exists by Name or Barcode
    //             element.companyId = companyId
    //             if (element.id != "") {
    //                 // let error = isNameExist ? "Product Name Already Used" : "Product Barcode Already Used"
    //                 // errors.push ({productName:element.name, error:error})
    //                 // continue;

    //                 resault = await ProductRepo.updateImportProducts(client, element, company);


    //             } else {

    //                 resault = await ProductRepo.saveImportProducts(client, element, company);
    //                 if (!resault.success) {
    //                     errors.push(resault.data)
    //                 }
    //             }

    //         }
    //         await client.query("COMMIT")

    //         return res.send(new ResponseData(true, "", errors))
    //     } catch (error: any) {
    //         console.log(error)
    //         await client.query("ROLLBACK")
    //         throw error
    //     } finally {
    //         client.release()
    //     }
    // }


    public static async saveProduct(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            const id = req.body.id;
            let resault: any;

            if (id == null || id == "") {
                resault = await ProductController.addNew(client, data, company, employeeId)
            } else {
                resault = await ProductController.editProduct(client, data, company, employeeId)

            }
            await client.query("COMMIT")

            let queueInstance = TriggerQueue.getInstance();

            if (data.type == 'inventory' || data.type == 'batch' || data.type == 'serialized') {

                let produtId = data.id != null && data.id != "" ? data.id : resault.data.id

                if ((data.id != "" && data.id != null) || (resault.data.id != null && resault.data.id != "")) {


                    if (resault.data.movments && resault.data.movments.length > 0) {
                        let movments = resault.data.movments.filter((m: any) => m != null && m != undefined && m != "")
                        if (resault.data.movments.filter((m: any) => m != null && m != undefined && m != "").length > 0) {
                            queueInstance.createJob({ type: "InventoryMovment", movmentIds: movments, companyId: company.id, branchIds: resault.data.branchIds })
                            queueInstance.createJob({ journalType: "Movment", type: "manualAdjusment", ids: movments })
                        }
                    }
                    if (data.type == 'inventory') {
                        queueInstance.createJob({ type: "openingBalance", id: [produtId], companyId: company.id, branchIds: resault.data.branchIds })
                        queueInstance.createJob({ journalType: "Movment", type: "openingBalance", id: [produtId] })
                    }

                    if (data.type == 'batch' || data.type == 'serialized') {
                        let unitCost = UnitCostQueue.getInstance();
                        unitCost.createJob({ type: "checkBatchSerialsUnitCost", data: { productId: produtId } })

                    }

                }
            }
            const queue = ViewQueue.getQueue();
            queue.pushJob()


            res.send(resault)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }



    public static async addNew(client: PoolClient, data: any, company: Company, employeeId: string) {
        try {
            const type = data.type;
            // data.logs = [];
            // Log.addLog(data, "Add New Product", "Add", employeeId)
            let resault = {};
            switch (type) {
                case "service":
                    resault = await ServiceProductRepo.addService(client, data, company, employeeId);
                    break;
                case "inventory":
                    resault = await InventoryProductRepo.addInventoryItem(client, data, company, employeeId);
                    break;
                case "kit":
                    resault = await KitProductRepo.addKit(client, data, company, employeeId);
                    break;
                case "package":
                    resault = await PackageProductRepo.addPackage(client, data, company, employeeId);
                    break;
                case "menuItem":
                    resault = await MenuItemProductRepo.addMenuItem(client, data, company, employeeId);
                    break;
                case "menuSelection":
                    resault = await MenuSelectionProductRepo.addMenuSelection(client, data, company, employeeId);
                    break;
                case "batch":
                    resault = await BatchProductRepo.addBatchItem(client, data, company, employeeId);
                    break;
                case "serialized":
                    resault = await SerialProductRepo.addSerialItem(client, data, company, employeeId);
                    break;
                case "tailoring":
                    resault = await TailoringProduct.addTailoringItem(client, data, company, employeeId);
                    break;
                default:
                    resault = { success: false, msg: "invalid type" };
                    break;
            }
            return resault;
        } catch (error: any) {
            throw new Error(error.message)
        }

    }


    public static async deleteProduct(req: Request, res: Response, next: NextFunction) {
        try {

            const productId = req.params.productId
            const employeeId = res.locals.user
            const company = res.locals.company
            let resault = await ProductRepo.deleteProduct(productId, employeeId, company)
            let queueInstance = TriggerQueue.getInstance();
            console.log("deleteProductdeleteProductdeleteProductdeleteProduct", resault.data.movments)
            queueInstance.createJob({ journalType: "Movment", type: "deleteProductManualAdustment", ids: resault.data.movments })
            // if (resault.data.type && resault.data.type == 'inventory') {
            //     queueInstance.createJob({ type: "OpeneingBalance", id: [productId], companyId: company.id, branchIds: resault.data.branches })
            //     queueInstance.createJob({ journalType: "Movment", type: "openingBalance", id: [productId] })

            // }

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }



    public static async getProductAvailability(req: Request, res: Response, next: NextFunction) {
        try {

            const productId = req.params.productId
            const companyId = res.locals.company.id;
            let resault = await ProductRepo.getProductAvailability(productId, companyId)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }




    //edit products
    public static async editProduct(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {

            if (data.id == null || data.id == "" || data.id == undefined) {
                new ResponseData(false, "Product Id is Required", [])
            }

            const productType = await ProductRepo.getProductType(client, data.id)

            const type = productType;
            //data.logs = await ProductRepo.getProductLogs(client, data.id)
            //Log.addLog(data, "Edit Product", "Edit", employeeId)
            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
                values: [employeeId, company.id]
            }
            let employeeName = (await client.query(getEmployeeName.text, getEmployeeName.values)).rows[0].employeeName;


            data.logs = []
            const getOldData = {
                text: `SELECT "defaultPrice", "name","barcode" FROM "Products" WHERE id=$1`,
                values: [data.id]
            }
            let oldDataQuery = (await client.query(getOldData.text, getOldData.values));
            let oldDefaultPrice = oldDataQuery.rows[0].defaultPrice
            let oldName = oldDataQuery.rows[0].name
            let oldBarcode = oldDataQuery.rows[0].barcode

            if (oldDefaultPrice != data.defaultPrice) {
                Log.addLog(data,
                    `${employeeName} has changed the item (${data.name}) default price from (${oldDefaultPrice}) to (${data.defaultPrice})`,
                    "Item Default Price Changed",
                    employeeId,
                    {
                        "itemName": data.name,
                        "field": "defaultPrice",
                        "oldPrice": oldDefaultPrice,
                        "newPrice": data.defaultPrice,
                        "currency": company.currencySymbol
                    }
                )
            }

            if (oldName != data.name) {
                Log.addLog(data,
                    `${employeeName} has changed the item name from (${oldName}) to (${data.name})`,
                    "Item Name Changed",
                    employeeId,
                    {
                        "field": "name",
                        "oldName": oldName,
                        "newName": data.name
                    }
                )
            }

            if (oldBarcode != data.barcode) {
                Log.addLog(data,
                    `${employeeName} has changed the item (${data.name}) barcode from (${oldBarcode}) to (${data.barcode})`,
                    "Item Barcode Changed",
                    employeeId,
                    {
                        "itemName": data.name,
                        "field": "barcode",
                        "oldBarcode": oldBarcode,
                        "newBarcode": data.barcode
                    }
                )
            }



            await this.setInvoiceLog(client, data.id, data.logs, null, company.id, employeeId, "", "Cloud");


            let resault;
            switch (type) {
                case "service":
                    resault = await ServiceProductRepo.editService(client, data, company, employeeId);
                    break;
                case "inventory":
                    resault = await InventoryProductRepo.editInventory(client, data, company, employeeId);
                    break;
                case "kit":
                    resault = await KitProductRepo.editKit(client, data, company, employeeId);
                    break;
                case "package":
                    resault = await PackageProductRepo.editPackage(client, data, company, employeeId);
                    break;
                case "menuItem":
                    resault = await MenuItemProductRepo.editMenuItem(client, data, company, employeeId, employeeName);
                    break;
                case "menuSelection":
                    resault = await MenuSelectionProductRepo.editMenuSelection(client, data, company, employeeId);
                    break;
                case "serialized":
                    resault = await SerialProductRepo.editSerilized(client, data, company, employeeId);
                    break;
                case "batch":
                    resault = await BatchProductRepo.editBatchItem(client, data, company, employeeId);
                    break;
                case "tailoring":
                    resault = await TailoringProduct.editTailoring(client, data, company, employeeId);
                    break;
                default:
                    resault = { success: false, msg: "invalid type" };
                    break;
            }

            return resault;
        } catch (error: any) {

            throw error
        } finally {

        }
    }

    public static async setInvoiceLog(client: PoolClient, producteId: string, logs: Log[], branchId: string | null, companyId: string, employeeId: string | null, Number: string | null, source: string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "Products", producteId, logs, branchId, companyId, employeeId, Number, source)
        } catch (error: any) {
            throw new Error(error)
        }
    }






    public static async getProductImage(req: Request, res: Response, next: NextFunction) {
        try {

            const companyId = req.params.companyId;
            const productId = req.params.productId;
            const storage = new FileStorage()
            const file = await storage.getItemImage(companyId, productId)


            if (file) {
                const etag = crypto.createHash('md5').update(file).digest('hex');
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.sendFile(file)
            }

        } catch (error: any) {
            throw error
        }
    }
    public static async getProductListByBranchId(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const branchId = req.params.branchId;
            const storage = new FileStorage()
            const list = await ProductRepo.getProductListByBrnachId(branchId)

            return res.send(list)


        } catch (error: any) {
            throw error
        }
    }





    public static async addBrand(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")
            const company = res.locals.company;

            const data = req.body;
            let resault;

            if (data.id == null || data.id == "") {

                resault = await ProductRepo.insertBrand(client, data, company)

            } else {
                resault = await ProductRepo.updateBrand(client, data, company)
            }
            await client.query("COMMIT")

            res.send(resault)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }

    public static async saveCategoryProducts(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")
            const company = res.locals.company;

            const data = req.body;


            const resault = await ProductRepo.saveCategoryProducts(client, data, company)

            await client.query("COMMIT")

            res.send(resault)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }













    public static async getProductListByBranch(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const data = req.body
            const list = await ProductRepo.getProductListByBrnach(data, company)



            return res.send(list)


        } catch (error: any) {
            throw error
        }
    }
    public static async getBrandList(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const data = req.body;
            const list = await ProductRepo.getBrandList(data, company)
            return res.send(list)


        } catch (error: any) {
            throw error
        }
    }



    //inventorylocation

    public static async getInventoryLocationsList(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const data = req.body;
            const list = await ProductRepo.getInventoryLocationsList(data, company)
            return res.send(list)


        } catch (error: any) {
            throw error
        }
    }

    public static async addInventoryLocations(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")
            const company = res.locals.company;

            const data = req.body;
            let resault;

            if (data.id == null || data.id == "") {

                resault = await ProductRepo.insertInventoryLocations(client, data, company)

            } else {
                resault = await ProductRepo.updateInventoryLocations(client, data, company)
            }
            await client.query("COMMIT")

            res.send(resault)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }

    public static async getNonInventoryLocationsProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.listProductFilterNonInventoryLocations(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }

    public static async getInventoryLocations(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const InventoryLocationsID = req.params['InventoryLocationsID']

            const optionGroup = await ProductRepo.getInventoryLocations(InventoryLocationsID);
            res.send(optionGroup)
        } catch (error: any) {

            throw error
        }
    }

    public static async updateInventoryLocationsTranslation(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await ProductRepo.updateInventoryLocationsTranslation(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }









    public static async getBrand(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const brandId = req.params['brandID']

            const optionGroup = await ProductRepo.getBrand(brandId);
            res.send(optionGroup)
        } catch (error: any) {

            throw error
        }
    }

    public static async setProductColor(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await ProductRepo.setProductColor(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }
    public static async updateBulkPrices(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await ProductRepo.updateBulkPrices(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }
    public static async updateTranslation(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await ProductRepo.updateTranslation(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }
    public static async updateMatrixTranslation(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await MatrixRepo.updateTranslation(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }
    public static async updateBrandTranslation(req: Request, res: Response, next: NextFunction) {
        try {
            const update = await ProductRepo.updateBrandTranslation(req.body)
            return res.send(update)
        } catch (error: any) {
            throw error
        }
    }
    public static async getProductSerials(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const productId = req.params.productId;

            const serials = await SerialProductRepo.getProductSerials(branchId, productId)
            return res.send(serials)
        } catch (error: any) {
            throw error
        }
    }
    public static async getProductBatches(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const productId = req.params.productId;

            const batches = await BatchProductRepo.getProductBatches(branchId, productId)
            return res.send(batches)
        } catch (error: any) {
            throw error
        }
    }
    public static async validateBarcode(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company = res.locals.company;
            const companyId = company.id;
            const productId = req.body.productId;
            const barcode = req.body.barcode;
            const isMatrix = req.body.isMatrix;
            let resault;


            if ((productId != null || productId != "" || productId != "0") && (isMatrix == null)) {
                resault = await ProductRepo.checkIfBarcodeExists(client, productId, barcode, companyId)
            } else {
                resault = await ProductRepo.checkIfBarcodeExists(client, null, barcode, companyId)
            }
            if (isMatrix) {
                if (productId != null && productId != "") {
                    resault = await MatrixRepo.checkIfMatrixBarcodeExists(client, productId, barcode, companyId)


                } else {
                    resault = await MatrixRepo.checkIfMatrixBarcodeExists(client, null, barcode, companyId)

                }
            }
            await client.query("COMMIT")
            if (resault) {
                return res.send(new ResponseData(false, "Already Used", []))
            } else {
                return res.send(new ResponseData(true, "", []))
            }


        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }

    public static async setProductMedia(req: Request, res: Response, next: NextFunction) {
        try {

            let data = req.body;
            const setMedia = await ProductRepo.setProductMediaId(data)
            return res.send(setMedia)
        } catch (error: any) {
            throw error
        }
    }



    public static async getLocationsByBranch(req: Request, res: Response, next: NextFunction) {
        try {

            let branchId = req.params.branchId;
            const setMedia = await ProductRepo.getLocationListByBranch(branchId)
            return res.send(setMedia)
        } catch (error: any) {
            throw error
        }
    }




    public static async importFromCsv(req: Request, res: Response, next: NextFunction) {
        let redisClient = RedisClient.getRedisClient();
        let company = res.locals.company;
        try {

            let data = req.body;
            let isBulkImport = await redisClient.get("BulkImport" + company.id)
            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false, "A Previouse Product Import is Still In Progress: " + progress, []))
            }
            let resault = await ImportProductsRepo.import(data, company)
            return res.send(resault)
        } catch (error: any) {
            await redisClient.deletKey("BulkImport" + company.id)
            throw error
        }
    }
    public static async writeRes(req: Request, res: Response, next: NextFunction) {
        try {

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.flushHeaders();

            // Send a comment to establish the SSE connection

            let delay = (time: number) => {
                return new Promise(resolve => setTimeout(resolve, time));
            }

            for (let index = 0; index < 10; index++) {
                res.write(': SSE Connection Established\n\n');
                await delay(1000);
            }
            // Keep the connection open
            req.on('close', () => {
                // Clean up any resources if needed
            });

            return res.end(new ResponseData(true, "", []))
        } catch (error: any) {
            throw error
        }
    }


    public static async getBulkImportProgress(req: Request, res: Response, next: NextFunction) {

        try {


            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;

            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("BulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;

                return res.send(new ResponseData(false, "A Previouse Product Import is Still In Progress: " + progress, { progress: progress }))
            }




            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {

            throw error
        }
    }



    public static async getBranchProductAvailability(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body;
            const company = res.locals.company;
            let resault = await BranchProductsRepo.getBranchProductAvailability(company, data)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async updateAvailability(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;
            let resault = await BranchProductsRepo.updateAvailability(client, company.id, data)
            await client.query("COMMIT")
            return res.send(resault)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }
    public static async updateOnlineAvailability(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const company = res.locals.company;
            const data = req.body;
            let resault = await BranchProductsRepo.updateOnlineAvailability(client, company.id, data)
            await client.query("COMMIT")
            return res.send(resault)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }
    public static async getExpireBatches(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const branches = res.locals.branches;
            const data = req.body;
            const product = await ProductRepo.getExpireBatches(data, company, branches);
            return res.send(product)

        } catch (error: any) {
            throw error
        }
    }

    public static async reorderProducts(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            let resault = await BranchProductsRepo.reorderProducts(company.id, data.branchId ?? null, branches)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async assignProductTax(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body;
            const company = res.locals.company;
            const branches = res.locals.branches;
            let resault = await ProductRepo.assignProductTax(data, company)
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }





    public static async productChildsList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.productChildsList(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }


    public static async validateSKU(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const companyId = company.id;
            const productId = req.body.productId;
            const sku = req.body.sku;
            let resault: boolean;

            resault = await ProductRepo.checkProductSKU(sku, companyId, productId)

            if (resault) {
                return res.send(new ResponseData(false, "Already Used", []))
            } else {
                return res.send(new ResponseData(true, "", []))
            }


        } catch (error: any) {
            throw error
        }
    }

    public static async getProductColumns(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company

            let resault;
            resault = await ProductRepo.getProductColumns(company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }


    public static async productListWithCustomeFields(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body;
            let resault;
            resault = await ProductRepo.productListWithCustomeFields(data, company);
            return res.send(resault)
        } catch (error: any) {

            throw error
        }

    }

    public static async exportProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const type = req.params.type


            const result = await ProductRepo.exportProducts(company, type);
            res.download(company.id + `products.${type}`)

            // Send the file as a response
            // res.set('Content-Disposition', 'attachment; filename="products.xlsx"');
            // res.set('Content-Type', 'text/csv');

            // const fileStream = fs.createReadStream(company.id + 'products.xlsx');
            // fileStream.pipe(res);

            res.on('finish', () => {
                fs.unlinkSync(company.id + `products.${type}`);
            });
        } catch (error: any) {
            throw error;
        }
    }

    public static async getProductTags(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let respones = await ProductRepo.getProductsTags(data, company.id);
            return res.send(respones)
        } catch (error: any) {
            throw error;
        }
    }

    public static async importProductsRecipe(req: Request, res: Response, next: NextFunction) {
        const redisClient = RedisClient.getRedisClient();
        const company = res.locals.company;
        const redisKey = `BulkImport:${company.id}`;

        try {
            const data = req.body;
            const mode = req.params.importMode;
            const limit = parseInt(process.env.NUMBER_OF_IMPORT_RECOREDS || '2000', 10);
            const errors: string[] = [];

            if (!Array.isArray(data) || data.length === 0) {
                return res.status(400).json(new ResponseData(false, 'CSV data is empty or invalid.', []));
            }

            // ✅ Step 1: Transform into grouped format
            const groupedMap = new Map<string, GroupedRecipe>();

            for (const row of data) {
                if (!row.barcode || !row.productName) {
                    errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
                    continue;
                }

                const barcode = row.Barcode.trim();
                const productName = row.productName.trim();

                if (!groupedMap.has(barcode)) {
                    groupedMap.set(barcode, {
                        barcode: barcode,
                        productName: productName,
                        recipe: []
                    });
                }

                groupedMap.get(barcode)!.recipe.push({
                    barcode: row.recipeItemBarCode,
                    sku: row.recipeItemSku,
                    name: row.recipeItemName,
                    UOM: row.UOM,
                    usages: row.usages
                });
            }

            const groupedItems = Array.from(groupedMap.values());
            if (!groupedItems.length) {
                return res.status(400).json(new ResponseData(false, 'No valid grouped rows found.', errors));
            }

            // ✅ Step 2: Check for running import
            const existingImport = await redisClient.get(redisKey);
            if (existingImport) {
                const { progress } = JSON.parse(existingImport);
                return res.send(new ResponseData(false, `A previous import is still in progress: ${progress}`, []));
            }

            // ✅ Step 3: Init progress
            const totalGroups = groupedItems.length;
            const pageCount = Math.ceil(totalGroups / limit);

            await redisClient.set(redisKey, JSON.stringify({
                progress: 'Starting...',
                total: totalGroups,
                completed: 0,
                success: 0,
                failed: 0,
            }));

            let result = new ResponseData(true, '', []);
            let completed = 0;
            let successCount = 0;
            let failedCount = 0;

            for (let i = 0; i < pageCount; i++) {
                const chunk = groupedItems.slice(i * limit, (i + 1) * limit);

                const batchResult = (await (MenuItemProductRepo.importFromCVS(chunk, mode, company, i + 1, totalGroups)));

                completed += chunk.length;
                if (batchResult.success) {
                    successCount += chunk.length;
                } else {
                    failedCount += chunk.length;
                    if (batchResult.data) errors.push(...batchResult.data);
                }

                await redisClient.set(redisKey, JSON.stringify({
                    progress: `${((completed / totalGroups) * 100).toFixed(1)}%`,
                    total: totalGroups,
                    completed,
                    success: successCount,
                    failed: failedCount,
                }));

                result = batchResult; // keep latest result
            }

            await redisClient.deletKey(redisKey);

            if (errors.length) {
                return res.status(207).json(new ResponseData(false, 'Import completed with errors', errors));
            }

            return res.status(200).json(result);

        } catch (error: any) {
            await redisClient.deletKey(redisKey);
            throw error;
        }
    }

    public static async exportProductsRecipe(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const type = req.params.type;

            console.log(req);

            const result = await MenuItemProductRepo.exportProductsRecipe(company, type);

            res.download(result)
            try {
                res.on('finish', () => {
                    fs.unlinkSync(result);
                });

            } catch (error: any) {
                throw error;
            }


        } catch (error: any) {
            throw error;
        }
    }

    public static async getMenuItemList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let respones = await MenuItemProductRepo.getMenuItemList(company, data);
            return res.send(respones)
        } catch (error: any) {
            throw error;
        }
    }

    public static async saveProductRecipeItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const productId = req.params.productId;
            const data = req.body;

            let respones = await MenuItemProductRepo.saveProductRecipeItem(data, productId, company);
            return res.send(respones)
        } catch (error: any) {
            throw error;
        }
    }

    public static async deleteProductRecipeItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const productId = req.params.productId;
            const itemId = req.params.itemId;

            let respones = await MenuItemProductRepo.deleteProductRecipeItem(itemId, productId, company.id);
            return res.send(respones)
        } catch (error: any) {
            throw error;
        }
    }



    public static async saveRecipeItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const validTypes = ['option', 'menuProduct', 'recipe'];
            const reqType = req.params.type;
            if (!validTypes.includes(reqType)) {
                // Handle the error here, for example by throwing an exception.
                throw new Error(`Invalid type parameter: ${reqType}`);
            }
            const type = reqType as 'option' | 'menuProduct' | 'recipe';

            const id = req.params.id;
            const data = req.body;
            const employeeId = res.locals.user

            let respones = await QuickRecipeManagment.saveRecipeItem(type, data, id, company, employeeId);
            return res.send(respones)
        } catch (error: any) {
            throw error;
        }
    }

    public static async deleteRecipeItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const validTypes = ['option', 'menuProduct', 'recipe'];
            const reqType = req.params.type;
            if (!validTypes.includes(reqType)) {
                // Handle the error here, for example by throwing an exception.
                throw new Error(`Invalid type parameter: ${reqType}`);
            }
            const type = reqType as 'option' | 'menuProduct' | 'recipe';

            const productId = req.params.productId;
            const itemId = req.params.itemId;

            let respones = await QuickRecipeManagment.deleteRecipeItem(type, itemId, productId, company.id);
            return res.send(respones)
        } catch (error: any) {
            throw error;
        }
    }



   public static async getProductForMedia(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
      

            let respones  = await MediaRepo.getProductForMedia(req.body,company.id);
            return res.send(respones)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }
  public static async bulkProductMedia(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            let respones  = await MediaRepo.setMedia(data,company);
            return res.send(respones)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }
}