export class Feedback {
    id: string | null = null
    rating: number = 1
    comment: string | null = null
    customerName: string | null = null
    customerContact: string | null = null
    customerId: string = ""
    companyId: string = ""
    branchId: string = ""
    transactionId: string = ""
    transactionNumber: string | null = null
    createdAt = new Date();
    updatedAt: Date | null = null
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }


    }
}