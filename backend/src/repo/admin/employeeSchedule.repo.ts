import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { EmployeeOffDay } from "@src/models/admin/employeeOffDay";
import { EmployeeSchadule } from "@src/models/admin/employeeSchedule"
import { PoolClient } from "pg";
import _ from 'lodash';
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment-timezone";
import { BranchesRepo  } from "@src/repo/admin/branches.repo";
import { EmployeeAdditionalShift } from "@src/models/admin/employeeAdditionalShift";
import { EmployeeExceptionShift } from "@src/models/admin/employeeExceptionShifts";

import { ValidationException } from "@src/utilts/Exception";
import sharp from "sharp";
import { Company } from "@src/models/admin/company";
import { AppoitmentRepo } from "../ecommerce/appointment.repo";
import { NullAttributeValue } from "aws-sdk/clients/dynamodb";

export class EmployeeSchaduleRepo {


    public static async saveEmployeeSchedule(data: any, companyId: string) {
        try {

            const employeeSchedule = new EmployeeSchadule();
            employeeSchedule.ParseJson(data)
            const query : { text: string, values: any } = {
                text: `INSERT INTO "EmployeeSchedules" ("employeeId","regularSchedule","from","to","createdAt","branchId") values($1,$2,$3,$4,$5,$6) Returning id`,
                values: [employeeSchedule.employeeId,
               JSON.stringify( employeeSchedule.regularSchedule),
                employeeSchedule.from,
                employeeSchedule.to,
                employeeSchedule.createdAt,
                employeeSchedule.branchId
                ]
            }

            const result = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", { id: (<any>result.rows[0]).id })
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async validateEmployeeOffDay(id: string | null, branchId: string, employeeId: string, shift: any, from: any, to: any) {
        try {



            const query : { text: string, values: any } = {
                text: `with "offDays" as (
                    select generate_series("EmployeeOffDays".from::date , "EmployeeOffDays".to::date  ,'1 DAY') as "date",
                    "EmployeeOffDays".id
                    from "EmployeeOffDays"
                    where "branchId" =$1
                    and  "employeeId" = $2
                    )
                    select
                           "offDays"."date"
                    from "offDays"
                    where "offDays"."date" >= $3 and  "offDays"."date"<= $4
                  `,
                values: [branchId, employeeId, from, to]
            }

            if (id != null) {
                query.text = `with "offDays" as (
                    select generate_series("EmployeeOffDays".from::date , "EmployeeOffDays".to::date  ,'1 DAY') as "date",
                    "EmployeeOffDays".id
                    from "EmployeeOffDays"
                    where "branchId" =$1
                    and  "employeeId" = $2
                    )
                    select 
                           "offDays"."date"
                    from "offDays"
                    where "offDays"."date" >= $3 and  "offDays"."date"<= $4
                    and   "offDays".id <> $5`
                query.values = [branchId, employeeId, from, to, id]
            }
            const shifts = await DB.excu.query(query.text, query.values);
            if (shifts.rowCount != null && shifts.rowCount > 0) {
                return true
            }
            return false
        } catch (error: any) {
          

            throw new Error(error);
        }
    }

    /**
     * 
     * @param client 
     * 
     * @param branchId 
     * @param employeeIds 
     * @param from 
     * @param to 
     * @returns 
     */
    public static async getBranchEmployeesRegularSchedule(client: PoolClient, branchId: string,  from: any, to: any) {
        try {

            /**
             * (CASE WHEN (FLOOR((EXTRACT(DAY FROM '2023-08-27'::DATE) - 1) / 7) + 1)  <  4
            THEN  (FLOOR((EXTRACT(DAY FROM '2023-08-27'::DATE) - 1) / 7) + 1) 
            ELSE 1 END ):: INT
             */

            /**
             * employeeList : Select all employees of giving branch along the branch workingHours, 
             *  generate_series function  in query is used to generate dates for the employees withen the giving period (one week) to be later match with regular schedule period  
             * 
             * scheduleList : Will select regular schedule of the employees working in the giving branch if exist 
             * generate_series functions is used to generate series of dates using the regular schedule interval to help us select the recent created schedule with date within the giving interval (one week)
             *         
             * employeeSchedule : join of the two previous query will return employee schedule along with additional and exception shift corresponding to it 
             * 
             * last select query will return employee regular schedule with the recent created at i existed elese branch working hours along with additional and exception shift corresponding to
             */
            
            
            //SELECT date_trunc('week', '2023-08-13'::date) + INTERVAL '5 days' AS start_of_week;
            const query : { text: string, values: any } = {
                text: `with "employeeList" AS (
                            select
                                generate_series( $2::date ,    $3::date  ,'1 DAY') as "date",
                                "Employees".id as "employeeId",
                                "Employees".user,
                                "Employees"."passCode",
                                "Branches".id as "branchId",
                                "Media"."url"->>'defaultUrl'  as "avatar" ,
                                "Employees".name as "employeeName",
                                "Branches"."workingHours"
                            FROM "Employees" 
                            cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Employees"."branches") AS "branches"(branch)
                            left JOIN "Branches"  ON ("branches".branch->>'id')::uuid  = "Branches".id
                            left join "Media" on "Media".id = "Employees"."mediaId"
                            where "Branches".id =$1 ),
                    "employeeSchedules" AS(
                                        select 
                                                "employeeList"."date",
                                                "employeeList"."branchId",
                                                "employeeList"."avatar",
                                                "employeeList"."employeeName",
                                                "employeeList".user,
                                                "employeeList"."passCode",
                                                "employeeList"."workingHours",
                                                "EmployeeSchedules".id as "employeeScheduleId",
                                                "EmployeeSchedules"."regularSchedule"-> (case when extract (dow from "EmployeeSchedules"."from"::date ) = 6 then
                                                (case when EXTRACT(DAY FROM (("employeeList"."date"::date + interval '1 day') - ((("EmployeeSchedules"."from"::date + interval '1 day')  + interval '1 day' * (6 - extract (dow from("EmployeeSchedules"."from"::date + interval '1 day') ) ))) )) < 0 
                                                                                        then  0 else  CEIL(CEIL(EXTRACT(DAY FROM (("employeeList"."date"::date  + interval '1 day') - ((("EmployeeSchedules"."from"::date + interval '1 day')  + interval '1 day' * (6 - extract (dow from ("EmployeeSchedules"."from"::date + interval '1 day') ) ))) ))/7.0)%(jsonb_array_length("EmployeeSchedules"."regularSchedule"))) end)::int
                                           else
                                                (case when EXTRACT(DAY FROM (("employeeList"."date"::date) - (("EmployeeSchedules"."from"::date  + interval '1 day' * (6 - extract (dow from "EmployeeSchedules"."from"::date ) ))) )) < 0 
                                                                                           then  0 else  CEIL(CEIL(EXTRACT(DAY FROM (("employeeList"."date"::date) - (("EmployeeSchedules"."from"::date  + interval '1 day' * (6 - extract (dow from "EmployeeSchedules"."from"::date ) ))) ))/7.0)%(jsonb_array_length("EmployeeSchedules"."regularSchedule"))) end)::int 
                                            end)AS "regularSchedule",
                                                "EmployeeSchedules"."createdAt",
                                                "employeeList"."employeeId"
                                        from "employeeList"
                                        left JOIN "EmployeeSchedules" ON  "employeeList". "employeeId" = "EmployeeSchedules"."employeeId" and "employeeList"."branchId" ="EmployeeSchedules"."branchId"
                                        and (("employeeList"."date" >=  "EmployeeSchedules"."from" and "employeeList"."date" <=  "EmployeeSchedules"."to" ) or ("employeeList"."date" >=  "EmployeeSchedules"."from" and  "EmployeeSchedules"."to" is null ))
                                        group by "employeeList"."employeeId",
                                                "employeeList".user,
                                                "employeeList"."passCode",
                                                "EmployeeSchedules"."createdAt",
                                                "employeeList"."date" , 
                                                "EmployeeSchedules".id,
                                                "employeeList"."branchId",
                                                "employeeList"."avatar",
                                                "employeeList"."employeeName",
                                                "employeeList"."workingHours"
                                    ) 
                select     "employeeSchedules"."branchId",
                            "employeeSchedules"."employeeId",
                            "employeeSchedules".user,
                            "employeeSchedules"."passCode",
                            "employeeSchedules"."employeeScheduleId",
                            case when "employeeSchedules"."employeeScheduleId" is null 
                            then  "employeeSchedules"."workingHours"-> trim(to_char( "employeeSchedules"."date", 'Day')) 
                            else "employeeSchedules"."regularSchedule"-> trim(to_char( "employeeSchedules"."date", 'Day'))  end as "shift",
                            "employeeSchedules"."avatar",
                            CAST("employeeSchedules"."date" AS text) as "date",
                            "EmployeeAdditionalShifts"."additionalShifts",
                            "EmployeeExceptionShifts"."exceptions",
                            "employeeSchedules"."employeeName"
                         from "employeeSchedules"
                         LEFT JOIN "EmployeeAdditionalShifts" ON "EmployeeAdditionalShifts"."employeeId" = "employeeSchedules"."employeeId" 
                         AND "EmployeeAdditionalShifts"."branchId"  = "employeeSchedules"."branchId" 
                         AND "EmployeeAdditionalShifts"."date"  = "employeeSchedules"."date" 
                         AND (("EmployeeAdditionalShifts"."createdAt" >= "employeeSchedules"."createdAt" and  "employeeSchedules"."employeeScheduleId" is not null) or  ("employeeSchedules"."employeeScheduleId" is null))
                         LEFT JOIN "EmployeeExceptionShifts" ON "EmployeeExceptionShifts"."employeeId" = "employeeSchedules"."employeeId" 
                         AND "EmployeeExceptionShifts"."branchId"  = "employeeSchedules"."branchId" 
                         AND "EmployeeExceptionShifts"."date"  = "employeeSchedules"."date"
                         AND (("EmployeeExceptionShifts"."createdAt" >= "employeeSchedules"."createdAt" and  "employeeSchedules"."employeeScheduleId" is not null) or  ("employeeSchedules"."employeeScheduleId" is null))
                         where( ("employeeSchedules"."employeeId","employeeSchedules"."date","employeeSchedules"."createdAt") in (
                        select "employeeSchedules"."employeeId","employeeSchedules"."date",max("employeeSchedules"."createdAt")
                        from "employeeSchedules"
                         group by "employeeSchedules"."employeeId", "employeeSchedules".user, "employeeSchedules"."passCode", "employeeSchedules"."date"
                         )and  "employeeSchedules"."employeeScheduleId" is not null)  or ( "employeeSchedules"."employeeScheduleId" is null)
                         order by"employeeSchedules"."employeeName" ASC, "employeeSchedules"."date" ASC`,

                values: [branchId, from, to]
            }

            console.log(query.values)

            const regularSchedule = await client.query(query.text, query.values);


            return new ResponseData(true, '', regularSchedule.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getEmployeesDaysOff(client: PoolClient, branchId: string, from: any, to: any) {
        try {
            const query : { text: string, values: any } = {
                text: `   select
                          cast(  generate_series( "EmployeeOffDays".from::date,"EmployeeOffDays".to::date,'1 DAY') as text)as "date",
                            "Employees".id as "employeeId",
                            "EmployeeOffDays".type as "dayOff",
                            "EmployeeOffDays"."shift",
                            "EmployeeOffDays".id as "offDayId",
                            "EmployeeOffDays".description
                    FROM "Employees" 
                    cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Employees"."branches") AS "branches"(branch)
                    left JOIN "Branches"  ON ("branches".branch->>'id')::uuid  = "Branches".id
                    Left join "EmployeeOffDays" on   "EmployeeOffDays"."employeeId" = "Employees".id
                    where "EmployeeOffDays".from::date<=$2 and "EmployeeOffDays".to::date>=$3 
                    or("EmployeeOffDays".from::date<=$2 and "EmployeeOffDays".to::date<=$3)
                    or("EmployeeOffDays".from::date>=$2 and "EmployeeOffDays".to::date>=$3)
                    or("EmployeeOffDays".from::date>=$2 and "EmployeeOffDays".to::date<=$3)
                    and "Branches".id = $1
                    group by  "Employees".id ,"EmployeeOffDays".type, "EmployeeOffDays".id, "EmployeeOffDays".description`,
                values: [branchId, from, to]
            }
            let exceptionShifts = await client.query(query.text, query.values);
            return new ResponseData(true, "", exceptionShifts.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getEmployeeIds(client: PoolClient, branchId: string) {
        try {
            let ids: any[] = []
            const query : { text: string, values: any } = {
                text: `select "Employees".id
                from "Employees", jsonb_to_recordset("Employees"."branches") as "Branches"(id uuid)
                where "Branches".id = $1`,
                values: [branchId]
            }

            const employees = await client.query(query.text, query.values)
            employees.rows.forEach((element: any) => {
                ids.push(element.id)
            });
            return new ResponseData(true, "", ids)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getPOSEmployeeIds(client: PoolClient, branchId: string) {
        try {


            let ids: any[] = []
            const query : { text: string, values: any } = {
                text: `
                select "Employees".id
                                from "Employees", jsonb_to_recordset("Employees"."branches") as "Branches"(id uuid)
                                where "Branches".id = $1
                                and "user" = true 
                                and "passCode" is not  null
                `,
                values: [branchId]
            }

            const employees = await client.query(query.text, query.values)
            employees.rows.forEach((element: any) => {
                ids.push(element.id)
            });
            return new ResponseData(true, "", ids)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async getEmployeesSchedule(client: PoolClient, data: any, appoitmentEmp?:boolean ) {
        
        try {


           
            const branchId = data.branchId;
            let from = data.from;
            let to = data.to ?? data.from;

            from = await TimeHelper.resetHours(from)
            
            to = await TimeHelper.resetHours(to)
            // Get Employee Regular Schedule
        
          
            let  employeesRegularSchedule = (await this.getBranchEmployeesRegularSchedule(client, branchId, from, to)).data;
            //Get Employees Days Off
            const employeesDaysOff = (await this.getEmployeesDaysOff(client, branchId, from, to)).data;
            let employee: any;
            let shift: any;
            let employees: any[] = [];
            let offDay: any;
            if(appoitmentEmp){
                employeesRegularSchedule = employeesRegularSchedule.filter((e:any) => e.user == true && e.passCode )
            }
            employeesRegularSchedule.forEach((schedule: any) => {
                employee = {
                    employeeId: "",
                    avatar: "",
                    employeeName: "",
                    days: []
                }
                shift = {
                    date: '',
                    shift: [],
                    employeeScheduleId: "",
                    dayOff: "",
                    dayOffShift: []
                }


                const indexOfEmployee = employees.indexOf(employees.find((f: any) => f.employeeId == schedule.employeeId)) // To GroupBy Employee 
                //Setting Employee Information 
                employee.employeeId = schedule.employeeId;
                employee.avatar = schedule.avatar;
                employee.employeeName = schedule.employeeName;

                //Setting Shift Info
      

                // if (schedule.exceptions && schedule.exceptions.length > 0) {

                //     for (let index = 0; index < schedule.exceptions.length; index++) {
                //         const shift = schedule.exceptions[index];

                //         if (schedule.additionalShifts && schedule.additionalShifts.length > 0) {
                //             let indexAddException = schedule.additionalShifts.indexOf(schedule.additionalShifts.find((f: any) =>
                //                 Number(f.from.split(":")[0]) == Number(shift.from.split(":")[0]) &&
                //                 Number(f.from.split(":")[1]) == Number(shift.from.split(":")[1]) &&
                //                 Number(f.to.split(":")[0]) == Number(shift.to.split(":")[0]) &&
                //                 Number(f.to.split(":")[1]) == Number(shift.to.split(":")[1])))

                //             if (indexAddException > -1) {

                //                 schedule.additionalShifts.splice(indexAddException, 1)
                //                 schedule.exceptions.splice(index, 1)
                //             }
                //         }
                //     }


                // }

                schedule.shift = schedule.shift ? schedule.shift:[]
          
                if (schedule.additionalShifts && schedule.additionalShifts.length > 0) {
                    schedule.additionalShifts.forEach((shift: any) => {

                        schedule.shift.push(shift)
                    });
                }

                if (schedule.shift && schedule.exceptions && schedule.exceptions.length > 0) {
                    schedule.exceptions.forEach((exception: any) => {

                        let indexOfException = schedule.shift.indexOf(schedule.shift.find((f: any) =>
                            Number(f.from.split(":")[0]) == Number(exception.from.split(":")[0]) &&
                            Number(f.from.split(":")[1]) == Number(exception.from.split(":")[1]) &&
                            Number(f.to.split(":")[0]) == Number(exception.to.split(":")[0]) &&
                            Number(f.to.split(":")[1]) == Number(exception.to.split(":")[1])))

                        if (indexOfException > -1) {

                            schedule.shift.splice(indexOfException, 1)
                        }



                    });

                }

      

                //Check If shift date has dayOff 
                let dayOffs = employeesDaysOff.find((f: any) => f.employeeId == schedule.employeeId &&
                    schedule.date.split(" ")[0].split("-")[0] == f.date.split(" ")[0].split("-")[0] &&
                    schedule.date.split(" ")[0].split("-")[1] == f.date.split(" ")[0].split("-")[1] &&
                    schedule.date.split(" ")[0].split("-")[2] == f.date.split(" ")[0].split("-")[2])

                // If this shift date is a day OFF then set shift array ton null
               // select CEIL(('2023-9-3'::date - '2023-08-05'::date )/7.0)

               //select CEIL((CEIL((date - (Employeeschedule.from + interval '1 day' * (6 - extract (dow from '2023-08-03'::date ) )) )/7.0) )%arraylength )
                if (shift.dayOffShift&&dayOffs && dayOffs.dayOff != null && dayOffs.dayOff != "") {

                    let offDayData = {
                        type: "",
                        offDayId: ""
                    }
                    offDayData.type = dayOffs.dayOff;
                    offDayData.offDayId = dayOffs.offDayId

                    shift.dayOffShift.push(offDayData)

                }


                shift.shift = schedule.shift;
                shift.date = schedule.date;
                shift.employeeScheduleId = schedule.employeeScheduleId

                
          
                //Groub By EmployeeId
                if (indexOfEmployee > -1) {
                    employees[indexOfEmployee].days.push(shift)
                } else {
                    employee.days.push(shift)
                    employees.push(employee)
                }
            });

       
            
            return new ResponseData(true, "", employees)

        } catch (error: any) {
            
          
            throw new Error(error)
        } 

    }

    public static async getEmployeesScheduleForAppointment(client:PoolClient,data: any,  company: Company) {
    
        try {

   
            let employeesSchedule:any = [];

            if (!data.branchId){   // get employees schedule in a company

                const branches = (await BranchesRepo.getBranchList(client,company.id)).data  //get all branches of a company

                

                for (let index = 0; index < branches.length; index++) {              // go over branches and get employees schedual
                    
                    let employees = (await this.getEmployeesSchedule(client, {"from":data.date,"to":data.date,"branchId":branches[index].id }, true)).data
                    employees.forEach((e: any)=>e.branchId = branches[index].id  )
                    if(employees && employees.length > 0){employeesSchedule = employeesSchedule.concat(employees);}   

                }
                
            }
            else{               // get employees schedule in a branch
                employeesSchedule = (await this.getEmployeesSchedule(client, {"from":data.date,"to":data.date,"branchId":data.branchId }, true)).data;
                
            }
            
           //remove employees that are not working on the selected day 
           employeesSchedule = employeesSchedule.filter((employee:any) => ( employee.days[0].shift.length > 0 && employee.days[0].dayOffShift.length == 0 && employee.days[0].dayOff == "" ))
           //let emp = employeesSchedule.forEach( async(employee:any) =>  employee.busyShift = ( await this.getEmployeeBusySchedule(employee.employeeId,data.date )) )
           
           if (data.employeeId != null && data.employeeId!=""){
            employeesSchedule = employeesSchedule.filter((employee:any) => ( employee.employeeId == data.employeeId))
           }

            for (const e of employeesSchedule) {
                e.days = e.days[0]
                e.days.busyTimes = (await this.getEmployeeBusySchedule(client, e.employeeId, data.date,company.id)).data
               

                const newSchedual = []

                if (e.days.shift && e.days.busyTimes && e.days.busyTimes.length > 0) {
                    e.days.shift = (await this.getNewSchedule( e.days.shift, e.days.busyTimes, company)).data
                }

            }
       
       
            return new ResponseData(true, "", employeesSchedule )

        } catch (error: any) {
         
          
            throw new Error(error)
        } 

    }

    public static async getNewSchedule(scheduale: any, busyTimes: any, company: Company) {
        
       try{
            let s:any = [];
            busyTimes.sort((a:any,b:any) => moment(a.from,"HH,mm").diff(moment(b.from,"HH,mm")))
            
            for (const shift of scheduale ){
                
                let shiftStart = moment(shift.from,"HH:mm").tz("Asia/"+company.country);
                let shiftEnd   = moment(shift.to,"HH:mm").tz("Asia/"+company.country);

                let curentStartTime = shiftStart.clone();

                
                for (const b of busyTimes){

                    
                    let bStart = moment(b.from,"HH:mm").tz("Asia/"+company.country);
                    let bEnd = moment(b.to ,"HH:mm").tz("Asia/"+company.country);

                    if(bEnd >= shiftEnd){
                        break;
                    }

                    if(bStart > curentStartTime) {
                        s.push({
                            "from" : curentStartTime.format("HH:mm"),
                            "to" : bStart.format("HH:mm")
                        })
                       
                    }
                     curentStartTime = bEnd
                    
                    
                }

            if (curentStartTime < shiftEnd){
                s.push({
                    "from" : curentStartTime.format("HH:mm"),
                    "to" : shiftEnd.format("HH:mm")
                })
            }

            

        }

            return new ResponseData(true, "", s)
        } catch (error: any) {
            
          

            throw new Error(error)
        }
    }


    public static async getEmployeeBusySchedule(client:PoolClient, employeeId: string, date: Date,companyId:string) {
        
        try {

           
            const query : { text: string, values: any } = {
                text: `select ("serviceDate"::text),
                                "serviceDuration"  
                        from "Invoices" 
                        Inner join "InvoiceLines" on "Invoices".id = "InvoiceLines"."invoiceId"
                        where "InvoiceLines"."companyId" =$3 and
                            "estimateId" is null and 
                            Date("serviceDate") = $1 and 
                            "InvoiceLines"."salesEmployeeId" = $2 and 
                            "serviceDuration"  != 0 
                        
                        union 
                        
                        select ("serviceDate"::text),
                                "serviceDuration"  
                        from "EstimateLines" 
                        where
                            Date("serviceDate") = $1 and 
                            "salesEmployeeId"        = $2 and 
                            "serviceDuration"  != 0 
                    `,
                values: [date, employeeId,companyId]
            }
            const list = await client.query(query.text, query.values)
            
            let s:any = [];

            list.rows.forEach((element: any) => {
                const start    = new Date(element.serviceDate);
                const duration = element.serviceDuration;

                const end   = new Date(start.getTime() + duration*60000);

                let from = ('0'+start.getHours()).slice(-2) + ':'+ ('0'+start.getMinutes()).slice(-2)
                let to = ('0'+end.getHours()).slice(-2) + ':'+ ('0'+end.getMinutes()).slice(-2)

                

                const f = start.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit',hour12: false})
                const t   = end.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit',hour12: false})

                s.push({from,to})
            })

           

            return new ResponseData(true, "", s)
        } catch (error: any) {
            
          

            throw new Error(error)
        }
    }

    

    public static async getEmployeeRegularSchedule(data: any) {
        try {

            const from = data.from;
            const to = data.to;
            const branchId = data.branchId;


            const query : { text: string, values: any } = {
                text: `WITH "EmployeeSchedules" as (
                    select 
                    generate_series("EmployeeSchedules".from::date, case when "EmployeeSchedules".to::date <> null then "EmployeeSchedules".to::date else $3::date end,'1 DAY') as "date",
                    "EmployeeSchedules"."employeeId",
	                 "EmployeeSchedules".id as "emploeeScheduleId",
                    "EmployeeSchedules"."createdAt",
                    "EmployeeSchedules". "additionalShifts",
                    "EmployeeSchedules". "regularSchedule",
                    "EmployeeSchedules". "exceptions"
                    from "EmployeeSchedules"
                    where "EmployeeSchedules"."branchId" =$1
                    ), 
                    "schedulesIntervals" as (
                    select * from "EmployeeSchedules"
                    where ("EmployeeSchedules"."employeeId","EmployeeSchedules"."createdAt","EmployeeSchedules"."date") in (
                    select 
                        "EmployeeSchedules"."employeeId",
                        max("EmployeeSchedules"."createdAt"),
                        "EmployeeSchedules".date
                    from "EmployeeSchedules"
                        group by "EmployeeSchedules".date,	"EmployeeSchedules"."employeeId"
                    )
                    ),
                    "EmployeeBranchWorkingHours" as (
                        select
                        "Employees".id as "employeeId",
                        "Employees".name as "employeeName",
                        "branches".id as "branchId",
                        "Branches"."workingHours",
						
                        generate_series($2::date, $3::date,'1 DAY') as date
                        from "Employees",jsonb_to_recordset("Employees"."branches") as "branches"("id" uuid)	
                        inner join "Branches" on "branches".id =  "Branches".id
                        where "Branches".id =$1
                    ) 
                    
                    select 
                    "EmployeeBranchWorkingHours"."employeeId",
                    "EmployeeBranchWorkingHours"."branchId",
                    "EmployeeBranchWorkingHours"."date",
                    "EmployeeBranchWorkingHours"."employeeName",
					"schedulesIntervals"."emploeeScheduleId",
                    case 
                    when  "schedulesIntervals"."regularSchedule" is  null 
                    then "EmployeeBranchWorkingHours"."workingHours"->trim( to_char("EmployeeBranchWorkingHours"."date"::date, 'Day')) 
                    else "schedulesIntervals"."regularSchedule"->trim( to_char("EmployeeBranchWorkingHours"."date"::date, 'Day') ) end as "shifts",
                    "schedulesIntervals". "additionalShifts"->CAST ("EmployeeBranchWorkingHours"."date"::DATE AS TEXT) as "additionalShifts" ,
                    "schedulesIntervals". "exceptions"->CAST ("EmployeeBranchWorkingHours"."date"::DATE AS TEXT) as "exceptions" 
                    from 
                    "EmployeeBranchWorkingHours" 
                    left join "schedulesIntervals"  on "schedulesIntervals"."employeeId" ="EmployeeBranchWorkingHours"."employeeId"
                    and "schedulesIntervals"."date" ="EmployeeBranchWorkingHours"."date"
                    order by "EmployeeBranchWorkingHours"."date","EmployeeBranchWorkingHours"."employeeId" 
                    `,
                values: [branchId, from, to]
            }
            const employeeSchedule = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", employeeSchedule.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }



    public static async checkExceptions(client: PoolClient, date: any, additionalShifts: any[], employeeScheduleId: string, employeeId: string, branchId: string) {
        try {
            let query : { text: string, values: any } = {
                text: `SELECT "exceptions" FROM "EmployeeExceptionShifts" WHERE date=$1 and "employeeId"=$2 and "branchId" = $3
                       order by "createdAt" desc
                       limit 1 `,
                values: [date, employeeId, branchId]
            }

            let emploeeScheduleCreatedAt;
            if (employeeScheduleId != null && employeeScheduleId != "") {
                query.text = `SELECT "createdAt" from "EmployeeSchedules" where id =$1`
                query.values = [employeeScheduleId]

                emploeeScheduleCreatedAt = (await client.query(query.text, query.values)).rows[0].createdAt
                query.text = `SELECT "exceptions" FROM "EmployeeExceptionShifts" WHERE"date"=$1 and "createdAt" >= $2 `
                query.values = [date, emploeeScheduleCreatedAt]
            }
            const emploeeSchedules = await client.query(query.text, query.values);
            const exceptions: any[] = emploeeSchedules.rows[0] && emploeeSchedules.rows[0].exceptions != null ? emploeeSchedules.rows[0].exceptions : []



            for (let index = 0; index < exceptions.length; index++) {
                const shift = exceptions[index];

                if (additionalShifts && additionalShifts.length > 0) {
                    let indexAddException = additionalShifts.indexOf(additionalShifts.find((f: any) =>
                        Number(f.from.split(":")[0]) == Number(shift.from.split(":")[0]) &&
                        Number(f.from.split(":")[1]) == Number(shift.from.split(":")[1]) &&
                        Number(f.to.split(":")[0]) == Number(shift.to.split(":")[0]) &&
                        Number(f.to.split(":")[1]) == Number(shift.to.split(":")[1])))

                    if (indexAddException > -1) {

                        additionalShifts.splice(indexAddException, 1)
                        exceptions.splice(index, 1)
                    }
                }
            }

            if (emploeeSchedules.rows.length > 0) {
                query.text = `Update "EmployeeExceptionShifts" set  "exceptions"=$1 where date=$2 and "employeeId"=$3 and "branchId"=$4  `
                query.values = [JSON.stringify(exceptions), date, employeeId, branchId]
            } else if (emploeeSchedules.rows.length > 0 && employeeScheduleId != null && employeeScheduleId != "") {
                query.text = `Update "EmployeeExceptionShifts" set  "exceptions"=$1 where date=$2 and "createdAt">=$3 and "branchId"=$4  `
                query.values = [JSON.stringify(exceptions), date, emploeeScheduleCreatedAt, branchId]
            }

            await client.query(query.text, query.values)

            return additionalShifts

        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async setAdditionalShifts(data: any, companyId: string) {

        const client = await DB.excu.client();
        try {
            let additionalShift = data.additionalShifts;
            const date = data.date;
            const employeeId = data.employeeId;
            const employeeScheduleId = data.employeeScheduleId;
            const branchId = data.branchId;
            await client.query("BEGIN")

            additionalShift = await this.checkExceptions(client, date, additionalShift, employeeScheduleId, employeeId, branchId)


            if (additionalShift && additionalShift.length > 0) {
                let query : { text: string, values: any } = {
                    text: `SELECT id,"additionalShifts" FROM "EmployeeAdditionalShifts" WHERE date=$1 and "employeeId"=$2 and "branchId" = $3
                       order by "createdAt" desc
                       limit 1 `,
                    values: [date, employeeId, branchId]
                }

                let emploeeScheduleCreatedAt;

                if (employeeScheduleId != null && employeeScheduleId != "") {
                    query.text = `SELECT "createdAt" from "EmployeeSchedules" where id =$1`
                    query.values = [employeeScheduleId]

                    emploeeScheduleCreatedAt = await (await client.query(query.text, query.values)).rows[0].createdAt
                    query.text = `SELECT id,"additionalShifts" FROM "EmployeeAdditionalShifts" WHERE"date"=$1 and "createdAt" >= $2 `
                    query.values = [date, emploeeScheduleCreatedAt]
                }


                const emploeeSchedules = await client.query(query.text, query.values);
                const shifts: any[] = emploeeSchedules.rows[0] && emploeeSchedules.rows[0].additionalShifts != null ? emploeeSchedules.rows[0].additionalShifts : []
                additionalShift.forEach((element: any) => {
                    let indexOfShift = shifts.indexOf(shifts.find((f: any) =>
                        Number(f.from.split(":")[0]) == Number(element.from.split(":")[0]) &&
                        Number(f.from.split(":")[1]) == Number(element.from.split(":")[1]) &&
                        Number(f.to.split(":")[0]) == Number(element.to.split(":")[0]) &&
                        Number(f.to.split(":")[1]) == Number(element.to.split(":")[1])))

                    shifts.push(element)
                });

                const createdAt = new Date();

                const addShift = new EmployeeAdditionalShift();
                addShift.additionalShifts = shifts;
                addShift.id =emploeeSchedules.rows && emploeeSchedules.rows.length>0? emploeeSchedules.rows[0].id:"";
                addShift.createdAt = createdAt;
                addShift.employeeId = employeeId;
                addShift.branchId = branchId;
                addShift.date = date;
                addShift.updatedDate = new Date();
                if (emploeeSchedules.rows.length > 0 && employeeScheduleId != null && employeeScheduleId != "") {
                    query.text = `Update "EmployeeAdditionalShifts" set  "additionalShifts"=$1, "updatedDate"= $2 where id=$3   `
                    query.values = [JSON.stringify(addShift.additionalShifts),addShift.updatedDate, addShift.id]

                } else if (emploeeSchedules.rows.length > 0 && employeeScheduleId == null) {
                    query.text = `Update "EmployeeAdditionalShifts" set  "additionalShifts"=$1,"updatedDate"= $2 where id=$3  `
                    query.values = [JSON.stringify(addShift.additionalShifts),addShift.updatedDate, addShift.id]
                } else {
                    query.text = `Insert into "EmployeeAdditionalShifts" (  "additionalShifts",date, "employeeId","branchId","createdAt","updatedDate") values ($1,$2,$3,$4,$5,$6)  `
                    query.values = [JSON.stringify(addShift.additionalShifts), addShift.date, addShift.employeeId, addShift.branchId, addShift.createdAt,addShift.updatedDate]
                }

                await client.query(query.text, query.values);

            }
            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK");
          

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async setExceptionShifts(data: any, companyId: string) {

        const client = await DB.excu.client();
        try {
            const exceptions = data.exceptions;
            const date = data.date;
            const employeeId = data.employeeId;
            const employeeScheduleId = data.employeeScheduleId;
            const branchId = data.branchId;

            await client.query("BEGIN")

            let query : { text: string, values: any } = {
                text: `SELECT id,"exceptions" FROM "EmployeeExceptionShifts" WHERE date=$1 and "employeeId"=$2 and "branchId" = $3
                       order by "createdAt" desc
                       limit 1 `,
                values: [date, employeeId, branchId]
            }
            let emploeeScheduleCreatedAt;

            if (employeeScheduleId != null && employeeScheduleId != "") {
                query.text = `SELECT "createdAt" from "EmployeeSchedules" where id =$1`
                query.values = [employeeScheduleId]

                emploeeScheduleCreatedAt = await (await client.query(query.text, query.values)).rows[0].createdAt
                query.text = `SELECT id,"exceptions" FROM "EmployeeExceptionShifts" WHERE"date"=$1 and "createdAt" >= $2 `
                query.values = [date, emploeeScheduleCreatedAt]
            }

            const emploeeSchedules = await client.query(query.text, query.values);
            const shifts: any[] = emploeeSchedules.rows[0] && emploeeSchedules.rows[0].exceptions != null ? emploeeSchedules.rows[0].exceptions : []
           if(exceptions && exceptions.length){
            exceptions.forEach((element: any) => {
                shifts.push(element)
            });
           }
      

            const createdAt = new Date();
            const exception = new EmployeeExceptionShift();
            exception.exceptions = shifts;
            exception.id = emploeeSchedules.rows && emploeeSchedules.rows.length>0? emploeeSchedules.rows[0].id:"";
            exception.createdAt = createdAt.toDateString();
            exception.employeeId = employeeId;
            exception.branchId = branchId;
            exception.date = date;
            exception.updatedDate = new Date();
    
            if (emploeeSchedules.rows.length > 0) {
                query.text = `Update "EmployeeExceptionShifts" set  "exceptions"=$1, "updatedDate"= $2 where id=$3  `
                query.values = [JSON.stringify(exception.exceptions),exception.updatedDate, exception.id]
            } else if (emploeeSchedules.rows.length > 0 && employeeScheduleId != null && employeeScheduleId != "") {
                query.text = `Update "EmployeeExceptionShifts" set  "exceptions"=$1, "updatedDate"= $2 where  id=$3`
                query.values = [JSON.stringify(exception.exceptions),exception.updatedDate, exception.id]
            } else {
                query.text = `Insert into "EmployeeExceptionShifts" (  "exceptions",date, "employeeId","branchId","createdAt","updatedDate") values ($1,$2,$3,$4,$5,$6)  `
                query.values = [JSON.stringify(exception.exceptions), exception.date, exception.employeeId , exception.branchId, exception.createdAt,exception.updatedDate]
            }
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



    public static async saveEmployeeOffDays(data: any, compnayId: string) {



        const offDay = new EmployeeOffDay();
        offDay.ParseJson(data)

        const isDayOffConflict = await this.validateEmployeeOffDay(null, offDay.branchId, offDay.employeeId, offDay.shift, offDay.from, offDay.to)
        if (isDayOffConflict) {
            throw new ValidationException("An Off Day with the Given Period Already Exists");
        }

        offDay.updatedDate = new Date();
        try {
            const query : { text: string, values: any } = {
                text: `INSERT INTO "EmployeeOffDays"("branchId","employeeId",type,"from","to",description,"updatedDate")VALUES($1,$2,$3,$4,$5,$6,$7)`,
                values: [offDay.branchId, offDay.employeeId, offDay.type, offDay.from, offDay.to, offDay.description,offDay.updatedDate]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", []);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async editOffDay(data: any, companyId: string) {
        try {
            const offDay = new EmployeeOffDay();
            offDay.ParseJson(data);
            const isDayOffConflict = await this.validateEmployeeOffDay(offDay.id, offDay.branchId, offDay.employeeId, offDay.shift, offDay.from, offDay.to)
            if (isDayOffConflict) {
                throw new ValidationException("An Off Day with the Given Period Already Exists");
            }
            offDay.updatedDate = new Date();
            const query  = {
                text: `UPDATE "EmployeeOffDays" set "from"=$1,"to"=$2,type=$3,description=$4 ,"updatedDate"=$5 where id =$6 `,
                vlaues: [offDay.from, offDay.to, offDay.type, offDay.description,offDay.updatedDate, offDay.id]
            }
            await DB.excu.query(query.text, query.vlaues);
            return new ResponseData(true, "", [])
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async deleteEmployeeOffDays(offDayId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `Delete FROM "EmployeeOffDays" where id = ($1)  `,
                values: [offDayId]
            }

            const data = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", data.rows[0]);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getEmployeeOffDays(offDayId: string) {

        try {
            const query : { text: string, values: any } = {
                text: `SELECT id, 
                              "branchId",
                              "employeeId",
                              type,
                              cast ("from" as text),
                              cast ("to" as text),
                              description
                             FROM "EmployeeOffDays" where id = $1  `,
                values: [offDayId]
            }

            const data = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", data.rows[0]);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }





}