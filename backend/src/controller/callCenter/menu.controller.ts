/* eslint-disable prefer-const */
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { MenuRepo } from '@src/repo/callCenter/product/menu.repo';
import { ShopRepo } from '@src/repo/ecommerce/shop.repo';
import { SocketMenu } from '@src/repo/socket/menu.socket';
import { Request, Response, NextFunction } from 'express';

export class MenuController {


    public static async getMenuList2(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body;
            const menus = await MenuRepo.getMenuList2(data);
            return res.send(menus);
        } catch (error: any) {
              throw error
        }
    }

    public static async getMenuById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const menuId = req.params['menuId'];
            const menus = await MenuRepo.getMenuById(menuId, company);
            return res.send(menus);
        } catch (error: any) {
              throw error
        }
    }

    public static async MenuProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await MenuRepo.MenuProductList(company);
            return res.send(list)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        }
    }

    public static async getMenuSections(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await MenuRepo.getMenuSections(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getMenuProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await MenuRepo.getMenuProducts(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    //-----------

    public static async getMenuList(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId'];
            const company = res.locals.company;
            let menus = await MenuRepo.getMenuList(company, branchId)
            return res.send(menus)
        } catch (error: any) {
              throw error
        }
    }

    public static async getMenuSectionList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await MenuRepo.getMenuSectionList(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getMenuSectionProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let sections = await MenuRepo.getMenuSectionProducts(data, company)
            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async getProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params['id'];

            //   const company =req.body.companyId;

            if (id == null || id == "null") {
                return res.send("Product Id is Required")
            }
            const product = await MenuRepo.getProduct(id);

            return res.send(product)


        } catch (error: any) {
              throw error
        }
    }

    static async getProductsByIds(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId'];
            if (branchId == null || branchId == "null") {
                return res.send(new ResponseData(false, "Branch Id is Required", []));
            }

            let productIds = req.body.productIds || [];
            if (productIds == 0) {
                return res.send(new ResponseData(false, "Product Ids are Required", []));
            }

            const company = res.locals.company;
            const product = await MenuRepo.getProducts(productIds, branchId);

            return res.send(product)
        } catch (error: any) {
              throw error
        }

    }

    public static async getProductByBranchId(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params['id'];
            const branchId = req.params['branchId'];

            //   const company =req.body.companyId;

            if (id == null || id == "null") {
                return res.send("Product Id is Required")
            }
            if (branchId == null || branchId == "null") {
                return res.send("Branch Id is Required")
            }
            const product = await MenuRepo.getProductByBranchId(id, branchId);

            return res.send(product)


        } catch (error: any) {
              throw error
        }
    }

    public static async getOptionGroupList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const optionGroupList = await MenuRepo.getOptionGroupsList(data, company);
            return res.send(optionGroupList)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        }
    }

    public static async getOptions(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const resault = await MenuRepo.getOptions(data, company)

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getProductsByBranchId(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const resault = await MenuRepo.getProductsByBranchId(data, company)

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




    // public static async getBranchMenuList(req: Request, res: Response, next: NextFunction) {
    //     try {

    //         const branchId = req.params['branchId'];
    //         const menus = await MenuRepo.getBranchMenuList(branchId);
    //         res.send(menus);
    //     } catch (error: any) {
    //           throw error
    //     }
    // }

}