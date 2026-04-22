// import { Brands } from "@src/models/admin/Brands";
// import { ResponseData } from "@src/models/ResponseData";

// import { BrandValdation } from "@src/validationSchema/admin/brand.Schema";
// import { Request, Response, NextFunction } from 'express';
// export class BrandController{
//     public static async getAllBrand(req:Request,res:Response, next:NextFunction){
//         try {
//             const companyId = req.params['companyId']; 
//             const brands = await BrandsRepo.getAllCompanyBrands(companyId);
//             return res.send(brands)
       
//         } catch (error:any) {
//             return  res.send(new ResponseData(false,error.message,[]))   
//         }
//     }

//     public static async AddBrand(req:Request,res:Response, next:NextFunction){
//         try {

//             const add = await BrandsRepo.InsertBrands(req.body);
//             return res.send(add)    
//         } catch (error:any) {
//             return  res.send(new ResponseData(false,error.message,[]))     
//         }
//     }

//     public static async EditBrand(req:Request,res:Response, next:NextFunction){
//         try {
         
//             const edit = await BrandsRepo.EditBrand(req.body)
//             return res.send(edit)
//         } catch (error:any) {
      
//             return  res.send(new ResponseData(false,error.message,[]))   
//         }
//     }

//     public static async GetBrandById(req:Request,res:Response, next:NextFunction){
        
//         try {
//             const brandId = req.params['brandId'];
//             const companyId = req.params['companyId']; 
//             const brand = await BrandsRepo.getBrandsById(brandId,companyId);
//             return res.send(brand);
//         } catch (error:any) {
//             return  res.send(new ResponseData(false,error.message,[]))     
//         }
//     }
// }