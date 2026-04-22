export class OpenOrders {
    id: string = "";
    createdAt: Date = new Date();
    invoiceNumber: string = "";
    serviceName: string = "";
    total: number = 0;
  
    constructor() {}
  
    toMap(): { [key: string]: any } {
      return {
        id: this.id,
        createdAt: this.createdAt.getTime(),
        invoiceNumber: this.invoiceNumber,
        serviceName: this.serviceName,
        total: this.total,
      };
    }
  
    static fromMap(map: { [key: string]: any }): OpenOrders {
      const openOrders = new OpenOrders();
      openOrders.id = map.id;
      openOrders.createdAt = new Date(map.createdAt);
      openOrders.invoiceNumber = map.invoiceNumber || "";
      openOrders.serviceName = map.serviceName;
      openOrders.total = parseFloat(map.total.toString());
      return openOrders;
    }
  
    static fromJson(json: { [key: string]: any }): OpenOrders {
      const openOrders = new OpenOrders();
      openOrders.id = json.id;
      openOrders.createdAt = new Date(json.createdAt);
      openOrders.invoiceNumber = json.invoiceNumber;
      openOrders.serviceName = json.serviceName;
      openOrders.total = parseFloat(json.total);
      return openOrders;
    }
  }