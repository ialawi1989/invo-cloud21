// ========================= IMPORTS =========================
import { Socket } from 'socket.io';



// Socket repositories

import { SocketAppliedCredit } from './appliedCredit.socket';
import { SocketCashier } from './cashier.socket';
import { SocketChargesRepo } from './charges.socket';
import { SocketCompanyRepo } from './company.socket';
import { SocketCreditNoteRepo } from './creditNote.socket';
import { SocketCustomerRepo } from './customer.socket';
import { SocketDiscount } from './discount.socket';

import { SocketEmployee } from './employee.socket';
import { SocketEstimateRepo } from './Estimate.socket';
import { EventLogsSocket } from './eventLogs.socket';
import { SocketInventoryRequestRepo } from './InventortRequest.socket';
import { SocketInvoiceRepo } from './invoice.socket';
import { SoketInvoicePayment } from './invoicePayment.socket';
import { SocketKitchenSection } from './kitchenSection.socket';
import { SocketMenu } from './menu.socket';
import { SocketOption } from './option.socket';
import { PayOutSocketRepo } from './payout.socket';
import { SocketPaymentMethod } from './paymentMethod.socket';
import { SocketPriceManagment } from './priceManagment.socket';
import { SocketProductRepo } from './product.socket';
import { ReservationSocket } from './reservation.socket';
import { SocketRefund } from './refund.socket';
import { SocketService } from './service.socket';
import { SocketTableRepo } from './table.socket';
import { SocketTaxRepo } from './tax.socket';
import { SocketTerminal } from './terminal.socket';
import { SocketWastage } from './wastage.socket';
import { WaitingListSocket } from './waitingList.socket';
import { SocketWorkOrder } from './workOrder.socket';

// App repositories
import { EstimateRepo } from '../app/accounts/estimate.repo';

import { InvoiceRepo } from '../app/accounts/invoice.repo';
import { AttendanceSocket } from './attendence.socket';
import { DriverSocketRepo } from './delivery/driver.socket';
import { InvoWatchSocketRepo } from './invoWatch.socket';


