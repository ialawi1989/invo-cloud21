import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { MenuRepo } from '@src/repo/app/product/menu.repo';
import { SocketMenu } from '@src/repo/socket/menu.socket';
import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { PluginRepo } from './../../../repo/app/accounts/plugin.repo';
import { Logger } from '@src/utilts/invoLogger';
const TIMEOUT_DURATION = 30000; // 30 seconds
export class MenuController {
    static token: any = "";
    public static async addMenu(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const data = req.body;
            let resault;
            let branchId;
            await client.query("BEGIN")
            // const branchIds: any[] = [];
            const editMenuIds: any[string] = [];
            const newMenuIds: any[string] = [];
            // if (data.branchIds && data.branchIds.length > 0) {
            //     data.branchIds.forEach((element: any) => {
            //         branchIds.push(element.branchId);
            //     });
            // }

            if (data.id == null || data.id == "") {
                resault = await MenuRepo.addMenu(client, data, company);
                newMenuIds.push(resault.data.id)

            } else {

                resault = await MenuRepo.editMenu(client, data, company);
                editMenuIds.push(data.id)
            }

            const branchIds = await BranchesRepo.getCompanyBranchIds(client, company.id);
            console.log(branchIds)
            if (editMenuIds.length > 0) {
                await SocketMenu.sendUpdatedMenu(client, editMenuIds, branchIds)
            }

            if (newMenuIds.length > 0) {
                await SocketMenu.sendNewdMenu(client, newMenuIds, branchIds)
            }

            await client.query("COMMIT")


            return res.send(resault);
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }
    public static async editMenu(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const company = res.locals.company;
            const data = req.body;
            const edit = await MenuRepo.editMenu(client, data, company);
            await client.query("COMMIT");
            res.send(edit)
        } catch (error: any) {
            await client.query("ROLLBACK");
            throw error
        } finally {
            client.release()
        }
    }
    public static async getMenuList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const menus = await MenuRepo.getMenuList(data, company);
            res.send(menus);
        } catch (error: any) {
            throw error
        }
    }
    public static async getBranchMenu(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params['branchId'];
            const menuId = req.params['menuId'];

            const menus = await MenuRepo.getMenuById(menuId, company);
            res.send(menus);
        } catch (error: any) {
            throw error
        }
    }
    public static async getCompanyMenu(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const menus = await MenuRepo.getCompanyMenu(company);
            res.send(menus);
        } catch (error: any) {
            throw error
        }
    }
    // public static async uploadGruptechMenu(req: Request, res: Response, next: NextFunction) {
    // 	try {
    //         const data = req.body;
    //         console.log("data")
    //         console.log(data)
    //         console.log("data")
    // 		const company =res.locals.company;
    // 		const client = await DB.excu.client();
    //         const menuId = data.menuId
    //         const storeId = data.storeId
    // 		const menu = (await MenuRepo.getGrupTechMenuById(menuId,company,storeId)).data
    //         const config = {
    // 			method: 'POST',
    // 			url: 'https://api.grubtech.io/menu/v1/menus',
    // 			headers: {
    // 				'accept': 'application/json',
    // 				'Content-Type': 'application/json',
    // 				'X-Api-Key': 'hmw6SzeaqU49wCOaXUl2V2zHx1IDcWSe2zgaDrZG'
    // 			},
    // 			data: menu
    // 		};
    // 		const response = (await axios(config)).data
    // 		if (response.success == true) {
    // 			return new ResponseData(true, "", {})
    // 		} else {
    // 			return new ResponseData(false, response.error + " " + response.errorText, {})
    // 		}

    // 	} catch (error: any) {
    //         console.error(error)
    // 		throw new Error(error)
    // 	}
    // }







    public static async uploadGruptechMenu(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const menuId = data.menuId;
            const storeId = data.storeId;
            const token = "liqGqa3N8o3VogWVqVqM77H3f6gW3xxz7sZ5DBiL";
            const menu = (await MenuRepo.getGrupTechMenuById(menuId, company, storeId)).data?.menu;


            let test: any[] = [];
            menu.items.forEach((element: { type: string, priceInfo: { price: number; }; modifierGroups: string | any[]; name: { translations: { [x: string]: any; }; }; }) => {
                let obj = {
                    name: ""
                }

                if (element.priceInfo.price == 0 && element.modifierGroups.length == 0 && element.type == 'ITEM') {
                    obj.name = element.name.translations['en-us']
                    test.push(element.name.translations['en-us']);
                }
            });

            if (test.length > 0) {
                return res.send(new ResponseData(false, 'The following items are missing prices or available options.', { items: test }));
            }
            const config = {
                method: 'PUT',
                url: 'https://api.grubtech.io/menu/v1/menus',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Api-Key': token
                },
                data: menu,
                timeout: TIMEOUT_DURATION, // Setting a timeout for the request
            };


            const response = await axios(config);
            console.log(response)
            if (response.status == 200) {
                return res.send(new ResponseData(true, "", {}));
            }

        } catch (error: any) {
            Logger.error(error.message, { stack: error.stack });

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    // Handle timeout error
                    console.error('Request timed out:', error);
                    return res.send(new ResponseData(false, `${error} ${error}`, {}));
                } else {
                    // Handle other Axios errors
                    console.error('Axios error:', error.response?.data);
                    return res.send(new ResponseData(false, (error.response?.data as any).message, (error.response?.data as any).errors));
                    // throw new Error('Failed to make request to GrubTech API');
                }
            } else {
                // Handle other types of errors
                console.error('General error:', error);
                return res.send(new ResponseData(false, `${error} ${error}`, {}));
            }
        }
    }


    // { "Token": "hmw6SzeaqU49wCOaXUl2V2zHx1IDcWSe2zgaDrZG", "enable": true, "branches": [{ "menuId": "710f2a3a-f509-4d19-999b-5f82c82b888d", "storeId": "123456ScXczxczxczxczxczxczxczxczx", "branchId": "b3cac885-ba05-4d0c-8a61-ac77da18a84d", "isSinked": true, "branchName": "Manama", "branchCurrentPage": 1 }, { "menuId": "32caecca-13a7-46ba-924a-bdf9590e3fea", "storeId": "vnn", "branchId": "95afc684-7ddf-491b-ae9c-226bd5e8932f", "branchName": "Sanabis 1", "branchCurrentPage": 1 }, { "menuId": "b0ed991d-f0f0-4534-bcb8-226022fcc162", "storeId": "v", "branchId": "94ffb51a-adf3-4e20-b45c-3dea0eaa1505", "branchName": "Zayed town", "branchCurrentPage": 1 }], "services": { } }



    public static async GruptechItemAvailable(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let plugin = await PluginRepo.getPluginByName('GrubTech', company);
            let setting = plugin.data.setting;
            const token = this.token;
            const branchId = data.branchId;
            const branchSetting = data.branches.find((element: { branchId: string; }) => element.branchId == branchId)
            const menuId = branchSetting.menuId
            const storeId = branchSetting.storeId
            const itemID = data.itemID;
            // const menu = (await MenuRepo.getGrupTechMenuById(menuId, company, storeId)).data?.menu;
            const config = {
                method: 'PUT',
                url: 'https://api.grubtech.io/menu/v1/menus/' + menuId + '/items/' + itemID + '/availability',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Api-Key': token
                },
                data: {
                    "storeId": storeId,
                    "availability": "AVAILABLE"
                },
                timeout: TIMEOUT_DURATION, // Setting a timeout for the request
            };

            console.log(config);
            const response = await axios(config);
            if (response.status == 200) {
                return res.send(new ResponseData(true, "", {}));
            }

        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    // Handle timeout error
                    console.error('Request timed out:', error);
                    return res.send(new ResponseData(false, `${error} ${error}`, {}));
                } else {
                    // Handle other Axios errors
                    console.error('Axios error:', error.response?.data);
                    return res.send(new ResponseData(false, "", {}));
                    // throw new Error('Failed to make request to GrubTech API');
                }
            } else {
                // Handle other types of errors
                console.error('General error:', error);
                return res.send(new ResponseData(false, `${error} ${error}`, {}));
            }
        }
    }

    public static async GruptechItemUnAvailable(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let plugin = await PluginRepo.getPluginByName('GrubTech', company);
            let setting = plugin.data.setting;
            const token = this.token;
            const branchId = data.branchId;
            const branchSetting = data.branches.find((element: { branchId: string; }) => element.branchId == branchId)
            const menuId = branchSetting.menuId
            const storeId = branchSetting.storeId
            const itemID = data.itemID;
            // const menu = (await MenuRepo.getGrupTechMenuById(menuId, company, storeId)).data?.menu;
            const config = {
                method: 'PUT',
                url: 'https://api.grubtech.io/menu/v1/menus/' + menuId + '/items/' + itemID + '/availability',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Api-Key': token
                },
                data: {
                    "storeId": storeId,
                    "availability": "UNAVAILABLE"
                },
                timeout: TIMEOUT_DURATION, // Setting a timeout for the request
            };

            console.log(config);
            const response = await axios(config);
            if (response.status == 200) {
                return res.send(new ResponseData(true, "", {}));
            }

        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    // Handle timeout error
                    console.error('Request timed out:', error);
                    return res.send(new ResponseData(false, `${error} ${error}`, {}));
                } else {
                    // Handle other Axios errors
                    console.error('Axios error:', error.response?.data);
                    return res.send(new ResponseData(false, "", {}));
                    // throw new Error('Failed to make request to GrubTech API');
                }
            } else {
                // Handle other types of errors
                console.error('General error:', error);
                return res.send(new ResponseData(false, `${error} ${error}`, {}));
            }
        }
    }











    public static async MenuProductList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await MenuRepo.MenuProductList(company, data);
            return res.send(list)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        }
    }

    public static async rearrangeMenu(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body;
            const list = await MenuRepo.rearrangeMenu(data);
            return res.send(list)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        }
    }
}