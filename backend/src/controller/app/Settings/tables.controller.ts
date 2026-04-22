
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { TablesRepo } from '@src/repo/app/settings/tables.repo';
import { SocketTableRepo } from '@src/repo/socket/table.socket';
import { Helper } from '@src/utilts/helper';
import { Request, Response, NextFunction } from 'express';
export class TablesController {

    public static async addTableGroups(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body;
            let resault;
            let branchId;
            const editedTablesIds: any[string] = [];
            let listNewGroups:any= [];
            let listEditedGroups:any=[]
            for (let index = 0; index < data.length; index++) {
                let element = data[index];

                element = await Helper.renameKey(element)
                if (element.tables) {
                    for (let i = 0; i < element.tables.length; i++) {
                        const table = element.tables[i];
                        branchId = element.branchId
                        element.tables[i] = await Helper.renameKey(table)
                    }

                }
            
                if (element.id == null || element.id == "") {

                    resault = await TablesRepo.addTableGroups(client, element, companyId);
               
                    listNewGroups.push(resault.data.group);
                } else {
              
                        resault = await TablesRepo.editTableGroups(client,element, companyId)
 
                        listEditedGroups.push(resault.data.group)
                    
                }
            }


            if(listNewGroups.length>0)
            {
                await SocketTableRepo.sendNewTable(listNewGroups,branchId)

            }
            if(listEditedGroups.length)
            {
                await SocketTableRepo.sendUpdatedTable(listEditedGroups,branchId)

            }
            
            await client.query("COMMIT")

        
            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")
                throw error
        } finally {
            client.release()
        }
    }
    public static async getTableGroupById(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId'];
            const tableGroupId = req.params['groupId'];

            const table = await TablesRepo.getTableGroupbyId(branchId, tableGroupId);
            return res.send(table)
        } catch (error: any) {
                throw error
        }
    }

    public static async unassignTable(req: Request, res: Response, next: NextFunction) {
        try {
            const tableId = req.params['tableId'];

            const table = await TablesRepo.unassignTable(tableId);
            return res.send(table)
        } catch (error: any) {
                throw error
        }
    }
    public static async getTableGroupList(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId']
            const list = await TablesRepo.getTables(branchId)
            return res.send(list)
        } catch (error: any) {
                throw error
        }
    }

    public static async getInActiveGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId']
            const list = await TablesRepo.getInActiveGroups(branchId)
            return res.send(list)
        } catch (error: any) {
                throw error
        }
    }
    public static async getUnassignedTables(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId']
            const list = await TablesRepo.getUnassingedTables(branchId)
            return res.send(list)
        } catch (error: any) {
                throw error
        }
    }
    public static async deleteTableGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const tableGroupId = req.params['tableGroupId']
            const list = await TablesRepo.deleteGroup(tableGroupId)
            return res.send(list)
        } catch (error: any) {
                throw error
        }
    }
}