export class PriceManagement{
id ="";
title ="";
repeat ="";
repeatDays:[]=[];
priceLabelId=""
companyId =""
branchIds=[];
fromDate =new Date();
toDate =new Date();
discountId="";
chargeId=""

fromTime="";
toTime ="";

updatedDate= new Date();
createdAt=new Date();


ParseJson(json:any): void{
    for (const key in json) {
       this[key as keyof typeof this] = json[key];
    }
}
}