import { ScheduledReportController } from "@src/controller/app/Accounts/ScheduledReport.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";
const router = createAsyncRouter();

router.post('/saveScheduledReport', ScheduledReportController.saveScheduledReport);
router.delete('/deleteScheduledReport/:id', ScheduledReportController.deleteScheduledReport);
router.get('/getScheduledReportById/:id', ScheduledReportController.getScheduledReportById);
router.get('/getScheduledReportTypes', ScheduledReportController.getScheduledReportTypes);
router.get('/getScheduledReportByType/:type', ScheduledReportController.getScheduledReportBytype);
router.get('/test/:id', ScheduledReportController.test);


export default router;