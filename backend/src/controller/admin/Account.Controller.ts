
import { ManageAccountRepo } from '@src/repo/admin/account.Repo';
import { Request, Response, NextFunction } from 'express';
import { ResponseData } from "@src/models/ResponseData";
import { SoketInvoicePayment } from '@src/repo/socket/invoicePayment.socket';
import { JournalTriggers } from '@src/repo/triggers/journalTriggers';
import { AttendanceSocket } from '@src/repo/socket/attendence.socket';
import { DB } from '@src/dbconnection/dbconnection';

export class AccountController{
    public static async addMissingJournals(req: Request, res: Response, next: NextFunction) {
     try {
        let companyId = req.body.companyId;

        let response = await ManageAccountRepo.addMissingJournals(companyId)

        return res.send(response)
     } catch (error:any) {
          throw error;
     }
    }

    public static async inBalanceJournals(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
 
         let response = await ManageAccountRepo.inBalanceJournals(companyId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     public static async inBalanceSales(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
 
         let response = await ManageAccountRepo.inBalanceSales(companyId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     
     public static async inBalanceInventoryAssets(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
 
         let response = await ManageAccountRepo.inBalanceInventoryAssets(companyId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     public static async inBalanceInventoryAssets2(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
 
         let response = await ManageAccountRepo.inBalanceInventoryAssets2(companyId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     
     public static async getPosInvoicePayment(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
         let data = req.body ;
         let branchId= data.branchId;
         let invoiceIds = data.invoiceIds;
         let response = await SoketInvoicePayment.getInvoicePayment(branchId,invoiceIds)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     public static async companyUnitCostAllocate(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
         let data = req.body ;
         let branchId= data.branchId;
         let invoiceIds = data.invoiceIds;
         let response = await ManageAccountRepo.adjustUnitCost(data,companyId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     public static async companyUnitCostAllocateByProduct(req: Request, res: Response, next: NextFunction) {
      try {
         let productId = req.body.productId;
         let branchId = req.body.branchId ;
  
         let response = await ManageAccountRepo.adjustUnitCostbuyProduct(productId,branchId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     
     public static async roundingAdjusments(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
      
  
         let response = await ManageAccountRepo.positiveRounding(companyId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

     public static async supplierCredits(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
      
  
         let response = await JournalTriggers.editSupplierCreditJournal()
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

 public static async invoiceChargeTax(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
         let invoiceId = req.body.invoiceId;
      
  
         let response = await JournalTriggers.invoiceChargeTax(companyId,invoiceId)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }
  
 public static async retryJournal(req: Request, res: Response, next: NextFunction) {
      try {
         let data = req.body
   
      
  
         let response = await ManageAccountRepo.retryJournal(data)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

      public static async fixInvoiceChargeTotal(req: Request, res: Response, next: NextFunction) {
      try {
         let companyId = req.body.companyId;
         let ids = req.body.ids;
      
  
         let response = await JournalTriggers.fixInvoiceChargeTotal(companyId,ids??null)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }

      public static async recalculateInvoices(req: Request, res: Response, next: NextFunction) {
      try {
         let data = req.body
   
      
  
         let response = await ManageAccountRepo.recalculateInvoices(data)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }


       public static async reallocateTheProducts(req: Request, res: Response, next: NextFunction) {
      try {
         let data = req.body
   
      
  
         let response = await ManageAccountRepo.reallocateAllProducts(data)
 
         return res.send(response)
      } catch (error:any) {
           throw error;
      }
     }
}