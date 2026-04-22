import { DB } from "@src/dbconnection/dbconnection"
import { Company } from "@src/models/admin/company"
import { ResponseData } from "@src/models/ResponseData"
import { Customization, SettingsCustomField } from "@src/models/Settings/Customization"

const TAB_META_KEYS = new Set(["id", "type", "sortOrder", "isActive", "required"])

function hasText(v: any) {
    return typeof v === "string" && v.trim() !== ""
}

function isEffectivelyEmpty(v: any): boolean {
    if (v === null || v === undefined) return true
    if (typeof v === "string") return v.trim() === ""
    if (typeof v === "number" || typeof v === "boolean") return false
    if (Array.isArray(v)) return v.every(isEffectivelyEmpty)
    if (typeof v === "object") {
        return Object.keys(v).every(
            (k) => TAB_META_KEYS.has(k) || isEffectivelyEmpty(v[k])
        )
    }
    return false
}

function sanitizeValue(v: any): any {
    if (Array.isArray(v)) {
        return v.map(sanitizeValue).filter((x) => !isEffectivelyEmpty(x))
    }
    if (v && typeof v === "object") {
        const out: any = {}
        for (const [k, val] of Object.entries(v)) out[k] = sanitizeValue(val)
        return out
    }
    return v
}

function sanitizeTabBuilder(tabBuilder: any) {
    if (!tabBuilder || !Array.isArray(tabBuilder.templates)) return tabBuilder
    const templates = tabBuilder.templates
        .map((t: any) => sanitizeValue(t))
        .filter((t: any) => t && (hasText(t.name) || hasText(t.abbr)))
    return { ...tabBuilder, templates }
}

export class CustomizationRepo {


