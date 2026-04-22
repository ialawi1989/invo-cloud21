require('module-alias/register');
import { AuthController } from '@src/controller/app/auth.controller';
import  express from 'express';
import dashboard from './dashboard';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';

const router = createAsyncRouter();

router.use(AuthController.authintcateForCompanyGroup)
router.use(AuthController.authinticateBranches)

router.use('/dashboard', dashboard)

export default router;