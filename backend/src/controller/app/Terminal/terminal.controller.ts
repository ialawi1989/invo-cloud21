import { ResponseData } from '@src/models/ResponseData';
import { terminalRepo } from '@src/repo/app/terminal/terminal.repo';
import e, { Request, Response, NextFunction } from 'express';
import { SocketController } from '@src/socket';
import { verify } from 'jsonwebtoken'
import { ValidationException } from '@src/utilts/Exception';
import { SocketTerminal } from '@src/repo/socket/terminal.socket';
import { BranchesRepo } from '@src/repo/admin/branches.repo';

export class TerminalController {

    public static async addTerminalBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const socketInstance = SocketController.getInstance();
            const terminalSocketData = socketInstance.pendingTerminals.find(f => f.data.terminalCode == data.token)

            if (!terminalSocketData) {
                throw new ValidationException("Invalid Code")
            }

            // const  decoded : any = verify(data.token, process.env.Terminal_TOKEN_SECRET as string);
            // if(decoded == null)
            // {
            //     return res.send(new ResponseData(false, "unauthorized", []))
            // }
            if (!data.branchId) {
                throw new ValidationException("Branch Id is Required")
            }
            let isActiveBranch = await BranchesRepo.hasActiveBranches(company.id, data.branchId)
            if (!isActiveBranch) {
                throw new ValidationException("The subscription for this branch has expired. Please renew to continue access.")
            }
            const terminalData = {
                terminalId: terminalSocketData.data.terminalId,
                terminalType: terminalSocketData.data.terminalType,
                branchId: data.branchId,
                parentId: terminalSocketData.data.parentId,
                name: terminalSocketData.data.name,
            }
            const resault: ResponseData = await terminalRepo.addTerminalBranch(terminalData, company, employeeId);
            SocketController.responseToTerminal(resault.data);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }


    public static async getTerminalToken(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const token = await terminalRepo.getTerminalToken(data.branchId);
            return res.send(token)
        } catch (error: any) {

                 throw error
        }
    }


    public static async connectTerminalRedirect(req: Request, res: Response, next: NextFunction) {
        try {
            const code = req.params["code"];
            const token = await terminalRepo.connectTerminalRedirect(code);
            return res.redirect(token?.data)
        } catch (error: any) {

                 throw error
        }
    }


    public static async discconectTerminal(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId;
            const employeeId = res.locals.user;
            const data = await terminalRepo.disconnectTerminal(branchId, employeeId, company);
            return res.send(data)
        } catch (error: any) {
                 throw error
        }
    }

    public static async checkIfCodeExprie(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.code;
            const data = await terminalRepo.checkIfCodeExprie(branchId);
            return res.send(data)
        } catch (error: any) {
                 throw error
        }
    }

    public static async recoverTerminal(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const resData = await SocketTerminal.changeTerminalePrefix(data, company);

            return res.send(resData)
        } catch (error: any) {
            return res.send(JSON.stringify(new ResponseData(false, error.message, [])))
        }
    }
}