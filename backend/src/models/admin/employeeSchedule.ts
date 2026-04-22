import { EmployeeOffDay } from "./employeeOffDay";

export class EmployeeSchadule{
    id="";
    from= new Date();
    to:string|null;
    employeeId="";
    branchId="";
    regularSchedule={};
    additionalShifts=[];
    exceptions=[];
    createdAt= new Date();
    offDays:EmployeeOffDay[]=[];
    updatedDate= new Date();

    constructor(){
        this.to=null
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}