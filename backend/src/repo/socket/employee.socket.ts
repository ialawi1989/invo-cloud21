

import { RedisClient } from '@src/redisClient';
import { SocketController } from '@src/socket';
import { Helper } from '@src/utilts/helper';

import { Socket } from 'socket.io'
import { EmployeeRepo } from '../admin/employee.repo';


import { POSprivielges } from '@src/models/admin/POSEmployeePrivielge';
import { DB } from '@src/dbconnection/dbconnection';

import { PoolClient } from 'pg';
import { logPosErrorWithContext } from '@src/middlewear/socketLogger';

export class SocketEmployee {

    static redisClient: RedisClient;

    public static async getEmployees(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {



            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }



            const employees = await EmployeeRepo.getPosEmployees(branchId, date)

            callback(JSON.stringify(employees.data))

        } catch (error: any) {
       
         

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getEmployees")
        }
    }

    public static async sendUpdatedEmployee(client: PoolClient, employeeId: string) {
        try {


            let employee: any = await EmployeeRepo.getPosEmployeeById(client, employeeId)
            employee.defaultImage = employee.base64Image;
            employee.base64Image = "";




            //send updated product
            this.redisClient = RedisClient.getRedisClient()
            const instance = SocketController.getInstance();
            for (let index = 0; index < employee.branches.length; index++) {
                const element: any = employee.branches[index];
                const clientId: any = await this.redisClient.get("Socket" + element.id);

                const newData = await Helper.trim_nulls(employee);

                instance.io.of('/api').in(clientId).emit("updateEmployee", JSON.stringify(newData));
            }
        } catch (error: any) {
       

            return null;
        }
    }
    public static async sendNewEmployee(client: PoolClient, employeeId: string) {
        try {
            let employee: any = await EmployeeRepo.getPosEmployeeById(client, employeeId)
            employee.defaultImage = employee.base64Image;
            employee.base64Image = "";

            employee.defaultImage = employee.base64Image;
            employee.base64Image = "";



            //send updated product
            this.redisClient = RedisClient.getRedisClient()
            const instance = SocketController.getInstance();
            for (let index = 0; index < employee.branches.length; index++) {
                const element: any = employee.branches[index];
                const clientId: any = await this.redisClient.get("Socket" + element.id);
                const newData = await Helper.trim_nulls(employee);
                instance.io.of('/api').in(clientId).emit("newEmployee", JSON.stringify(newData));
            }

        } catch (error: any) {
       

            return null;
        }
    }
    public static async getEmployeePricess(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const employees = await EmployeeRepo.getEmployeePrices(branchId, date)
            callback(JSON.stringify(employees.data))

        } catch (error: any) {

       
         

            callback(JSON.stringify(error.message))

            logPosErrorWithContext(error, data, branchId, null, "getEmployeePricess")

        }
    }


    public static async getEmployeePrivielges(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const privileges = await POSprivielges.getEmployeePrivielges(branchId)

            callback(JSON.stringify(privileges.data))

        } catch (error: any) {

       
         

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getEmployeePrivielges")

        }
    }

    //TODO: WHEN do  LIVE SYNC and get ONLY UPDATED 
    public static async getEmployeesSchedule(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        const dbClient = await DB.excu.client();
        try {

            // let date;
            /**BEgin */
            await dbClient.query("BEGIN")

            const query: { text: string, values: any } = {
                text: `select id, 
                             "employeeId",
                             "regularSchedule",
                             CAST("from" AS TEXT) as "from",
                             CAST("to" AS TEXT) as "to", 
                             "createdAt"
                             from "EmployeeSchedules"
                             where "EmployeeSchedules"."branchId" =$1 `,
                values: [branchId],
            }


            let emploeeSchedules = await dbClient.query(query.text, query.values);

            // let today= new Date();
            // let from:any = new Date(today.setDate(today.getDate() - today.getDay() ));
            // from = await TimeHelper.resetHours(from);

            // let to:any = new Date(today.setDate(today.getDate() - today.getDay() + 6));

            // to =await TimeHelper.resetHours(to);

            // const employeeIds = (await EmployeeSchaduleRepo.getPOSEmployeeIds(dbClient,branchId)).data;

            // const employeeSchedules = (await EmployeeSchaduleRepo.getBranchEmployeesRegularSchedule(dbClient,branchId,employeeIds,from,to)).data
            // const offDays = (await EmployeeSchaduleRepo.getEmployeesDaysOff(dbClient,branchId,from,to)).data

            // let schedules:any[]=[];
            // employeeSchedules.forEach((schedule: any) => {

            //     let scheduledata = {
            //         date:"",
            //         employeeId:"",
            //         shifts:[],
            //         dayOff:""
            //     }

            //     schedule.shift = schedule.shift? schedule.shift:[]
            //     if (schedule.additionalShifts && schedule.additionalShifts.length > 0) {
            //         schedule.additionalShifts.forEach((shift: any) => {
            //             schedule.shift.push(shift)
            //         });
            //     }


            //     if (schedule.exceptions && schedule.exceptions.length > 0) {
            //         schedule.exceptions.forEach((shift: any) => {

            //             let indexOfException = schedule.shift.indexOf(schedule.shift.find((f: any) => 
            //             Number(f.from.split(":")[0]) ==    Number(shift.from.split(":")[0]) &&
            //             Number(f.from.split(":")[1])==    Number(shift.from.split(":")[1]) &&
            //             Number(f.to.split(":")[0]) ==    Number(shift.to.split(":")[0] )&&
            //             Number(f.to.split(":")[1]) ==    Number(shift.to.split(":")[1])))
            //             if (indexOfException > -1) {
            //                 schedule.shift.splice(indexOfException, 1)
            //             }
            //         });
            //     }

            //     let employeeDayOffs = offDays.find((f: any) => f.employeeId == schedule.employeeId &&
            //     schedule.date.split(" ")[0].split("-")[0] == f.date.split(" ")[0].split("-")[0] &&
            //     schedule.date.split(" ")[0].split("-")[1] == f.date.split(" ")[0].split("-")[1] &&
            //     schedule.date.split(" ")[0].split("-")[2] == f.date.split(" ")[0].split("-")[2])

            //     if (employeeDayOffs && employeeDayOffs.dayOff!=null && employeeDayOffs.dayOff!="") {

            //         schedule.dayOff = employeeDayOffs.dayOff
            //         schedule.shift= null 

            //     }

            //     scheduledata.date = schedule.date;
            //     scheduledata.employeeId =schedule.employeeId;
            //     scheduledata.shifts = schedule.shift?schedule.shift:[] ;
            //     scheduledata.dayOff = schedule.dayOff?schedule.dayOff:null

            //     if(scheduledata.shifts.length>0 &&( scheduledata.dayOff!=null || scheduledata.dayOff!=""))
            //     {
            //         schedules.push(scheduledata)
            //     }
            // })
            let res = emploeeSchedules.rows ?? []

            callback(JSON.stringify(res))
            /**Commit */
            await dbClient.query("COMMIT")
        } catch (error: any) {
            /**RollBack */
            await dbClient.query("ROLLBACK")
       
         ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getEmployeesSchedule")

        } finally {
            /**Release */
            dbClient.release()
        }
    }
    public static async getEmployeesAdditionalShifts(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {



            const query: { text: string, values: any } = {
                text: `select id, 
                             "date",
                             "createdAt",
                             "additionalShifts",
                             "employeeId"
                             from "EmployeeAdditionalShifts"
                             where "EmployeeAdditionalShifts"."branchId" =$1 `,
                values: [branchId],
            }


            let emploeeShifts = await DB.excu.query(query.text, query.values);

            let res = emploeeShifts.rows ?? []


            callback(JSON.stringify(res))

        } catch (error: any) {

       
         ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getEmployeesAdditionalShifts")
        }
    }
    public static async getEmployeesExceptionShifts(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {



            const query: { text: string, values: any } = {
                text: `select id, 
                             "date",
                             "createdAt",
                             "exceptions",
                             "employeeId"
                             from "EmployeeExceptionShifts"
                             where "EmployeeExceptionShifts"."branchId" =$1 `,
                values: [branchId],
            }


            let emploeeShifts = await DB.excu.query(query.text, query.values);

            let res = emploeeShifts.rows ?? []


            callback(JSON.stringify(res))

        } catch (error: any) {

       
         ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getEmployeesExceptionShifts")

        }
    }
    public static async getEmployeeOffDays(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        try {
            const query: { text: string, values: any } = {
                text: `select id, 
                             "type",
                             "from",
                             "to",
                             "description",
                             "employeeId"
                             from "EmployeeOffDays"
                             where "EmployeeOffDays"."branchId" =$1 `,
                values: [branchId],
            }


            let emploeeShifts = await DB.excu.query(query.text, query.values);


            let res = emploeeShifts.rows ?? []

            callback(JSON.stringify(res))

        } catch (error: any) {

       
         ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getEmployeeOffDays")
        }
    }
    public static async sendNewPrivilage(branchIds: [string], role: any) {
        try {
            const privilege = new POSprivielges();
            privilege.ParseJson(role.privileges)
            role.privileges = privilege
            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(role);
                instance.io.of('/api').in(clientId).emit("newPrivilage", JSON.stringify(newData));
            }


        } catch (error: any) {
         ;

            return null;
        }
    }
    public static async sendUpdatePrivilage(branchIds: [string], role: any) {
        try {

            //send updated product

            const privilege = new POSprivielges();
            privilege.ParseJson(role.privileges)
            role.privileges = privilege
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(role);
                instance.io.of('/api').in(clientId).emit("updatePrivilage", JSON.stringify(newData));
            }


        } catch (error: any) {
         ;

            return null;
        }
    }
}

