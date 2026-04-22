import { SupplierItem } from "./SupplierItem";
interface supplierOpeningBalance {
    branchId: string
    openingBalance: number
}
export class Supplier {
    id = "";
    name = "";
    code = "";
    address = "";
    phone = "";
    email = "";
    website = "";
    note = "";
    companyId = "";
    contacts: [] = []
    country = "";
    supplierItems: SupplierItem[] = [];
    openingBalance: supplierOpeningBalance[] = [];

    vatNumber = "";

    currencyId: string | null;
    updatedDate = new Date();
    paymentTerm: "net7" | "net10" | "net15" | "net30" | "net60" | "net90" | "custome" | "endOfTheMonth" | "onReceiptDue";

    costCenter: string | null;
    availableCredit = 0;
    outStandingPayable = 0;
    constructor() {
        this.currencyId = null;
        this.costCenter = null;
        this.paymentTerm = 'custome'
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'supplierItems') {
                const itemsTemp: SupplierItem[] = [];
                let supplierItem: SupplierItem;
                json[key].forEach((line: any) => {
                    supplierItem = new SupplierItem();
                    supplierItem.ParseJson(line);
                    itemsTemp.push(supplierItem);
                })
                this.supplierItems = itemsTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }

            }

        }
    }
}