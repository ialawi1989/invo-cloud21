import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { Feedback } from "@src/models/Settings/feedBack";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { TemplateProvider } from "@src/routes/v1/template/template.business";
import { SesService } from "@src/utilts/SES";
import { publishEvent } from "@src/utilts/system-events";
import { values } from "lodash";
import { PoolClient } from "pg";
interface EmailNotificationsSettings {
    emails: string[];      // array of strings
    ratings: number[];     // array of numbers
}

interface GoogleFeedbackSettings {
    url: string;           // string
    ratings: number[];     // array of numbers
}

interface FeedbackSettings {
    emailNotifications: EmailNotificationsSettings;
    googleFeedbackSettings: GoogleFeedbackSettings;
}

export interface FeedBackInfo {
    transactionNumber: string;
    customerId: string;
    customerContact: string | null;
    branchId: string;
    customerName: string;
    branchName: string,
    branchContact: string,

}
export class FeedBackRepo {


    public static async saveFeedBackSettings(data: { feedbackSettings: FeedbackSettings }, company: Company) {
        try {
            if (!data?.feedbackSettings) {
                throw new Error('feedbackSettings is required');
            }

            const query = {
                text: `
                    UPDATE "Companies"
                    SET "feedbackSettings" = $1
                    WHERE id = $2
                     `,
                values: [data.feedbackSettings, company.id]
            };

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error) {
            throw error;
        }
    }


    public static async getFeedBackSettings(company: Company, type: string | null = null, client: PoolClient | null = null) {
        try {
            const allowedKeys = ['emailNotifications', 'smsNotifications'];

            const column = type && allowedKeys.includes(type)
                ? `("feedbackSettings"->>'${type}')::jsonb AS "${type}"`
                : `"feedbackSettings"::jsonb`;

            const query = {
                text: `SELECT ${column} FROM "Companies" WHERE id = $1`,
                values: [company.id]
            };

            const result = client
                ? await client.query(query.text, query.values)
                : await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", result.rows[0] ?? null);
        } catch (error: any) {
            throw error; // preserve stack trace
        }
    }



    public static async getFeedBackInfo(client: PoolClient, invoiceId: string, companyId: string): Promise<FeedBackInfo | null> {
        try {
            const query = {
                text: `
                        SELECT 
                        "Invoices"."invoiceNumber"   AS "transactionNumber",
                        "Invoices"."customerId"      AS "customerId",
                        "Invoices"."customerContact" AS "customerContact",
                        "Invoices"."branchId"        AS "branchId",
                        "Customers"."name"           AS "customerName",
                         "Branches".name as "branchName",
                            "Branches"."phoneNumber" as "branchContact"
                        FROM "Invoices"
                        INNER JOIN "Customers"
                        ON "Customers"."companyId" = $1
                        Inner join "Branches" on "Branches"."id" = "Invoices"."branchId"
                        AND "Customers"."id" = "Invoices"."customerId"
                        WHERE "Invoices"."id" = $2
      `,
                values: [companyId, invoiceId]
            };

            const { rows } = await client.query<FeedBackInfo>(query.text, query.values);

            return rows[0] ?? null; // safe return
        } catch (error: any) {
            throw new Error(error.message || error);
        }
    }


