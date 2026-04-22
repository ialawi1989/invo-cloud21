export class CategoryDetails {
    departmentName: string = '';
    categoryName: string = '';
    totalSales: number = 0;
    totalReturns: number = 0;
    salesQty: number = 0;
    returnQty: number = 0;
  
    constructor() {}
  
    toMap(): { [key: string]: any } {
      return {
        departmentName: this.departmentName,
        categoryName: this.categoryName,
        totalSales: this.totalSales,
        totalReturns: this.totalReturns,
      };
    }
  
    static fromMap(map: { [key: string]: any }): CategoryDetails {
      const categoryDetails = new CategoryDetails();
      categoryDetails.departmentName = map.departmentName;
      categoryDetails.categoryName = map.categoryName;
      categoryDetails.totalSales = map.totalSales ?? 0;
      categoryDetails.totalReturns = map.totalReturns ?? 0;
      categoryDetails.salesQty = map.salesQty ?? 0;
      categoryDetails.returnQty = map.returnQty ?? 0;

      return categoryDetails;
    }
  
    static fromJson(json: { [key: string]: any }): CategoryDetails {
      const categoryDetails = new CategoryDetails();
      categoryDetails.departmentName = json.departmentName;
      categoryDetails.categoryName = json.categoryName;
      categoryDetails.totalSales = parseFloat(json.totalSales);
      categoryDetails.totalReturns = parseFloat(json.totalReturns);
      return categoryDetails;
    }
  }