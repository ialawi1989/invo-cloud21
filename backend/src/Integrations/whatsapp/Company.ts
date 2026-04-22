import { DB } from "@src/dbconnection/dbconnection";
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
class WhatsappCompany{
    
    merchant_id : string = "";
    merchant_name: string = "";
    is_tax_inclusive   : boolean = false
    merchant_order_endpoint : string = ""
}


export class whatsAppCompany{

    // private static Username = "invopos9001";
    // private static  Password = "nhJQNTYkULljydHdWS3aAN73DSOwaN";
    // static token = Buffer.from(`${this.Username}:${this.Password}`, 'utf8').toString('base64')

    static baseUrl() {
        return "https://api-test.convobot360.com/v1";
    }

    public static async getCompanyData(companyId: string) {
        try {

            const query : { text: string, values: any } = {
                text: 'SELECT name, "isInclusiveTax" FROM "Companies" WHERE id=($1)',
                values: [companyId],
            }

            const company = (await DB.excu.query(query.text, query.values));

            if(company.rows.length > 0){
                return new ResponseData(true, "", company.rows[0])
            }else{
                return new ResponseData(false, "No Company with this Id",{})
            }
           
            

        } catch (error: any) {
            throw new Error(error.message)
        }
    }



    public static async CompanyPrefrences(token:any,company:Company) {
        try {

            let companyInfo = new WhatsappCompany()
            const companyData = (await this.getCompanyData(company.id)).data
            
            //branch Data 

            companyInfo.merchant_id  = company.id
            companyInfo.merchant_name = companyData.name
            companyInfo.is_tax_inclusive   = companyData.isInclusiveTax
            companyInfo.merchant_order_endpoint = "https://c2ff-217-17-240-188.ngrok-free.app/v1/ecommerce/"+ companyData.name+"/whatsappOrder/addOrder"


           

            let config = {
                method: 'post',
                url: this.baseUrl() + '/invopos/merchant',
                data: companyInfo,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${token}`
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
  