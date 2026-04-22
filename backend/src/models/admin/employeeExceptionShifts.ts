export class EmployeeExceptionShift{

    id="";
    employeeId="";
    exceptions:any=[]
    createdAt="";
    date="";
    updatedDate= new Date();
    branchId="";
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}