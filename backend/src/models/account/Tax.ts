export class Tax {

    id = "";
    name = "";
    taxPercentage = 0;
    companyId = "";
    updatedAt = new Date();
    default = false;
    taxType = "" //empty when its not tax Group 
    taxes:any[] = []; //empty when its not tax Group
    /**
     * 
     * [
  {
    "taxId": "acc4b804-4f36-43f3-8cca-9b0a14756e35",
    "taxPercentage": 10
  },
  {
    "taxId": "c22e0f9d-d8a0-49ef-a62b-11e8c5ddbaf5",
    "taxPercentage": 5
  }
]
     *
     */
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    calculateTaxPercentage() {
        let total = 0;
        if (this.taxes.length > 0) {
            this.taxes.forEach((element: any) => {

                total += element.taxPercentage
            });

            this.taxPercentage = total
        }
    }

    salesReportTaxes() {
        return [
            {
                boxNo: '2',
                Description: "Sales to registered taxpayers in other GCC State",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            },
            {
                boxNo: '3',
                Description: "Sales subject to domestic reverse charge mechanism",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            }, {
                boxNo: '5',
                Description: "Exports",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            }
        ]
    }

    purchaseReportTaxes() {
        return [
          
            {
                boxNo: '10',
                Description: "Imports subject to Vat deferral at customs",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            }
        ]
    }

    netVATDue() {
        return [
            {
                boxNo: '15',
                Description: "Total VAT due for current period",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            },
            {
                boxNo: '16',
                Description: "Corrections from previous period (between BHD ±5000)",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            },
            {
                boxNo: '17',
                Description: "Vat credit carried forward from previous period(s)",
                Total: 0,
                Adjusments: 0,
                vatTotal: 0
            }
        ]
    }
}