// ========================= SOCKET EVENTS CLASS =========================
export class SocketEvents {
    public static async events(client: Socket, branchId: any, decoded: any) {
        // === local helpers ===
        // const mb = (n: number) => Math.round((n / 1024 / 1024) * 100) / 100;
        // const snap = () => {
        //     const m = process.memoryUsage();
        //     return {
        //         rss: mb(m.rss),
        //         heapUsed: mb(m.heapUsed),
        //         heapTotal: mb(m.heapTotal),
        //         external: mb(m.external),
        //         arrayBuffers: mb((m as any).arrayBuffers ?? 0),
        //     };
        // };
        // const diff = (a: ReturnType<typeof snap>, b: ReturnType<typeof snap>) => ({
        //     rss: +(b.rss - a.rss).toFixed(2),
        //     heapUsed: +(b.heapUsed - a.heapUsed).toFixed(2),
        //     heapTotal: +(b.heapTotal - a.heapTotal).toFixed(2),
        //     external: +(b.external - a.external).toFixed(2),
        //     arrayBuffers: +(b.arrayBuffers - a.arrayBuffers).toFixed(2),
        // });

        // const log = console.warn;            // swap with your logger if needed
        // const thresholdMB = 1;              // only print when growth >= this
        // const includeRss = true;            // consider RSS in growth check

        try {
            // log connect baseline
            // log(`[SOCKET CONNECT] ${client.id} mem=${JSON.stringify(snap())}`);

            // // patch .on to wrap all handlers
            // const originalOn = client.on.bind(client);
            // client.on = (event: string, handler: (...args: any[]) => any) => {
            //     // console.warn("Registering event:", event);
            //     const wrapped = async (...args: any[]) => {
            //         const startSnap = snap();
            //         log(`[START] SOCKET ${event}#${client.id} mem=${JSON.stringify(startSnap)}`);
            //         try {
            //             const ret = handler.apply(client, args);
            //             if (ret && typeof (ret as any).then === "function") await ret;
            //             return ret;
            //         } finally {
            //             const endSnap = snap();
            //             const d = diff(startSnap, endSnap);
            //             const grew = Math.max(
            //                 includeRss ? d.rss : -Infinity,
            //                 d.heapUsed, d.heapTotal, d.external, d.arrayBuffers
            //             );
            //             // if (grew >= thresholdMB) {
            //                 log(`[END]   SOCKET ${event}#${client.id} mem=${JSON.stringify(endSnap)} diff=${JSON.stringify(d)}`);
            //             // }
            //         }
            //     };
            //     return originalOn(event, wrapped);
            // };

            // client.on("disconnect", (reason) => {
            //     log(`[SOCKET DISCONNECT] ${client.id} reason=${reason} mem=${JSON.stringify(snap())}`);
            // });

            // register your event groups
            this.registerProductEvents(client, branchId, decoded);
            this.registerCustomerEvents(client, branchId);
            this.registerCompanyEvents(client, branchId);
            this.registerEstimateInvoiceCreditEvents(client, branchId);
            this.registerPriceManagementEvents(client, branchId);
            this.registerDepartmentCategoryEvents(client, branchId);
            this.registerDeliveryReceiptEvents(client, branchId);
            this.registerEmployeeScheduleEvents(client, branchId);
            this.registerSyncEvents(client, branchId);
            this.registerRecoveryEvents(client, branchId);
            this.registerCallbackEvents(client);
            this.registerTableTerminalEvents(client, branchId, decoded);
            this.registerInventoryEvents(client, branchId);
            this.registerBrandSharingEvents(client, branchId);
            this.registerAppliedCreditEvents(client, branchId);
            this.registerMenuEvents(client, branchId);
            this.registerEventLogsEvents(client, branchId);
            this.registerReservationWaitingListEvents(client, branchId);
            this.registerItemOptionAvailabilityEvents(client, branchId);
            this.registerEcommerceSettingsEvents(client, branchId);
            this.registerInventoryTransferEvents(client, branchId);
            this.registerDriverEvents(client, branchId);
            this.registerInvoWatchEvents(client, branchId);
            this.registerInvoiceEvents(client, branchId);
        } catch (error) {
            console.log(error);
          
  
        }
    }











    // ========================= PRODUCT EVENTS =========================
    private static registerProductEvents(client: Socket, branchId: any, decoded: any) {
        client.on("getProducts", async (data, callback) => {
            await SocketProductRepo.getProducts(client, data, branchId, callback)
        });
        client.on("branchesAvailability", async (data, callback) => {
            await SocketProductRepo.branchesAvailability(client, data, branchId, callback);
        });
        client.on("getItems", async (data, callback) => {
            console.log("getItemsgetItemsgetItems", callback)
            await SocketProductRepo.getItemAvailability(client, data, branchId, callback)
        });
        client.on("updateItemAvailaibility", async (data, callback) => {
            await SocketProductRepo.updateItemAvailaibility(client, data, branchId, callback)
        });
        client.on("getTables", async (data, callback) => {
            await SocketTableRepo.getTables(client, data, branchId, callback)
        });
        client.on("getDeletedTables", async (data, callback) => {
            await SocketTableRepo.getDeletedTables(client, data, branchId, callback)
        });
        client.on("getMenus", async (data, callback) => {
            await SocketMenu.getMenus(client, data, branchId, callback)
        });
        client.on("getOptions", async (data, callback) => {
            await SocketOption.getOptions(client, data, branchId, callback)
        });
        client.on("getOptionGroups", async (data, callback) => {
            await SocketOption.getOptionGroups(client, data, branchId, callback)
        });
        client.on("getServices", async (data, callback) => {
            await SocketService.getServices(client, data, branchId, callback)
        });
        client.on("getEmployees", async (data, callback) => {
            await SocketEmployee.getEmployees(client, data, branchId, callback)
        });
        client.on("getEmployeePrices", async (data, callback) => {
            await SocketEmployee.getEmployeePricess(client, data, branchId, callback)
        });
        client.on("getEmployeePrivileges", async (data, callback) => {
            await SocketEmployee.getEmployeePrivielges(client, data, branchId, callback)
        });
        client.on("getKitchenSections", async (data, callback) => {
            await SocketKitchenSection.getKitchenSections(client, data, branchId, callback)
        });
        client.on("getDiscounts", async (data, callback) => {
            await SocketDiscount.getDiscounts(client, data, branchId, callback)
        });
        client.on("getPaymentMethods", async (data, callback) => {
            await SocketPaymentMethod.getPaymentMethods(client, data, branchId, callback)
        });
        client.on("saveCashiers", async (data, callback) => {
            await SocketCashier.saveCashier(client, data, branchId, callback)
        });
        client.on("saveInvoices", async (data, callback) => {
            await SocketInvoiceRepo.saveInvoice(client, data, branchId, callback)
        });
        client.on("addTerminal", async (data, callback) => {
            await SocketTerminal.addTerminals(client, data, branchId, decoded, callback)
        });
    }

