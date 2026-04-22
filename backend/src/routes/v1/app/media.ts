import { MediaController } from "@src/controller/app/products/media.controller";
import { SentryMiddlware } from "@src/middlewear/Sentry";
import express, { Router } from "express";
import timeout  from 'connect-timeout'
import { Request, Response, NextFunction } from 'express';
import { ApiLimiterRepo } from "@src/apiLimiter";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";

const router = createAsyncRouter();


router.post('/importMedia',timeout('5s'),haltOnTimedout,MediaController.importMedia)
function haltOnTimedout (req:Request, res:Response, next:NextFunction) {
    if (!req.timedout) next()
  }
router.post('/appendAttachment',MediaController.appendAttachment)
router.post('/getAttachments',MediaController.getAttchments)
router.post('/deleteAttachment',MediaController.deleteAttachment)
router.post('/editMedia',MediaController.editMedia)
router.post('/getMediaList',MediaController.getMediaList)
router.get('/getMediaLinkList/:mediaId',MediaController.getMediaLinkes)
router.get('/getMediabyId/:mediaId',MediaController.getMediabyId)
router.get('/getMediabyId/:mediaId/:width/:height',MediaController.getMediabyId)
router.post('/unLinkMedia',MediaController.unLinkMedia)
router.get('/getDefalutMedia/:mediaId',MediaController.getDefaultMedia)
router.post('/deleteMedia',MediaController.deleteMedia)


export default router;
