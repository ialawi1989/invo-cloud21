export class SubscriptionPlan {
    id: string = "";
    name: string = "";
    slug: string = "";
    scope: "company" | "branch" = "company";
    billingCycle: "monthly" | "yearly" = "yearly";
    basePrice: number = 0;
    currency: string = "SAR";
    description: string = "";
    isActive: boolean = true;
    features: PlanFeature[] = [];
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    ParseJson(json: any): void {
        for (const key in json) {
            if (key === "features") {
                this.features = (json[key] || []).map((f: any) => {
                    const pf = new PlanFeature();
                    pf.ParseJson(f);
                    return pf;
                });
            } else if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}

export class PlanFeature {
    id: string = "";
    planId: string = "";
    featureId: string = "";
    quantity: number = 1;
    unitPrice: number = 0;
    featureName?: string;
    featureSlug?: string;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                (this as any)[key] = json[key];
            }
        }
    }
}
