import { DB } from "@src/dbconnection/dbconnection";

export class ReportsRepo {

    // ══════════════════════════════════════════════════════════════════
    // RETENTION & CHURN
    // ══════════════════════════════════════════════════════════════════

    /**
     * Cohort retention matrix.
     * Groups branches by their subscription start month (cohort),
     * then checks how many remained active in each subsequent month.
     * Returns: [{ cohort: '2025-01', month0: 50, month1: 48, month2: 45, ... }]
     */
    public static async getCohortRetention(months: number = 12) {
        const result = await DB.excu.query(
            `WITH cohorts AS (
                SELECT
                    bs."branchId",
                    DATE_TRUNC('month', MIN(bs."startDate")) AS cohort_month
                FROM admin."BranchSubscriptions" bs
                GROUP BY bs."branchId"
            ),
            months AS (
                SELECT generate_series(0, $1 - 1) AS month_offset
            ),
            cohort_sizes AS (
                SELECT cohort_month, COUNT(*) AS cohort_size
                FROM cohorts
                GROUP BY cohort_month
            ),
            retention AS (
                SELECT
                    c.cohort_month,
                    m.month_offset,
                    COUNT(DISTINCT CASE
                        WHEN EXISTS (
                            SELECT 1 FROM admin."BranchSubscriptions" bs2
                            WHERE bs2."branchId" = c."branchId"
                              AND bs2.status IN ('active', 'cancelled', 'expired')
                              AND bs2."startDate" <= (c.cohort_month + (m.month_offset || ' months')::INTERVAL + INTERVAL '1 month - 1 day')
                              AND bs2."endDate" >= (c.cohort_month + (m.month_offset || ' months')::INTERVAL)
                        ) THEN c."branchId"
                    END) AS retained_count
                FROM cohorts c
                CROSS JOIN months m
                WHERE c.cohort_month + (m.month_offset || ' months')::INTERVAL <= CURRENT_DATE
                GROUP BY c.cohort_month, m.month_offset
            )
            SELECT
                TO_CHAR(r.cohort_month, 'YYYY-MM') AS cohort,
                cs.cohort_size,
                r.month_offset,
                r.retained_count,
                ROUND((r.retained_count::NUMERIC / NULLIF(cs.cohort_size, 0)) * 100, 1) AS retention_pct
            FROM retention r
            JOIN cohort_sizes cs ON cs.cohort_month = r.cohort_month
            ORDER BY r.cohort_month, r.month_offset`,
            [months], "admin"
        );
        return result.rows;
    }

    /**
     * Monthly churn rate.
     * churn_rate = branches lost / active at start of month
     */
    public static async getMonthlyChurnRate(months: number = 12) {
        const result = await DB.excu.query(
            `WITH month_series AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::INTERVAL),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'::INTERVAL
                ) AS month_start
            ),
            monthly_stats AS (
                SELECT
                    ms.month_start,
                    -- Active at start of month
                    (SELECT COUNT(DISTINCT bs."branchId")
                     FROM admin."BranchSubscriptions" bs
                     WHERE bs."startDate" < ms.month_start
                       AND bs."endDate" >= ms.month_start
                       AND bs.status != 'pending'
                    ) AS active_start,
                    -- Churned during this month (endDate fell within this month and not renewed)
                    (SELECT COUNT(DISTINCT bs."branchId")
                     FROM admin."BranchSubscriptions" bs
                     WHERE bs."endDate" >= ms.month_start
                       AND bs."endDate" < ms.month_start + INTERVAL '1 month'
                       AND bs.status IN ('expired', 'cancelled')
                       AND NOT EXISTS (
                           SELECT 1 FROM admin."BranchSubscriptions" bs2
                           WHERE bs2."branchId" = bs."branchId"
                             AND bs2."startDate" >= ms.month_start
                             AND bs2."startDate" < ms.month_start + INTERVAL '1 month'
                             AND bs2.id != bs.id
                       )
                    ) AS churned
                FROM month_series ms
            )
            SELECT
                TO_CHAR(month_start, 'YYYY-MM') AS month,
                active_start,
                churned,
                CASE WHEN active_start > 0
                     THEN ROUND((churned::NUMERIC / active_start) * 100, 2)
                     ELSE 0
                END AS churn_rate_pct
            FROM monthly_stats
            ORDER BY month_start`,
            [months], "admin"
        );
        return result.rows;
    }

    // ══════════════════════════════════════════════════════════════════
    // REVENUE (MRR / ARR)
    // ══════════════════════════════════════════════════════════════════

    /**
     * MRR trend over time.
     * For each month, calculates total MRR from all active subscriptions.
     */
    public static async getMrrTrend(months: number = 12) {
        const result = await DB.excu.query(
            `WITH month_series AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::INTERVAL),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'::INTERVAL
                ) AS month_start
            )
            SELECT
                TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
                COALESCE((
                    SELECT SUM(
                        CASE WHEN cs."billingCycle" = 'yearly' THEN cs."basePrice" / 12
                             ELSE cs."basePrice"
                        END
                    )
                    FROM admin."CompanySubscriptions" cs
                    WHERE cs."startDate" <= ms.month_start + INTERVAL '1 month - 1 day'
                      AND cs."endDate" >= ms.month_start
                      AND cs.status != 'pending'
                ), 0) AS company_mrr,
                COALESCE((
                    SELECT SUM(
                        CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12
                             ELSE bs."basePrice"
                        END
                    )
                    FROM admin."BranchSubscriptions" bs
                    WHERE bs."startDate" <= ms.month_start + INTERVAL '1 month - 1 day'
                      AND bs."endDate" >= ms.month_start
                      AND bs.status != 'pending'
                ), 0) AS branch_mrr
            FROM month_series ms
            ORDER BY ms.month_start`,
            [months], "admin"
        );
        return result.rows.map(r => ({
            month: r.month,
            companyMrr: parseFloat(r.company_mrr),
            branchMrr: parseFloat(r.branch_mrr),
            totalMrr: parseFloat(r.company_mrr) + parseFloat(r.branch_mrr),
        }));
    }

