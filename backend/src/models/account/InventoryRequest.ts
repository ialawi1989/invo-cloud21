import { any } from "bluebird";

export class InventoryRequestLine {
    id=""
    qty=0;
    productId=""; 
    supplierId:string|null;
    priority=""; //["Normal","Urgent"]
    requestId=""
    supplierName=""
    unitCost=0; 
    constructor(){
        this.supplierId = null
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    } 
}

export class InventoryRequest{
 id="";
 branchId=""
 employeeId="";
 createdAt = new Date();
 lines :InventoryRequestLine[]=[]
employeeName=""

status = "Open"
details = []
 ParseJson(json: any): void {
    for (const key in json) {
        if(key in this)
        {

            this[key as keyof typeof this] = json[key];

            if(key =='lines')
            {
                let list = typeof json[key] =='string'? JSON.parse(json[key]):json[key]
                let temp :InventoryRequestLine[]=[]
                let lineTemp : InventoryRequestLine
                // json[key].forEach((element:any) => {
                //     lineTemp = new InventoryRequestLine()
                //     lineTemp.ParseJson(element);
                //     temp.push(lineTemp);
                // });
                list.forEach((element:any) => {
                    lineTemp = new InventoryRequestLine()
                        lineTemp.ParseJson(element);
                        temp.push(lineTemp);
                });
                this['lines'] = temp
            }
        }
    }
}
}
