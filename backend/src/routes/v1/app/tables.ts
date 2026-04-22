import express from "express";
import { TablesController } from "@src/controller/app/Settings/tables.controller";
import { ApiLimiterRepo } from "@src/apiLimiter";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

const router = createAsyncRouter();

//tables

router.post("/saveTable",TablesController.addTableGroups);
router.get("/getTableGroup/:branchId/:groupId",TablesController.getTableGroupById);
router.get("/getTableGroupList/:branchId",TablesController.getTableGroupList);
router.get("/getUnassingedTables/:branchId",TablesController.getUnassignedTables);
router.delete("/deleteTableGroup/:tableGroupId",TablesController.deleteTableGroup);
router.delete("/unassignTable/:tableId",TablesController.unassignTable);
router.get("/getInActiveGroups/:branchId",TablesController.getInActiveGroups);

export default router;