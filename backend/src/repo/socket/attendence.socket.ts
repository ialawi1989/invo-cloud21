import { DB } from "@src/dbconnection/dbconnection";

import { Media } from "@src/models/Settings/media";
import { TimeHelper } from "@src/utilts/timeHelper";
import { PoolClient } from "pg";
import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { Company } from "@src/models/admin/company";

import { Attendance } from "@src/models/Settings/attendance";
import { S3Storage } from "@src/utilts/S3Storage";
import { ResponseData } from "@src/models/ResponseData";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class AttendanceSocket {

    public static async saveAttendance(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            let resault;
            if (data) {
                data = JSON.parse(data);
            }
            const attendances = data;

            await dbClient.query("BEGIN")
            for (let index = 0; index < attendances.length; index++) {
                const element = attendances[index];

                console.log("========================================")
                console.log("========================================", element)
                element.clockedIn = element.clockedIn ? TimeHelper.convertToDate(element.clockedIn) : null
                element.adjClockedOut = element.adjClockedOut ? TimeHelper.convertToDate(element.adjClockedOut) : null
                element.adjClockedInBy = element.adjClockedInBy ? TimeHelper.convertToDate(element.adjClockedInBy) : null
                element.clockedOut = element.clockedOut ? TimeHelper.convertToDate(element.clockedOut) : null

                await this.insertAttendance(dbClient, element, branchId)
            }
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true }))
        } catch (error: any) {
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "saveAttendance")

            await dbClient.query("ROLLBACK")

            throw new Error(error)
        } finally {
            dbClient.release()
        }
    }


    public static async getMediaIds(client: PoolClient, id: string) {
        try {
            const query = {
                text: `SELECT "clockedInMediaUrl" , "clockedOutMediaUrl"  FROM "Attendances" where id = $1`,
                values: [id]
            }

            const attendance = await client.query(query.text, query.values);
            const attendanceInfo = attendance.rows && attendance.rows.length > 0 ? attendance.rows[0] : null
            if (attendanceInfo) {
                return {
                    clockedInMediaUrl: attendanceInfo.clockedInMediaUrl,
                    clockedOutMediaUrl: attendanceInfo.clockedOutMediaUrl
                }
            } else {
                return {
                    clockedInMediaId: null,
                    clockedOutMediaId: null
                }
            }

        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async insertAttendance(client: PoolClient, data: any, branchId: string) {

        try {

            const attendance = new Attendance();
            attendance.ParseJson(data)
            attendance.branchId = branchId;

            /** to not save media twice if recivied if edit is allowed remove  */
            let attendanceInfo = await this.getMediaIds(client, attendance.id)
            attendance.clockedInMediaUrl = attendanceInfo.clockedInMediaUrl
            attendance.clockedOutMediaUrl = attendanceInfo.clockedOutMediaUrl
            const companyId = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
            const company = new Company();
            company.id = companyId;

            let media = new Media();
            media.companyId = companyId
            /**{fileType: "image", extension: "jpeg"} */
            if (attendance.clockedInImage && (!attendance.clockedInMediaUrl)) {

                media.media = attendance.clockedInImage;

                media.documentContent = "Attendance"
                let url = await S3Storage.insertAttendenceMeida(companyId, attendance.id, "clockedInImage", attendance.clockedInImage, "jpg", "image")
                attendance.clockedInMediaUrl = url
            }

            if (attendance.clockedOutImage && (!attendance.clockedOutMediaUrl)) {
                media.media = attendance.clockedOutImage;
                media.mediaType = { fileType: "image", extension: "jpeg" };
                media.documentContent = "Attendance"
                let url = await S3Storage.insertAttendenceMeida(companyId, attendance.id, "clockedOutImage", attendance.clockedOutImage, "jpg", "image")
                attendance.clockedOutMediaUrl = url
            }


            const query = {
                text: `INSERT INTO "Attendances" (id, "employeeId", "clockedIn","clockedOut", "adjClockedIn", "adjClockedOut","adjClockedInBy","adjClockedOutBy","clockedInMediaUrl","clockedOutMediaUrl","branchId","clockOutReason") 
                            VALUES ($1, $2, $3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                            ON CONFLICT (id) 
                            DO UPDATE SET "clockedOut" = EXCLUDED."clockedOut",
                                           "adjClockedIn" = EXCLUDED."adjClockedIn",
                                           "adjClockedOut" = EXCLUDED."adjClockedOut",
                                           "adjClockedInBy" = EXCLUDED."adjClockedInBy",
                                          "adjClockedOutBy" = EXCLUDED."adjClockedOutBy",
                                          "clockedInMediaUrl" = EXCLUDED."clockedInMediaUrl",
                                          "clockedOutMediaUrl" = EXCLUDED."clockedOutMediaUrl",
                                          "clockOutReason" = EXCLUDED."clockOutReason"
                                          `,
                values: [attendance.id, attendance.employeeId, attendance.clockedIn, attendance.clockedOut, attendance.adjClockedIn, attendance.adjClockedOut, attendance.adjClockedInBy, attendance.adjClockedOutBy, attendance.clockedInMediaUrl, attendance.clockedOutMediaUrl, attendance.branchId, attendance.clockOutReason]
            }

            await client.query(query.text, query.values)
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
          
            logPosErrorWithContext(error, data, branchId, null, "insertAttendance")

            ;
            throw new Error(error)
        }
    }

} 