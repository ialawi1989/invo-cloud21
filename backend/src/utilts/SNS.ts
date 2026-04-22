import { ResponseData } from "@src/models/ResponseData";

import { PublishCommand  } from "@aws-sdk/client-sns";
import { SNSService } from "@src/AWS-SERVICES/snsService";
export class SnsService {
    
    message= "";
    phoneNumber = "";
    //Testing Send SMS DELETED IT 
    public  async sendSms() {
        
        let awsInstant = new SNSService()
        try {

            const params = {
                Message: this.message,
                PhoneNumber: this.phoneNumber, // Replace with the phone number you want to send the message to
            };
            let command = await this.getCommand(params)
            let t= await awsInstant.snsClient.send(command)
            console.log(t)
            
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
          
            awsInstant.snsClient.destroy();

            throw new Error(error)
        }
    }

    public  async getCommand(params:any)
    {
        return new PublishCommand(params)
    }
}