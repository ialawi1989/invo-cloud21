export class SalesTarget {
    id: string | null = "";
    companyId: string = "";
    period: string = "";
    dateFrom: any;
    dateTo: any ;
    workingDays: number = 0
    totalSalesTarget = 0
    netSalesTarget = 0
    currency: string = ""
    branches: SalesTargetBranches[] = [];
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'branches') {
                const branchesTemp: SalesTargetBranches[] = [];
                let salesBranches: SalesTargetBranches;
                json[key].forEach((branch: any) => {

                    salesBranches = new SalesTargetBranches();
                    salesBranches.ParseJson(branch);

                    branchesTemp.push(salesBranches);

                });
                this.branches = branchesTemp;

            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }

        }
    }
}


export class SalesTargetBranches {
    salesTargetId: string = "";
    branchId: string = "";
    totalSalesTarget: string = "";
    netSalesTarget: string = "";
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}