    // ========================= CUSTOMER EVENTS =========================
    private static registerCustomerEvents(client: Socket, branchId: any) {
        client.on("addCustomers", async (data, callback) => {
            await SocketCustomerRepo.saveCustomer(data, branchId, callback)
        });
        client.on("searchCustomerByPhone", async (data, callback) => {
            await SocketCustomerRepo.searchCustomerByPhone(data, branchId, callback)
        });
        client.on("getCustomers", async (data, callback) => {
            await SocketCustomerRepo.getCustomer(client, data, branchId, callback)
        });
    }

    // ========================= COMPANY EVENTS =========================
    private static registerCompanyEvents(client: Socket, branchId: any) {
        client.on("getCompanySettings", async (data, callback) => {
            await SocketCompanyRepo.getCompanyPrefrences(client, data, branchId, callback)
        });
        client.on("getCompanyLogo", async (data, callback) => {
            await SocketCompanyRepo.getCompanyLogo(client, data, branchId, callback)
        });
        client.on("getTaxes", async (data, callback) => {
            await SocketTaxRepo.getTax(client, data, branchId, callback)
        });
        client.on("getCharges", async (data, callback) => {
            await SocketChargesRepo.getCharges(client, data, branchId, callback)
        });
    }

    // ========================= ESTIMATE, INVOICE, CREDIT NOTE EVENTS =========================
    private static registerEstimateInvoiceCreditEvents(client: Socket, branchId: any) {
        client.on("saveEstimates", async (data, callback) => {
            await SocketEstimateRepo.saveEstimate(client, data, branchId, callback)
        });
        client.on("saveCreditNotes", async (data, callback) => {
            await SocketCreditNoteRepo.saveCreditNote(client, data, branchId, callback)
        });
        client.on("saveWorkOrders", async (data, callback) => {
            await SocketWorkOrder.saveWorkOrder(client, data, branchId, callback)
        });
        client.on("getWorkOrders", async (data, callback) => {
            await SocketWorkOrder.getWorkOrders(client, data, branchId, callback)
        });
        client.on("saveInvoicePayments", async (data, callback) => {
            await SoketInvoicePayment.saveInvoicePayments(client, data, branchId, callback)
        });
        client.on("saveRefunds", async (data, callback) => {
            await SocketRefund.saveRefund(client, data, branchId, callback)
        });
    }

    // ========================= PRICE MANAGEMENT EVENTS =========================
    private static registerPriceManagementEvents(client: Socket, branchId: any) {
        client.on("getPriceLabels", async (data, callback) => {
            await SocketPriceManagment.getPriceLabels(client, data, branchId, callback)
        });
        client.on("getPriceManagments", async (data, callback) => {
            await SocketPriceManagment.getPriceManagment(client, data, branchId, callback)
        });
    }

