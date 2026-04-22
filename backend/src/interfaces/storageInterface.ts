export interface Storage{
    checkIfItemImageExist(companyId:string,productId:string):Promise<any>;
    saveItemImage (image:string,companyId:string,productId:string):Promise<any>;
    getItemImage (companyId:string,productId:string) : Promise<any>;
    getItemImageBase64(companyId:string,productId:string): Promise<any>;

    checkIfEmployeeImageExist(companyId:string,employeeId:string):Promise<any>;
    saveEmployeeImage (image:string,companyId:string,employeeId:string):Promise<any>;
    getemployeeImage (companyId:string,employeeId:string) : Promise<any>;
    getEmployeeImageBase64(companyId:string,employeeId:string): Promise<any>;
}