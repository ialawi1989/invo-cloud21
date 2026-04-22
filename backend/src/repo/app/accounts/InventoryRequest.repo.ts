import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { InventoryRequest, InventoryRequestLine } from "@src/models/account/InventoryRequest";
import { Company } from "@src/models/admin/company";

import { PurchaseOrder } from "@src/models/account/PurchaseOrder";
import { PoolClient } from "pg";
import { PurchaseOrderRepo } from "./PurchaseOrder.Repo";
import { PurchaseOrderLine } from "@src/models/account/PurchaseOrderLines";
import { AccountsRepo } from "./account.repo";

export class InventoryRequestRepo {
  public static async insertInventoryRequest(data: any, company: Company, employeeId: string) {
    const client = await DB.excu.client()
    try {

      const request = new InventoryRequest();
      request.ParseJson(data);

      await client.query("BEGIN")
      const query: { text: string, values: any } = {
        text: `INSERT INTO "InventoryRequests" ("createdAt","branchId","employeeId") VALUES ($1,$2,$3) returning id`,
        values: [request.createdAt, request.branchId, employeeId]
      }

      let insert = await client.query(query.text, query.values);
      request.id = (<any>insert.rows[0]).id

      for (let index = 0; index < request.lines.length; index++) {
        const element = request.lines[index];
        element.requestId = request.id
        await this.saveLines(client, element)


      }
      await client.query("COMMIT")

      return new ResponseData(true, "", { id: request.id })
    } catch (error: any) {
      await client.query("ROLLBACK")
      console.log(error)
      throw new Error(error)
    } finally {
      client.release()
    }
  }


  public static async editRequestInventory(data: any, company: Company) {
    const client = await DB.excu.client()
    try {

      const request = new InventoryRequest()
      request.ParseJson(data)

      await client.query("BEGIN")
      const query: { text: string, values: any } = {
        text: `UPDATE "InventoryRequests" SET "branchId"=$1
                                                   
                  
                                                      WHERE id=$2`,
        values: [request.branchId, request.id]
      }

      let insert = await client.query(query.text, query.values);
      for (let index = 0; index < request.lines.length; index++) {
        const element = request.lines[index];

        if (element.id != "" && element.id != null) {
          await this.editLines(client, element)

        } else {
          element.requestId = request.id;
          await this.saveLines(client, element)
        }

      }
      await client.query("COMMIT")

      return new ResponseData(true, "", { id: request.id })
    } catch (error: any) {
      await client.query("ROLLBACK")
      console.log(error)
      throw new Error(error)
    } finally {
      client.release()
    }
  }


