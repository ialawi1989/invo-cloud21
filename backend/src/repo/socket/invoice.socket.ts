import { DB } from "@src/dbconnection/dbconnection";
import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { InvoiceRepo } from "../app/accounts/invoice.repo";





import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { Invoice } from "@src/models/account/Invoice";
import { PoolClient } from "pg";
import { Customer } from "@src/models/account/Customer";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { CompanyRepo } from "../admin/company.repo";
import { AccountsRepo } from "../app/accounts/account.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { InvoiceLine } from "@src/models/account/InvoiceLine";
import { ProductRepo } from "../app/product/product.repo";
import { InvoiceInventoryMovmentRepo } from "../app/accounts/InvoiceInventoryMovment.repo";
import { InvoiceLineOption } from "@src/models/account/invoiceLineOption";
import { ViewQueue } from "@src/utilts/viewQueue";
import { CreditNoteRepo } from "../app/accounts/creditNote.Repo";
import { CreditNote } from "@src/models/account/CreditNote";
import { CreditNoteLine } from "@src/models/account/CreditNoteLine";
import { Company } from "@src/models/admin/company";
import { terminalRepo } from "../app/terminal/terminal.repo";

import { SocketCompanyRepo } from "./company.socket";
import { TriggerQueue } from "../triggers/triggerQueue";
import { grubtech } from "@src/Integrations/grubtech/grubtech";
import { SocketErrorLogs, SocketLogs } from "./socketErrorLogs";

