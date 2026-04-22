require("module-alias/register");
import express from "express";
import { OrderingController } from "./pos/ordering/ordering.controller";

export const router = express.Router();
export default router;

export const frontendRouter = express.Router();
OrderingController.registerRouts(frontendRouter);
