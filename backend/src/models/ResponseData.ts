export class ResponseData{
    success = false;
    msg = "";
    data:any = {};
    constructor(success: boolean, msg : string, data: any){
        this.success = success;
        this.msg= msg;
        this.data = data;
    }

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}