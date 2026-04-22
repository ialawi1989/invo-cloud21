import { PoolClient } from "pg";
import { DbClient } from "../promotions/common/sql";
import { NotificationRepository } from "./notification.data";
import { TemplateProvider } from "../template/template.business";
import { SesService } from "@src/utilts/SES";
import { CloudwebPushRepo } from "@src/controller/app/webpush/webPush.repo";
import { SendInput } from "@src/controller/app/webpush/webPush.model";
import { Invoice } from "@src/models/account/Invoice";
import { FileStorage } from "@src/utilts/fileStorage";
import { CompanyRepo } from "@src/repo/admin/company.repo";


export class NotificationProvider {
  public static async Create(client?: PoolClient) {
    client = client || (await DbClient());
    return new NotificationProvider(
      new NotificationRepository(client),
      await TemplateProvider.Create(client)
    );
  }

  private NotificationRepository: NotificationRepository;
  TemplateProvider: TemplateProvider;
  constructor(
    NotificationRepository: NotificationRepository,
    TemplateProvider: TemplateProvider,
  ) {
    this.NotificationRepository = NotificationRepository;
    this.TemplateProvider = TemplateProvider;
  }

  //todo: move to utiliti class
  public async sendHTMLEmail(emailDetails: EmailContent) {
    let email = new SesService();
    email.sender = emailDetails.sender
    email.receivers = emailDetails.receivers
    email.subject = emailDetails.subject
    email.htmlContent = emailDetails.body
    return await email.sendHTMLEmail();
  }

  public async invoiceWriteOff(invoice: any) {
    const notificationText = await this.renderNotification(invoice.companyId, "InvoiceWriteOff", invoice);
    await this.sendNotification2(invoice.companyId, "Write-Off Recorded", notificationText, "InvoiceWriteOff", { id: invoice.id });
  }

  public async invoiceMerged(invoiceLog: any) {
    const isNotificationEnabled = await CompanyRepo.isFeatureEnabled("NOTIFICATIONS", invoiceLog.companyId);
    if (!isNotificationEnabled) return;
    const input: SendInput = {
      companyId: invoiceLog.companyId,
      payload: {
        title: "invoice Merged",
        body: invoiceLog.comment,
        data: {
          "invoiceId": invoiceLog.id,
        }
      },
    }
    await CloudwebPushRepo.brodcastMessage(input)
  }

  public async invoiceSplit(invoiceLog: any) {
    const isNotificationEnabled = await CompanyRepo.isFeatureEnabled("NOTIFICATIONS", invoiceLog.companyId);
    if (!isNotificationEnabled) return;
    const input: SendInput = {
      companyId: invoiceLog.companyId,
      payload: {
        title: "invoice Split",
        body: invoiceLog.comment,
        data: {
          "invoiceId": invoiceLog.id,
        }
      },
    }
    await CloudwebPushRepo.brodcastMessage(input)
  }

  public async invoiceChangePrice(invoiceLog: any) {
    const isNotificationEnabled = await CompanyRepo.isFeatureEnabled("NOTIFICATIONS", invoiceLog.companyId);
    if (!isNotificationEnabled) return;
    const input: SendInput = {
      companyId: invoiceLog.companyId,
      payload: {
        title: "Item Change Price",
        body: invoiceLog.comment, //log body
        data: {
          "invoiceId": invoiceLog.id,
        }
      },
    }
    await CloudwebPushRepo.brodcastMessage(input)
  }

  public async cashierOut(cashiers: any) {
    const notificationText = await this.renderNotification(cashiers.companyId, "cashierOut", cashiers);
    await this.sendNotification2(cashiers.companyId, "Cashier Out", notificationText, "cashierOut", { id: cashiers.id });
  }

  public async invoiceDeleted(invoice: Invoice) {
    const notificationText = await this.renderNotification(invoice.companyId, "invoiceDeleted", invoice);
    await this.sendNotification2(invoice.companyId, "Invoice Deleted", notificationText, "invoiceDeleted", { id: invoice.id });
  }

  public async creditNoteIssued(creditNote: any) {
    const notificationText = await this.renderNotification(creditNote.companyId, "creditNoteIssued", creditNote);
    await this.sendNotification2(creditNote.companyId, "Credit Note Issued", notificationText, "creditNoteIssued", { id: creditNote.id });
  }

  //on reservation confirmed
  public async onReservationAccepted(reservationDetails: any) {
    await this.sendReservationNotification(reservationDetails.companyId, "Reservation Accepted", "reservationAccepted", reservationDetails);
  }

  //on reservation canceled
  public async onReservationRejected(reservationDetails: any) {
    await this.sendReservationNotification(reservationDetails.companyId, "Reservation Rejected", "reservationRejected", reservationDetails);
  }

  private async sendReservationNotification(companyId: any, title: string, templateType: string, reservationDetails: any) {

    //const notificationText = await this.renderNotification(companyId, templateType, reservationDetails);
    //await this.sendNotification2(companyId, title, notificationText, "reservation", { id: reservationDetails.id });

    //TODO: do more email validations
    if (!reservationDetails.customerEmail) return;
    const receivers = [reservationDetails.customerEmail];

    await this.sendEmail(companyId, receivers, title, templateType, reservationDetails);
  }

  //Invoice
  public async invoiceAccepted(invoiceDetails: any) {

    await this.sendInvoiceNotification(invoiceDetails.companyId, "Invoice Accepted", "invoiceAccepted", invoiceDetails);
  }

  public async invoiceRejected(invoiceDetails: any) {

    await this.sendInvoiceNotification(invoiceDetails.companyId, "Invoice Rejected", "invoiceRejected", invoiceDetails);
  }

