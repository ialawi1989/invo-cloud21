import { DimensionAttribute } from "./DimensionAttribute";

export class Dimension {
    id = ""
    name = "";
    translation = {};
    companyId = "";
    displayType : "buttons"| "dropdown" | "radio" = "radio"
    products = null

    attributes : DimensionAttribute[] = [];
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}