import { onEvent } from "@src/utilts/system-events";
import { Router } from "express";
import { ProcessEvent, ProcessRequest } from "../promotions/common/web";
import { NotificationProvider } from "./notification.business";
import { TemplateProvider } from "../template/template.business";
export class NotificationController {
    public static registerRouts(router: Router) {

        onEvent(
            "ReservationAccepted",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.onReservationAccepted)
        );

        onEvent(
            "ReservationRejected",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client)
                };
            }, NotificationController.onReservationRejected)
        );

        onEvent(
            "invoiceAccepted",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                    TemplateProvider: await TemplateProvider.Create(client)
                };
            }, NotificationController.invoiceAccepted)
        );

        onEvent(
            "invoiceRejected",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                    TemplateProvider: await TemplateProvider.Create(client)
                };
            }, NotificationController.invoiceRejected)
        );

        onEvent(
            "invoiceWriteOff",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.invoiceWriteOff)
        );

        onEvent(
            "invoiceDeleted",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.invoiceDeleted)
        );

        onEvent(
            "creditNoteIssued",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.creditNoteIssued)
        );

        onEvent(
            "invoiceMerged",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.invoiceMerged)
        );
        onEvent(
            "invoiceSplit",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.invoiceSplit)
        );

        onEvent(
            "invoiceChangePrice",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.invoiceChangePrice)
        );

        onEvent(
            "cashierOut",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, NotificationController.cashierOut)
        );
        onEvent(
            "invoiceItemsVoided",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, async (invoiceVoided: any, providers: { NotificationProvider: NotificationProvider }) => {
                return await providers.NotificationProvider.invoiceItemsVoided(invoiceVoided);
            })
        );
        onEvent(
            "invoiceItemsDiscountChanged",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client),
                };
            }, async (discountedItem: any, providers: { NotificationProvider: NotificationProvider }) => {
                return await providers.NotificationProvider.invoiceItemsDiscountChanged(discountedItem);
            })
        );

             onEvent(
            "CustomerFeedBack",
            ProcessEvent(async (client) => {
                return {
                    NotificationProvider: await NotificationProvider.Create(client)
                };
            }, NotificationController.onCustomerFeedback)
        );

    }

    public static async onReservationAccepted(reservationDetails: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.onReservationAccepted(reservationDetails);
        return result;
    }

    public static async onReservationRejected(reservationDetails: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.onReservationRejected(reservationDetails);
        return result;
    }

    public static async invoiceAccepted(invoiceDetails: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceAccepted(invoiceDetails)
        return result;
    }

    public static async invoiceRejected(invoiceDetails: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceRejected(invoiceDetails);
        return result;
    }

    public static async invoiceWriteOff(invoice: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceWriteOff(invoice)
        return result
    }

    public static async invoiceDeleted(invoice: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceDeleted(invoice)
        return result
    }

    public static async creditNoteIssued(creditNote: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.creditNoteIssued(creditNote)
        return result
    }

    public static async invoiceMerged(invoiceLog: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceMerged(invoiceLog)
        return result
    }

    public static async invoiceSplit(invoiceLog: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceSplit(invoiceLog)
        return result
    }

    public static async invoiceChangePrice(invoiceLog: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.invoiceChangePrice(invoiceLog)
        return result
    }

    public static async cashierOut(cashiers: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.cashierOut(cashiers)
        return result
    }

    public static async onCustomerFeedback(reservationDetails: any, providers: { NotificationProvider: NotificationProvider }) {
        const result = await providers.NotificationProvider.onCustomerFeedback(reservationDetails);
        return result;
    }
}
