import { body } from "express-validator";

import { BrandValdation } from "@src/validationSchema/admin/brand.Schema";
import { ValidateReq } from "@src/validationSchema/validator";

export class BranchValdation {
  //TODO: ADD TO LOCATION VALIDATION 
  static branchLocation={
    type:"object", 
    properties:{
      lat:{type:"string"  , transform: ["trim"], "isNotEmpty": true},
      lng:{type:"string"  , transform: ["trim"], "isNotEmpty": true}
    },
    required: ["lat","lng"],
    additionalProperties: true,
    errorMessage: {
      properties: {
        lat: "lat Must Be String",
        lng: "lng Must Be String",
     
      },
      required: {
        lat: "lat is Required",
        lng: "lng is Required",
 
      },
    }
   }
  
 static branchSchema={
  type:"object", 
  properties:{
    name:{type:"string"  , transform: ["trim"], "isNotEmpty": true},
    address:{type:"string"},//TODO: NOT NULL
    location:{type:["object"]},//TODO: NULL OR NOT EMPTY OBJECT 
    //TODO:workingHours null or not empty object 

  },
  required: ["name","address"],
  additionalProperties: true,
  errorMessage: {
    properties: {
      name: "name Must Be String",
      address: "cost Must Be String",
      companyId: "companyId Must Be String",
    },
    required: {
      name: "name is Required",
      address: "address is Required",
      companyId: "companyId is Required",
    },
  }
 }

 public static async branchValidation (data:any){

    return await ValidateReq.reqValidate(BranchValdation.branchSchema,data);

 }

 public static async branchEcommerceSettingsValidation (data:any){
   const deliverySchema = {
    type:"object", 
    properties:{
      active:{type:'boolean' },
      pauseUntil:{type: ['string','null']},
      lastUpdated:{type:['string','null']},
      employeeId:{type:['string','null'] },
    },
    required: ["active","pauseUntil","lastUpdated","employeeId"],
    errorMessage: {
      properties: {
 
        active: "active Must Be Boolean",
        pauseUntil: "pauseUntil Must Be string",
        lastUpdated: "lastUpdated Must Be string",
        employeeId: "employeeId Must Be string",
      },
      required: {
        active: "active is Required",
        pauseUntil: "pauseUntil is Required",
        lastUpdated: "lastUpdated is Required",
        employeeId: "employeeId is Required",
         
      },
  }

   }

   const pickUpSchema = {
    type:"object", 
    properties:{
      active:{type:'boolean' },
      pauseUntil:{type: ['string','null']},
      lastUpdated:{type:['string','null']},
      employeeId:{type:['string','null'] },
    },
    required: ["active","pauseUntil","lastUpdated","employeeId"],
    errorMessage: {
      properties: {
 
        active: "active Must Be Boolean",
        pauseUntil: "pauseUntil Must Be string",
        lastUpdated: "lastUpdated Must Be string",
        employeeId: "employeeId Must Be string",
      },
      required: {
        active: "active is Required",
        pauseUntil: "pauseUntil is Required",
        lastUpdated: "lastUpdated is Required",
        employeeId: "employeeId is Required",
         
      },
  }
   }
  const schema={
    type:"object", 
    properties:{
      delivery:deliverySchema,
      pickUp:pickUpSchema
    },
    required: ["pickUp","delivery"],
    additionalProperties: true,
    errorMessage: {
        properties: {
   
          delivery: "delivery Must Be object",
            pickUp: "pickUp Must Be object"
        },
        required: {
            email: "delivery is Required",
            password: "pickUp is Required"
        },
    }
   }

return await ValidateReq.reqValidate(schema,data);  

}


public static async branchLocationValidation (data:any){


  const location = {
   type:"object", 
   properties:{
     lat:{type: ['string','number']},
     lng:{type:['string','number']},
   
   },
   required: ["lat","lng"],
   errorMessage: {
     properties: {

      lat: "lat Must Be string",
      lng: "lng Must Be string",
   
     },
     required: {
      lat: "lat is Required",
      lng: "lng is Required",
  
        
     },
 }
  }
 const schema={
   type:"object", 
   properties:{
     branchId:{type:'string'},
     location:location
   },
   required: ["branchId","location"],
   additionalProperties: true,
   errorMessage: {
       properties: {
  
        branchId: "branchId Must Be string",
        location: "location Must Be object"
       },
       required: {
        branchId: "branchId is Required",
        location: "location is Required"
       },
   }
  }

return await ValidateReq.reqValidate(schema,data);  

}

public static async companyZonesValidation(data:any){


  const zoneSchema = {
   type:"object", 
   properties:{
    radius:{type: ['number']},
    deliveryCharge:{type:['number','null']},
    minimumCharge:{type:['number','null']},
   
   },
   required: ["radius"],
   errorMessage: {
     properties: {

      radius: "radius Must Be number",
      deliveryCharge: "deliveryCharge Must Be number",
      minimumCharge: "minimumCharge Must Be number",

     },
     required: {
      radius: "radius is Required"
  
        
     },
 }
  }
 const schema={
   type:"object", 
   properties:{
    coveredZones:{type:'array',items:zoneSchema},

   },
   required: ["coveredZones"],
   additionalProperties: true,
   errorMessage: {
       properties: {
  
        coveredZones: "coveredZones Must Be array",

       },
       required: {
        coveredZones: "coveredZones is Required"
  
       },
   }
  }

return await ValidateReq.reqValidate(schema,data);  

}
}
