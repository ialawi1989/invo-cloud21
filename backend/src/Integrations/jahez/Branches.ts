import { ResponseData } from "@src/models/ResponseData";
import { Branches } from "@src/models/admin/Branches";
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

class JBranch{
    branch_id: string = "";
    name: { ar: string; en: string } = { ar: "", en: "" };
    address: string = "";
    coordination: Number[] | null = []
}


export class jahezBranch {

  ApiKey = "";
  Authorization = "";

  baseUrl() {
    return "https://integration-api-sandbox.jahez.net";
  }

  public async createBranch(BranchData: any, company: Company) {
    try {

      let Branch = new JBranch()

      Branch.branch_id = BranchData.id

      Branch.name.en = BranchData.name
      if(BranchData.translation && Object.keys(BranchData.translation).length > 0 && BranchData.translation.hasOwnProperty('name')){
        Branch.name.ar = (BranchData.translation as any).name.ar ? (BranchData.translation as any).name.ar  :""
      }

      Branch.address = BranchData.address ?  BranchData.address :""
      if (BranchData.location && BranchData.location.hasOwnProperty('lat') && BranchData.location.hasOwnProperty('lang')){
        Branch.coordination?.push(BranchData.location.lat)
        Branch.coordination?.push(BranchData.location.lang)
      }

      
      
      let config = {
        method: 'POST',
        url: this.baseUrl() + '/categories/category',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: Branch

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

  public async uploadBranches(branches: any[], company: Company) {
    try {
      let branchesList: JBranch[] = [];



      for (const BranchData of branches) {
        
        let branch = new JBranch()

        branch.branch_id = BranchData.id
  
        branch.name.en = BranchData.name
        if(BranchData.translation && Object.keys(BranchData.translation).length > 0 && BranchData.translation.hasOwnProperty('name')){
            branch.name.ar = (BranchData.translation as any).name.ar ? (BranchData.translation as any).name.ar  :""
        }
  
        branch.address = BranchData.address ?  BranchData.address :""
        if (BranchData.location && BranchData.location.hasOwnProperty('lat') && BranchData.location.hasOwnProperty('lang')){
            branch.coordination?.push(BranchData.location.lat)
            branch.coordination?.push(BranchData.location.lang)
        }
        
        branchesList.push(branch)
      }
      


      let config = {
        method: 'post',
        url: this.baseUrl() + '/categories/categories_upload',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: branchesList

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

  public async getBranch(branchId: string) {
    try {
      let config = {
        method: 'GET',
        url: this.baseUrl() + '/branches/branch/' + branchId,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "Get Branch Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {

      throw new Error(error)
    }

  }

  public async deleteBranch(branchId: string) {
    try {
      let config = {
        method: 'DELETE',
        url: this.baseUrl() + '/branches/branch/' + branchId,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
      };

      let response = (await axios(config)).data

      if (response.success == true) {
        return new ResponseData(true, "The branch deleted Successfully", {})
      } else {
        return new ResponseData(false, response.error + " " + response.errorText, {})
      }
    } catch (error: any) {
      throw new Error(error)
    }

  }

  public async hideBranches(branchId: string, is_visible: boolean) {
    try {
      let config = {
        method: 'POST',
        url: this.baseUrl() + '/branches/visibility' ,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.Authorization,
          'x-api-key': this.ApiKey
        },
        data: {"is_visible": is_visible, "branch_id": branchId}
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