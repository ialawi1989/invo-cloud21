export class Payout{

    id=""
    description ="" 
	employeeId=""
	cashierId="" 
	amount=0
	paymentMethodId=""
	accountId=""
	createdAt= new Date();
	updatedAt= new Date();
    branchId=""
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}