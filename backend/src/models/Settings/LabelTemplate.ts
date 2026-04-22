export class LabelTemplates {
    id = "";
    name = "";
    companyId = "";
    template: any = [];
    ZPL = "";
    createdAt = new Date();
    updatedDate = new Date();

    labelHeight: number = 0.75;
    labelWidth: number = 1.75;
    dpi: number = 203;

    templateType="";
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}