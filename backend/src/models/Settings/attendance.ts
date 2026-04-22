export class Attendance {
    id ="";
    employeeId="";
    clockedIn=new Date()
    clockedOut:Date|null;
    adjClockedIn:Date|null;
    adjClockedOut:Date|null;
    adjClockedInBy:string|null;
    adjClockedOutBy:string|null;
    clockedInMediaUrl:string|null;
    clockedOutMediaUrl:string|null;
    clockedInImage:string|null;
    clockedOutImage:string|null;
    branchId = '';

    branchName="";
    employeeName="";
    adjClockedOutByEmployee="";
    adjClockedInByEmployee="";
    updatedAt = new Date();
    clockOutReason:string|null=null
    constructor(){
        this.clockedOut = null;
        this.adjClockedIn = null;
        this.adjClockedOut = null;
        this.adjClockedInBy = null;
        this.adjClockedOutBy = null;
        this.clockedInMediaUrl = null;
        this.clockedOutMediaUrl = null;
        this.clockedInImage = null;
        this.clockedOutImage = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}