    /**
     * MRR Waterfall — new MRR vs expansion vs churned MRR per month.
     * - new: subscriptions that started this month (first-ever for that entity)
     * - expansion: mid-cycle additions or quantity increases this month
     * - churned: subscriptions that ended this month without renewal
     * - contraction: mid-cycle removals or quantity decreases
     */
    public static async getMrrWaterfall(months: number = 12) {
        const result = await DB.excu.query(
            `WITH month_series AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::INTERVAL),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'::INTERVAL
                ) AS month_start
            ),
            waterfall AS (
                SELECT
                    ms.month_start,
                    -- New MRR: first subscription for a branch starting this month
                    COALESCE((
                        SELECT SUM(CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12 ELSE bs."basePrice" END)
                        FROM admin."BranchSubscriptions" bs
                        WHERE bs."startDate" >= ms.month_start
                          AND bs."startDate" < ms.month_start + INTERVAL '1 month'
                          AND NOT EXISTS (
                              SELECT 1 FROM admin."BranchSubscriptions" prev
                              WHERE prev."branchId" = bs."branchId"
                                AND prev."startDate" < bs."startDate"
                          )
                    ), 0) AS new_mrr,
                    -- Expansion MRR: mid-cycle additions
                    COALESCE((
                        SELECT SUM(sc."proratedAmount" / GREATEST(
                            EXTRACT(EPOCH FROM (
                                (SELECT bs."endDate" FROM admin."BranchSubscriptions" bs WHERE bs.id = sc."subscriptionId" LIMIT 1)::TIMESTAMP -
                                sc."effectiveDate"::TIMESTAMP
                            )) / 2592000, 1))  -- normalize to monthly
                        FROM admin."SubscriptionChanges" sc
                        WHERE sc."changeType" IN ('add_feature', 'increase_quantity')
                          AND sc."effectiveDate" >= ms.month_start::DATE
                          AND sc."effectiveDate" < (ms.month_start + INTERVAL '1 month')::DATE
                          AND sc."proratedAmount" > 0
                    ), 0) AS expansion_mrr,
                    -- Churned MRR: subscriptions ended without renewal
                    COALESCE((
                        SELECT SUM(CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12 ELSE bs."basePrice" END)
                        FROM admin."BranchSubscriptions" bs
                        WHERE bs."endDate" >= ms.month_start::DATE
                          AND bs."endDate" < (ms.month_start + INTERVAL '1 month')::DATE
                          AND bs.status IN ('expired', 'cancelled')
                          AND NOT EXISTS (
                              SELECT 1 FROM admin."BranchSubscriptions" renew
                              WHERE renew."branchId" = bs."branchId"
                                AND renew."startDate" >= bs."endDate"
                                AND renew."startDate" < bs."endDate" + INTERVAL '7 days'
                          )
                    ), 0) AS churned_mrr,
                    -- Contraction MRR: mid-cycle removals
                    COALESCE((
                        SELECT ABS(SUM(sc."proratedAmount"))
                        FROM admin."SubscriptionChanges" sc
                        WHERE sc."changeType" IN ('remove_feature', 'decrease_quantity')
                          AND sc."effectiveDate" >= ms.month_start::DATE
                          AND sc."effectiveDate" < (ms.month_start + INTERVAL '1 month')::DATE
                          AND sc."proratedAmount" < 0
                    ), 0) AS contraction_mrr
                FROM month_series ms
            )
            SELECT
                TO_CHAR(month_start, 'YYYY-MM') AS month,
                ROUND(new_mrr::NUMERIC, 2) AS "newMrr",
                ROUND(expansion_mrr::NUMERIC, 2) AS "expansionMrr",
                ROUND(churned_mrr::NUMERIC, 2) AS "churnedMrr",
                ROUND(contraction_mrr::NUMERIC, 2) AS "contractionMrr",
                ROUND((new_mrr + expansion_mrr - churned_mrr - contraction_mrr)::NUMERIC, 2) AS "netNewMrr"
            FROM waterfall
            ORDER BY month_start`,
            [months], "admin"
        );
        return result.rows;
    }

    /**
     * Revenue by plan/tier.
     * Shows active subscription count and MRR per plan.
     */
    public static async getRevenueByPlan() {
        const result = await DB.excu.query(
            `SELECT
                COALESCE(sp.name, 'Custom') AS "planName",
                sp.slug AS "planSlug",
                sp.scope,
                COUNT(*) AS "activeCount",
                SUM(
                    CASE WHEN sub."billingCycle" = 'yearly' THEN sub."basePrice" / 12
                         ELSE sub."basePrice"
                    END
                ) AS mrr,
                SUM(sub."basePrice") AS "totalRevenue"
             FROM (
                SELECT "planId", "billingCycle", "basePrice" FROM admin."CompanySubscriptions" WHERE status = 'active'
                UNION ALL
                SELECT "planId", "billingCycle", "basePrice" FROM admin."BranchSubscriptions" WHERE status = 'active'
             ) sub
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = sub."planId"
             GROUP BY sp.name, sp.slug, sp.scope
             ORDER BY mrr DESC`,
            [], "admin"
        );
        return result.rows;
    }

    /**
     * Net Revenue Retention by cohort.
     * For each cohort month, tracks the MRR of that cohort over subsequent months
     * compared to their starting MRR. NRR > 100% = expansion exceeds churn.
     */
    public static async getNetRevenueRetention(months: number = 12) {
        const result = await DB.excu.query(
            `WITH cohorts AS (
                SELECT
                    bs."branchId",
                    bs."companyId",
                    DATE_TRUNC('month', MIN(bs."startDate")) AS cohort_month,
                    MIN(CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12 ELSE bs."basePrice" END) AS initial_mrr
                FROM admin."BranchSubscriptions" bs
                GROUP BY bs."branchId", bs."companyId"
            ),
            cohort_totals AS (
                SELECT cohort_month, SUM(initial_mrr) AS starting_mrr
                FROM cohorts
                GROUP BY cohort_month
            ),
            month_offsets AS (
                SELECT generate_series(0, $1 - 1) AS month_offset
            ),
            revenue_tracking AS (
                SELECT
                    c.cohort_month,
                    mo.month_offset,
                    COALESCE(SUM(
                        CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12
                             ELSE bs."basePrice"
                        END
                    ), 0) AS current_mrr
                FROM cohorts c
                CROSS JOIN month_offsets mo
                LEFT JOIN admin."BranchSubscriptions" bs
                    ON bs."branchId" = c."branchId"
                   AND bs.status != 'pending'
                   AND bs."startDate" <= (c.cohort_month + (mo.month_offset || ' months')::INTERVAL + INTERVAL '1 month - 1 day')
                   AND bs."endDate" >= (c.cohort_month + (mo.month_offset || ' months')::INTERVAL)
                WHERE c.cohort_month + (mo.month_offset || ' months')::INTERVAL <= CURRENT_DATE
                GROUP BY c.cohort_month, mo.month_offset
            )
            SELECT
                TO_CHAR(rt.cohort_month, 'YYYY-MM') AS cohort,
                ct.starting_mrr AS "startingMrr",
                rt.month_offset AS "monthOffset",
                ROUND(rt.current_mrr::NUMERIC, 2) AS "currentMrr",
                CASE WHEN ct.starting_mrr > 0
                     THEN ROUND((rt.current_mrr / ct.starting_mrr) * 100, 1)
                     ELSE 0
                END AS "nrrPct"
            FROM revenue_tracking rt
            JOIN cohort_totals ct ON ct.cohort_month = rt.cohort_month
            ORDER BY rt.cohort_month, rt.month_offset`,
            [months], "admin"
        );
        return result.rows;
    }

