export class EmployeeOffDay {

    id="";
    from= new Date();
    to=new Date();
    type ="";
    employeeId="";
    branchId="";
    shift={};
    description="";
    updatedDate= new Date();
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}