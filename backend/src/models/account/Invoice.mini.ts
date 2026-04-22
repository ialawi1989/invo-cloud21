import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { Helper } from "@src/utilts/helper";
import { Customer } from "./Customer";
import { InvoiceLine } from "./InvoiceLine";
import { InvoicePayment } from "./InvoicePayment";
import { InvoicePaymentLine } from "./InvoicePaymentLine";

export class InvoiceMini {
    id = "";
    branchId = "";
    invoiceNumber: string | null;
    refrenceNumber = "";
    source = "Cloud"; //POS, ONLINE ...
    customerContact = "";
    estimateId: string | null;
    status = "Open"; //T
    zatca_status = "";
    zatca_info = "";
    jofotara_status ="";
    jofotara_info ="";
    total = 0;
    paidAmount = 0;
    balance = 0; // total - paid 
    refunded = 0;// credit not total linked to this invoice 
    appliedCredit = 0;// amount applied on this invoice from credit notes 
    employeeName = "";
    branchName = "";
    customerName = "";

    invoiceDate = new Date();
    onlineStatus = "";
    createdAt: Date = new Date();
    onlineData: any = {}
    currentInvoiceStatus = "" // to check if invoice online status is being changed from pending to accpeted

    isPaid = false;
    
    isVoided = false;
    mergeWith:string|null;
    constructor() {
        this.estimateId = null;
        this.invoiceNumber = null;
        this.onlineData.sessionId = "";
        this.onlineData.onlineStatus = "";
        this.mergeWith = null;
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    invoiceStatus() {
        const invoiceBalance = (this.total ) - (Number(this.appliedCredit) + this.paidAmount)
        this.balance = invoiceBalance
        this.status = this.status == "" ? "Open" : this.status

        this.balance = this.balance < 0 ? 0 : this.balance;

        if(this.mergeWith != null && this.mergeWith!="")
        {
            this.status = "merged"
            return
        }
        if(this.status == 'writeOff')
        {
            return
        }
        if (this.status != "writeOff" && this.status != "Draft") {
            if (((this.balance - this.refunded == this.total && invoiceBalance > 0)  )&&( this.onlineData && this.onlineData.onlineStatus != "Rejected") && this.mergeWith ==null) {
                this.status = "Open"
                return;
            } else {
                if (this.isVoided &&this.total == 0 && this.mergeWith ==null) {
                    this.status = "Void"
                } else {
                    if (this.total == 0 ||((this.total - this.refunded) == 0) || (this.onlineData && this.onlineData.onlineStatus == "Rejected") ||  this.mergeWith !=null) {
                        this.status = "Closed"
                    } else {
                        if (this.balance - this.refunded == 0 || this.balance - this.refunded  < 0) {
                            this.status = "Paid"

                        } else if (this.paidAmount > 0 && this.balance > 0 && this.balance < this.total) {
                            this.status = "Partially Paid"
                        }
                    }
                }
                // }
            }
        }
    }
}