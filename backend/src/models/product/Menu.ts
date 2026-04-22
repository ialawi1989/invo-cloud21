import { MenuSection } from "./MenuSection";

export class Menu{
    id="";
    name="";
    companyId=""
    startAt= "";
    sections:MenuSection[]=[];
    updatedDate=new Date();
    branchIds:any[] =[];
    endAt ="";
    index=0;
    availableOnline = false ; 
    priceLabelId:string|null;

    constructor(){
        this.priceLabelId = null
    }
    ParseJson(json:any): void{
        for (const key in json) {
            if(key =='sections'&& json[key].length>0)
            {
                const sectionsTemp:MenuSection[]=[];
                let menuSection:MenuSection;
                json[key].forEach((section:any) => {
                    menuSection = new MenuSection();
                    menuSection.ParseJson(section);
                    sectionsTemp.push(menuSection)
                });
                this.sections = sectionsTemp;
            }else{
                this[key as keyof typeof this] = json[key];
            }
          
        }
    }
}