    // ========================= DEPARTMENT & CATEGORY EVENTS =========================
    private static registerDepartmentCategoryEvents(client: Socket, branchId: any) {
        client.on("getDepartments", async (data, callback) => {
            await SocketProductRepo.getDepartments(client, data, branchId, callback)
        });
        client.on("getCategories", async (data, callback) => {
            await SocketProductRepo.getCategories(client, data, branchId, callback)
        });
    }

    // ========================= DELIVERY & RECEIPT EVENTS =========================
    private static registerDeliveryReceiptEvents(client: Socket, branchId: any) {
        client.on("getDeliveryAddresses", async (data, callback) => {
            await SocketCompanyRepo.getCompanyDeliveryAddresses(client, data, branchId, callback)
        });
        client.on("getRecieptTemplates", async (data, callback) => {
            await SocketCompanyRepo.getRecieptTemplates(client, data, branchId, callback)
        });
        client.on("labelTemplates", async (data, callback) => {
            await SocketCompanyRepo.labelTemplates(client, data, branchId, callback)
        });
        client.on("recieptTemplates", async (data, callback) => {
            await SocketCompanyRepo.recieptTemplates(client, data, branchId, callback)
        });
        client.on("getLabelTemplates", async (data, callback) => {
            await SocketCompanyRepo.getlabelTemplates(client, data, branchId, callback)
        });
        client.on("getCoverdAddresses", async (data, callback) => {
            await SocketCompanyRepo.getCoveredAddresses(client, data, branchId, callback)
        });
    }

    // ========================= EMPLOYEE SCHEDULE EVENTS =========================
    private static registerEmployeeScheduleEvents(client: Socket, branchId: any) {
        client.on("getEmployeesSchedule", async (data, callback) => {
            await SocketEmployee.getEmployeesSchedule(client, data, branchId, callback)
        });
        client.on("getEmployeesAdditionalShifts", async (data, callback) => {
            await SocketEmployee.getEmployeesAdditionalShifts(client, data, branchId, callback)
        });
        client.on("getEmployeesExceptionsShifts", async (data, callback) => {
            await SocketEmployee.getEmployeesExceptionShifts(client, data, branchId, callback)
        });
        client.on("getEmployeesDayOffs", async (data, callback) => {
            await SocketEmployee.getEmployeeOffDays(client, data, branchId, callback)
        });
    }

    // ========================= SYNC EVENTS =========================
    private static registerSyncEvents(client: Socket, branchId: any) {
        client.on("getCreditNotes", async (data, callback) => {
            await SocketCreditNoteRepo.getPOSCreditNotes(client, data, branchId, callback)
        });
        client.on("getInvoices", async (data, callback) => {
            await SocketInvoiceRepo.getPosInvoices(client, data, branchId, callback)
        });
        client.on("getEstimates", async (data, callback) => {
            await SocketEstimateRepo.getPosEstimate(client, data, branchId, callback)
        });
        client.on("getInvoicePayments", async (data, callback) => {
            await SoketInvoicePayment.getPOSInvoicePayments(client, data, branchId, callback)
        });
        client.on("getRefunds", async (data, callback) => {
            await SocketRefund.getPosRefundList(client, data, branchId, callback)
        });
        client.on("getPlacedOrders", async (data, callback) => {
            await SocketInvoiceRepo.getEcommercePlacedOrders(client, data, branchId, callback)
        });
        client.on("getCallCenterOrderes", async (data, callback) => {
            await SocketInvoiceRepo.getCallCenterOrderes(client, data, branchId, callback)
        });
        client.on("getPlacedEstimate", async (data, callback) => {
            await SocketEstimateRepo.getEstimatesPlacedOrders(client, data, branchId, callback)
        });

        client.on("getProductsOnHand", async (data, callback) => {
            await SocketProductRepo.getProductsOnHand(client, data, branchId, callback)
        });
    }

