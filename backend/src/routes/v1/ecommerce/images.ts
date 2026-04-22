import { ImagesController } from "@src/controller/ecommerce/Images.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";

const router = createAsyncRouter();



router.get('/72.png',ImagesController.icon72)
router.get('/96.png',ImagesController.icon96)
router.get('/128.png',ImagesController.icon128)
router.get('/144.png',ImagesController.icon144)
router.get('/152.png',ImagesController.icon152)
router.get('/192.png',ImagesController.icon192)
router.get('/384.png',ImagesController.icon384)
router.get('/512.png',ImagesController.icon512)
router.get('/512.png',ImagesController.icon512)
router.get('/:imageSize',ImagesController.AppleSplash)

export default router;