import { forEach } from "lodash";
import { InventoryTransferLine } from "./InventoryTransferLine";

export class InventoryTransfer{
    id="";
    transferNumber="";
    createdDate = new Date();
    reference="";
    employeeId="";
    type="";
    status="";
    reason="";
    note="";
    branchId="";
    destinationBranch:string|null;
    confirmDatetime= new Date();
    lines:InventoryTransferLine[]=[];
    
    source = "Cloud"
    currentStatus = "";

    employeeName ="";
    branchName ="";
    destinationBranchName="";
    confirmedEmployee:string|null;
    confirmedEmployeeName = ""
    constructor(){
        this.confirmedEmployee = null
        this.destinationBranch = null;
    }
    ParseJson(json:any): void{
        for (const key in json) {
            if(key =='lines'){
                const linesTemp:InventoryTransferLine[]=[];
                let transferLine:InventoryTransferLine;
                json[key].forEach((line:any)=>{
                    transferLine = new InventoryTransferLine();
                   transferLine.ParseJson(line);
                    linesTemp.push(transferLine);
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