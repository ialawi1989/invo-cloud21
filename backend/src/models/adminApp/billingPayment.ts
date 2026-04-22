export class BillingPayment {
    id: string = "";
    companyId: string = "";
    paymentNumber: string = "";
    amount: number = 0;
    allocatedAmount: number = 0;
    unallocatedAmount: number = 0;
    currency: string = "SAR";
    paymentMethod: string = "";
    status: "completed" | "pending" | "failed" | "refunded" = "completed";
    reference: string = "";
    paymentDate: Date = new Date();
    notes: string = "";
    receivedBy: string = "";
    allocations: PaymentAllocation[] = [];
    companyName?: string;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key === "allocations") {
                this.allocations = (json[key] || []).map((a: any) => {
                    const alloc = new PaymentAllocation();
                    alloc.ParseJson(a);
                    return alloc;
                });
            } else if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}

export class PaymentAllocation {
    id: string = "";
    paymentId: string = "";
    invoiceId: string = "";
    amount: number = 0;
    allocatedAt: Date = new Date();
    invoiceNumber?: string;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}
