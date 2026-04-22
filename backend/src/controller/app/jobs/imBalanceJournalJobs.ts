import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';
import { ReportData, XLSXGenerator } from '../../../utilts/xlsxGenerator';
import { Company } from '@src/models/admin/company';
import { console } from 'inspector';
import path from "path";
import fs from 'fs';
import mime from 'mime';
import { SESService } from '@src/AWS-SERVICES/sesService';
import { SendRawEmailCommand } from '@aws-sdk/client-ses';

export class ImBalanceJournalJob {
    public job;

    constructor() {
        /** '00 00 * * *' */
        this.job = new CronJob(
            '0 0 0 * * *', // cronTime
            async () => {
                await this.sendImBalanceJournalCompanies();
            }

        );
    }

    async sendImBalanceJournalCompanies() {


        try {

            let imbalanceCompanies: any[] = [];

            let data = await DB.excu.query(`SELECT id , "name" FROM "Companies" `);
            const companies = data.rows
            const ids = companies.map(obj => obj.id);
            do {
                const chunk = ids.splice(0, 5); // take first 5
                let journals = await this.checkImbalanceJournals(chunk);
                journals = journals.map((item: any) => {
                    let company = companies.find((c: any) => c.id === item.companyId);
                    if(company)
                    {
                        item.companyName = company.name;
                    }
                    return item 

                })
                imbalanceCompanies = [...imbalanceCompanies, ...journals]   // your query function
            } while (ids.length > 0);
            if (imbalanceCompanies.length > 0) {
                let report = new ReportData()
                report.filter = {
                    title: "Imbalance Journals",
                    to: new Date()

                }
                report.records = imbalanceCompanies
                report.columns = [
                    
                { key: 'companyId' },
                { key: 'companyName' },    
                { key: 'net' },
                { key: 'debit' },
                { key: 'credit' },
            
              
                ]
                report.fileName = 'ImbalanceCompanies'
                let company = new Company()
                company.id = "00000000-0000-0000-0000-000000000000";
                const resData = await XLSXGenerator.exportToExcel(report, company);
                const fileBuffer = fs.readFileSync(resData.fileName);
                const base64Data = fileBuffer.toString('base64');
                const boundary = 'NextPart'
                const data = [];
                const contentType = mime.lookup(resData.fileName) || 'application/octet-stream';
                const sender = 'Invo' + '<' + 'invo' + '@invopos.co>'
                data.push(`From: ${sender}`);
                const fileName = path.basename(resData.fileName);
                const receivers = ['zahra@invopos.com','alsaro@invopos.com']
                receivers.forEach(email => {
                    data.push(`To: ${email}`);

                });

                // Add unique message ID
                data.push(`Date: ${new Date().toUTCString()}`); // Optional but good to have
                data.push(`Subject: Companies with Imbalance Journals`);
                data.push("MIME-Version: 1.0");
                data.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
                data.push("");
                data.push(`--${boundary}`);
                data.push('Content-Type: text/html; charset="utf-8"');
                data.push('Content-Transfer-Encoding: 7bit');
                data.push("");
                data.push("");
                data.push(`--${boundary}`);
                data.push(`Content-Type: ${contentType}; name="${fileName}"`);
                data.push("Content-Transfer-Encoding: base64");
                data.push(`Content-Disposition: attachment; filename="${fileName}"`);
                data.push("")
                data.push(base64Data)
                data.push("")
                data.push(`--${boundary}--`)

                // Join the MIME message parts
                const rawEmail = data.join("\n");

                // ########### send Email  ###########
                let awsInstant = new SESService()

                const encoder = new TextEncoder();
                const rawData = encoder.encode(rawEmail);
                const command = new SendRawEmailCommand({
                    RawMessage: { Data: rawData },
                });
                 await awsInstant.sesClint.send(command);
                fs.unlinkSync(resData.fileName);


            }
            return
        } catch (error: any) {
            throw new Error(`Error in checkImbalanceJournals: ${error.message}`);
        }

    }



    public async checkImbalanceJournals(companyIds: any[]) {
        try {
            let data = await DB.excu.query(`with "journals" as (
                                        select "name","referenceId","dbTable",sum("amount"::text::numeric ) as "total","companyId" from "JournalRecords"
                                        where "companyId" = any($1::uuid[])
                                        and (null is null or "createdAt" >= null)
                                        and "createdAt" < current_TIMESTAMP 
                                        and  ( "name" <>  'Costs Of Goods Sold' or "dbTable" not in ( 'Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                                        and  ( "name" <>   'Inventory Assets'  or "dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                                        group by  "name", "referenceId","dbTable","companyId"
                                        ), "movment" as (
                                        select "transactionId" as "referenceId" ,"referenceTable" as "dbTable",sum("qty"::text::numeric * "cost"::text::numeric ) as "total","companyId" from "InventoryMovmentRecords"
                                        where "companyId" = any($1::uuid[])
                                        and (null is null or "createdAt" >= null)
                                        and "createdAt" <  current_TIMESTAMP 
                                        and  "referenceTable"  not in ('Supplier Credit','Billing')
                                        group by "transactionId", "referenceTable","companyId"
                                        ),"costOfGoodSolds" as (
                                        select 'Costs Of Goods Sold' as "name", "referenceId", "dbTable" , "total" *  -1,"companyId" from "movment"
                                        where  "dbTable"  not in ('Opening Balance')	
                                        ),"inventoryAssets" as (
                                        select 'Inventory Assets' as "name", "referenceId", "dbTable" , "total"  ,"companyId" from "movment"
                                        ), "all" as(
                                        select * from "journals"
                                        union all 
                                        select * from "costOfGoodSolds"
                                        union all 
                                        select * from "inventoryAssets"
                                        ), "test" as (
                                        select  sum("total"::text::numeric(30,5))as"net" , sum(case when "total" < 0 then abs("total"::text::numeric(30,5)) end) as "credit" , sum(case when "total" > 0 then "total"::text::numeric(30,5) end) as "debit" ,"companyId" from "all"
                                        group by "companyId"
                                        )

                                        select "net"::text::numeric(30,3), "debit"::text::numeric(30,3) ,"credit"::text::numeric(30,3),"companyId"   from "test"
                                        where "debit"::text::numeric(30,3) <> "credit"::text::numeric(30,3)`, [companyIds]);

            return data.rows ?? []
        } catch (error: any) {
            throw new Error(`Error in checkImbalanceJournals: ${error.message}`);
        }
    }
}