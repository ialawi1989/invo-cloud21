import { ResponseData } from '@src/models/ResponseData';
import { FeedBackRepo } from '@src/repo/app/settings/FeedBack.repo';
import { Request, Response, NextFunction } from 'express';
export class FeedbackController {
    public static async saveFeedBackSettings(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resault = await FeedBackRepo.saveFeedBackSettings(data, company);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getFeedBackSettings(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const resault = await FeedBackRepo.getFeedBackSettings(company);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async getFeedBackList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resault = await FeedBackRepo.getFeedbacks(data, company);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async saveFeedBack(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resault = await FeedBackRepo.insertFeedbacks(data, company);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }
}