import { ResponseData } from '@src/models/ResponseData';
import { JournalRepo } from '@src/repo/app/accounts/Journal.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class JournalController{
    public static async addManualJournal(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body;
            let company = res.locals.company;
            let employeeId = res.locals.user;
            let resault; 
            if(data.id == "" || data.id == null)
            {
                data.employeeId = employeeId
                resault = await JournalRepo.addManualJournal(data,company)
            }else{
                resault = await JournalRepo.editManualJournal(data,company,employeeId)
            }
            const queue = ViewQueue.getQueue();
            queue.pushJob()

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "ManualJournal", id: resault.data.id, companyId: company.id })

            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }

    // public static async editManualJournal(req: Request, res: Response, next: NextFunction)
    // {
    //     try {
    //         const update = await JournalRepo.editManualJournal(req.body)
    //         return res.send(update)
    //     } catch (error:any) {
    //              throw error
    //     }
    // }


    public static async getManualJournalList(req: Request, res: Response, next: NextFunction)
    {
        try {
            const branchId = req.params['branchId'];
            const list = await JournalRepo.getManualJournalList(branchId)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getManualJournalById(req: Request, res: Response, next: NextFunction)
    {
        try {
            const journalId = req.params['journalId'];
            const companyId = res.locals.company.id
            const journal = await JournalRepo.getManualJournalById(journalId,companyId)
            return res.send(journal)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getBranchJournals(req: Request, res: Response, next: NextFunction){
        try {
            const branchId = req.params['branchId'];
            const journals = await JournalRepo.getBranchJournals(branchId);
            return res.send(journals)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async  getJournal (req: Request, res: Response, next: NextFunction){
        try {
            const id = req.params['id'];
            const company =res.locals.company;

            const journal = await JournalRepo.getJournal(id,company)
            return res.send(journal)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getJournals(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data =req.body;
            // const journals = await JournalRepo.getCompanyJournals(companyId);
            const branches = res.locals.branches
            const journals = await JournalRepo.getJournals(data,company,branches);
            return res.send(journals)
        } catch (error:any) {
            
                 throw error
        }
    
    }

    public static async saveJournalComments(req: Request, res: Response, next: NextFunction){ 
        try {
            const employeeId =res.locals.user;
            const journals = await JournalRepo.saveJournalComments(req.body,employeeId);
            return res.send(journals)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async deleteJournal(req: Request, res: Response, next: NextFunction){ 
        try {
            const journalId =req.params.journalId
            const company =res.locals.company;
            const employeeId =res.locals.user;
            const journals = await JournalRepo.deleteJournal(journalId,company,employeeId);
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({type:"DeleteJournal",referenceId:journalId})
            return res.send(journals)
            
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async saveOpenJournal(req: Request, res: Response, next: NextFunction){ 
        try {
            const journalId =req.params.journalId
            const company =res.locals.company;
            const journals = await JournalRepo.saveOpenJournal(journalId);
             let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "ManualJournal", id:journalId, companyId: company.id })

            return res.send(journals)
        } catch (error:any) {
            
                 throw error
        }
    }
}