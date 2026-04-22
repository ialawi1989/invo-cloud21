export class Batches{
    id="";
    branchProductId="";
    batch="";
    onHand=0;
    unitCost=0;
    prodDate=new Date();
    expireDate= new Date();
    companyId="";
    createdAt= new Date();

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }

}