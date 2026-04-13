// Dashboard-specific model for business summary widget

export class SalesSummaryRowModel {
  branchId: string = "";
  branchName: string = "";
  numberOfInvoices: number = 0;
  sales: number = 0;
  discountTotal: number = 0;
  taxTotal: number = 0;
  total: number = 0;
  totalReturn: number = 0;
  netSales: number = 0;
  percentage: any = 0.0;
  chartVariant: string = "";
  get avgSales(): number {
    return this.numberOfInvoices > 0
      ? this.sales / this.numberOfInvoices
      : 0;
  }

  parseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
