import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import handlebars from 'handlebars';
import { promises as fs } from 'fs';
import path from 'path';

// Register Handlebars helper
handlebars.registerHelper('or', function (...args: any[]) {
    const options = args.pop();
    return args.some(Boolean);
});

// Interfaces
interface EmailData {
    recipientName: string;
    recipientEmail: string;
    companyName: string;
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    attachmentBgStart: string;
    attachmentBgEnd: string;
    reportName: string;
    reportDate: string;
    fileName: string;
    fileExtension: string;
    headerSubtitle: string;
    closingMessage: string;
    teamName: string;
    showContactInfo: boolean;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyWebsite: string;
    fromEmail: string;
    generationTimestamp: string;
    customFooterMessage?: string;
    unsubscribeUrl: string;
    preferencesUrl: string;
}

interface RecipientData {
    name?: string;
    email: string;
    unsubscribeToken: string;
}

interface ReportFile {
    reportName: string;
    reportDate: string;
    fileName: string;
    fileExtension: string;
    path: string;
}

interface TenantConfig {
    companyName: string;
    logoUrl: string;
    primaryColor?: string;
    secondaryColor?: string;
    attachmentBgStart?: string;
    attachmentBgEnd?: string;
    teamName: string;
    showContactInfo: boolean;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyWebsite: string;
    fromEmail: string;
    customFooterMessage?: string;
    baseUrl: string;
}

export class EmailService {
    private static template: handlebars.TemplateDelegate | null = null;

    public static async loadTemplate(): Promise<handlebars.TemplateDelegate> {
        try{
        if (!this.template) {

            let rootDirectory = path.dirname(__dirname)
            const storagePath = process.env.STORAGE_PATH;
          
            /**path to html file */
     
            const filePath = path.join(rootDirectory, storagePath + "/templates/report-email.hbs");
            console.log(">>>>>>>>>>>>>",filePath)
            
            const templateSource: any = await fs.readFile(filePath, 'utf8');

            // const templatePath = path.join(__dirname, 'templates', 'report-email.hbs');
            // const templateSource = await fs.readFile(templatePath, 'utf8');
            this.template = handlebars.compile(templateSource);
        }
        return this.template;
    }catch(error:any){
        throw new Error(error.message)
    }

    }

    // async sendReportEmail(emailData: EmailData): Promise<any> {
    //     try {
    //         const template = await this.loadTemplate();
    //         const htmlBody = template(emailData);

    //         const params = new SendEmailCommand({
    //             Destination: {
    //                 ToAddresses: [emailData.recipientEmail]
    //             },
    //             Message: {
    //                 Subject: {
    //                     Data: `${emailData.reportName} - ${emailData.reportDate}`,
    //                     Charset: 'UTF-8'
    //                 },
    //                 Body: {
    //                     Html: {
    //                         Data: htmlBody,
    //                         Charset: 'UTF-8'
    //                     }
    //                 }
    //             },
    //             Source: `"${emailData.companyName}" <${emailData.fromEmail}>`
    //         });

    //         const result = await this.sesClient.send(params);
    //         console.log('Email sent with SES:', result.MessageId);
    //         return result;
    //     } catch (error) {
    //         console.error('Failed to send email via SES:', error);
    //         throw error;
    //     }
    // }
}






// // Register Handlebars helpers
// handlebars.registerHelper('or', function() {
//     return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
// });

// class EmailService {
//     constructor() {
//         this.transporter = nodemailer.createTransporter({
//             // Configure your email provider
//             host: process.env.SMTP_HOST,
//             port: process.env.SMTP_PORT,
//             secure: false,
//             auth: {
//                 user: process.env.SMTP_USER,
//                 pass: process.env.SMTP_PASS
//             }
//         });
        
//         this.template = null;
//     }

//     async loadTemplate() {
//         if (!this.template) {
//             const templatePath = path.join(__dirname, 'templates', 'report-email.hbs');
//             const templateSource = await fs.readFile(templatePath, 'utf8');
//             this.template = handlebars.compile(templateSource);
//         }
//         return this.template;
//     }

//     async sendReportEmail(emailData, attachmentPath) {
//         try {
//             const template = await this.loadTemplate();
//             const html = template(emailData);

//             const mailOptions = {
//                 from: `"${emailData.companyName}" <${emailData.fromEmail}>`,
//                 to: emailData.recipientEmail,
//                 subject: `${emailData.reportName} - ${emailData.reportDate}`,
//                 html: html,
//                 attachments: [
//                     {
//                         filename: `${emailData.fileName}.${emailData.fileExtension}`,
//                         path: attachmentPath
//                     }
//                 ]
//             };

//             const result = await this.transporter.sendMail(mailOptions);
//             console.log('Email sent successfully:', result.messageId);
//             return result;
//         } catch (error) {
//             console.error('Email sending failed:', error);
//             throw error;
//         }
//     }
// }

// // Example usage function
// async function sendDailyReport(recipientData, reportFile) {
//     const emailService = new EmailService();
    
//     // Email template data
//     const emailData = {
//         // Recipient info
//         recipientName: recipientData.name || 'Recipient',
//         recipientEmail: recipientData.email,
        
//         // Company branding
//         companyName: 'Invo Pos Technologies',
//         logoUrl: 'https://yourdomain.com/images/logo.png', // Optional
//         primaryColor: '#32acc1',
//         secondaryColor: '#26a0b4',
//         attachmentBgStart: '#e6f7f9',
//         attachmentBgEnd: '#d1f0f3',
        
