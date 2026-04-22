import { ResponseData } from '@src/models/ResponseData';
import { AttendanceRepo } from '@src/repo/app/settings/attendance.repo';
import { ValidationException } from '@src/utilts/Exception';
import { Request, Response, NextFunction } from 'express';
export class AttendanceController{
    public static async saveAttendance(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const employeeId =res.locals.user;
            if(data.id == "" || data.id== null)
            {
                throw new ValidationException("Id Is Required")
            }
            const resault = await AttendanceRepo.editAttendance(data,company,employeeId);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async getAttendanceById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id;
            const company =res.locals.company;
      
            const resault = await AttendanceRepo.getAttendance(id,company);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async getAttendanceList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const branches =res.locals.branches;
      
            const resault = await AttendanceRepo.getAttendanceList(data,company,branches);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getAttendanceReport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const branches =res.locals.branches;
      
            const resault = await AttendanceRepo.attendanceReport(data,company,branches);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    
    public static async adjustClockedInAndOut(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const employeeId =res.locals.user;
      
            const resault = await AttendanceRepo.adjustClocked(data,company,employeeId);

            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }
} 