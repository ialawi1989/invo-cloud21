
import { SendInput, SubscribeInput, UnsubscribeInput } from "@src/controller/app/webpush/webPush.model";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";
import webPush from "web-push";

export class CloudwebPushRepo {
    private static readonly vapidSubject =
        process.env.WEBPUSH_VAPID_SUBJECT || "mailto:your-email@example.com";
    private static readonly vapidPublicKey = process.env.WEBPUSH_VAPID_PUBLIC_KEY || "BORZ1gUU-klH6IOMWoCt2Ya4u_zo3dzjzo_nbNmfjW3hzuKIbG7HNjpWbDI-gD6zhG7QjJSAXmmi7uHDHQ5rij8";
    private static readonly vapidPrivateKey = process.env.WEBPUSH_VAPID_PRIVATE_KEY || "iEhb4saCNBH0a15ClNaiJ24k1Zb6YFoP0dQo8lzde-U";


    private static ensureVapidConfigured() {
        if (!this.vapidPublicKey || !this.vapidPrivateKey) {
            throw new Error("Missing VAPID keys (WEBPUSH_VAPID_PUBLIC_KEY / WEBPUSH_VAPID_PRIVATE_KEY).");
        }
        webPush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
    }

    public static async subscribe(input: SubscribeInput) {
        const client = await DB.excu.client(60);
        try {
            if (!input.employeeId) return new ResponseData(false, "Missing employeeId", []);
            if (!input.companyId) return new ResponseData(false, "Missing companyId", []);
            if (!input.device?.deviceId) return new ResponseData(false, "Missing device.deviceId", []);
            if (!input.subscription?.endpoint) return new ResponseData(false, "Invalid subscription", []);
            if (!input.subscription?.keys?.p256dh || !input.subscription?.keys?.auth) {
                return new ResponseData(false, "Invalid subscription keys", []);
            }

            await client.query("BEGIN");

            // 1) Upsert device (EmployeeDevices)
            const EmployeeDevices = await this.addEmployeeDevice(client, input);
            if (!EmployeeDevices) return new ResponseData(false, "Error Adding Employee Device", []);

            if (EmployeeDevices.isRevoked) {
                await client.query("ROLLBACK");
                return new ResponseData(false, "Device is revoked", []);
            }

            // 2) Upsert push token (DevicePushTokens) for provider=webpush, unique by (provider, endpoint)
            const tok = await client.query(
                `
                    INSERT INTO "DevicePushTokens"
                    ("device_pk","provider","endpoint","p256dh","auth","is_active","last_used_at","updated_at")
                    VALUES
                    ($1,'webpush',$2,$3,$4,true, NOW(), NOW())
                    ON CONFLICT ("provider","endpoint")
                    DO UPDATE SET
                    "device_pk"    = EXCLUDED."device_pk",
                    "p256dh"       = EXCLUDED."p256dh",
                    "auth"         = EXCLUDED."auth",
                    "is_active"    = EXCLUDED."is_active",
                    "revoked_at"   = NULL,
                    "revoke_reason"= NULL,
                    "last_used_at" = NOW(),
                    "updated_at"   = NOW()
                    RETURNING "id"
        `,
                [EmployeeDevices.devicePk, input.subscription.endpoint, input.subscription.keys.p256dh, input.subscription.keys.auth]
            );

            const tokenPk: string = tok.rows[0].id;

            // 3) Map token to company (DeviceCompanySubscriptions)
            await client.query(
                `
                    INSERT INTO "DeviceCompanySubscriptions"
                    ("company_id","device_push_token_pk","is_active","updated_at","created_at")
                    VALUES
                    ($1,$2,true, NOW(), NOW())
                    ON CONFLICT ("company_id","device_push_token_pk")
                    DO UPDATE SET
                    "is_active"  = true,
                    "updated_at" = NOW()
                `,
                [input.companyId, tokenPk]
            );

            await client.query("COMMIT");
            return new ResponseData(true, "", []);
        } catch (error: any) {
            await client.query("ROLLBACK");
            console.log(error);
            throw new Error(error?.message || String(error));
        } finally {
            client.release?.();
        }
    }
    public static async unsubscribe(input: UnsubscribeInput) {
        const client = await DB.excu.client(60);
        try {
            if (!input.companyId) return new ResponseData(false, "Missing companyId", []);
            if (!input.endpoint) return new ResponseData(false, "Missing endpoint", []);

            await client.query("BEGIN");

            // Find tokenPk by endpoint/provider
            const tok = await client.query(
                `SELECT "id","device_pk" FROM "DevicePushTokens" WHERE "provider"='webpush' AND "endpoint"=$1 LIMIT 1`,
                [input.endpoint]
            );
            if (tok.rowCount === 0) {
                await client.query("COMMIT");
                return new ResponseData(true, "", []); // already gone
            }

            const tokenPk: string = tok.rows[0].id;
            const devicePk: string = tok.rows[0].device_pk;

            // Optional safety: ensure the device belongs to employeeId if provided
            if (input.employeeId) {
                const dev = await client.query(
                    `SELECT 1 FROM "EmployeeDevices" WHERE "id"=$1 AND "employee_id"=$2 LIMIT 1`,
                    [devicePk, input.employeeId]
                );
                if (dev.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return new ResponseData(false, "Token does not belong to employee", []);
                }
            }

            // Disable company mapping
            await client.query(
                `
                UPDATE "DeviceCompanySubscriptions"
                SET "is_active"=false, "updated_at"=NOW()
                WHERE "company_id"=$1 AND "device_push_token_pk"=$2
                `,
                [input.companyId, tokenPk]
            );

            // If token is not active for ANY company anymore, disable token as well
            const stillActive = await client.query(
                `
                SELECT 1 FROM "DeviceCompanySubscriptions"
                WHERE "device_push_token_pk"=$1 AND "is_active"=true
                LIMIT 1
                `,
                [tokenPk]
            );

            if (stillActive.rowCount === 0) {
                await client.query(
                    `
                        UPDATE "DevicePushTokens"
                        SET "is_active"=false, "updated_at"=NOW()
                        WHERE "id"=$1
                     `,
                    [tokenPk]
                );
            }

            await client.query("COMMIT");
            return new ResponseData(true, "", []);
        } catch (error: any) {
            await client.query("ROLLBACK");
            console.log(error);
            throw new Error(error?.message || String(error));
        } finally {
            client.release?.();
        }
    }