    // ========================= RECOVERY EVENTS =========================
    private static registerRecoveryEvents(client: Socket, branchId: any) {
        client.on("recoverDbCreditNotes", async (data, callback) => {
            await SocketCreditNoteRepo.recoverDbCreditNotes(client, data, branchId, callback)
        });
        client.on("recoverDbInvoices", async (data, callback) => {
            await SocketInvoiceRepo.getRecoveDBinvoices(client, data, branchId, callback)
        });
        client.on("getCashiers", async (data, callback) => {
            await SocketCashier.getCashiers(client, data, branchId, callback)
        });
        client.on("recoverDbInvoicePayments", async (data, callback) => {
            await SoketInvoicePayment.getRecoverDbInvoicePayments(client, data, branchId, callback)
        });
        client.on("recoverDbRefunds", async (data, callback) => {
            await SocketRefund.getRecoverDbRefunds(client, data, branchId, callback)
        });
        client.on("recoverDbEstimates", async (data, callback) => {
            await SocketEstimateRepo.getRecoverDbEstimate(client, data, branchId, callback)
        });
        client.on("recoverDbTerminals", async (data, callback) => {
            await SocketTerminal.getTerminals(client, data, branchId, callback)
        });
    }

    // ========================= CALLBACK EVENTS =========================
    private static registerCallbackEvents(client: Socket) {
        client.on("ecommerceInvoiceCallback", async (data, callback) => {
            data = JSON.parse(data)
            console.log("ecommerceInvoiceCallbackecommerceInvoiceCallback", data)
            await InvoiceRepo.setInvoiceStatus(data, "Pending")
        });
        client.on("ecommerceEstimateCallback", async (data, callback) => {
            data = JSON.parse(data)
            await EstimateRepo.setEstimateOnlineStatus(data, "Pending")
        });
        client.on("callCenterCallBack", async (data, callback) => {
            data = JSON.parse(data)
            await InvoiceRepo.setCallCenterInvoiceStatus(data, "Pending")
        });
    }

    // ========================= TABLE & TERMINAL EVENTS =========================
    private static registerTableTerminalEvents(client: Socket, branchId: any, decoded: any) {
        client.on("getTableQRurl", async (data, callback) => {
            await SocketTableRepo.getTableQR(client, data, branchId, callback)
        });
        client.on("savePayouts", async (data, callback) => {
            await PayOutSocketRepo.savePayout(client, data, branchId, callback)
        });
        client.on("saveTerminals", async (data, callback) => {
            await SocketTerminal.pushTerminals(client, data, branchId, decoded, callback)
        });
    }

    // ========================= INVENTORY EVENTS =========================
    private static registerInventoryEvents(client: Socket, branchId: any) {
        client.on("getSuppliers", async (data, callback) => {
            await SocketInventoryRequestRepo.getSuppliers(client, data, branchId, callback)
        });
        client.on("saveInventoryRequest", async (data, callback) => {
            await SocketInventoryRequestRepo.saveInventoryRequest(client, data, branchId, callback)
        });
        client.on("getInventoryRequests", async (data, callback) => {
            await SocketInventoryRequestRepo.getInventoryRequests(client, data, branchId, callback)
        });
        client.on("breakKit", async (data, callback) => {
            await SocketProductRepo.breakKit(client, data, branchId, callback)
        });
        client.on("getKitMaxQty", async (data, callback) => {
            await SocketProductRepo.getMaxQty(client, data, branchId, callback)
        });
        client.on("buildKit", async (data, callback) => {
            await SocketProductRepo.buildKit(client, data, branchId, callback)
        });
        client.on("seasonalPriceItems", async (data, callback) => {
            await SocketProductRepo.seasonalPriceItems(client, data, branchId, callback)
        });
        client.on("saveSeasonalPriceItems", async (data, callback) => {
            await SocketProductRepo.saveSeasonalPriceItems(client, data, branchId, callback)
        });
    }

