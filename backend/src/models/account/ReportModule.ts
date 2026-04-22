export class ReportModule{
    id="";
    companyId="";
    text="";
    name="";
    updated="";
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}