    // ══════════════════════════════════════════════════════════════════
    // ACQUISITION & GROWTH
    // ══════════════════════════════════════════════════════════════════

    /**
     * New signups per month.
     * Counts new companies and branches by month.
     */
    public static async getNewSignups(months: number = 12) {
        const result = await DB.excu.query(
            `WITH month_series AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::INTERVAL),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'::INTERVAL
                ) AS month_start
            )
            SELECT
                TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
                COALESCE((
                    SELECT COUNT(*)
                    FROM "Companies" c
                    WHERE DATE_TRUNC('month', c."createdAt") = ms.month_start
                ), 0) AS "newCompanies",
                COALESCE((
                    SELECT COUNT(*)
                    FROM "Branches" b
                    WHERE DATE_TRUNC('month', b."createdAt") = ms.month_start
                ), 0) AS "newBranches",
                COALESCE((
                    SELECT COUNT(*)
                    FROM admin."CompanySubscriptions" cs
                    WHERE DATE_TRUNC('month', cs."startDate"::TIMESTAMP) = ms.month_start
                      AND NOT EXISTS (
                          SELECT 1 FROM admin."CompanySubscriptions" prev
                          WHERE prev."companyId" = cs."companyId"
                            AND prev."startDate" < cs."startDate"
                      )
                ), 0) AS "newCompanySubscriptions",
                COALESCE((
                    SELECT COUNT(*)
                    FROM admin."BranchSubscriptions" bs
                    WHERE DATE_TRUNC('month', bs."startDate"::TIMESTAMP) = ms.month_start
                      AND NOT EXISTS (
                          SELECT 1 FROM admin."BranchSubscriptions" prev
                          WHERE prev."branchId" = bs."branchId"
                            AND prev."startDate" < bs."startDate"
                      )
                ), 0) AS "newBranchSubscriptions"
            FROM month_series ms
            ORDER BY ms.month_start`,
            [months], "admin"
        );
        return result.rows;
    }

    /**
     * Activation rate.
     * Companies that signed up and actually created at least one invoice/transaction
     * within their first 30 days.
     */
    public static async getActivationRate(months: number = 12) {
        const result = await DB.excu.query(
            `WITH month_series AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::INTERVAL),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'::INTERVAL
                ) AS month_start
            ),
            new_companies AS (
                SELECT
                    c.id AS "companyId",
                    DATE_TRUNC('month', c."createdAt") AS signup_month
                FROM "Companies" c
            )
            SELECT
                TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
                COUNT(nc."companyId") AS "totalSignups",
                COUNT(CASE
                    WHEN EXISTS (
                        SELECT 1 FROM "Invoices" inv
                        WHERE inv."companyId" = nc."companyId"
                          AND inv."createdAt" <= nc.signup_month + INTERVAL '30 days'
                    ) THEN 1
                END) AS "activatedCount",
                CASE WHEN COUNT(nc."companyId") > 0
                     THEN ROUND(
                         COUNT(CASE
                             WHEN EXISTS (
                                 SELECT 1 FROM "Invoices" inv
                                 WHERE inv."companyId" = nc."companyId"
                                   AND inv."createdAt" <= nc.signup_month + INTERVAL '30 days'
                             ) THEN 1
                         END)::NUMERIC / COUNT(nc."companyId") * 100, 1)
                     ELSE 0
                END AS "activationRatePct"
            FROM month_series ms
            LEFT JOIN new_companies nc ON nc.signup_month = ms.month_start
            GROUP BY ms.month_start
            ORDER BY ms.month_start`,
            [months], "admin"
        );
        return result.rows;
    }

    // ══════════════════════════════════════════════════════════════════
    // CUSTOMER HEALTH
    // ══════════════════════════════════════════════════════════════════

    /**
     * Active vs inactive accounts.
     * Active = has an active subscription AND created at least 1 invoice in last 30 days.
     * Inactive = has subscription but no recent activity.
     * No subscription = no active subscription at all.
     */
    public static async getAccountHealth() {
        const result = await DB.excu.query(
            `SELECT
                c.id AS "companyId",
                c.name AS "companyName",
                c."createdAt" AS "signupDate",
                CASE
                    WHEN cs.id IS NULL THEN 'no_subscription'
                    WHEN last_inv."lastInvoiceDate" >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
                    WHEN last_inv."lastInvoiceDate" >= CURRENT_DATE - INTERVAL '90 days' THEN 'low_activity'
                    ELSE 'inactive'
                END AS health,
                cs.status AS "subscriptionStatus",
                cs."endDate" AS "subscriptionEndDate",
                last_inv."lastInvoiceDate",
                last_inv."invoiceCount30d",
                branch_count."branchCount",
                active_branch_count."activeBranchCount"
             FROM "Companies" c
             LEFT JOIN admin."CompanySubscriptions" cs
                ON cs."companyId" = c.id AND cs.status = 'active'
             LEFT JOIN LATERAL (
                SELECT
                    MAX(inv."createdAt") AS "lastInvoiceDate",
                    COUNT(*) FILTER (WHERE inv."createdAt" >= CURRENT_DATE - INTERVAL '30 days') AS "invoiceCount30d"
                FROM "Invoices" inv
                WHERE inv."companyId" = c.id
             ) last_inv ON true
             LEFT JOIN LATERAL (
                SELECT COUNT(*) AS "branchCount"
                FROM "Branches" b WHERE b."companyId" = c.id
             ) branch_count ON true
             LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT bs."branchId") AS "activeBranchCount"
                FROM admin."BranchSubscriptions" bs
                WHERE bs."companyId" = c.id AND bs.status = 'active'
             ) active_branch_count ON true
             ORDER BY health, c.name`,
            [], "admin"
        );

        const summary = {
            active: result.rows.filter(r => r.health === 'active').length,
            lowActivity: result.rows.filter(r => r.health === 'low_activity').length,
            inactive: result.rows.filter(r => r.health === 'inactive').length,
            noSubscription: result.rows.filter(r => r.health === 'no_subscription').length,
            total: result.rows.length,
        };

        return { summary, accounts: result.rows };
    }

