import express from "express";
import { TablesController } from "@src/controller/app/Settings/tables.controller";
import { TerminalController } from "@src/controller/app/Terminal/terminal.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

const router =  createAsyncRouter();
router.post("/addTerminalBranch",TerminalController.addTerminalBranch)

router.put("/disconnectTerminal/:branchId",TerminalController.discconectTerminal)
router.get("/isCodeExpired/:code",TerminalController.checkIfCodeExprie)

export default router;