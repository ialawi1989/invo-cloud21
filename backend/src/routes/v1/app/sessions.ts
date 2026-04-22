
import { AuthController } from "@src/controller/app/auth.controller";
import express, { Router } from "express";

const router = express.Router();

router.put('/revokeSession/:deviceId', AuthController.revokeDevice)
router.get('/sessionList', AuthController.userSessions)




export default router;