   public static async insertFeedbacks(data: Feedback, company: Company) {

        try {


            await DB.transaction(async (client: PoolClient) => {
                const feedback = new Feedback()
                feedback.ParseJson(data);
                const feedBackDetails = await this.getFeedBackInfo(client, feedback.transactionId, company.id);
                const getFeedBackInfo = await this.getFeedBackSettings(company, 'emailNotifications', client)
                if (!feedBackDetails) throw new Error('Transaction Not Found')



                const {
                    branchId,
                    customerId,
                    customerName,
                    customerContact,
                    transactionNumber
                } = feedBackDetails;
                Object.assign(feedback, {
                    branchId,
                    customerId,
                    customerName,
                    customerContact,
                    transactionNumber,
                    companyId: company.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });


                const values = [
                    feedback.rating,
                    feedback.comment,
                    feedback.customerName,
                    feedback.customerContact,
                    feedback.customerId,
                    feedback.transactionNumber,
                    feedback.branchId,
                    feedback.companyId,
                    feedback.transactionId,
                    feedback.createdAt,
                    feedback.updatedAt
                ];

                // if (ratingId) {
                //     values.push(ratingId);
                // }


                const query = `INSERT INTO "Feedbacks" (
                                                rating,
                                                comment,
                                                "customerName",
                                                "customerContact",
                                                "customerId",
                                                "transactionNumber",
                                                "branchId",
                                                "companyId",
                                                "transactionId",
                                                "createdAt",
                                                "updatedAt"
                                            )
                                            VALUES (
                                                $1,  -- rating
                                                $2,  -- comment
                                                $3,  -- customerName
                                                $4,  -- customerContact
                                                $5,  -- customerId
                                                $6,  -- transactionNumber
                                                $7,  -- branchId
                                                $8,  -- companyId
                                                $9,  -- transactionId
                                                $10, -- createdAt
                                                $11  -- updatedAt 
                                            
                                            )
                                            ON CONFLICT  ("companyId", "transactionId")
                                            DO UPDATE SET
                                                rating           = EXCLUDED.rating,
                                                comment          = EXCLUDED.comment,
                                               "updatedAt"      = EXCLUDED."updatedAt"`




                await client.query(query, values)
                if (getFeedBackInfo&& getFeedBackInfo.data && getFeedBackInfo.data.emailNotifications) {
                    const { emails, ratings } = getFeedBackInfo.data.emailNotifications

                    if (ratings && ratings.includes(feedback.rating)) {
                        /** insert to redis to schedule rating after 30 min */
                        /** send email */


                        publishEvent(`CustomerFeedBack`, {
                            companyId: company.id,
                            receivers: emails,
                            subject: 'Feedback Rating',

                            restaurantName: company.name,
                            orderNumber: feedBackDetails.transactionNumber,
                            createdAt: feedback.createdAt,
                            rating: feedback.rating,
                            comment: feedback.comment,
                            branchInfo: { name: feedBackDetails.branchName, branchContact: feedBackDetails.branchContact },
                            customer: { name: feedBackDetails.customerName, customerContact: feedBackDetails.customerContact }
                        });
                    }
                }
            })
            return new ResponseData(true, "", [])

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getFeedbacks(data: any, company: Company) {
        try {

            const branchIds = data && data.branchIds && data.branchIds.length > 0 ? data.branchIds : null
            const searchTerm = data && data.searchTerm ? ` %${data.searchTerm.toLowerCase().trim()}% ` : null
            const fromDate = data && data.fromDate ? data.fromDate : null
            const toDate = data && data.toDate ? data.toDate : null
            const ratings = data && data.ratings && data.ratings.length > 0 ? data.ratings : null

            const page = data && data.page ? data.page : 1
            const limitConst = data && data.limit ? data.limit : 15
            const limit = (data && data.limit ? data.limit : 15) + 1

            const offset = (limitConst) * (page - 1)


            const sort = data.sort
            const sortValue = sort && sort.value ? sort.value : null;
            const sortDirc = sort && sort.direction ? sort.direction : 'DESC';
            let sortQuery = `ORDER BY "Feedbacks"."createdAt" DESC `
            if (sortValue) {
                sortQuery = `ORDER BY "Feedbacks"."${sortValue}" ${sortDirc} `
            }
            const query =
            {
                text: `SELECT * FROM "Feedbacks"
                    WHERE "Feedbacks"."companyId" = $1
                    and ($2::uuid[] is null  or  "Feedbacks"."branchId" = any($2))
                    and ($3::text is null or ("Feedbacks"."customerName" ilike $3  or
                       "Feedbacks"."transactionNumber" ilike $3)
                       )
                    and ($4::date is null or "createdAt"::date >= $4::date)
                    and ($5::date is null or "createdAt"::date <= $5::date)
                    and ($6::int[] is null or "rating"  =any($6))
                     ${sortQuery}
                    limit $7
                    offset $8`,
                values: [company.id, branchIds, searchTerm, fromDate, toDate, ratings, limit, offset]
            }

            const list = await DB.excu.query(query.text, query.values);
            let rows = list.rows
            const hasNext = rows && rows.length > limitConst;
            rows = hasNext ? rows.slice(0, limitConst) : rows

            return new ResponseData(true, "", { list: rows, has_next: hasNext })
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async sendHTMLEmail(emailDetails: any, data: any) {
        const htmlContent = `<head>
                                <title>New Order Rating Received</title>
                                <style>
                                    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                                    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                                    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
                                    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
                                    .star { font-size: 24px; color: #ffc107; }
                                </style>
                                </head>
                                <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
                                    <tr>
                                    <td align="center" style="padding:30px 10px;">
                                        <table role="presentation" class="email-wrapper" border="0" cellpadding="0" cellspacing="0" width="600"
                                        style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                        <tr>
                                            <td style="background-color:#32acc1;padding:32px 40px;text-align:center;">
                                            <h2 style="margin:0 0 4px;color:#cdf0f5;font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{{restaurantName}}</h2>
                                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                                                New Order Rating
                                            </h1>
                                            <p style="margin:8px 0 0;color:#cdf0f5;font-size:14px;">A customer has rated their order</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="email-content" style="padding:32px 40px;">
                                            
                                            <!-- Order Info -->
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                                                <tr>
                                                <td class="meta-left" width="50%" style="padding:0 0 12px;">
                                                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Order Number</p>
                                                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{orderNumber}}</p>
                                                </td>
                                                <td class="meta-right" width="50%" style="padding:0 0 12px;text-align:right;">
                                                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Rated On</p>
                                                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{date(createdAt)}}</p>
                                                </td>
                                                </tr>
                                                <tr>
                                                    <td class="meta-left" width="50%" style="padding:0 0 12px;">
                                                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Branch Name </p>
                                                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{branchInfo.name}}</p>
                                                </td>
                                                </tr>
                                                
                                                <tr>
                                                    <td class="meta-left" width="50%" style="padding:0 0 12px;">
                                                    <p style="margin:0;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.8px;">Branch Contact  </p>
                                                    <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;">{{branchInfo.branchContact}}</p>
                                                </td>
                                                </tr>
                                            </table>
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
                                            </table>
                                            <!-- Customer Info -->
                                            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Customer Details</p>
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                                                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                                                <tr style="background-color:#ffffff;">
                                                <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;width:45%;">Customer Name:</td>
                                                <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#1a1a1a;">{{customer.name}}</td>
                                                </tr>
                                                <tr style="background-color:#fafafa;">
                                                <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;color:#666666;">Customer Contact:</td>
                                                <td style="border:1px solid #e0e0e0;padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:#1a1a1a;">{{customer.customerContact}}</td>
                                                </tr>
                                            </table>
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
                                            </table>
                                            <!-- Star Rating -->
                                            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Rating</p>
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                                                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                                                <tr style="background-color:#ffffff;">
                                                <td style="border:1px solid #e0e0e0;padding:20px 16px;font-size:14px;text-align:center;">
                                                <p style="margin:0 0 8px;font-size:32px;">
                                {{
                                rating === 5 ? '<span style="color:#2563eb">★★★★★</span>' :
                                rating === 4 ? '<span style="color:#059669">★★★★☆</span>' :
                                rating === 3 ? '<span style="color:#b45309">★★★☆☆</span>' :
                                rating === 2 ? '<span style="color:#f97316">★★☆☆☆</span>' :
                                rating === 1 ? '<span style="color:#ef4444">★☆☆☆☆</span>' :
                                ''
                                }}
                                </p>
                                                    <p style="margin:0;font-size:18px;font-weight:700;color:#32acc1;">{{rating}} out of 5 stars</p>
                                                </td>
                                                </tr>
                                            </table>
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr><td style="border-top:1px solid #eeeeee;padding-bottom:24px;"></td></tr>
                                            </table>
                                            <!-- Comment -->
                                            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.8px;">Customer Comment</p>
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                                                style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:28px;background-color:#fafafa;">
                                                <tr>
                                                <td style="border:1px solid #e0e0e0;padding:16px;font-size:14px;color:#444444;line-height:1.8;">
                                                    "{{comment}}"
                                                </td>
                                                </tr>
                                            </table>
                                            <br>
                                            <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
                                                Review this feedback and respond to improve customer satisfaction. Log in to your dashboard to view more details and respond to the customer.
                                            </p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="background-color:#ffffff;padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
                                        
                                            <p style="margin:0;font-size:11px;color:#aaaaaa;font-style:italic;">— Powered by INVOPOS —</p>
                                            </td>
                                        </tr>
                                        </table>
                                    </td>
                                    </tr>
                                </table>
                                </body>   `
        const templateProvider = new TemplateProvider(null as any);
        const renderedBody = templateProvider.renderTemplate(htmlContent, { restaurantName: data.restaurantName, customer: data.customer, orderNumber: data.orderNumber, createdAt: data.createdAt, rating: data.rating, comment: data.comment, branchInfo: data.branchInfo })
        console.log(renderedBody)
        let email = new SesService();
        email.sender = emailDetails.sender
        email.receivers = emailDetails.receivers
        email.subject = emailDetails.subject
        email.htmlContent = renderedBody;
        return await email.sendHTMLEmail();
    }

}