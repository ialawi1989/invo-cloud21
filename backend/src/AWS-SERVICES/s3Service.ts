
import { S3 } from "@aws-sdk/client-s3";

export class S3Service {
    private static s3Instance: S3;


    constructor() {

    }

    public static getClient(): S3 {
        if (!this.s3Instance) {
            try {
                this.s3Instance = new S3({
                    region: process.env.AWS_REGION || "me-south-1",
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY || "",
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
                    }
                });
            } catch (error) {

            }

        }
        return this.s3Instance;
    }
}
export async function safeS3Call(promise: Promise<any>, timeout = 2000) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("S3 timeout")), timeout)
        )
    ]);
}