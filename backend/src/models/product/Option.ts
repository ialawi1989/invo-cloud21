export class Option{
    id  = "";
    name = "";
    displayName = "";
    translation = {};
    price = 0;
    isVisible = false;
    isMultiple = false;
    companyId = "";
    brandId="";
    recipe:any[] = [];
    createdAt = 0;
    updatedDate= new Date();

    
    mediaId:string|null;
    kitchenName:string=""
    mediaUrl:any={}
    imageUrl="";
    excludedBranches:any[] = [];
    isAvailable = true; 
    isDeleted = false
    weight = 0;
    constructor(){
        this.mediaId = null
    }
    
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
 
        }
    }
}