  public static async saveLines(client: PoolClient, line: InventoryRequestLine) {
    try {
      const query: { text: string, values: any } = {
        text: `INSERT INTO "InventoryRequestLines" ("productId","supplierId","priority","requestId","qty") VALUES($1,$2,$3,$4,$5)`,
        values: [line.productId, line.supplierId, line.priority, line.requestId, line.qty]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }



  public static async editLines(client: PoolClient, line: InventoryRequestLine) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "InventoryRequestLines" SET "productId"=$1,"supplierId"=$2,"priority"=$3,qty=$4 where id=$5`,
        values: [line.productId, line.supplierId, line.priority, line.qty, line.id]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  //TODO:RETURN IF ALL HAS SUPPLIERS TRUE ELSE FALSE

  public static async getRequestInventoryList(data: any, company: Company, branchList: []) {
    try {
      const companyId = company.id;
      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
      const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList

      let sort = data.sortBy;
      let sortValue = !sort ? '"InventoryRequests"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;


      let offset = 0;
      let page = data.page ?? 1
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }


      const query: { text: string, values: any } = {
        text: `select
                    COUNT(*) OVER(),
                    case
                      when count("InventoryRequestLines"."id") =
                          count("InventoryRequestLines"."supplierId")
                      then true else false
                    end as "hasSupplier",

                    "InventoryRequests".id,
                    "Branches"."name" as "branchName",
                    "InventoryRequests"."createdAt",
                    "InventoryRequests"."status",
                    "Employees".name as "employeeName",

                    COALESCE(
                      jsonb_agg(
                        DISTINCT jsonb_build_object(
                          'id', "PurchaseOrders".id,
                          'purchaseNumber', "PurchaseOrders"."purchaseNumber"
                        )
                      ) FILTER (WHERE "PurchaseOrders".id IS NOT NULL),
                      '[]'::jsonb
                    ) as "purchaseOrders"

                  from "InventoryRequests"
                  join "InventoryRequestLines"
                    on "InventoryRequestLines"."requestId" = "InventoryRequests".id
                  inner join "Branches"
                    on "Branches".id = "InventoryRequests"."branchId"
                  left join "Employees"
                    on "Employees".id = "InventoryRequests"."employeeId"
                  left join LATERAL
                    jsonb_array_elements_text("InventoryRequests"."purchaseIds") as pid(purchaseId)
                    on true
                  left join "PurchaseOrders"
                    on "PurchaseOrders".id = pid.purchaseId::uuid
                  where "Branches"."companyId" = $1
                    and (array_length($2::uuid[], 1) is null
                        or ("Branches".id = any($2::uuid[])))
                    and (
                      lower("Branches".name) ~ $3
                      or lower("Employees".name) ~ $3
                    )
                  group by
                    "InventoryRequests".id,
                    "Branches"."name",
                    "InventoryRequests"."createdAt",
                    "InventoryRequests"."status",
                    "Employees".name
                  ${orderByQuery}
                  limit $4 offset $5;`,
        values: [company.id, branches, searchValue, limit, offset]
      }


      const selectList: any = await DB.excu.query(query.text, query.values)
      let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
      let pageCount = Math.ceil(count / data.limit)
      offset += 1;
      let lastIndex = ((page) * limit)
      if (selectList.rows.length < limit || page == pageCount) {
        lastIndex = count
      }

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
    
      throw new Error(error)
    }
  }


  public static async getById(requestId: string, company: Company) {
    try {


      const query: { text: string, values: any } = {
        text: `
        SELECT  "InventoryRequests".*,
                 case when count( "PurchaseOrders".*) = 0 then null else json_AGG(json_build_object('id',"PurchaseOrders".id,'purchaseNumber', "PurchaseOrders"."purchaseNumber"))end as "details" 
           
        FROM "InventoryRequests"
        INNER JOIN "Branches" ON "Branches".id = "InventoryRequests"."branchId"
        LEFT JOIN "PurchaseOrders" on  "PurchaseOrders".id = any(SELECT jsonb_array_elements_text("purchaseIds")::uuid  )
        where "InventoryRequests".id = $1
         and "Branches"."companyId" =$2
         group by "InventoryRequests".id
                     `,
        values: [requestId, company.id]
      }

      let insert = await DB.excu.query(query.text, query.values);

      let request = new InventoryRequest();
      request.ParseJson(insert.rows[0]);
      if (request.id != "" && request.id != null) {
        query.text = `SELECT "InventoryRequestLines".*,
                              "Products"."unitCost",
                              "Suppliers".name as "supplierName",
                                  "Taxes".id as "taxId",
                                  "Taxes"."taxPercentage",
                                  "Taxes"."taxType",
                                  "Taxes"."taxes",
                                  "Companies"."isInclusiveTax",
                                  JSON_BUILD_OBJECT('productId',"Products"."id",'UOM', "Products"."UOM", 'barcode',"Products"."barcode",'productName',"Products"."name") as "selectedItem"
                      FROM "InventoryRequestLines"
                      LEFT JOIN "Products" on "Products".id = "InventoryRequestLines"."productId"
                      inner join "Companies" on "Companies".id = "Products"."companyId"
                      LEFT JOIN "Taxes" on "Taxes".id =  "Products"."taxId"
                      LEFT JOIN "Suppliers" on "Suppliers".id = "InventoryRequestLines"."supplierId"
                      where "requestId" = $1`
        query.values = [requestId]

        const lines: any = await DB.excu.query(query.text, query.values);
        request.lines = lines.rows ?? []
      }

      return new ResponseData(true, "", request)

    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }


  public static async delete(requestId: string) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN")

      const query: { text: string, values: any } = {
        text: `DELETE FROM "InventoryRequestLines" where "requestId" =$1;
              
             `,
        values: [requestId]
      }
      await client.query(query.text, query.values);
      query.text = `DELETE FROM "InventoryRequests" where id=$1`
      await client.query(query.text, query.values);
      await client.query("COMMIT")
      return new ResponseData(true, "", [])

    } catch (error: any) {
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally {
      client.release()
    }
  }

  public static async convertToPurchaseOrder(data: any, company: Company, employeeId: string) {
    const client = await DB.excu.client()
    try {

      let branchId;
      let inventoryRequestId = data.requestId
      await client.query("BEGIN")
      const query: { text: string, values: any } = {
        text: `with "requests" as (
                select  "InventoryRequests".id , "branchId",status from "InventoryRequests" 
                inner join "Branches" on "Branches".id = "InventoryRequests"."branchId"
                where "InventoryRequests".id =$1
                and "Branches"."companyId" = $2
                )
                select "requests".*,
                        json_agg(json_build_object('id',"InventoryRequestLines".id,
                                                   'productId',"InventoryRequestLines"."productId",
                                                   'supplierId',"InventoryRequestLines"."supplierId",
                                                   'qty',"InventoryRequestLines"."qty",
                                                   'unitCost', case when "SupplierItems"."cost" is null then "Products"."unitCost" else "SupplierItems"."cost" end,
                                                   'taxId', "Taxes".id,
                                                   'taxPercentage',"Taxes"."taxPercentage",
                                                   'taxType', "Taxes"."taxType",
                                                   'taxes',"Taxes"."taxes"
                                                   )) as lines
                from "InventoryRequestLines"
                inner join "requests" on "requests".id = "InventoryRequestLines"."requestId"
                left join "Products" on "Products".id = "InventoryRequestLines"."productId"
                left join "Taxes" on "Taxes".id = "Products"."taxId"
                left join  "SupplierItems" on "InventoryRequestLines"."supplierId" = "SupplierItems"."supplierId" and "SupplierItems"."productId" =  "Products".id
                group by "requests".id,"requests"."branchId","requests"."status"`,
        values: [inventoryRequestId, company.id]
      }

      let request = await client.query(query.text,query.values);
      let ids: any[] = []
      let status = "Converted"
      if (request.rows && request.rows.length > 0) {
        let inventoryRequest = new InventoryRequest();
        inventoryRequest.ParseJson(request.rows[0]);
        branchId = inventoryRequest.branchId;
        if (inventoryRequest.status == 'Converted') {
          throw new Error("Request Is Already Converted to Purchase Order")
        }
        let items = inventoryRequest.lines.reduce((acc: any, obj: any) => {
          const { supplierId } = obj;
          const existingEntry = acc.find((entry: any) => entry.supplierId === supplierId);
          if (existingEntry) {
            existingEntry.items.push(obj);
          } else {
            acc.push({ supplierId, items: [obj] });
          }
          return acc;
        }, []);

        console.log(items)

        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + 1)

        let purchaseOrder = new PurchaseOrder();
        let currentDate = new Date()
        currentDate.setMonth(currentDate.getMonth() + 1)
        purchaseOrder.dueDate = currentDate
        let accountId = await AccountsRepo.getDefaultAccountByName(client, "Inventory Assets", company.id)
        for (let index = 0; index < items.length; index++) {

           purchaseOrder = new PurchaseOrder();
          const element = items[index];
          if (element.supplierId == null || element.supplierId == "") {
            throw new Error("Supplier Is Required")
          }
          if (branchId != null) {
            purchaseOrder.branchId = branchId ?? "";
            purchaseOrder.employeeId = employeeId;
            purchaseOrder.dueDate =dueDate

              purchaseOrder.purchaseNumber = (await PurchaseOrderRepo.getPurchaseNumber(branchId, company)).data.purchaseNumber;
            purchaseOrder.supplierId = element.supplierId;
            let line = new PurchaseOrderLine()

            purchaseOrder.lines = []
            element.items.forEach((element: any) => {
              line = new PurchaseOrderLine()
              line.productId = element.productId;
              line.qty = element.qty;
              line.unitCost = element.unitCost;
              line.accountId = accountId;
              line.taxId = element.taxId;
              line.taxes = element.taxes;
              line.taxPercentage = element.taxPercentage;
              line.taxType = element.taxType
              purchaseOrder.lines.push(line);
            });



            let addPurchase = await PurchaseOrderRepo.addPurchaseOrder(client, purchaseOrder, company, employeeId, purchaseOrder.dueDate);
            ids.push(addPurchase.data.id)
          }
        }
      }

      query.text = `UPDATE "InventoryRequests" SET status=$1, "purchaseIds"=$2 where id =$3`
      query.values = [status, JSON.stringify(ids), inventoryRequestId]

      await client.query(query.text, query.values)
      await client.query("COMMIT")

      return new ResponseData(true, "", [])

    } catch (error: any) {
      console.log(error)
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally { client.release() }
  }

}