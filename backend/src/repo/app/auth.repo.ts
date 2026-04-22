

import { sign, verify } from 'jsonwebtoken'

import { ResponseData } from "@src/models/ResponseData";
import { AuthValidation } from "@src/validationSchema/auth.Schema";
import { DB } from "@src/dbconnection/dbconnection";


import { CompanyRepo } from '../admin/company.repo';
import { HashingALgorithm } from '@src/utilts/hashing';



import { RedisClient } from '@src/redisClient';
import { ValidationException } from '@src/utilts/Exception';
import { EmployeeRepo } from '../admin/employee.repo';

import speakeasy from 'speakeasy';
import qrcode from 'qrcode'
import { Helper } from '@src/utilts/helper';
import { SesService } from '@src/utilts/SES';
import { Request } from 'express';
import { CloudwebPushRepo } from '@src/controller/app/webpush/webPush.repo';
import { CreateEmployeeSessionInput } from '@src/models/UserSession';
import { UserSessionRepo } from '@src/controller/app/user_session_repo';
import { TermAndConditionsRepo } from './terms&conditions.repo';


export class AuthRepo {
    public static async login(data: any, req: Request) {
        const email = data.email.trim().replace(/\s+/g, '');
        let count = 0;
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const ipLast = Helper.getClientIp(req);
            const remeberMe = data.remeberMe
            //CHECK IF EXCEEDED FAIL ATTEMPT => IF FAILD ATTEMPT IS GREATED IS 3 THEN RETIRN IF NO KEY THEN PORCEED 
            // IF FAILED ATTEMTP IS LESS THAN2 PROCEED IF SUCCESSFULLY THEN DELETE KEY 


            let faildAttempt = await this.getRedisLoginAttempt(email)
            let isLocked = await this.getLocked(email)

            if (isLocked) {
                await this.deleteAttempts(email)
                return new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])
            }
            if (faildAttempt) {
                if (Number(faildAttempt) >= 2) {
                    await this.setLocked(email, 30)
                }
                count = Number(faildAttempt) + 1
                if (count >= 3) {
                    return new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])

                }
            }

            const validate = await AuthValidation.validateAuth(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            // const employee = new Employee();
            // employee.ParseJson(data);
            const hasedPassword = await this.hashPassword(data.password)


            const query: { text: string, values: any } = {
                text: `SELECT "Employees".id,
                              "Employees"."apply2fa"
                        FROM "Employees" 
                        WHERE LOWER(email)=LOWER($1) AND password=$2`,
                values: [email, hasedPassword]
            }
            const isEmployeeExist = await DB.excu.query(query.text, query.values);

            if (isEmployeeExist.rows.length > 0) {

                const employeeId = (<any>isEmployeeExist.rows[0]).id
                let apply2fa = (<any>isEmployeeExist.rows[0]).apply2fa

                /*  
                    applay2fa = null --> ask the user if he want to apply 2fa
                    applay2fa = false --> return accesstoken
                    applay2fa = true --> return employeeId , code --> validate2FCode --> return access token
                */

                if (employeeId) {
                    await this.deleteAttempts(email)
                    if (employeeId) {
                        await this.deleteAttempts(email)

                        if (!apply2fa) {
                            const reqireTermsAcceptence = await TermAndConditionsRepo.getActiveTerms();

                            if (reqireTermsAcceptence) {
                                const userAcceptedVersion = await TermAndConditionsRepo.getUserAcceptedVersion(employeeId);
                                const acceptedVersion = userAcceptedVersion?.accepted_terms_version;
                                const needsAccept = !acceptedVersion || acceptedVersion !== reqireTermsAcceptence.version;
                                if (needsAccept) {

                                    if (needsAccept) {
                                        const pendingLoginToken = Helper.signPendingLoginToken({ userId: employeeId, termsVersion: reqireTermsAcceptence.version, ip: ipLast, user_agent: data.device?.userAgent });
                                        return new ResponseData(true, "", {
                                            code: "TERMS_REQUIRED",
                                            pendingLoginToken,
                                            terms: {
                                                version: reqireTermsAcceptence.version,
                                                title: reqireTermsAcceptence.title,
                                                content_md: reqireTermsAcceptence.content_md,
                                                published_at: reqireTermsAcceptence.published_at,
                                            },
                                        });
                                    }
                                }

                            }
                        }



                        // apply2fa = false
                        if (apply2fa === true) {
                            const tokens = await CompanyRepo.getTempToken({ employeeId: employeeId })

                            return new ResponseData(true, "Enter 2FA code", { apply2fa: true, employeeId: employeeId, temporaryAccessToken: tokens?.temporaryAccessToken })
                        }
                        // else if(apply2fa === null || apply2fa === "" || apply2fa === undefined ){
                        //     const tokens = await CompanyRepo.getTempToken({employeeId:employeeId})

                        //     return new ResponseData(true, "", { apply2fa: null, employeeId:employeeId , temporaryAccessToken: tokens?.temporaryAccessToken }) 

                        // }
                        else {

                            const resault: any = await EmployeeRepo.getEmployeeLoginData(employeeId, client)

                            if (data.device) {
                                const input: any = {
                                    employeeId: employeeId,
                                    companyId: resault.data.companyId,
                                    email: "",
                                    password: "",

                                    device: {
                                        deviceId: data.device.deviceId,
                                        deviceName: data.device.deviceName ?? null,
                                        platform: data.device.platform ?? "web",
                                        appVersion: data.device.appVersion ?? null,
                                        userAgent: data.device.userAgent ?? req.headers["user-agent"] ?? null,
                                        ipLast: ipLast,
                                    },
                                }

                                const device = await CloudwebPushRepo.addEmployeeDevice(client, input)
                                resault.data.deviceId = device.devicePk

                            }
                            const tokens = await CompanyRepo.getToken(resault.data, remeberMe)

                            if (tokens) {

                                await client.query("COMMIT")
                                if (resault.data.deviceId) {
                                    const session: CreateEmployeeSessionInput = {
                                        employeeId: employeeId,
                                        deviceId: resault.data.deviceId,
                                        refreshTokenHash: this.hashPassword(tokens.refreshToken),
                                        refreshTokenExpiryDate: tokens.refreshTokenExpiryDate
                                    }
                                    await UserSessionRepo.insertUserSession(client, session)
                                }

                                return new ResponseData(true, "", { apply2fa: false, refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: resault.employee })

                            }
                            await client.query("COMMIT")
                            return new ResponseData(false, "Wrong Email Or Password", [])
                        }


                    } else {
                        await this.setRedisLoginAttempt(email, count)
                        await client.query("COMMIT")
                        return new ResponseData(false, "Wrong Email Or Password", [])
                    }

                } else {
                    await this.setRedisLoginAttempt(email, count)
                    await client.query("COMMIT")
                    return new ResponseData(false, "Wrong Email Or Password", [])
                }

            }else{
                return new ResponseData(false,"Invalid Email Or Password",[])
            }
        } catch (error: any) {
            await client.query("RollBack")
            // await this.setRedisLoginAttempt(email,count)


            console.log(error)


            throw new Error(error.message)
        } finally {

            client.release()
        }


    }

    public static async adminLogin(data: any) {
        const email = data.email.trim().replace(/\s+/g, '');
        let count = 0;
        try {




            //CHECK IF EXCEEDED FAIL ATTEMPT => IF FAILD ATTEMPT IS GREATED IS 3 THEN RETIRN IF NO KEY THEN PORCEED 
            // IF FAILED ATTEMTP IS LESS THAN2 PROCEED IF SUCCESSFULLY THEN DELETE KEY 

            const validate = await AuthValidation.validateAuth(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            // const employee = new Employee();
            // employee.ParseJson(data);
            const hasedPassword = await this.hashPassword(data.password)
            const query: { text: string, values: any } = {
                text: `SELECT "admins".name , "admins".id
                               FROM "admins" 
                      WHERE LOWER(email)=LOWER($1) AND password=$2`,
                values: [email, hasedPassword]
            }
            const isEmployeeExist = await DB.excu.query(query.text, query.values);
            if (isEmployeeExist.rows.length > 0) {
                const employeeId = (<any>isEmployeeExist.rows[0]).id
                const admiName = (<any>isEmployeeExist.rows[0]).name

                const data = {
                    employeeId: employeeId,
                    adminId: employeeId,
                    admiName: admiName
                }
                const tokens = await CompanyRepo.getToken(data)

                if (tokens && employeeId) {
                    console.log("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                    // await this.deleteAttempts(email)
                    // await this.setToken("loggedInToken" + email, tokens.accessToken)
                    return new ResponseData(true, "", { accessToken: tokens.accessToken, admin: isEmployeeExist.rows[0] })

                } else {
                    // await this.setRedisLoginAttempt(email, count)
                    return new ResponseData(false, "Wrong Email Or Password", [])
                }
            } else {
                // await this.setRedisLoginAttempt(email, count)
                return new ResponseData(false, "Wrong Email Or Password", [])
            }
        } catch (error: any) {

            // await this.setRedisLoginAttempt(email,count)
            console.log(error)


            return new ResponseData(false, error, []);
        }


    }

    public static async authenticate(accessToken: string) {
        try {



            const verified = verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string,
                (err: any, decoded: any) => {
                    if (err) {


                        // Wrong Refesh Token
                        return new ResponseData(false, "Unauthorized", [])
                    }
                    else {
                        // Correct token we send a new access token
                        return new ResponseData(true, "", decoded)
                    }
                });

            return verified
        } catch (error) {

            console.log("erorrrrrrrrrrrrrrrrrrr")


            return new ResponseData(false, "Unauthorized", [])
        }
    }



    public static async authenticateRefereshToken(accessToken: string) {
        try {



            const verified = verify(accessToken, process.env.REFRESH_TOKEN_SECRET as string,
                (err: any, decoded: any) => {
                    if (err) {


                        // Wrong Refesh Token
                        return new ResponseData(false, "Unauthorized", [])
                    }
                    else {
                        // Correct token we send a new access token
                        return new ResponseData(true, "", decoded)
                    }
                });

            return verified
        } catch (error) {

            console.log("erorrrrrrrrrrrrrrrrrrr")

            return new ResponseData(false, "Unauthorized", [])
        }
    }

    public static async authenticatePublicApi(accessToken: string) {
        try {
            const verified = verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string,
                async (err: any, decoded: any) => {
                    if (err) {
                        // Wrong Refesh Token
                        return new ResponseData(false, "Unauthorized", [])
                    }
                    else {
                        // Correct token we send a new access token
                        const query: { text: string, values: any } = {
                            text: `SELECT count(*) from "Companies" c  where id = $1 and "apiToken" = $2`,
                            values: [decoded.company.id, accessToken]
                        }

                        const isExist = (<any>await DB.excu.query(query.text, query.values)).rows[0].count;
                        if (isExist) {
                            return new ResponseData(true, "", decoded)
                        } else {
                            return new ResponseData(false, "Unauthorized", [])
                        }

                    }
                });

            return verified
        } catch (error) {


            return new ResponseData(false, "Unauthorized", [])
        }
    }

    public static async refreshToken(refreshToken: string) {
        try {

            const decoded: any = verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string)
            if (decoded == null) {
                return new ResponseData(false, "Unauthorized", [])
            }
            const validate = await UserSessionRepo.validateDeviceSession(decoded.employeeId, decoded.deviceId)
            if (!validate) {
                throw new Error("Invalid Referesh Token")
            }
            const resault: any = await EmployeeRepo.getEmployeeLoginData(decoded.employeeId)
            const tokens = await CompanyRepo.getToken(resault.data)
            if (tokens) {
                return new ResponseData(true, "", { accessToken: tokens.accessToken })
            }

            return new ResponseData(false, "", { accessToken: null })
        } catch (error: any) {

            return new ResponseData(false, error, [])
        }

    }

    public static hashPassword(password: string) {
        try {
            const hash = new HashingALgorithm();
            hash.hashPassword(password);
            return hash.hashedValue;

        } catch (error: any) {


            throw new Error(error.message)
        }
    }


    public static async setRedisLoginAttempt(email: string, count: number) {
        try {
            let redisInstant = RedisClient.getRedisClient();
            await redisInstant.set("faildAttempt" + email, count, 60)

        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getRedisLoginAttempt(email: string) {
        try {
            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.get("faildAttempt" + email)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getExpireTimeLeft(email: string) {
        try {
            let redisInstant = RedisClient.getRedisClient();
            if (redisInstant.client == null) return;
            return await redisInstant.client.ttl("faildAttempt" + email)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async setLocked(email: string, time: number) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.set("lock" + email, JSON.stringify({ locked: true }), time)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async setToken(key: string, token: string) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.set(key, JSON.stringify({ token: token }))
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getToken(key: string) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            let tokenData = await redisInstant.get(key);
            let token;
            if (tokenData != null || tokenData != undefined) {
                token = JSON.parse(tokenData);
                token = token.token;
            }

            return token
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getLocked(email: string) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.get("lock" + email)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async deleteAttempts(email: string) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.deletKey("faildAttempt" + email)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async checkLoggedInToken(accessToken: string, employeeId: string) {
        try {
            const email = await EmployeeRepo.getEmployeeEmail(employeeId);
            if (email) {
                const token = await this.getToken('loggedInToken' + email)
                if (accessToken != token) {
                    return new ResponseData(false, "Unauthorized", [])
                }
            }

            return new ResponseData(true, "", [])

        } catch (error: any) {
            throw new Error(error)
        }
    }






    public static async setRedis(key: string, value: any, expireAt?: number) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.set(key, JSON.stringify(value), expireAt)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getRedis(key: string) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            let redisData = await redisInstant.get(key);
            let res;
            if (redisData != null || redisData != undefined) {
                res = JSON.parse(redisData);
            }

            return res
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async deleteRedis(key: string) {
        try {

            let redisInstant = RedisClient.getRedisClient();
            return await redisInstant.deletKey(key)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async set2FA(employeeId: string, accessToken: string, req: Request) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            let qr
            let secret
            const ipLast = Helper.getClientIp(req);
            const data = req.body;
            const apply2fa = data.apply2fa
            const code = data.code
            if (!employeeId) throw new ValidationException("employeeId is required")
            let userHas2fa = await EmployeeRepo.checkIfEmployeeHas2fa(employeeId)

            if (userHas2fa === true) {
                if (!code) { throw new ValidationException("2fa code is required") }
                const validate2FCode = await this.validate2FCode(req, employeeId)
                if (validate2FCode && !validate2FCode.success) { return validate2FCode }

            }

            // Generate a secret for the user
            if (apply2fa === true) {
                if (apply2fa === true) {

                    const emp = (await EmployeeRepo.getEmployeeEmail(employeeId))

                    const email = emp.email
                    if (emp.isEmailValidated != true) {

                        const url = process.env.APP_BASE_URL + `/validateEmail/${email}/${accessToken}`;
                        if (emp.isEmailValidated != true) {

                            const url = process.env.APP_BASE_URL + `/validateEmail/${email}/${accessToken}`;
                            let redirectUrl = "";
                            // if (httpString) {
                            //     if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
                            //     redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1] 
                            //     } else {
                            //     redirectUrl = httpString[0] + '//' + httpString[1] 
                            //     }
                            // }



                            // const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;


                            const validationLink = `http://localhost:3001/v1/app/validateEmail?email=${encodeURIComponent(email)}`;
                            const subject = "Verify Your Email";
                            const htmlContent =
                                `
                                < p > Hello,</p>
                                    < p > Thank you for signing up! Please click the button below to verify your email address.</p>
                                        < p >
                                        <a href="${url}", style = "display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;" >
                                            Validate Email
                                                </a>
                                                </p>
                                                < p > This link will expire in 24 hours.</p>
                                                    < p > If you did not sign up for this account, you can ignore this email.</p>
                                                        < p > Sincerely, <br>Your Application Team </p>
                                                            `

                            await EmployeeRepo.sendEmailToEmployee(employeeId, subject, htmlContent, true)
                            throw new ValidationException("Check your email inbox to verify your email address.")
                        }
                        throw new ValidationException("Check your email inbox to verify your email address.")
                    }

                    secret = speakeasy.generateSecret({
                        name: `InvoPos(${email})`
                    });

                    this.setRedis(employeeId + "_2fa", { "secretKey": secret }, 60)


                    this.setRedis(employeeId + "_2fa", { "secretKey": secret }, 60)

                }
                else {
                    const employeeTOTP = await EmployeeRepo.setEmployeeTOTP(employeeId, apply2fa)

                }




                // Generate QR Code for Google Authenticator
                if (secret && secret.otpauth_url) { qr = await qrcode.toDataURL(secret.otpauth_url); }
                const tokens = await CompanyRepo.getTempToken({ employeeId: employeeId })

                if (apply2fa === true) {
                    return new ResponseData(true, "", { code: secret?.base32, qrCode: qr, employeeId: employeeId, temporaryAccessToken: tokens?.temporaryAccessToken })
                } else {
                    const resault: any = await EmployeeRepo.getEmployeeLoginData(employeeId)
                    if (data.device) {
                        const input: any = {
                            employeeId: employeeId,
                            companyId: resault.data.companyId,

                            device: {
                                deviceId: req.body.device.deviceId,
                                deviceName: req.body.device.deviceName ?? null,
                                platform: req.body.device.platform ?? "web",
                                appVersion: req.body.device.appVersion ?? null,
                                userAgent: req.body.device.userAgent ?? req.headers["user-agent"] ?? null,
                                ipLast: ipLast,
                            },
                        }
                        const device = await CloudwebPushRepo.addEmployeeDevice(client, input)
                        resault.data.deviceId = device.devicePk
                    }

                    const tokens = await CompanyRepo.getToken(resault.data)


                    if (tokens) {
                        if (resault.data.deviceId) {
                            const session: CreateEmployeeSessionInput = {
                                employeeId: employeeId,
                                deviceId: resault.data.deviceId,
                                refreshTokenHash: this.hashPassword(tokens.refreshToken),
                                refreshTokenExpiryDate: tokens.refreshTokenExpiryDate
                            }
                            await UserSessionRepo.insertUserSession(client, session)
                        }
                        await client.query("COMMIT")
                        return new ResponseData(true, "", { refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: resault.employee })

                    }
                    else {
                        await client.query("COMMIT")
                        return new ResponseData(false, "", {})
                    }
                }



            }
        } catch (error: any) {
            await client.query("ROLLBACK")
            // await this.setRedisLoginAttempt(email,count)
            console.log(error)


            throw new Error(error.message)
        } finally {
            client.release()
        }


    }

    public static async reset2fa(employeeId: string) {
        try {

            let redisClient = RedisClient.getRedisClient();

            const query: { text: string, values: any } = {
                text: `SELECT "Employees".id, "Employees".name, email, "Companies".name as "companyName", "Companies".slug as "companySlug", "apply2fa"
                      FROM "Employees" 
                      Inner join "Companies"  on "Employees"."companyId" = "Companies".id
                      where "Employees".id = $1`,
                values: [employeeId]
            }

            const employeeData = await DB.excu.query(query.text, query.values);

            if (employeeData.rows.length > 0) {

                let employee: any = employeeData.rows[0];
                const code = await Helper.generateCode(6);
                // employee.sessionId = Helper.createGuid()

                if (employee.apply2fa != true) { throw new ValidationException("2fa is not enabled for this user") }




                let email = new SesService();
                email.sender = employee.companyName + '<' + employee.companySlug + '@invopos.co>'
                email.receivers.push(employee.email);

                email.subject = "resetPassword";

                email.body =
                    ` 
                Dear ${employee.name},
    
                A 2fa reset was requested for your account(${employee.email}) 
    
                OTP:  ${code}
    
                If you have not initited this request, you may simply ignore this email.
                This OTP will expire after 1 minute.
    
                `



                let res = await email.sendEmail();




                if (res?.$metadata.httpStatusCode == 200) {
                    let key = "Employee_OTP" + employeeId;
                    redisClient.set(key, code, 1 * 60);

                    return new ResponseData(true, "", employee)

                }
                return new ResponseData(false, "", employee);


            } else {
                return new ResponseData(false, "employee does not exists", {})
            }


        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async validateOTP(req: Request, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            const data = req.body
            let otp = data.OTP;

            const ipLast = Helper.getClientIp(req);


            let redisClient = RedisClient.getRedisClient();
            let key = "Employee_OTP" + employeeId;
            let actualOTP = await redisClient.get(key)


            if (actualOTP == otp) {
                const reqireTermsAcceptence = await TermAndConditionsRepo.getActiveTerms();

                if (reqireTermsAcceptence) {
                    const userAcceptedVersion = await TermAndConditionsRepo.getUserAcceptedVersion(employeeId);
                    const acceptedVersion = userAcceptedVersion?.accepted_terms_version;
                    const needsAccept = !acceptedVersion || acceptedVersion !== reqireTermsAcceptence.version;
                    if (needsAccept) {

                        if (needsAccept) {
                            const pendingLoginToken = Helper.signPendingLoginToken({ userId: employeeId, termsVersion: reqireTermsAcceptence.version, ip: ipLast, user_agent: data.device?.userAgent });
                            return new ResponseData(true, "", {
                                code: "TERMS_REQUIRED",
                                pendingLoginToken,
                                terms: {
                                    version: reqireTermsAcceptence.version,
                                    title: reqireTermsAcceptence.title,
                                    content_md: reqireTermsAcceptence.content_md,
                                    published_at: reqireTermsAcceptence.published_at,
                                },
                            });
                        }
                    }

                }
                await EmployeeRepo.setEmployeeTOTP(employeeId, null)
                const resault: any = await EmployeeRepo.getEmployeeLoginData(employeeId)
                if (data.device) {
                    const input: any = {
                        employeeId: employeeId,
                        companyId: resault.data.companyId,
                        device: {
                            deviceId: data.device.deviceId,
                            deviceName: data.device.deviceName ?? null,
                            platform: data.device.platform ?? "web",
                            appVersion: data.device.appVersion ?? null,
                            userAgent: data.device.userAgent ?? req.headers["user-agent"] ?? null,
                            ipLast: ipLast,
                        },
                    }
                    const device = await CloudwebPushRepo.addEmployeeDevice(client, input)
                    resault.data.deviceId = device.devicePk

                }

                const tokens = await CompanyRepo.getToken(resault.data)

                if (tokens) {
                    if (resault.data.deviceId) {
                        const session: CreateEmployeeSessionInput = {
                            employeeId: employeeId,
                            deviceId: resault.data.deviceId,
                            refreshTokenHash: this.hashPassword(tokens.refreshToken),
                            refreshTokenExpiryDate: tokens.refreshTokenExpiryDate
                        }
                        await UserSessionRepo.insertUserSession(client, session)
                    }
                    await client.query("COMMIT")
                    return new ResponseData(true, "", { apply2fa: false, refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: resault.employee })
                }

            }
            await client.query("COMMIT")

            return new ResponseData(false, "Invalid OTP", [])



        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async validate2FCode(req: Request, employeeId: string) {
        let count = 0;
        try {
            const data = req.body
            const token = data.code
            const ipLast = Helper.getClientIp(req);
            if (!employeeId) throw new ValidationException("employeeId is required")

            // const employeeTOTP = "1234564"


            //CHECK IF EXCEEDED FAIL ATTEMPT => IF FAILD ATTEMPT IS GREATED IS 3 THEN RETIRN IF NO KEY THEN PORCEED 
            // IF FAILED ATTEMTP IS LESS THAN2 PROCEED IF SUCCESSFULLY THEN DELETE KEY
            let faildAttempt = await this.getRedisLoginAttempt(employeeId)
            let isLocked = await this.getLocked(employeeId)

            if (isLocked) {
                await this.deleteAttempts(employeeId)
                return new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])
            }
            if (faildAttempt) {
                if (Number(faildAttempt) >= 2) {
                    await this.setLocked(employeeId, 30)
                }
                count = Number(faildAttempt) + 1
                if (count >= 3) {
                    return new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])

                }
            }



            //get employeeTOTP
            const database_2fa = await EmployeeRepo.getEmployeeTOTP(employeeId)
            const redis_2fa = await this.getRedis(employeeId + "_2fa")




            let employeeTOTP = database_2fa?.base32 ?? redis_2fa?.secretKey.base32 ?? null




            if (!employeeTOTP) { throw new ValidationException("2fa is not enabled for this user") }

            if (!employeeTOTP) { throw new ValidationException("2fa is not enabled for this user") }


            const verified = speakeasy.totp.verify({
                secret: employeeTOTP,
                encoding: "base32",
                token,
                window: 1, // Allows some time drift
            });


            if (!verified) {
                await this.setRedisLoginAttempt(employeeId, count)
                return new ResponseData(false, "Wrong employeeTOTP", [])


            }

            // const employee = new Employee();
            // employee.ParseJson(data);
            if (redis_2fa && !database_2fa) {
                // employee.ParseJson(data);
                if (redis_2fa && !database_2fa) {
                    employeeTOTP = await EmployeeRepo.setEmployeeTOTP(employeeId, true, redis_2fa?.secretKey)
                    await this.deleteRedis(employeeId + "_2fa")

                }


                const resault:any = await EmployeeRepo.getEmployeeLoginData(employeeId)
                const tokens = await CompanyRepo.getToken(resault.data)


                if (tokens && employeeId) {

                    const reqireTermsAcceptence = await TermAndConditionsRepo.getActiveTerms();

                    if (reqireTermsAcceptence) {
                        const userAcceptedVersion = await TermAndConditionsRepo.getUserAcceptedVersion(employeeId);
                        const acceptedVersion = userAcceptedVersion?.accepted_terms_version;
                        const needsAccept = !acceptedVersion || acceptedVersion !== reqireTermsAcceptence.version;
                        if (needsAccept) {

                            if (needsAccept) {
                                const pendingLoginToken = Helper.signPendingLoginToken({ userId: employeeId, termsVersion: reqireTermsAcceptence.version, ip: ipLast, user_agent: data.device?.userAgent });
                                return new ResponseData(true, "", {
                                    code: "TERMS_REQUIRED",
                                    pendingLoginToken,
                                    terms: {
                                        version: reqireTermsAcceptence.version,
                                        title: reqireTermsAcceptence.title,
                                        content_md: reqireTermsAcceptence.content_md,
                                        published_at: reqireTermsAcceptence.published_at,
                                    },
                                });
                            }
                        }

                    }

                    await this.deleteAttempts(employeeId)
                    // await this.setToken("loggedInToken" + email, tokens.accessToken)

                    const input: any = {
                        employeeId: employeeId,
                        companyId: resault.data.companyId,
                        device: {
                            deviceId: data.device.deviceId,
                            deviceName: data.device.deviceName ?? null,
                            platform: data.device.platform ?? "web",
                            appVersion: data.device.appVersion ?? null,
                            userAgent: data.device.userAgent ?? req.headers["user-agent"] ?? null,
                            ipLast: ipLast,
                        },
                    }

                    return new ResponseData(true, "", { refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: resault.employee })

                } else {
                    await this.setRedisLoginAttempt(employeeId, count)
                    return new ResponseData(false, "Wrong employeeTOTP Or Password", [])
                }
            }
        } catch (error: any) {

            // await this.setRedisLoginAttempt(email,count)
            console.log(error)

            throw new Error(error.message)
        }


    }

    public static async tempAuthenticate(accessToken: string) {
        try {



            const verified = verify(accessToken, process.env.TEMPORARY_ACCESS_TOKEN_SECRET as string,
                (err: any, decoded: any) => {
                    if (err) {


                        // Wrong Refesh Token
                        return new ResponseData(false, "Unauthorized", [])
                    }
                    else {
                        // Correct token we send a new access token
                        return new ResponseData(true, "", decoded)
                    }
                });

            return verified
        } catch (error) {

            console.log("erorrrrrrrrrrrrrrrrrrr")


            return new ResponseData(false, "Unauthorized", [])
        }
    }

    public static async acceptTermAndConditions(data: any, pendingLoginToken: string) {
        try {
            // const isAccepted = data.isAccepted;
            // if (isAccepted) {
            const payload = Helper.verifyPendingLoginToken(pendingLoginToken);
            const employeeId = payload.userId
            const terms_version = payload.termsVersion
            const ip = payload.ip
            const user_agent = payload.user_agent

            await TermAndConditionsRepo.recordAcceptance({ userId: employeeId, version: terms_version, ip: ip, userAgent: user_agent })

            const resault = await EmployeeRepo.getEmployeeLoginData(employeeId)
            const tokens = await CompanyRepo.getToken(resault.data)

            if (tokens) {
                return new ResponseData(true, "", { apply2fa: false, refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: resault.employee })
            }
            return new ResponseData(false, "Wrong Email Or Password", [])


            // }
            return new ResponseData(false, "", [])

        } catch (error) {
            throw error
        }
    }
}