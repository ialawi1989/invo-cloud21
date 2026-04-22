
export class CustomerAddress {
    title = '';
    block = '';
    road = '';
    building = '';
    flat = '';
    city = '';
    note = '';
    lat = '';
    lng = '';
    //    branchId = "";


    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}
interface customerOpeningBalance {
    branchId: "",
    openingBalance: 0
}
export class Customer {
    id: string | null;
    companyId = "";
    companyGroup = "";
    contactName: string | null = "";
    creditLimit: number | null = null;
    type: "Business" | "Individual" = "Individual"

    saluation = "";
    name = "";
    phone = "";
    mobile = "";
    email = "";
    addresses: CustomerAddress[] = []
    MSR = "";
    birthDay: Date | null;
    createdAt: Date | null = null;
    notes: any = [];

    parentId: string | null;
    industry: string | null = null;
    parentName = "";
    hasChild: boolean = false;

    priceLabelId: string | null;
    discountAmount = 0;


    vatNumber = "";
    openingBalance: customerOpeningBalance[] = []
    updatedAt = new Date();
    currencyId: string | null;
    paymentTerm: "net7" | "net10" | "net15" | "net30" | "net60" | "net90" | "custome" | "endOfTheMonth" | "onReceiptDue";
    oneSignalSegment = "";

    customerCredit = 0;
    availableCredit = 0;
    outStandingReceivable = 0;
    accountReceivable = 0;

    options = {
        allowHouseAccount: true
    }
    constructor() {
        this.id = null;
        this.parentId = null;
        this.priceLabelId = null;
        this.currencyId = null;
        this.paymentTerm = "custome"
        this.birthDay = null

    }

    customFields: any[] = []
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'addresses' && typeof json[key] == 'string') {
                this[key] = JSON.parse(json[key])
            } else if (key == 'notes' && typeof json[key] == 'string') {
                this[key] = JSON.parse(json[key])
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }

        }
    }
}