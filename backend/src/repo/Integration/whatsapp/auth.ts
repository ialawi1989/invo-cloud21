import { DB } from "../../../dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";


import moment from "moment-timezone";

import { Company } from "@src/models/admin/company";
import { PluginRepo} from "@src/repo/app/accounts/plugin.repo"


import { whatsAppCompany } from "@src/Integrations/whatsapp/Company";
import { Plugin } from "@src/models/account/Plugin";
import { WhatsAppSetting } from "@src/models/account/Plugin";
import crypto from "crypto-js"



export class WhatsAppAuthRepo {
  
    public static async login(data:any, company: Company) {
        

      try {
        
        const userName = data.userName
        const password = data.password
        
        const token = Buffer.from(`${userName}:${password}`, 'utf8').toString('base64')

        const bb = await whatsAppCompany.CompanyPrefrences(token,company)

        if (!bb.success){
            throw("Invalid User Name or Password")
        }
       
        let pluginData =  {"pluginName": "Whatsapp", 
                           "settings" : {"userName": data.userName, "Password":data.password , "enable": true}
                            }

        let plugin = new Plugin()
        plugin.pluginName = "whatsApp"
        plugin.type = "WhatsApp"
        const setting = new WhatsAppSetting();
        setting.userName =  data.userName
        setting.password = crypto.AES.encrypt(password, company.id).toString() 
        plugin.settings  = setting

        
        let resault = await PluginRepo.savePlugin(plugin,company)
        
      
        if(resault.success){ 
            return new ResponseData(true,resault.msg,{});
        }
        else {
            return  resault
        }

      } catch (error: any) {
       
      
        throw new Error(error.message)
      }
    }


    public static async getCredential( PluginName: string, company: Company) {
        

        try {
          
          
          const query = `SELECT settings ->>'userName' AS userName, 
                                settings->>'password' AS password 
                        FROM "Plugins" 
                        where  "companyId"= $1 and lower("pluginName") = lower($2)` ;
         const Data = [company.id, PluginName] ;
         const g= await DB.excu.query(query,Data);

         return g.rows[0]; 

  
        } catch (error: any) {
         
        
          throw new Error(error.message)
        }
      }

    
  
  }
