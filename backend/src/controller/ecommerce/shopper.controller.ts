import { ResponseData } from '@src/models/ResponseData';
import { ShopperRepo } from '@src/repo/ecommerce/shopper.repo';
import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { sign, verify } from 'jsonwebtoken'
import { RedisClient } from "@src/redisClient";
export class ShopperController {

    public static async logIn(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let responseDate = await ShopperRepo.loginWithPassword(data, company)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }

    public static async setOtp(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const userSessionId = res.locals.userSessionId
            let responseDate = await ShopperRepo.setOtp(data, company, userSessionId)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }

    public static async validateOtp(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const userSessionId = res.locals.userSessionId
            let responseDate = await ShopperRepo.checkOTP(data, userSessionId, company)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }

    public static async registration(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let responseDate = await ShopperRepo.saveShopper(data, company)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }

    public static async logOut(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let responseDate = await ShopperRepo.logOut(data, company)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }
    public static async getLoggedInUser(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.getLoggedInUser(sessionId, company)

            return res.send(responseDate)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }

    public static async logInWithGoogle(req: Request, res: Response, next: NextFunction) {
        try {

            let company = res.locals.company;

            passport.authenticate('google', function (err: string, user: boolean, info: any) {
                if (err) { return next(err); }
                if (!user) { return res.status(404).json(new ResponseData(false, info.message, [])); }
                req.logIn(user, function (err) {
                    if (err) { return next(err); }
                    return res.status(200).json(new ResponseData(true, 'Logged in successfully', req.user));
                });
            })(req, res, next);
        } catch (error: any) {
              throw error
        }
    }


    public static async logInWithApple(req: Request, res: Response, next: NextFunction) {
        try {
            let company = res.locals.company;
            passport.authenticate('apple', function (err: string, user: boolean, info: any) {
                if (err) { return next(err); }
                if (!user) { return res.status(404).json(new ResponseData(false, info.message, [])); }
                req.logIn(user, function (err) {
                    if (err) { return next(err); }
                    return res.status(200).json(new ResponseData(true, 'Logged in successfully', req.user));
                });
            })(req, res, next);
        } catch (error: any) {
              throw error
        }
    }


    public static async authinticateLogin(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;

            const accessToken: any = req.headers['auth-token'];

            if (accessToken) // no user loggedIn 
            {
                const verified: any = verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string,
                    (err: any, decoded: any) => {
                        if (err) {
                            console.log(err)

                            // Wrong Refesh Token
                            return new ResponseData(false, "Unauthorized", [])
                        }
                        else {
                            // Correct token we send a new access token
                            return new ResponseData(true, "", decoded)
                        }


                    });
                if(verified &&  verified.success && verified.data)
                {
                    let payload  = verified.data
             
                    if(company.id != payload.companyId)
                    {   
                    
    
                        let redisClient = RedisClient.getRedisClient();

                        // redisClient.deletKey('Shopper' + payload.userSessionId + payload.companyId)
                        // redisClient.deletKey('Shopper_OTP' + payload.userSessionId + payload.companyId)
                    } else {
                        res.locals.userSessionId = payload.userSessionId
                    }

                }

            }


            next()

        } catch (error: any) {
            console.log(error)
              throw error
        }
    }


    public static async updateShopper(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const sessionId = res.locals.userSessionId;
            const company = res.locals.company;
            let responseDate = await ShopperRepo.updateShoppr(data, sessionId, company)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }

    public static async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.setNewPassword(data, company)

            return res.send(responseDate)
        } catch (error: any) {

              throw error
        }
    }

    public static async subscribe(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.subscribeNotification(data, company, sessionId)

            return res.send(responseDate)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }


    public static async shopperOrderHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.getShopperOrdersHistory(data, sessionId, company)

            return res.send(responseDate)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }



    public static async getShopperOrderById(req: Request, res: Response, next: NextFunction) {
        try {
            const orderId = req.params.orderId;
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.getShopperOrderById(orderId, sessionId, company)

            return res.send(responseDate)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }


      public static async updateShopperPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.updatePassword(data, sessionId, company)
            return res.send(responseDate)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }


        public static async updateShopperEmailPhone(req: Request, res: Response, next: NextFunction) {
        try {
        
            const company = res.locals.company;
            const sessionId = res.locals.userSessionId;
            let responseDate = await ShopperRepo.updateShopperPhoneEmail( sessionId, company)
            return res.send(responseDate)
        } catch (error: any) {
            console.log(error)
              throw error
        }
    }
}