import { ResponseData } from "@src/models/ResponseData";
import { InvoicEvents } from "../app/accounts/InvoiceEvents.repo";
import moment from "moment";
import { InvoiceStatuesQueue } from "../triggers/queue/workers/invoiceStatus.worker";
import { PaymentRepo } from "../ecommerce/pament.repo";
import { LogsManagmentRepo } from "../app/settings/LogSetting.repo";
import { CustomerBalanceQueue } from "../triggers/userBalancesQueue";
import { publishEvent } from "@src/utilts/system-events";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketInvoiceRepo {
    static redisClient: any;

    /**ALL CHECK IF ID EXIST WILL CHECK IF INVOICE/INVOICELINE/INVOICELINEOPTIONS EXIST THEN EDIT ELSE ADD NEW   */
    public static async checkIfInvoiceIdExist(client: PoolClient, invoiceId: string, branchId: string, createdAt: any) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "Invoices" WHERE id =$1 and "branchId"=$2 `,
                values: [invoiceId, branchId]
            }
            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true;
            } else {
                return false
            }
        } catch (error: any) {



            throw new Error(error)
        }
    }
    public static async checkIfInvoiceLineIdExist(client: PoolClient, invoiceLineId: string, invoiceId: string) {
        try {
            let invoiceLine_Id = invoiceLineId ? invoiceLineId : null

            const query: { text: string, values: any } = {
                text: `SELECT count(*),"invoiceId" from "InvoiceLines" where id=$1 group by "invoiceId"`,
                values: [invoiceLine_Id]
            }
            const count = await client.query(query.text, query.values as any)
            if (count.rows.length <= 0) {
                return false
            }
            return true
            // if (count.rows.length <= 0) {
            //     return { edit: false, add: true }
            // } else {
            //     let lineInvoiceId = count.rows[0].invoiceId;
            //     if (invoiceId == lineInvoiceId) {
            //         return { edit: true, add: false }
            //     } else {
            //         query.text = `UPDATE "InvoiceLines" set "invoiceId"=$1 where id =$2 `;
            //         query.values = [invoiceId, invoiceLineId]
            //         client.query(query.text, query.values)
            //         return { edit: false, add: false }
            //     }
            // }
        } catch (error: any) {



            throw new Error(error)
        }
    }
    public static async checkIfInvoiceLineOptionIdExist(client: PoolClient, invoiceLineOptionId: string, invoiceLineId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "InvoiceLineOptions" where id=$1 and "invoiceLineId"=$2`,
                values: [invoiceLineOptionId, invoiceLineId]
            }
            const count = await client.query(query.text, query.values)
            if (count.rows[0].count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {


            throw new Error(error)
        }
    }

    /**USED TO CHECK IF INVOICE HAS A CUSTOMER THEN ADD NEW CUSTOMER IF CUSTOMER DOSENT EXIST */
    public static async chekIfCustomerIdExists(client: PoolClient, customerId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "id" , "email" from "Customers" where id=$1 and "companyId" =$2 `,
                values: [customerId, companyId]
            }
            const customer = await client.query(query.text, query.values);

            return customer.rows[0]
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async isInvoicePaid(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select "PaymentMethods"."name", "InvoicePaymentLines"."amount" FROM "InvoicePaymentLines"
                       INNER JOIN "InvoicePayments" ON "InvoicePayments"."id" = "InvoicePaymentLines"."invoicePaymentId" and "InvoicePayments"."status" = 'SUCCESS'
                       inner join "PaymentMethods" on "PaymentMethods"."id" = "InvoicePayments"."paymentMethodId"  and "PaymentMethods"."name" <> 'Points' and "PaymentMethods"."name" <> 'Points'
                       where "invoiceId" = $1 `,
                values: [invoiceId]
            }
            let payments = await client.query(query.text, query.values);
            return payments.rows;
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getInvoiceOnlineStatus(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "onlineData"->>'onlineStatus' as "onlineStatus" from "Invoices" where id =$1`,
                values: [invoiceId]
            }

            let invoice = await client.query(query.text, query.values);
            return (<any>invoice.rows[0]).onlineStatus
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async validateProductId(client: PoolClient, productIds: any[], companyId: string) {
        try {

            let uniqueIds = [... new Set(productIds)]
            const query = {
                text: `select count(id) from "Products" where "companyId"=$1 and id=any($2)`,
                values: [companyId, uniqueIds]
            }

            let ids = await client.query(query.text, query.values);
            if (ids && ids.rows && ids.rows.length > 0 && ids.rows[0].count == uniqueIds.length) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async saveInvoice(
        client: Socket | null,
        data: any,
        branchId: string,
        callback: CallableFunction | null = null
    ) {
        const dBClient = await DB.excu.client(45);

        // ---------- helpers ----------
        const safeJsonParse = (v: any) => {
            if (v == null) return v;
            if (typeof v !== "string") return v;
            const s = v.trim();
            if (!s) return v;
            try { return JSON.parse(s); } catch { return v; }
        };

        const asDate = async (v: any) => (v ? await TimeHelper.convertToDate(v) : null);

        const hasValue = (v: any) =>
            v != null && String(v).trim() !== "" && String(v).trim() !== "null";

        const isVoidedLine = (line: any) =>
            Number(line?.qty ?? 0) < 0 && hasValue(line?.voidFrom);

        const lineDiscount = (line: any) => Number(line?.discountTotal ?? 0);

        type PublishItem = { name: string; payload: any };
        const eventsToPublish: PublishItem[] = [];

        const pushVoidedEvent = (meta: any, items: any[]) => {
            if (!items.length) return;
            eventsToPublish.push({
                name: "invoiceItemsVoided",
                payload: { ...meta, items },
            });
        };

        const pushDiscountEvent = (meta: any, items: any[]) => {
            if (!items.length) return;
            eventsToPublish.push({
                name: "invoiceItemsDiscountChanged",
                payload: { ...meta, items },
            });
        };

        const detectLineEvents = (oldLinesMap: Map<string, any>, newLines: any[]) => {
            const newVoidedLines: any[] = [];
            const discountChangedLines: any[] = [];

            for (const nl of newLines) {
                if (!nl?.id) continue;

                const old = oldLinesMap.get(nl.id);

                // ---- VOID (only new void) ----
                const voidNow = isVoidedLine(nl);
                if (voidNow) {
                    const wasVoidedBefore = old ? isVoidedLine(old) : false;

                    // ✅ only NEW voided line:
                    // - doesn't exist before OR existed but was not voided before
                    if (!old || !wasVoidedBefore) {
                        newVoidedLines.push({
                            id: nl.id,
                            productId: nl.productId,
                            qty: nl.qty,
                            voidFrom: nl.voidFrom,
                            price: nl.price,
                            total: nl.total,
                            notes: nl.notes,
                        });
                    }
                }

                // ---- DISCOUNT change ----
                // requirements: old discountAmount <> new discountAmount
                // for new invoice (old missing) we treat as "added" if newDisc != 0
                const newDisc = lineDiscount(nl);
                const oldDisc = old ? lineDiscount(old) : 0;

                if (!old) {
                    // new line (new invoice / new line in existing invoice)
                    if (newDisc !== 0) {
                        discountChangedLines.push({
                            id: nl.id,
                            productId: nl.productId,
                            qty: nl.qty,
                            price: nl.price,
                            total: nl.total,
                            oldDiscountAmount: 0,
                            newDiscountAmount: newDisc,
                            changeType: "added",
                        });
                    }
                } else if (oldDisc !== newDisc) {
                    discountChangedLines.push({
                        id: nl.id,
                        productId: nl.productId,
                        qty: nl.qty,
                        price: nl.price,
                        total: nl.total,
                        oldDiscountAmount: oldDisc,
                        newDiscountAmount: newDisc,
                        changeType: newDisc === 0 ? "removed" : oldDisc === 0 ? "added" : "updated",
                    });
                }
            }

            return { newVoidedLines, discountChangedLines };
        };

        try {
            await dBClient.query("BEGIN");

            const branchCompanyRes = await BranchesRepo.getBranchCompanyId(dBClient, branchId);
            const companyId = branchCompanyRes?.compayId;
            if (!companyId) throw new Error("CompanyId not found for branch");

            const branchInfo = (await BranchesRepo.getBranchById(branchId, companyId)).data;

            const invoices: any[] = Array.isArray(data) ? data : safeJsonParse(data);
            if (!Array.isArray(invoices)) throw new Error("Invalid invoices payload: expected array");

            const excludedIds = new Set<string>();
            const invoiceIds = new Set<string>();
            const notificationInvoices: Array<{ id: string; status: string }> = [];
            const updateStatusInvoiceIds = new Set<string>();
            const customerIds = new Set<string>();

            for (let index = 0; index < invoices.length; index++) {
                const element: any = invoices[index];
                if (!element) continue;

                element.branchId = branchId;
                element.companyId = companyId;

                // parse customerAddress
                if (typeof element.customerAddress === "string") {
                    element.customerAddress = element.customerAddress.trim() === "" ? null : safeJsonParse(element.customerAddress);
                } else if (element.customerAddress === "") {
                    element.customerAddress = null;
                }

                // validate invoice id
                if (!hasValue(element.id)) {
                    const socketLogs = new SocketLogs();
                    socketLogs.compnayId = companyId;
                    socketLogs.branchId = branchId;
                    socketLogs.dbTable = "Invoice";
                    socketLogs.referenceId = element?.invoiceNumber ?? "UNKNOWN";
                    socketLogs.logs.push({ error: "Invoice Id Is empty", data: element });
                    await SocketErrorLogs.setLogs(dBClient, socketLogs);
                    continue;
                }

                // validate line ids
                const lines = Array.isArray(element.lines) ? element.lines : [];
                const emptyLines = lines.filter((f: any) => !hasValue(f?.id));
                if (emptyLines.length) {
                    const socketLogs = new SocketLogs();
                    socketLogs.compnayId = companyId;
                    socketLogs.branchId = branchId;
                    socketLogs.dbTable = "Invoice";
                    socketLogs.referenceId = element.id;
                    socketLogs.logs.push({ error: "Invoice Line Id Is empty", data: element });
                    await SocketErrorLogs.setLogs(dBClient, socketLogs);
                    continue;
                }

                // collect customer id
                if (hasValue(element.customerId)) customerIds.add(element.customerId);
                else element.customerId = null;

                // customer upsert (guard element.customer)
                if (element.customerId) {
                    const customerTemp = await this.chekIfCustomerIdExists(dBClient, element.customerId, companyId);
                    const incomingCustomer = element.customer ?? {};
                    element.customerEmail = incomingCustomer?.email ? incomingCustomer.email : customerTemp?.email;

                    const customer = new Customer();
                    customer.ParseJson(incomingCustomer);
                    customer.birthDay = customer.birthDay ? TimeHelper.convertToDate(customer.birthDay) : null;
                    customer.name =
                        (customer.name ?? "").trim() === ""
                            ? customer.phone != null && customer.phone !== ""
                                ? customer.phone
                                : "Customer"
                            : customer.name;

                    customer.addresses = [];
                    customer.id = element.customerId;

                    if (!customerTemp?.id) {
                        if (element.customerAddress != null && element.customerAddress !== "") customer.addresses.push(element.customerAddress);
                        await CustomerRepo.addPosCustomer(dBClient, customer, companyId);
                    } else {
                        await this.editCustomer(dBClient, customer, element.customerAddress);
                    }
                }

                // productIds per invoice
                const productIds = lines.filter((f: any) => f?.productId).map((m: any) => m.productId);

                // convert timestamps
                element.createdAt = await asDate(element.createdAt);
                element.invoiceDate = await asDate(element.invoiceDate);
                element.updatedDate = await asDate(element.updateTime);

                // validate productIds exist
                const isLineProductIdExist = await this.validateProductId(dBClient, productIds, companyId);
                if (!isLineProductIdExist) {
                    const socketLogs = new SocketLogs();
                    socketLogs.compnayId = companyId;
                    socketLogs.branchId = branchId;
                    socketLogs.dbTable = "Invoice";
                    socketLogs.referenceId = element.id;
                    socketLogs.logs.push({ error: "Product Id not Presented In DB", data: element });
                    await SocketErrorLogs.setLogs(dBClient, socketLogs);
                    continue;
                }

                // excluded ids logic (fixed date compare)
                if (branchId === "cbafe464-a6c0-4f03-ba58-67bc0e62bef0" && element.createdAt) {
                    if (moment(element.createdAt).startOf("day").isBefore(moment().startOf("day"))) {
                        excludedIds.add(element.id);
                    }
                }

                updateStatusInvoiceIds.add(element.id);

                const meta = {
                    invoiceId: element.id,
                    invoiceNumber: element.invoiceNumber,
                    branchId: element.branchId,
                    companyId,
                    branchInfo,
                    updatedAt: element.updatedDate ?? new Date(),
                    customerEmail: element.customerEmail
                };

                const isInvoiceIdExist = await this.checkIfInvoiceIdExist(dBClient, element.id, element.branchId, element.createdAt);

                if (isInvoiceIdExist) {
                    // ---- OLD snapshot for lines (before edit) ----
                    const oldLinesRes = await dBClient.query(
                        `SELECT id, qty, "voidFrom", "discountAmount","discountTotal", "productId", price, total
                                FROM "InvoiceLines"
                                WHERE "invoiceId" = $1`,
                        [element.id]
                    );

                    const oldLines = oldLinesRes.rows || [];
                    const oldLinesMap = new Map<string, any>();

                    for (const l of oldLines) oldLinesMap.set(l.id, l);

                    let allLines: any[] = [...lines];
                    for (let index = 0; index < lines.length; index++) {
                        const element = lines[index];
                        allLines.push(...element.voidedItems)
                    }

                    // detect events (void + discount changes)
                    const { newVoidedLines, discountChangedLines } = detectLineEvents(oldLinesMap, allLines);

                    // ---- existing logic for status/source ----
                    const invoiceStatusAndSource = await InvoiceRepo.getInvoiceSource(dBClient, element.id);

                    element.currentInvoiceStatus = invoiceStatusAndSource.onlineStatus;
                    element.source = invoiceStatusAndSource.source;
                    element.oldReadyTime = invoiceStatusAndSource.readyTime;
                    element.oldTableId = invoiceStatusAndSource.tableId;

                    if (element.onlineStatus === "Rejected" && !element.isPaid) {
                        element.status = "Closed";
                    } else if (element.onlineStatus === "Pending" || element.onlineStatus === "Pending Payments") {
                        element.status = "Draft";
                    } else {
                        element.status = "Open";
                    }

                    if (element.currentInvoiceStatus !== element.onlineStatus) {
                        notificationInvoices.push({ id: element.id, status: element.onlineStatus });
                    }

                    const upsertNotif = (status: string) => {
                        const idx = notificationInvoices.findIndex((x) => x.id === element.id);
                        if (idx > -1) notificationInvoices[idx].status = status;
                        else notificationInvoices.push({ id: element.id, status });
                    };

                    if (invoiceStatusAndSource.readyTime == null && element.readyTime) upsertNotif("Ready");
                    if (invoiceStatusAndSource.departureTime == null && element.departureTime) upsertNotif("Departure");
                    if (invoiceStatusAndSource.arrivalTime == null && element.arrivalTime) upsertNotif("Delivered");

                    const isPendingToDecision =
                        (element.currentInvoiceStatus === "Pending" && element.onlineStatus === "Rejected") ||
                        (element.currentInvoiceStatus === "Pending" && element.onlineStatus === "Accepted");

                    if (isPendingToDecision) {
                        if (element.source === "Online" && hasValue(element.aggregator) && hasValue(element.aggregatorId)) {
                            const updateStatus = await grubtech.updateGrubtechInvoiceStatus(dBClient, element.id, element.onlineStatus, companyId);
                            if (updateStatus && !updateStatus.success) {
                                await this.updateGrubTechData(dBClient, element.id, updateStatus.msg ?? null);
                            }
                        }

                        if (element.onlineStatus === "Accepted") {
                            eventsToPublish.push({ name: "invoiceAccepted", payload: { ...element, branchInfo } });
                        } else if (element.onlineStatus === "Rejected") {
                            eventsToPublish.push({ name: "invoiceRejected", payload: { ...element, branchInfo } });
                        }
                    }

                    // apply edit
                    await this.editInvoice(dBClient, element);

                    // decide invoiceIds to trigger inventory/journal
                    if (isPendingToDecision || element.source === "POS") invoiceIds.add(element.id);

                    // ---- enqueue events (publish after COMMIT) ----
                    this.invoiceChangesEvent(element, allLines, oldLines, companyId)
                    pushVoidedEvent(meta, newVoidedLines);
                    pushDiscountEvent(meta, discountChangedLines);
                } else {
                    // ---- NEW invoice: still detect void + discounts from lines ----
                    const emptyOldMap = new Map<string, any>();
                    const { newVoidedLines, discountChangedLines } = detectLineEvents(emptyOldMap, lines);

                    if (hasValue(element.invoiceNumber)) {
                        const isInvoiceNumberExist = await InvoiceRepo.checkIsInvoiceNumberExist(dBClient, null, element.invoiceNumber, companyId);
                        if (isInvoiceNumberExist) element.invoiceNumber = await this.generateInvoiceNumber(dBClient, companyId, element.invoiceNumber);
                    }

                    element.source = "POS";
                    element.status = element.onlineStatus === "Pending" || element.onlineStatus === "Pending Payments" ? "Draft" : "Open";
                    invoiceIds.add(element.id);

                    await this.addInvoice(dBClient, element, companyId);

                    // events for new invoice too
                    pushVoidedEvent(meta, newVoidedLines);
                    pushDiscountEvent(meta, discountChangedLines);
                }
            }

            const getCompanyNotification = {
                text: `SELECT id
                    FROM "Companies"
                    WHERE id = $1
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text("features") f
                        WHERE lower(f) = 'notifications'
                    )`,
                values: [companyId],
            }

            const companyNotification = await dBClient.query(getCompanyNotification.text, getCompanyNotification.values)
            const cNotification = companyNotification.rows.length > 0 ? companyNotification.rows[0] : null


            await dBClient.query("COMMIT");

            // ---------------- AFTER COMMIT ----------------
            // filter excluded branch ids
            const invoiceIdList = [...invoiceIds].filter((id) => !excludedIds.has(id));
            const updateStatusList = [...updateStatusInvoiceIds].filter((id) => !excludedIds.has(id));
            const notificationList = notificationInvoices.filter((x) => !excludedIds.has(x.id));

            const queueInstance = TriggerQueue.getInstance();

            if (invoiceIdList.length) {
                invoiceIdList.forEach((id) => {
                    queueInstance.createJob({ type: "Invoices", id: [id], companyId });
                    queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [id] });
                    queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [id] });
                });
            }

            if (updateStatusList.length) {
                updateStatusList.forEach((id) => {
                    InvoiceStatuesQueue.get().createJob({ id } as any);
                });
            }

            if (notificationList.length) {
                notificationList.forEach((x) => {
                    queueInstance.createJob({ type: "pushNotifictios", invoiceIds: [x] });
                });
            }

            if (notificationInvoices.length) {
                notificationInvoices.forEach(async (element) => {
                    await publishEvent("OrderOnlineStatusChanged", { invoiceId: element.id, status: element.status, companyId: companyId })
                });
            }

            if (customerIds.size) {
                const userBalancesQueue = CustomerBalanceQueue.getInstance();
                [...customerIds].forEach((userId) => {
                    userBalancesQueue.createJob({ userId, dbTable: "Invoices" });
                });
            }

            // publish all events after commit (safe)
            // also respect excluded invoices if needed
            for (const e of eventsToPublish) {
                const invoiceId = e?.payload?.invoiceId ?? e?.payload?.id;
                if (invoiceId && excludedIds.has(invoiceId)) continue;
                if (cNotification) {
                    await publishEvent(e.name, e.payload);
                }
            }

            // refresh views
            ViewQueue.getQueue().pushJob();

            // callback/return last (so nothing gets skipped)
            if (callback) {
                callback(JSON.stringify({ success: true }));
                return;
            }
            return new ResponseData(true, "", { companyId });
        } catch (error: any) {
            /**rollback client */
            console.warn(error)

            await dBClient.query("ROLLBACK")


                ;

            if (callback) {
                callback(JSON.stringify({ success: false, error: error?.message ?? String(error) }));
                return;
            }
            return new ResponseData(false, error?.message ?? "", []);
        } finally {
            dBClient.release();
        }
    }

    public static async addInvoice(client: PoolClient, data: any, companyId: string) {
        try {
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)

            const invoice = new Invoice();
            invoice.ParseJson(data);
            invoice.calculateTotal(afterDecimal);
            invoice.calaculateBalance();
            invoice.setlogs([])
            invoice.companyId = companyId
            /**CHECK NUMBER IF EXIST */
            // if (invoice.invoiceNumber) {

            //     const isInvoiceNumberExist = await InvoiceRepo.checkIsInvoiceNumberExist(client, null, invoice.invoiceNumber, companyId);

            //     if (isInvoiceNumberExist) {
            //         throw new Error("Invoice Number Already Used")
            //     }
            // }

            /**IF customerAddress IS NOT OBJECT SET TO NULL */
            if (invoice.customerAddress && invoice.customerAddress != "" && typeof invoice.customerAddress == 'string') {
                invoice.customerAddress = JSON.parse(invoice.customerAddress);
            } else if (invoice.customerAddress == "") {
                invoice.customerAddress = null
            }

            invoice.terminalId = invoice.terminalId == "" ? null : invoice.terminalId;

            /** ADD NEW CUSTOMER IF NOT EXIST */
            // if (invoice.customerId != null && invoice.customerId != "" && invoice.customerId != "null") {
            //     const isCustomerIdExist = await this.chekIfCustomerIdExists(client, invoice.customerId, companyId)
            //     const customer = new Customer();
            //     customer.ParseJson(invoice.customer);
            //     customer.birthDay = customer.birthDay ? TimeHelper.convertToDate(customer.birthDay) : null;
            //     customer.name = customer.name.trim() == "" ? customer.phone != null && customer.phone != "" ? customer.phone : "Customer" : customer.name;
            //     customer.addresses = [];
            //     customer.id = invoice.customerId;

            //     if (!isCustomerIdExist) {
            //         if (invoice.customerAddress != null && invoice.customerAddress != '') {
            //             customer.addresses.push(invoice.customerAddress);
            //         }
            //         await CustomerRepo.addPosCustomer(client, customer, companyId)
            //     } else {
            //         await this.editCustomer(client, customer, invoice.customerAddress,);
            //     }
            // } else {
            //     invoice.customerId = null
            // }

            if (invoice.chargeId == "") {
                invoice.chargeId = null;
            }

            if (invoice.terminalId == "") {
                invoice.terminalId = null;
            }
            /** CONVERT TIMES TO DATE FORMAT */
            invoice.printTime = invoice.printTime ? TimeHelper.convertToDate(invoice.printTime) : null;
            invoice.readyTime = invoice.readyTime ? TimeHelper.convertToDate(invoice.readyTime) : null;
            invoice.departureTime = invoice.departureTime ? TimeHelper.convertToDate(invoice.departureTime) : null;
            invoice.arrivalTime = invoice.arrivalTime ? TimeHelper.convertToDate(invoice.arrivalTime) : null;
            invoice.scheduleTime = invoice.scheduleTime ? TimeHelper.convertToDate(invoice.scheduleTime) : null;
            invoice.onlineActionTime = invoice.onlineActionTime ? TimeHelper.convertToDate(invoice.onlineActionTime) : null;
            invoice.guests = invoice.guests && invoice.guests > 99 ? 1 : invoice.guests
            invoice.onlineData.onlineStatus = invoice.onlineStatus
            /**ADD INVOICE QUERY */
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Invoices" ( id,
                                                      "invoiceNumber",
                                                       "refrenceNumber",
                                                        total,
                                                        note,
                                                        guests,
                                                        "employeeId",
                                                        "tableId",
                                                        "branchId",
                                                         source,
                                                         "serviceId",
                                                         "customerId" ,
                                                         "customerAddress",
                                                         "customerContact",
                                                         "customerLatLang",
                                                         "createdAt",
                                                         "estimateId",
                                                         status,
                                                         "discountTotal",
                                                         "chargeTotal",
                                                         "chargeAmount",
                                                         "chargePercentage",
                                                         "chargeId",
                                                         "discountAmount",
                                                         "discountPercentage",
                                                         "discountId",
                                                         "deliveryCharge",
                                                         "subTotal",
                                                         "scheduleTime",
                                                         "mergeWith",
                                                         "invoiceDate",
                                                         "terminalId",
                                                         "roundingType",
                                                         "roundingTotal",
                                                         "smallestCurrency",
                                                         "isInclusiveTax",
                                                         "printTime",
                                                         "readyTime",
                                                         "departureTime",
                                                         "arrivalTime",
                                                         "driverId",
                                                         "onlineActionTime",
                                                        "discountType",
                                                        "aggregator",
                                                        "aggregatorId",
                                                        "logs",
                                                        "chargeType",
                                                        "chargesTaxDetails",
                                                        "onlineData",
                                                        "companyId"
                                                         ) 
                                               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50) RETURNING id `,
                values: [
                    invoice.id,
                    invoice.invoiceNumber,
                    invoice.refrenceNumber,
                    invoice.total,
                    invoice.note,
                    invoice.guests,
                    invoice.employeeId,
                    invoice.tableId,
                    invoice.branchId,
                    invoice.source,
                    invoice.serviceId,
                    invoice.customerId,
                    invoice.customerAddress,
                    invoice.customerContact,
                    invoice.customerLatLang,
                    invoice.createdAt,
                    invoice.estimateId,
                    invoice.status,
                    invoice.discountTotal,
                    invoice.chargeTotal,
                    invoice.chargeAmount,
                    invoice.chargePercentage,
                    invoice.chargeId,
                    invoice.discountAmount,
                    invoice.discountPercentage,
                    invoice.discountId,
                    invoice.deliveryCharge,
                    invoice.subTotal,
                    invoice.scheduleTime,
                    invoice.mergeWith,
                    invoice.invoiceDate,
                    invoice.terminalId,
                    invoice.roundingType,
                    invoice.roundingTotal,
                    invoice.smallestCurrency,
                    invoice.isInclusiveTax,
                    invoice.printTime,
                    invoice.readyTime,
                    invoice.departureTime,
                    invoice.arrivalTime,
                    invoice.driverId,
                    invoice.onlineActionTime,
                    invoice.discountType,
                    invoice.aggregator,
                    invoice.aggregatorId,
                    JSON.stringify(invoice.logs),
                    invoice.chargeType,
                    invoice.chargesTaxDetails,
                    invoice.onlineData,
                    invoice.companyId
                ]
            }
            await client.query(query.text, query.values);


            for (let index = 0; index < invoice.lines.length; index++) {
                const invoiceLine = invoice.lines[index];
                invoiceLine.branchId = invoice.branchId
                invoiceLine.companyId = invoice.companyId
                invoiceLine.index = index
                invoiceLine.employeeId = invoiceLine.employeeId ?? invoice.employeeId
                /**INSERT INVOICE LINE */
                await this.addInvoiceLine(client, invoiceLine, invoice, afterDecimal)
                /**INSERT LINE VOIDED ITEMS AS INVOICE LINES */
                if (invoiceLine.voidedItems && invoiceLine.voidedItems.length > 0) {
                    for (let index = 0; index < invoiceLine.voidedItems.length; index++) {

                        const element = invoiceLine.voidedItems[index];
                        const voidItem = new InvoiceLine();
                        voidItem.branchId = invoice.branchId
                        voidItem.companyId = invoice.companyId
                        voidItem.ParseJson(element)
                        await this.addInvoiceLine(client, voidItem, invoice, afterDecimal)

                        if (element.subItems && element.subItems.length > 0) {
                            for (let index = 0; index < invoiceLine.subItems.length; index++) {
                                const elementSub = invoiceLine.subItems[index];
                                const subItem = new InvoiceLine();
                                subItem.ParseJson(elementSub)
                                subItem.parentUsages = element.qty;
                                subItem.branchId = invoice.branchId
                                subItem.companyId = invoice.companyId;
                                subItem.price = 0
                                subItem.total = 0
                                subItem.subTotal = 0;
                                subItem.taxTotal = 0;
                                (subItem.options || []).forEach((e: any) => { e.price = 0 })
                                await this.addInvoiceLine(client, subItem, invoice, afterDecimal)
                            }
                        }
                    }
                }

                /**INSERT LINE subItems ITEMS AS INVOICE LINES */
                if (invoiceLine.subItems && invoiceLine.subItems.length > 0) {
                    for (let index = 0; index < invoiceLine.subItems.length; index++) {
                        const element = invoiceLine.subItems[index];
                        const subItem = new InvoiceLine();
                        subItem.ParseJson(element)
                        subItem.parentUsages = invoiceLine.qty;
                        subItem.branchId = invoice.branchId
                        subItem.companyId = invoice.companyId
                        subItem.price = 0
                        subItem.total = 0
                        subItem.subTotal = 0;
                        subItem.taxTotal = 0;
                        (subItem.options || []).forEach((e: any) => { e.price = 0 })
                        await this.addInvoiceLine(client, subItem, invoice, afterDecimal)
                    }
                }

            }

        } catch (error: any) {
            console.warn(error)
          
            
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "SaveInvoice")
            throw new Error(JSON.stringify({ branchId: data.branchId, error: error.message, invoiceId: data.id }))
        }
    }

    public static async getInvoiceLogs(client: PoolClient, invoiceId: string) {
        try {
            const query = {
                text: `SELECT "logs" FROM "Invoices" where id=$1`,
                values: [invoiceId]
            }

            let invoiceLog = await client.query(query.text, query.values);

            return invoiceLog.rows && invoiceLog.rows.length > 0 && invoiceLog.rows[0] && invoiceLog.rows[0].logs ? invoiceLog.rows[0].logs : []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editInvoice(client: PoolClient, data: any) {

        try {


            const company = new Company();
            let companyInfo = await SocketCompanyRepo.getCompanyInfo(client, data.branchId);
            company.ParseJson(companyInfo);
            let afterDecimal = await CompanyRepo.getCountryAfterDecimal(company.country)
            company.afterDecimal = afterDecimal
            const companyId = company.id;
            const invoice = new Invoice();
            invoice.ParseJson(data);
            invoice.calculateTotal(afterDecimal);
            invoice.companyId = companyId
            invoice.guests = invoice.guests && invoice.guests > 99 ? 1 : invoice.guests
            // let invoicLogs = await this.getInvoiceLogs(client, invoice.id)
            // invoice.setlogs(invoicLogs) /** merge new pos logs + old logs */
            if (invoice.logs) {
                invoice.parsePosLogs()
                await LogsManagmentRepo.manageLogs(client, "Invoices", invoice.id, invoice.logs, invoice.branchId, companyId, invoice.employeeId, invoice.invoiceNumber, 'POS');
            }

            if (invoice.id == "" || invoice.id == null) {
                throw new Error("Invoice Id is Required")
            }


            if (invoice.aggregatorId == "") {
                invoice.aggregatorId = null;
            }
            if (invoice.chargeId == "") {
                invoice.chargeId = null;
            }



            if (invoice.terminalId == "") {
                invoice.terminalId = null;
            }

            // if (invoice.customerId != null && invoice.customerId != "" && invoice.customerId != "null") {
            //     const isCustomerIdExist = await this.chekIfCustomerIdExists(client, invoice.customerId, companyId)
            //     const customer = new Customer();
            //     customer.ParseJson(invoice.customer);
            //     customer.birthDay = customer.birthDay ? await TimeHelper.convertToDate(customer.birthDay) : null;
            //     customer.name = customer.name.trim() == "" ? customer.phone != null && customer.phone != "" ? customer.phone : "Customer" : customer.name;
            //     customer.id = invoice.customerId
            //     if (!isCustomerIdExist) {
            //         if (invoice.customerAddress != null && invoice.customerAddress != '') {
            //             customer.addresses.push(invoice.customerAddress)
            //         }
            //         await CustomerRepo.addPosCustomer(client, customer, companyId)

            //     } else {
            //         await this.editCustomer(client, customer, invoice.customerAddress,);

            //     }
            // } else {
            //     invoice.customerId = null
            // }



            /** CONVERT TIMES TO DATE FORMAT */
            invoice.printTime = invoice.printTime ? await TimeHelper.convertToDate(invoice.printTime) : null;
            invoice.readyTime = invoice.readyTime ? await TimeHelper.convertToDate(invoice.readyTime) : null;
            invoice.departureTime = invoice.departureTime ? await TimeHelper.convertToDate(invoice.departureTime) : null;
            invoice.arrivalTime = invoice.arrivalTime ? await TimeHelper.convertToDate(invoice.arrivalTime) : null;
            invoice.scheduleTime = invoice.scheduleTime ? await TimeHelper.convertToDate(invoice.scheduleTime) : null;
            invoice.onlineActionTime = invoice.onlineActionTime ? await TimeHelper.convertToDate(invoice.onlineActionTime) : null;


            if (invoice.oldReadyTime == null && invoice.readyTime != null) {
                //send Event 
                await InvoicEvents.onOrderPrepared(client, invoice);
            }
            /**UPDATE INVOICE QUERY */
            const query: { text: string, values: any } = {
                text: `UPDATE  "Invoices" SET  "invoiceNumber"=$1,
                                                       "refrenceNumber"=$2,
                                                       total=$3,
                                                       note=$4,
                                                       guests=$5,
                                                       "tableId"=$6,
                                                       "discountTotal"=$7,
                                                       "chargeTotal"=$8,
                                                       "chargeAmount"=$9,
                                                       "chargePercentage"=$10,
                                                       "chargeId"=$11,
                                                       "discountAmount"=$12,
                                                       "discountPercentage"=$13,
                                                       "discountId"=$14,
                                                       "deliveryCharge"=$15,
                                                       "subTotal"=$16,
                                                       "scheduleTime"=$17,
                                                       "mergeWith"=$18,
                                                       "invoiceDate"=$19,
                                                       "isInclusiveTax"=$20,
                                                       "printTime"=$21,
                                                       "readyTime"=$22,
                                                       "departureTime"=$23,
                                                       "arrivalTime"=$24,
                                                       "driverId"=$25,
                                                       "employeeId"=$26,
                                                       "onlineData" = jsonb_set(
                                                        jsonb_set("onlineData", '{rejectReason}', to_jsonb($27::text)),
                                                        '{onlineStatus}',
                                                        to_jsonb($28::text)
                                                    ),
                                                    "status"=$29,
                                                    "onlineActionTime" = $30,
                                                    "customerAddress" = $31,
                                                    "customerId" = $32,
                                                    "customerContact" = $33,
                                                    "discountType" = $34,
                                                    "aggregator"=$35,
                                                    "aggregatorId"=$36,
                                                    "chargeType"=$37,
                                                    "chargesTaxDetails"=$38,                                         
                                                    "serviceId"=$39,
                                                    "terminalId" = $40                                      
                                           WHERE  id=$41 AND "branchId"=$42`,
                values: [invoice.invoiceNumber,
                invoice.refrenceNumber,
                invoice.total,
                invoice.note,
                invoice.guests,
                invoice.tableId,
                invoice.discountTotal,
                invoice.chargeTotal,
                invoice.chargeAmount,
                invoice.chargePercentage,
                invoice.chargeId,
                invoice.discountAmount,
                invoice.discountPercentage,
                invoice.discountId,
                invoice.deliveryCharge,
                invoice.subTotal,
                invoice.scheduleTime,
                invoice.mergeWith,
                invoice.createdAt,
                invoice.isInclusiveTax,
                invoice.printTime,
                invoice.readyTime,
                invoice.departureTime,
                invoice.arrivalTime,
                invoice.driverId,
                invoice.employeeId,
                invoice.rejectReason,
                invoice.onlineStatus,
                invoice.status,
                invoice.onlineActionTime,
                invoice.customerAddress,
                invoice.customerId,
                invoice.customerContact,
                invoice.discountType,
                invoice.aggregator,
                invoice.aggregatorId,
                invoice.chargeType,
                invoice.chargesTaxDetails,
                invoice.serviceId,
                invoice.terminalId,
                invoice.id,
                invoice.branchId]
            }


            await client.query(query.text, query.values);
            for (let index = 0; index < invoice.lines.length; index++) {
                const invoiceLine = invoice.lines[index];
                invoiceLine.branchId = invoice.branchId
                invoiceLine.companyId = invoice.companyId
                invoiceLine.index = index
                invoiceLine.employeeId = invoiceLine.employeeId ?? invoice.employeeId
                await this.addInvoiceLine(client, invoiceLine, invoice, afterDecimal)
                /**INSERT LINE VOIDED ITEMS AS INVOICE LINES */
                if (invoiceLine.voidedItems && invoiceLine.voidedItems.length > 0) {
                    for (let index = 0; index < invoiceLine.voidedItems.length; index++) {
                        const element = invoiceLine.voidedItems[index];
                        const voidItem = new InvoiceLine();
                        voidItem.ParseJson(element)
                        voidItem.branchId = invoice.branchId
                        voidItem.companyId = invoice.companyId
                        await this.addInvoiceLine(client, voidItem, invoice, afterDecimal)

                        if (element.subItems && element.subItems.length > 0) {
                            for (let index = 0; index < invoiceLine.subItems.length; index++) {
                                const elementSub = invoiceLine.subItems[index];
                                const subItem = new InvoiceLine();
                                subItem.ParseJson(elementSub)
                                subItem.parentUsages = element.qty;
                                subItem.branchId = invoice.branchId
                                subItem.companyId = invoice.companyId;
                                subItem.price = 0
                                subItem.total = 0
                                subItem.subTotal = 0;
                                subItem.taxTotal = 0;
                                (subItem.options || []).forEach((e: any) => { e.price = 0 })
                                await this.addInvoiceLine(client, subItem, invoice, afterDecimal)
                            }
                        }


                    }
                }
                /**INSERT LINE subItems ITEMS AS INVOICE LINES */
                if (invoiceLine.subItems && invoiceLine.subItems.length > 0) {
                    for (let index = 0; index < invoiceLine.subItems.length; index++) {
                        const subItems = invoiceLine.subItems[index];
                        const subItem = new InvoiceLine();
                        subItem.ParseJson(subItems)
                        subItem.parentUsages = invoiceLine.qty;
                        subItem.branchId = invoice.branchId
                        subItem.companyId = invoice.companyId
                        subItem.price = 0
                        subItem.total = 0
                        subItem.subTotal = 0;
                        subItem.taxTotal = 0;
                        (subItem.options || []).forEach((e: any) => { e.price = 0 })
                        await this.addInvoiceLine(client, subItem, invoice, afterDecimal)
                    }
                }
                // /**INSERT LINE Options */
                // if (invoiceLine.options && invoiceLine.options.length > 0) {
                //     for (let index = 0; index < invoiceLine.options.length; index++) {
                //         const option = invoiceLine.options[index];
                //         const isOptionIdExist = await this.checkIfInvoiceLineOptionIdExist(client, option.id, invoiceLine.id)
                //         if (isOptionIdExist) {
                //             await this.editLineOptions(client, option)
                //         } else {
                //             await this.addLineOptions(client, option)
                //         }

                //     }
                // }
            }

            //const company = new Company();
            company.id = companyId;
            company.afterDecimal = afterDecimal;
            const payments = await this.isInvoicePaid(client, invoice.id)
            const hasPoints = invoice.pointsDiscount;
            const hasCoupon = invoice.couponId;
            const hasOtherPayments = payments && payments.length > 0;
            if (invoice.currentInvoiceStatus == "Pending" && invoice.onlineStatus == "Rejected") {
                if (hasPoints) await PaymentRepo.refundPoints(client, invoice.id, company);
                if (hasCoupon) await PaymentRepo.reActiveCoupon(client, invoice.id, company);
                if (hasOtherPayments) { await this.creatCreditNote(client, invoice, company) }
            }

        } catch (error: any) {
            console.warn(error)
          
            
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "editInvoice")
            throw new Error(JSON.stringify({ branchId: data.branchId, error: error.message, invoiceId: data.id }))
        }
    }

    public static async getCharegAccount(client: PoolClient, companyId: string) {
        try {
            const query = {
                text: `SELECT id from "Accounts" where "companyId" =$1  and "name" = 'Charges Income' and "default" = true`,
                values: [companyId]
            }

            let accounts = await client.query(query.text, query.values);
            return accounts.rows && accounts.rows.length > 0 ? accounts.rows[0].id : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addInvoiceLine(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {

            invoiceLine.invoiceId = invoice.id;
            invoiceLine.branchId = invoice.branchId;
            invoiceLine.companyId = invoice.companyId;

            /**CONVERT LINE DATES TO DATE FORMAT */
            invoiceLine.createdAt = await TimeHelper.convertToDate(invoiceLine.createdAt)
            invoiceLine.serviceDate = await TimeHelper.convertToDate(invoiceLine.serviceDate)
            invoiceLine.holdTime = invoiceLine.holdTime ? await TimeHelper.convertToDate(invoiceLine.holdTime) : null
            invoiceLine.printTime = invoiceLine.printTime ? await TimeHelper.convertToDate(invoiceLine.printTime) : null
            invoiceLine.readyTime = invoiceLine.readyTime ? await TimeHelper.convertToDate(invoiceLine.readyTime) : null

            /**SET LINE ACCOUNT ID TO DEFAULT SALES ACCOUNT */
            if (invoiceLine.chargeType && invoiceLine.chargeType != "" && invoiceLine.chargeType != null) {
                const accountId = await this.getCharegAccount(client, invoiceLine.companyId)
                if (accountId) {
                    invoiceLine.accountId = accountId
                }

            } else {
                const accountId = (await AccountsRepo.getProductSalesId(client, invoice.branchId, invoiceLine.productId)).id;
                invoiceLine.accountId = accountId
            }



            /**SET lINE PRODUCT COMMISSION */
            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoiceLine.salesEmployeeId != null && invoiceLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, invoiceLine.productId);
                if (productCommission) {
                    invoiceLine.commissionPercentage = productCommission.commissionPercentage;
                    invoiceLine.commissionAmount = productCommission.commissionAmount;
                }

            }

            if (invoiceLine.chargeData == '') {
                invoiceLine.chargeData = null
            }

            if (invoiceLine.chargeType == '') {
                invoiceLine.chargeType = null
            }


            /** TO SET  mergeWith TO INVOICEID TO CURRENT INVOICEID  */
            // if (invoice.mergeWith != null && invoice.mergeWith != "") {
            //     await this.updateInvoiceLineMergeWith(client, invoiceLine.id, invoiceLine.invoiceId)
            // }






            const isLineIdExist = await this.checkIfInvoiceLineIdExist(client, invoiceLine.id, invoiceLine.invoiceId)


            if (isLineIdExist) {
                await this.editInvoiceLine(client, invoiceLine, invoice, afterDecimal)
            } else {
                await this.insertInvoiceLine(client, invoiceLine, invoice, afterDecimal);
                if (invoiceLine.priceOfferType == "buyDownPrice" && invoiceLine.productId) {
                    await this.updateBuyDownPrice(client, invoiceLine.productId, invoice.branchId, invoiceLine.qty)
                }
            }







        } catch (error: any) {



            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoiceLine.invoiceId }))
        }
    }



    public static async insertInvoiceLine(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {


            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoiceLine.salesEmployeeId != null && invoiceLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, invoiceLine.productId);
                if (productCommission) {
                    invoiceLine.commissionPercentage = productCommission.commissionPercentage;
                    invoiceLine.commissionAmount = productCommission.commissionAmount;
                }
            }
            invoiceLine.calculateTotal(afterDecimal);


            if (invoiceLine.productId == "") {
                invoiceLine.productId = null;
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoiceLines"(  id,
                                                           "invoiceId",
                                                             total,
                                                             price,
                                                             qty,
                                                             "productId",
                                                             "employeeId",
                                                             serial,
                                                             batch,
                                                             "parentId",
                                                             "seatNumber",
                                                             "salesEmployeeId",
                                                             "serviceDate",
                                                             "serviceDuration",
                                                              note,
                                                             "accountId",
                                                             "discountAmount" ,
                                                             "discountPercentage",
                                                            "subTotal",
                                                            "discountTotal",
                                                            "commissionPercentage",
                                                            "commissionAmount",
                                                            "taxId",
                                                            "createdAt",
                                                            "commissionTotal",
                                                            "voidFrom",
                                                            "taxTotal",
                                                            "waste",
                                                            taxes,
                                                            "taxType",
                                                            "taxPercentage",
                                                            "isInclusiveTax",
                                                             "holdTime",
                                                            "printTime",
                                                            "readyTime",
                                                            "voidReason",
                                                            "defaultPrice",
                                                            "priceOfferType",
                                                            "recipe",
                                                            "discountType",
                                                            "discountId",
                                                            "branchId",
                                                            "companyId",
                                                            "chargeType",
                                                            "chargeData",
                                                            "discountPerQty",
                                                            "index"
                                                            ) 
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47) RETURNING id`,
                values: [invoiceLine.id,
                invoiceLine.invoiceId,
                invoiceLine.total,
                invoiceLine.price,
                invoiceLine.qty,
                invoiceLine.productId,
                invoiceLine.employeeId,
                invoiceLine.serial,
                invoiceLine.batch,
                invoiceLine.parentId,
                invoiceLine.seatNumber,
                invoiceLine.salesEmployeeId,
                invoiceLine.serviceDate,
                invoiceLine.serviceDuration,
                invoiceLine.note,
                invoiceLine.accountId,
                invoiceLine.discountAmount,
                invoiceLine.discountPercentage,
                invoiceLine.subTotal,
                invoiceLine.discountTotal,
                invoiceLine.commissionPercentage,
                invoiceLine.commissionAmount,
                invoiceLine.taxId,
                invoiceLine.createdAt,
                invoiceLine.commissionTotal,
                invoiceLine.voidFrom,
                invoiceLine.taxTotal,
                invoiceLine.waste,
                JSON.stringify(invoiceLine.taxes),
                invoiceLine.taxType,
                invoiceLine.taxPercentage,
                invoiceLine.isInclusiveTax,
                invoiceLine.holdTime,
                invoiceLine.printTime,
                invoiceLine.readyTime,
                invoiceLine.voidReason,
                invoiceLine.defaultPrice,
                invoiceLine.priceOfferType,
                JSON.stringify(invoiceLine.recipe),
                invoiceLine.discountType,
                invoiceLine.discountId,
                invoiceLine.branchId,
                invoiceLine.companyId,
                invoiceLine.chargeType,
                invoiceLine.chargeData,
                invoiceLine.discountPerQty,
                invoiceLine.index
                ]
            }

            await client.query(query.text, query.values as any);

            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoice.status != "Draft" && !invoiceLine.waste) {
                await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, invoiceLine.qty, afterDecimal);
            }
            if (invoiceLine.recipe.length > 0) {

                await InvoiceRepo.setLineProductMovment(client, invoiceLine)
            }

            /**INSERT LINE Options */
            if (invoiceLine.options && invoiceLine.options.length > 0) {
                for (let index = 0; index < invoiceLine.options.length; index++) {
                    const option = invoiceLine.options[index];
                    const isOptionIdExist = await this.checkIfInvoiceLineOptionIdExist(client, option.id, invoiceLine.id)
                    if (isOptionIdExist) {
                        await this.editLineOptions(client, option, invoiceLine, invoice, afterDecimal, invoiceLine.qty)
                    } else {
                        await this.addLineOptions(client, option, invoiceLine, invoice, afterDecimal)
                    }
                }
            }


        } catch (error: any) {


            console.log(error)
            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoiceLine.invoiceId }))
        }
    }
    public static async editInvoiceLine(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {
            const oldInvoiceLine = await InvoiceRepo.getOldInvoiceLineQtyToTAL(client, invoiceLine.id)
            const oldQty = oldInvoiceLine.qty;
            const oldCost = oldInvoiceLine.oldCost;

            //TODO update invoiceID for merged invoice lines change it's invoiceID
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoiceLines" 
                                              SET  total=$1,
                                                   price=$2,
                                                   qty=$3,
                                                   "serviceDate"=$4,
                                                   "serviceDuration"=$5,
                                                    note=$6,
                                                    "commissionAmount" =$7,
                                                    "commissionPercentage"=$8,
                                                    "taxId"= $9,
                                                    "discountId"=$10,
                                                    "discountAmount"=$11,
                                                    "discountPercentage"=$12,
                                                    "discountTotal"=$13,
                                                    "subTotal"=$14,
                                                    "taxTotal"=$15,
                                                    "waste"=$16,
                                                    taxes=$17,
                                                    "taxType"=$18,
                                                    "taxPercentage"=$19,
                                                    "isInclusiveTax"=$20,
                                                    "holdTime"=$21,
                                                    "printTime"=$22,
                                                    "readyTime"=$23,
                                                    "voidReason"=$24,
                                                    "defaultPrice"=$25,
                                                    "employeeId"=$26,
                                                    "invoiceId"=$27,
                                                    "discountType" = $28,
                                                    "batch"=$29,
                                                    "serial"=$30,
                                                    "chargeType" = $31,
                                                    "chargeData" = $32,
                                                    "discountPerQty"= $33,
                                                     "index" = $34
                                               WHERE id=$35`,
                values: [invoiceLine.total,
                invoiceLine.price,
                invoiceLine.qty,
                invoiceLine.serviceDate,
                invoiceLine.serviceDuration,
                invoiceLine.note,
                invoiceLine.commissionAmount,
                invoiceLine.commissionPercentage,
                invoiceLine.taxId,
                invoiceLine.discountId,
                invoiceLine.discountAmount,
                invoiceLine.discountPercentage,
                invoiceLine.discountTotal,
                invoiceLine.subTotal,
                invoiceLine.taxTotal,
                invoiceLine.waste,
                JSON.stringify(invoiceLine.taxes),
                invoiceLine.taxType,
                invoiceLine.taxPercentage,
                invoiceLine.isInclusiveTax,
                invoiceLine.holdTime,
                invoiceLine.printTime,
                invoiceLine.readyTime,
                invoiceLine.voidReason,
                invoiceLine.defaultPrice,
                invoiceLine.employeeId,
                invoiceLine.invoiceId,
                invoiceLine.discountType,
                invoiceLine.batch,
                invoiceLine.serial,
                invoiceLine.chargeType,
                invoiceLine.chargeData,
                invoiceLine.discountPerQty,
                invoiceLine.index,
                invoiceLine.id]
            }

            await client.query(query.text, query.values);

            //Insert Journal 
            if (oldQty != invoiceLine.qty || (invoice.currentInvoiceStatus == "Pending")) {

                if (invoice.currentInvoiceStatus == "Pending" && (invoice.onlineStatus == "Accepted" || (invoice.onlineStatus == "Rejected" && invoice.isPaid))) {

                    if (invoiceLine.productId != null && invoiceLine.productId != "" && invoice.status != "Draft" && !invoiceLine.waste) {
                        await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, invoiceLine.qty, afterDecimal);
                    }
                } else {
                    // Inventory Journals only affected when there is change in invoice line qty  and invoice line is product 
                    if (oldQty != invoiceLine.qty && (invoiceLine.productId != null && invoiceLine.productId != "") && invoice.status != "Draft" && !invoiceLine.waste) {
                        const acctualQty = invoiceLine.qty - oldQty;
                        await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, acctualQty, afterDecimal)
                    }
                }
            }


            if (invoiceLine.recipe.length > 0) {

                await InvoiceRepo.setLineProductMovment(client, invoiceLine)
            }

            /**INSERT LINE Options */
            if (invoiceLine.options && invoiceLine.options.length > 0) {
                for (let index = 0; index < invoiceLine.options.length; index++) {
                    const option = invoiceLine.options[index];
                    const isOptionIdExist = await this.checkIfInvoiceLineOptionIdExist(client, option.id, invoiceLine.id)
                    if (isOptionIdExist) {
                        await this.editLineOptions(client, option, invoiceLine, invoice, afterDecimal, invoiceLine.qty)
                    } else {
                        await this.addLineOptions(client, option, invoiceLine, invoice, afterDecimal)
                    }
                }
            }
        } catch (error: any) {

            console.log(error)
            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoiceLine.invoiceId }))
        }
    }


    public static async addLineOptions(client: PoolClient, invoiceLineOption: InvoiceLineOption, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {
            let optionId;
            if (invoiceLineOption.optionId !== "") {
                optionId = invoiceLineOption.optionId == "" ? null : invoiceLineOption.optionId
            }

            invoiceLineOption.optionGroupId = invoiceLineOption.optionGroupId == "" ? null : invoiceLineOption.optionGroupId

            if (invoiceLineOption.optionId != null && invoiceLineOption.optionId != "" && invoice.status != "Draft" && !invoiceLine.waste) {
                await InvoiceInventoryMovmentRepo.calculateOptionMovment(client, invoiceLineOption, invoiceLine, invoice, afterDecimal);
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoiceLineOptions" ( id,"invoiceLineId" ,price,qty,note, "optionId","recipe", "optionGroupId") 
                                                   VALUES($1,$2,$3,$4,$5,$6,$7, $8) RETURNING id `,
                values: [invoiceLineOption.id, invoiceLineOption.invoiceLineId, invoiceLineOption.price, invoiceLineOption.qty, invoiceLineOption.note, optionId, JSON.stringify(invoiceLineOption.recipe), invoiceLineOption.optionGroupId]
            }

            await client.query(query.text, query.values as any)

        } catch (error: any) {


            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoiceLine.invoiceId }))
        }
    }
    public static async editLineOptions(client: PoolClient, invoiceLineOption: InvoiceLineOption, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number, oldLineQty: number) {
        try {
            let optionId;
            if (invoiceLineOption.optionId !== "") {
                optionId = invoiceLineOption.optionId == "" ? null : invoiceLineOption.optionId
            }
            invoiceLineOption.optionGroupId = invoiceLineOption.optionGroupId == "" ? null : invoiceLineOption.optionGroupId
            const query: { text: string, values: any } = {
                text: `UPDATE  "InvoiceLineOptions" SET price = $1 ,qty=$2,note=$3 WHERE id = $4 AND "invoiceLineId" =$5 AND "optionId" =$6 `,
                values: [invoiceLineOption.price, invoiceLineOption.qty, invoiceLineOption.note, invoiceLineOption.id, invoiceLineOption.invoiceLineId, optionId]
            }

            await client.query(query.text, query.values as any)
            if (invoice.currentInvoiceStatus == "Pending" && (invoice.onlineStatus == "Accepted" || (invoice.onlineStatus == "Rejected" && invoice.isPaid))) {
                if (invoiceLineOption.optionId != null && invoiceLineOption.optionId != "" && invoice.status != "Draft" && !invoiceLine.waste) {
                    await InvoiceInventoryMovmentRepo.calculateOptionMovment(client, invoiceLineOption, invoiceLine, invoice, afterDecimal);
                }
            }


            if (invoiceLineOption.recipe && invoiceLineOption.recipe.length > 0) {
                query.text = `UPDATE "InvoiceLineOptions" SET "recipe" =$1 where id =$2`,
                    query.values = [JSON.stringify(invoiceLineOption.recipe), invoiceLineOption.id]
            }
            await client.query(query.text, query.values as any);
        } catch (error: any) {

            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoiceLine.invoiceId }))
        }
    }




    public static async updateInvoiceLineMergeWith(client: PoolClient, lineId: string, invoiceId: string) {
        try {
            let query: { text: string, values: any } = {
                text: `UPDATE "InvoiceLines" set "invoiceId"=$1 where id =$2 `,
                values: [invoiceId, lineId]

            }
            client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async updateBuyDownPrice(client: PoolClient, productId: string, branchId: string, qty: number) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "BranchProducts" SET "buyDownQty" = "buyDownQty" - $1 where "productId"=$2 and "branchId"=$3  `,
                values: [qty, productId, branchId]
            }

            await client.query(query.text, query.values as any)
        } catch (error: any) {


            throw new Error(error)
        }
    }




    /**ONLY WHEN POS INVOICE IS EDITED IN CLOUDE => LIVE SYNC */
    public static async sendInvoice(client: PoolClient, branchId: string, invoiceId: string) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        let invoice = await this.getFullInvoice(client, invoiceId)
        invoice.onlineStatus = invoice.onlineStatus != 'Placed' ? invoice.onlineStatus : 'Pending'
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {

            instance.io.of('/api').in(clientId).emit("newInvoice", JSON.stringify(invoice));
        } catch (error) {


            instance.io.of('/api').in(clientId).emit("newInvoice", JSON.stringify({ success: false, error: error }));
        }
    }


    public static async sendCallCenterInvoice(client: PoolClient, branchId: string, invoiceId: string) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        let invoice = await this.getFullInvoice(client, invoiceId)
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {

            instance.io.of('/api').in(clientId).emit("newCallCenterInvoice", JSON.stringify(invoice));
        } catch (error) {


            instance.io.of('/api').in(clientId).emit("newCallCenterInvoice", JSON.stringify({ success: false, error: error }));
        }
    }
    //TODO: UPDATE SYNC LIVE

    public static async getFullInvoice(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "Invoices".id,
                              "Invoices"."invoiceNumber",
                              "Invoices"."refrenceNumber",
                              "Invoices"."total",
                              "Invoices"."note",
                              "Invoices"."guests",
                              "Invoices"."branchId",
                              "Invoices"."employeeId",
                              "Invoices"."tableId",
                             "Invoices"."createdAt",
                              "Invoices"."source",
                              "Invoices"."serviceId",
                              "Invoices"."customerId",
                              "Invoices"."customerAddress",
                              "Invoices"."customerContact",
                              "Invoices"."customerLatLang",
                              "Invoices"."discountId",
                              "Invoices"."discountAmount",
                              "Invoices"."discountPercentage",
                              "Invoices"."estimateId",
                              "Invoices"."status",
                              "Invoices"."draft",
                              "Invoices"."charges",
                              "Invoices"."discountTotal",
                              "Invoices"."chargeId",
                              "Invoices"."chargeAmount",
                              "Invoices"."chargePercentage",
                              "Invoices"."chargeTotal",
                              "Invoices"."subTotal",
                              "Invoices"."deliveryCharge",
                              "Invoices"."printTime",
                              "Invoices"."readyTime",
                              "Invoices"."departureTime",
                              "Invoices"."arrivalTime",
                              "Invoices"."scheduleTime",
                              "Invoices"."mergeWith",
                              "Invoices"."invoiceDate",
                              "Invoices"."updatedDate",
                              "Invoices"."terminalId",
                              "Invoices"."roundingType",
                              "Invoices"."roundingTotal",
                              "Invoices"."smallestCurrency",
                              "Invoices"."isInclusiveTax",
                              "Invoices"."driverId",
                              "Invoices"."onlineData",
                              "Invoices"."discountType",
                              case when "onlineData" is null or "onlineData"->>'onlineStatus' ='' then 'Accepted' else "onlineData"->>'onlineStatus'  end as "onlineStatus"
                               FROM "Invoices" where id = $1`,
                values: [invoiceId]
            }

            let invoiceData = (await client.query(query.text, query.values)).rows[0];
            let invoice: any = new Invoice();
            invoice.ParseJson(invoiceData);


            query.text = `SELECT  id,
                                  "invoiceId",
                                  "total",
                                  "price",
                                  "qty",
                                  "productId",
                                  "employeeId",
                                  "batch",
                                  "serial",
                                  "createdAt" ,
                                  "parentId",
                                  "seatNumber",
                                  "salesEmployeeId",
                                  "serviceDate",
                                  "serviceDuration",
                                  "discountId",
                                  "discountAmount",
                                  "discountPercentage",
                                  "note",
                                  "status",
                                  "accountId",
                                  "subTotal",
                                  "discountTotal",
                                  "commissionPercentage",
                                  "commissionAmount",
                                  "taxId",
                                  "commissionTotal",
                                  "voidFrom",
                                  "taxTotal",
                                  "taxes",
                                  "waste",
                                  "taxType",
                                  "taxPercentage",
                                  "isInclusiveTax",
                                  "defaultPrice",
                                  "holdTime",
                                  "printTime",
                                  "readyTime",
                                  "voidReason",
                                  "priceOfferType",
                                  "recipe",
                                  "discountType"

                                 FROM "InvoiceLines" where "invoiceId" =$1 `
            let invoicelines = (await client.query(query.text, query.values)).rows;
            for (let index = 0; index < invoicelines.length; index++) {
                const line = invoicelines[index];
                const temp = new InvoiceLine();
                temp.ParseJson(line);
                query.text = `SELECT * FROM "InvoiceLineOptions" where "invoiceLineId" =$1`;
                query.values = [line.id];
                let options = await client.query(query.text, query.values);
                temp.options = options.rows;
                invoice.lines.push(temp);
            }

            if (invoice.customerId != "" && invoice.customerId != null) {
                query.text = `SELECT * FROM "Customers" where id =$1`,
                    query.values = [invoice.customerId];
                let customer = await client.query(query.text, query.values);
                invoice.customer = customer.rows[0]
            } else {
                invoice.customer = null;
            }


            return invoice;
        } catch (error: any) {


            throw new Error(error)
        }
    }



    public static async sendUpdateInvoice(clinet: PoolClient, branchId: string, invoiceId: string) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        let invoice = await this.getFullInvoice(clinet, invoiceId)
        invoice.onlineStatus = invoice.onlineStatus != 'Placed' ? invoice.onlineStatus : 'Pending'
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {

            instance.io.of('/api').in(clientId).emit("updateInvoice", JSON.stringify(invoice));
        } catch (error) {


            instance.io.of('/api').in(clientId).emit("updateInvoice", JSON.stringify({ success: false, error: error }));
        }
    }






    /**CREATE CREDIT NOTE ONLY FOR ECCOMERCE PAID REJECTED INVOICES */
    public static async creatCreditNote(client: PoolClient, invoice: Invoice, company: Company) {
        try {

            const creditNote = new CreditNote();
            creditNote.ParseJson(invoice);

            creditNote.invoiceId = invoice.id;
            creditNote.id = "";


            // creditNote.createdAt = new Date()

            const accountId = await (await AccountsRepo.getSalesId(client, creditNote.branchId)).id;

            // let company = await (await CompanyRepo.getCompanyPrefrences(null, creditNote.branchId)).data
            // company.afterDecimal = company.settings.afterDecimal

            creditNote.creditNoteNumber = (await CreditNoteRepo.getCreditNoteNumber(creditNote.branchId, company, client)).data.creditNoteNumber
            creditNote.lines = []
            for (let index = 0; index < invoice.lines.length; index++) {
                const invoiceLine = invoice.lines[index];
                let creditNoteLine = new CreditNoteLine();
                creditNoteLine.ParseJson(invoiceLine);
                creditNoteLine.id = ""
                creditNoteLine.accountId = accountId;

                // creditNoteLine.createdAt = new Date()
                creditNoteLine.invoiceLineId = invoiceLine.id;
                creditNote.lines.push(creditNoteLine)
            }
            creditNote.invoiceOnlineStatus = invoice.onlineStatus
            let creditNoteData = await CreditNoteRepo.addNewCreditNote(client, creditNote, company)

        } catch (error: any) {
            console.log(error)

                ;

            throw new Error(error)
        }
    }
    /** RETURN ALL POS INVOICES OR ONLY UPDATED INVOICES */
    public static async getPosInvoices(client: Socket, data: any, branchId: string, callback: any) {
        try {
            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            let companyId = (await BranchesRepo.getBranchCompanyId(null, branchId)).compayId;
            /** remove pendeing payment online orders in case payment faild and  placed order because the orderes are sent throw another event */
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "Invoices"  
                where  "companyId"=$3
                and "branchId"=$2
                and  (source = any($1) or ( source = 'Online' AND  "Invoices"."onlineData"->>'onlineStatus' <> 'Pending Payments' AND  "Invoices"."onlineData"->>'onlineStatus' <> 'Placed' ) )

                 `,
                values: [['POS', 'CallCenter'], branchId, companyId]
            }

            if (date != null) {
                query.text = ` SELECT * FROM "Invoices" 
                    where  "companyId"=$4
                     and "branchId"=$2 and ("updatedDate">$3) 
                     and  (source = any($1) or ( source = 'Online' AND  "Invoices"."onlineData"->>'onlineStatus' <> 'Pending Payments' AND  "Invoices"."onlineData"->>'onlineStatus' <> 'Placed' ) )
                                      `
                query.values = [['POS'], branchId, date, companyId]
            }
            const invoices: any = await DB.excu.query(query.text, query.values);

            let invoiceList: any[] = [];

            for (let index = 0; index < invoices.rows.length; index++) {
                const element: any = invoices.rows[index];
                let invoice = new Invoice();
                invoice.ParseJson(element);

                invoice.onlineStatus = invoice.source == 'POS' ? 'Accepted' : invoice.onlineData.onlineStatus != 'Placed' ? invoice.onlineData.onlineStatus : 'Pending'
                query.text = `SELECT * FROM "InvoiceLines" where "invoiceId"= $1`
                query.values = [element.id];
                const lines = await DB.excu.query(query.text, query.values)
                if (invoice.customerId != "" && invoice.customerId != null) {
                    query.text = `SELECT * FROM "Customers" where id =$1`,
                        query.values = [invoice.customerId];
                    let customer: any = await DB.excu.query(query.text, query.values);
                    invoice.customer = customer.rows[0]
                }
                for (let index = 0; index < lines.rows.length; index++) {
                    const lineElement = lines.rows[index];
                    let invoiceLine = new InvoiceLine();
                    invoiceLine.ParseJson(lineElement);
                    query.text = `SELECT * FROM "InvoiceLineOptions" where "invoiceLineId" =$1`;
                    query.values = [invoiceLine.id]

                    let options: any = await DB.excu.query(query.text, query.values);
                    invoiceLine.options = options.rows;
                    invoice.lines.push(invoiceLine);
                }

                invoiceList.push(invoice)
            }

            callback(JSON.stringify({ success: true, data: invoiceList }))
        } catch (error: any) {

            console.log(error)
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getPosInvoices")
        }
    }



    /**Get list of Invoices to recover pos DB */
    public static async getRecoveDBinvoices(client: Socket, data: any, branchId: string, callback: any) {
        const dbClient = await DB.excu.client(500);
        try {

            await dbClient.query("BEGIN");
            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            // const invoiceIds = new Set();


            // let invoiceData: any = await this.getOpenInvoiceIds(dbClient, branchId)
            // invoiceData.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });
            // // invoiceData = await this.getLastThreeDaysPaymentInvoices(branchId)
            // // invoiceData.forEach((element: any) => {
            // //     invoiceIds.add(element.id)
            // // });
            // invoiceData = await this.getLastThreeDaysInvoices(dbClient, branchId)
            // invoiceData.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });



            // invoiceData = await SocketCreditNoteRepo.getLatestCreditNote(dbClient, branchId)
            // if (invoiceData.length > 0) {
            //     invoiceData.forEach((element: any) => {
            //         invoiceIds.add(element.invoiceId)
            //     });
            // }

            // invoiceData = await SocketEstimateRepo.getLatestEstimate(dbClient, branchId)

            // if (invoiceData) {
            //     invoiceIds.add(invoiceData.invoiceId)
            // }


            // let ids = Array.from(invoiceIds);

            let ids = await this.getRecoverInvoicesIds(dbClient, branchId)


            const query: { text: string, values: any } = {
                text: ` Select * from "Invoices" where "Invoices".id = any ($1)`,
                values: [ids]
            }



            const invoices: any = await dbClient.query(query.text, query.values);
            let invoiceList: any[] = [];
            for (let index = 0; index < invoices.rows.length; index++) {
                const element: any = invoices.rows[index];
                let invoice: any = new Invoice();
                invoice.ParseJson(element);
                query.text = `SELECT * FROM "InvoiceLines" where "invoiceId"= $1`
                query.values = [element.id];
                const lines = await dbClient.query(query.text, query.values)


                for (let index = 0; index < lines.rows.length; index++) {
                    const line: any = lines.rows[index];
                    let invoiceLine = new InvoiceLine();
                    invoiceLine.ParseJson(line)
                    query.text = `SELECT * FROM "InvoiceLineOptions" where "invoiceLineId" = $1`;
                    query.values = [line.id];
                    let options: any = await dbClient.query(query.text, query.values);
                    invoiceLine.options = options.rows
                    invoice.lines.push(invoiceLine)
                }

                if (invoice.customerId != "" && invoice.customerId != null) {
                    query.text = `SELECT * FROM "Customers" where id =$1`,
                        query.values = [invoice.customerId];
                    let customer = await dbClient.query(query.text, query.values);
                    invoice.customer = customer.rows[0]
                }

                invoiceList.push(invoice)
            }

            await dbClient.query("COMMIT");

            callback(JSON.stringify({ success: true, data: invoiceList }))
        } catch (error: any) {
            await dbClient.query("ROLLBACK");


            ;
            callback(JSON.stringify({ success: false, error: error }))
            logPosErrorWithContext(error, data, branchId, null, "getRecoveDBinvoices")
        } finally {
            dbClient.release()
        }
    }
    /** RETURN OPEN INVOICE IDS */
    public static async getOpenInvoiceIds(dBClient: PoolClient, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select "Invoices".id from "Invoices" 
                LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                LEFT JOIN "CreditNotes" on "CreditNotes"."invoiceId" = "Invoices".id
                where "Invoices"."branchId" = $1
                and ("Invoices".source ='POS' or "Invoices".source ='Online')
                group by "Invoices".id 										   
                having (sum (COALESCE("InvoicePaymentLines".amount,0)) < "Invoices".total and  sum (COALESCE("CreditNotes"."total",0)) < "Invoices".total )`,
                values: [branchId]
            }

            let ids = (await dBClient.query(query.text, query.values)).rows

            return ids
        } catch (error: any) {


            throw new Error(error)
        }
    }
    /** RETURN OPEN lAST THREE DAYS INVOICE  IDS */
    public static async getLastThreeDaysInvoices(dBClient: PoolClient, branchId: string) {
        try {

            let prefix = await terminalRepo.getTeminalPrefix(branchId);
            let prefixTerm = prefix + '%';
            prefix += '-'
            let limit = 100
            const query: { text: string, values: any } = {
                text: `select id  from  "Invoices"  WHERE "Invoices"."branchId" = $1
                AND ("Invoices".source ='POS' or "Invoices".source ='Online')
                AND  "Invoices"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' and "Invoices"."createdAt" <= CURRENT_DATE`,
                values: [branchId]
            }
            if (prefix != null && prefix != "") {
                query.text = ` select "Invoices".id from "Invoices" where "branchId" =$1
                and "invoiceNumber" like $2
                order by  regexp_replace("invoiceNumber", $3, '')::int desc
                limit $4 `
                query.values = [branchId, prefixTerm, prefix, limit]
            }

            let ids = (await dBClient.query(query.text, query.values)).rows

            return ids

        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }



    // /** RETRUN LAST THREE DAYS CREDITNOTE's INVOICES IDS
    //  * only POS INVOICES AND CREDIT NOTES
    //  */
    // public static async getLastThreeDaysCreditNoteInvoices(branchId: string) {
    //     try {

    //         let prefix = await terminalRepo.getTeminalPrefix(branchId);
    //         let prefixTerm = prefix + '%';
    //         let limit = 100

    //         const query : { text: string, values: any } = {
    //             text: ` SELECT "Invoices".id FROM "Invoices" 
    //             LEFT JOIN "CreditNotes" on "CreditNotes"."invoiceId" = "Invoices".id 
    //             WHERE "Invoices"."branchId" =$1
    //             AND ("Invoices".source ='POS' or "Invoices".source ='Online')
    //             AND "CreditNotes"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' and "CreditNotes"."createdAt" <= CURRENT_DATE`,
    //             values: [branchId]
    //         }

    //         if (prefix != null && prefix != "") {
    //             query.text = ` select "Invoices".id from "Invoices"
    //             LEFT JOIN "CreditNotes" on "CreditNotes"."invoiceId" = "Invoices".id 
    //             where "Invoices"."branchId" =$1
    //             and "creditNoteNumber" like $2
    //             AND ("Invoices".source ='POS' or "Invoices".source ='Online')
    //             order by  regexp_replace("creditNoteNumber", $3, '')::int desc
    //             limit $4 `
    //             query.values = [branchId, prefixTerm, prefix, limit]
    //         }

    //         let invoices = await DB.excu.query(query.text, query.values);
    //         return invoices.rows
    //     } catch (error: any) {
    //    

    //         throw new Error(error)
    //     }
    // }
    /** RETRUN LAST THREE DAYS INVOICE PAYMENT's INVOICES IDS
     * only POS INVOICES 
     */
    public static async getLastThreeDaysPaymentInvoices(dbClient: PoolClient, branchId: string) {
        try {

            let prefix = await terminalRepo.getTeminalPrefix(branchId);
            let prefixTerm = prefix + '%';
            let limit = 100

            const query: { text: string, values: any } = {
                text: `    SELECT "Invoices".id FROM "Invoices" 
                LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                LEFT JOIN "InvoicePayments" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                WHERE "Invoices"."branchId" =$1
                AND ("Invoices".source ='POS' or "Invoices".source ='Online')
                AND   "InvoicePayments"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' and "InvoicePayments"."createdAt" <= CURRENT_DATE`,
                values: [branchId]
            }

            if (prefix != null && prefix != "") {
                query.text = ` select "Invoices".id from "Invoices"
                LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                LEFT JOIN "InvoicePayments" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                where "InvoicePayments"."branchId" =$1
                and "invoiceNumber" like $2
                AND ("Invoices".source ='POS' or "Invoices".source ='Online')
                order by  regexp_replace("invoiceNumber", $3, '')::int desc
                limit $4 `
                query.values = [branchId, prefixTerm, prefix, limit]
            }

            let invoices = await DB.excu.query(query.text, query.values);
            return invoices.rows
        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }
    /** RETRUN LAST THREE DAYS Cashier's INVOICES IDS
    * only POS INVOICES 
    */
    public static async getLastThreeDaysCashierInvoices(branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `      SELECT "Invoices".id FROM "Invoices" 
                LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                LEFT JOIN "InvoicePayments" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                LEFT JOIN "Cashiers" on "InvoicePayments"."cashierId" = "Cashiers".id 
                WHERE "Invoices"."branchId" =$1
                AND ("Invoices".source ='POS' or "Invoices".source ='Online')
                and  ( ("Cashiers"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' and "Cashiers"."createdAt" <= CURRENT_DATE) OR "Cashiers"."cashierOut" is null)`,
                values: [branchId]
            }

            let invoices = await DB.excu.query(query.text, query.values);
            return invoices.rows
        } catch (error: any) {


            throw new Error(error)
        }
    }


    /**Send Ecommerce Placed Orders to Pos  LIVE SYNC*/
    public static async sendOnlineInvoice(invoice: Invoice) {
        try {


            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient();

            if (invoice.onlineData.onlineStatus == 'Pending Payments') {
                return
            }

            if (invoice.onlineData.onlineStatus != 'Pending Payments') {
                invoice.onlineStatus = invoice.onlineData.onlineStatus == 'Placed' ? 'Pending' : invoice.onlineData.onlineStatus

            } else {
                invoice.onlineStatus = (invoice.serviceName == "DineIn" || invoice.onlineData.onlineStatus != 'Placed') ? invoice.onlineData.onlineStatus : "Pending"

            }


            const clientId: any = await this.redisClient.get("Socket" + invoice.branchId);
            if (clientId == "" || clientId == null || clientId == undefined) {

            }


            if (invoice.onlineStatus == 'Pending') {

                instance.io.of('/api').in(clientId).emit("ecommerceInvoice", JSON.stringify(invoice));
            }

            // instance.io.of('/api').on("ecommerceInvoiceCallback", async (data: any) => {
            //     data = JSON.parse(data)
            //     console.log("ecommerceInvoiceCallback")
            //     if (data.success && invoice.onlineStatus) {
            //         await InvoiceRepo.setInvoiceStatus(data.invoiceId, invoice.onlineStatus)
            //     }
            // })
        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }


    /**Send Ecommerce Placed Orders that aren't recieved by   pos when placed*/
    public static async getEcommercePlacedOrders(client: Socket, data: any, branchId: string, callback: any) {
        const dBClient = await DB.excu.client();
        try {

            await dBClient.query("BEGIN")

            const compnayId = (await BranchesRepo.getBranchCompanyId(dBClient, branchId)).compayId;
            const query: { text: string, values: any } = {
                text: `SELECT 
                "Invoices".id,
                "Invoices"."invoiceNumber",
                "Invoices"."refrenceNumber",
                "Invoices"."total",
                "Invoices"."note",
                "Invoices"."guests",
                "Invoices"."branchId",
                "Invoices"."employeeId",
                "Invoices"."tableId",
                "Invoices"."createdAt",
                "Invoices"."source",
                "Invoices"."serviceId",
                "Invoices"."customerId",
                "Invoices"."customerAddress",
                "Invoices"."customerContact",
                "Invoices"."customerLatLang",
                "Invoices"."discountId",
                "Invoices"."discountAmount",
                "Invoices"."discountPercentage",
                "Invoices"."estimateId",
                "Invoices"."status",
                "Invoices"."draft",
                "Invoices"."charges",
                "Invoices"."discountTotal",
                "Invoices"."chargeId",
                "Invoices"."chargeAmount",
                "Invoices"."chargePercentage",
                "Invoices"."chargeTotal",
                "Invoices"."subTotal",
                "Invoices"."deliveryCharge",
                "Invoices"."printTime",
                "Invoices"."readyTime",
                "Invoices"."departureTime",
                "Invoices"."arrivalTime",
                "Invoices"."scheduleTime",
                "Invoices"."mergeWith",
                "Invoices"."invoiceDate",
                "Invoices"."updatedDate",
                "Invoices"."terminalId",
                "Invoices"."roundingType",
                "Invoices"."roundingTotal",
                "Invoices"."smallestCurrency",
                "Invoices"."isInclusiveTax",
                "Invoices"."driverId",
                "Invoices"."onlineData",
                "Invoices"."aggregator",
                "Invoices"."aggregatorId",
                "Invoices"."discountType",
                        "Invoices"."aggregatorId",
                "Invoices"."discountType"
                     FROM "Invoices"
                     WHERE "Invoices"."companyId"=$1
                     AND "branchId"=$2
                     AND "onlineData"->>'onlineStatus' = 'Placed' `,
                values: [compnayId, branchId]
            }

            let invoices = await dBClient.query(query.text, query.values);



            let ids: any[] = [];
            let customeIds: any[] = [];
            let invoicesData = invoices.rows ?? []

            let invoiceList: Invoice[] = [];

            if (invoicesData.length > 0) {

                /**===================== Parse Invoices ==========================*/
                let invoiceTemp;
                invoicesData = invoicesData.map(f => {
                    invoiceTemp = new Invoice()
                    invoiceTemp.ParseJson(f)
                    invoiceTemp.onlineStatus = 'Pending'
                    invoiceTemp.customerContact = invoiceTemp.customerContact ?? ''
                    ids.push(invoiceTemp.id)
                    customeIds.push(invoiceTemp.customerId);
                    return invoiceTemp
                })
                /**===================== Get Lines ==========================*/
                query.text = `SELECT * FROM "InvoiceLines" where "companyId" = $1 and "branchId" = $2 and  "invoiceId"=any($3)`;
                query.values = [compnayId, branchId, ids]

                let lines = await dBClient.query(query.text, query.values);
                let lineData = lines.rows ?? []
                /** invoice line ids */
                let lineIds: any[] = []
                if (lineData.length > 0) {
                    lineData.forEach(element => {
                        lineIds.push(element.id)
                    });

                    /**===================== Get Options ==========================*/
                    query.text = `	select "InvoiceLineOptions".id,
                                        "InvoiceLineOptions"."optionId" ,
                                        "InvoiceLineOptions"."invoiceLineId" ,
                                        "InvoiceLineOptions".qty,
                                        "InvoiceLineOptions".price,
                                        "InvoiceLineOptions"."createdAt",
                                        "InvoiceLineOptions"."optionGroupId",
                                        "OptionGroups".title as  "optionGroupName",
                                        case when "Options".id is null then  "InvoiceLineOptions"."note" else "Options"."name" end as "note"
                           FROM "InvoiceLineOptions" 
                            left join "Options" on "Options".id = "InvoiceLineOptions"."optionId"
                             left join "OptionGroups" on "OptionGroups".id =   "InvoiceLineOptions"."optionGroupId"
                            WHERE "invoiceLineId"=any($1)`,
                        query.values = [lineIds];
                    let optionData = await dBClient.query(query.text, query.values);
                    /**===================== Map Options with lines  ==========================*/
                    let options = optionData.rows

                    lineData = lineData.map((f) => {
                        let lineOption = options.filter(item => item.invoiceLineId == f.id)

                        if (lineOption) {
                            f.options = lineOption
                        } else {
                            f.options = []
                        }

                        if (f.taxType == null) {
                            f.taxType = ''
                        }
                        return f
                    })

                    /**===================== Map Lines with invoices  ==========================*/
                    invoicesData = invoicesData.map(invo => {
                        let lineTemp = lineData.filter((item) => item.invoiceId == invo.id)


                        if (lineTemp) {
                            let pareseLine;
                            lineTemp = lineTemp.map(line => {
                                pareseLine = new InvoiceLine();
                                pareseLine.ParseJson(line)

                                return pareseLine
                            });
                            invo.lines = lineTemp
                        } else {
                            invo.lines = []
                        }

                        return invo
                    })
                    /**===================== Map Customers with invoices  ==========================*/

                    if (customeIds.length > 0) {
                        query.text = `SELECT * FROM "Customers" WHERE "id"=any($1)`,
                            query.values = [customeIds];
                        let customerData = await dBClient.query(query.text, query.values);
                        if (customerData.rows && customerData.rows.length > 0) {

                            let customers = customerData.rows

                            invoicesData = invoicesData.map(f => {
                                let customerTemp = customers.find(item => item.id == f.customerId)
                                if (customerTemp) {
                                    f.customer = customerTemp
                                }

                                return f
                            })
                        }
                    }


                    /** get payments */

                    let payments = await this.getInvoicePayments(dBClient, ids)
                    if (payments.length > 0) {
                        invoicesData = invoicesData.map(f => {
                            let paymentTemp = payments.filter(pay => {
                                let invoicePayment = pay.lines.find((paymetLine: any) => paymetLine.invoiceId == f.id)
                                if (invoicePayment) {
                                    return invoicePayment
                                }
                            })
                            f.invoicePayments = paymentTemp ?? []
                            return f
                        })
                    }
                    invoiceList = invoicesData
                }

            }


            await dBClient.query("COMMIT")
            callback(JSON.stringify(invoiceList))

        } catch (error: any) {
            await dBClient.query("ROLLBACK")

            console.log(error)
                ;

            callback(JSON.stringify([]))
            logPosErrorWithContext(error, data, branchId, null, "getEcommercePlacedOrders")

        } finally {
            dBClient.release()
        }
    }
    public static async getCallCenterOrderes(client: Socket, data: any, branchId: string, callback: any) {
        const dBClient = await DB.excu.client();
        try {
            // if (!['310626d1-15b2-4d2b-91ea-b08dbc9aedec',
            //     '1c446ca5-e893-4f01-87d9-c667d1de850c',
            //     'ec96d47f-5597-44cb-b559-48bc813595ef',
            //     'c8f2b520-fd0e-4afe-b85b-d19dbb7c3740',
            //     'e74b318a-436f-4b6b-8cb4-23473f670c4a',
            //     '8e23c72f-16de-4656-8eb2-6940a8dcf067',
            //     '921b21b3-648d-4fca-9994-58d0a7b2fb7d',
            //     '50122880-fd09-46ea-9401-a3e65cb427e0',
            //     '2c679ede-e1ed-41ab-9f57-1446047060a6',
            //     'd7d3b001-9faf-4d49-9d3b-8461b2b57652',
            //     '6a69e182-cd9f-4976-b152-96ad8df74036',
            //     '7412900a-c0c3-4307-99a5-06bc0cfb917e',
            //     'e9a42102-b019-45b7-8728-c94a6ca5735d',
            //     '3b7aee1a-374b-4e86-bfc6-d0a715e804ac'].includes(branchId)) {
            //     callback(JSON.stringify([]));
            //     return;
            // }

            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }


            // await dBClient.query("BEGIN")

            // const hasCallCenter = company.hasCallCenter ?? false;

            const isFeatureEnabled = await CompanyRepo.isFeatureEnabled(branchId, 'CallCenter', dBClient)
            if (!isFeatureEnabled) return callback(JSON.stringify([]));
            
            const company = (await BranchesRepo.getBranchCompanyId(dBClient, branchId));
            const companyId = company.compayId;

            await dBClient.query('SET TRANSACTION READ ONLY')
            const query: { text: string, values: any } = {
                text: `SELECT 
                "Invoices".id,
                "Invoices"."invoiceNumber",
                "Invoices"."refrenceNumber",
                "Invoices"."total",
                "Invoices"."note",
                "Invoices"."guests",
                "Invoices"."branchId",
                "Invoices"."employeeId",
                "Invoices"."tableId",
                "Invoices"."createdAt",
                "Invoices"."source",
                "Invoices"."serviceId",
                "Invoices"."customerId",
                "Invoices"."customerAddress",
                "Invoices"."customerContact",
                "Invoices"."customerLatLang",
                "Invoices"."discountId",
                "Invoices"."discountAmount",
                "Invoices"."discountPercentage",
                "Invoices"."estimateId",
                "Invoices"."status",
                "Invoices"."draft",
                "Invoices"."charges",
                "Invoices"."discountTotal",
                "Invoices"."chargeId",
                "Invoices"."chargeAmount",
                "Invoices"."chargePercentage",
                "Invoices"."chargeTotal",
                "Invoices"."subTotal",
                "Invoices"."deliveryCharge",
                "Invoices"."printTime",
                "Invoices"."readyTime",
                "Invoices"."departureTime",
                "Invoices"."arrivalTime",
                "Invoices"."scheduleTime",
                "Invoices"."mergeWith",
                "Invoices"."invoiceDate",
                "Invoices"."updatedDate",
                "Invoices"."terminalId",
                "Invoices"."roundingType",
                "Invoices"."roundingTotal",
                "Invoices"."smallestCurrency",
                "Invoices"."isInclusiveTax",
                "Invoices"."driverId",
                "Invoices"."onlineData",
                "Invoices"."discountType"
                     FROM "Invoices"
                      where "Invoices"."companyId"=$1
                        AND "branchId"=$2
                        AND "onlineData"->>'callCenterStatus' = 'Placed'
                     `,
                values: [companyId, branchId]
            }

            let invoices = await dBClient.query(query.text, query.values);




            let ids: any[] = [];
            let customeIds: any[] = [];
            let invoicesData = invoices.rows ?? []

            let invoiceList: Invoice[] = [];

            if (invoicesData.length > 0) {

                /**===================== Parse Invoices ==========================*/
                let invoiceTemp;
                invoicesData = invoicesData.map(f => {
                    invoiceTemp = new Invoice()
                    invoiceTemp.ParseJson(f)
                    invoiceTemp.onlineStatus = 'Accepted'
                    ids.push(invoiceTemp.id)
                    customeIds.push(invoiceTemp.customerId);
                    return invoiceTemp
                })
                /**===================== Get Lines ==========================*/
                query.text = `SELECT * FROM "InvoiceLines" where "companyId" = $1 and "branchId"= $2 and "invoiceId"=any($3)`;
                query.values = [companyId, branchId, ids]

                let lines = await dBClient.query(query.text, query.values);
                let lineData = lines.rows ?? []
                /** invoice line ids */
                let lineIds: any[] = []
                if (lineData.length > 0) {
                    lineData.forEach(element => {
                        lineIds.push(element.id)
                    });

                    /**===================== Get Options ==========================*/
                    query.text = `SELECT * FROM "InvoiceLineOptions" WHERE "invoiceLineId"=any($1)`,
                        query.values = [lineIds];
                    let optionData = await dBClient.query(query.text, query.values);
                    /**===================== Map Options with lines  ==========================*/
                    let options = optionData.rows
                    lineData = lineData.map((f) => {
                        let lineOption = options.filter(item => { item.invoiceLineId == f.id })

                        if (lineOption) {
                            f.options = lineOption
                        } else {
                            f.options = []
                        }
                        return f
                    })

                    /**===================== Map Lines with invoices  ==========================*/
                    invoicesData = invoicesData.map(invo => {
                        let lineTemp = lineData.filter((item) => item.invoiceId == invo.id)


                        if (lineTemp) {
                            let pareseLine;
                            lineTemp = lineTemp.map(line => {
                                pareseLine = new InvoiceLine();
                                pareseLine.ParseJson(line)

                                return pareseLine
                            });
                            invo.lines = lineTemp
                        } else {
                            invo.lines = []
                        }

                        return invo
                    })
                    /**===================== Map Customers with invoices  ==========================*/

                    if (customeIds.length > 0) {
                        query.text = `SELECT * FROM "Customers" WHERE "id"=any($1)`,
                            query.values = [customeIds];
                        let customerData = await dBClient.query(query.text, query.values);
                        if (customerData.rows && customerData.rows.length > 0) {

                            let customers = customerData.rows

                            invoicesData = invoicesData.map(f => {
                                let customerTemp = customers.find(item => item.id == f.customerId)
                                if (customerTemp) {
                                    f.customer = customerTemp
                                }

                                return f
                            })
                        }
                    }

                    invoiceList = invoicesData
                }

            }

            await dBClient.query("COMMIT")
            callback(JSON.stringify(invoiceList))



        } catch (error: any) {
            await dBClient.query("ROLLBACK")

                ;

            callback(JSON.stringify([]))
            logPosErrorWithContext(error, data, branchId, null, "getCallCenterInvoices")
        } finally {
            dBClient.release()
        }
    }


    public static async setLineProductMovment(client: PoolClient, invoiceLine: InvoiceLine) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoiceLines" SET "recipe"=$1 where id = $2`,
                values: [JSON.stringify(invoiceLine.recipe), invoiceLine.id]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async editCustomer(client: PoolClient, customer: Customer, address: any) {
        try {


            if (address != null && address != undefined) {
                const query: { text: string, values: any[] } = {
                    text: `SELECT "addresses" FROM "Customers" where id = $1`,
                    values: [customer.id]
                }

                let customerData = await client.query(query.text, query.values);
                let customerAddresses = customerData.rows && customerData.rows.length > 0 ? customerData.rows[0].addresses : []
                //handle if customer address contain the following json => [null]
                if (customerAddresses && customerAddresses.length > 0) {
                    if (customerAddresses[0] == null || customerAddresses[0] == undefined) {
                        customerAddresses = [];
                    }
                } else {
                    customerAddresses = []
                }

                let currentAddress = customerAddresses && customerAddresses.length > 0 ? customerAddresses.find((f: any) => address && f && f.title == address.title) : null;


                if (currentAddress == null || currentAddress == undefined) {

                    customerAddresses.push(address);
                } else {
                    let index = customerAddresses.indexOf(currentAddress)
                    if (index != -1) {
                        customerAddresses[index] = address;
                    } else if (address != null && address != '') {
                        customerAddresses.push(address);
                    }
                }

                query.text = `UPDATE "Customers" set "addresses"=$1 ,"options"=$2, "updatedAt" =$3 where id =$4`,
                    query.values = [JSON.stringify(customerAddresses), customer.options, new Date(), customer.id]
                await client.query(query.text, query.values)
                customer.addresses = customerAddresses
            }


            return;
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async updateGrubTechData(client: PoolClient, invoiceId: string, error: string) {
        try {
            const query = {
                text: `update "Invoices" set "grubTechData" = jsonb_set("grubTechData",
														    '{updateStatusError}',
															 to_jsonb($1::text),
															 true)
                                where id =$2 
                                                                        `,
                values: [error, invoiceId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getRecoverInvoicesIds(client: PoolClient, branchId: string) {
        try {
            const query = {
                text: `with "values" as(
                            select $1::uuid as "branchId"
                            ), "openInvoices" as (
                            select  "Invoices".id from "Invoices"
                            JOIN "values" on true 	
                            where "Invoices"."branchId" = "values"."branchId"
                            and "Invoices".source = 'POS'
                            and ("status" ='Open' or "status" ='Partially Paid' )
                            )

                            select JSON_AGG("openInvoices".id) AS "invoiceIds" from "openInvoices"`,
                values: [branchId]
            }

            let invoices = await client.query(query.text, query.values);

            return invoices.rows && invoices.rows.length > 0 ? invoices.rows[0].invoiceIds : []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async shareInvoice(client: Socket, data: any, branchId: string, callback: CallableFunction) {


        try {
            data = JSON.parse(data)

            let invoice = data.invoice


            if (invoice) {
                let tempData = JSON.stringify([invoice])
                const insertInvoice: string | ResponseData | undefined = await this.saveInvoice(client, tempData, branchId, null)

                if (insertInvoice && insertInvoice instanceof ResponseData && insertInvoice.success) {

                    let contactDetails = data.contactDetails
                    let shareType = data.method;
                    let company = new Company();
                    company.id = insertInvoice.data.companyId

                    switch (shareType) {
                        case 'Email':
                            let emailData = {
                                invoiceId: invoice.id,
                                emails: [contactDetails]
                            }


                            await InvoiceRepo.sendEmail(emailData, company)
                            break;
                        case 'WhatsApp':
                            let whatsapp = {
                                id: invoice.id,
                                phone: contactDetails,
                                type: 'invoice'
                            }

                            await InvoiceRepo.sendWhatsapp(whatsapp, company)
                            break;
                        default:
                            break;
                    }

                }
            }



            callback(JSON.stringify({ success: true }))
        } catch (error: any) {
            console.log(error)

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getBrands")
            throw new Error(error)
        }
    }


    public static async getInvoicePayments(client: PoolClient, invoiceIds: any[]) {
        try {
            const query = {
                text: `with "invoicePayments" as(
                    select "InvoicePayments".* from "InvoicePayments" 
                        
                    inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                        where"InvoicePaymentLines"."invoiceId" = any($1)
                        and "InvoicePayments"."status" = 'SUCCESS'
                    ),"lines" as (

                    select"invoicePayments".id,
                        JSON_AGG( "InvoicePaymentLines".*)AS "lines"
                        from "InvoicePaymentLines"
                    inner join "invoicePayments" on "invoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                        group by "invoicePayments".id
                    )

                    SELECT "invoicePayments".* , "lines". "lines"  FROM "invoicePayments"
                    inner join "lines" on "invoicePayments".id = "lines"."id"
                    `,
                values: [invoiceIds]
            }

            let payments = await client.query(query.text, query.values);
            return payments.rows ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async generateInvoiceNumber(client: PoolClient, companyId: string, invoicNumber: string) {
        try {


            let prefixStr = invoicNumber.split('-')


            let prefix = prefixStr[0]
            let prefixPattern = `^${prefix}-`
            let prefixString = `${prefix}%`

            const query = {
                text: `select  REGEXP_REPLACE("invoiceNumber" , $3, '', 'g')::NUMERIC AS numeric_part from "Invoices"
                        inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                        where "Branches"."companyId" = $1
                        and "invoiceNumber" like $2
                        and REGEXP_REPLACE("invoiceNumber" ,  $3, '', 'g')   ~ '^[0-9]+$' 
                        ORDER BY   REGEXP_REPLACE("invoiceNumber" ,  $3, '', 'g')::NUMERIC  DESC
                        LIMIT 1 `,
                values: [companyId, prefixString, prefixPattern]
            }

            let generatedNumber = await client.query(query.text, query.values);


            if (generatedNumber && generatedNumber.rows && generatedNumber.rows.length > 0) {
                let number = +Number(generatedNumber.rows[0].numeric_part) + 1
                console.log("numbernumbernumber", number)

                let newNumber = `${prefix}-` + number;
                return newNumber
            } else {
                return invoicNumber + 'D'
            }


        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    public static async getInvoiceBuilder(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            const query = {
                text: `  select case  when ("CustomizationSettings".id is  null or   (settings->>'invoiceBuilder') is  null)    then "invoiceTemplate"::jsonb else (settings->>'invoiceBuilder')::jsonb end as "template"
                    from "Branches"
                    Inner join "Companies" on "Companies"."id" = "Branches"."companyId"
                    left join "CustomizationSettings" on "CustomizationSettings"."companyId" = "Companies".id and  "CustomizationSettings"."type" = 'invoice'
                    where "Branches".id =$1`,
                values: [branchId]
            }

            let template = await DB.excu.query(query.text, query.values);
            let templateData = null
            if (template.rows && template.rows.length > 0) {
                templateData = (<any>template.rows[0]).template
            }
            callback(JSON.stringify({ success: true, invoiceTemplate: templateData }))
        } catch (error: any) {
            console.log(error)
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, data.branchId, null, "getInvoiceBuilder")
            throw new Error(error)
        }
    }



    public static async getMissingInvoices(data: any) {
        try {

            const branchId = data.branchId;
            let invoiceIds = data.invoiceIds;
            if (invoiceIds == null) {
                const query = {
                    text: `with "trans" as (select JSONB_ARRAY_ELEMENTS((((JSONB_ARRAY_ELEMENTS("logs")->>'data')::jsonb)->>'lines')::jsonb)->>'invoiceId' as "invoiceId" from "SocketLogs"
                           where "branchId" = $1
                       ), "invoiceIds" as (
                       select * from "trans"
                       where "invoiceId" is not null
                       )
                       
                       select JSON_AGG(DISTINCT  "invoiceIds"."invoiceId") AS "ids" from "invoiceIds"
                       left join "Invoices" on "Invoices".id = "invoiceIds"."invoiceId"::uuid
                       where "Invoices".id is null `,
                    values: [branchId]

                }

                let invoices = await DB.excu.query(query.text, query.values);
                invoiceIds = invoices.rows && invoices.rows.length > 0 && (<any>invoices.rows[0]).ids ? (<any>invoices.rows[0]).ids : []
                console.log("hereeeeeeeeeeeeq", invoiceIds)
            }

            console.log("hereeeeeeeeeeee33", invoiceIds)

            if (invoiceIds && invoiceIds.length > 0) {

                const ids = invoiceIds
                if (ids) {

                    const instance = SocketController.getInstance();
                    this.redisClient = RedisClient.getRedisClient()
                    const clientId: any = await this.redisClient.get("Socket" + branchId);
                    if (clientId == null) {

                        return new ResponseData(false, "Branch Is disconnected", [])
                    } else {

                        const client = instance.io.of('/api').sockets.get(clientId)

                        if (client) {
                            console.log("before res")
                            let response = await client.emitWithAck("fetchInvoices", ids);
                            console.log("after res")
                            if (response) {
                                return new ResponseData(true, "", [])
                            } else {
                                return new ResponseData(false, response, [])
                            }
                        } else {

                            return new ResponseData(false, "Branch Is disconnected", [])
                        }

                    }

                }
                console.log("fifthhhhhhhhhhhhsss")
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async searchInvoices(data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            const companyId = (await BranchesRepo.getBranchCompanyId(null, branchId)).compayId;
            const filter = data && data.filter ? `'%` + InvoiceRepo.escapeSQLString(data.filter.toLowerCase().trim()) + `%'` : null
            const serviceId = data && data.serviceId ? data.serviceId : null
            const status = data && data.status && data.status != 'All' ? InvoiceRepo.escapeSQLString(data.status == 'Voided' ? 'Void' : data.status) : null
            const sources = ['POS', 'Online', 'CallCenter']
            const fromDate = data && data.from ? TimeHelper.toPgTimestamp(new Date(data.from)) : null
            const toDate = data && data.to ? TimeHelper.toPgTimestamp(new Date(data.to)) : null

            const limit = data && data.limit ? data.limit : 15
            const page = data && data.page ? data.page : 1
            const offset = limit * (page - 1);

            const values = [companyId, branchId, sources]
            let filterQuery = `Where "Invoices"."companyId" = $1 and "Invoices"."branchId" = $2 and "status" <> 'Draft' and "source" = ANY($3)`;
            let joinQuery = `
             INNER JOIN "Services" On "Invoices"."serviceId" = "Services".id
             Left JOIN "Employees" On "Employees"."companyId" =$1  and  "Invoices"."employeeId" = "Employees".id
             Left JOIN "Customers" On "Customers"."companyId" =$1  and  "Invoices"."customerId" = "Customers".id             
             Left JOIN "Employees" As driver On "driver"."companyId" =$1  and  "Invoices"."driverId" = driver.id
             Left JOIN "InvoicePaymentLines" On "InvoicePaymentLines"."invoiceId" = "Invoices".id
             Left JOIN "Tables" On "Tables".id = "Invoices"."tableId"
             Left JOIN "AppliedCredits" On "AppliedCredits"."invoiceId" = "Invoices".id
            `;


            if (filter) {
                filterQuery += ` AND(
                 TRIM(LOWER("Invoices"."invoiceNumber")) Like ${filter} OR
                 TRIM(LOWER( "Invoices"."refrenceNumber")) Like ${filter} OR
                  TRIM(LOWER("Customers"."name")) Like ${filter} OR
                  TRIM(LOWER("customerContact")) Like ${filter} OR
                   TRIM(LOWER("Employees".name)) Like ${filter} 
                 )
                 `
            }

            if (serviceId) {
                filterQuery += ` AND("serviceId" = '${serviceId}')`
            }

            if (status) {
                filterQuery += ` AND("Invoices"."status" = '${status}')`
            }

            if (fromDate) {
                filterQuery += ` AND("Invoices"."createdAt" >= '${fromDate}'::timestamp)`
            }
            if (toDate) {
                filterQuery += ` AND("Invoices"."createdAt" <= '${toDate}'::timestamp)`
            }
            const query = `with "invo" as  (SELECT "Invoices".id,
                                  "Invoices".aggregator,
                                  "Invoices"."aggregatorId",
                                  "Invoices"."mergeWith",
                                  "Invoices"."dueDate",
                                  "Invoices"."scheduleTime",
                                  "invoiceNumber",
                                  "Invoices"."refrenceNumber",
                                   "Invoices"."total",
                                   "Invoices"."createdAt",
                                   "Services".name As "serviceName",
                                   "Employees".name As "employeeName",
                                   "Customers".saluation || "Customers".name As "customerName",
                                   "Invoices"."customerContact",
                                   "Invoices".note,
                                   COALESCE(sum("InvoicePaymentLines"."amount"::text::numeric),0) as "payment",
                                   COALESCE(sum("AppliedCredits"."amount"::text::numeric),0) as "appliedCredit",
                                   "driverId",
                                    driver.name As "driverName",
                                    "Invoices"."printTime",
                                    "Invoices"."readyTime",
                                    "Invoices"."departureTime",
                                    "Invoices"."arrivalTime",
                                     "Tables".name as "tableName"
                           FROM "Invoices"
                           ${joinQuery}
                           ${filterQuery}
                           group by "Invoices".id,"Services".id,"Employees".id, "driverId",  driver.name, "Tables".id,    "Customers".id
                           limit ${limit + 1}
                           offset ${offset})
                           select "invo".*,COALESCE(sum("InvoiceLines".qty),0) as "itemQty" from "invo"
                           left join "InvoiceLines" on "InvoiceLines"."invoiceId" = "invo".id 
                           group by  "invo".id,
                                "invo"."aggregator",
                                "invo"."aggregatorId",
                                "invo"."mergeWith",
                                "invo"."dueDate",
                                "invo"."scheduleTime",
                                "invo"."invoiceNumber",
                                "invo"."refrenceNumber",
                                "invo"."total",
                                "invo"."createdAt",
                                "invo"."serviceName",
                                "invo"."employeeName",
                                "invo"."customerName",
                                "invo"."customerContact",
                                "invo".note,
                                "invo"."payment",
                                "invo"."appliedCredit",
                                "invo"."driverId",
                                "invo"."driverName",
                                "invo"."printTime",
                                "invo"."readyTime",
                                "invo"."departureTime",
                                "invo"."arrivalTime",
                                "invo"."tableName"
                                order by   "invo"."createdAt" DESC
                            `
            console.log(query)
            let list = await DB.exec.query(query, values);
            let records: any[] = [];
            let hasNext = false;
            if (list && list.rows && list.rows.length > 0) {
                hasNext = list.rows.length > limit ? true : false;
                records = list.rows.slice(0, 15)
            }
            return callback(JSON.stringify(new ResponseData(true, "", { list: records, hasNext: hasNext })))
        } catch (error: any) {
            // throw new Error(error)
            logPosErrorWithContext(error, data, branchId, null, "searchInvoices")

            return callback(JSON.stringify(new ResponseData(false, error.message, { list: [], hasNext: false })))

        }
    }

    public static async getInvoiceById(data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            const companyId = (await BranchesRepo.getBranchCompanyId(null, branchId)).compayId;
            const invoiceId = data.invoiceId;
            if (!invoiceId) {
                callback(JSON.stringify(new ResponseData(false, "Invoice Id Is Required", { invoice: null })))
            }
            const query = {
                text: `Select * from "Invoices" where "companyId" = $1 and"branchId"=$2 and"id" = $3`,
                values: [companyId, branchId, invoiceId]
            }

            const invoiceData = await DB.excu.query(query.text, query.values);
            const invoice: any = invoiceData && invoiceData.rows && invoiceData.rows.length > 0 ? invoiceData.rows[0] : null
            if (invoice) {
                /**============================================================= */
                /** Assign Customer */
                if (invoice.customerId) {
                    const customerData = await DB.excu.query(`select *from "Customers"
                                                            where "companyId"=$1 and id =$2`,
                        [companyId, invoice.customerId])
                    if (customerData.rows.length > 0) invoice.customer = customerData.rows[0]
                }
                /**============================================================= */
                /** Assign Employees */
                // const employees: any[] = [];
                // if (invoice.employeeId) employees.push({ type: "employee", id: invoice.employeeId })
                // if (invoice.salesEmployeeId) employees.push({ type: "salesEmployee", id: invoice.salesEmployeeId })
                // if (invoice.driverId) employees.push({ type: "driver", id: invoice.driverId })

                // if (employees.length > 0) {
                //     query.text = `with "emp" as(
                //                 SELECT
                //                     el->>'type' AS "type",
                //                     el->>'id'   AS "id"
                //                 FROM json_array_elements($1::json) el;
                //                 )

                //                 select "emp".type ,"Employees".id,JSON_BUILD_Object('id',"Employees".id,'name',"Employees".name) as "employee" from "emp"
                //                 inner join "Employees" on "Employees"."companyId" = $2 and "Employees".id = "emp".id::uuid`
                //     query.values = [JSON.stringify(employees), companyId];
                //     const employeesData = await DB.excu.query(query.text, query.values);
                //     if (employeesData.rows.length > 0) {
                //         employeesData.rows.forEach(element => {
                //             if (element.type && element.id) {
                //                 switch (element.type) {
                //                     case 'employee':
                //                         invoice.employee = element.employee
                //                         break;
                //                     case 'salesEmployee':
                //                         invoice.salesEmployee = element.employee
                //                         break;
                //                     case 'driver':
                //                         invoice.driver = element.employee
                //                         break;
                //                     default:
                //                         break;
                //                 }
                //             }
                //         });
                //     }
                // }
                /**============================================================= */
                /**Assign Service */
                // if (invoice.serviceId) {
                //     const service = await DB.excu.query(`SELECT "id", "name", "type" FROM "Services" where "companyId"=$1 and "id"=$2`, [companyId, invoice.serviceId])
                //     if (service.rows.length > 0) invoice.service = service.rows[0]
                // }
                /**============================================================= */
                /**Assign Table */
                // if (invoice.tableId) {
                //     const table = await DB.excu.query(`SELECT "id", "name", "properties" FROM "Tables" where "companyId"=$1 and "id"=$2`, [companyId, invoice.tableId])
                //     if (table.rows.length > 0) invoice.table = table.rows[0]
                // }
                /**============================================================= */
                /**Assign Lines + Options */
                query.text = `SELECT "InvoiceLines".*
                              FROM "InvoiceLines"
                              where "companyId" = $1 and "invoiceId" = $2
                           
                              `
                query.values = [companyId, invoice.id];

                const lines = await DB.excu.query(query.text, query.values);
                const tempLines: any[] = [];
                if (lines.rows.length > 0) {
                    const lineIds = lines.rows.map(m => m.id);
                    query.text = `SELECT "InvoiceLineOptions".*       
                                   FROM "InvoiceLineOptions"
                                 where "invoiceLineId" =any($1)`
                    query.values = [lineIds];

                    const optionData = await DB.excu.query(query.text, query.values);
                    const options = optionData.rows
                    lines.rows.forEach(element => {
                        const lineOptions = options.filter(f => f.invoiceLineId == element.id)
                        if (lineOptions) {
                            element.options = lineOptions
                        }
                        tempLines.push(element)
                    });
                    invoice.lines = tempLines
                }
                /**============================================================= */
                /**Paymnets*/

                // query.text = `SELECT Select "InvoicePaymentLines".id,
                //                             "InvoicePayments".id as "invoicePaymentId",
                //                             "invoiceId",
                //                             "InvoicePayments"."referenceNumber",
                //                             "rate", 
                //                             "InvoicePaymentLines".amount / rate as amount ,
                //                             "InvoicePaymentLines".amount / rate as "tenderAmount",
                //                              0 as changeAmount,
                //                              "paymentMethodId",
                //                              "employeeId",
                //                              "cashierId",
                //                              "InvoicePaymentLines".createdAt 
                //                              JSON_BUILD_OBJECT('id',"PaymentMethods".id,'name',"PaymentMethods".name) as "paymentMethod"
                //                              FROM "InvoicePayments" 
                //               INNER JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId"= $2 and "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                //               INNER JOIN "PaymentMethods" on "PaymentMethods"."companyId" = $1 and "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                //               where "InvoicePayments"."companyId" = $1
                //               and  "InvoicePaymentLines"."invoiceId"= $2
                //               `
                // query.values = [companyId, invoice.id];
                // const payments = await DB.excu.query(query.text, query.values);
                // if (payments.rows.length > 0) invoice.payments = payments.rows
                const payments = await this.getInvoicePayment(companyId, invoiceId);
                if (payments) invoice.payments = payments
                /**============================================================= */
                /**Credit Notes*/



                const creditNotes = await this.getInvoiceCreditNotes(companyId, invoiceId);
                if (creditNotes) {
                    invoice.creditNotes = creditNotes.creditNotes
                    invoice.refunds = creditNotes.refunds ?? []
                }
                /**============================================================= */
                /**Applied Credits*/

                query.text = `SELECT * FROM "AppliedCredits" where "invoiceId" = $1`
                query.values = [invoiceId]

                const AppliedCredits = await DB.excu.query(query.text, query.values)
                if (AppliedCredits && AppliedCredits.rows.length > 0)
                    invoice.appliedCredits = AppliedCredits.rows
            }

            //    return new ResponseData(true, "", { invoice: invoice })             
            return callback(JSON.stringify(new ResponseData(true, "", { invoice: invoice })))
        } catch (error: any) {
            // throw new Error(error)
            logPosErrorWithContext(error, data, branchId, null, "getInvoiceById")

            return callback(JSON.stringify(new ResponseData(false, error.message, { invoice: null })))
        }
    }

    public static async getInvoiceCreditNotes(companyId: string, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "CreditNotes" where "companyId" =$1 and "invoiceId" =$2`,
                values: [companyId, invoiceId]
            }

            const creditNotes = await DB.excu.query(query.text, query.values);
            let creditNotesTemp: any[] = []
            if (creditNotes.rows.length > 0) {
                const creditNoteIds: any[] = creditNotes.rows.map(m => m.id);
                query.text = `SELECT * FROM "CreditNoteLines" where "companyId" =$1 and "creditNoteId" =any($2) `
                query.values = [companyId, creditNoteIds];
                const lines = await DB.excu.query(query.text, query.values);
                const linesTemp: any[] = []
                if (lines) {
                    const lineIds = lines.rows.map(m => m.id)
                    query.text = `SELECT * FROM "CreditNoteLineOptions" where "creditNoteLineId" =any($1)`
                    query.values = [lineIds];
                    const optionlist = await DB.excu.query(query.text, query.values);
                    lines.rows.forEach(element => {
                        const options = optionlist.rows.filter(f => element.id == f.creditNoteLineId)
                        if (options) element.options = options
                        linesTemp.push(element)
                    });
                }
                creditNotes.rows.forEach(element => {
                    const lineTemp = linesTemp.filter(f => f.creditNoteId == element.id);
                    if (lineTemp) element.lines = lineTemp
                    creditNotesTemp.push(element)
                });

            }

            let refundsList: any[] = []
            if (creditNotesTemp.length > 0) {
                const creditNotesIds = creditNotesTemp.map(m => m.id);
                if (creditNotesIds) {
                    query.text = `SELECT * FROM "CreditNoteRefunds" where "creditNoteId" = any($1) `
                    query.values = [creditNotesIds];

                    const refunds = await DB.excu.query(query.text, query.values);
                    if (refunds && refunds.rows.length > 0) {
                        let refundData = refunds.rows
                        const ids = refundData.map(m => m.id);
                        query.text = `SELECT * FROM "CreditNoteRefundLines" where "creditNoteRefundId" = any($1)`,
                            query.values = [ids];
                        const refundLines = await DB.excu.query(query.text, query.values);
                        if (refundLines) {
                            refundData = refundData.map(m => {
                                const lines = refundLines.rows.filter(v => v.creditNoteRefundId == m.id)
                                if (lines) {
                                    m.lines = lines
                                }
                                return m;
                            })
                            refundsList = refundData
                        }
                        // creditNotesTemp = creditNotesTemp.map(m => {
                        //     const refTemp = refundData.filter(f => f.creditNoteId == m.id);
                        //     if (refTemp) {
                        //         m.refunds = refTemp
                        //     }
                        //     return m
                        // })
                    }
                }
            }
            return { creditNotes: creditNotesTemp, refunds: refundsList }
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getInvoicePayment(companyId: string, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "InvoicePaymentLines" where "invoiceId" =$1`,
                values: [invoiceId]
            }

            const invoicePaymentLines = await DB.excu.query(query.text, query.values);
            const invoicePayments: any[] = []
            if (invoicePaymentLines.rows.length > 0) {
                const paymentIds: any[] = invoicePaymentLines.rows.map(m => m.invoicePaymentId);
                query.text = `SELECT * FROM "InvoicePayments" where "companyId" =$1 and "id" =any($2) and "status"= 'SUCCESS' `
                query.values = [companyId, paymentIds];
                const payments = await DB.excu.query(query.text, query.values);
                if (payments) {
                    payments.rows.forEach(element => {
                        let lines = invoicePaymentLines.rows.filter(f => f.invoicePaymentId == element.id)
                        if (lines) element.lines = lines
                        invoicePayments.push(element)
                    });
                }
            }

            return invoicePayments
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async searchInvoiceById(data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }

            const companyId = (await BranchesRepo.getBranchCompanyId(null, branchId)).compayId;
            const invoiceId = data.invoiceId;


            const query = {
                text: `with "invo" as ( select "Invoices".id,
					   "Invoices".aggregator,
					   "Invoices"."aggregatorId",
					   "Invoices"."mergeWith",
					   "Invoices"."dueDate",
					   "Invoices"."scheduleTime",
					   "invoiceNumber",
					   "refrenceNumber",
					   ("total") as total,
					   "Invoices"."createdAt",
					   "driverId",
					   "employeeId",
					   "customerId",
					   "serviceId",
					   "customerContact",
						note,
					   "printTime",
					   "readyTime",
					   "departureTime",
                       "tableId",
						"arrivalTime"
                        from "Invoices" 
                        where "Invoices"."companyId" = $1
                        and "Invoices"."branchId" = $2
                        and "Invoices".id = $3
                    ), "payments" as (
                    select "invo".id , sum("InvoicePaymentLines"."amount") As payment from "invo"
                    inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "invo".id
                    inner join "InvoicePayments" on "InvoicePayments"."companyId" = $1 and "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                    where "InvoicePayments"."status" = 'SUCCESS'
                    group by "invo".id 
                    ),"appliedCredits" as(
                    select "invo".id , sum("AppliedCredits"."amount") As "appliedCredit" from "invo"
                    inner join "AppliedCredits" on "AppliedCredits"."invoiceId" = "invo".id
                    group by "invo".id 
                    ),"invoiceLines" as (
                    select  "invo".id, sum("InvoiceLines"."qty") as "itemQty"  from "invo"
                    inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "invo".id
                        group by "invo".id
                    
                    )
                    select "invo".*,
                        "payments".payment,
                        "appliedCredits"."appliedCredit", 
                        "invoiceLines"."itemQty",
                        "Services".name As "serviceName",
                        "Employees".name As "employeeName",
                        "Customers".saluation || "Customers".name As "customerName",
                            driver.name As "driverName",
                            "Tables".name as "tableName"
                    from "invo"
                    INNER JOIN "Services" On  "Services"."companyId" = $1 and "invo"."serviceId" = "Services".id
                    left join "payments" on "payments".id = "invo".id
                    left join "appliedCredits" on "appliedCredits".id = "invo".id
                    left join "invoiceLines" on "invoiceLines".id = "invo".id
                    Left JOIN "Employees" On "Employees"."companyId" = $1 and  "invo"."employeeId" = "Employees".id
                    Left JOIN "Customers" On "Customers"."companyId" = $1 and "invo"."customerId" = "Customers".id             
                    Left JOIN "Employees" As "driver" On "driver"."companyId" = $1  and  "invo"."driverId" = "driver".id
                    Left JOIN "Tables" On  "Tables"."companyId" = $1  and  "Tables".id = "invo"."tableId"`,
                values: [companyId, branchId, invoiceId]
            }

            const list = await DB.excu.query(query.text, query.values);
            const records = list.rows ?? []
            return callback(JSON.stringify(new ResponseData(true, "", { list: records, hasNext: false })))

        } catch (error: any) {
            logPosErrorWithContext(error, data, branchId, null, "searchInvoiceById")

            return callback(JSON.stringify(new ResponseData(false, error.message, { list: [], hasNext: false })))

        }
    }


    private static async invoiceChangesEvent(invoice: Invoice, currentLines: InvoiceLine[], oldLines: InvoiceLine[], companyId: string) {
        try {

            const payload = {
                invoiceId: invoice.id,
                change: "",
                source: invoice.source,
                companyId: companyId
            }
            const events: any[] = []
            const uniqueKeys = new Set<string>();
            const totalQty = currentLines.reduce((sum, item) => {
                return sum + (item.qty || 0);
            }, 0);

            if (totalQty == 0 || currentLines.length == 0) {
                return
            }

            if (invoice.tableId != invoice.oldTableId) {
                payload.change = "Table Change"
                events.push({ ...payload })
            }
            for (let i = 0; i < currentLines.length; i++) {
                const currentLine = currentLines[i];
                const oldLine = oldLines.find(f => f.id == currentLine.id)
                if (!oldLine) {
                    if (currentLine.qty > 0) {
                        payload.change = "Add Item"
                    } else {
                        payload.change = "Voided Item"
                    }


                } else {
                    if (oldLine.discountTotal == 0 && oldLine.discountTotal > 0) {
                        payload.change = "Add Discount"
                    }
                    if (oldLine.discountTotal > 0 && currentLine.discountTotal == 0) {
                        payload.change = "Remove Discount"
                    }
                    if (oldLine.discountAmount != currentLine.discountAmount) {
                        payload.change = "Change Discount Amount"
                    }


                    if (oldLine.qty != currentLine.qty) {
                        payload.change = "Update qty"
                    }
                }
                if (payload.change != '') {
                    const key = `${payload.invoiceId}_${payload.change}`;
                    if (!uniqueKeys.has(key)) {
                        uniqueKeys.add(key);
                        events.push({ ...payload });
                    }
                }
            }

            events.forEach(element => {
                publishEvent("orderChanged", element)
            });
        } catch (error) {
            throw error
        }
    }
}