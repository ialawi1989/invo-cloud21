import { Request, Response, NextFunction } from 'express';
import { ResponseData } from "@src/models/ResponseData";
import { AdminRepo } from '@src/repo/admin/admin.repo';


export class AdminController {
    public static async saveTerms(req: Request, res: Response, next: NextFunction) {
        try {
            const body = req.body;
            let data = await AdminRepo.save(body)
            return res.send(data)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }


    public static async getTerm(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id;
            let data = await AdminRepo.getById(id)
            return res.send(data)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }

    public static async getList(req: Request, res: Response, next: NextFunction) {
        try {
            const body = req.body;
            let data = await AdminRepo.getList(body)
            return res.send(data)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }



    public static async getLatest(req: Request, res: Response, next: NextFunction) {
        try {

            let data = await AdminRepo.getLatest()
            return res.send(data)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }

    public static async activateTerms(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.body.id;
            let data = await AdminRepo.activateTerms(id)
            return res.send(data)
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }


    public static async getVersionNumber(req: Request, res: Response, next: NextFunction) {
        try {
    
            let data = await AdminRepo.getVersionNumber()
            return res.send(new ResponseData(true, "", {terms_versions:data}))
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []))
        }
    }
}