    /**
     * Accounts at risk.
     * Criteria: low activity (no invoices in 30 days) + renewal within next 60 days.
     */
    public static async getAccountsAtRisk() {
        const result = await DB.excu.query(
            `SELECT
                c.id AS "companyId",
                c.name AS "companyName",
                cs."endDate" AS "renewalDate",
                cs."endDate" - CURRENT_DATE AS "daysUntilRenewal",
                cs."basePrice",
                cs."billingCycle",
                CASE WHEN cs."billingCycle" = 'yearly' THEN cs."basePrice" / 12 ELSE cs."basePrice" END AS mrr,
                last_activity."lastInvoiceDate",
                CURRENT_DATE - last_activity."lastInvoiceDate"::DATE AS "daysSinceLastActivity",
                last_activity."invoiceCount30d",
                branch_stats."totalBranches",
                branch_stats."activeBranches"
             FROM admin."CompanySubscriptions" cs
             JOIN "Companies" c ON c.id = cs."companyId"
             LEFT JOIN LATERAL (
                SELECT
                    MAX(inv."createdAt") AS "lastInvoiceDate",
                    COUNT(*) FILTER (WHERE inv."createdAt" >= CURRENT_DATE - INTERVAL '30 days') AS "invoiceCount30d"
                FROM "Invoices" inv
                WHERE inv."companyId" = c.id
             ) last_activity ON true
             LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) AS "totalBranches",
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM admin."BranchSubscriptions" bs2
                        WHERE bs2."branchId" = b.id AND bs2.status = 'active'
                    )) AS "activeBranches"
                FROM "Branches" b WHERE b."companyId" = c.id
             ) branch_stats ON true
             WHERE cs.status = 'active'
               AND cs."endDate" <= CURRENT_DATE + INTERVAL '60 days'
               AND (last_activity."invoiceCount30d" = 0 OR last_activity."lastInvoiceDate" IS NULL)
             ORDER BY cs."endDate" ASC`,
            [], "admin"
        );
        return result.rows;
    }

    /**
     * Usage frequency per company.
     * Invoices created per week over the last N weeks.
     */
    public static async getUsageFrequency(weeks: number = 12) {
        const result = await DB.excu.query(
            `WITH week_series AS (
                SELECT generate_series(
                    DATE_TRUNC('week', CURRENT_DATE - ($1 || ' weeks')::INTERVAL),
                    DATE_TRUNC('week', CURRENT_DATE),
                    '1 week'::INTERVAL
                ) AS week_start
            )
            SELECT
                TO_CHAR(ws.week_start, 'YYYY-MM-DD') AS "weekStart",
                COALESCE(COUNT(inv.id), 0) AS "invoiceCount",
                COALESCE(COUNT(DISTINCT inv."companyId"), 0) AS "activeCompanies"
            FROM week_series ws
            LEFT JOIN "Invoices" inv
                ON inv."createdAt" >= ws.week_start
               AND inv."createdAt" < ws.week_start + INTERVAL '1 week'
            GROUP BY ws.week_start
            ORDER BY ws.week_start`,
            [weeks], "admin"
        );
        return result.rows;
    }

    // ══════════════════════════════════════════════════════════════════
    // SUMMARY DASHBOARD
    // ══════════════════════════════════════════════════════════════════

