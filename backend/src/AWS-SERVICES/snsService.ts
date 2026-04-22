import { SNSClient  } from "@aws-sdk/client-sns";
export class SNSService{
    snsClient: SNSClient // FOR SMS
    constructor(){
        this.snsClient = new SNSClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        })
    }
}