    public static async sendNotification(input: SendInput) {
        this.ensureVapidConfigured();

        const client = await DB.excu.client(60);
        try {
            const { companyId, payload, employeeId } = input;
            if (!companyId) throw new Error("Missing companyId");

            // Pull all active webpush subs for company (and optionally employee)
            const r = await client.query(
                `
            SELECT
            dpt."id"  as "token_id",
            dpt."endpoint",
            dpt."p256dh",
            dpt."auth"
            FROM "DeviceCompanySubscriptions" dcs
            JOIN "DevicePushTokens" dpt
            ON dpt."id" = dcs."device_push_token_pk"
            JOIN "EmployeeDevices" ed
            ON ed."id" = dpt."device_pk"
            WHERE dcs."company_id" = $1
            AND dcs."is_active" = true
            AND dpt."provider" = 'webpush'
            AND dpt."is_active" = true
            AND ed."is_revoked" = false
            AND ($2::uuid IS NULL OR ed."employee_id" = $2)
        `,
                [companyId, employeeId ?? null]
            );

            if (r.rowCount === 0) return { sent: 0, failed: 0 };

            const payloadToSend = JSON.stringify({
                notification: {
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon ?? "",
                    url: payload.url ?? "",
                    tag: payload.tag ?? "",
                    data: payload.data ?? null,
                }
            });

            let sent = 0;
            let failed = 0;

            // Send sequentially (simple). You can add concurrency later.
            for (const row of r.rows) {
                const subscription = {
                    endpoint: row.endpoint,
                    keys: { p256dh: row.p256dh, auth: row.auth },
                };

                try {
                    await webPush.sendNotification(subscription as any, payloadToSend);
                    sent++;

                    // update last_used_at
                    await client.query(
                        `UPDATE "DevicePushTokens" SET "last_used_at"=NOW(), "updated_at"=NOW() WHERE "id"=$1`,
                        [row.token_id]
                    );
                } catch (e: any) {
                    failed++;
                    const statusCode = e?.statusCode;

                    // 410 Gone / 404 Not Found => dead subscription: cleanup
                    if (statusCode === 410 || statusCode === 404) {
                        await this.deleteDeadToken(client, row.token_id);
                    } else {
                        console.log("webpush error", { statusCode, message: e?.message });
                    }
                }
            }

            return { sent, failed };
        } finally {
            client.release?.();
        }
    }

