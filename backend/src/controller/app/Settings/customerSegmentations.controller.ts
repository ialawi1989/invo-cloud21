import { ResponseData } from '@src/models/ResponseData';
import { CustomerSegmentsRepo } from '@src/repo/app/settings/CustomerSegment.repo';
import { Request, Response, NextFunction } from 'express';

export class CustomerSegmentsController{

    public static async saveCustomerSegment(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;

            let resault;
            if (data.id == null || data.id == "") {
                resault = await CustomerSegmentsRepo.addCustomerSegment(data, company)
            }else{
                resault = await CustomerSegmentsRepo.editCustomerSegment(data, company)
            }
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getCustomerSegmentById(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const segmentId = req.params.segmentId;

            let resault = await CustomerSegmentsRepo.getCustomerSegmentById(segmentId,company)
          
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getCustomerSegmentList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
  

            let resault = await CustomerSegmentsRepo.getCustomerSegmentList(data,company)
          
            return res.send(resault)
        } catch (error: any) {
              throw error
        } 
    }

}