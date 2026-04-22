
export class SalesDetails {
    totalSales: number = 0;
    itemDiscount: number = 0;
    netSales: number = 0;
    taxTotal: number = 0;
    salesDate: Date = new Date();
  
    constructor() {}
  
    toMap(): { [key: string]: any } {
      return {
        totalSales: this.totalSales,
        itemDiscount: this.itemDiscount,
        netSales: this.netSales,
        taxTotal: this.taxTotal,
        salesDate: this.salesDate.getTime(),
      };
    }
  
    static fromMap(map: { [key: string]: any }): SalesDetails {
      const salesDetails = new SalesDetails();
      salesDetails.totalSales = parseFloat(map.totalSales.toString());
      salesDetails.itemDiscount = parseFloat(map.itemDiscount.toString());
      salesDetails.netSales = parseFloat(map.netSales.toString());
      salesDetails.taxTotal = parseFloat(map.taxTotal.toString());
      salesDetails.salesDate = new Date(map.salesDate);
      return salesDetails;
    }
  
    static fromJson(json: { [key: string]: any }): SalesDetails {
      const salesDetails = new SalesDetails();
      salesDetails.totalSales = parseFloat(json.totalSales);
      salesDetails.itemDiscount = parseFloat(json.itemDiscount);
      salesDetails.netSales = parseFloat(json.netSales);
      salesDetails.taxTotal = parseFloat(json.taxTotal);
      salesDetails.salesDate = new Date(json.salesDate);
      return salesDetails;
    }
  }