'use strict';

import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { Product } from "@src/models/product/Product";
import { integer } from "aws-sdk/clients/cloudfront";

import { double } from "aws-sdk/clients/lightsail";

const axios = require('axios');
const { authorize } = require('passport');

//trandData of request  
class option {
  id: string = "";
  price: double = 0.0;
  calories: integer | null = null;
  nameAr: string = "";
  nameEn: string = "";
}

class modefier {
  id: string = "";
  is_radio: boolean = false;
  is_multiple: boolean = false;
  max_option: integer = 0;
  min_option: integer = 0;
  name: { ar: string; en: string } = { ar: "", en: "" };
  options: option[] = [];
}


class JProduct {
  product_id: string = "";
  product_price: double = 0.0;
  is_visible: boolean = true;
  index: integer | null = null;

  calories: integer | null = null;
  image_path: string | null = null;
  category_id: String | null = null;

  name: { ar: string; en: string } = { ar: "", en: "" };
  description: { ar: string; en: string } = { ar: "", en: "" };

  exclude_branches: string[] = [];
  modifiers: modefier[] = [];
  availability = {
    "saturday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    },
    "monday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    },
    "tuesday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    },
    "wednesday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    },
    "thursday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    },
    "friday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    },
    "sunday": {
      "is_visible": true,
      "times": [
        {
          "start": "00:00",
          "end": "23:59"
        }
      ]
    }
  }

}


export class jahezProduct {

  ApiKey = "";
  Authorization = "";
  

  baseUrl() {
    return "https://integration-api-sandbox.jahez.net";
  }

  public async createProduct(productData: any, company: Company) {
    try {

      let product = new JProduct()
    
      product.name.en = productData.name
      product.product_id = productData.id
      product.product_price = productData.defaultPrice
      product.description.en = productData.description
      product.category_id = productData.categoryId == undefined ? null : productData.categoryId

      if (Object.keys(productData.translation).length == 0) {
        product.name.ar = "";
        product.description.ar = "";
      } else {
        if (productData.translation.hasOwnProperty('name')) {
          product.name.ar = (productData.translation as any).name.ar ? (productData.translation as any).name.ar : "";
        }
        if (productData.translation.hasOwnProperty('description')) {
          product.description.ar = (productData.translation as any).description.ar ? (productData.translation as any).description.ar : "";
        }
      }

      for (const branch of productData.branches){
        if (branch.available == false){product.exclude_branches.push(branch.branchId)}

      }

      product.image_path = productData.imageUrl
      product.is_visible = productData.isDeleted ? false : true

      for (const optionGroup of productData.optionGroups) {
        var optionGrouptemp = new modefier();
        optionGrouptemp.id = optionGroup.optionGroupId;
        optionGrouptemp.is_multiple = true;
        optionGrouptemp.is_radio = optionGroup.maxSelectable == 1 ? true : false
        optionGrouptemp.max_option = optionGroup.maxSelectable
        optionGrouptemp.min_option = optionGroup.minSelectable
        optionGrouptemp.name.en = optionGroup.title

        if (optionGroup.translation && Object.keys(optionGroup.translation).length > 0 && optionGroup.translation.hasOwnProperty('name')) {
          optionGrouptemp.name.ar = (optionGroup.translation as any).name.ar ? (optionGroup.translation as any).name.ar : "";
        }
        for (const opt of optionGroup.options){
          let optiontemp = new option();
          optiontemp.id = opt.optionId
          optiontemp.price = opt.price
          optiontemp.nameEn = opt.name
          optiontemp.nameAr = (opt.translation && Object.keys(opt.translation).length > 0 && opt.translation.hasOwnProperty('name') )? opt.translation.name.ar :""
          optionGrouptemp.options.push(optiontemp)
        }
        

        product.modifiers.push(optionGrouptemp)
      }

      let config = {
        method: 'post',
        url: this.baseUrl() + '/products/products_upload',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: product

      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }


    } catch (error: any) {

      throw new Error(error)
    }


  }


  public async createProducts(products: any[], company: Company) {
    try {
      let ProductList: JProduct[] = [];

      for (const productData of products) {

        let product = new JProduct()
    
        product.name.en = productData.name
        product.product_id = productData.id
        product.product_price = productData.defaultPrice
        product.description.en = productData.description
        product.category_id = productData.categoryId == undefined ? null : productData.categoryId

        if (Object.keys(productData.translation).length == 0) {
          product.name.ar = "";
          product.description.ar = "";
        } else {
          if (productData.translation.hasOwnProperty('name')) {
            product.name.ar = (productData.translation as any).name.ar ? (productData.translation as any).name.ar : "";
          }
          if (productData.translation.hasOwnProperty('description')) {
            product.description.ar = (productData.translation as any).description.ar ? (productData.translation as any).description.ar : "";
          }
        }

        for (const branch of productData.branches){
          if (branch.available == false){product.exclude_branches.push(branch.branchId)}

        }

        product.image_path = productData.imageUrl
        product.is_visible = productData.isDeleted ? false : true

        for (const optionGroup of productData.optionGroups) {
          var optionGrouptemp = new modefier();
          optionGrouptemp.id = optionGroup.optionGroupId;
          optionGrouptemp.is_multiple = true;
          optionGrouptemp.is_radio = optionGroup.maxSelectable == 1 ? true : false
          optionGrouptemp.max_option = optionGroup.maxSelectable
          optionGrouptemp.min_option = optionGroup.minSelectable
          optionGrouptemp.name.en = optionGroup.title

          if (optionGroup.translation && Object.keys(optionGroup.translation).length > 0 && optionGroup.translation.hasOwnProperty('name')) {
            optionGrouptemp.name.ar = (optionGroup.translation as any).name.ar ? (optionGroup.translation as any).name.ar : "";
          }
          for (const opt of optionGroup.options){
            let optiontemp = new option();
            optiontemp.id = opt.optionId
            optiontemp.price = opt.price
            optiontemp.nameEn = opt.name
            optiontemp.nameAr = (opt.translation && Object.keys(opt.translation).length > 0 && opt.translation.hasOwnProperty('name') )? opt.translation.name.ar :""
            optionGrouptemp.options.push(optiontemp)
          }
          

          product.modifiers.push(optionGrouptemp)
        }


        ProductList.push(product)
      }


      let config = {
        method: 'post',
        url: this.baseUrl() + '/products/products_upload',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: ProductList

      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }


    } catch (error: any) {

      throw new Error(error)
    }


  }

  public async getProduct(productId: string) {
    try {
      let config = {
        method: 'GET',
        url: this.baseUrl() + '/products/product/' + productId,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "Get Product Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {

      throw new Error(error)
    }

  }

  public async deleteProduct(productId: string) {
    try {
      let config = {
        method: 'DELETE',
        url: this.baseUrl() + '/products/product/' + productId,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "The product deleted Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {
      throw new Error(error)
    }

  }

  public async ProductVisibility(product: any) {
    try {

      let is_visibile: boolean = product.isDeleted ? false : true
      let exclude_branches: string[] = product.exclude_branches ? product.exclude_branches : []

      let config = {
        method: 'DELETE',
        url: this.baseUrl() + '/products/product/' + product.id,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: { "is_visibile": is_visibile, "exclude_branches": exclude_branches }
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "The product deleted Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {
      throw new Error(error)
    }

  }

  public async hideAllProducts(branch_id: string) {
    try {
      let config = {
        method: 'POST',
        url: this.baseUrl() + '/products//hide_all/' + branch_id,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: {}
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "The product deleted Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {
      throw new Error(error)
    }

  }


}






