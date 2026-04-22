import { DB } from "@src/dbconnection/dbconnection";
import { PoolClient } from "pg";

export class TermAndConditionsRepo {
    public static async getActiveTerms() {
        try {
            const r = await DB.excu.query(
                `SELECT version, title, content_md, published_at
                    FROM terms_versions
                    WHERE is_active = true
                    ORDER BY published_at DESC
                    LIMIT 1`
            );
            return r.rows[0] ?? null;
        } catch (error) {
            throw error
        }

    }

    public static async getUserAcceptedVersion(userId: string) {
        const r = await DB.excu.query(
            `SELECT accepted_terms_version, accepted_terms_at
                FROM "Employees"
                WHERE id = $1`,
            [userId]
        );
        return r.rows[0] ?? null;
    }


    public static async recordAcceptance(args: {
        userId: string;
        version: string;
        ip?: string | null;
        userAgent?: string | null;
    }) {
        const { userId, version, ip, userAgent } = args;
        try {


            await DB.transaction(async (client: PoolClient) => {
                await client.query(
                    `INSERT INTO user_terms_acceptances(user_id, terms_version, ip, user_agent)
                      VALUES ($1, $2, $3::inet, $4)`,
                    [userId, version, ip ?? null, userAgent ?? null]
                );

                await client.query(
                    `UPDATE "Employees"
                        SET accepted_terms_version = $2,
                            accepted_terms_at = now()
                        WHERE id = $1`,
                    [userId, version]
                );

            })


        } catch (e) {

            throw e;
        }
    }
}