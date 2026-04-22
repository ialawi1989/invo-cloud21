import { Log } from "../log";
import { PhysicalCountLine } from "./PhysicalCountLine";

export class PhysicalCount{
    id="";
    reference="";
    status="";
    note="";
    type="";
    branchId="";

    
    createdDate=new Date();
    calculatedDate:Date|null;
    closedDate:Date|null;
    createdEmployeeId="";
    calculatedEmployeeId:string|null;
    closedEmployeeId:string|null;

    lines:PhysicalCountLine[]=[];
    currentStatus ="";
    calculatedEmployeeName="";
    createdEmployeeName="";
    closedEmployeeName="";
   branchName="";
    logs:Log[]=[];
    constructor(){
        this.calculatedDate = null;
        this.closedDate = null;
        this.calculatedEmployeeId = null;
        this.closedEmployeeId = null;
    }
    ParseJson(json:any): void{
        for (const key in json) {
            if(key =='lines'){
                const linesTemp:PhysicalCountLine[]=[];
                let physicalCountLine:PhysicalCountLine;
                json[key].forEach((line:any)=>{
                    physicalCountLine = new PhysicalCountLine();
                    physicalCountLine.ParseJson(line);
                    linesTemp.push(physicalCountLine);
                })
                this.lines = linesTemp;
               }else{
                if(key in this)
                {
                    this[key as keyof typeof this] = json[key];
                }
    
               }
        }
    }
}