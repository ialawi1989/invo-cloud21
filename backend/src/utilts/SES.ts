import { SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { SESService } from "@src/AWS-SERVICES/sesService";
import path from "path";
import fs from 'fs';
import mime from "mime";
import { v4 } from "uuid";

export class SesService {

  sender = "";
  receivers: any[] = [];
  subject = "";
  body = "";
  htmlContent = "";
  public async sendEmail() {
    const params = {
      Source: this.sender,
      Destination: {
        ToAddresses: this.receivers,
      },
      Message: {
        Subject: {
          Data: this.subject,
        },

        Body: {
          Text: {
            Data: this.body,
          },
        },
      },
    };
    let awsInstant = new SESService()
    try {

      const command = new SendEmailCommand(params);
      const response = await awsInstant.sesClint.send(command);
      return response;
    } catch (error) {
      awsInstant.sesClint.destroy();
    }
  }

  public async sendHTMLEmail() {
    const params = {
      //Source: `"${emailData.companyName}" <${this.sender}>`,
      Source: this.sender,
      Destination: {
        ToAddresses: this.receivers,
      },
      Message: {
        Subject: {
          Data: this.subject, Charset: 'UTF-8'
        },

        Body: {
          Text: {
            Data: this.body,
          },
          Html: {
            Data: this.htmlContent, Charset: 'UTF-8'// HTML body of the email
          }
        },
      },
    };
    let awsInstant = new SESService()
    try {

      const command = new SendEmailCommand(params);
      const response = await awsInstant.sesClint.send(command);
      return response;
    } catch (error) {
      awsInstant.sesClint.destroy();
    }
  }

  public async sendEmailWithAttachment(filePath: string, slug:string) {

    // ########### define values ###########
    const boundary = 'NextPart'
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    const fileBase64 = fileContent.toString('base64');
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    // ########### prepare Data  ###########
    const data = [];
    data.push(`From: ${this.sender}`);
    this.receivers.forEach(email => {
      data.push(`To: ${email}`);

    });

    // Add unique message ID
    data.push(`Date: ${new Date().toUTCString()}`); // Optional but good to have
    data.push(`Subject: ${this.subject}`);
    data.push("MIME-Version: 1.0");
    data.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    data.push("");
    data.push(`--${boundary}`);
    data.push('Content-Type: text/html; charset="utf-8"');
    data.push('Content-Transfer-Encoding: 7bit');
    data.push("");
    data.push(this.htmlContent);
    data.push("");
    data.push(`--${boundary}`);
    data.push(`Content-Type: ${contentType}; name="${fileName}"`);
    data.push("Content-Transfer-Encoding: base64");
    data.push(`Content-Disposition: attachment; filename="${fileName}"`);
    data.push("")
    data.push(fileBase64)
    data.push("")
    data.push(`--${boundary}--`)

    // Join the MIME message parts
    const rawEmail = data.join("\n");

    // ########### send Email  ###########
    let awsInstant = new SESService()
    try {

      const encoder = new TextEncoder();
      const rawData = encoder.encode(rawEmail);
      const command = new SendRawEmailCommand({
        RawMessage: { Data: rawData },
      });
      const response = await awsInstant.sesClint.send(command);
      return response;

    } catch (error) {
      console.log(error)
      awsInstant.sesClint.destroy();
    }

  }

  public async sendPdfFile(pdf: any) {

    const data = [];
    data.push(`From: ${this.sender}`);

    this.receivers.forEach(email => {
      data.push(`To: ${email}`);

    });
    data.push(`Subject: ${this.subject}`);
    data.push("MIME-Version: 1.0");
    data.push('Content-Type: multipart/mixed; boundary="boundary"');
    data.push("");
    data.push("--boundary");;
    data.push('Content-Type: application/pdf; name="attachment.pdf"');
    data.push("Content-Disposition: attachment");
    data.push("Content-Transfer-Encoding: base64");
    data.push("");
    data.push(pdf.toString("base64"));
    data.push("");
    data.push("--boundary--");
    data.push("");

    // Join the MIME message parts
    const rawEmail = data.join("\n");

    let awsInstant = new SESService()
    try {
      const encoder = new TextEncoder();
      const rawData = encoder.encode(rawEmail);

      const command = new SendRawEmailCommand({
        RawMessage: { Data: rawData },
      });
      const response = await awsInstant.sesClint.send(command);
      return response;
    } catch (error) {
      console.log(error)
      awsInstant.sesClint.destroy();
    }
  }
}