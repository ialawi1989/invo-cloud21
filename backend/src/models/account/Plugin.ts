export class WhatsAppSetting
{
    enable  =true;
    userName="";
    password="";
    services = {};

}
export class Plugin {
    id = "";
    pluginName = "";
    settings:any = {}
    type ="Aggregator"; /**currently whatsapp and aggregator */
    companyId="";
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}