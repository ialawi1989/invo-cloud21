import { Request, Response, NextFunction } from 'express';
import { ResponseData } from "@src/models/ResponseData";
import { ReportsRepo } from '@src/repo/adminApp/reports.Repo';
import { sendCsv } from '@src/utilts/csvExport';

export class ReportsController {

    // ── Retention & Churn ──

    public static async getCohortRetention(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getCohortRetention(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getMonthlyChurnRate(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getMonthlyChurnRate(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ── Revenue ──

    public static async getMrrTrend(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getMrrTrend(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getMrrWaterfall(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getMrrWaterfall(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getRevenueByPlan(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await ReportsRepo.getRevenueByPlan();
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getNetRevenueRetention(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getNetRevenueRetention(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ── Acquisition & Growth ──

    public static async getNewSignups(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getNewSignups(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getActivationRate(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 12;
            const data = await ReportsRepo.getActivationRate(months);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ── Customer Health ──

    public static async getAccountHealth(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await ReportsRepo.getAccountHealth();
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getAccountsAtRisk(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await ReportsRepo.getAccountsAtRisk();
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getUsageFrequency(req: Request, res: Response, next: NextFunction) {
        try {
            const weeks = parseInt(req.query.weeks as string) || 12;
            const data = await ReportsRepo.getUsageFrequency(weeks);
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ── Dashboard ──

    public static async getDashboardKpis(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await ReportsRepo.getDashboardKpis();
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // COHORT REPORTS (Excel-style)
    // ══════════════════════════════════════════════════════════════════

    public static async getCohortSummaryKpis(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await ReportsRepo.getCohortSummaryKpis();
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getCohortMonthlyTrend(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 24;
            const data = await ReportsRepo.getCohortMonthlyTrend(months);
            if (req.query.format === 'csv') {
                return sendCsv(res, data, `monthly_trend_${Date.now()}.csv`);
            }
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    public static async getCohortProfileSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await ReportsRepo.getCohortProfileSummary();
            if (req.query.format === 'csv') {
                return sendCsv(res, data, `cohort_profile_${Date.now()}.csv`);
            }
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    /** Retention matrix rows (cohort × month_offset) — flat rows, pivot on client */
    public static async getCohortRetentionMatrix(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 24;
            const data = await ReportsRepo.getCohortRetention(months);
            if (req.query.format === 'csv') {
                return sendCsv(res, data, `cohort_retention_matrix_${Date.now()}.csv`);
            }
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    /** Revenue retention by cohort — same data as NRR, exportable */
    public static async getRevenueRetentionByCohort(req: Request, res: Response, next: NextFunction) {
        try {
            const months = parseInt(req.query.months as string) || 24;
            const data = await ReportsRepo.getNetRevenueRetention(months);
            if (req.query.format === 'csv') {
                return sendCsv(res, data, `revenue_retention_${Date.now()}.csv`);
            }
            return res.send(new ResponseData(true, "", data));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // AT-RISK: Expiring subscriptions with autoRenew = false (paginated + CSV)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Query params: page, pageSize, daysAhead, subscriptionType, search, sortBy, sortDir, format=csv
     */
    public static async listAtRiskSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
                daysAhead: req.query.daysAhead ? parseInt(req.query.daysAhead as string) : 60,
                subscriptionType: req.query.subscriptionType as string,
                search: req.query.search as string,
                sortBy: req.query.sortBy as string,
                sortDir: req.query.sortDir as string,
            };

            if (req.query.format === 'csv') {
                const all = await ReportsRepo.listAtRiskSubscriptions({
                    ...filters, page: 1, pageSize: 10000,
                });
                return sendCsv(res, all.rows, `at_risk_subscriptions_${Date.now()}.csv`);
            }

            const result = await ReportsRepo.listAtRiskSubscriptions(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // UNINVOICED SUBSCRIPTIONS (paginated + CSV)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Query params: page, pageSize, subscriptionType, companyId, search, format=csv
     */
    public static async listUninvoicedSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
                subscriptionType: req.query.subscriptionType as string,
                companyId: req.query.companyId as string,
                search: req.query.search as string,
            };

            if (req.query.format === 'csv') {
                const all = await ReportsRepo.listUninvoicedSubscriptions({
                    ...filters, page: 1, pageSize: 10000,
                });
                return sendCsv(res, all.rows, `uninvoiced_subscriptions_${Date.now()}.csv`);
            }

            const result = await ReportsRepo.listUninvoicedSubscriptions(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // OVERDUE INVOICES (paginated + CSV)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Query params: page, pageSize, companyId, search, minDaysOverdue, sortBy, sortDir, format=csv
     */
    public static async listOverdueInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
                companyId: req.query.companyId as string,
                search: req.query.search as string,
                minDaysOverdue: req.query.minDaysOverdue ? parseInt(req.query.minDaysOverdue as string) : undefined,
                sortBy: req.query.sortBy as string,
                sortDir: req.query.sortDir as string,
            };

            if (req.query.format === 'csv') {
                const all = await ReportsRepo.listOverdueInvoices({
                    ...filters, page: 1, pageSize: 10000,
                });
                return sendCsv(res, all.rows, `overdue_invoices_${Date.now()}.csv`);
            }

            const result = await ReportsRepo.listOverdueInvoices(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // INACTIVE / LOW ACTIVITY (paginated + CSV)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Paginated listing of inactive / low-activity accounts.
     * Query params: page, pageSize, health, search, sortBy, sortDir, format=csv
     */
    public static async listInactiveAccounts(req: Request, res: Response, next: NextFunction) {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
                health: req.query.health as string,
                search: req.query.search as string,
                sortBy: req.query.sortBy as string,
                sortDir: req.query.sortDir as string,
            };

            // For CSV export, return all matching rows
            if (req.query.format === 'csv') {
                const allData = await ReportsRepo.listInactiveAccounts({
                    ...filters,
                    page: 1,
                    pageSize: 10000,
                });
                return sendCsv(res, allData.rows, `inactive_accounts_${Date.now()}.csv`);
            }

            const result = await ReportsRepo.listInactiveAccounts(filters);
            return res.send(new ResponseData(true, "", result));
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }
}
