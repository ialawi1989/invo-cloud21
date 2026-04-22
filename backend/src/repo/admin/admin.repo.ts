import { DB } from "@src/dbconnection/dbconnection";
import { TermsVersion } from "@src/models/admin/terms";
import { ResponseData } from "@src/models/ResponseData";


export class AdminRepo {

    public static async save(data: TermsVersion) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN");
            let currentNumber = await AdminRepo.getVersionNumber(client)
            if (!data.version) {
                data.version = currentNumber
            }

            // If new record is active → deactivate others
            if (data.is_active) {
                await client.query(`
                        UPDATE public.terms_versions
                        SET is_active = false
                        WHERE is_active = true
                    `);
            }

            const query = `
                INSERT INTO public.terms_versions
                (version, title, content_md, is_active)
                VALUES ($1, $2, $3, $4)
                RETURNING *
                `;

            const values = [
                data.version,
                data.title || "Terms & Conditions",
                data.content_md,
                data.is_active ?? true
            ];

            const result = await client.query(query, values);

            await client.query("COMMIT");


            return new ResponseData(true, "", result.rows[0])

        } catch (err:any) {
            await client.query("ROLLBACK");

            if (err.code === "23505") {

                if (err.constraint === "ux_terms_active_one") {
                    throw new Error("Only one active terms version can exist at a time.");
                }

                if (err.constraint === "terms_versions_version_key") {
                    throw new Error("This version Number already exists.");
                }
            }
            throw err;
        } finally {
            client.release();
        }
    }

    public static async getById(id: string) {
        try {
            const query = `
                        SELECT *
                        FROM public.terms_versions
                        WHERE id = $1
                            `;

            const result = await DB.excu.query(query, [id]);
            return new ResponseData(true, "", result.rows[0] || null)

        } catch (error) {
            throw error;
        }

    }
    public static async getList(
        data: any
    ) {

        try {
            const page = data.page || 1;
            const limit = data.limit || 10;
            const offset = (page - 1) * limit;

            const dataQuery = `
                SELECT *
                FROM public.terms_versions
                ORDER BY published_at DESC
                LIMIT $1 OFFSET $2
            `;

            const countQuery = `
                SELECT COUNT(*)::int AS total
                FROM public.terms_versions
            `;

            const [dataRes, countRes] = await Promise.all([
                DB.excu.query(dataQuery, [limit, offset]),
                DB.excu.query(countQuery)
            ]);
            const count = Number((<any>countRes.rows[0]).count)
            const pageCount = Math.ceil(count / data.limit)
            let lastIndex = ((data.page) * data.limit)
            if (dataRes.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            const resData = {
                list: dataRes.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }


            return new ResponseData(true, "", resData)
        } catch (error) {
            throw error;
        }
    }


    public static async getLatest() {
        try {
            const query = `
            SELECT *
            FROM public.terms_versions
            WHERE is_active = true
            ORDER BY published_at DESC
            LIMIT 1
            `;

            const result = await DB.excu.query(query);

            return new ResponseData(true, "", result.rows[0] || null)
        } catch (error) {
            throw error;
        }
    }



    public static async activateTerms(id: string) {
        const client = await DB.excu.client()
        try {


            await client.query("BEGIN");

            // Step 1: deactivate all
            await client.query(`
                    UPDATE terms_versions
                    SET is_active = false
                    WHERE is_active = true
                `);

            // Step 2: activate the one you want
            await client.query(`
                    UPDATE terms_versions
                    SET is_active = true
                    WHERE id = $1
                `, [id]);

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error
        } finally {
            client.release()
        }
    }


    public static async getVersionNumber(client?: any) {
        try {
            const now = new Date();

            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");

            const prefix = `${year}-${month}`; // e.g. 2026-04

            const query = `
            SELECT version
            FROM public.terms_versions
            WHERE version LIKE $1
            ORDER BY version DESC
            LIMIT 1
        `;

            const executor = client || DB.excu;
            const result = await executor.query(query, [`${prefix}-v%`]);

            let nextVersionNumber = 1;

            if (result.rows.length > 0) {
                const latestVersion: string = result.rows[0].version;
                const match = latestVersion.match(/-v(\d+)$/);

                if (match) {
                    nextVersionNumber = parseInt(match[1], 10) + 1;
                }
            }

            return `${prefix}-v${nextVersionNumber}`;
        } catch (error) {
            throw error;
        }
    }
}