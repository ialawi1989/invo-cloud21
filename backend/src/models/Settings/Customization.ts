import { Helper } from "@src/utilts/helper";
import { CustomField } from "../admin/company";
export class CustomOptions {
    id: string = "";
    value: any;
    text: string = "";
  
  
    ParseJson(json: any): void {
      for (const key in json) {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
      if (this.value == null) {
        this.value = this.text
      }
    }
  }
export class SettingsCustomField{
   id = ""
    index: number = 0;
    value: any;
    defaultValue: any;
    name: string = "";
    abbr: string = ""; //abbreviation
    type: string = "";
    customOptions: CustomOptions[] = [];
    showOptions: any;
  
    isDeleted: boolean = false
    isChanged: boolean = false
  
    //options
    allowNull = false;
    required: boolean = false;
    visible: boolean = false;
    disable: boolean = false;
    clearable: boolean = false;
    selectMultiple: boolean = false;
    charLimit: any = null;
    conditionalLogic: boolean = false;
    // conditions: Conditions = new Conditions()



    ParseJson(json: any): void {
      for (const key in json) {
        if(key=='customOptions')
        {
            let tempArray:CustomOptions[]=[];
            json[key].forEach((element:CustomOptions) => {
                let tempObject = new CustomOptions()
                tempObject.ParseJson(element)
                tempArray.push(tempObject)

            });
            this.customOptions = tempArray
        } else{
          this[key as keyof typeof this] = json[key];   
        }
       
        this.id = this.id ??  Helper.createGuid();
      }
    }
  }
class CustomizationSettings {
    customFields: CustomField[] = [];
    ParseJson(json: any): void {
      console.log(json)
        for (const key in json) {
            if(key == 'customFields'){
                let tempArray:CustomField[]=[];
                console.log("hereeeeeeeeeeeeeeeeeeeeee" ,json[key].length)
                json[key].forEach((element:CustomField) => {
                  console.log( "hereeeeeeeeeeeeeeeeeeeeee",element.id )
                  element.id =    element.id ??Helper.createGuid();
                  console.log( "hereeeeeeeeeeeeeeeeeeeeee",element.id )
                    let tempObject = new CustomField()
                    tempObject.ParseJson(element)
                    tempArray.push(tempObject)
                });
                this.customFields = tempArray
            }
        }
    }

}

export class Customization {
    id = "";
    companyId = "";
    type = "";
    settings = new CustomizationSettings()
    keys = ['customFields','tabBuilder','invoiceBuilder','estimateBuilder', 'purchaseOrderBuilder', 'billBuilder' , 'expenseBuilder' ];
    ParseJson(json: any): void {
        for (const key in json) {

            if (key == 'settings') {
                let tempSettings = new CustomizationSettings()
                tempSettings.ParseJson(json[key])
                this.settings  = tempSettings
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }


        }
    }

    validateKey(key:string)
    {
     
        return this.keys.includes(key);
    }
}