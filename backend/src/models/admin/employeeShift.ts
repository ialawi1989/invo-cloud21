export class EmployeeShift {
    id =""; 
    employeeId =""; 
    startShift = new Date()
    endShift :Date |null = null;
    breaks :{from:Date, to :Date } [] =[];
    location=[]
   
    constructor(){
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}