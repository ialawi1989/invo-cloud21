
import { int } from "aws-sdk/clients/datapipeline";
import { BudgetLine } from "./BudgetLine";
import { integer } from "aws-sdk/clients/cloudfront";



export class Budget {
    id="";
    name="";
    companyId = "";
    branchId: string| null =null;
    periodicity = ""
    year: integer|null = null; 
    createdAt = new Date(); 
    updatedDate : null|Date = null;
    lines:BudgetLine[]=[];
    
    ParseJson(json:any): void{
        for (const key in json) {
           if(key =='lines'){
            const linesTemp:BudgetLine[]=[];
            let journalLine:BudgetLine;
            json[key].forEach((line:any)=>{
                journalLine = new BudgetLine();
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
}

export class BudgetTest {
    id="";
    name="";
    companyId = "";
    branchId: string| null =null;
    periodicity = ""
    year: integer|null = null; 
    createdAt = new Date(); 
    updatedDate : null|Date = null;
    lines:YearlyBudgetLine[] | MonthlyBudgetLine[] |QuarterlyBudgetLine[]|HalfBudgetLine[]=[];
    
    ParseJson(json:any): void{
        for (const key in json) {
           if(key =='lines'){
                if(this.periodicity == 'yearly') {
                    const linesTemp:YearlyBudgetLine[]=[];
                    json[key].forEach((line:any)=>{
                    let budgetLine = new YearlyBudgetLine();
                    budgetLine.ParseJson(line);
                    linesTemp.push(budgetLine);
                    })
                    this.lines = linesTemp; 
                }
                else if(this.periodicity == 'half'){
                    const linesTemp:HalfBudgetLine[]=[];
                    json[key].forEach((line:any)=>{
                    let budgetLine = new HalfBudgetLine();
                    budgetLine.ParseJson(line);
                    linesTemp.push(budgetLine);
                    })
                    this.lines = linesTemp; 
                }
                else if(this.periodicity == 'quarterly'){
                    const linesTemp:QuarterlyBudgetLine[]=[];
                    let budgetLine: QuarterlyBudgetLine;
                    json[key].forEach((line:any)=>{
                    budgetLine = new QuarterlyBudgetLine();
                    budgetLine.ParseJson(line);
                    linesTemp.push(budgetLine);
                    })
                    
                    this.lines = linesTemp; 
                }
                else if(this.periodicity == 'monthly'){
                    const linesTemp:MonthlyBudgetLine[]=[];
                    json[key].forEach((line:any)=>{
                    let budgetLine = new MonthlyBudgetLine();
                    budgetLine.ParseJson(line);
                    linesTemp.push(budgetLine);
                    })
                    this.lines = linesTemp; 
                }
            
           }
           else{
            if(key in this){
                if(key in this)
                {
                    this[key as keyof typeof this] = json[key];
                }
            }
          

           }
         
        }
    }
}

export class YearlyBudgetLine{

    id = "";
    accountId = "";
    budgetId = "";

    prediction = 0;
    actualAmount = 0;
    createdAt = new Date();
    periodFilter : Number = (new Date()).getFullYear();
    period :{}|null = null;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}

export class HalfBudgetLine{

    id = "";
    accountId = "";
    budgetId = "";

    prediction = 0;
    actualAmount = 0;
    createdAt = new Date();
    
    periodFilter :  "1H"| "2H" = "1H";
 
    period :{}|null = null;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}
 enum s {Q1='Q1', female='Q2'};

export class QuarterlyBudgetLine{
    

    id = "";
    accountId = "";
    budgetId = "";

    prediction = 0;
    actualAmount = 0;
    createdAt = new Date();
    
    periodFilter : s  = s.Q1;
 
    period :{}|null = null;
     
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this ) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}

export class MonthlyBudgetLine{

    id = "";
    accountId = "";
    budgetId = "";

    prediction = 0;
    actualAmount = 0;
    createdAt = new Date();
    
    periodFilter :  "January"| "February"| "March"| "April"| "May"|"June"|
    "July"| "August"| "September"| "October"| "November"| "December" = "January";
 
    period :{}|null = null;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
              
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}