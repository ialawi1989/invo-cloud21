export class ServiceDetails {
    serviceName: string = "";
    totalSales: number = 0;
    totalReturns: number = 0;
    salesQty: number = 0;
    returnQty: number = 0;
    numberOfInvoices:  number = 0;
  
    constructor() {}
  
    toMap(): { [key: string]: any } {
      return {
        serviceName: this.serviceName,
        totalSales: this.totalSales,
        totalReturns: this.totalReturns,
      };
    }
  
    static fromMap(map: { [key: string]: any }): ServiceDetails {
      const serviceDetails = new ServiceDetails();
      serviceDetails.serviceName = map.serviceName;
      serviceDetails.totalSales = parseFloat(map.totalSales);
      serviceDetails.totalReturns = parseFloat(map.totalReturns);
      serviceDetails.salesQty = parseFloat(map.salesQty);
      serviceDetails.returnQty = parseFloat(map.returnQty);
      serviceDetails.numberOfInvoices = parseFloat(map.numberOfInvoices);
    

      return serviceDetails;
    }
  
    static fromJson(json: { [key: string]: any }): ServiceDetails {
      const serviceDetails = new ServiceDetails();
      serviceDetails.serviceName = json.serviceName;
      serviceDetails.totalSales = parseFloat(json.totalSales);
      serviceDetails.totalReturns = parseFloat(json.totalReturns);
      return serviceDetails;
    }
  }