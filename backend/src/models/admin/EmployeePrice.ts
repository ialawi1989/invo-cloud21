export class EmployeePrice {
    id  = "";
    productId = "";
    price = 0;
    serviceTime = 0;
    employeeId = "";
    companyId = "";
    createdAt = new Date();
    updatedDate= new Date();
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}