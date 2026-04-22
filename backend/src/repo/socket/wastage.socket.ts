import { DB } from "@src/dbconnection/dbconnection";
import { InventoryTransfer } from "@src/models/account/InventoryTransfer";
import { ResponseData } from "@src/models/ResponseData";

import { Socket } from "socket.io"
import { inventoryTransferRepo } from "../app/accounts/inventoryTransfer.repo";




import { CompanyRepo } from "../admin/company.repo";
import { TriggerQueue } from "../triggers/triggerQueue";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketWastage {

    public static async getItems(client: Socket | null, data: any, branchId: string, callback: CallableFunction) {
        try {


            if (data) {
                data = JSON.parse(data)
            }

            const query = {
                text: `with "pro" as (select "Products" .id, 
                      "Products" .name,
                      "Products" ."barcode",
                      "Products" ."UOM",
			          "Products"."type",
                            case when "Products"."type" = 'inventory' or "Products"."type" = 'kit' then 
                                 "BranchProducts"."onHand"
                                 when "Products"."type" = 'batch' then 
                                 sum("ProductBatches"."onHand")
                            end as "onHand",
                          case when "Products"."type" = 'batch'then  JSON_AGG(JSON_BUILD_OBJECT('batch',"ProductBatches"."batch",'onHand', "ProductBatches"."onHand",'unitCost',"ProductBatches"."unitCost",'expireDate',"ProductBatches"."expireDate")) end as "batches"
                             
                           from "Products" 
						   inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id
						   left join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id
						   where "Products"."id" = any($1)
                           and "BranchProducts"."branchId" = $2
                           group by "Products" .id , "BranchProducts".id), "unitcosts" as (
						   
						      select distinct on ("InventoryMovmentRecords"."productId" ) "InventoryMovmentRecords"."productId" , "InventoryMovmentRecords"."createdAt", "InventoryMovmentRecords"."cost" as "unitCost" from "pro"
						   left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "pro".id and "InventoryMovmentRecords"."branchId" = $2
						   where "pro"."type" = 'inventory' or "pro"."type" = 'kit'
						   order by "InventoryMovmentRecords"."productId" , "InventoryMovmentRecords"."createdAt" desc 
						   )
						   
						   select "pro".* ,"unitcosts"."unitCost"  from "pro"
						   left join "unitcosts" on "unitcosts"."productId" = "pro".id
                `,
                values: [data, branchId]
            }

            let products = await DB.excu.query(query.text, query.values);
            let productList = products.rows ?? []

            callback(JSON.stringify(new ResponseData(true, "", productList)))

        } catch (error: any) {

          


            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, data.branchId, null, "getItems")
        }
    }


    public static async saveWastage(client: Socket | null, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data)
            }

            if (!data) {
                return
            }


            let company = await CompanyRepo.getCompanyByBranchId(null, branchId)
            const transfer = new InventoryTransfer();
            transfer.ParseJson(data);
            transfer.branchId = branchId;

            transfer.status = 'Confirmed'
            transfer.source = 'POS'
            transfer.confirmedEmployee = transfer.confirmedEmployee ?? transfer.employeeId

            transfer.transferNumber = (await inventoryTransferRepo.getTransferNumber(branchId, company)).data.transferNumber

            let res = await inventoryTransferRepo.addNewInventoryTransfer(transfer, transfer.employeeId, company)

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "InventoryTransfer", id: res.data.id, companyId: company.id, destinationBranch: data.destinationBranch })

            queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: res.data.id })

            queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [res.data.id] })
            callback(JSON.stringify(res))

        } catch (error: any) {
          
            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, data.branchId, null, "saveWastage")
        }
    }

    public static async getWastage(client: Socket | null, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data)
            }

            if (!data) {
                return
            }


            let company = await CompanyRepo.getCompanyByBranchId(null, branchId)


            let res = await inventoryTransferRepo.getInventoryTransferById(data.id, company.id)

            callback(JSON.stringify(res))


        } catch (error: any) {
          
            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, data.branchId, null, "getWastage")
        }
    }


    public static async getWastageList(client: Socket | null, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data)
            }

            if (!data) {
                return
            }
            let searchValue = data.searchTerm && data.searchTerm.trim() != '' && data.searchTerm != null ? data.searchTerm.toLowerCase().trim() : null;

            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 7 : data.limit);
            let offset = (limit * (page - 1))

            const query = {
                text: `select count(  "InventoryTransfers".id) over(),
                             "InventoryTransfers".id, 
                             "InventoryTransfers"."confirmedEmployee",
                              "Employees"."name" as "employeeName",
                              "InventoryTransfers"."createdDate",
                              "InventoryTransfers"."reference",
                              "InventoryTransfers"."transferNumber"
                              
                              from "InventoryTransfers" 
                       inner join "Employees" on "Employees".id = "InventoryTransfers"."confirmedEmployee"
                where "InventoryTransfers"."branchId"= $1
                and "InventoryTransfers"."source" = 'POS'
                and ($2::text is null or (
                lower("Employees".name) ~lower($2)or 
                lower("InventoryTransfers"."transferNumber") ~lower($2) or
                lower("InventoryTransfers"."reference") ~lower($2)
                ))
                order by "InventoryTransfers"."createdDate" desc
                limit $3
                offset $4
                `,
                values: [branchId, searchValue, limit, offset]
            }



            const transactions = await DB.excu.query(query.text, query.values);

            let count = transactions.rows && transactions.rows.length > 0 ? Number((<any>transactions.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)


            callback(JSON.stringify(new ResponseData(true, "", { list: transactions.rows, pageCount: pageCount })))


        } catch (error: any) {
          
            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, data.branchId, null, "getWastageList")

        }
    }
}