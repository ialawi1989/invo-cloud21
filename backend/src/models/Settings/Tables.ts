/* eslint-disable @typescript-eslint/no-empty-function */
export class TableProperties {
    type = "Circle";
    size = "Large";
    angle = 0;
    position = { x: 0, y: 0 };

    hideSeats = false;

    constructor() {
    }


}

class TableSettings {
    minimumCharge = 0;
    chargePerHour = 0;
    chargeAfterMinutes = 0;
}
export class Tables {
    id = "";
    tableGroupId = "";
    maxSeat = 8;
    // postion="";

    branchId = "";
    companyId = "";
    // image="";
    properties: TableProperties = new TableProperties();
    name = ""

    tables: Tables[] = [];
    updatedDate = new Date();
    settings = new TableSettings()
        ParseJson(json: any): void {
            for(const key in json) {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }

            }
        }
}