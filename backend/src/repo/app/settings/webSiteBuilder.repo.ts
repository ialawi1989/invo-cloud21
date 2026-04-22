import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { CustomMenuThemeSettings, MenuTheme, MenuThemeSettings, PageTheme, PageThemeSettings, WebsiteTheme } from "@src/models/Settings/WebsiteTheme";
import { Company } from "@src/models/admin/company";

import { ValidationException } from "@src/utilts/Exception";
import { PoolClient } from "pg";
import { Helper } from "@src/utilts/helper";

export class WebSiteBuilderRepo {

    public static async setHomPageToFalse(client: PoolClient, id: string | null = null, companyId: string) {
        try {
            const query = {
                text: `UPDATE "WebSiteBuilder"  set "isHomePage" = false where "companyId" = $1 and($2::uuid is null or id <> $2) and "type" = 'Page'`,
                values: [companyId, id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async checkSlug(client: PoolClient, id: string | null = null, slug: string, companyId: string) {
        try {
            const query = {
                text: `select count(*) from "WebSiteBuilder" where  "companyId" = $1 and($2::uuid is null or id <> $2) and "type" = 'Page' and trim(lower("template" ->> 'slug')) = trim(lower($3)) `,
                values: [companyId, id, slug]
            }
            let theme = await client.query(query.text, query.values)

            if (theme && theme.rows && theme.rows.length > 0 && (<any>theme.rows[0]).count > 1) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setFooterMenusToFalse(client: PoolClient, id: string | null = null, companyId: string) {
        try {
            const query = {
                text: `UPDATE "WebSiteBuilder"  set "isFooterMenu" = false where "companyId" = $1 and($2::uuid is null or id <> $2) and "type" = 'Menus'`,
                values: [companyId, id]
            }


            await client.query(query.text, query.values)




        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setPrimaryMenusToFalse(client: PoolClient, id: string | null = null, companyId: string) {
        try {
            const query = {
                text: `UPDATE "WebSiteBuilder"  set "isPrimaryMenu" = false where "companyId" = $1 and($2::uuid is null or id <> $2) and "type" = 'Menus'`,
                values: [companyId, id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async validateThemeSettings(client: PoolClient, companyId: string) {
        try {
            const query = {
                text: `SELECT count(*) FROM "WebSiteBuilder" WHERE "companyId" =$1 and "type" = 'ThemeSettings' `,
                values: [companyId]
            }


            let theme = await client.query(query.text, query.values)

            if (theme && theme.rows && theme.rows.length > 0 && (<any>theme.rows[0]).count > 1) {
                throw new ValidationException("Theme Settings Already Exist")
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    
    public static async insertWebSiteTheme(data: any, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")

            let theme = new WebsiteTheme();
            theme.ParseJson(data);
            theme.companyId = company.id;


            if (theme.type == 'Page') {
                let isSlugExist = await this.checkSlug(client, null, theme.template.slug, company.id)

                if (isSlugExist) {
                    throw new ValidationException("Page Slug Already Used")
                }
                if (theme.isHomePage) {
                    await this.setHomPageToFalse(client, null, company.id)
                }
            }

            if (theme.type == 'Menus') {
                if (theme.isPrimaryMenu) {
                    theme.isFooterMenu = false
                    await this.setPrimaryMenusToFalse(client, null, company.id)
                }

                if (theme.isFooterMenu) {
                    theme.isPrimaryMenu = false
                    await this.setFooterMenusToFalse(client, null, company.id)
                }
            }

            if (theme.type == 'ThemeSettings') {
                await this.validateThemeSettings(client, company.id)
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "WebSiteBuilder" ("companyId", type, template,"isPrimaryMenu","isFooterMenu","isHomePage","translation",name,"createdAt")VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
                values: [theme.companyId, theme.type, theme.template, theme.isPrimaryMenu, theme.isFooterMenu, theme.isHomePage, theme.translation, theme.name, theme.createdAt]
            }

            const themeData = await DB.excu.query(query.text, query.values)
            await client.query("COMMIT")
            return new ResponseData(true, "", { id: (<any>themeData.rows[0]).id })

        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
          
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async updateWebsiteTheme(data: any, company: Company) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let theme = new WebsiteTheme();
            theme.ParseJson(data);

            if (theme.type == 'Page') {
                let isSlugExist = await this.checkSlug(client, theme.id, theme.template.slug, company.id)

                if (isSlugExist) {
                    throw new ValidationException("Page Slug Already Used")
                }
                if (theme.isHomePage) {
                    await this.setHomPageToFalse(client, theme.id, company.id)
                }
            }

            if (theme.type == 'Menus') {
                if (theme.isPrimaryMenu) {
                    theme.isFooterMenu = false
                    await this.setPrimaryMenusToFalse(client, theme.id, company.id)
                }

                if (theme.isFooterMenu) {
                    await this.setFooterMenusToFalse(client, theme.id, company.id)
                }
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "WebSiteBuilder" set  template =$1 ,"isPrimaryMenu"=$2,"isFooterMenu"=$3,"isHomePage"=$4,"translation"=$5,"name" =$6  WHERE id =$7`,
                values: [theme.template, theme.isPrimaryMenu, theme.isFooterMenu, theme.isHomePage, theme.translation, theme.name, theme.id]
            }

            await DB.excu.query(query.text, query.values)
            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getWebSiteThemeSettings(companyId: string) {
        try {


            let settings = new WebsiteTheme();
            settings.themeType = "OldThemeSettings";
            let type = "OldThemeSettings"
            const query: { text: string, values: any } = {
                text: `SELECT* FROM "WebSiteBuilder" WHERE type = $1  and "companyId"=$2`,
                values: [type, companyId]
            }



            const themeData = await DB.excu.query(query.text, query.values)

            if (themeData.rowCount != null && themeData.rowCount > 0) {
                settings.ParseJson((<any>themeData.rows[0]))
            }

            return new ResponseData(true, "", settings)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getWebSitePageSettings(slug: string, companyId: string) {
        try {


            let type = "PageBuilder"
            const query: { text: string, values: any } = {
                text: `SELECT* FROM "WebSiteBuilder" WHERE template->'slug' = $1 and type =$2 and "companyId"=$3`,
                values: [slug, type, companyId]
            }


            const themeData = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", (<any>themeData.rows[0]))
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async deleteDuplicated(id: string, companyId: string, type: string) {
        try {
            const query = {
                text: `DELETE FROM "WebSiteBuilder" WHERE id <> $1 and "companyId" = $2 and "type"=$3`,
                values: [id, companyId, type]
            }

            await DB.excu.query(query.text, query.values);

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async editWebsiteTheme(data: any, company: Company) {
        try {

            let theme = new WebsiteTheme();
            theme.ParseJson(data);


            if (theme.type == 'Menus' || theme.type == 'ThemeSettings') {
                await this.deleteDuplicated(theme.id, company.id, theme.type)
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "WebSiteBuilder" set  template =$1 WHERE id =$2`,
                values: [theme.template, theme.id]
            }

            const themeData = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", [])
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getWebsiteBuilderPageList(company: Company) {
        try {
            let type = "PageBuilder"
            const query: { text: string, values: any } = {
                text: `select id , 
                            replace ((template->'slug')::text,'"','') AS "slug" ,
                            replace ((template->'pageName')::text,'"','') AS "pageName",
                            ( select json_agg(json_build_object('id',t.id,
                                                                 'slug',   replace ((template->'slug')::text,'"',''),
                                                                 'pageName',replace ((template->'pageName')::text,'"','')
                                                                 )) FROM "WebSiteBuilder" t
                                        WHERE t."parentId" = "WebSiteBuilder".id)as "childs" 
                    FROM "WebSiteBuilder" 
                    where type = $1
                    and "parentId" is null
                    and "companyId"=$2`,
                values: [type, company.id]
            }

            let pages = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", { list: pages.rows })
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getMenuSettings(companyId: string) {
        try {


            let type = "Menus"
            const query: { text: string, values: any } = {
                text: `SELECT* FROM "WebSiteBuilder" WHERE  "companyId"=$1 and type=$2`,
                values: [companyId, type]
            }


            const themeData = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", (<any>themeData.rows[0]))
        } catch (error: any) {
          
            throw new Error(error)
        }
    }


    public static async getThemesByType(data: any, company: Company) {
        try {

            let extraColumns = ''
            if (data.type == 'Page' || data.type == 'StaticPage') {
                extraColumns = `, case when "type" = 'Page' or "type" = 'StaticPage' then "template"->>'slug' end as "slug"  , "isHomePage" `
            }
            if (data.type == 'Menus') {
                extraColumns = ` , "isPrimaryMenu","isFooterMenu" `
            }
            if (data.type == 'MobileIconBar') {
                extraColumns = `, "template" `
            }
            if (data.type == 'ContentLibrary' || data.type == 'ContentItem') {
                extraColumns = `, "template" `
            }

            // ── Build WHERE clause ────────────────────────────────────────────
            console.log('getThemesByType', { type: data.type, collectionId: data.collectionId, extraColumns })
            let whereClause = `"companyId" = $1 and "type" = $2`
            const values: any[] = [company.id, data.type]

            if (data.type == 'ContentItem' && data.collectionId) {
                values.push(data.collectionId)
                whereClause += ` and "template"->>'collectionId' = $${values.length}`
            }

            const query: { text: string, values: any[] } = {
                text: `select id, name, "translation" ${extraColumns}
                   from "WebSiteBuilder"
                   where ${whereClause}
                   order by "createdAt" DESC`,
                values
            }

            if (data.type == 'ThemeSettings' || data.type == 'OldThemeSettings') {
                query.text = `SELECT * FROM "WebSiteBuilder" where "companyId" = $1 and "type" = $2 LIMIT 1`
                query.values = [company.id, data.type]
            }

            let list = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", { list: list.rows })

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getById(id: string, company: Company) {
        try {
            const query = {
                text: `select * from "WebSiteBuilder" where "companyId" = $1 and "id" =$2  `,
                values: [company.id, id]
            }

            let list = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", list.rows[0])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async deleteTheme(id: string, company: Company) {
        try {
            const query = {
                text: `delete from "WebSiteBuilder" where "companyId" = $1 and "id" =$2 and "type" <> 'ThemeSettings'  `,
                values: [company.id, id]
            }

            let list = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", list.rows[0])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setHomePage(id: string, companyId: string) {
        try {
            const query = {
                text: `UPDATE "WebSiteBuilder" set "isHomePage" = case when id = $1::uuid then true else false end where "companyId" = $2`,
                values: [id, companyId]
            }

            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getMenus(id: string, companyId: string) {
        try {
            const query = {
                text: `UPDATE "WebSiteBuilder" set "isHomePage" = case when id = $1::uuid then true else false end where "companyId" = $2`,
                values: [id, companyId]
            }

            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async adjustOldThemeSettings() {
        const client = await DB.excu.client()
        try {
            const query = {
                text: `select "companyId" , ("template" ->>'aboutText') as "text" from "WebSiteBuilder" where "type" = 'ThemeSettings' 
                        and  "template" ->>'aboutText' <>'' 
                        and "template" ->>'aboutText'  is not null `
            }

            let aboutText = await client.query(query.text, [])

            let aboutPages = aboutText.rows

            if (aboutPages && aboutPages.length > 0) {
                await this.addPages(client, aboutPages, 'About Us', 'about-us')
            }


            query.text = `select "companyId" , ("template" ->>'aboutText') as "text" from "WebSiteBuilder" where "type" = 'ThemeSettings' 
                        and  "template" ->>'aboutText' <>'' 
                        and "template" ->>'aboutText'  is not null `

            let termsText = await client.query(query.text, [])

            let termsPages = termsText.rows
            if (termsPages && termsPages.length > 0) {
                await this.addPages(client, termsPages, 'Terms & Conditions', 'terms-and-conditions')
            }

            query.text = `Select * from "WebSiteBuilder" where "type" = 'Menus' `
            let menusData = await client.query(query.text, [])
            let menus = menusData.rows
            if (menus && menus.length) {
                await this.addMenus(client, menus, termsPages, aboutPages)
            }

            await client.query("COMMIT")
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }



    public static async addPages(client: PoolClient, pages: any[], pageName: string, pageSlug: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) FROM "WebSiteBuilder" WHERE "companyId" = $1 and "template"->>'slug' = $2`,
                values: []
            }
            const text = `INSERT INTO "WebSiteBuilder" ("companyId","type","template","isHomePage",name,"createdAt") VALUES ($1,$2,$3,$4,$5,$6)`
            for (let index = 0; index < pages.length; index++) {
                const element = pages[index];
                const page = new WebsiteTheme();
                const template = new PageThemeSettings();
                const pageSettings = new PageTheme()
                page.name = pageName
                page.type = 'Page'
                page.companyId = element.companyId

                template.id = 'Section_' + Helper.createGuid();
                template.sectionName = pageName
                template.sectionData.body = element.text
                pageSettings.slug = pageSlug
                pageSettings.sections.push(template);
                page.template = pageSettings
                page.isHomePage = false
                console.log(page)
                const checkSlug = pageSettings.slug == 'about-us' ? 'abouts' : 'terms'
                query.values = [page.companyId, checkSlug]

                const isExist = await client.query(query.text, query.values);
                if (isExist && isExist.rows && isExist.rows.length > 0 && isExist.rows[0].count > 0) {
                    continue
                }
                await client.query(text, [element.companyId, page.type, page.template, page.isHomePage, page.name, page.createdAt])

            }

            return
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addMenus(client: PoolClient, menus: any[], termsPages: any[], aboutPages: any[]) {
        try {

            const text = `INSERT INTO "WebSiteBuilder" ("companyId","type","template","isHomePage",name,"createdAt","isPrimaryMenu","isFooterMenu") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
            for (let index = 0; index < menus.length; index++) {
                const element = menus[index];
                let template = element.template;
                let arrayMenus = template.menus
                let companyId = element.companyId
                console.log(arrayMenus)
                if (arrayMenus && arrayMenus.length > 0) {
                    for (let index2 = 0; index2 < arrayMenus.length; index2++) {
                        const element2 = arrayMenus[index2];
                        let children = element2.menuChilds;
                        if ((!children && index2 + 1 == arrayMenus.length && arrayMenus.length == 1) || (children && children.length == 0 && index2 + 1 == arrayMenus.length && arrayMenus.length == 1)) {
                            await client.query(`Delete from "WebSiteBuilder" where id = $1`, [element.id])
                            continue;
                        }
                        if (children.length > 0) {
                            const theme = new WebsiteTheme();
                            theme.name = element2.menuName
                            theme.companyId = companyId
                            theme.type = 'Menus'
                            theme.isFooterMenu = element2.options.isFooterMenu
                            theme.isPrimaryMenu = element2.options.isPrimaryMenu


                            const menuTemplate = new MenuTheme();


                            for (let index3 = 0; index3 < children.length; index3++) {
                                const child = children[index3];
                                if (child.type == 'link') {
                                    const menuThemeSettings = new CustomMenuThemeSettings();
                                    menuThemeSettings.customUrl = child.customUrl
                                    menuThemeSettings.name = child.title
                                    menuThemeSettings.type = "customUrl"
                                    menuThemeSettings.uId = Helper.createGuid()
                                    menuTemplate.list.push(menuThemeSettings)
                                } else {
                                    const menuThemeSettings = new MenuThemeSettings()
                                    if (child.type == 'terms') {
                                        menuThemeSettings.abbr = 'terms-and-conditions'
                                        menuThemeSettings.name = 'Terms & Conditions'
                                    }
                                    else if (child.type == 'about') {
                                        menuThemeSettings.abbr = 'about-us'
                                        menuThemeSettings.name = 'About Us'
                                    } else {
                                        menuThemeSettings.abbr = child.type
                                        menuThemeSettings.name = child.title
                                    }


                                    menuThemeSettings.uId = Helper.createGuid()
                                    menuTemplate.list.push(menuThemeSettings)
                                    theme.template = menuTemplate
                                }

                                if (index + 1 == children.length) {
                                    let about = aboutPages.find(f => f.companyId = element.companyId)
                                    if (about) {
                                        let aboutLink = theme.template.list.find((f: any) => f.abbr == 'about-us')
                                        if (!aboutLink) {
                                            const menuThemeSettings = new MenuThemeSettings()
                                            menuThemeSettings.abbr = 'about-us'
                                            menuThemeSettings.name = 'About Us'
                                            menuThemeSettings.uId = Helper.createGuid()
                                            theme.template.list.push(menuThemeSettings)
                                        }
                                    }
                                    let term = termsPages.find(f => f.companyId = element.companyId)
                                    if (term) {
                                        let termLink = theme.template.list.find((f: any) => f.abbr == 'terms-and-conditions')
                                        if (!termLink) {
                                            const menuThemeSettings = new MenuThemeSettings()
                                            menuThemeSettings.abbr = 'terms-and-conditions'
                                            menuThemeSettings.name = 'Terms & Conditions'
                                            menuThemeSettings.uId = Helper.createGuid()
                                            theme.template.list.push(menuThemeSettings)
                                        }
                                    }
                                }

                            }


                            await client.query(text, [theme.companyId, theme.type, theme.template, theme.isHomePage, theme.name, theme.createdAt, theme.isPrimaryMenu, theme.isFooterMenu])
                        }


                    }


                    /** delete menus that is converted to new templates  */
                    await client.query(`Delete from "WebSiteBuilder" where id = $1`, [element.id])

                }
            }


            return
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async deleteCollection(id: string, company: Company) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            // Delete all ContentItem children first
            await client.query(
                `DELETE FROM "WebSiteBuilder"
             WHERE "companyId" = $1
               AND "type" = 'ContentItem'
               AND "template"->>'collectionId' = $2`,
                [company.id, id]
            )

            // Delete the collection itself
            await client.query(
                `DELETE FROM "WebSiteBuilder"
             WHERE "companyId" = $1
               AND "id" = $2
               AND "type" = 'ContentLibrary'`,
                [company.id, id]
            )

            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
         
            throw new Error(error)
        } finally {
            client.release()
        }
    }

}