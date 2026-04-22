export class DimensionAttribute {
    id = "";
    name = "";
    code = "";
    value = "";
    translation = {};
    dimensionId = ""
    companyId = ""
   

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}