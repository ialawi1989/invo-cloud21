import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { Product } from "@src/models/product/Product";
import { integer } from "aws-sdk/clients/cloudfront";

const axios = require('axios');
const { authorize } = require('passport');

//trandData of request  
class JCategory{
    category_id: string = "";
    name: { ar: string; en: string } = { ar: "", en: "" };
    index: integer = 0;
    exclude_branches: string[] = []
}


export class jahezCategory {

  ApiKey ='';
  Authorization='';
  

  baseUrl() {
    return "https://integration-api-sandbox.jahez.net";
  }

  public async createCategory(categoryData: any, company: Company) {
    try {

      let category = new JCategory()

      

      category.category_id = categoryData .id
      category.index = categoryData.index
      category.exclude_branches = categoryData.exclude_branches ? categoryData.exclude_branches : []

      category.name.en = categoryData.name
      if(Object.keys(categoryData.translation).length > 0 && categoryData.translation.hasOwnProperty('name')){
        category.name.ar = (categoryData.translation as any).name.ar ? (categoryData.translation as any).name.ar  :""
      }

      
      

      let config = {
        method: 'POST',
        url: this.baseUrl() + '/categories/category',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: category

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

  public async uploadCategories(categories: any[], company: Company) {
    try {
      let categoryList: JCategory[] = [];

      for (const category of categories) {
        
        let tempCategory = new JCategory()

        tempCategory.category_id = category .id
        tempCategory.index = category.index
        tempCategory.exclude_branches = category.exclude_branches ? category.exclude_branches : []

        tempCategory.name.en = category.name
        if(Object.keys(category.translation).length > 0 && category.translation.hasOwnProperty('name')){
            tempCategory.name.ar = (category.translation as any).name.ar ? (category.translation as any).name.ar  :""
        }
      
        categoryList.push(tempCategory)
      }


      let config = {
        method: 'post',
        url: this.baseUrl() + '/categories/categories_upload',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: categoryList

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

  public async getCategory(categoryId: string) {
    try {
      let config = {
        method: 'GET',
        url: this.baseUrl() + '/categories/category' + categoryId,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "Get Category Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {

      throw new Error(error)
    }

  }

  public async deleteCategory(categoryId: string) {
    try {
      let config = {
        method: 'DELETE',
        url: this.baseUrl() + '/categories/category/' + categoryId,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "The categpry deleted Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {
      throw new Error(error)
    }

  }

  public async hideAllCategories(branch_id: string) {
    try {
      let config = {
        method: 'POST',
        url: this.baseUrl() + '/categories/hide_all/' + branch_id,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: {}
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


}