//         // Report details
//         reportName: 'Profit and Loss Report',
//         reportDate: new Date().toLocaleDateString('en-GB', {
//             day: '2-digit',
//             month: 'short',
//             year: 'numeric'
//         }),
//         fileName: 'Profit_Loss_Report_' + new Date().toISOString().slice(0, 10),
//         fileExtension: 'pdf',
        
//         // Email content
//         headerSubtitle: 'Automated Report Delivery',
//         closingMessage: 'Best regards,',
//         teamName: 'Invo Sales Team',
        
//         // Contact information
//         showContactInfo: true,
//         companyAddress: '123 Business Plaza, Tech District, Innovation City 12345',
//         companyPhone: '+1 (555) 123-4567',
//         companyEmail: 'support@invopos.com',
//         companyWebsite: 'https://invopos.com',
//         fromEmail: 'reports@invopos.com',
        
//         // Footer
//         generationTimestamp: new Date().toLocaleString('en-GB', {
//             day: '2-digit',
//             month: 'short',
//             year: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true
//         }),
//         customFooterMessage: 'If you have any questions regarding this report, please contact our support team.',
        
//         // Unsubscribe links
//         unsubscribeUrl: `https://invopos.com/unsubscribe?token=${recipientData.unsubscribeToken}`,
//         preferencesUrl: `https://invopos.com/preferences?token=${recipientData.unsubscribeToken}`
//     };

//     return await emailService.sendReportEmail(emailData, reportFile);
// }

// // Multi-tenant usage example
// async function sendMultiTenantReport(tenantConfig, recipientData, reportFile) {
//     const emailService = new EmailService();
    
//     const emailData = {
//         // Dynamic tenant data
//         recipientName: recipientData.name || 'Recipient',
//         recipientEmail: recipientData.email,
        
//         // Tenant-specific branding
//         companyName: tenantConfig.companyName,
//         logoUrl: tenantConfig.logoUrl,
//         primaryColor: tenantConfig.primaryColor || '#32acc1',
//         secondaryColor: tenantConfig.secondaryColor || '#26a0b4',
//         attachmentBgStart: tenantConfig.attachmentBgStart || '#e6f7f9',
//         attachmentBgEnd: tenantConfig.attachmentBgEnd || '#d1f0f3',
        
//         // Report details
//         reportName: reportFile.reportName,
//         reportDate: reportFile.reportDate,
//         fileName: reportFile.fileName,
//         fileExtension: reportFile.fileExtension,
        
//         // Email content
//         headerSubtitle: 'Automated Report Delivery',
//         closingMessage: 'Best regards,',
//         teamName: tenantConfig.teamName,
        
//         // Tenant contact info
//         showContactInfo: tenantConfig.showContactInfo,
//         companyAddress: tenantConfig.companyAddress,
//         companyPhone: tenantConfig.companyPhone,
//         companyEmail: tenantConfig.companyEmail,
//         companyWebsite: tenantConfig.companyWebsite,
//         fromEmail: tenantConfig.fromEmail,
        
//         // System generated
//         generationTimestamp: new Date().toLocaleString('en-GB'),
//         customFooterMessage: tenantConfig.customFooterMessage,
//         unsubscribeUrl: `${tenantConfig.baseUrl}/unsubscribe?token=${recipientData.unsubscribeToken}`,
//         preferencesUrl: `${tenantConfig.baseUrl}/preferences?token=${recipientData.unsubscribeToken}`
//     };

//     return await emailService.sendReportEmail(emailData, reportFile.path);
// }

// // Example tenant configuration
// const exampleTenantConfig = {
//     companyName: 'Acme Corporation',
//     logoUrl: 'https://acme.com/logo.png',
//     primaryColor: '#ff6b35',
//     secondaryColor: '#f7931e',
//     attachmentBgStart: '#fff2e6',
//     attachmentBgEnd: '#ffe6cc',
//     teamName: 'Acme Analytics Team',
//     showContactInfo: true,
//     companyAddress: '456 Corporate Ave, Business City 67890',
//     companyPhone: '+1 (555) 987-6543',
//     companyEmail: 'reports@acme.com',
//     companyWebsite: 'https://acme.com',
//     fromEmail: 'noreply@acme.com',
//     customFooterMessage: 'For urgent matters, call our 24/7 support line.',
//     baseUrl: 'https://app.acme.com'
// };

// // Usage examples:
// /*
// // Single tenant usage
// await sendDailyReport(
//     { 
//         name: 'John Smith', 
//         email: 'john@company.com',
//         unsubscribeToken: 'unique_token_123'
//     },
//     '/path/to/report.pdf'
// );

// // Multi-tenant usage
// await sendMultiTenantReport(
//     exampleTenantConfig,
//     { 
//         name: 'Jane Doe', 
//         email: 'jane@acme.com',
//         unsubscribeToken: 'unique_token_456'
//     },
//     {
//         reportName: 'Monthly Sales Report',
//         reportDate: '31 May 2025',
//         fileName: 'Monthly_Sales_May_2025',
//         fileExtension: 'pdf',
//         path: '/path/to/monthly-report.pdf'
//     }
// );
// */

// module.exports = {
//     EmailService,
//     sendDailyReport,
//     sendMultiTenantReport
// };