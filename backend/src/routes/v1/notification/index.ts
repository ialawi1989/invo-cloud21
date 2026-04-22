require('module-alias/register');
import express from 'express';
import { NotificationController } from './notification.controller';

export const router = express.Router();
export default router;

export const frontendRouter = express.Router();

NotificationController.registerRouts(frontendRouter);