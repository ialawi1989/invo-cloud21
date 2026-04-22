
import { ResponseData } from '@src/models/ResponseData';
import { AuthRepo } from '@src/repo/app/auth.repo';
import { WhatsAppAuthRepo } from '@src/repo/Integration/whatsapp/auth';
import { Request, Response, NextFunction, } from 'express';
import { whatsappOrderController } from '../ecommerce/whatsappOrder.controller';
import { Company } from '@src/models/admin/company';
import crypto from "crypto-js"
import { DB } from '@src/dbconnection/dbconnection';
import { EmployeeRepo } from '@src/repo/admin/employee.repo';
import { FileStorage } from "@src/utilts/fileStorage";
import { Helper } from '@src/utilts/helper';
import { UserSessionRepo } from './user_session_repo';
export class AuthController {

    public static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const login = await AuthRepo.login(req.body, req);

            if (login && login.success) {
                AuthController.setCookies(res, login.data.refreshToken)
            
                delete login.data.refreshToken;

            }


            console.log(login)
            if (login && login.success) {
                return res.status(200).json(login)
            } else {
                res.status(401).json(login)
            }
        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }
    }



    public static setCookies(res: Response, refreshToken: string) {
        try {
            const isLocal = process.env.NODE_ENV === "local";

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: !isLocal,                   // true in production, false locally
                sameSite: isLocal ? "lax" : "strict", // lowercase
                maxAge: 7 * 24 * 60 * 60 * 1000     // 7 days
            });
        } catch (error) {
            throw error
        }
    }

    public static async validate2FCode(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const employeeId = res.locals.employeeId

            const login = await AuthRepo.validate2FCode(data.code, employeeId);

            if (login && login.success) {
                AuthController.setCookies(res, login.data.refreshToken)
                delete login.data.refreshToken;
            }

            return res.send(login)
        } catch (error: any) {
            throw error
        }
    }
    public static async validateEmail(req: Request, res: Response, next: NextFunction) {
        try {

            const email = req.params.email;
            const employeeId = res.locals.employeeId


            // In a real app, validate the token here

            const emp = (await EmployeeRepo.getEmployeeEmail(employeeId))


            if (emp.isEmailValidated == true) {
                return res.status(200).send('Email already verified.');
            }


            if (email) {

                const query: { text: string, values: any } = {
                    text: `update  "Employees" set "isEmailValidated" = true where email = $1 returning id`,
                    values: [email]
                }

                const employeeData = await DB.excu.query(query.text, query.values);

                if ((<any>employeeData.rows[0]).id) {
                    return res.status(200).json({ message: `Email ${email} validated successfully!` });
                }


            }

            return res.status(400).json({ message: "Invalid email." });




        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }
    }

    public static async set2FA(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.employeeId
            const accessToken: any = req.headers['api-auth'];

            const login = await AuthRepo.set2FA(employeeId, accessToken, req);

            if (login && login.success) {
                AuthController.setCookies(res, login.data.refreshToken)
                delete login.data.refreshToken;
            }

            return res.send(login)

        } catch (error: any) {
            throw error
        }
    }

    public static async reset2fa(req: Request, res: Response, next: NextFunction) {
        try {

            const employeeId = res.locals.employeeId

            let sections = await AuthRepo.reset2fa(employeeId)

            console.log("(>>>>>>>>>>>>>)", sections)

            return res.send(sections)
        } catch (error: any) {
            throw error
        }
    }


    public static async validateOTP(req: Request, res: Response, next: NextFunction) {
        try {

            const employeeId = res.locals.employeeId


            let sections = await AuthRepo.validateOTP(req, employeeId)

            return res.send(sections)
        } catch (error: any) {
            throw error
        }
    }



    public static async adminLogin(req: Request, res: Response, next: NextFunction) {
        try {
            const login = await AuthRepo.adminLogin(req.body);

            if (login.success) {
                AuthController.setCookies(res, login.data.refreshToken)
                delete login.data.refreshToken;
            }

            if (login.success) {
                return res.status(200).json(login)
            } else {
                res.status(401).json(login)
            }
        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
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
    public static async authintcate(req: Request, res: Response, next: NextFunction) {
        try {
            const accessToken: any = req.headers['api-auth'];


            if (accessToken == "" || accessToken == null) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
            const auth = await AuthRepo.authenticate(accessToken);



            if (auth?.success) {

                // const employeeId = auth.data.employeeId;
                // const device_id = auth.data.deviceId;
                // const validate = await UserSessionRepo.validateDeviceSession(employeeId, device_id)
                // if (!validate) {
                //     return res.status(401).json(new ResponseData(false, "Unauthorized", []))
                // }
                const email = await EmployeeRepo.getEmployeeEmail(auth.data.employeeId, auth.data.company.id)
                const branches = email.branches ?? [];
                let branchesTemp: any[any] = [];

                branches.forEach((element: any) => {
                    branchesTemp.push(element.id

                    )
                });


                if (email.email) {

                    // let token = await AuthRepo.getToken('loggedInToken' + email);
                    // if (token) {

                    //     if (token !== accessToken && process.env.NODE_ENV != 'local') {
                    //         return res.status(401).json(new ResponseData(false, "Unauthorized", []))
                    //     }
                    // }
                }
                res.locals.user = auth.data.employeeId;
                res.locals.email = email.email;
                res.locals.company = auth.data.company
                res.locals.companyId = auth.data.companyId;
                res.locals.branches = branchesTemp;

                if (branchesTemp == null || branchesTemp.length == 0) {
                    return res.status(401).json(new ResponseData(false, "Unauthorized User Has No Access On Any Branches", []))
                }

                next();
            } else {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
        } catch (error: any) {
            console.log(error)
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }

    }


    public static async authintcateForCompanyGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const accessToken: any = req.headers['api-auth'];

            if (accessToken == "" || accessToken == null) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
            const auth = await AuthRepo.authenticate(accessToken);

            if (auth?.success) {
                const email = await EmployeeRepo.getCompanyEmployeeAccess(auth.data.employeeId, null)
                const branches = email.branches ?? [];
                let branchesTemp: any[any] = [];

                branches.forEach((element: any) => {
                    branchesTemp.push(element.id)
                });

                res.locals.user = auth.data.employeeId;
                res.locals.company = auth.data.company
                res.locals.companyId = auth.data.companyId;
                res.locals.companyIds = email.companyIds;
                res.locals.branches = branchesTemp;

                if (branchesTemp == null || branchesTemp.length == 0) {
                    return res.status(401).json(new ResponseData(false, "Unauthorized User Has No Access On Any Branches", []))
                }

                next();
            } else {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
        } catch (error: any) {
            console.log(error)
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }

    }

    public static async tempAuthintcate(req: Request, res: Response, next: NextFunction) {
        try {
            let accessToken: any = req.headers['api-auth'];


            if (req.url.split('/')[1] === 'validateEmail') {
                console.log(req.params.token)
                accessToken = req.params.token ?? null

            }




            if (accessToken == "" || accessToken == null) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
            const auth = await AuthRepo.tempAuthenticate(accessToken);
            const auth2 = await AuthRepo.authenticate(accessToken);


            if (auth?.success) {
                res.locals.employeeId = auth.data.employeeId;
                next();
            } else if (auth2?.success) {
                res.locals.employeeId = auth2.data.employeeId;
                next();

            } else {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }

    }





    public static async publicApiAuthintcate(req: Request, res: Response, next: NextFunction) {
        try {
            const accessToken: any = req.headers['api-auth'];

            if (accessToken == "" || accessToken == null) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
            const auth = await AuthRepo.authenticatePublicApi(accessToken);

            if (auth?.success) {
                const storage = new FileStorage();
                let companySetting = (await storage.getCompanySettings(auth.data.company.country))?.settings

                let company = auth.data.company
                company.afterDecimal = companySetting.afterDecimal
                company.timeOffset = companySetting.timeOffset
                company.companyId = auth.data.company.id;
                company.setting = companySetting;
                // res.locals.company.afterDecimal = companySetting.afterDecimal
                // res.locals.company.timeOffset = companySetting.timeOffset
                // res.locals.company = auth.data.company

                res.locals.company = company;
                res.locals.companyId = company.id;
                next();
            } else {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
        } catch (error: any) {
            console.log(error);
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }

    }





















    public static async authintcateAdmin(req: Request, res: Response, next: NextFunction) {
        try {
            const accessToken: any = req.headers['auth-token'];

            if (accessToken == "" || accessToken == null) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
            const auth = await AuthRepo.authenticate(accessToken);

            if (auth?.success) {
                res.locals.admin = auth.data.adminId;

                next();
            } else {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }

    }




    public static async refreshToken(req: Request, res: Response, next: NextFunction) {
        try {
            const refreshTokendata = req.cookies['refreshToken']
            if (!refreshTokendata) return res.status(403).send("Unauthorized");
            const refreshToken = await AuthRepo.refreshToken(refreshTokendata);
            if (refreshToken?.success) {
                return res.send(refreshToken);
            } else {
                return res.status(403).send(refreshToken);
            }

        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }
    }

    public static async testHash(req: Request, res: Response, next: NextFunction) {
        try {

            const pass = "123456";

            return res.send(await AuthRepo.hashPassword(pass))
        } catch (error: any) {
            const err: any = new Error(error.message)
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






    public static async Whatsappauthintcate(req: Request, res: Response, next: NextFunction) {
        try {
            const Credenctial: any = await WhatsAppAuthRepo.getCredential("whatsApp", res.locals.company);
            const company = res.locals.company
            Credenctial.password = crypto.AES.decrypt(Credenctial.password, company.id).toString(crypto.enc.Utf8)
            const credentials = `${Credenctial.username}:${Credenctial.password}`;
            const base64Credentials = btoa(credentials);
            // const authHeader = `Basic ${base64Credentials}`;
            req.headers['Authorization'] = base64Credentials;
            next();

        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }

    }

    public static async checkLoggedInToken(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const accessToken: any = req.headers['api-auth'];

            if (accessToken == null) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))

            }
            const check = await AuthRepo.checkLoggedInToken(accessToken, employeeId);
            if (!check.success) {
                return res.status(401).json(new ResponseData(false, "Unauthorized", []))
            }
            return res.send(check)
        } catch (error: any) {
            const err: any = new Error(error.message)
            err.statusCode = 401
            throw err
        }
    }

    public static async authinticateBranches(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;

            let branchId = data.branchId;

            let branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : null;

            let employeeBranches = res.locals.branches;

            if (branchId) {
                let branch = employeeBranches.find((f: any) => f == branchId)
                console.log(branch)
                if (!branch) {
                    req.body.branchId = null
                }
            } else if (branches && branches.length > 0) {
                let intersection = employeeBranches.filter((value: any) => branches.includes(value));
                console.log(intersection)
                if (intersection.length > 0) {
                    req.body.filter.branches = intersection
                } else {

                    req.body.filter.branches = []
                }
            }
            next()
        } catch (error: any) {
            console.log(error);
            next()
        }
    }
    public static async revokeDevice(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const device_id = req.params.deviceId
            let data = await UserSessionRepo.revokeSession(employeeId, device_id)
            return res.send(data)
        } catch (error: any) {
            return res.status(401).send(new ResponseData(false, error.message, []))
        }
    }

    public static async userSessions(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            let data = await UserSessionRepo.getUserSessions(employeeId)
            return res.send(data)
        } catch (error: any) {
            return res.status(401).send(new ResponseData(false, error.message, []))
        }
    }

    public static async logOut(req: Request, res: Response, next: NextFunction) {
        try {
            const accessToken: any = req.headers['api-auth'];
            const refreshTokendata = req.cookies['refreshToken']
            if (!refreshTokendata && !accessToken) return res.status(401).send(new ResponseData(false, 'Unauthorized', []))
            let data = await UserSessionRepo.logOut(refreshTokendata ?? accessToken)
            return res.send(data)
        } catch (error: any) {
            return res.status(401).send(new ResponseData(false, error.message, []))
        }
    }

    public static async acceptTermAndConditions(req: Request, res: Response, next: NextFunction) {
        try {
            const pendingToken: any = req.headers['pending-token'];
            const body = req.body;
            if (!pendingToken) return res.status(401).send(new ResponseData(false, 'Unauthorized', []))
            let data = await AuthRepo.acceptTermAndConditions(body, pendingToken)
            return res.send(data)
        } catch (error: any) {
            return res.status(401).send(new ResponseData(false, error.message, []))
        }
    }
}



















