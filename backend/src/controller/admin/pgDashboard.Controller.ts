import { ResponseData } from "@src/models/ResponseData";
import { DBDashboard } from "@src/repo/admin/pgDashboard";
import { Request, Response, NextFunction } from "express";

export class PgDashboardController {

    public static async dashboard(req: Request, res: Response, next: NextFunction) {

        try {


            const add = await DBDashboard.dashboardData();

            return res.send(add)
        } catch (error: any) {


            return res.send(new ResponseData(false, error.message, []))
        }
    }
}