    // ========================= BRAND & SHARING EVENTS =========================
    private static registerBrandSharingEvents(client: Socket, branchId: any) {
        client.on("getBrands", async (data, callback) => {
            await SocketProductRepo.getBrands(client, data, branchId, callback)
        });
        client.on("shareInvoice", async (data, callback) => {
            await SocketInvoiceRepo.shareInvoice(client, data, branchId, callback)
        });
    }

    // ========================= APPLIED CREDIT EVENTS =========================
    private static registerAppliedCreditEvents(client: Socket, branchId: any) {
        client.on("getAppliedCredits", async (data, callback) => {
            await SocketAppliedCredit.getAppliedCredits(client, data, branchId, callback)
        });
        client.on("recoverAppliedCredit", async (data, callback) => {
            await SocketAppliedCredit.recoverAppliedCredit(client, data, branchId, callback)
        });
        client.on("applyCredit:GetBalance", async (data, callback) => {
            await SocketAppliedCredit.getCreditNoteCredit(data, branchId, callback)
        });

        client.on("applyCredit:ApplyInvoiceCredit", async (data, callback) => {
            await SocketAppliedCredit.applyCreditNoteOnInvoice(data, branchId, callback)
        });
    }

    // ========================= MENU EVENTS =========================
    private static registerMenuEvents(client: Socket, branchId: any) {
        client.on("getMenuList", async (data, callback) => {
            await SocketMenu.getMenus2(client, data, branchId, callback)
        });
    }

    // ========================= EVENT LOGS (DELETED) EVENTS =========================
    private static registerEventLogsEvents(client: Socket, branchId: any) {
        client.on("getDeletedCreditNotes", async (data, callback) => {
            await EventLogsSocket.getDeletedCreditNotes(client, data, branchId, callback)
        });
        client.on("getDeletedInvoices", async (data, callback) => {
            await EventLogsSocket.getDeletedInvoices(client, data, branchId, callback)
        });
        client.on("getDeletedPayments", async (data, callback) => {
            await EventLogsSocket.getDeletedPayments(client, data, branchId, callback)
        });
        client.on("getDeletedAppliedCredits", async (data, callback) => {
            await EventLogsSocket.getDeletedAppliedCredits(client, data, branchId, callback)
        });
        client.on("getDeletedEstimates", async (data, callback) => {
            await EventLogsSocket.getDeletedEstimates(client, data, branchId, callback)
        });
    }

    // ========================= RESERVATION & WAITING LIST EVENTS =========================
    private static registerReservationWaitingListEvents(client: Socket, branchId: any) {
        client.on("saveReservations", async (data, callback) => {
            await ReservationSocket.saveReservations(client, data, branchId, callback)
        });
        client.on("recoverReservations", async (data, callback) => {
            await ReservationSocket.recoverReservations(client, data, branchId, callback)
        });
        client.on("saveWaitingList", async (data, callback) => {
            await WaitingListSocket.saveWaitingLists(client, data, branchId, callback)
        });
        client.on("saveAttendance", async (data, callback) => {
            await AttendanceSocket.saveAttendance(client, data, branchId, callback)
        });
        client.on("getPlacedReservations", async (data, callback) => {
            await ReservationSocket.getPalcedReservations(client, data, branchId, callback)
        });
        client.on("reservationsCallBack", async (data, callback) => {
            await ReservationSocket.setOnlineStatus(data, 'Pending')
        });
    }

