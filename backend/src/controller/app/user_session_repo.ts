import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData"
import { CreateEmployeeSessionInput } from "@src/models/UserSession"
import { decode } from "jsonwebtoken";
import { PoolClient } from "pg";

export class UserSessionRepo {

    public static async insertUserSession(client: PoolClient, input: CreateEmployeeSessionInput) {
        try {
            // const expireDays = process.env.REFRESH_TOKEN_MAXAGE
            //     ? Number(process.env.REFRESH_TOKEN_MAXAGE.split('d')[0])
            //     : 7;

            const insert = await client.query(
                `INSERT INTO public."EmployeeSessions"
                (employee_id, device_id, refresh_token_hash, expires_at, is_revoked, created_at, updated_at)
                    VALUES
                        ($1, $2, $3,  $4, false, NOW(), NOW())
                    ON CONFLICT (employee_id, device_id)
                    DO UPDATE SET
                refresh_token_hash = EXCLUDED.refresh_token_hash,
                expires_at = EXCLUDED.expires_at,
                is_revoked = false,
                updated_at = NOW()
                returning "employee_id", "device_id"
            `,
                [input.employeeId, input.deviceId, input.refreshTokenHash, input.refreshTokenExpiryDate]
            );
        } catch (error) {
            console.error("Error inserting user session:", error);
            throw error;
        }
    }

    public static async revokeSession(employeeId: string, deviceId: string) {
        try {
            const query = `
                            UPDATE "EmployeeSessions"
                            SET 
                            is_revoked = true,
                            updated_at = NOW()
                            WHERE 
                            employee_id = $1
                            AND device_id = (select id from "EmployeeDevices" where "employee_id" = $1 and "device_id"=$2)
                            AND is_revoked = false
                            RETURNING id;
                        `;

            await DB.excu.query(query, [
                employeeId,
                deviceId,
            ]);

            return new ResponseData(true, "", [])
        } catch (error) {
            throw error
        }
    }

    public static async getUserSessions(employeeId: string) {
        try {
            const query = `
                SELECT 
                    d.device_id,
                    d.device_name,
                    d.platform,
                    d.app_version,
                    d.user_agent,
                    d.last_seen_at,
                    s.created_at as session_created_at
                FROM "EmployeeDevices" d
                LEFT JOIN "EmployeeSessions" s
                    ON s.employee_id = d.employee_id
                    AND s.device_id = d.id

                WHERE d.employee_id = $1
                and  s.is_revoked = false
                ORDER BY d.last_seen_at DESC;
                `;

            const { rows } = await DB.excu.query(query, [employeeId]);

            return new ResponseData(true, "", rows);

        } catch (error) {
            throw error;
        }
    }

    public static async validateDeviceSession(employeeId: string, deviceId: string) {
        try {
            const query = `
               SELECT 
                    count(*) as "count"
                FROM "EmployeeDevices" d
                inner JOIN "EmployeeSessions" s
                    ON s.employee_id = d.employee_id
                    AND s.device_id = d.id
                WHERE d.employee_id = $1
                and   d.id = $2
                and  s.is_revoked = false
                and  expires_at > now()
 
                `;

            const { rows } = await DB.excu.query(query, [employeeId, deviceId]);

            return rows && rows.length > 0 && rows[0].count > 0
        } catch (error) {
            throw error
        }
    }


    public static async logOut(accessToken: string) {
        try {

            const payload:any = decode(accessToken);
            if(!payload) return new ResponseData(true,"",[]);
            const deviceId = payload.deviceId
            const employeeId =  payload.employeeId
            const query = `
                            UPDATE "EmployeeSessions"
                            SET 
                            is_revoked = true,
                            updated_at = NOW()
                            WHERE 
                            employee_id = $1
                            AND device_id = $2
                            AND is_revoked = false
                            RETURNING id;
                        `;

            await DB.excu.query(query, [
                employeeId,
                deviceId,
            ]);

            return new ResponseData(true, "", [])
        } catch (error) {
            throw error
        }
    }

}