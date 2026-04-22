export class SubscriptionFeature {
    id: string = "";
    name: string = "";
    slug: string = "";
    scope: "company" | "branch" = "company";
    featureType: "boolean" | "quantity" = "boolean";
    description: string = "";
    isActive: boolean = true;
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
