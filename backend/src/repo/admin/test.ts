
import { DB } from "../../dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";




import { BranchValdation } from "@src/validationSchema/admin/branch.Schema";
import { PoolClient } from "pg";
import { ServiceRepo } from "./services.repo";
import { Service } from "@src/models/Settings/service";



import { Company } from "@src/models/admin/company";
import { FileStorage } from "@src/utilts/fileStorage";
import { CompanyRepo } from "./company.repo";
import { ProductRepo } from "../app/product/product.repo";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { BranchProductsRepo } from "../app/product/branchProduct.repo";
import { CartRepo } from "../ecommerce/cart.repo";
import { TablesRepo } from "../app/settings/tables.repo";
import { scheduledReportRepo } from "@src/repo/app/accounts/scheduledReport.repo";
import { SocketWastage } from "../socket/wastage.socket";
import { RedisClient } from "@src/redisClient";
import { pattern } from "pdfkit";
import { TriggerQueue } from "../triggers/triggerQueue";
import moment from "moment";
import { SocketInvoiceRepo } from "../socket/invoice.socket";
import { SocketAppliedCredit } from "../socket/appliedCredit.socket";
import { S3Storage } from "@src/utilts/S3Storage";
import { InvoiceStatusUpdate } from "@src/controller/admin/InvoiceStatusUpdatedQueue";


export class test {

  public static async getBrancheStatus(branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `select 
                        name,
                        "workingHours"->> trim(TO_CHAR(CURRENT_DATE, 'Day')) as "workingHours"
                    from "Branches"
                    where "Branches"."id"= $1`,
        values: [branchId]
      }

      let currentDate = new Date();
      const currentUtcDateTime = new Date().toUTCString();

      let currentHour = currentDate.getHours()
      let currentMinutes = currentDate.getMinutes()
      let branches: any = await DB.excu.query(query.text, query.values);
      let brancList: any[] = [];

      branches.rows.forEach((element: any) => {
        //   if (element.workingHours != null && element.workingHours.length > 0) {
        //     let workingHours: any[] = JSON.parse(element.workingHours);
        //     element.workingHours = JSON.parse(element.workingHours)
        //     element.status = "close";
        //     let openingHour = workingHours.filter((f: any) =>
        //     (
        //       (currentHour > Number(f.from.split(":")[0]) || (currentHour === Number(f.from.split(":")[0]) && currentMinutes >= Number(f.from.split(":")[1]))) &&
        //       (currentHour < Number(f.to.split(":")[0]) || (currentHour === Number(f.to.split(":")[0]) && currentMinutes <= Number(f.to.split(":")[1])))
        //     ))

        //     if (openingHour && openingHour.length > 0) {
        //       element.status = "open"
        //     }
        //   }



        brancList.push(element)
      });


