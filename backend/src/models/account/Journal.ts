import { Log } from "../log";
import { JournalLine } from "./JournalsLine";



export class Journal {
    id="";
    branchId="";
    branchName="";

    notes="";
    comments:any[]=[]
    reference="";
    createdAt = new Date();
    lines:JournalLine[]=[];
    system=false;
    journalDate = new Date()
    recurringJournalId :null|String = null

    employeeId="";
    employeeName="";
    status= "Open";
    attachment:any[]=[];
    logs:Log[]=[];
    reconciled = false ;
    companyId = "";
    
    ParseJson(json:any): void{
        for (const key in json) {
           if(key =='lines'){
            const linesTemp:JournalLine[]=[];
            let journalLine:JournalLine;
            json[key].forEach((line:any)=>{
                journalLine = new JournalLine();
                journalLine.ParseJson(line);
                linesTemp.push(journalLine);
            })
            this.lines = linesTemp;
           }else{
            if(key in this){
                if(key in this)
                {
                    this[key as keyof typeof this] = json[key];
                }
            }
          

           }
         
        }
    }


    setReconciled (){
        let reconciledLines = this.lines.filter(f=>f.reconciled == true)
        if(reconciledLines && reconciledLines.length>0)
        {
            this.reconciled = true
        }
    }
}