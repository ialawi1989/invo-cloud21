import { CustomizeReportControlle } from "@src/controller/app/reports/customizeReport.Controlle";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import express from "express";
const router = createAsyncRouter();
//Modules
router.post("/modules/saveModule/:moduleId",CustomizeReportControlle.saveModule)
router.get("/modules/getModules",CustomizeReportControlle.getModules)
router.get("/modules/getModule/:moduleId",CustomizeReportControlle.getModule)
router.get("/modules/deleteModule/:moduleId",CustomizeReportControlle.deleteModule)
//Options
router.get("/options/getOptions/:fieldName",CustomizeReportControlle.getOptions)
router.get("/options/getSuggests/:fieldName",CustomizeReportControlle.getSuggests)

//Queries

router.post("/queries/saveQuery",CustomizeReportControlle.saveQuery)
router.get("/queries/getQueries",CustomizeReportControlle.getQueries)
router.get("/queries/getQuery/:queryId",CustomizeReportControlle.getQuery)
router.get("/queries/deleteQuery/:queryId",CustomizeReportControlle.deleteQuery)


router.post("/getCustomizedReport",CustomizeReportControlle.getCustomizeReport)
router.get("/getDataSource",CustomizeReportControlle.getDataSource)
export default router;