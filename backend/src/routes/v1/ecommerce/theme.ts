require('module-alias/register');

import { ThemeController } from '@src/controller/ecommerce/theme.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';

import  express from 'express';

const router = createAsyncRouter();
//TODO: CHANGE REDIRECT 
router.get("/menus",ThemeController.getMenus)
router.get("/getHomeSections",ThemeController.getHomeSections)
router.post("/getMenuProducts2",ThemeController.getMenuProducts2)

router.post("/getMenuProducts",ThemeController.getMenuProducts)
//router.post("/getCutomerList",ThemeController.getCutomerList)


router.get("/getPage/:slug",ThemeController.getPage)
router.post("/getSectionData/",ThemeController.getSectionData)
// router.get("/getMenu/:slug",ThemeController.getPage)
// router.get("/getMenus",ThemeController.getPage)
export default router;