    /**
     * Dashboard KPIs — single query to power the top-level admin dashboard.
     */
    public static async getDashboardKpis() {
        const result = await DB.excu.query(
            `SELECT
                -- Total active companies
                (SELECT COUNT(DISTINCT cs."companyId")
                 FROM admin."CompanySubscriptions" cs
                 WHERE cs.status = 'active') AS "activeCompanies",

                -- Total active branches
                (SELECT COUNT(DISTINCT bs."branchId")
                 FROM admin."BranchSubscriptions" bs
                 WHERE bs.status = 'active') AS "activeBranches",

                -- Current MRR
                COALESCE((
                    SELECT SUM(CASE WHEN cs."billingCycle" = 'yearly' THEN cs."basePrice" / 12 ELSE cs."basePrice" END)
                    FROM admin."CompanySubscriptions" cs WHERE cs.status = 'active'
                ), 0) +
                COALESCE((
                    SELECT SUM(CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12 ELSE bs."basePrice" END)
                    FROM admin."BranchSubscriptions" bs WHERE bs.status = 'active'
                ), 0) AS mrr,

                -- Outstanding balance (unpaid invoices)
                COALESCE((
                    SELECT SUM(bi.balance)
                    FROM admin."BillingInvoices" bi
                    WHERE bi.status IN ('issued', 'partially_paid', 'overdue')
                ), 0) AS "outstandingBalance",

                -- Overdue invoices count
                (SELECT COUNT(*)
                 FROM admin."BillingInvoices" bi
                 WHERE bi.status = 'overdue') AS "overdueCount",

                -- Expiring in 30 days
                (SELECT COUNT(*)
                 FROM admin."CompanySubscriptions" cs
                 WHERE cs.status = 'active'
                   AND cs."endDate" <= CURRENT_DATE + 30
                   AND cs."endDate" >= CURRENT_DATE) +
                (SELECT COUNT(*)
                 FROM admin."BranchSubscriptions" bs
                 WHERE bs.status = 'active'
                   AND bs."endDate" <= CURRENT_DATE + 30
                   AND bs."endDate" >= CURRENT_DATE) AS "expiringIn30Days",

                -- New this month (companies)
                (SELECT COUNT(*)
                 FROM "Companies" c
                 WHERE DATE_TRUNC('month', c."createdAt") = DATE_TRUNC('month', CURRENT_DATE)) AS "newCompaniesThisMonth",

                -- New this month (branches)
                (SELECT COUNT(*)
                 FROM "Branches" b
                 WHERE DATE_TRUNC('month', b."createdAt") = DATE_TRUNC('month', CURRENT_DATE)) AS "newBranchesThisMonth"`,
            [], "admin"
        );

        const kpis = result.rows[0];
        return {
            activeCompanies: parseInt(kpis.activeCompanies),
            activeBranches: parseInt(kpis.activeBranches),
            mrr: parseFloat(kpis.mrr),
            arr: parseFloat(kpis.mrr) * 12,
            outstandingBalance: parseFloat(kpis.outstandingBalance),
            overdueCount: parseInt(kpis.overdueCount),
            expiringIn30Days: parseInt(kpis.expiringIn30Days),
            newCompaniesThisMonth: parseInt(kpis.newCompaniesThisMonth),
            newBranchesThisMonth: parseInt(kpis.newBranchesThisMonth),
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // COHORT REPORTS (Excel-style table views)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Cohort profile summary — one row per cohort with all stats.
     * Shown as the "Cohort Profile Summary" table in the Excel report.
     */
    public static async getCohortProfileSummary() {
        const result = await DB.excu.query(
            `WITH cohorts AS (
                SELECT
                    bs."branchId",
                    DATE_TRUNC('month', MIN(bs."startDate")) AS cohort_month,
                    MIN(CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12 ELSE bs."basePrice" END) AS initial_mrr
                FROM admin."BranchSubscriptions" bs
                GROUP BY bs."branchId"
            ),
            latest_state AS (
                SELECT DISTINCT ON (bs."branchId")
                    bs."branchId",
                    bs.status AS current_status,
                    CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12 ELSE bs."basePrice" END AS current_mrr
                FROM admin."BranchSubscriptions" bs
                ORDER BY bs."branchId", bs."createdAt" DESC
            )
            SELECT
                TO_CHAR(c.cohort_month, 'YYYY-MM') AS cohort,
                COUNT(*) AS started,
                COUNT(*) FILTER (WHERE ls.current_status = 'active') AS active,
                COUNT(*) FILTER (WHERE ls.current_status IN ('cancelled', 'expired')) AS churned,
                ROUND(
                    (COUNT(*) FILTER (WHERE ls.current_status IN ('cancelled', 'expired'))::NUMERIC
                     / NULLIF(COUNT(*), 0)) * 100, 1
                ) AS "churnRate",
                ROUND(SUM(c.initial_mrr)::NUMERIC, 2) AS "baseRev",
                ROUND(SUM(CASE WHEN ls.current_status = 'active' THEN ls.current_mrr ELSE 0 END)::NUMERIC, 2) AS "currentRev",
                ROUND(
                    (SUM(CASE WHEN ls.current_status = 'active' THEN ls.current_mrr ELSE 0 END)
                     / NULLIF(SUM(c.initial_mrr), 0)) * 100, 1
                ) AS "revRetention"
            FROM cohorts c
            LEFT JOIN latest_state ls ON ls."branchId" = c."branchId"
            GROUP BY c.cohort_month
            ORDER BY c.cohort_month`,
            [], "admin"
        );
        return result.rows;
    }

    /**
     * Monthly trend — active branches, revenue, new, churned, net change.
     * Shown as the "Monthly Active Branches & Revenue Trend" table.
     */
    public static async getCohortMonthlyTrend(months: number = 24) {
        const result = await DB.excu.query(
            `WITH month_series AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::INTERVAL),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'::INTERVAL
                ) AS month_start
            )
            SELECT
                TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
                -- Active branches at end of month
                (SELECT COUNT(DISTINCT bs."branchId")
                 FROM admin."BranchSubscriptions" bs
                 WHERE bs."startDate" <= ms.month_start + INTERVAL '1 month - 1 day'
                   AND bs."endDate" >= ms.month_start
                   AND bs.status != 'pending') AS "activeBranches",
                -- Monthly revenue from active subscriptions
                COALESCE((
                    SELECT ROUND(SUM(
                        CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12
                             ELSE bs."basePrice"
                        END
                    )::NUMERIC, 2)
                    FROM admin."BranchSubscriptions" bs
                    WHERE bs."startDate" <= ms.month_start + INTERVAL '1 month - 1 day'
                      AND bs."endDate" >= ms.month_start
                      AND bs.status != 'pending'
                ), 0) AS "monthlyRevenue",
                -- New this month: first-ever subscription for a branch
                (SELECT COUNT(*)
                 FROM admin."BranchSubscriptions" bs
                 WHERE bs."startDate" >= ms.month_start
                   AND bs."startDate" < ms.month_start + INTERVAL '1 month'
                   AND NOT EXISTS (
                       SELECT 1 FROM admin."BranchSubscriptions" prev
                       WHERE prev."branchId" = bs."branchId"
                         AND prev."startDate" < bs."startDate"
                   )) AS "newThisMonth",
                -- Churned this month
                (SELECT COUNT(DISTINCT bs."branchId")
                 FROM admin."BranchSubscriptions" bs
                 WHERE bs."endDate" >= ms.month_start
                   AND bs."endDate" < ms.month_start + INTERVAL '1 month'
                   AND bs.status IN ('expired', 'cancelled')
                   AND NOT EXISTS (
                       SELECT 1 FROM admin."BranchSubscriptions" renew
                       WHERE renew."branchId" = bs."branchId"
                         AND renew."startDate" >= bs."endDate"
                         AND renew."startDate" < bs."endDate" + INTERVAL '7 days'
                   )) AS churned
            FROM month_series ms
            ORDER BY ms.month_start`,
            [months], "admin"
        );
        return result.rows.map((r: any, idx: number, arr: any[]) => {
            const prev = idx > 0 ? parseInt(arr[idx - 1].activeBranches) : 0;
            const current = parseInt(r.activeBranches);
            return {
                month: r.month,
                activeBranches: current,
                monthlyRevenue: parseFloat(r.monthlyRevenue),
                newThisMonth: parseInt(r.newThisMonth),
                churned: parseInt(r.churned),
                netChange: current - prev,
            };
        });
    }

    /**
     * Cohort summary KPIs — top-row cards in the Excel summary dashboard.
     */
    public static async getCohortSummaryKpis() {
        const result = await DB.excu.query(
            `WITH cohorts AS (
                SELECT
                    bs."branchId",
                    DATE_TRUNC('month', MIN(bs."startDate")) AS cohort_month
                FROM admin."BranchSubscriptions" bs
                GROUP BY bs."branchId"
            ),
            m1_retention AS (
                SELECT
                    c.cohort_month,
                    COUNT(*) AS cohort_size,
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM admin."BranchSubscriptions" bs2
                        WHERE bs2."branchId" = c."branchId"
                          AND bs2."startDate" <= c.cohort_month + INTERVAL '2 months - 1 day'
                          AND bs2."endDate" >= c.cohort_month + INTERVAL '1 month'
                          AND bs2.status != 'pending'
                    )) AS m1_count
                FROM cohorts c
                WHERE c.cohort_month + INTERVAL '1 month' <= CURRENT_DATE
                GROUP BY c.cohort_month
            ),
            m12_retention AS (
                SELECT
                    c.cohort_month,
                    COUNT(*) AS cohort_size,
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM admin."BranchSubscriptions" bs2
                        WHERE bs2."branchId" = c."branchId"
                          AND bs2."startDate" <= c.cohort_month + INTERVAL '13 months - 1 day'
                          AND bs2."endDate" >= c.cohort_month + INTERVAL '12 months'
                          AND bs2.status != 'pending'
                    )) AS m12_count
                FROM cohorts c
                WHERE c.cohort_month + INTERVAL '12 months' <= CURRENT_DATE
                GROUP BY c.cohort_month
            )
            SELECT
                (SELECT COUNT(DISTINCT cohort_month) FROM cohorts) AS "totalCohorts",
                (SELECT TO_CHAR(MIN(cohort_month), 'Mon YYYY') FROM cohorts) AS "firstCohort",
                (SELECT TO_CHAR(MAX(cohort_month), 'Mon YYYY') FROM cohorts) AS "lastCohort",
                (SELECT COUNT(DISTINCT bs."branchId")
                 FROM admin."BranchSubscriptions" bs
                 WHERE bs.status = 'active') AS "activeBranches",
                ROUND(
                    (SUM(m1.m1_count)::NUMERIC / NULLIF(SUM(m1.cohort_size), 0)) * 100, 1
                ) AS "avgM1Retention",
                ROUND(
                    (SUM(m12.m12_count)::NUMERIC / NULLIF(SUM(m12.cohort_size), 0)) * 100, 1
                ) AS "avg12MoRetention"
            FROM m1_retention m1
            FULL OUTER JOIN m12_retention m12 ON m12.cohort_month = m1.cohort_month`,
            [], "admin"
        );
        const k = result.rows[0] || {};
        return {
            totalCohorts: parseInt(k.totalCohorts || '0'),
            firstCohort: k.firstCohort,
            lastCohort: k.lastCohort,
            activeBranches: parseInt(k.activeBranches || '0'),
            avgM1Retention: parseFloat(k.avgM1Retention || '0'),
            avg12MoRetention: parseFloat(k.avg12MoRetention || '0'),
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // AT-RISK: Expiring subscriptions with autoRenew = false
    // ══════════════════════════════════════════════════════════════════

    /**
     * Paginated list of subscriptions expiring soon AND not set to auto-renew.
     * These are accounts at risk of churning unless action is taken.
     */
    public static async listAtRiskSubscriptions(filters: {
        page?: number;
        pageSize?: number;
        daysAhead?: number;
        subscriptionType?: string;
        search?: string;
        sortBy?: string;
        sortDir?: string;
    }) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(500, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;
        const daysAhead = filters.daysAhead || 60;

        const conditions: string[] = [
            `sub.status = 'active'`,
            `sub."autoRenew" = false`,
            `sub."endDate" <= CURRENT_DATE + $1::int`,
            `sub."endDate" >= CURRENT_DATE`,
        ];
        const params: any[] = [daysAhead];
        let idx = 2;

        if (filters.subscriptionType) {
            conditions.push(`sub."subscriptionType" = $${idx++}`);
            params.push(filters.subscriptionType);
        }
        if (filters.search) {
            conditions.push(`(c.name ILIKE $${idx} OR b.name ILIKE $${idx})`);
            params.push(`%${filters.search}%`);
            idx++;
        }

        const sortBy = ['endDate', 'daysUntilExpiry', 'basePrice', 'mrr', 'companyName', 'branchName']
            .includes(filters.sortBy || '') ? filters.sortBy : 'endDate';
        const sortDir = filters.sortDir === 'desc' ? 'DESC' : 'ASC';
        const sortColumn = sortBy === 'companyName' ? 'c.name'
            : sortBy === 'branchName' ? 'b.name'
            : sortBy === 'daysUntilExpiry' ? 'sub."endDate"'
            : sortBy === 'mrr' ? '"mrr"'
            : `sub."${sortBy}"`;

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const baseQuery = `
            FROM (
                SELECT
                    cs.id,
                    'company'::text AS "subscriptionType",
                    cs."companyId",
                    NULL::uuid AS "branchId",
                    cs."planId",
                    cs.status,
                    cs."billingCycle",
                    cs."startDate",
                    cs."endDate",
                    cs."basePrice",
                    cs.currency,
                    cs."autoRenew",
                    cs."cancelledAt",
                    cs."createdAt"
                FROM admin."CompanySubscriptions" cs
                UNION ALL
                SELECT
                    bs.id,
                    'branch'::text AS "subscriptionType",
                    bs."companyId",
                    bs."branchId",
                    bs."planId",
                    bs.status,
                    bs."billingCycle",
                    bs."startDate",
                    bs."endDate",
                    bs."basePrice",
                    bs.currency,
                    bs."autoRenew",
                    bs."cancelledAt",
                    bs."createdAt"
                FROM admin."BranchSubscriptions" bs
            ) sub
            LEFT JOIN "Companies" c ON c.id = sub."companyId"
            LEFT JOIN "Branches" b ON b.id = sub."branchId"
            LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = sub."planId"
            ${whereClause}
        `;

        const countResult = await DB.excu.query(
            `SELECT
                COUNT(*) AS total,
                COALESCE(SUM(
                    CASE WHEN sub."billingCycle" = 'yearly' THEN sub."basePrice" / 12
                         ELSE sub."basePrice"
                    END
                ), 0) AS "mrrAtRisk",
                COALESCE(SUM(sub."basePrice"), 0) AS "totalRevenueAtRisk"
             ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');
        const mrrAtRisk = parseFloat(countResult.rows[0]?.mrrAtRisk || '0');
        const totalRevenueAtRisk = parseFloat(countResult.rows[0]?.totalRevenueAtRisk || '0');

        const rowsResult = await DB.excu.query(
            `SELECT
                sub.id AS "subscriptionId",
                sub."subscriptionType",
                sub."companyId",
                c.name AS "companyName",
                sub."branchId",
                b.name AS "branchName",
                sp.name AS "planName",
                sub."billingCycle",
                sub."startDate",
                sub."endDate" AS "expiryDate",
                (sub."endDate" - CURRENT_DATE) AS "daysUntilExpiry",
                sub."basePrice",
                sub.currency,
                sub."autoRenew",
                sub."cancelledAt",
                CASE WHEN sub."billingCycle" = 'yearly' THEN sub."basePrice" / 12
                     ELSE sub."basePrice"
                END AS mrr,
                CASE
                    WHEN (sub."endDate" - CURRENT_DATE) <= 7 THEN 'critical'
                    WHEN (sub."endDate" - CURRENT_DATE) <= 30 THEN 'high'
                    ELSE 'medium'
                END AS severity,
                CASE
                    WHEN sub."cancelledAt" IS NOT NULL THEN 'cancelled'
                    ELSE 'not_renewing'
                END AS reason
             ${baseQuery}
             ORDER BY ${sortColumn} ${sortDir}
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, pageSize, offset], "admin"
        );

        return {
            rows: rowsResult.rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
            summary: {
                totalAtRisk: total,
                mrrAtRisk: Math.round(mrrAtRisk * 100) / 100,
                arrAtRisk: Math.round(mrrAtRisk * 12 * 100) / 100,
                totalRevenueAtRisk: Math.round(totalRevenueAtRisk * 100) / 100,
                daysAhead,
            },
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // UNINVOICED SUBSCRIPTIONS (paginated)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Active subscriptions that have no billing invoice covering their current period.
     * This catches:
     * - New subscriptions where no invoice was generated
     * - Auto-renewed subscriptions missing their renewal invoice
     * - Manually-created subscriptions forgotten by billing
     */
    public static async listUninvoicedSubscriptions(filters: {
        page?: number;
        pageSize?: number;
        subscriptionType?: string;
        companyId?: string;
        search?: string;
    }) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(500, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [`sub.status = 'active'`];
        const params: any[] = [];
        let idx = 1;

        if (filters.subscriptionType) {
            conditions.push(`sub."subscriptionType" = $${idx++}`);
            params.push(filters.subscriptionType);
        }
        if (filters.companyId) {
            conditions.push(`sub."companyId" = $${idx++}`);
            params.push(filters.companyId);
        }
        if (filters.search) {
            conditions.push(`(c.name ILIKE $${idx} OR b.name ILIKE $${idx})`);
            params.push(`%${filters.search}%`);
            idx++;
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const baseQuery = `
            FROM (
                SELECT
                    cs.id,
                    'company'::text AS "subscriptionType",
                    cs."companyId",
                    NULL::uuid AS "branchId",
                    cs."planId",
                    cs.status,
                    cs."billingCycle",
                    cs."startDate",
                    cs."endDate",
                    cs."basePrice",
                    cs.currency,
                    cs."autoRenew",
                    cs."createdAt"
                FROM admin."CompanySubscriptions" cs
                UNION ALL
                SELECT
                    bs.id,
                    'branch'::text AS "subscriptionType",
                    bs."companyId",
                    bs."branchId",
                    bs."planId",
                    bs.status,
                    bs."billingCycle",
                    bs."startDate",
                    bs."endDate",
                    bs."basePrice",
                    bs.currency,
                    bs."autoRenew",
                    bs."createdAt"
                FROM admin."BranchSubscriptions" bs
            ) sub
            LEFT JOIN "Companies" c ON c.id = sub."companyId"
            LEFT JOIN "Branches" b ON b.id = sub."branchId"
            LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = sub."planId"
            -- No invoice line references this subscription's current period
            LEFT JOIN LATERAL (
                SELECT bi.id, bi."invoiceNumber", bi.status AS "invoiceStatus", bi."issueDate"
                FROM admin."BillingInvoiceLines" bil
                JOIN admin."BillingInvoices" bi ON bi.id = bil."invoiceId"
                WHERE bil."subscriptionId" = sub.id
                  AND bil."subscriptionType" = sub."subscriptionType"
                  AND bi.status != 'void'
                  AND (
                      (bil."periodStart" <= sub."endDate" AND bil."periodEnd" >= sub."startDate")
                      OR bi."issueDate" BETWEEN sub."startDate" AND sub."endDate"
                  )
                ORDER BY bi."issueDate" DESC
                LIMIT 1
            ) inv ON true
            ${whereClause}
              AND inv.id IS NULL
        `;

        const countResult = await DB.excu.query(
            `SELECT COUNT(*) AS total ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');

        const rowsResult = await DB.excu.query(
            `SELECT
                sub.id AS "subscriptionId",
                sub."subscriptionType",
                sub."companyId",
                c.name AS "companyName",
                sub."branchId",
                b.name AS "branchName",
                sp.name AS "planName",
                sub."billingCycle",
                sub."startDate",
                sub."endDate",
                sub."basePrice",
                sub.currency,
                sub."autoRenew",
                (sub."endDate" - CURRENT_DATE) AS "daysUntilEnd",
                (CURRENT_DATE - sub."startDate") AS "daysSinceStart",
                CASE
                    WHEN CURRENT_DATE > sub."endDate" THEN 'period_ended_no_invoice'
                    WHEN CURRENT_DATE - sub."startDate" > 7 THEN 'overdue_to_invoice'
                    ELSE 'pending_invoice'
                END AS "uninvoicedReason"
             ${baseQuery}
             ORDER BY sub."startDate" ASC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, pageSize, offset], "admin"
        );

        return {
            rows: rowsResult.rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // OVERDUE INVOICES (paginated)
    // ══════════════════════════════════════════════════════════════════

    public static async listOverdueInvoices(filters: {
        page?: number;
        pageSize?: number;
        companyId?: string;
        search?: string;
        minDaysOverdue?: number;
        sortBy?: string;
        sortDir?: string;
    }) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(500, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [
            `bi.status IN ('issued', 'partially_paid', 'overdue')`,
            `bi."dueDate" < CURRENT_DATE`,
        ];
        const params: any[] = [];
        let idx = 1;

        if (filters.companyId) {
            conditions.push(`bi."companyId" = $${idx++}`);
            params.push(filters.companyId);
        }
        if (filters.search) {
            conditions.push(`(c.name ILIKE $${idx} OR bi."invoiceNumber" ILIKE $${idx})`);
            params.push(`%${filters.search}%`);
            idx++;
        }
        if (filters.minDaysOverdue) {
            conditions.push(`(CURRENT_DATE - bi."dueDate") >= $${idx++}`);
            params.push(filters.minDaysOverdue);
        }

        const sortBy = ['dueDate', 'total', 'balance', 'daysOverdue', 'companyName', 'invoiceNumber'].includes(filters.sortBy || '')
            ? filters.sortBy : 'dueDate';
        const sortDir = filters.sortDir === 'desc' ? 'DESC' : 'ASC';
        const sortColumn = sortBy === 'companyName' ? 'c.name'
            : sortBy === 'daysOverdue' ? '(CURRENT_DATE - bi."dueDate")'
            : `bi."${sortBy}"`;

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const baseQuery = `
            FROM admin."BillingInvoices" bi
            JOIN "Companies" c ON c.id = bi."companyId"
            ${whereClause}
        `;

        const countResult = await DB.excu.query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(bi.balance), 0) AS "totalOverdue" ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');
        const totalOverdueAmount = parseFloat(countResult.rows[0]?.totalOverdue || '0');

        const rowsResult = await DB.excu.query(
            `SELECT
                bi.id,
                bi."invoiceNumber",
                bi."companyId",
                c.name AS "companyName",
                bi.status,
                bi."issueDate",
                bi."dueDate",
                (CURRENT_DATE - bi."dueDate") AS "daysOverdue",
                bi.total,
                bi."amountPaid",
                bi.balance,
                bi.currency,
                CASE
                    WHEN (CURRENT_DATE - bi."dueDate") >= 90 THEN 'critical'
                    WHEN (CURRENT_DATE - bi."dueDate") >= 30 THEN 'high'
                    WHEN (CURRENT_DATE - bi."dueDate") >= 7 THEN 'medium'
                    ELSE 'low'
                END AS severity
             ${baseQuery}
             ORDER BY ${sortColumn} ${sortDir}
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, pageSize, offset], "admin"
        );

        // Aging buckets for summary
        const agingResult = await DB.excu.query(
            `SELECT
                COUNT(*) FILTER (WHERE (CURRENT_DATE - bi."dueDate") BETWEEN 1 AND 30) AS "bucket_1_30",
                COUNT(*) FILTER (WHERE (CURRENT_DATE - bi."dueDate") BETWEEN 31 AND 60) AS "bucket_31_60",
                COUNT(*) FILTER (WHERE (CURRENT_DATE - bi."dueDate") BETWEEN 61 AND 90) AS "bucket_61_90",
                COUNT(*) FILTER (WHERE (CURRENT_DATE - bi."dueDate") > 90) AS "bucket_90_plus",
                COALESCE(SUM(bi.balance) FILTER (WHERE (CURRENT_DATE - bi."dueDate") BETWEEN 1 AND 30), 0) AS "amount_1_30",
                COALESCE(SUM(bi.balance) FILTER (WHERE (CURRENT_DATE - bi."dueDate") BETWEEN 31 AND 60), 0) AS "amount_31_60",
                COALESCE(SUM(bi.balance) FILTER (WHERE (CURRENT_DATE - bi."dueDate") BETWEEN 61 AND 90), 0) AS "amount_61_90",
                COALESCE(SUM(bi.balance) FILTER (WHERE (CURRENT_DATE - bi."dueDate") > 90), 0) AS "amount_90_plus"
             ${baseQuery}`,
            params, "admin"
        );
        const aging = agingResult.rows[0];

        return {
            rows: rowsResult.rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
            summary: {
                totalOverdueAmount,
                totalOverdueCount: total,
                aging: {
                    '1-30': { count: parseInt(aging.bucket_1_30), amount: parseFloat(aging.amount_1_30) },
                    '31-60': { count: parseInt(aging.bucket_31_60), amount: parseFloat(aging.amount_31_60) },
                    '61-90': { count: parseInt(aging.bucket_61_90), amount: parseFloat(aging.amount_61_90) },
                    '90+': { count: parseInt(aging.bucket_90_plus), amount: parseFloat(aging.amount_90_plus) },
                },
            },
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // INACTIVE / LOW ACTIVITY ACCOUNTS (paginated)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Paginated list of inactive / low-activity accounts.
     * health filter: 'inactive' | 'low_activity' | 'no_subscription' | 'all_unhealthy'
     */
    public static async listInactiveAccounts(filters: {
        page?: number;
        pageSize?: number;
        health?: string;
        search?: string;
        sortBy?: string;
        sortDir?: string;
    }) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(500, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;
        const health = filters.health || 'all_unhealthy';
        const search = filters.search;

        const sortBy = ['companyName', 'signupDate', 'health', 'lastInvoiceDate', 'daysSinceLastActivity'].includes(filters.sortBy || '')
            ? filters.sortBy : 'companyName';
        const sortDir = filters.sortDir === 'desc' ? 'DESC' : 'ASC';

        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        // Health filter
        if (health === 'inactive') {
            conditions.push(`(last_inv."lastInvoiceDate" < CURRENT_DATE - INTERVAL '90 days' OR last_inv."lastInvoiceDate" IS NULL)`);
            conditions.push(`cs.id IS NOT NULL`);
        } else if (health === 'low_activity') {
            conditions.push(`last_inv."lastInvoiceDate" >= CURRENT_DATE - INTERVAL '90 days'`);
            conditions.push(`last_inv."lastInvoiceDate" < CURRENT_DATE - INTERVAL '30 days'`);
            conditions.push(`cs.id IS NOT NULL`);
        } else if (health === 'no_subscription') {
            conditions.push(`cs.id IS NULL`);
        } else if (health === 'all_unhealthy') {
            conditions.push(`(
                cs.id IS NULL
                OR last_inv."lastInvoiceDate" IS NULL
                OR last_inv."lastInvoiceDate" < CURRENT_DATE - INTERVAL '30 days'
            )`);
        }

        if (search) {
            conditions.push(`c.name ILIKE $${idx++}`);
            params.push(`%${search}%`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const baseQuery = `
            FROM "Companies" c
            LEFT JOIN admin."CompanySubscriptions" cs
                ON cs."companyId" = c.id AND cs.status = 'active'
            LEFT JOIN (
                SELECT
                    inv."companyId",
                    MAX(inv."createdAt") AS "lastInvoiceDate",
                    COUNT(*) FILTER (WHERE inv."createdAt" >= CURRENT_DATE - INTERVAL '30 days') AS "invoiceCount30d",
                    COUNT(*) FILTER (WHERE inv."createdAt" >= CURRENT_DATE - INTERVAL '90 days') AS "invoiceCount90d"
                FROM "Invoices" inv
                GROUP BY inv."companyId"
            ) last_inv ON last_inv."companyId" = c.id
            LEFT JOIN (
                SELECT b."companyId", COUNT(*) AS "branchCount"
                FROM "Branches" b
                GROUP BY b."companyId"
            ) branch_count ON branch_count."companyId" = c.id
            LEFT JOIN (
                SELECT bs."companyId", COUNT(DISTINCT bs."branchId") AS "activeBranchCount"
                FROM admin."BranchSubscriptions" bs
                WHERE bs.status = 'active'
                GROUP BY bs."companyId"
            ) active_branch_count ON active_branch_count."companyId" = c.id
            ${whereClause}
        `;

        const countResult = await DB.excu.query(
            `SELECT COUNT(*) AS total ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');

        const rowsResult = await DB.excu.query(
            `SELECT
                c.id AS "companyId",
                c.name AS "companyName",
                c."createdAt" AS "signupDate",
                CASE
                    WHEN cs.id IS NULL THEN 'no_subscription'
                    WHEN last_inv."lastInvoiceDate" IS NULL THEN 'inactive'
                    WHEN last_inv."lastInvoiceDate" < CURRENT_DATE - INTERVAL '90 days' THEN 'inactive'
                    WHEN last_inv."lastInvoiceDate" < CURRENT_DATE - INTERVAL '30 days' THEN 'low_activity'
                    ELSE 'active'
                END AS health,
                cs.status AS "subscriptionStatus",
                cs."endDate" AS "subscriptionEndDate",
                cs."basePrice",
                cs."billingCycle",
                last_inv."lastInvoiceDate",
                last_inv."invoiceCount30d",
                last_inv."invoiceCount90d",
                (CURRENT_DATE - last_inv."lastInvoiceDate"::DATE) AS "daysSinceLastActivity",
                branch_count."branchCount",
                active_branch_count."activeBranchCount"
             ${baseQuery}
             ORDER BY "${sortBy}" ${sortDir} NULLS LAST
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, pageSize, offset], "admin"
        );

        return {
            rows: rowsResult.rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }
}
