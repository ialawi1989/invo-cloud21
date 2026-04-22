export class EmployeeAdditionalShift{

    id="";
    employeeId="";
    additionalShifts:any=[]
    createdAt=new Date();
    date="";
    updatedDate= new Date();
    branchId="";
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}