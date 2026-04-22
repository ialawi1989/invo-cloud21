import { ResponseData } from "@src/models/ResponseData";
import { Branches } from "@src/models/admin/Branches";
import { Company } from "@src/models/admin/company";
import { integer } from "aws-sdk/clients/cloudfront";
import axios from "axios"

class coveredAddress{
      address:string = ""
      minimumOrder:integer =  0
      deliveryCharge: integer = 0
}
class Whatsappbranch{
    id: string ="";
    merchant_id : string = "";
    merchant_name: string = "";
    name    : string = "";
    address : string | null = "";
    location: {latitude:number|undefined,longitude:number |undefined} | null = {latitude: undefined,longitude: undefined};
    phone   : string |null = "null" ;
    isInclusiveTax : boolean = false;
    coveredAddressesType : string = "";
    coveredAddresses : coveredAddress[] |null =[];
}


export class BranchR{

    private static Username = "invopos9001";
    private static  Password = "nhJQNTYkULljydHdWS3aAN73DSOwaN";
    static token = Buffer.from(`${this.Username}:${this.Password}`, 'utf8').toString('base64')

    static baseUrl() {
        return "https://api-test.convobot360.com/v1";
    }



    public static async addBranch (branch:any,company:Company,token:string) {
        try {

            let branchData = new Whatsappbranch()
            //branch Data 
            branchData.id           = branch.id
            branchData.merchant_id  = branch.companyId
            branchData.merchant_name = branch.merchantName
            branchData.name         = branch.name
            branchData.address      = branch.address
            branchData.isInclusiveTax = company.isInclusiveTax
            branchData.coveredAddresses = []
            branchData.coveredAddressesType = branch.coveredAddresses && branch.coveredAddresses.hasOwnProperty('type') ? branch.coveredAddresses.type : ""
            
            if (branch.location == null || Object.keys(branch.location).length == 0){
                branchData.location    = null;
            }else{
                if(branch.location.hasOwnProperty('lat') && branch.location.hasOwnProperty('lang') && branchData.location){
                   branchData.location.latitude =  branch.location.lat
                    branchData.location.longitude = branch.location.lang
                } else{
                    branchData.location = null
                }
            }

            for(const add of branch.coveredAddresses.coveredAddresses){

                let tempaddress = new coveredAddress()
                
                if(add.showInSearch){
                    tempaddress.address = add.address
                    tempaddress.deliveryCharge = add.deliveryCharge
                    tempaddress.minimumOrder = add.minimumOrder
                    branchData.coveredAddresses.push(tempaddress)
                }
            }


            branchData.location = {latitude: 26.2347703, longitude:50.580224}
            branchData.phone        = branch.phoneNumber

           
            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/branch',
                data: JSON.stringify(branchData),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${token}`
                }
            }

            let response = (await axios(config))

            if (response.data.status_code == 200) {
                return new ResponseData(true, "", response.data.detail)
            } else {
                return new ResponseData(false, "Invalid Input", response.data.detail)
            }
            
        } catch (error: any) {
            if(error.response.data){
               return new ResponseData(false,error.message, error.response.data ) 
            }
            else {
                return new  ResponseData(false,"",error.message ) 
            }
            
        }

    }

    public static async branchVisiblities(branchId:string,status: string, company:Company) {
        try {

            const data = {"branchId": branchId, "status": status}


            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/branch',
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${this.token}`
                }
            }

            let response = (await axios(config)).data

            if (response.status_code == 200 ) {
                return new ResponseData(true, "", response)
            } else {
                return new ResponseData(false, response.error + " " + response.errorText, {})
            }
        } catch (error: any) {
            return new ResponseData(false, "", error.message)
        }

    }


}
  