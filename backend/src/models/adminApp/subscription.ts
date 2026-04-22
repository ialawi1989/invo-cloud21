export class CompanySubscription {
    id: string = "";
    companyId: string = "";
    planId: string | null = null;
    status: "active" | "cancelled" | "expired" | "suspended" | "pending" = "active";
    billingCycle: "monthly" | "yearly" = "yearly";
    startDate: Date = new Date();
    endDate: Date = new Date();
    renewalDate: Date | null = null;
    autoRenew: boolean = true;
    basePrice: number = 0;
    currency: string = "SAR";
    notes: string = "";
    cancelledAt: Date | null = null;
    items: SubscriptionItem[] = [];
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key === "items") {
                this.items = (json[key] || []).map((i: any) => {
                    const item = new SubscriptionItem();
                    item.ParseJson(i);
                    return item;
                });
            } else if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}

export class BranchSubscription {
    id: string = "";
    branchId: string = "";
    companyId: string = "";
    planId: string | null = null;
    status: "active" | "cancelled" | "expired" | "suspended" | "pending" = "active";
    billingCycle: "monthly" | "yearly" = "yearly";
    startDate: Date = new Date();
    endDate: Date = new Date();
    renewalDate: Date | null = null;
    autoRenew: boolean = true;
    basePrice: number = 0;
    currency: string = "SAR";
    notes: string = "";
    cancelledAt: Date | null = null;
    items: SubscriptionItem[] = [];
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key === "items") {
                this.items = (json[key] || []).map((i: any) => {
                    const item = new SubscriptionItem();
                    item.ParseJson(i);
                    return item;
                });
            } else if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}

export class SubscriptionItem {
    id: string = "";
    subscriptionId: string = "";
    subscriptionType: "company" | "branch" = "company";
    featureId: string = "";
    quantity: number = 1;
    unitPrice: number = 0;
    startDate: Date = new Date();
    endDate: Date | null = null;
    isActive: boolean = true;
    addedMidCycle: boolean = false;
    featureName?: string;
    featureSlug?: string;
    featureScope?: string;
    featureType?: string;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}

export class SubscriptionChange {
    id: string = "";
    subscriptionId: string = "";
    subscriptionType: "company" | "branch" = "company";
    changeType: string = "";
    featureId: string | null = null;
    previousQuantity: number | null = null;
    newQuantity: number | null = null;
    previousPlanId: string | null = null;
    newPlanId: string | null = null;
    effectiveDate: Date = new Date();
    proratedAmount: number | null = null;
    billingInvoiceId: string | null = null;
    notes: string = "";
    performedBy: string | null = null;
    createdAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}
