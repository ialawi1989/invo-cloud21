require('module-alias/register');


import { ApiLimiterRepo } from '@src/apiLimiter';
import { EcommerceTableReservationController } from '@src/controller/ecommerce/TableReservation.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';
import express from 'express';

const router = createAsyncRouter();
router.post("/saveReservation",EcommerceTableReservationController.saveReservation)

router.get("/getReservation/:sessionId",EcommerceTableReservationController.getReservationBySessionId)


export default router;