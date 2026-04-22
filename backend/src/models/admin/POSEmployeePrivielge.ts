import { DB } from "@src/dbconnection/dbconnection"
import { EmployeePrivileg, Privilege } from "./employeePrivielge"
import { ResponseData } from "../ResponseData"
import { Helper } from "@src/utilts/helper"
import { BranchesRepo } from "@src/repo/admin/branches.repo"

export class POSprivielges {


    "newInvoice" = true
    "printOrder" = true
    "newCreditNote" = true
    "editInvoice" = true
    "payOrder" = true
    "voidTicket" = true
    "voidItem" = true
    "adjPrice" = true // when creating invoice adjust price 
    "reOrder" = true
    "orderReady" = true
    "discountOrder" = true // apply 
    "surchargeOrder" = true// apply
    "mergeOrders" = true
    "splitTicket" = true
    "expandedTicket" = true
    "changeServer" = true
    "multiSelection" = true // multi invoice selections 
    "search" = true // search tickets 
    "closedOrders" = true//view closed orders
    "cashDiscount" = true



    //Product
    "requestInventory" = true;
    "kitBuilder" = true;
    "itemsAvailability" = true;//only POS 
    "seasonalPrice" = true;
    "searchItems" = true;


    "labelPrint" = true;

    //DineIn Security
    "changeTable" = true
    "makeReservation" = true
    "viewReservations" = true
    "editReservations" = true


    //deleivry 
    "assignDriver" = true
    "driverArrival" = true // mark 
    "driverReport" = true // view 



    //call sec
    "callHistory" = true
    "pickupCall" = true
    "deliveryCall" = true

    "addCustomer" = true
    "editCustomer" = true

    //saloon
    "changeTask" = true
    "newAppointment" = true
    "editAppointment" = true

    // WORKORDER
    "manageWorkOrder" = true //MANAGE 
    "viewWorkOrder" = true




    //daily op sec 
    "dailyOpertion" = true
    "dailySalesReport" = true
    "cashierHistory" = true
    "manageCashierOut" = true

    //cashier sec
    "cashier" = true //cashier in/out 
    "manuallyOpenCashDrawer" = true
    //house of account 
    "houseAccount" = true//VIEW 
    "moveToHouseAccount" = true
    "payHouseAccount" = true

    //terminal sec
    "terminalSettings" = true
    "minimize" = true
    "login" = true
    "editHouseAccountInvoice" = true;
    "changeConnection" = true

    "pendingOrders" = true

    "taskChecklist" = true


    /**Driver */
    "driverFunctionality" = true
    "driverDispatcher" = true

    "removeTax" = true
    "waitingList" = true
    "searchProducts" = true


    "viewInventoryTransfer" = true
    "addInventoryTransfer" = true

    "viewStockValue" = true
    ParseJson(json: any): void {
        for (const key in json) {
            for (const action in json[key].actions) {
                if (action in this) {

                    const access: any = json[key].actions[action].access
                    this[action as keyof typeof this] = access

                } else {
                    if (key == "invoiceSecurity") {

                        this["newInvoice"] = json[key].actions["add"].access
                        this["printOrder"] = json[key].actions["print"].access
                        this["editInvoice"] = json[key].actions["add"].access
                    }

                    if (key == "workOrderSecurity") {

                        this["manageWorkOrder"] = json[key].actions["add"].access
                        this["viewWorkOrder"] = json[key].actions["view"].access
                    }

                    if (key == "creditNoteSecurity") {

                        this["newCreditNote"] = json[key].actions["add"].access

                    }

                    if (key == "customerSecurity") {

                        this["addCustomer"] = json[key].actions["add"].access
                        this["editCustomer"] = json[key].actions["add"].access

                    }
                    if (key == "inventoryTransferSecurity") {

                        this["viewInventoryTransfer"] = json[key].actions["view"].access
                        this["addInventoryTransfer"] = json[key].actions["add"].access

                    }
                }
            }


        }
    }


    public static async getEmployeePrivielges(branchId: string) {
        const client = await DB.excu.client();
        try {
            /**intiate client */
            await client.query("BEGIN")
            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "EmployeePrivileges".id,
                              "EmployeePrivileges".name,
                              "EmployeePrivileges".privileges, 
                              "EmployeePrivileges"."createdAt",
                              "EmployeePrivileges"."updatedDate"
                                 FROM "EmployeePrivileges" 
                where "EmployeePrivileges"."companyId"  =$1
                    `,
                values: [companyId]
            }
            const privileges: any[] = [];
            const data = await client.query(query.text, query.values);

            for (let index = 0; index < data.rows.length; index++) {
                const element: any = data.rows[index];
                const privilege = new POSprivielges();
                privilege.ParseJson(element.privileges)
                element.privileges = privilege
                privileges.push(element)

            }
            /**commit client */
            await client.query("COMMIT")

            return new ResponseData(true, "", privileges)
        } catch (error: any) {
            /**rollback client */
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            /**release client */
            client.release()
        }
    }


    public static async getEmployeePrivielgesByCompany(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "EmployeePrivileges".id,
                              "EmployeePrivileges".name,
                              "EmployeePrivileges".privileges, 
                              "EmployeePrivileges"."createdAt",
                              "EmployeePrivileges"."updatedDate"
                                 FROM "EmployeePrivileges" 
                INNER JOIN "Branches" on "Branches"."companyId" = "EmployeePrivileges"."companyId" 
                where "EmployeePrivileges"."companyId" =$1
                    `,
                values: [companyId]
            }
            const privileges: any[] = [];
            const data = await DB.excu.query(query.text, query.values);

            for (let index = 0; index < data.rows.length; index++) {
                const element: any = data.rows[index];
                const privilege = new POSprivielges();
                privilege.ParseJson(element.privileges)
                element.privileges = privilege
                privileges.push(element)
            }

            return new ResponseData(true, "", privileges)
        } catch (error: any) {
            throw new Error(error)
        }
    }
}