    // ========================= ITEM & OPTION AVAILABILITY EVENTS =========================
    private static registerItemOptionAvailabilityEvents(client: Socket, branchId: any) {
        client.on("setItemAvailability", async (data, callback) => {
            await SocketProductRepo.setItemAvailability(client, data, branchId, callback)
        });
        client.on("getOptionsAvailability", async (data, callback) => {
            await SocketOption.getOptionsAvailability(client, data, branchId, callback)
        });
        client.on("updateOptionAvailability", async (data, callback) => {
            await SocketOption.updateOptionAvailability(client, data, branchId, callback)
        });
        client.on("getOptionsProductAvailability", async (data, callback) => {
            console.log("getItemsgetItemsgetItems22222", callback)
            await SocketOption.getOptionsProductAvailability(client, data, branchId, callback)
        });
        client.on("getInvoiceBuilder", async (data, callback) => {
            await SocketInvoiceRepo.getInvoiceBuilder(client, data, branchId, callback)
        });
    }

    // ========================= ECOMMERCE SETTINGS EVENTS =========================
    private static registerEcommerceSettingsEvents(client: Socket, branchId: any) {
        client.on("updateEcommerceSettings", async (data, callback) => {
            await SocketCompanyRepo.updateEcommerceSettings(client, data, branchId, callback)
        });
        client.on("getEcommerceSettings", async (data, callback) => {
            await SocketCompanyRepo.getEcommerceSettings(client, data, branchId, callback)
        });
    }

    // ========================= INVENTORY TRANSFER EVENTS =========================
    private static registerInventoryTransferEvents(client: Socket, branchId: any) {
        client.on("InventoryTransfer:getItems", async (data, callback) => {
            await SocketWastage.getItems(client, data, branchId, callback)
        });
        client.on("InventoryTransfer:save", async (data, callback) => {
            await SocketWastage.saveWastage(client, data, branchId, callback)
        });
        client.on("InventoryTransfer:get", async (data, callback) => {
            await SocketWastage.getWastage(client, data, branchId, callback)
        });

        client.on("InventoryTransfer:list", async (data, callback) => {
            await SocketWastage.getWastageList(client, data, branchId, callback)
        })
    }

    // ========================= DRIVER EVENTS =========================
    private static registerDriverEvents(client: Socket, branchId: any) {
        client.on("getAvailableDrivers", async (data, callback) => {
            await DriverSocketRepo.getAvailableDrivers(client, branchId, callback)
        });
        client.on("getDriverList", async (data, callback) => {
            await DriverSocketRepo.getDriverList(client, branchId, callback)
        });
    }

    // ========================= Watch EVENTS =========================
    private static registerInvoWatchEvents(client: Socket, branchId: any) {

        // Middleware to parse data if it's a JSON string
        const withJsonParse = (
            handler: (data: any, callback: CallableFunction) => Promise<void>
        ) => {
            return async (data: any, callback: CallableFunction) => {
                try {
                    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                    await handler(parsedData, callback);
                } catch (err: any) {
                    console.error("❌ Failed to parse data or execute handler:", err);
                    callback(JSON.stringify({ success: false, message: "Invalid input format or handler error", error: err.message }));
                }
            };
        };

        client.on("unpairDevice", withJsonParse(async (data, callback) => {
            await InvoWatchSocketRepo.unpairDevice(client, branchId, data, callback)
        }));
        client.on("pairDevice", withJsonParse(async (data, callback) => {
            await InvoWatchSocketRepo.completePairingConnection(client, data, branchId, callback)
        }));
        client.on("getPairedDevices", async (data, callback) => {
            await InvoWatchSocketRepo.getPairingListByBranch(client, branchId, callback)
        });
        client.on("sendNotification", withJsonParse(async (data, callback) => {
            await InvoWatchSocketRepo.sendNotification(client, branchId, data, callback)
        }));

    }

    //========================= Invoice Events ========================
    private static registerInvoiceEvents(client: Socket, branchId: any) {

        client.on("searchInvoices", async (data, callback) => {
            await SocketInvoiceRepo.searchInvoices(data, branchId, callback)
        });
        client.on("getInvoiceById", async (data, callback) => {
            await SocketInvoiceRepo.getInvoiceById(data, branchId, callback)
        });

        client.on("searchInvoiceById", async (data, callback) => {
            await SocketInvoiceRepo.searchInvoiceById(data, branchId, callback)
        });
    }



}