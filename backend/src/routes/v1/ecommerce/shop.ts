
require('module-alias/register');

import { FeedbackController } from '@src/controller/app/Settings/feedbacks.controller';
import { ShopController } from '@src/controller/ecommerce/shop.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from 'express';
const router = createAsyncRouter();
//TODO: CHANGE REDIRECT 



router.post("/menu/getMenuSections",ShopController.getMenuSections)
router.post("/menu/getMenuProducts",ShopController.getMenuProducts)
router.post("/menu/getCompanyMenu",ShopController.getCompanyMenu)
router.get("/getProductMedia/:id",ShopController.getProductMedia)

router.post("/menu/getProductTags",ShopController.getMenuProductTags)
router.post("/getCatgorieProductsTags",ShopController.getCatgorieProductsTags)

router.post("/getCompanyCategories",ShopController.getCompanyCategories)
router.post("/getServiceProducts",ShopController.getServiceProducts)
router.post("/getServiceProductCategories",ShopController.getServiceProductCategories)

router.post("/getCategoriesProducts",ShopController.getCategoriesProducts)
//router.post("/getCategoriesProducts",ShopController.getCategoriesProducts)

router.post("/getProduct",ShopController.getProduct)
router.post("/getAlternativeProducts", ShopController.getaAlternativeProducts)
router.get("/getBrands",ShopController.getBrands)

router.post("/getServicesListById",ShopController.getServicesListById)
router.post("/getServicesList",ShopController.getServicesList)

router.post("/generalSearch",ShopController.search)
router.post("/saveFeedback",FeedbackController.saveFeedBack)

// router.post("/logIn",ShopperController.logIn)
// router.post("/registerUser",ShopperController.logIn)


export default router;