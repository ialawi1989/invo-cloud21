
export class ServiceSetting
{
    branchId ="";
    setting = {};
    priceLabelId="";
    chargeId="";

}


export class ServiceOptions{
    lockMenu=false;
    locKChangeService=false;
}
export class Service {
    id = "";
    name = "";
    type = "";
    setting = {}
    branchId = "";
    index = 0;
    updatedDate = new Date()

    translation: any = {};
    default = false;

    branches: ServiceSetting[] = [];
    /** only for socket */
    priceLabelId:string|null
    chargeId:string|null

    mediaId:string|null;
    mediaUrl:any={};
    menuId:string|null;


    options:ServiceOptions|null;
    constructor() {
        this.menuId=null
        this.mediaId = null
        this.priceLabelId = null;
        this.chargeId = null;
        this.options = null;
    }

    //TODO:SETTINGS ENABLE => TRUE BY DEFAULT => RETAIL ONLY ENABLE 
    // {
    //showtableSelection : true  
    //falseDiscount : true
    // /ENABLE : true
    //}

    //TODO:CarHop => DriveThru
    serviceTypes() {
        return [{ companyType: 'DineIn', type: "DineIn", name: "DineIn", setting: { "enabled": true,"showTableSelection":true}, translation: { name: { en: "DineIn", ar: "طلبات داخلية" } }, default: true },
        { companyType: 'Resturant', type: "PickUp", name: "PickUp", setting: { "enabled": true }, translation: { name: { en: "PickUp", ar: "طلبات الاستلام" } }, default: true },
        { companyType: 'Resturant', type: "Delivery", name: "Delivery", setting: { "enabled": true }, translation: { name: { en: "Delivery", ar: " طلبات التوصيل " } }, default: true },
        { companyType: 'Resturant', type: "CarHop", name: "CarHop", setting: { "enabled": true }, translation: { name: { en: "CarHop", ar: " طلبات خارجية" } }, default: true },
        { companyType: 'Retail', type: "Retail", name: "Retail", setting: { "enabled": true }, translation: { name: { en: "Retail", ar: "  بيع بالتجزئة" } }, default: true },
        { companyType: 'Retail', type: "PickUp", name: "PickUp", setting: { "enabled": true }, translation: { name: { en: "PickUp", ar: "طلبات الاستلام" } }, default: true },
        { companyType: 'Retail', type: "Delivery", name: "Delivery", setting: { "enabled": true }, translation: { name: { en: "Delivery", ar: " طلبات التوصيل " } }, default: true },
        { companyType: 'Salon', type: "Salon", name: "Salon", setting: { "enabled": true }, translation: { name: { en: "Salon", ar: " صالون" } }, default: true },
        { type: "Catering", name: "Catering", setting: { "enabled": true }, translation: { name: { en: "Catering", ar: " خدمات الضيافة " } }, default: true }]
    }


    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}