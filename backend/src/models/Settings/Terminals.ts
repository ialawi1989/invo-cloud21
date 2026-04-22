import { Log } from "../log";

export class Terminal {
    id = "";
    branchId = "";
    prefix:  string | null;
    parentId: string | null;
    name = "";
    createdAt = new Date();
    terminalId = "";
    terminalType = "";
    logs:Log[]=[];
    constructor() {
        this.parentId = null
        this.prefix=null
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}