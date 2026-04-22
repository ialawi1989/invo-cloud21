
import { NotificationTemplateController } from "@src/controller/app/Accounts/NotificationTemplate.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";

const router = createAsyncRouter();

router.get ('/getNotificationTemplateList',NotificationTemplateController.getNotificationTemplateList)
router.post ('/sendNotificationByBranch/:id/:branchId',NotificationTemplateController.sendNotificationByBranch)

export default router;