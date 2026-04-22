import { WebPushController } from "@src/controller/app/webpush/webPush.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";
const router = createAsyncRouter();


router.get('/company-status', WebPushController.companyStatus);
router.put('/company-toggle', WebPushController.subscribe);
router.post('/testNotifications', WebPushController.testSendNotifications);

export default router;