  public async invoiceItemsVoided(invoiceVoided: any) {
    let totalVoidedQty = 0;
    let totalVoidedAmount = 0;
    const totalVoidedLines = invoiceVoided.items.length;
    for (let index = 0; index < invoiceVoided.items.length; index++) {
      const element = invoiceVoided.items[index];
      totalVoidedQty += Math.abs(element.qty);
      totalVoidedAmount += Math.abs(element.total);
    }

    const notificationText = await this.renderNotification(invoiceVoided.companyId, "ItemVoided", { ...invoiceVoided, totalVoidedAmount, totalVoidedLines, totalVoidedQty });
    await this.sendNotification2(invoiceVoided.companyId, `Items Voided 🧾`, notificationText, "invoice", { id: invoiceVoided.id });

  }

  public async invoiceItemsDiscountChanged(discountedItem: any) {

    const totalDiscountedItems = discountedItem.items.length
    let totalDiscountedAmount = 0
    for (let index = 0; index < discountedItem.items.length; index++) {
      const element = discountedItem.items[index];
      totalDiscountedAmount += Math.abs(element.newDiscountAmount);
    }

    const notificationText = await this.renderNotification(discountedItem.companyId, "invoiceItemsDiscountChanged", { ...discountedItem, totalDiscountedItems, totalDiscountedAmount });
    await this.sendNotification2(discountedItem.companyId, `Invoice Items Discount Changed`, notificationText, "invoice", { id: discountedItem.id });
  }

  private async sendInvoiceNotification(companyId: any, title: string, templateType: string, invoiceDetails: any) {

    //const notificationText = await this.renderNotification(companyId, templateType, invoiceDetails);
    //await this.sendNotification2(companyId, title, notificationText, "invoice", { id: invoiceDetails.id });

    //TODO: do more email validations
    const customerEmail = invoiceDetails.customerEmail ?? invoiceDetails.customer?.email;
    if (!customerEmail) return;
    const receivers = [customerEmail];

    await this.sendEmail(companyId, receivers, title, templateType, invoiceDetails);
  }

  private async sendEmail(companyId: any, receivers: string[], title: string, templateType: string, details: any) {
    //TODO: va;idate receivers
    // if(!receivers && receivers.length > 0) return;
    if (receivers.length == 0 && !receivers) return;
    const getCompany = await this.getCompanyInfo(companyId)
    const companyName = getCompany.companyName
    const compnaySlug = getCompany.compnaySlug
    const currencySymbol = getCompany.currencySymbol
    var template = await this.NotificationRepository.getEmailTemplate(companyId, templateType);
    if (!template) return;
    const renderResult = this.TemplateProvider.renderTemplate(template, { ...details, companyName, compnaySlug, currencySymbol })
    if (!renderResult) {
      return null
    }
    await this.sendHTMLEmail({
      sender: getCompany.sender,
      receivers: receivers,
      subject: title,
      body: renderResult
    });
  }

  private async renderNotification(companyId: any, templateType: string, details: any) {
    const getCompany = await this.getCompanyInfo(companyId)
    const currencySymbol = getCompany.currencySymbol

    const template = await this.NotificationRepository.getNotificationTemplate(companyId, templateType);
    if (!template) return null;
    const result = await this.TemplateProvider.renderTemplate(template, { ...details, currencySymbol });
    if (!result) {
      return null
    }
    return result
  }

  private async sendNotification2(companyId: any, title: string, text: string | null, entityType: string, details: any) {

    const isNotificationEnabled = await CompanyRepo.isFeatureEnabled("NOTIFICATIONS", companyId);
    if (!isNotificationEnabled) return;
    if (!text) return;

    await CloudwebPushRepo.brodcastMessage({
      companyId: companyId,
      payload: {
        title: title,
        body: text,
        data: {
          "entityType": entityType,
          ...details
        }
      },
    });
  }

  private async sendNotification(companyId: any, title: string, templateType: string, entityType: string, details: any) {
    const template = await this.NotificationRepository.getNotificationTemplate(companyId, templateType);
    if (!template) return;

    const renderReult = this.TemplateProvider.renderTemplate(template, details)
    if (!renderReult) {
      return null
    }
    await CloudwebPushRepo.brodcastMessage({
      companyId: companyId,
      payload: {
        title: title,
        body: renderReult,
        data: {
          "entityType": entityType,
          ...details
        }
      },
    });
  }

  private async getCompanyInfo(companyId: string) {
    const companyDetails = await this.NotificationRepository.getCompanyInfo(companyId);
    const companyName = companyDetails.companyName;
    const compnaySlug = companyDetails.compnaySlug;
    const sender = companyName + '<' + compnaySlug + '@invopos.co>';
    //const senderEmail =  compnaySlug + '@invopos.co'
    const storage = new FileStorage();
    let companySettings = await storage.getCompanySettings(companyDetails.country);
    let settings = companySettings?.settings;
    let currencySymbol = settings.currencySymbol;

    return { sender, companyName, compnaySlug, currencySymbol };
  }


  public async onCustomerFeedback(feedback: any) {
    await this.sendCustomerFeedback(feedback.companyId, "Customer Feedback", "customerFeedback", feedback);
  }

  private async sendCustomerFeedback(companyId: any, title: string, templateType: string, feedback: any) {

    //const notificationText = await this.renderNotification(companyId, templateType, reservationDetails);
    //await this.sendNotification2(companyId, title, notificationText, "reservation", { id: reservationDetails.id });

    //TODO: do more email validations
    if (!feedback.receivers) return;
    const receivers = feedback.receivers
    feedback.dashboardUrl = process.env.CLOUD_BASE_URL+'/feedbacks'
    await this.sendEmail(companyId, receivers, title, templateType, feedback);
  }
}
//interface emailobject
export interface EmailContent {
  sender: string,
  receivers: any[],
  subject: string,
  body: string
}