import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";



import { Plugin } from "@src/models/account/Plugin";

import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { CompanyRepo } from "@src/repo/admin/company.repo";

export class PluginRepo {

    public static async checkIfPluginExists(client: PoolClient, pluginName: string, companyId: string): Promise<boolean> {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "Plugins" where LOWER("pluginName") = LOWER($1) and "companyId" = $2`,
                values: [pluginName, companyId],
            };

            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }

            return false;
        } catch (error: any) {
          
            throw new Error(error)
        }

    }

    public static async savePlugin(data: any, company: Company) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")

            let resault;

            const companyId = company.id;

            const isPluginExit = await this.checkIfPluginExists(client, data.pluginName, company.id)
            const plugin = new Plugin()
            plugin.ParseJson(data)

            if (plugin.pluginName == "GrubTech") {
                const seenStoreIds: Set<number> = new Set();
                for (const branch of plugin.settings.branches) {
                    if (seenStoreIds.has(branch.storeId)) {
                        return new ResponseData(false, 'StoreID is Duplicated in Diffrent Branches', []);
                    }
                    seenStoreIds.add(branch.storeId);
                }
            }

            if (isPluginExit) {
                resault = await this.editPlugin(client, plugin, company.id);
            } else {
                resault = await this.addPlugin(client, plugin, company);
            }


            await client.query("COMMIT")
            return resault

        } catch (error: any) {

            await client.query("ROLLBACK")
            return new ResponseData(false, error.message, []);
        } finally {
            client.release()
        }
    }


    public static async addPlugin(client: PoolClient, plugin: Plugin, company: Company) {
        try {
            const companyId = company.id

            const pluginName = plugin.pluginName
            const settings = plugin.settings


            /** validate plugin Name if exist  */
            const isPluginExit = await this.checkIfPluginExists(client, pluginName, company.id)
            if (isPluginExit) {
                throw new Error("Plugin is  Already  Exist")
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "Plugins" ("pluginName",settings,"companyId","type")
                       VALUES($1,$2,$3,$4)RETURNING id`,
                values: [plugin.pluginName, plugin.settings, companyId, plugin.type]
            }

       
            const pluginData = await client.query(query.text, query.values)
            if(plugin.type == "Aggregator"){
                await CompanyRepo.updateCompanyUpdatedDate(client,company.id)
            }

            return new ResponseData(true, "the plugin added successfully", { id: (<any>pluginData.rows[0]).id })
        }
        catch (error: any) {

          
            throw new Error(error.message)
        }
    }


    public static async editPlugin(client: PoolClient, plugin: Plugin, companyId: string) {

        try {

            const pluginName = plugin.pluginName


            // if( plugin.name == null || plugin.name ==""){
            //     throw new Error("The plugin Name is reqired")
            // }

            const isPluginExit = await this.checkIfPluginExists(client, pluginName, companyId)
            if (!isPluginExit) {
                throw new Error("This Plugin is not Exist")
            }

            let updateDate = new Date();
            //let newData = {"userName": settings.userName, "Password": settings.password}
            const query : { text: string, values: any } = {
                text: `UPDATE "Plugins"
                SET settings = $1,
                    "updateDate"= $2
                WHERE "pluginName"= $3 and "companyId" = $4  ;`,
                values: [plugin.settings, updateDate, plugin.pluginName, companyId]
            }


            await client.query(query.text, query.values)

            if(plugin.type == "Aggregator (Manual Entry)"){
                await CompanyRepo.updateCompanyUpdatedDate(client,companyId)
            }



            return new ResponseData(true, "The plugin successfully updated", []);
        }


        catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async editWhatsAppSetting(data: any, companyId: string) {
        const client = await DB.excu.client()

        try {

            const pluginName = 'WhatsApp'
            await client.query("BEGIN")
            const isPluginExit = await this.checkIfPluginExists(client, pluginName, companyId)
            if (!isPluginExit) {
                throw new Error("This Plugin is not Exist")
            }

            let temp: { [k: string]: any } = {}
            if (data.userName) {
                temp.userName = data.userName
            }
            if (data.password) {
                temp.Password = data.password
            }
            if (data.services) {
                temp.services = data.services
            }

            // let newData = {"userName": data.userName, "Password": data.password}

            const query: { text: string, values: any } = {
                text: `UPDATE "Plugins"
                SET settings = settings || $1
                WHERE lower("pluginName")= lower($2) and "companyId" = $3  ;`,
                values: [temp, pluginName, companyId]
            }


            await client.query(query.text, query.values)

            await client.query("COMMIT")
            return new ResponseData(true, "The plugin successfully updated", []);
        } catch (error: any) {
            console.log(error)
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }



    public static async getPluginList(data: any, company: Company) {
        try {
            const companyId = company.id;
            let selectQuery:any;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }


            const selectText = `SELECT 
                                   id,
                                   "pluginName",
                                   "type",
                                   settings
                                   
            FROM "Plugins"`

            const countText = `SELECT COUNT(*)
                             FROM "Plugins"`

            let filterQuery = ` WHERE "Plugins"."companyId" =$1`
            filterQuery += ` and (LOWER("Plugins"."pluginName") ~ $2)`
            let orderByQuery = `Order By` + sortTerm



            const limitQuery = ` limit $3 offset $4`

            let selectCount;
            //  selectQuery = selectText + filterQuery + ` ORDER BY "Customers"."createdAt" DESC`
            selectValues = [companyId, searchValue]
            if (data != null && data != '' && JSON.stringify(data) != '{}') {


                selectQuery = selectText + filterQuery + limitQuery
                selectValues = data.pluginId ? [companyId, searchValue, limit, offset, data.pluginId] : [companyId, searchValue, limit, offset]
                countQuery = countText + filterQuery
                countValues = [companyId, searchValue]
                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }
            const selectList: any = await DB.excu.query(selectQuery, selectValues)

            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (selectList.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: selectList.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)


        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async getPluginById(pluginIdId: string, company: Company) {
        try {
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `select "id",
"pluginName",
"companyId",
settings,
"type",
"updatedDate",
"updateDate",
 (
    SELECT jsonb_agg(e ORDER BY to_date(e->>'date','YYYYMMDD') DESC)
    FROM jsonb_array_elements(logs::jsonb) e
  ) AS logs
 FROM "Plugins"  
                       WHERE id = $1 
                       AND "companyId"= $2`,
                values: [pluginIdId, companyId]
            }
            const list = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", list.rows[0])
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getPluginByName(name: string, company: Company) {
        try {
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT * 
                       FROM "Plugins" 
                       WHERE "pluginName" = $1 
                       AND "companyId"= $2`,
                values: [name, companyId]
            }
            const list = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", list.rows[0])
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getPluginByNameWithClient(client: PoolClient, name: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT * 
                       FROM "Plugins" 
                       WHERE "pluginName" = $1 
                       AND "companyId"= $2`,
                values: [name, companyId]
            }
            const list = await client.query(query.text, query.values);

            return new ResponseData(true, "", list.rows[0])
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }



}