    public static async validateType(companyId:string,type:string)
    {
        try {
            const query={
                text: `SELECT * FROM "CustomizationSettings" where "companyId" = $1 and "type" = $2`,
                values:[companyId,type]
            }

            let settings = await DB.exec.query(query.text,query.values);

            if(settings && settings.rows.length>0 )
            {
                return true
            }

            return false 
        } catch (error:any) {
            throw new Error(error)
        }
    }
    public static async saveCustomization(data: any, company: Company) {
        try {
            console.log("saveCustomization", data)
            const custom = new Customization()
            custom.ParseJson(data)

            const settingsToSave = { ...(data.settings || {}) }
            if (settingsToSave.tabBuilder) {
                settingsToSave.tabBuilder = sanitizeTabBuilder(settingsToSave.tabBuilder)
            }

            const existing = await DB.excu.query(
                `SELECT id FROM "CustomizationSettings" WHERE "companyId" = $1 AND "type" = $2 LIMIT 1`,
                [company.id, custom.type]
            )

            if (existing.rows.length > 0) {
                const existingId = (<any>existing.rows[0]).id
                await DB.excu.query(
                    `UPDATE "CustomizationSettings"
                     SET "settings" = COALESCE("settings", '{}'::jsonb) || $1::jsonb
                     WHERE id = $2 AND "companyId" = $3`,
                    [JSON.stringify(settingsToSave), existingId, company.id]
                )
                return new ResponseData(true, "", { id: existingId })
            }

            let query = {
                text: `INSERT INTO "CustomizationSettings" ("companyId","type","settings") values($1,$2,$3) Returning id`,
                values: [company.id, data.type, settingsToSave]
            }

            let saved = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", { id: (<any>saved.rows[0]).id })
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async editCustomization(data: any, key: string, company: Company) {
        try {


            let customization = new Customization()
            if (!customization.validateKey(key)) {
                throw new Error("Invalid Key")
            }
            customization.ParseJson(data)
            let settings = data.settings[key]
            if (key === "tabBuilder") {
                settings = sanitizeTabBuilder(settings)
            }


            let query = {
                text: `UPDATE "CustomizationSettings"
                        SET "settings" = jsonb_set(
                            COALESCE("settings", '{}'::jsonb),
                            '{${key}}',
                            $1::jsonb  
                        )
                        WHERE  id = $2   and "companyId" =$3`,
                values: [JSON.stringify(settings), data.id, company.id]
            }

            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", { id: data.id })
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }



    public static async getCustomizations(data: any, company: Company) {
        try {

            const page = data.page ?? 1;
            const limit = data.limit ?? 15;
            let offset = 0

            offset = (page - 1) * limit;

            let query = {
                text: `select 
                       count(id) over() as "count",
                       id ,
                       "type" 
                   from "CustomizationSettings"   where "companyId" =$1 `,
                values: [company.id]
            }

            let list = await DB.excu.query(query.text, query.values)
            let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (list.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getById(data: any, company: Company) {
        try {

            const id = data.id
            const key = data.key;
            let customization = new Customization()
            if (!customization.validateKey(key)) {
                throw new Error("Invalid Key")
            }
            let query = {
                text: `select "CustomizationSettings".id , "CustomizationSettings"."type", ("settings"->>'${key}')::jsonb as "${key}"  from "CustomizationSettings"   where "companyId" =$1 and id = $2 `,
                values: [company.id, id]
            }

            let custom = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", custom.rows[0])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getInvoiceTemplate(companyId: String) {
        try {
            const type = "invoice"
            const key = "invoiceBuilder"

            let query = {
                text: `select "CustomizationSettings".id, 
                        case when "CustomizationSettings".id is not null  and (settings->>'${key}') is not null  then (settings->>'${key}')::jsonb 
                                when "CustomizationSettings".id is  null and $2::text ='product' then ("productOptions"->>'${key}')::jsonb
                                when "CustomizationSettings".id is  null and $2::text ='branch' then ("branchOptions"->>'${key}')::jsonb 
                                when ("CustomizationSettings".id is  null or   (settings->>'${key}') is  null)   and $2::text ='invoice' and $3::text = 'invoiceBuilder' then "invoiceTemplate"::jsonb end as "${key}"
                    from "Companies"
                    left join "CustomizationSettings" on "companyId" = "Companies".id and  "CustomizationSettings"."type" = $2
                    where "Companies".id =$1 `,
                values: [companyId, type, key]
            }
            let data = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", data.rows[0])


        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getCustomizationByKey(type: string, key: string, company: Company) {
        try {
            /** later add validation in mode */

            const custom = new Customization()
            custom.type = type
            // if (!custom.validateKey()) {
            //     throw new ValidationException("Key Not Found")
            // }
            let query = {
                text: `select "CustomizationSettings".id, 
                        case when "CustomizationSettings".id is not null  and (settings->>'${key}') is not null  then (settings->>'${key}')::jsonb 
                                when "CustomizationSettings".id is  null and $2::text ='product' then ("productOptions"->>'${key}')::jsonb
                                when "CustomizationSettings".id is  null and $2::text ='branch' then ("branchOptions"->>'${key}')::jsonb 
                                when ("CustomizationSettings".id is  null or   (settings->>'${key}') is  null)   and $2::text ='invoice' and $3::text = 'invoiceBuilder' then "invoiceTemplate"::jsonb end as "${key}"
                    from "Companies"
                    left join "CustomizationSettings" on "companyId" = "Companies".id and  "CustomizationSettings"."type" = $2
                    where "Companies".id =$1 `,
                values: [company.id, type, key]
            }
            console.log(query.values)
            let data = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", data.rows[0])


        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getCustomizationByType(type: string, company: Company) {
        try {
            /** later add validation in mode */

            const custom = new Customization()
            custom.type = type
            // if (!custom.validateKey()) {
            //     throw new ValidationException("Key Not Found")
            // }
            let query = {
                text: `select "CustomizationSettings".id
                    from "Companies"
                    left join "CustomizationSettings" on "companyId" = "Companies".id and  "CustomizationSettings"."type" = $2
                    where "Companies".id =$1 `,
                values: [company.id, type]
            }

            let data = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", data.rows[0])


        } catch (error: any) {
            throw new Error(error)
        }
    }
}