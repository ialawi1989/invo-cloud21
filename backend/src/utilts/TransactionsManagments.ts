import { DB } from "@src/dbconnection/dbconnection"
import { width } from "pdfkit/js/page";

export class TransactionManagements {

    public static async getPrefix(dbTable: string, companyId: string): Promise<{ prefix: string; width: number }> {
        try {
            const query = {
                text: `select ("prefixSettings"->>'${dbTable}' )::jsonb as "prefix" from "Companies" where id =$1`,
                values: [companyId]
            }
            const settings = await DB.excu.query(query.text, query.values);
            let prefix;
            let width;
            if (settings && settings.rows && settings.rows.length > 0) {
                let prefixSettings = settings.rows[0].prefix
                if (prefixSettings) {
                    prefix = prefixSettings.prefix
                    width = prefixSettings.width
                }

            }

            if (!prefix  || !prefix.trim()) {
                switch (dbTable) {
                    case "Invoice":
                        prefix = 'INV-'
                        break;
                    case "Bill":
                        prefix = 'BILL-'
                        break;
                    case "Estimate":
                        prefix = 'EST-'
                        break;
                    case "CreditNote":
                        prefix = 'CR-'
                        break;
                    case "Expense":
                        prefix = 'EXP-'
                        break;
                    case "SupplierCredit":
                        prefix = 'SCR-'
                        break;
                    case "BillOfEntry":
                        prefix = 'BOE-'
                        break;
                    case "PurchaseOrder":
                        prefix = 'PO-'
                        break;
                    case "InventoryTransfer":
                        prefix = 'TR-'
                        break;
                    default:
                        break;
                }
            }

            //handle tokens
            prefix = prefix.replace("{YYYY}", new Date().getFullYear().toString());
            prefix = prefix.replace("{YY}", new Date().getFullYear().toString().slice(-2));
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            prefix = prefix.replace("{MM}", month);
            const day = new Date().getDate().toString().padStart(2, '0');
            prefix = prefix.replace("{DD}", day);


            return { prefix: prefix, width: width };
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static getNumber(prefix: string, lastNumber: string, width: number) {
        try {

            if (!lastNumber)
                lastNumber = prefix + '0';

            const numericPart = parseInt(lastNumber.slice(prefix.length), 10);
            let newNumber;
            if (width) {
                newNumber = `${prefix}${(numericPart + 1).toString().padStart(width, '0')}`;
            } else {
                newNumber = `${prefix}${(numericPart + 1)}`
            }

            return newNumber
        } catch (error: any) {
            throw new Error(error)
        }
    }
}