export class BillingInvoice {
    id: string = "";
    invoiceNumber: string = "";
    companyId: string = "";
    status: "draft" | "issued" | "paid" | "partially_paid" | "overdue" | "void" | "refunded" = "draft";
    issueDate: Date = new Date();
    dueDate: Date = new Date();
    periodStart: Date = new Date();
    periodEnd: Date = new Date();
    subtotal: number = 0;
    discountTotal: number = 0;
    taxTotal: number = 0;
    total: number = 0;
    amountPaid: number = 0;
    balance: number = 0;
    currency: string = "SAR";
    notes: string = "";
    pdfUrl: string = "";
    voidedAt: Date | null = null;
    lines: BillingInvoiceLine[] = [];
    companyName?: string;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key === "lines") {
                this.lines = (json[key] || []).map((l: any) => {
                    const line = new BillingInvoiceLine();
                    line.ParseJson(l);
                    return line;
                });
            } else if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }

    calculateTotals(): void {
        let subtotal = 0;
        let discountTotal = 0;
        let taxTotal = 0;

        this.lines.forEach(line => {
            line.calculateTotal();
            subtotal += line.amount;
            discountTotal += line.discountAmount;
            taxTotal += line.taxAmount;
        });

        this.subtotal = subtotal;
        this.discountTotal = discountTotal;
        this.taxTotal = taxTotal;
        this.total = subtotal - discountTotal + taxTotal;
        this.balance = this.total - this.amountPaid;
    }
}

export class BillingInvoiceLine {
    id: string = "";
    invoiceId: string = "";
    subscriptionId: string = "";
    subscriptionType: string = "";
    featureId: string = "";
    lineType: "base_subscription" | "addon" | "proration" | "discount" | "tax" | "credit" = "addon";
    description: string = "";
    quantity: number = 1;
    unitPrice: number = 0;
    amount: number = 0;
    discountAmount: number = 0;
    taxRate: number = 0;
    taxAmount: number = 0;
    total: number = 0;
    periodStart: Date | null = null;
    periodEnd: Date | null = null;
    createdAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }

    calculateTotal(): void {
        this.amount = this.quantity * this.unitPrice;
        this.taxAmount = (this.amount - this.discountAmount) * (this.taxRate / 100);
        this.total = this.amount - this.discountAmount + this.taxAmount;
    }
}
