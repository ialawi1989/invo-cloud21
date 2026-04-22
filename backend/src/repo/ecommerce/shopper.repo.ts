import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Shopper } from "@src/models/account/shopper";
import { RedisClient } from "@src/redisClient";
import { AuthRepo } from "../app/auth.repo";
import { Company } from "@src/models/admin/company";
import { Helper } from "@src/utilts/helper";

import { CartRepo } from "./cart.repo";
import { SnsService } from "@src/utilts/SNS"
import { ValidationException } from "@src/utilts/Exception";
import { sign } from 'jsonwebtoken'
import { WebPush } from "@src/Integrations/webPush";
import { SubsriptionRepo } from "./subscriptionRepo";
import { AWSLambda } from "@src/utilts/lambda";
import { SesService } from '@src/utilts/SES';
import { PoolClient } from "pg";
import { text } from "pdfkit";
import { values } from "lodash";
import { SESService } from "@src/AWS-SERVICES/sesService";
import { SendRawEmailCommand } from "@aws-sdk/client-ses";
import { Invoice } from "@src/models/account/Invoice";
import { InvoiceLine } from "@src/models/account/InvoiceLine";
export class ShopperRepo {



    public static async checkIfShopperExists(email: string) {
        try {
            // let hashedPassword = await AuthRepo.hashPassword(password.toString())

            let shopper = new Shopper();
            shopper.email = email
            // shopper.password = password
            const query: { text: string, values: any } = {
                text: `SELECT id ,phone ,name ,"addresses","password" FROM "Shoppers" where lower(trim(email)) =lower(trim($1)) `,
                values: [email]
            }

            const shopperData = await DB.excu.query(query.text, query.values);
            console.log(shopperData.rows)
            if (shopperData.rows && shopperData.rows.length > 0) {
                console.log(shopperData.rows[0])
                shopper.ParseJson(shopperData.rows[0])
                if (shopper.password != null && shopper.password != "") {
                    return { exist: true, shopper: shopper }
                } else {
                    await DB.excu.query(`DELETE FROM "Shoppers" where id = $1`, [shopper.id])
                    return { exist: false, shopper: shopper }
                }

            }
            return { exist: false, shopper: shopper }
        } catch (error: any) {
          


            throw new Error(error)
        }
    }

    public static async validateUserPhone(phone: string, id: string) {
        try {
            // let hashedPassword = await AuthRepo.hashPassword(password.toString())


            // shopper.password = password

            const query: { text: string, values: any } = {
                text: `SELECT count(*) FROM "Shoppers" where lower(trim(phone)) =lower(trim($1)) and (id<> $2) `,
                values: [phone, id]
            }
            console.log(query.values)
            const shopperData = await DB.excu.query(query.text, query.values);
            console.log(shopperData.rows)
            if (shopperData.rows && shopperData.rows.length > 0 && (<any>shopperData.rows[0]).count > 0) {
                throw new ValidationException("Phone Number Already Used")
            }
            return false
        } catch (error: any) {
          


            throw new Error(error)
        }
    }

    public static async validateUserEmail(email: string, id: string) {
        try {
            // let hashedPassword = await AuthRepo.hashPassword(password.toString())


            // shopper.password = password

            const query: { text: string, values: any } = {
                text: `SELECT count(*) FROM "Shoppers" where lower(trim(email)) =lower(trim($1)) and (id<> $2) `,
                values: [email, id]
            }
            console.log(query.values)
            const shopperData = await DB.excu.query(query.text, query.values);
            console.log(shopperData.rows)
            if (shopperData.rows && shopperData.rows.length > 0 && (<any>shopperData.rows[0]).count > 0) {
                throw new ValidationException("Email Address Already Used")
            }
            return false
        } catch (error: any) {
          


            throw new Error(error)
        }
    }

    public static async insertShopper(shopper: Shopper) {
        try {

            let password = shopper.password ? shopper.password.toString() : null
            if (password == null) {
                throw new ValidationException("Password is Require")
            }
            let hashedPassword = await AuthRepo.hashPassword(password)


            const query: { text: string, values: any } = {
                text: `INSERT INTO "Shoppers" ("phone","addresses","password",provider,"providerKey","isPhoneValidated","email","name")values($1,$2,$3,$4,$5,$6,$7,$8) RETURNING Id`,
                values: [shopper.phone, JSON.stringify(shopper.addresses ?? []), hashedPassword, shopper.provider, shopper.providerKey, shopper.isPhoneValidated, shopper.email, shopper.name]
            }

            let shopperId = await DB.excu.query(query.text, query.values);
            shopper.id = (<any>shopperId.rows[0]).id
            return shopper
        } catch (error: any) {

          

            throw new Error(error)
        }
    }

