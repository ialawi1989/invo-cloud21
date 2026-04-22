export class Media{
    id="";
    companyId="";
    media=""//image base64
    mediaType:any={};
    size={};
    documentContent:string|null;
    contentType = "image"
    constructor(){
        this.documentContent = null
    }

    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        
        }
    }
}