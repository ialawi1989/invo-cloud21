import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { ExpenseRepo } from "@src/repo/app/accounts/expense.repo";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { ViewQueue } from "@src/utilts/viewQueue";
import { Request, Response, NextFunction } from 'express';
export class ExpenseController{
    public static async saveExpense(req: Request, res: Response, next: NextFunction){
         const client = await DB.excu.client();
        try {
            const company =res.locals.company;
            const employeeId =res.locals.user;
            const data = req.body;
            let resault;
             await client.query("BEGIN")
             await CompanyRepo.validateTransactionDate(client,data.expenseDate,data.branchId,company.id)


            if(data.id !=null && data.id!="")
            {
            
                 resault = await ExpenseRepo.editExpense(client, data,company,employeeId)
            }else{
                data.employeeId = employeeId
                resault = await ExpenseRepo.addExpense(client, data,company)
            }
            const queue = ViewQueue.getQueue();
            queue.pushJob()

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "Expenses", id: resault.data.id, companyId: company.id })

            await client.query("COMMIT")
            return res.send(resault)
        } catch (error:any) {
            await client.query("ROLLBACK")
                 throw error
        }finally{
            client.release()
        }
    }

    public static async getExpenseList(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            let resault;
            const branches = res.locals.branches
                 resault = await ExpenseRepo.getExpensesList(data,company,branches)
      

            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }



        public static async  getExpensePdf(req: Request, res: Response, next: NextFunction) {
            try {
    
                const company = res.locals.company;
    
                const pdfBuffer = await PDFGenerator.expensePdfGenerator(req.params.id)
                // res.send(pdfBuffer);
                // Send the PDF buffer as the response
                // return res.send(new ResponseData(true, "", pdfBuffer));
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename=invoice_${req.params.id}.pdf`);
                res.send(pdfBuffer); // Not res.json
                // res.send (pdfBuffer)
    
    
            } catch (error: any) {
                console.log(error);
                  throw error
            }
        }
    

    public static async getExpenseById(req: Request, res: Response, next: NextFunction){
        try {
            const expenseId = req.params.expenseId;
            const company =res.locals.company;
            const resault = await ExpenseRepo.getExpenseById(expenseId,company.id)
      

            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getExpenseNumber(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const branchId = req.params.branchId;
            const resault = await ExpenseRepo.getExpenseNumber(branchId,company)
      

            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getExpenseAccounts(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const branchId = req.params.branchId;
            const resault = await ExpenseRepo.getExpenseAccounts(branchId,company)
      

            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }
    public static async getPaidThroughAccounts(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const branchId = req.params.branchId;
            const resault = await ExpenseRepo.getPaidThroughAccounts(branchId,company)
      

            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }


    public static async deleteExpense(req: Request, res: Response, next: NextFunction){
        try {
   
            const expenseId = req.params.expenseId;
            const company =res.locals.company;
            const employeeId =res.locals.user;
            const resault = await ExpenseRepo.deleteExpense(expenseId,company,employeeId)
      
            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({type:"DeleteJournal",referenceId:expenseId})
            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async sendExpenseEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const pdfBuffer = await ExpenseRepo.sendEmail(data,company)
         
            // Send the PDF buffer as the response
            return  res.send(pdfBuffer);

            // res.send (pdfBuffer)
        } catch (error: any) {
            console.log(error);
              throw error
        }
    }
    public static async viewExpensePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                expenseId :req.params.expenseId
            }
            const company =res.locals.company;

            const pdfBuffer = await ExpenseRepo.getPdf(data,company)

            // Send the PDF buffer as the response
            return  res.send(new ResponseData(true,"",pdfBuffer));

            // res.send (pdfBuffer)

            
        } catch (error: any) {
            console.log(error);
              throw error
        }
    }
}