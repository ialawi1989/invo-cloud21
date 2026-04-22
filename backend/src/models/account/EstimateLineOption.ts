export class EstimateLineOption{
    id="";
    estimateLineId="";
    optionId="";
    optionName ="";
    translation ={};

    note="";
    price=0;
    qty=0;
    
    createdAt = new Date()
    
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}