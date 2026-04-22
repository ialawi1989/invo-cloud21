export class InventoryLocation {
    id="";
    companyid="";
    branchId="";
    name =""

    products:[]=[];

    translation:any={}
    createdAt= new Date();
    updatedDate= new Date()
    existValues : any=[]
	ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}