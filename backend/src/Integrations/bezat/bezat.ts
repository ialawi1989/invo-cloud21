import crypto from 'crypto';
import axios from 'axios';
import Client from 'pg';
import { Invoice } from '@src/models/account/Invoice';
import { DB } from '@src/dbconnection/dbconnection';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
const { Logger } = require('aws-cloudwatch-log')


export class bezat {

    static SECRET_KEY = 'D4upvT8yzDXN9bhjXIAWaBwvRahsa9JEWmHyqeuKJC58Q9cfzyuQHP7GuX0XYA55';


    public static generateSecretHash(invoStore: string, timestamp: number): string {
        const data = invoStore + timestamp;

        return crypto.createHmac('sha256', this.SECRET_KEY).update(data).digest('hex');
    }


    async setupNotificationListener() {

        try {
            // Establish the database connection
            const client = await DB.excu.client(0);

            // Set up the listener for 'invoice_paid' notifications
            await client.query('LISTEN invoice_paid');

            client.on('notification', async (msg) => {


                // msg.payload contains the invoice ID
                const invoice = JSON.parse(msg.payload as any);
                console.log('trigger: ',invoice.trigger_name);
                console.log('Received notification for invoice ID:', invoice.transaction_reference );

             let response = await bezat.sendApiRequest(invoice.transaction_amount, invoice.transaction_reference, invoice.phone, invoice.invo_store, invoice.invo_merchant, invoice.name, invoice.id);
                // You can now use the invoiceId to fetch details or trigger actions
                // Example: fetch invoice details from the database or notify other services
            });

            const config = {
                logGroupName: 'bezat',
                logStreamName: 'bezat',
                region: process.env.AWS_REGION,
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
                local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
            }
            const logger = new Logger(config);
            logger.log('Listening for invoice_paid notifications...');


            // Ensure you close the client connection when your application shuts down
            process.on('exit', () => {
                console.log("hereeeeeeeeeeeeeeeee")
                client.release();
            });
        } catch (err) {
            console.error('Error setting up notification listener:', err);
        }
    }







    public static async sendApiRequest(transaction_amount: any, transaction_reference: any, phone: any, invo_store: any, invo_merchant: any, name: any, id:any) {
        const timestamp = Math.floor(Date.now() / 1000);
        const secretHash = this.generateSecretHash(invo_store, timestamp);
      
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const response = await axios.post('https://bezat.io/api/invo', {
                transaction_amount: transaction_amount,
                transaction_reference: transaction_reference,
                phone_code: "+973",
                phone: phone,
                name: name,
                invo_store: invo_store,
                invo_merchant: invo_merchant,
            }, {
                headers: {
                    'Timestamp': timestamp.toString(),
                    'Secret-Hash': secretHash
                }
            });

            if (response.data.success) {


                const config = {
                    logGroupName: 'bezat',
                    logStreamName: 'bezat',
                    region: process.env.AWS_REGION,
                    accessKeyId: process.env.AWS_ACCESS_KEY,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
                    local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
                }
                const logger = new Logger(config);
                logger.log(JSON.stringify({
                    transaction_amount: transaction_amount,
                    transaction_reference: transaction_reference,
                    phone_code: "+973",
                    phone: phone,
                    name: name,
                    invo_store: invo_store,
                    invo_merchant: invo_merchant,
                }));

                InvoiceRepo.setBezatNotifcation(client,id);
                console.log('Success:' + transaction_reference);
            } else {
                const config = {
                    logGroupName: 'bezat',
                    logStreamName: 'bezat-errors',
                    region: process.env.AWS_REGION,
                    accessKeyId: process.env.AWS_ACCESS_KEY,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
                    local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
                }
                const logger = new Logger(config);
                logger.log(transaction_reference + '  Failure:' + response.data.message );
                console.error('Failure:', response.data.message);
          
            }

            await client.query("COMMIT")
        } catch (error) {
            await client.query("ROLLBACK")
             console.error('Error sending request:');
        }finally{
            client.release()
        }
    }


}