      return new ResponseData(true, "", brancList)
    } catch (error: any) {


      throw new Error(error)
    }
  }



  public static async testTheFunction(data: any) {
    try {

      // await S3Storage.reUploadComapnyThumpnail(data.companyId)

      // let data = {
      //   "id": "22cc7818-f14c-40b5-84ff-e82823df0880",
      //   "companyId": "ffc54ebf-459a-4724-bc45-fc6380e36740",
      //   "employeeId": "227e6536-fe21-4e63-9dd5-f1c5aa5bde16",
      //   "reportType": "sales-by-department",
      //   "attachmentType": "pdf",
      //   "startDate": "2025-07-22",
      //   "scheduleTime": "09:00:00",
      //   "frequency": "daily",
      //   "recipients": [],
      //   "additionalRecipients": [
      //     "alsaro@invopos.com",
      //     "zahra@invopos.com"
      //   ],
      //   "nextRun": "2026-03-13T06:00:00.000Z",
      //   "previousRun": "2026-03-12T06:00:00.000Z",
      //   "isActive": true,
      //   "filter": {}
      // }

      //  await scheduledReportRepo.sendScheduledReport(data);
      // let res = await SocketInvoiceRepo.getInvoiceById(data.data,data.branchId,null)
      // return res
      // let date = data.date;
      // let timeOffset = data.timeOffset;
      // let newDate = moment(date).utcOffset(timeOffset * 60).toDate();
      // let date = data.date;
      // let timeOffset = data.timeOffset;
      // let newDate = moment(date).utcOffset(timeOffset * 60).toDate();

      // await DB.excu.query(`insert into "testTime"("date")values($1)`,[newDate])
      //     lettempData = data.data;
      //     let branchId = data.branchId
      //     let callableFunction: any;
      //         let queueInstance = TriggerQueue.getInstance();
      //                             queueInstance.createJob({
      //   "journalType": "Movment",
      //   "type": "invoice",
      //   "id": [
      //     "4c7cc1c6-0aff-4b87-8f44-e389d7b26783",
      //     "72d842db-a535-4636-aa82-0854fa7af92f",
      //     "a2a36186-258c-4038-993f-0af5d2f76e92",
      //     "cb34432d-ed88-40a8-9747-a31f4dcfb24f",
      //     "da90f143-96f0-4536-bc18-653d485fbb2d"
      //   ]
      // })

      //            queueInstance.createJob({
      //   "journalType": "Movment",
      //   "type": "invoice",
      //   "id": [
      //     "4c7cc1c6-0aff-4b87-8f44-e389d7b26783",
      //     "72d842db-a535-4636-aa82-0854fa7af92f",
      //     "a2a36186-258c-4038-993f-0af5d2f76e92",
      //     "cb34432d-ed88-40a8-9747-a31f4dcfb24f",
      //     "da90f143-96f0-4536-bc18-653d485fbb2d"
      //   ]
      // })

      // let response = await SocketWastage.getWastageList(null, JSON.stringify(tempData), branchId, null)
      return null
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async updateThumbnail(data: any) {
    try {

      if (data.companyId) {
        await S3Storage.reUploadComapnyThumpnail(data.companyId)
      }

      return new ResponseData(true, "", [])
      // let res = await SocketInvoiceRepo.getInvoiceById(data.data,data.branchId,null)
      // return res
      // let date = data.date;
      // let timeOffset = data.timeOffset;
      // let newDate = moment(date).utcOffset(timeOffset * 60).toDate();
      // let date = data.date;
      // let timeOffset = data.timeOffset;
      // let newDate = moment(date).utcOffset(timeOffset * 60).toDate();

      // await DB.excu.query(`insert into "testTime"("date")values($1)`,[newDate])
      //     lettempData = data.data;
      //     let branchId = data.branchId
      //     let callableFunction: any;
      //         let queueInstance = TriggerQueue.getInstance();
      //                             queueInstance.createJob({
      //   "journalType": "Movment",
      //   "type": "invoice",
      //   "id": [
      //     "4c7cc1c6-0aff-4b87-8f44-e389d7b26783",
      //     "72d842db-a535-4636-aa82-0854fa7af92f",
      //     "a2a36186-258c-4038-993f-0af5d2f76e92",
      //     "cb34432d-ed88-40a8-9747-a31f4dcfb24f",
      //     "da90f143-96f0-4536-bc18-653d485fbb2d"
      //   ]
      // })

      //            queueInstance.createJob({
      //   "journalType": "Movment",
      //   "type": "invoice",
      //   "id": [
      //     "4c7cc1c6-0aff-4b87-8f44-e389d7b26783",
      //     "72d842db-a535-4636-aa82-0854fa7af92f",
      //     "a2a36186-258c-4038-993f-0af5d2f76e92",
      //     "cb34432d-ed88-40a8-9747-a31f4dcfb24f",
      //     "da90f143-96f0-4536-bc18-653d485fbb2d"
      //   ]
      // })

      // let response = await SocketWastage.getWastageList(null, JSON.stringify(tempData), branchId, null)
      return null
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async deleteKeysForCompany(data: any) {
    try {
      let companyId = data.companyId;
      let key = data.key
      let pattrenString = data.pattern

      let string;
      if (pattrenString) {
        string = pattrenString
      } else {
        string = key + companyId + '*'
      }
      let instance = RedisClient.getRedisClient();
      await instance.deletPatternKey(string)
      // let response = await SocketWastage.getWastageList(null, JSON.stringify(tempData), branchId, null)
      return null
    } catch (error: any) {
      throw new Error(error)
    }
  }
}

