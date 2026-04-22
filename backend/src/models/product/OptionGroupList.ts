
export class OptionGroupList {
    optionId = 0;
    index = 0;
    qty = 1;
    excludedBranches =[];
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}