    // -----------------------------
    // Cleanup helper for dead tokens
    // -----------------------------
    private static async deleteDeadToken(client: any, tokenPk: string) {
        // cascade will remove company mappings if FK set on delete cascade
        await client.query(`DELETE FROM "DevicePushTokens" WHERE "id"=$1`, [tokenPk]);
    }


    public static async getCompanyToggleStatus(args: {
        companyId: string;
        employeeId: string;
        deviceId?: string | null;
    }): Promise<{ enabledForCompany: boolean }> {
        const client = await DB.excu.client(60);
        try {
            const { companyId, employeeId, deviceId } = args;

            const r = await client.query(
                `
        SELECT 1
        FROM "DeviceCompanySubscriptions" dcs
        JOIN "DevicePushTokens" dpt
          ON dpt."id" = dcs."device_push_token_pk"
        JOIN "EmployeeDevices" ed
          ON ed."id" = dpt."device_pk"
        WHERE dcs."company_id" = $1
          AND ed."employee_id" = $2
          AND dcs."is_active" = true
          AND dpt."provider" = 'webpush'
          AND dpt."is_active" = true
          AND ed."is_revoked" = false
          AND ($3::text IS NULL OR ed."device_id" = $3)
        LIMIT 1
        `,
                [companyId, employeeId, deviceId ?? null]
            );
            const enabledForCompany = r.rowCount && r.rowCount > 0 ? true : false
            return { enabledForCompany: enabledForCompany };
        } finally {
            client.release?.();
        }
    }

    public static async disableCompanyForDevice(args: {
        companyId: string;
        employeeId: string;
        deviceId: string;
    }) {
        const client = await DB.excu.client(60);
        try {
            const { companyId, employeeId, deviceId } = args;

            await client.query("BEGIN");

            // find tokens for this employee+device
            const tokens = await client.query(
                `
                    SELECT dpt."id" AS "token_id"
                    FROM "DevicePushTokens" dpt
                    JOIN "EmployeeDevices" ed ON ed."id" = dpt."device_pk"
                    WHERE ed."employee_id" = $1
                    AND ed."device_id" = $2
                    AND dpt."provider" = 'webpush'
        `,
                [employeeId, deviceId]
            );

            if (tokens.rowCount === 0) {
                await client.query("COMMIT");
                return new ResponseData(true, "", []);
            }

            // disable mapping for this company for all those tokens
            const tokenIds = tokens.rows.map((x: any) => x.token_id);

            await client.query(
                `
                    UPDATE "DeviceCompanySubscriptions"
                    SET "is_active"=false, "updated_at"=NOW()
                    WHERE "company_id"=$1
                    AND "device_push_token_pk" = ANY($2::uuid[])
        `,
                [companyId, tokenIds]
            );

            // Optional: disable token if no longer active for any company
            await client.query(
                `
                UPDATE "DevicePushTokens" t
                SET "is_active"=false, "updated_at"=NOW()
                WHERE t."id" = ANY($1::uuid[])
                AND NOT EXISTS (
                    SELECT 1 FROM "DeviceCompanySubscriptions" dcs
                    WHERE dcs."device_push_token_pk" = t."id"
                    AND dcs."is_active" = true
          )
        `,
                [tokenIds]
            );

            await client.query("COMMIT");
            return new ResponseData(true, "", []);
        } catch (e: any) {
            await client.query("ROLLBACK");
            console.log(e);
            throw new Error(e?.message || String(e));
        } finally {
            client.release?.();
        }
    }



