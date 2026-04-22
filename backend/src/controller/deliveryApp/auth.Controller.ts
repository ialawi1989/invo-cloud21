import { AuthRepo } from '@src/repo/app/auth.repo';
import { ResponseData } from '@src/models/ResponseData';
import { DriverRepo } from '@src/repo/deliveryApp/driver';
import { EmployeeRepo } from '@src/repo/admin/employee.repo';
import { Request, Response, NextFunction, response } from 'express';
import { ValidationException } from '@src/utilts/Exception';

export class AuthController {

    public static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const login = await DriverRepo.loginTest2(req.body);

            if (login.success) {
                res.cookie('jwt', login.data.refreshToken, {
                    httpOnly: true,
                    sameSite: 'none',
                    path: '/',
                    secure: true,
                    maxAge: 24 * 60 * 60 * 1000
                });
            }

            if (login.success) {
                return res.status(200).json(login)
            } else {
                res.status(401).json(login)
            }
        } catch (err: any) {
            const error: any = new Error(err.message);
            error.statusCode = 401;
            throw error;
        }
    }

    public static async checkOTP(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body

            let sections = await EmployeeRepo.checkOTP(data)

            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {

            const email = req.body.email

            let sections = await EmployeeRepo.checkEmployeeEmail(email, req.headers.host ?? null)

            return res.send(sections)
        } catch (error: any) {
              throw error
        }
    }

    public static async setNewPassword2(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user;

            const data = req.body;
            let sections = await EmployeeRepo.setNewPassword2(data)

            return res.send(sections)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }

    public static async authenticate(req: Request, res: Response, next: NextFunction) {
        try {
            const accessToken = req.headers['api-auth'] as string;

            if (!accessToken || accessToken.trim() === "") {
                return res.status(401).json(new ResponseData(false, "Unauthorized - No token", []));
            }

            // 1. Decode and validate the access token
            const auth = await AuthRepo.authenticate(accessToken);
            console.log(auth)
            if (!auth?.success) {
                return res.status(401).json(new ResponseData(false, "Unauthorized - Invalid token", []));
            }

            const { employeeId, companyId, company } = auth.data;

            // 2. Get employee email
            const emailResult = await EmployeeRepo.getEmployeeEmail(employeeId, null);
            const email = emailResult?.email;
            const branches = emailResult?.branches ?? [];

            if (!email) {
                return res.status(401).json(new ResponseData(false, "Unauthorized - No email found", []));
            }

            // 3. Enforce single device login via Redis
            const storedToken = await AuthRepo.getRedis(`session:${email.toLowerCase()}`);
            if (storedToken !== accessToken) {
                return res.status(401).json(new ResponseData(false, "Unauthorized - You have been logged out due to another loggin", []));
            }

            // ✅ 4. Check shift *only if URL is not  = /startShift or /logout *
            const url = req.originalUrl.toLowerCase();
            if (!url.includes("/startshift") && !url.includes("/logout")) {
                const activeShiftId = await DriverRepo.checkEmployeeInShift(null, employeeId);
                if (!activeShiftId) {
                    return res.status(401).json(new ResponseData(false, "Unauthorized - Shift expired", []));
                }
            }

            // 5. Enforce access to at least one branch
            const branchIds = branches.map((b: any) => b.id);
            if (branchIds.length === 0) {
                return res.status(401).json(new ResponseData(false, "Unauthorized - No branch access", []));
            }

            // ✅ Success: attach user info to response
            res.locals.user = employeeId;
            res.locals.company = company;
            res.locals.companyId = companyId;
            res.locals.branches = branchIds;

            return next();
        } catch (error: any) {
            console.error("Authentication error:", error);
            const err:any = new Error(error.message)
            err.statusCode = 401
            throw err 
        }
    }

    public static async refreshToken(req: Request, res: Response, next: NextFunction) {
        try {
            const refreshTokendata = req.body['refreshToken']
            const data = req.body;
            const refreshToken = await AuthRepo.refreshToken(refreshTokendata);
            if (refreshToken?.success) {
                return res.send(refreshToken);
            } else {
                return res.status(401).send(refreshToken);
            }

        } catch (error:any) {
         const err:any = new Error(error.message)
            err.statusCode = 401
            throw err 
        }
    }

    public static async testHash(req: Request, res: Response, next: NextFunction) {
        try {

            const pass = "123456";

            return res.send(await AuthRepo.hashPassword(pass))
        } catch (error: any) {
           const err:any = new Error(error.message)
            err.statusCode = 401
            throw err 
        }
    }






    // public static async logInShopper(req: Request, res: Response, next: NextFunction) {
    //     try {
    //         let sessionId = req.sessionID;
    //         let data = req.body;
    //         let shopper = await AuthRepo.logInShopper(data,sessionId)

    //         res.send(shopper)
    //     } catch (error:any) {
    //         return res.status(401).send(new ResponseData(false, error.message, []))
    //     }
    // }



}



















