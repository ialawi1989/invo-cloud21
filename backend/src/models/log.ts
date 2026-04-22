export class Log {
    employeeId = "";
    action = "";
    comment = "";
    createdAt = new Date(); //date of the events
    metaData? = {}

    public static addLog(obj: any, comment: string, action: string, employeeId: string, metaData?: {}) {
        let log = {
            comment: comment,
            action: action,
            employeeId: employeeId,
            createdAt: new Date(),
            metaData: metaData ? metaData : {}
        }
        if (obj.logs) {
            obj.logs.push(log)
        }
        else{
            obj.push(log)
        }

    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }

}

export class EventLog {
    id = "" // referenceId,
    type = "" // referencTable ["invoice","creditNote" .....],
    action = ""  // Delete
    createdAT = new Date();
    employeeId = "";
    branchId = "";
    companyId = "";
    source: string | null;// ONLINE, POS,.....

    constructor() {
        this.source = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }

        }
    }
}