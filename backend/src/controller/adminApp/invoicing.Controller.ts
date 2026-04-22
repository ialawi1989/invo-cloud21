import { Request, Response, NextFunction } from 'express';
import { ResponseData } from "@src/models/ResponseData";
import { SubscriptionRepo } from '@src/repo/adminApp/subscription.Repo';
import { DB } from '@src/dbconnection/dbconnection';

export class InvoicingController {

    // ══════════════════════════════════════════════════════════════════
    // FEATURES CATALOG
    // ══════════════════════════════════════════════════════════════════

    public static async getFeatures(req: Request, res: Response, next: NextFunction) {
        try {
            const scope = req.query.scope as string | undefined;
            const features = await SubscriptionRepo.getFeatures(scope);
            return res.send(new ResponseData(true, "", features));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async saveFeature(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.saveFeature(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // PLANS
    // ══════════════════════════════════════════════════════════════════

    public static async getPlans(req: Request, res: Response, next: NextFunction) {
        try {
            const scope = req.query.scope as string | undefined;
            const plans = await SubscriptionRepo.getPlans(scope);
            return res.send(new ResponseData(true, "", plans));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getPlanById(req: Request, res: Response, next: NextFunction) {
        try {
            const plan = await SubscriptionRepo.getPlanById(req.params.id);
            return res.send(new ResponseData(true, "", plan));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async savePlan(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.savePlan(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // FEATURE PRICING
    // ══════════════════════════════════════════════════════════════════

    public static async getFeaturePricing(req: Request, res: Response, next: NextFunction) {
        try {
            const featureId = req.query.featureId as string | undefined;
            const pricing = await SubscriptionRepo.getFeaturePricing(featureId);
            return res.send(new ResponseData(true, "", pricing));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async saveFeaturePricing(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.saveFeaturePricing(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // COMPANY SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════════════════

    public static async getCompanySubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = req.params.companyId;
            const subscription = await SubscriptionRepo.getCompanySubscription(companyId);
            return res.send(new ResponseData(true, "", subscription));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getCompanySubscriptionHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = req.params.companyId;
            const history = await SubscriptionRepo.getCompanySubscriptionHistory(companyId);
            return res.send(new ResponseData(true, "", history));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async createCompanySubscription(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.createCompanySubscription(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async cancelCompanySubscription(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.cancelCompanySubscription(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // BRANCH SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════════════════

    public static async getBranchSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const subscription = await SubscriptionRepo.getBranchSubscription(branchId);
            return res.send(new ResponseData(true, "", subscription));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getBranchSubscriptionHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const history = await SubscriptionRepo.getBranchSubscriptionHistory(branchId);
            return res.send(new ResponseData(true, "", history));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getBranchSubscriptionsByCompany(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = req.params.companyId;
            const subscriptions = await SubscriptionRepo.getBranchSubscriptionsByCompany(companyId);
            return res.send(new ResponseData(true, "", subscriptions));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async createBranchSubscription(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.createBranchSubscription(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    /**
     * Bulk import historical subscriptions.
     * Body: { rows: [...], dryRun?, skipExisting?, performedBy? }
     */
    public static async importSubscriptions(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(300, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.importSubscriptions(client, req.body);
            if (req.body.dryRun) {
                await client.query("ROLLBACK");
            } else {
                await client.query("COMMIT");
            }
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async setSubscriptionAutoRenew(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.setSubscriptionAutoRenew(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async cancelBranchSubscription(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.cancelBranchSubscription(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // MID-CYCLE CHANGES
    // ══════════════════════════════════════════════════════════════════

    public static async addFeatureMidCycle(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const proration = await SubscriptionRepo.addFeatureMidCycle(client, req.body);
            await client.query("COMMIT");
            return res.send(new ResponseData(true, "", proration));
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async increaseQuantityMidCycle(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const proration = await SubscriptionRepo.increaseQuantityMidCycle(client, req.body);
            await client.query("COMMIT");
            return res.send(new ResponseData(true, "", proration));
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async removeFeatureMidCycle(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.removeFeatureMidCycle(client, req.body);
            await client.query("COMMIT");
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // ENTITLEMENT QUERIES
    // ══════════════════════════════════════════════════════════════════

    public static async getActiveCompanyFeatures(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = req.params.companyId;
            const features = await SubscriptionRepo.getActiveCompanyFeatures(companyId);
            return res.send(new ResponseData(true, "", features));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getSubscriptionFeatures(req: Request, res: Response, next: NextFunction) {
        try {
            const { subscriptionId, subscriptionType } = req.params;
            if (subscriptionType !== 'company' && subscriptionType !== 'branch') {
                return res.send(new ResponseData(false, "subscriptionType must be 'company' or 'branch'", []));
            }
            const features = await SubscriptionRepo.getSubscriptionFeatures(subscriptionId, subscriptionType);
            return res.send(new ResponseData(true, "", features));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getFutureCompanyFeatures(req: Request, res: Response, next: NextFunction) {
        try {
            const features = await SubscriptionRepo.getFutureCompanyFeatures(req.params.companyId);
            return res.send(new ResponseData(true, "", features));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getFutureBranchFeatures(req: Request, res: Response, next: NextFunction) {
        try {
            const features = await SubscriptionRepo.getFutureBranchFeatures(req.params.branchId);
            return res.send(new ResponseData(true, "", features));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getActiveBranchFeatures(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const features = await SubscriptionRepo.getActiveBranchFeatures(branchId);
            return res.send(new ResponseData(true, "", features));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getAllowedDevices(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const deviceType = req.params.deviceType;
            const result = await SubscriptionRepo.canRegisterDevice(branchId, deviceType);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // BILLING INVOICES
    // ══════════════════════════════════════════════════════════════════

    /**
     * Generate a billing invoice from a company's active subscriptions.
     * Body: { companyId, taxRate?, dueDays?, discount?, notes? }
     */
    public static async createBillingInvoice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const invoiceNumber = await SubscriptionRepo.generateInvoiceNumber();
            const data = {
                companyId: req.body.companyId,
                invoiceNumber,
                taxRate: req.body.taxRate,
                dueDays: req.body.dueDays,
                discount: req.body.discount,
                notes: req.body.notes,
            };
            const result = await SubscriptionRepo.createBillingInvoice(client, data);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async getBillingInvoiceById(req: Request, res: Response, next: NextFunction) {
        try {
            const invoice = await SubscriptionRepo.getBillingInvoiceById(req.params.id);
            return res.send(new ResponseData(true, "", invoice));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getBillingInvoicesByCompany(req: Request, res: Response, next: NextFunction) {
        try {
            const invoices = await SubscriptionRepo.getBillingInvoicesByCompany(req.params.companyId);
            return res.send(new ResponseData(true, "", invoices));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    /**
     * List billing invoices with pagination, filters, and sorting.
     * Query params: page, pageSize, status, companyId, search, dateFrom, dateTo, sortBy, sortDir
     */
    public static async getAllBillingInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
                status: req.query.status as string,
                companyId: req.query.companyId as string,
                search: req.query.search as string,
                dateFrom: req.query.dateFrom as string,
                dateTo: req.query.dateTo as string,
                sortBy: req.query.sortBy as string,
                sortDir: req.query.sortDir as string,
            };
            const result = await SubscriptionRepo.getAllBillingInvoices(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async voidBillingInvoice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.voidBillingInvoice(client, req.params.id);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // PAYMENTS
    // ══════════════════════════════════════════════════════════════════

    /**
     * Create a payment linked to invoices.
     * Body: { companyId, amount, paymentMethod, invoiceIds?, allocations?, paymentDate?, reference?, notes?, receivedBy? }
     */
    public static async createPayment(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const paymentNumber = await SubscriptionRepo.generatePaymentNumber();
            const data = { ...req.body, paymentNumber };
            const result = await SubscriptionRepo.createPayment(client, data);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async allocatePayment(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const { paymentId, invoiceId, amount } = req.body;
            const result = await SubscriptionRepo.allocatePayment(client, paymentId, invoiceId, amount);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async getPaymentsByCompany(req: Request, res: Response, next: NextFunction) {
        try {
            const payments = await SubscriptionRepo.getPaymentsByCompany(req.params.companyId);
            return res.send(new ResponseData(true, "", payments));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getPaymentById(req: Request, res: Response, next: NextFunction) {
        try {
            const payment = await SubscriptionRepo.getPaymentById(req.params.id);
            return res.send(new ResponseData(true, "", payment));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    /**
     * List payments with pagination, filters, and sorting.
     * Query params: page, pageSize, status, companyId, paymentMethod, search, dateFrom, dateTo, sortBy, sortDir
     */
    public static async getAllPayments(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
                status: req.query.status as string,
                companyId: req.query.companyId as string,
                paymentMethod: req.query.paymentMethod as string,
                search: req.query.search as string,
                dateFrom: req.query.dateFrom as string,
                dateTo: req.query.dateTo as string,
                sortBy: req.query.sortBy as string,
                sortDir: req.query.sortDir as string,
            };
            const result = await SubscriptionRepo.getAllPayments(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // BRANCH DEVICES
    // ══════════════════════════════════════════════════════════════════

    public static async registerDevice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.registerDevice(client, req.body);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    public static async getBranchDevices(req: Request, res: Response, next: NextFunction) {
        try {
            const devices = await SubscriptionRepo.getBranchDevices(req.params.branchId);
            return res.send(new ResponseData(true, "", devices));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async updateDeviceStatus(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(60, "admin");
        try {
            await client.query("BEGIN");
            const result = await SubscriptionRepo.updateDeviceStatus(client, req.params.id, req.body.status);
            await client.query("COMMIT");
            return res.send(result);
        } catch (error: any) {
            await client.query("ROLLBACK");
            return res.send(new ResponseData(false, error.message, []));
        } finally {
            client.release();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // SUBSCRIPTION CHANGE LOG
    // ══════════════════════════════════════════════════════════════════

    public static async getSubscriptionChanges(req: Request, res: Response, next: NextFunction) {
        try {
            const { subscriptionId, subscriptionType } = req.params;
            const changes = await SubscriptionRepo.getSubscriptionChanges(subscriptionId, subscriptionType);
            return res.send(new ResponseData(true, "", changes));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    /**
     * List all subscription changes with pagination and filters.
     * Body: { page?, pageSize?, changeType?, subscriptionType?, companyId?, branchId?, dateFrom?, dateTo?, search? }
     */
    public static async listSubscriptionChanges(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.body.page ? parseInt(req.body.page) : 1,
                pageSize: req.body.pageSize ? parseInt(req.body.pageSize) : 25,
                changeType: req.body.changeType,
                subscriptionType: req.body.subscriptionType,
                companyId: req.body.companyId,
                branchId: req.body.branchId,
                dateFrom: req.body.dateFrom,
                dateTo: req.body.dateTo,
                search: req.body.search,
            };
            const result = await SubscriptionRepo.listSubscriptionChanges(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // ANALYTICS / REVENUE
    // ══════════════════════════════════════════════════════════════════

    public static async getRevenue(req: Request, res: Response, next: NextFunction) {
        try {
            const revenue = await SubscriptionRepo.calculateMRR();
            return res.send(new ResponseData(true, "", revenue));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getExpiringSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const days = parseInt(req.query.days as string) || 30;
            const expiring = await SubscriptionRepo.getExpiringSubscriptions(days);
            return res.send(new ResponseData(true, "", expiring));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getOverdueInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const invoices = await SubscriptionRepo.getOverdueInvoices();
            return res.send(new ResponseData(true, "", invoices));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }
}
