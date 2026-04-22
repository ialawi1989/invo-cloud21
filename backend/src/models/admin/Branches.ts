import { CustomField } from "./company";

export class BranchDeliveryAddress {

    type = '';
    coveredAddresses = []
    list = [];

    /**
     * 
     * {
     *  type:["Block","City","Governorate"]
     *  coveredAddresses:[
     *  {
     *    address:Southern,
     *    deliveryCharge:0,
     *    minimumOrder:0
     *  }]
     * 
     * list:[
     * 
     * ]
     * }
     */

    ParseJson(json: any): void {
        for (const key in json) {
            this[key as keyof typeof this] = json[key];
        }
    }
}

export class EcommercSettings {

    delivery = {
        active : true,
        pauseUntil :null,
        lastUpdated:null,
        employeeId:null
        }
        pickUp = {
        active : true,
        pauseUntil: null,  
        lastUpdated:null,
        employeeId:null
        }
    ParseJson(json: any): void {
        for (const key in json) {

            this[key as keyof typeof this] = json[key];
        }
    }
}
export class BranchOption {
    customFields: CustomField[] = [];
    ParseJson(json: any): void {
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
export class Branches {
    id = "";
    companyId = "";
    name = "";// RETRIEVE
    country = "";
    address = "";// RETRIEVE
    location: any | null;// RETRIEVE
    phoneNumber = "" //TODO: ADD TO DB AND RETRIEVE IT ON COMPANY Preferences 
    isWearhouse = false;
    updatedTime = new Date();
    createdAt = new Date();
    onlineAvailability = true;
    workingHours = {};
    deliveryTimes = {};
    isInclusiveTax = false;
    coveredAddresses = new BranchDeliveryAddress()
    countryAddresses: any | null
    terminalId = "";
    index = 0;
    customFields = [];
    closingTime = "5:00";
    translation: any = {}
    isEcommerceDefault = false;
    ecommercSettings:EcommercSettings|null  = null ;
    constructor() {
        this.countryAddresses = null
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "coveredAddresses") {
                let addresses = new BranchDeliveryAddress();
                addresses.ParseJson(json[key]);
                this[key] = addresses
            }
            if (key == "ecommercSettings") {
                let ecommercSettings = new EcommercSettings();
                ecommercSettings.ParseJson(json[key]);
                this[key] = ecommercSettings
            }
            this[key as keyof typeof this] = json[key];
        }
    }
}