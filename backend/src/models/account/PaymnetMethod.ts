export class PaymnetMethod {
    id = ""
    name = ""
    type = ""
    rate = 1;
    symbol = "";
    afterDecimal: any = 0;
    accountId = "";
    companyId = "";
    base64Image = "";
    defaultImage = "";
    translation = {};
    branchesAccounts ={};
    index = 0;
    isOnlinePayment = false;
    updatedDate = new Date()
    isEnabled = true;
    pos = true;
    currencyCode='BHD'
    options: { OpenDrawer: boolean, ReqCode: boolean } = {
        OpenDrawer: false,
        ReqCode: false
    }
    //TODO: ADD IT TO DB PRODUCTIONS AND TESTING AND SATGING
    settings: any | null;

    bankCharge: number | null;

    mediaId: string | null;
    imageUrl = "";
    formType = "payment" /** [paymnet, currency] */
    country = ""

    mediaUrl: any = {};


    showInAccount = true;
    constructor() {
        this.bankCharge = null;
        this.settings = null;
        this.mediaId = null;
    }
    defaultPayments() {
        return [{ payment: "Cash", type: "Default Cash", rate: 1, options: { OpenDrawer: true, ReqCode: false } }]
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}