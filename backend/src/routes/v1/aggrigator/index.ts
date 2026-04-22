import express from "express";
import { AggrigatorController } from "@src/controller/admin/aggrigator.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

export  const router = createAsyncRouter();



//// Compnay GROUPS
router.post('/orders',AggrigatorController.orderCreation);

router.post('/orders/:id/deliveryJob/created',AggrigatorController.deliveryJobcreated);
router.post('/orders/:id/deliveryJob/driverAssigned',AggrigatorController.driverAssigned);
router.post('/orders/:id/deliveryJob/started',AggrigatorController.deliveryJobStarted);
router.post('/orders/:id/deliveryJob/completed',AggrigatorController.deliveryJobcompleted);
router.post('/orders/:id/deliveryJob/cancelled',AggrigatorController.deliveryJobcancelled);
router.post('/orders/:id/cancelled',AggrigatorController.orderCancelled);


export default router;