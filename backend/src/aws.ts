import { S3 } from "@aws-sdk/client-s3"
import { SNSClient  } from "@aws-sdk/client-sns";
import { SESClient } from "@aws-sdk/client-ses";
import { Lambda } from "@aws-sdk/client-lambda";
let instance: AWSService;


export class AWSService {

    s3: S3// FOR STORAGE  
    snsClient: SNSClient // FOR SMS
    sesClint:SESClient // FOR EMIAL 
    lambda:Lambda
    constructor() {
        
        this.s3 = new S3({
            
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY ? process.env.AWS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? process.env.AWS_SECRET_ACCESS_KEY : ""
            }
        });

        this.snsClient = new SNSClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        })

        this.sesClint = new SESClient({
            region:  process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        })

        this.lambda = new Lambda({
            region:  process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        })

    }

    public static getInstinse() {
        if (!instance) {
            instance = new AWSService();
        }
        return instance;
    }



}