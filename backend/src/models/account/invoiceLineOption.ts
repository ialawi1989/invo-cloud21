export class InvoiceLineOption{
    id="";
    invoiceLineId="";
    optionId:string|null;
    optionGroupId:string|null;
    optionGroupName: string|null;
    optionGroupTranslation ={};
    
    note="";
    price=0;
    defaultPrice = 0 ; 
    qty=0;

    createdAt = new Date()
    translation ={};

    optionName="";
    recipe:any =[];
    weight =0;
    constructor(){
        this.optionId = null;
        this.optionGroupId = null;
        this.optionGroupName = null;
    }

    isEditedOption= false ;
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
 

    resetPrice(){
        this.price =0
    }
}