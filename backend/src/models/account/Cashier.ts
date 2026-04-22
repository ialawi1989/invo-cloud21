import { CashierLine } from "./CashierLine";
import { Log } from "../log";
import { Helper } from "@src/utilts/helper";
import { TimeHelper } from "@src/utilts/timeHelper";
export class Cashier {
    id = "";
    employeeId = "";
    terminalId = "";
    cashierOutBy: string | null; //uuid
    branchId = "";

    cashierNumber = ""

    cashierIn = new Date();
    cashierOut: Date | null;
    startAmount = 0;
    endAmount = 0;

    logs: Log[] = []
    lines: CashierLine[] = []

    constructor() {
        this.cashierOut = null;
        this.cashierOutBy = null;
    }


    ParseJson(json: any): void {
        for (const key in json) {

            if (key == 'lines') {
                const linesTemp: CashierLine[] = [];
                let cashierLine: CashierLine;
                json[key].forEach((line: any) => {
                    cashierLine = new CashierLine();
                    cashierLine.ParseJson(line);
                    linesTemp.push(cashierLine);
                })
                this.lines = linesTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }



    /** pos logs are receviced with createdAt as time stamp */
    parsePosLogs() {
        try {
            let logs: Log[] = []
            let log;
            if (this.logs && Array.isArray(this.logs)) {
                this.logs.forEach(element => {
                    log = new Log();
                    log.ParseJson(element);
                    log.createdAt = TimeHelper.convertToDate(log.createdAt);
                    logs.push(log)
                });
                this.logs = logs
            }
        } catch (error) {
            console.log(error)

        }

    }
    /** the following function will merege to array of logs avoiding duplication  */
    setlogs(logs: any[]) {
        this.logs = Helper.checkAndParseArrayOpjects(this.logs)
        this.parsePosLogs()
        let mergedArray = this.logs.concat(logs);

        const uniqueArray = mergedArray.filter((event, index, self) => {
            // Create a unique key based on employeeId, action, and comment
            const uniqueKey = `${event.employeeId}-${event.action}-${event.comment}-${event.createdAt}`;
            // Check if the unique key has been seen before
            return index === self.findIndex(e =>
                `${e.employeeId}-${e.action}-${e.comment}-${event.createdAt}` === uniqueKey
            );
        });


        this.logs = logs.length > 0 ? uniqueArray : this.logs;
    }
}