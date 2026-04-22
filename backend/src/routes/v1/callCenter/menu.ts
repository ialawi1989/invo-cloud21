require('module-alias/register');
import { ServiceController } from '@src/controller/admin/service.controller';
import { SurchargeController } from '@src/controller/app/Accounts/surcharge.controller';
import { OptionsController } from '@src/controller/app/products/option.controller';
import { PriceManagmentController } from '@src/controller/app/products/priceManagment.Controller';
import { MenuController } from '@src/controller/callCenter/menu.controller';
import { ShopController } from '@src/controller/ecommerce/shop.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from "express";
// import { ProductController } from "@src/controller/app/products/product.controller";
export const router = createAsyncRouter();

router.post("/getMenuList2",MenuController.getMenuList2);
router.get("/getMenu/:menuId",MenuController.getMenuById);
router.get("/menuProductList",MenuController.MenuProductList);

router.post("/getMenuSections",MenuController.getMenuSections)
/////

router.post("/getMenuProducts",MenuController.getMenuProducts)

router.post("/getProductTags",ShopController.getMenuProductTags)
router.post("/getCatgorieProductsTags",ShopController.getCatgorieProductsTags)
router.get("/getCompanyCategories",ShopController.getCompanyCategories)
router.post("/getCategoriesProducts",ShopController.getCategoriesProducts)
// router.post("/getServiceProducts",ShopController.getServiceProducts)

router.post("/getPriceLabelList",PriceManagmentController.getPriceLabelList)
router.post("/getSurchargeList",SurchargeController.getSurchargeList)


router.get("/getServices",ServiceController.getPickUpAndDeliveryServicesList)


// 
router.get("/getMenuList/:branchId",MenuController.getMenuList);
router.post("/getMenuSectionList",MenuController.getMenuSectionList)
router.get("/getProduct/:id", MenuController.getProduct);
router.post("/getProducts/:branchId", MenuController.getProductsByIds);
router.get("/getOptionGroupList",MenuController.getOptionGroupList)
router.get("/getOptions",MenuController.getOptions)
router.post("/getProductsByBranchId",MenuController.getProductsByBranchId)
router.get("/getProductAvailability/:productId",MenuController.getProductAvailability)
router.get("/getProductByBranchId/:id/:branchId", MenuController.getProductByBranchId);

export default router;