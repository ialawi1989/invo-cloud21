import { SESClient } from "@aws-sdk/client-ses";
export class SESService{
    sesClint:SESClient // FOR EMIAL 

    constructor() {
        
        this.sesClint= new SESClient({
            region:  process.env.AWS_REGION ,
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY ? process.env.AWS_SNS_ACCESS_KEY : "",
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY ? process.env.AWS_SNS_SECRET_ACCESS_KEY : ""
            }
        })

   

    }
}