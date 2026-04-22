


import { InvokeCommand,LambdaClient } from "@aws-sdk/client-lambda";
import { ResponseData } from "@src/models/ResponseData";
import { LambdaService } from "@src/AWS-SERVICES/lambdaService";

export class AWSLambda{


    public static async sendPdfEmial(payload:any){
        try {
            let awsInstance = new  LambdaService()

            const command = new InvokeCommand({
                FunctionName: "pdf-create-file",
                Payload: JSON.stringify(payload),
          
              });
            
              const { Payload, LogResult } = await awsInstance.lambda.send(command);
              if(Payload && !payload.isEmail){
                const result = JSON.parse(Buffer.from(Payload).toString());
                if(result.errorType && result.errorType!="")
                {
                  throw new Error(result.errorMessage)
                }
                return JSON.parse(result)
              }else{
                return new ResponseData(true,"",[])
              }
      
        } catch (error:any) {
            console.log(error)

            throw new Error(error)
        }
    }
}