import { Batches } from "@src/models/product/Batches";

import { Serials } from "@src/models/product/Serials";
import { EmployeePrice } from "../admin/EmployeePrice";
import { ProductBarcode } from "./ProductBarcode";

export class BranchProducts{
    id="";
    productId="";
    branchId="";
    available=true;
    price:number|null;
    name="";

    onHand=0;
    serials : Serials[]=[];
    batches : Batches[]= [];
    employeePrices:EmployeePrice[]=[];
    priceBoundriesFrom:number|null=null;
    priceBoundriesTo:number|null=null;

    buyDownPrice:any=0 ;
    buyDownQty:any=0 ; //

    priceByQty:any=[]; //
    
    companyId="";
    createdAt= new Date();
    selectedPricingType="";
    availableOnline = true;
    
    locationId:string|null;
    openingBalance =0;
    openingBalanceCost=0;

    reorderLevel =0;
    reorderPoint=0;
    updatedTime = new Date();
    constructor(){
        this.price = null;
        this.locationId=null
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }

}