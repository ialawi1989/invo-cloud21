import { Batches } from "@src/models/product/Batches";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { EmployeePrice } from "../admin/EmployeePrice";
import { ProductBarcode } from "./ProductBarcode";
import { Recipe } from "./Recipe";
import { Serials } from "./Serials";
import { CustomField } from "../admin/company";
import { Log } from "../log";
import { SupplierItem } from "../account/SupplierItem";
import { ProductDiscount } from "../account/Discount";


export class ProductOption {
    customFields:CustomField[]=[];
    ParseJson(json:any): void{
        for (const key in json) {
            if (key == "customFields") {
                const customizeFieldsTemp: CustomField[] = [];
                let customFiled: CustomField;
                json[key].forEach((line: any) => {
                    customFiled = new CustomField();
                    customFiled.ParseJson(line);
                    customizeFieldsTemp.push(customFiled);
                });
                this.customFields = customizeFieldsTemp;
            } 
        }
    }
}
export class Measurement {
    shoulder: boolean = true;
    sleeve: boolean = true;
    armholeGrith: boolean = true;
    upperarmGrith: boolean = true;
 
    wristGrith: boolean = true;
    frontShoulderToWaist: boolean = true;
 
    bustGrith: boolean = true;
    waistGrith: boolean = true;
 
    hipGrith: boolean = true;
    acrossShoulder: boolean = true;
 
    thigh: boolean = true;
    ankle: boolean = true;
    bodyHeight: boolean = true;
    napeOfNeckToWaist: boolean = true;
    outsteam: boolean = true;
    insideLeg: boolean = true;
 
 
    get atLeastOne() {
       let a: any = Object.values(this).filter((value) => value === true);
       return a.length;
    }
 
    ParseJson(json: any): void {
       for (const key in json) {
          if (key in this) {
             this[key as keyof typeof this] = json[key];
          }
       }
    }
 }

export class Product {
    id = "";

    weight:number=0;  
    weightUOM:string="KG"; 
    shippingEnabled: boolean = false;
    brandid:string|null;
    parentId: string  | null; // Is Set when product is a child product 
    name = "";
    barcode= "";
    defaultPrice = 0;
    type = "";
    UOM = "";
    unitCost = 0;

    
    description = "";
    tags = [];
    warning = "";



    serviceTime = 0;
    translation:any = {}; 
    // 
    companyId = "";
    createdAt = new Date;

    categoryId: string  | undefined|null;

    employeePrices: EmployeePrice[] = [];
    barcodes : ProductBarcode[] = [];

    serviceStatus  = { "title" : "",type: "Text"};
    discount  : ProductDiscount | null = null;

    kitBuilder:any = []; // when type of product is kit
    package:any = []; // when type of product is package
    selection:any = []; // when type of product is menuSelection
    tabBuilder:any = { specifications: {}, faq: [] };
    
    childQty=0;
    optionGroups:any = []; // {optionGroupId,index}
    quickOptions:any = []; // {optionId, index}

    //We will change it tommorow
    //only for menuItem
    recipes:any= [];
    branchProduct : BranchProducts[] = [];
    productMedia:any[]=[];

    taxId:string|null;
    preparationTime=0;
    productMatrixId:string|undefined;
    base64Image="";
    defaultImage="";

    productAttributes=[]


    isDeleted = false;
    //TODO:ADD TO DB
    sku="";
    alternativeProducts=[];
    maxItemPerTicket = 0;
    kitchenName: string = "";

    logs:Log[]=[];
    isPurchaseItem:boolean|null;
    isSaleItem:boolean|null;
    measurements:null| Measurement = null;
    threeDModelId:string|null = null;
    defaultOptions:any[] = []
    categoryIndex = 0 
    constructor(){
        this.barcode = "";
        this.parentId = null;
        this.mediaId = null;
        this.taxId = null;
        this.brandid=null
        this.saleAccountId= null
        this.purchaseAccountId= null
        this.isSaleItem = null
        this.isPurchaseItem = null
    }
    
    orderByWeight=false;
    isDiscountable=true;
    mediaId:string|null;
    nutrition={};
    priceModel={};
    commissionPercentage= false;
    commissionAmount=0;
    departmentId="";
    updatedDate=new Date();


    departmentName="";
    categoryName="";
    color="";

    reorderPoint = 0;
    reorderLevel =0;

    productDeduction=[]; /** array of service id only provided service id can effact onHand */

    suppliers:SupplierItem[]=[]

    brand="";
    customFields=[];
    comparePriceAt=0;
    defaultTax = true; 


    saleAccountId:string|null;
    purchaseAccountId:string|null;

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}   