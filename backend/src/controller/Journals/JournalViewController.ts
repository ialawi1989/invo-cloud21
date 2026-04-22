
import { ResponseData } from '@src/models/ResponseData';
import { SocketErrorLogs } from '@src/repo/socket/socketErrorLogs';
import { InsertJournalsRepo } from '@src/repo/triggers/insertJournals';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { UnitCostQueue } from '@src/repo/triggers/UnitCostQueue';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
export class JournalViewController{

    public static async InsertJournalRecords(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.insertJournals(companyId,reference)
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }
    public static async InsertMovment(req: Request, res: Response, next: NextFunction) {
     
        try {
     



            const data = req.body;
            const companyId = data.companyId;
            const reference = data.reference;
            const  resault = await InsertJournalsRepo.insertMovment(companyId,reference)
         

         return res.send(resault)
     } catch (error: any) {
         
           throw error
     }
    }


    public static async InsertMissingJournals(req: Request, res: Response, next: NextFunction) {
     
        try {
     
            // let set1 = new Set([1, 2, 3]);
            // let set2 = new Set([3, 4, 5]);
            // let set3 = new Set([5, 6, 7]);
            
            // let combined = new Set([...set1, ...set2, ...set3]);
            // console.log(combined);



            const data = req.body;
            const companyId = data.companyId;
            const reference = data.references;



            // const  resault = await InsertJournalsRepo.InsertMissingJournals(companyId,reference)
         

         return res.send()
     } catch (error: any) {
         
           throw error
     }
    }

    public static async deleteJournals(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.deleteJournals(companyId,reference)
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }


    public static async deleteMovments(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.deleteMovments(companyId,reference)
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }
    public static async deleteKeys(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.deleteKeys()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }

    public static async getKeys(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.getKeys()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }



    public static async retryFaildJobs(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.retryFaildJobs()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }


    public static async getFailedJob(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.getFailedJob()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }


    public static async getGrubFailedJob(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await InsertJournalsRepo.getGrubFailedJob()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }

    public static async addFaildPayments(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await SocketErrorLogs.addFaildPayments(data)
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }


    public static async addFaildCreditNotes(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await SocketErrorLogs.addFaildCreditNotes()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }

    public static async addFaildCreditNoteRefunds(req: Request, res: Response, next: NextFunction) {

        try {
     



               const data = req.body;
               const companyId = data.companyId;
               const reference = data.reference;
               const  resault = await SocketErrorLogs.addFaildCreditNoteRefund()
            

            return res.send(resault)
        } catch (error: any) {
            
              throw error
        }
    }

    public static async tesssssstttttttt(req: Request, res: Response, next: NextFunction) {

        try {
     

//  const unitCostQueue =  UnitCostQueue.getInstance()

//  unitCostQueue.createJob( {
//     "type": "deleteCostReallocation",
//     "data": {
//       "costId": "e0f534fe-3f10-4bff-8d27-f4ca9aba249f",
//       "productId": "bc204b5f-f5c9-0e79-6551-2e454da1bed7",
//       "isDeleted": true,
//       "changeFlag": false
//     }
//   })

const qu = TriggerQueue.getInstance()
qu.createJob( {
    "type": "InvoicePayments",
    "invoiceIds": [
      "817886f7-a092-4b38-86c5-03359ed0ba8b"
    ],
    "id": [
      "15c97e2e-20bb-4426-b3c7-c4413a334c4c"
    ],
    "companyId": "39c4a7a3-a79f-4963-9460-f906a8c5d424"
  })
//                const data = req.body;
//                const companyId = data.companyId;
//                const reference = data.reference;
//                const  resault = await SocketErrorLogs.tesssssstttttttt()
            
//    // Set the response headers for file download
//    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//    res.setHeader('Content-Disposition', 'attachment; filename="example.xlsx"');

//    // Write workbook to the response stream
//    await resault.xlsx.write(res);
//    res.end();
        return new ResponseData(true, "", [])
        } catch (error: any) {
            
              throw error
        }
    }
}