    public static async generateUserToken(data: any) {
        try {
            const accessToken = sign(data, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: process.env.ACCESS_TOKEN_MAXAGE });
            return accessToken
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async loginWithPassword(data: any, company: Company) {
        try {

            console.table(data)
            const password = data.password;
            const email = data.email;
            const phone = data.phone;
            const cartSessionId = data.sessionId;
            const auth = data.auth;

            const sessionId = Helper.createGuid();
            console.log("loginWithPasswordloginWithPasswordloginWithPasswordloginWithPassword", sessionId)
            const hashedPassword = await AuthRepo.hashPassword(password);
            if (hashedPassword) {
                const query = {
                    text: `SELECT 
                            "Shoppers"."id",
                            "Shoppers"."name",
                            "Shoppers"."email",
                            "Shoppers"."phone",
                            merged_addresses AS "addresses",
                            "Customers".id AS "customerId",
                            "Shoppers"."isPhoneValidated",
                            "Shoppers"."isEmailValidated"
                        FROM "Shoppers"

                        LEFT JOIN "Customers"
                            ON "Customers"."companyId" = $4
                            AND "Customers"."phone" = "Shoppers"."phone"

                        LEFT JOIN LATERAL (
                            SELECT jsonb_agg(DISTINCT addr) AS merged_addresses
                            FROM (
                                SELECT jsonb_array_elements(COALESCE("Shoppers"."addresses",'[]'::jsonb)) AS addr
                                
                                UNION
                                
                                SELECT jsonb_array_elements(
                                    COALESCE("Customers"."addresses"::jsonb,'[]'::jsonb)
                                ) AS addr
                            ) t
                        ) a ON true

                        WHERE ($1::text IS NULL OR "Shoppers"."phone" = $1)
                        AND ($2::text IS NULL OR LOWER(TRIM("Shoppers"."email")) = LOWER(TRIM($2)))
                        AND "Shoppers"."password" = $3`,
                    values: [phone, email, hashedPassword, company.id]
                }

                let shopperData = await DB.excu.query(query.text, query.values);
                if (shopperData && shopperData.rowCount && shopperData.rowCount > 0) {
                    const shopperTemp = new Shopper();
                    shopperTemp.ParseJson(shopperData.rows[0]);
                    await this.setShopper('Shopper' + sessionId + company.id, shopperTemp)
                    const token = await this.generateUserToken({ companyId: company.id, userSessionId: sessionId })

                    if (auth) {

                        console.log("====================login=========================", auth)
                        await SubsriptionRepo.convertGuestToShopperSubscription(auth, shopperTemp.id, company.id)

                    }


                    return new ResponseData(true, "", { shopper: shopperTemp, accessToken: token })
                } else {
                    return new ResponseData(false, "Invalid User Information", [])
                }
            }


        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async setOtp(data: any, company: Company, userSessionId: string) {
        try {
            const phone = data.phone
            const email = data.email
            const type = data.type
            const sessionId = Helper.createGuid();
            const otp = await Helper.generateOTPCode(6);
            let redisClient = RedisClient.getRedisClient();
            let key = "Shopper_OTP" + sessionId + company.id;
            let optData = {
                code: otp,
                phone: phone,
                email: email,
                isValidate: false
            }

            let res;
            let user;
            if (userSessionId) {
                user = await ShopperRepo.getShopper(userSessionId, company);
                if (user && type == "register" && phone) {
                    await this.validateUserPhone(phone, user.id)
                }
            }
            if (type == "resetPassword") {
                let string = phone ?? email
                let shopper = await DB.excu.query('select * from "Shoppers" where "phone" = $1 or lower(trim("email")) = lower(trim($1))', [string]);
                if (shopper && shopper.rows && shopper.rows.length <= 0) {
                    let string = phone ? 'Phone Number ' : 'Email '
                    throw new ValidationException(`${string} Is Not Registered`)
                }
            }
            if (phone) {
                if (type != "resetPassword") {
                    await this.validateUserPhone(phone, user.id)
                }

                res = await this.sendOtpSms(optData, company)
            } else if (email) {
                if (type != "resetPassword") {
                    await this.validateUserEmail(email, user.id)
                }
                res = await this.sendOtpEmail(email, otp, company)
            }

            if (!key) {
                throw new ValidationException("Email/Phone Number Is Rrquired")
            }

            if (res && res.success) {
                await redisClient.set(key, JSON.stringify(optData))

            }

            return new ResponseData(true, "", { sessionId: sessionId })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async checkOTP(data: any, userSessionId: string, company: Company) {
        try {

            let sessionId = data.sessionId;
            let otp = data.otp;


            let redisClient = RedisClient.getRedisClient();
            let key = "Shopper_OTP" + sessionId + company.id;
            let actualOTP: any = await redisClient.get(key)
            if (actualOTP)
                actualOTP = JSON.parse(actualOTP);
            console.log(actualOTP)
            if (!actualOTP) {
                return new ResponseData(false, "Invalid OTP", { registerationFailed: true })
            }


            let shopperTemp: any = await this.getShopper(userSessionId, company)


            let shopper = new Shopper()
            if (shopperTemp) {
                // shopperTemp = JSON.parse(shopperTemp)
                shopper.ParseJson(shopperTemp)
            }


            if (actualOTP && (actualOTP.phone || actualOTP.email) && actualOTP.code == otp) {

                if (actualOTP.email) {
                    shopper.email = actualOTP.email
                    shopper.isEmailValidated = true
                    actualOTP.isValidated = true

                    if (shopper.id) {
                        await DB.excu.query('update "Shoppers" set "email"=$1,"isEmailValidated" = $2 where id =$3', [actualOTP.email, true, shopper.id])
                        await this.setShopper('Shopper' + userSessionId + company.id, shopper)
                    }
                }

                if (actualOTP.phone) {

                    shopper.phone = actualOTP.phone
                    shopper.isPhoneValidated = true

                    actualOTP.isValidated = true
                    if (shopper.id) {
                        await DB.excu.query('update "Shoppers" set "phone"=$1,"isPhoneValidated" = $2 where id =$3', [actualOTP.phone, true, shopper.id])
                        await this.setShopper('Shopper' + userSessionId + company.id, shopper)
                    }
                }


                await redisClient.set(key, JSON.stringify(actualOTP))


                return new ResponseData(true, "", shopper)
            } else {
                actualOTP.retry += 1
                if (actualOTP.retry == 3) {

                    await redisClient.deletKey(key)
                    await redisClient.deletKey('Shopper' + sessionId + company.id)
                    return new ResponseData(false, "Invalid OTP", { registerationFailed: true, shopper: shopper })
                } else {
                    await redisClient.set(key, JSON.stringify(actualOTP))
                    shopper.isPhoneValidated = false;
                    await this.setShopper('Shopper' + sessionId + company.id, shopper)
                    return new ResponseData(false, "Invalid OTP", { registerationFailed: false, shopper: shopper })
                }

            }


        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async saveShopper(data: any, company: Company) {
        try {

            let isExist = await this.checkIfShopperExists(data.email)
            console.log(isExist)
            if (isExist.exist) {
                throw new ValidationException("User Already Exist")
            }
            let shopper = new Shopper();



            // if (shopper.isPhoneValidated) {

            // if (data.email != "" && data.email != null && !shopper.isEmailValidated) {
            //     return new ResponseData(false, "Please Varify Your Phone Number to Compelete Registration", [])
            // }
            shopper.ParseJson(data)
            const sessionId = Helper.createGuid()
            console.log(shopper)
            await this.insertShopper(shopper);
            await this.setShopper('Shopper' + sessionId + company.id, shopper)
            // await this.sendOtpSms({sessionId:  shopper.sessionId, phone:shopper.phone},company)
            const token = await this.generateUserToken({ companyId: company.id, userSessionId: sessionId })
            shopper.password = ""

            if (shopper.auth) {

                console.log("====================login=========================", shopper.auth)
                await SubsriptionRepo.convertGuestToShopperSubscription(shopper.auth, shopper.id, company.id)

            }
            return new ResponseData(true, "", { shopper: shopper, accessToken: token })
            // }



        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getShopper(sessionId: string, company: Company): Promise<any | null> {
        try {
            let redisClient = RedisClient.getRedisClient();
            let key = 'Shopper' + sessionId + company.id
            let data = await redisClient.get(key);

            if (!data) return null;

            data = JSON.parse(data)
            let shopper = new Shopper()
            shopper.password = ""
            shopper.ParseJson(data)
            console.table(shopper)

            return shopper

        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async setNewPassword(data: any, company: Company) {
        try {

            let hashedPassword = await AuthRepo.hashPassword(data.password.toString())


            let redisClient = RedisClient.getRedisClient();
            let key = "Shopper_OTP" + data.sessionId + company.id;
            let actualOTP: any = await redisClient.get(key)



            if (actualOTP) {
                actualOTP = JSON.parse(actualOTP);
                console.log(actualOTP)

                if (actualOTP.isValidated && (actualOTP.phone || actualOTP.email)) {
                    let string = actualOTP.phone ?? actualOTP.email
                    let isPhone = actualOTP.phone ? true : false
                    const query: { text: string, values: any } = {
                        text: `Update "Shoppers" set password=$1 , "isPhoneValidated" = case when $4 = true then $2 else "isPhoneValidated"  end   where (phone = $3 or lower(email)=lower(trim($3)))  RETURNING Id`,
                        values: [hashedPassword, actualOTP.isValidated, string, isPhone]
                    }
                    await DB.excu.query(query.text, query.values);
                    await redisClient.deletKey(key)
                    return new ResponseData(true, "", {})

                } else {
                    return new ResponseData(true, "Phone Number Is Not Validated", {})
                }
            } else {
                return new ResponseData(false, "", {})
            }

        } catch (error: any) {
          

            throw new Error(error)
        }
    }



    public static async sendOtpSms(data: any, company: Company) {
        try {




            const otpmsg = new SnsService()
            console.log(data)
            otpmsg.message = `Please use the following OTP to complete your request: ${data.code} `
            if (data.code != null) {


                otpmsg.phoneNumber = data.phone
                let msg = await otpmsg.sendSms()
                if (msg.success) {
                    return new ResponseData(true, "", [])

                }
            }





            return new ResponseData(false, "", [])


        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async getEmailInfo(email: string, companyId: string) {
        try {
            const query = {
                text: `select "Shoppers"."name" "shopperName" ,"Companies"."name" as "companyName" ,"Companies"."slug" as "compnaySlug"  from "Shoppers" 
                      inner join "Companies" on "Companies".id = $2
                       where "email"=$1
                `,
                values: [email, companyId]
            }

            let shopper = await DB.excu.query(query.text, query.values)
            if (shopper && shopper.rows && shopper.rows.length > 0) {
                return {
                    shopperName: (<any>shopper.rows[0]).shopperName,
                    companyName: (<any>shopper.rows[0]).companyName,
                    compnaySlug: (<any>shopper.rows[0]).compnaySlug
                }
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async sendOtpEmail(shopperEmail: string, code: string, company: Company) {
        try {

            let data: any[] = [];

            const receivers = [shopperEmail]
            receivers.forEach(email => {
                data.push(`To: ${email}`);

            });

            const sender = company.slug + '<' + company.slug + '@invopos.co>'
            data.push(`From: ${sender}`);

            const boundary = 'NextPart'
            const htmlBody = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                        <meta charset="utf-8" />
                        <title>OTP Verification</title>
                        <style>
                            body { font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; }
                            .container { max-width: 480px; margin: 0 auto; background: #fff;
                            border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; text-align: center; }
                            .otp { font-size: 24px; font-weight: bold; letter-spacing: 4px;
                            color: #2c3e50; margin: 20px 0; }
                            .footer { margin-top: 20px; font-size: 12px; color: #777; }
                        </style>
                        </head>
                        <body>
                        <div class="container">
                            <h2>OTP Verification</h2>
                            <p>Hello,</p>
                            <p>Please use the following OTP to complete your request:</p>
                            <div class="otp">${code}</div>
                            <p>If you didn’t request this, please ignore this email.</p>
                            <div class="footer"> ${new Date().getFullYear()} ${company.slug}</div>
                        </div>
                        </body>
                    </html>`;
            // Add unique message ID
            data.push(`Date: ${new Date().toUTCString()}`); // optional
            data.push(`Subject: OTP Verification`);
            data.push("MIME-Version: 1.0");
            data.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
            data.push("");
            data.push(`--${boundary}`);
            data.push('Content-Type: text/html; charset="utf-8"');
            data.push('Content-Transfer-Encoding: 7bit');
            data.push("");
            data.push(htmlBody); // HTML body here
            data.push(`--${boundary}--`);


            // Join the MIME message parts
            const rawEmail = data.join("\n");

            // ########### send Email  ###########
            let awsInstant = new SESService()

            const encoder = new TextEncoder();
            const rawData = encoder.encode(rawEmail);
            const command = new SendRawEmailCommand({
                RawMessage: { Data: rawData },
            });
            await awsInstant.sesClint.send(command);

            return new ResponseData(true, "", {})

        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }


    public static async findAndSave(shopper: Shopper) {
        try {

            if (!shopper.email) {
                throw new ValidationException("Email is Required")
            }
            let isShopperExist = await this.checkIfShopperExists(shopper.email);
            if (!isShopperExist.exist) {
                //LogIn new Shopper 
                //Add Shopper 


                shopper = await this.insertShopper(shopper)
            } else {
                shopper = isShopperExist.shopper
            }
            shopper.password = null;
            return new ResponseData(true, "", shopper)


        } catch (error: any) {
          
            throw new Error(error)
        }
    }


    public static async setShopper(key: string, shopper: any) {
        try {
            let redisClient = RedisClient.getRedisClient();

            return await redisClient.set(key, JSON.stringify(shopper), 2 * 24 * 60 * 60 * 1000);
        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async getLoggedInUser(sessionId: string, company: Company) {
        try {

            console.log("sessionIdsessionIdsessionIdsessionId", sessionId)
            let user: any = await this.getShopper(sessionId, company)


            // if (user) {
            //     user = JSON.parse(user);
            //     let customer = new Customer();
            //     customer.ParseJson(user)

            //     const query: { text: string, values: any } = {
            //         text: `select * from "Customers" where phone =$1 and "companyId"=$2`,
            //         values: [user.phone, company.id]
            //     }

            //     const customerData = await DB.excu.query(query.text, query.values);


            //     if (customerData.rowCount != null && customerData.rowCount > 0) {
            //         customer.ParseJson(customerData.rows[0])
            //     }



            // }
            user.phone = user.phone ? user.phone : null;
            user.email = user.email ? user.email : null;

            if (user) {
                const query = {
                    text: `SELECT 
                                s."id",
                                s."name",
                                (
                                    SELECT jsonb_agg(DISTINCT addr)
                                    FROM (
                                        SELECT jsonb_array_elements(COALESCE(s."addresses",'[]'::jsonb)) addr
                                        UNION
                                        SELECT jsonb_array_elements(COALESCE(c."addresses"::jsonb,'[]'::jsonb))
                                    ) t
                                ) AS addresses
                            FROM "Shoppers" s
                            LEFT JOIN "Customers" c
                                ON c."phone" = s."phone"
                                AND c."companyId" = $3
                            WHERE ($1::text is not null and s."phone" = $1 )or ( $2::text is not null and lower(s."email") = lower($2));  `,
                    values: [user.phone,user.email, company.id]
                }
                console.log(query)
                let customers = await DB.excu.query(query.text, query.values);
                if (customers && customers.rows && customers.rows.length > 0) {
                    user.addresses = (<any>customers.rows[0]).addresses

                    await this.setShopper('Shopper' + sessionId + company.id, user)
                }
            }
            return new ResponseData(true, "", user)


        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async deleteShopper(shopperSessionId: string, companyId: string) {
        try {
            let redisClient = RedisClient.getRedisClient();
            let key = "Shopper" + shopperSessionId + companyId;
            return await redisClient.deletKey(key);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async logOut(shopperSessionId: string, company: Company) {
        try {
            await this.deleteShopper(shopperSessionId, company.id);

            // if (cartSessionId != null && cartSessionId != "") {
            //     let cart = await CartRepo.getRedisCart(companyId, cartSessionId);
            //     if (cart) {
            //         cart.customerId = null;
            //         cart.customerName = "";
            //         cart.customer = new Customer()

            //         await CartRepo.setRedisCart(companyId, cartSessionId, cart)
            //     }

            // }

            return new ResponseData(true, "", [])
        } catch (error: any) {
          

            throw new Error(error)
        }
    }





    public static async validatePhoneOTP(data: any, company: Company) {
        try {

            let sessionId = data.sessionId;
            let otp = data.otp;


            let redisClient = RedisClient.getRedisClient();
            let key = "Shopper_OTP" + sessionId + company.id;
            let actualOTP: any = await redisClient.get(key)
            if (actualOTP)
                actualOTP = JSON.parse(actualOTP);
            if (!actualOTP) {
                return new ResponseData(false, "Invalid OTP", { registerationFailed: true })
            }


            let shopperTemp: any = await this.getShopper(sessionId, company)


            let shopper = new Shopper()
            if (shopperTemp) {
                shopperTemp = JSON.parse(shopperTemp)
            }


            if (actualOTP && actualOTP.phone && actualOTP.code == otp) {

                if (actualOTP.email) {
                    shopper.email = actualOTP.email
                    shopper.isEmailValidated = true
                    actualOTP.isValidated = true
                }

                if (actualOTP.phone) {
                    shopper.phone = actualOTP.phone
                    shopper.isPhoneValidated = true
                    actualOTP.isValidated = true
                }
                await this.setShopper('Shopper' + sessionId + company.id, shopper)

                return new ResponseData(true, "", shopper)
            } else {
                actualOTP.retry += 1
                if (actualOTP.retry == 3) {

                    await redisClient.deletKey(key)
                    await redisClient.deletKey('Shopper' + sessionId + company.id)
                    return new ResponseData(false, "Invalid OTP", { registerationFailed: true })
                } else {
                    await redisClient.set(key, JSON.stringify(actualOTP))
                    shopper.isPhoneValidated = false;
                    await this.setShopper('Shopper' + sessionId + company.id, shopper)
                    return new ResponseData(false, "Invalid OTP", { registerationFailed: false })
                }

            }


        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async updateShoppr(shopper: Shopper, sessionId: string, company: Company) {
        try {
            let loggedInUser = await this.getShopper(sessionId, company);
            if (shopper.phone != null && shopper.phone != "") {
                await this.validateUserPhone(shopper.phone, shopper.id)
            }


            if (loggedInUser) {
                let tempShopper = new Shopper()
                tempShopper.ParseJson(loggedInUser);
                console.table(tempShopper)
                if (tempShopper.id == shopper.id) {
                    shopper.email = shopper.email ? shopper.email : null;
                    shopper.addresses = shopper.addresses && shopper.addresses.length > 0 ? shopper.addresses : [];
                    const query = {
                        text: ` UPDATE "Shoppers"
                                SET 
                                    "name" = $1,
                                    "addresses" = $2
                                WHERE "id" = $3;`,
                        values: [shopper.name, JSON.stringify(shopper.addresses), shopper.id]
                    }
                    await DB.excu.query(query.text, query.values)
                    tempShopper.name = shopper.name
                    tempShopper.addresses = shopper.addresses
                }

                if (shopper.phone) {
                    shopper.addresses = shopper.addresses && shopper.addresses.length > 0 ? shopper.addresses : [];

                    const customerQuery = {
                        text: ` UPDATE "Customers"
                                SET 
                                    "name" = $2,
                                    "addresses" =$1
                                WHERE "companyId" = $3 
                                AND "phone" = $4;`,
                        values: [JSON.stringify(shopper.addresses), shopper.name, company.id, shopper.phone]
                    }

                    await DB.excu.query(customerQuery.text, customerQuery.values)
                    tempShopper.addresses = shopper.addresses
                }
                await this.setShopper('Shopper' + sessionId + company.id, tempShopper)
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async subscribeNotification(data: any, company: Company, userSessionId: string) {
        try {

            let subscribe = await WebPush.subscribe(data, company, userSessionId)
            return subscribe
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setShopperPhone(client: PoolClient, loggedInUser: Shopper, company: Company, userSessionId: string) {
        try {
            await CartRepo.validateUserPhone(client, loggedInUser.phone, loggedInUser.id)
            let updatePhone = await client.query(`Update "Shoppers" 
                                                set "phone" = case when  "phone" is null or "phone" = ''  then $1 else "phone" end ,
                                                "isPhoneValidated" =  case when "phone" is null or "phone" = '' then true else "isPhoneValidated" end 
                                                where id =$2 returning "phone" ,"isPhoneValidated"`, [loggedInUser.phone, loggedInUser.id])
            loggedInUser.phone = updatePhone.rows[0].phone
            loggedInUser.isPhoneValidated = updatePhone.rows[0].isPhoneValidated
            await ShopperRepo.setShopper('Shopper' + userSessionId + company.id, loggedInUser)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getShopperOrdersHistory(data: any, userSessionId: string, company: Company) {
        try {

            const shopperTemp: any = await this.getShopper(userSessionId, company)
            if (!shopperTemp) return new ResponseData(false, "Shopper NoT found", []);

            if (shopperTemp && !shopperTemp.customerId && shopperTemp.phone) {
                shopperTemp.customerId = await this.getCustomerIdByPhone(shopperTemp.phone, company.id)
            }

            if (!shopperTemp.customerId) return new ResponseData(false, "Customer Not Found", []);

            const page = data.page ?? 1
            const limitConst = data.limit ?? 15
            const limit = limitConst + 1
            const offest = limit * (page - 1)

            const query = {
                text: `SELECT "Invoices"."id",
                             "Invoices"."invoiceNumber", 
                             "Invoices"."onlineData"->>'onlineStatus' as "status",
                             "Invoices"."createdAt",
                              "Services"."name" as "serviceName",
                              "Invoices"."total" 
                      FROM "Invoices"
                      inner join "Services" on "Services".id = "Invoices"."serviceId"
                      where "Invoices"."companyId" = $1
                      and "Invoices"."customerId" = $2
                      order by "Invoices"."createdAt" desc 
                      limit $3
                      offset $4
                      `,
                values: [company.id, shopperTemp.customerId, limit, offest]
            }

            const orders = await DB.excu.query(query.text, query.values);
            const hasNext = orders.rows && orders.rows.length > limitConst;
            const list = hasNext ? orders.rows.slice(0, limitConst) : orders.rows;

            return new ResponseData(true, "", {
                hasNext: hasNext,
                list: list
            })
        } catch (error) {
            throw error
        }
    }



    public static async getCustomerIdByPhone(phone: string, companyId: string) {
        try {
            const query = {
                text: `select id from "Customers" where "companyId" =$1 and "phone" = $2`,
                value: [companyId, phone]

            }

            const customer = await DB.excu.query(query.text, query.value)

            return customer && customer.rows && customer.rows.length > 0 ? customer.rows[0].id : null
        } catch (error) {
            throw error
        }
    }
    public static async getShopperOrderById(orderId: any, userSessionId: string, company: Company) {
        try {

            const shopperTemp: any = await this.getShopper(userSessionId, company)
            if (!shopperTemp) return new ResponseData(false, "Shopper NoT found", []);

            if (shopperTemp && !shopperTemp.customerId && shopperTemp.phone) {
                shopperTemp.customerId = await this.getCustomerIdByPhone(shopperTemp.phone, company.id)
            }

            if (!shopperTemp.customerId) return new ResponseData(false, "Customer Not Found", []);



            const query = {
                text: `SELECT "Invoices".* ,
                              
                              "Customers".name as "customerName",
                              "Tables".name as "tableName",
                              "Branches".name as "branchName",
                              "Services".type as "serviceName"
                       FROM "Invoices" 
                       Left join "Customers" ON  "Customers".id =  "Invoices"."customerId"
                       LEFT JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
                       inner join "Services" on "Services".id = "Invoices"."serviceId"
                       LEFT JOIN "Tables" ON "Tables".id = "Invoices"."tableId"
                      where "Invoices"."companyId" = $1
                      and "Invoices".id  = $2
                      and "Invoices"."customerId" = $3
                      `,
                values: [company.id, orderId, shopperTemp.customerId]
            }

            const order = await DB.excu.query(query.text, query.values);
            if (!order || !order.rows || order.rows.length == 0) return new ResponseData(false, "Order Not Found", []);
            const invoice = new Invoice()
            invoice.ParseJson(order.rows[0])

            if (invoice.id != "" && invoice.id != null) {
                query.text = `SELECT "InvoiceLines".*, ("InvoiceLines"."serviceDate" ::text),
                "Products".name as "productName",
                  "Products".translation, 
                "Media".url->>'defaultUrl' as "mediaUrl"
                FROM "InvoiceLines"
                LEFT JOIN "Products" on "Products".id = "InvoiceLines"."productId"
                LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
                where "invoiceId"=$1
                `
                query.values = [invoice.id]

                let invoiceLines = await DB.excu.query(query.text, query.values);


                for (let index = 0; index < invoiceLines.rows.length; index++) {
                    const element: any = invoiceLines.rows[index];
                    const line = new InvoiceLine();
                    line.ParseJson(element)
                    query.text = `SELECT "InvoiceLineOptions".*,
                                         "Options"."name" as "optionName",
                                                     "Options".translation, 
                                                     "OptionGroups".title as  "optionGroupName",
                                                     "OptionGroups".translation as "optionGroupTranslation"

                                    FROM "InvoiceLineOptions"
                                    INNER JOIN "Options" on   "Options".id = "InvoiceLineOptions"."optionId"
                                     left join "OptionGroups" on "OptionGroups".id =   "InvoiceLineOptions"."optionGroupId"
                                    where "invoiceLineId"=$1`;
                    query.values = [line.id]

                    const options = await DB.excu.query(query.text, query.values);
                    line.options = options.rows;
                    invoice.lines.push(line)
                }


                query.text = `SELECT
                                "InvoicePaymentLines"."amount" as "paidAmount",
                                "PaymentMethods"."name" , 
                                "InvoicePayments"."status"
                             FROM "InvoicePaymentLines" 
                             INNER JOIN "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                             INNER JOIN "PaymentMethods" ON "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                             where "invoiceId" = $1
                             `
                query.values = [invoice.id]
                let invoicePayments = await DB.excu.query(query.text, query.values);
                invoice.invoicePayments = invoicePayments.rows


                invoice.calculateTotal(company.afterDecimal);
                invoice.setOnlineStatus()



                let parentLine: InvoiceLine | undefined;
                invoice.lines.filter(f => f.parentId != null).forEach(element => {

                    parentLine = invoice.lines.find(f => f.id == element.parentId);

                    if (parentLine != null) {
                        parentLine!.subItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });

                invoice.lines.filter(f => f.voidFrom != null).forEach(element => {
                    parentLine = invoice.lines.find(f => f.id == element.voidFrom);
                    if (parentLine != null) {
                        parentLine!.voidedItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });


            }

            return new ResponseData(true, "", invoice)
        } catch (error) {
            throw error
        }
    }


    public static async updatePassword(data: any, userSessionId: string, company: Company) {
        try {
            const oldHashedPassword = await AuthRepo.hashPassword(data.oldPassword.toString());
            const hashedPassword = await AuthRepo.hashPassword(data.password.toString())

            let shopperTemp: any = await this.getShopper(userSessionId, company)

            if (shopperTemp) {
                const query = {
                    text: `SELECT * FROM "Shoppers" where id = $1 and "password" = $2`,
                    values: [shopperTemp.id, oldHashedPassword]
                }

                const shopper = await DB.excu.query(query.text, query.values);
                if (shopper && shopper.rows && shopper.rows.length > 0) {
                    await DB.excu.query(`UPDATE "Shoppers" SET "password" = $2 WHERE id = $1`, [shopperTemp.id, hashedPassword])

                    return new ResponseData(true, "", [])
                }
                return new ResponseData(false, "Invalid Passowrd", [])
            }

            return new ResponseData(false, "Shopper Not Found", [])

        } catch (error) {
            throw error
        }
    }

    public static async updateShopperPhoneEmail(userSessionId: string, company: Company) {
        try {
            const key = "Shopper_OTP" + userSessionId + company.id;
            const shopper = await this.getShopper(userSessionId, company);
            if (shopper) {
                const redisClient = RedisClient.getRedisClient();
                const otp = await redisClient.get(key)
                if (otp) {
                    const otpData = JSON.parse(otp)
                    const phone = otpData.phone;
                    const email = otpData.phone;
                    const isValidated = otpData.isValidated;

                    if (phone && isValidated) {

                        await DB.excu.query(`UPDATE "Shoppers" set "phone" = $1 , "isPhoneValidated" =$2 where id = $3  `, [phone, isValidated, shopper.id])
                        shopper.phone = phone;
                        shopper.isPhoneValidated = isValidated
                    }

                    if (email && isValidated) {

                        await DB.excu.query(`UPDATE "Shoppers" set "email" = $1 , "isEmailValidated" =$2 where id = $3  `, [phone, isValidated, shopper.id])
                        shopper.email = phone;
                        shopper.isEmailValidated = isValidated
                    }
                    await this.setShopper('Shopper' + userSessionId + company.id, shopper)
                    return new ResponseData(true, "", [])
                }
                return new ResponseData(false, "Invalid OTP", [])
            }
            return new ResponseData(false, "Shopper Not Found", [])

        } catch (error) {
            throw error
        }
    }
}