export class jofotara {
    taxName = "";
    clientId = "";
    secretKey = "";
    taxNumber = "";
    activityNumber = "";
    constructor() {
    }
    ParseJson(json: any): void {
        for (const key in json) {
            this[key as keyof typeof this] = json[key];
        }
    }
}