    public static async brodcastMessage(input: SendInput) {
        this.ensureVapidConfigured();

        const client = await DB.excu.client(60);
        try {
            const { companyId, payload, employeeId } = input;
            // if (!companyId) throw new Error("Missing companyId");

            // Pull all active webpush subs for company (and optionally employee)
            const r = await client.query(
                `--sql
            SELECT
            dpt."id"  as "token_id",
            dpt."endpoint",
            dpt."p256dh",
            dpt."auth"
            FROM "DeviceCompanySubscriptions" dcs
            JOIN "DevicePushTokens" dpt
            ON dpt."id" = dcs."device_push_token_pk"
            JOIN "EmployeeDevices" ed
            ON ed."id" = dpt."device_pk"
            WHERE ($1::uuid IS NULL or dcs."company_id" = $1)
            AND dcs."is_active" = true
            AND dpt."provider" = 'webpush'
            AND dpt."is_active" = true
            AND ed."is_revoked" = false
            AND ($2::uuid IS NULL OR ed."employee_id" = $2)
        `,
                [companyId, employeeId ?? null]
            );

            if (r.rowCount === 0) return { sent: 0, failed: 0 };

            const payloadToSend = JSON.stringify({
                notification: {
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon ?? "",
                    url: payload.url ?? "",
                    tag: payload.tag ?? "",
                    data: payload.data ?? null,
                }
            });

            let sent = 0;
            let failed = 0;

            // Send sequentially (simple). You can add concurrency later.
            for (const row of r.rows) {
                const subscription = {
                    endpoint: row.endpoint,
                    keys: { p256dh: row.p256dh, auth: row.auth },
                };

                try {
                    await webPush.sendNotification(subscription as any, payloadToSend);
                    sent++;

                    // update last_used_at
                    await client.query(
                        `UPDATE "DevicePushTokens" SET "last_used_at"=NOW(), "updated_at"=NOW() WHERE "id"=$1`,
                        [row.token_id]
                    );
                } catch (e: any) {
                    failed++;
                    const statusCode = e?.statusCode;

                    // 410 Gone / 404 Not Found => dead subscription: cleanup
                    if (statusCode === 410 || statusCode === 404) {
                        await this.deleteDeadToken(client, row.token_id);
                    } else {
                        console.log("webpush error", { statusCode, message: e?.message });
                    }
                }
            }

            return { sent, failed };
        } finally {
            client.release?.();
        }
    }

    public static async addEmployeeDevice(client: PoolClient | null, input: SubscribeInput) {
        try {


            const query = {
                text: `
                    INSERT INTO "EmployeeDevices"
                    ("employee_id","device_id","device_name","platform","app_version","user_agent","ip_last","last_seen_at","updated_at")
                    VALUES
                    ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
                    ON CONFLICT ("employee_id","device_id")
                    DO UPDATE SET
                    "device_name" = EXCLUDED."device_name",
                    "platform"    = EXCLUDED."platform",
                    "app_version" = EXCLUDED."app_version",
                    "user_agent"  = EXCLUDED."user_agent",
                    "ip_last"     = EXCLUDED."ip_last",
                    "last_seen_at"= NOW(),
                    "updated_at"  = NOW()
                    RETURNING "id","is_revoked"
              `,
                values: [
                    input.employeeId,
                    input.device.deviceId,
                    input.device.deviceName ?? null,
                    input.device.platform ?? null,
                    input.device.appVersion ?? null,
                    input.device.userAgent ?? null,
                    input.device.ipLast ?? null,
                ]
            }

            const dev = client ? await client.query(query.text, query.values) : await DB.exec.query(query.text, query.values);
            const devicePk: string = dev.rows[0].id;
            const isRevoked: boolean = dev.rows[0].is_revoked;

            return { devicePk: devicePk, isRevoked: isRevoked }
        } catch (error: any) {
            throw new Error(error)
        }
    }

}