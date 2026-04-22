import { Lambda } from "@aws-sdk/client-lambda";
export class LambdaService{
   
    lambda:Lambda
    constructor(){
        
        this.lambda = new Lambda({
            region: "me-south-1",
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        })
    }
}