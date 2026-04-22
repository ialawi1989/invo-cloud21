import { ResponseData } from "@src/models/ResponseData";
import { MatrixRepo } from "@src/repo/app/product/matrix.repo";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { Request, Response, NextFunction } from 'express';
export class MatrixController {
    public static async addMatrix(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const employeeId = res.locals.user;
            let resault;
            if (data.id == null || data.id == "") {
                resault = await MatrixRepo.addMatrix(req.body, company, employeeId);
            } else {
                resault = await MatrixRepo.updateMatrix(data, company, employeeId)
            }
            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ journalType: "Movment", type: "openingBalance", id: resault.data.productIds })

            res.send(resault);
        } catch (error: any) {

            throw error
        }
    }
    public static async getMatrixById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const matixId = req.params['matrixId'];
            const matrix = await MatrixRepo.getMatix(matixId, company)
            return res.send(matrix);
        } catch (error: any) {
            throw error
        }
    }
    public static async getAllCompnayMatrix(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const matrix = await MatrixRepo.getAllCompnayMatrixFilter(data, company);
            return res.send(matrix)
        } catch (error: any) {
            throw error
        }
    }
}