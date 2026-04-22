
require('module-alias/register');
import express from 'express';
import { TemplateController } from './template.controller';


export const router = express.Router();
export default router;

export const frontendRouter = express.Router();

TemplateController.registerRouts(frontendRouter);


