import { DB } from "@src/dbconnection/dbconnection";
import { PoolClient } from "pg";
import { ResponseData } from "@src/models/ResponseData";

export class SubscriptionRepo {

    // ══════════════════════════════════════════════════════════════════
    // FEATURES CATALOG
    // ══════════════════════════════════════════════════════════════════

    public static async getFeatures(scope?: string) {
        const query = scope
            ? { text: `SELECT * FROM admin."SubscriptionFeatures" WHERE "isActive" = true AND scope = $1 ORDER BY scope, name`, values: [scope] }
            : { text: `SELECT * FROM admin."SubscriptionFeatures" WHERE "isActive" = true ORDER BY scope, name`, values: [] as any[] };
        const result = await DB.excu.query(query.text, query.values, "admin");
        return result.rows;
    }

    public static async getFeatureById(id: string) {
        const result = await DB.excu.query(
            `SELECT * FROM admin."SubscriptionFeatures" WHERE id = $1`, [id], "admin"
        );
        return result.rows[0] || null;
    }

    public static async saveFeature(client: PoolClient, data: any) {
        if (data.id) {
            const result = await client.query(
                `UPDATE admin."SubscriptionFeatures" SET name = $1, slug = $2, scope = $3, "featureType" = $4,
                 description = $5, "isActive" = $6, "updatedAt" = NOW()
                 WHERE id = $7 RETURNING *`,
                [data.name, data.slug, data.scope, data.featureType, data.description, data.isActive, data.id]
            );
            return new ResponseData(true, "", result.rows[0]);
        }
        const result = await client.query(
            `INSERT INTO admin."SubscriptionFeatures" (name, slug, scope, "featureType", description)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [data.name, data.slug, data.scope, data.featureType, data.description]
        );
        return new ResponseData(true, "", result.rows[0]);
    }

    // ══════════════════════════════════════════════════════════════════
    // PLANS
    // ══════════════════════════════════════════════════════════════════

    public static async getPlans(scope?: string) {
        const query = scope
            ? { text: `SELECT * FROM admin."SubscriptionPlans" WHERE "isActive" = true AND scope = $1 ORDER BY "basePrice"`, values: [scope] }
            : { text: `SELECT * FROM admin."SubscriptionPlans" WHERE "isActive" = true ORDER BY scope, "basePrice"`, values: [] as any[] };
        const result = await DB.excu.query(query.text, query.values, "admin");
        return result.rows;
    }

    public static async getPlanById(id: string) {
        const plan = await DB.excu.query(
            `SELECT * FROM admin."SubscriptionPlans" WHERE id = $1`, [id], "admin"
        );
        if (!plan.rows[0]) return null;

        const features = await DB.excu.query(
            `SELECT pf.*, sf.name AS "featureName", sf.slug AS "featureSlug", sf.scope, sf."featureType"
             FROM admin."PlanFeatures" pf
             JOIN admin."SubscriptionFeatures" sf ON sf.id = pf."featureId"
             WHERE pf."planId" = $1`, [id], "admin"
        );
        return { ...plan.rows[0], features: features.rows };
    }

    public static async savePlan(client: PoolClient, data: any) {
        // ── Validate feature scopes match the plan scope ──
        if (data.features && data.features.length > 0) {
            const featureIds = data.features.map((f: any) => f.featureId);
            const featuresResult = await client.query(
                `SELECT id, name, scope FROM admin."SubscriptionFeatures" WHERE id = ANY($1)`,
                [featureIds]
            );

            // Check all requested features exist
            if (featuresResult.rows.length !== new Set(featureIds).size) {
                const found = new Set(featuresResult.rows.map((r: any) => r.id));
                const missing = featureIds.filter((id: string) => !found.has(id));
                throw new Error(`Feature(s) not found: ${missing.join(', ')}`);
            }

            // Check all feature scopes match the plan scope
            const mismatched = featuresResult.rows.filter((f: any) => f.scope !== data.scope);
            if (mismatched.length > 0) {
                const names = mismatched.map((f: any) => `${f.name} (${f.scope})`).join(', ');
                throw new Error(
                    `Cannot add features with mismatched scope to a '${data.scope}' plan: ${names}`
                );
            }
        }

        let planId: string;

        if (data.id) {
            await client.query(
                `UPDATE admin."SubscriptionPlans" SET name = $1, slug = $2, scope = $3, "billingCycle" = $4,
                 "basePrice" = $5, currency = $6, description = $7, "isActive" = $8, "updatedAt" = NOW()
                 WHERE id = $9`,
                [data.name, data.slug, data.scope, data.billingCycle, data.basePrice, data.currency, data.description, data.isActive, data.id]
            );
            planId = data.id;
            // Clear existing features and re-insert
            await client.query(`DELETE FROM admin."PlanFeatures" WHERE "planId" = $1`, [planId]);
        } else {
            const result = await client.query(
                `INSERT INTO admin."SubscriptionPlans" (name, slug, scope, "billingCycle", "basePrice", currency, description)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [data.name, data.slug, data.scope, data.billingCycle, data.basePrice, data.currency, data.description]
            );
            planId = result.rows[0].id;
        }

        // Insert plan features
        if (data.features && data.features.length > 0) {
            for (const f of data.features) {
                await client.query(
                    `INSERT INTO admin."PlanFeatures" ("planId", "featureId", quantity, "unitPrice")
                     VALUES ($1, $2, $3, $4)`,
                    [planId, f.featureId, f.quantity || 1, f.unitPrice || 0]
                );
            }
        }

        return new ResponseData(true, "", { id: planId });
    }

    // ══════════════════════════════════════════════════════════════════
    // FEATURE PRICING
    // ══════════════════════════════════════════════════════════════════

    public static async getFeaturePricing(featureId?: string) {
        const query = featureId
            ? { text: `SELECT fp.*, sf.name AS "featureName", sf.slug AS "featureSlug" FROM admin."FeaturePricing" fp JOIN admin."SubscriptionFeatures" sf ON sf.id = fp."featureId" WHERE fp."featureId" = $1 AND fp."isActive" = true`, values: [featureId] }
            : { text: `SELECT fp.*, sf.name AS "featureName", sf.slug AS "featureSlug" FROM admin."FeaturePricing" fp JOIN admin."SubscriptionFeatures" sf ON sf.id = fp."featureId" WHERE fp."isActive" = true ORDER BY sf.name`, values: [] as any[] };
        const result = await DB.excu.query(query.text, query.values, "admin");
        return result.rows;
    }

    public static async saveFeaturePricing(client: PoolClient, data: any) {
        if (data.id) {
            const result = await client.query(
                `UPDATE admin."FeaturePricing" SET "featureId" = $1, "billingCycle" = $2, "unitPrice" = $3,
                 currency = $4, "isActive" = $5 WHERE id = $6 RETURNING *`,
                [data.featureId, data.billingCycle, data.unitPrice, data.currency, data.isActive, data.id]
            );
            return new ResponseData(true, "", result.rows[0]);
        }
        const result = await client.query(
            `INSERT INTO admin."FeaturePricing" ("featureId", "billingCycle", "unitPrice", currency)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [data.featureId, data.billingCycle, data.unitPrice, data.currency]
        );
        return new ResponseData(true, "", result.rows[0]);
    }

    // ══════════════════════════════════════════════════════════════════
    // COMPANY SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════════════════

    public static async getCompanySubscription(companyId: string) {
        const sub = await DB.excu.query(
            `SELECT cs.*, sp.name AS "planName"
             FROM admin."CompanySubscriptions" cs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = cs."planId"
             WHERE cs."companyId" = $1 AND cs.status = 'active'
             ORDER BY cs."createdAt" DESC LIMIT 1`,
            [companyId], "admin"
        );
        if (!sub.rows[0]) return null;

        const items = await DB.excu.query(
            `SELECT si.*, sf.name AS "featureName", sf.slug AS "featureSlug", sf.scope AS "featureScope", sf."featureType"
             FROM admin."SubscriptionItems" si
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE si."subscriptionId" = $1 AND si."subscriptionType" = 'company' AND si."isActive" = true`,
            [sub.rows[0].id], "admin"
        );
        return { ...sub.rows[0], items: items.rows };
    }

    public static async getCompanySubscriptionHistory(companyId: string) {
        const result = await DB.excu.query(
            `SELECT cs.*, sp.name AS "planName"
             FROM admin."CompanySubscriptions" cs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = cs."planId"
             WHERE cs."companyId" = $1
             ORDER BY cs."createdAt" DESC`,
            [companyId], "admin"
        );
        return result.rows;
    }

    /**
     * Validate that a plan's scope matches the target subscription type.
     */
    private static async assertPlanScope(
        client: PoolClient,
        planId: string,
        expectedScope: "company" | "branch"
    ) {
        const plan = await client.query(
            `SELECT id, name, scope FROM admin."SubscriptionPlans" WHERE id = $1`,
            [planId]
        );
        if (!plan.rows[0]) throw new Error(`Plan ${planId} not found`);
        if (plan.rows[0].scope !== expectedScope) {
            throw new Error(
                `Plan '${plan.rows[0].name}' has scope '${plan.rows[0].scope}' ` +
                `and cannot be assigned to a ${expectedScope} subscription`
            );
        }
    }

    public static async createCompanySubscription(client: PoolClient, data: any) {
        // Validate plan scope
        if (data.planId) {
            await this.assertPlanScope(client, data.planId, 'company');
        }

        // Note: existing active subscriptions are NOT auto-expired.
        // A company can have multiple subscriptions covering different periods.
        // Use cancelCompanySubscription to manually end one if needed.

        const result = await client.query(
            `INSERT INTO admin."CompanySubscriptions"
             ("companyId", "planId", status, "billingCycle", "startDate", "endDate", "renewalDate", "autoRenew", "basePrice", currency, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [data.companyId, data.planId, data.status || 'active', data.billingCycle,
            data.startDate, data.endDate, data.renewalDate, data.autoRenew ?? true,
            data.basePrice, data.currency || 'BHD', data.notes]
        );
        const subscriptionId = result.rows[0].id;

        // If based on a plan, copy plan features as subscription items
        if (data.planId) {
            await client.query(
                `INSERT INTO admin."SubscriptionItems" ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate")
                 SELECT $1, 'company', "featureId", quantity, "unitPrice", $2, $3
                 FROM admin."PlanFeatures" WHERE "planId" = $4`,
                [subscriptionId, data.startDate, data.endDate, data.planId]
            );
        }

        // Insert any custom/override items
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                await this.assertNoDuplicateFeature(client, subscriptionId, 'company', item.featureId);
                await client.query(
                    `INSERT INTO admin."SubscriptionItems" ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate")
                     VALUES ($1, 'company', $2, $3, $4, $5, $6)`,
                    [subscriptionId, item.featureId, item.quantity || 1, item.unitPrice || 0, data.startDate, data.endDate]
                );
            }
        }

        return new ResponseData(true, "", result.rows[0]);
    }

    public static async cancelCompanySubscription(client: PoolClient, data: {
        companyId: string;
        reason?: string;
        cancelImmediately?: boolean;
        performedBy?: string;
    }) {
        const sub = await client.query(
            `SELECT * FROM admin."CompanySubscriptions" WHERE "companyId" = $1 AND status = 'active' ORDER BY "createdAt" DESC LIMIT 1`,
            [data.companyId]
        );
        if (!sub.rows[0]) throw new Error("No active company subscription found");

        const subscription = sub.rows[0];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        let creditAmount = 0;
        let creditInvoiceId: string | null = null;
        const voidedInvoices: string[] = [];

        if (data.cancelImmediately) {
            // Find invoices linked to this subscription
            const invoices = await client.query(
                `SELECT DISTINCT bi.id, bi."invoiceNumber", bi.status, bi.total, bi."amountPaid", bi.balance
                 FROM admin."BillingInvoices" bi
                 JOIN admin."BillingInvoiceLines" bil ON bil."invoiceId" = bi.id
                 WHERE bil."subscriptionId" = $1 AND bil."subscriptionType" = 'company'
                   AND bi.status NOT IN ('void', 'refunded')
                 ORDER BY bi."invoiceNumber"`,
                [subscription.id]
            );

            // Separate paid/partially_paid from unpaid invoices
            const paidInvoices = invoices.rows.filter((inv: any) => inv.status === 'paid' || inv.status === 'partially_paid');
            const unpaidInvoices = invoices.rows.filter((inv: any) => inv.status === 'draft' || inv.status === 'issued' || inv.status === 'overdue');

            // Void unpaid invoices — no money was collected, just delete them
            for (const inv of unpaidInvoices) {
                await client.query(
                    `UPDATE admin."BillingInvoices" SET status = 'void', "voidedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
                    [inv.id]
                );
                voidedInvoices.push(inv.invoiceNumber);
            }

            // Only create credit note if money was actually paid
            if (paidInvoices.length > 0) {
                const startDate = new Date(subscription.startDate);
                const endDate = new Date(subscription.endDate);
                const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
                const usedDays = Math.round((today.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
                const remainingDays = Math.max(0, totalDays - usedDays);

                if (totalDays > 0 && remainingDays > 0) {
                    const items = await client.query(
                        `SELECT si.*, sf.name AS "featureName"
                         FROM admin."SubscriptionItems" si
                         JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
                         WHERE si."subscriptionId" = $1 AND si."subscriptionType" = 'company' AND si."isActive" = true`,
                        [subscription.id]
                    );

                    const prorationFactor = remainingDays / totalDays;
                    creditAmount += parseFloat(subscription.basePrice) * prorationFactor;
                    for (const item of items.rows) {
                        creditAmount += parseFloat(item.unitPrice) * item.quantity * prorationFactor;
                    }
                    creditAmount = Math.round(creditAmount * 100) / 100;

                    if (creditAmount > 0) {
                        const invNum = await this.generateInvoiceNumber();
                        const creditInv = await client.query(
                            `INSERT INTO admin."BillingInvoices"
                             ("invoiceNumber", "companyId", status, "issueDate", "dueDate", "periodStart", "periodEnd",
                              subtotal, "discountTotal", "taxTotal", total, "amountPaid", balance, currency, notes)
                             VALUES ($1, $2, 'issued', $3, $3, $4, $5, $6, 0, 0, $6, 0, $6, $7, $8)
                             RETURNING *`,
                            [invNum, data.companyId, todayStr, todayStr, subscription.endDate,
                             -creditAmount, subscription.currency || 'BHD',
                             `Credit for early cancellation — ${remainingDays}/${totalDays} days remaining`]
                        );
                        creditInvoiceId = creditInv.rows[0].id;

                        const baseCredit = Math.round(parseFloat(subscription.basePrice) * prorationFactor * 100) / 100;
                        if (baseCredit > 0) {
                            await client.query(
                                `INSERT INTO admin."BillingInvoiceLines"
                                 ("invoiceId", "subscriptionId", "subscriptionType", "lineType", description,
                                  quantity, "unitPrice", amount, "discountAmount", "taxRate", "taxAmount", total,
                                  "periodStart", "periodEnd")
                                 VALUES ($1, $2, 'company', 'credit', $3, 1, $4, $4, 0, 0, 0, $4, $5, $6)`,
                                [creditInvoiceId, subscription.id,
                                 `Credit — company subscription (${remainingDays} days remaining)`,
                                 -baseCredit, todayStr, subscription.endDate]
                            );
                        }

                        for (const item of items.rows) {
                            const itemCredit = Math.round(parseFloat(item.unitPrice) * item.quantity * prorationFactor * 100) / 100;
                            if (itemCredit > 0) {
                                await client.query(
                                    `INSERT INTO admin."BillingInvoiceLines"
                                     ("invoiceId", "subscriptionId", "subscriptionType", "featureId", "lineType", description,
                                      quantity, "unitPrice", amount, "discountAmount", "taxRate", "taxAmount", total,
                                      "periodStart", "periodEnd")
                                     VALUES ($1, $2, 'company', $3, 'credit', $4, $5, $6, $7, 0, 0, 0, $7, $8, $9)`,
                                    [creditInvoiceId, subscription.id, item.featureId,
                                     `Credit — ${item.featureName}${item.quantity > 1 ? ' x' + item.quantity : ''} (${remainingDays} days)`,
                                     item.quantity, -parseFloat(item.unitPrice) * prorationFactor,
                                     -itemCredit, todayStr, subscription.endDate]
                                );
                            }
                        }
                    }
                }
            }

            // Cancel subscription and deactivate items
            await client.query(
                `UPDATE admin."CompanySubscriptions" SET status = 'cancelled', "cancelledAt" = NOW(), "endDate" = CURRENT_DATE, "autoRenew" = false, "updatedAt" = NOW()
                 WHERE id = $1`,
                [subscription.id]
            );
            await client.query(
                `UPDATE admin."SubscriptionItems" SET "isActive" = false, "endDate" = CURRENT_DATE, "updatedAt" = NOW()
                 WHERE "subscriptionId" = $1 AND "subscriptionType" = 'company' AND "isActive" = true`,
                [subscription.id]
            );
        } else {
            // Cancel at end of period — no refund, subscription stays active until endDate
            await client.query(
                `UPDATE admin."CompanySubscriptions" SET "cancelledAt" = NOW(), "autoRenew" = false, "updatedAt" = NOW()
                 WHERE id = $1`,
                [subscription.id]
            );
        }

        // Log the change
        const notes = data.reason || (data.cancelImmediately
            ? `Immediate cancellation.${creditAmount > 0 ? ' Credit: ' + creditAmount : ''}${voidedInvoices.length > 0 ? ' Voided: ' + voidedInvoices.join(', ') : ''}`
            : 'Cancelled — active until end of period');

        await client.query(
            `INSERT INTO admin."SubscriptionChanges" ("subscriptionId", "subscriptionType", "changeType", "effectiveDate", "proratedAmount", "billingInvoiceId", "performedBy", notes)
             VALUES ($1, 'company', 'cancellation', $2, $3, $4, $5, $6)`,
            [subscription.id,
             data.cancelImmediately ? todayStr : subscription.endDate,
             creditAmount > 0 ? -creditAmount : null,
             creditInvoiceId,
             data.performedBy || null,
             notes]
        );

        return new ResponseData(true, "", {
            subscriptionId: subscription.id,
            cancelledImmediately: !!data.cancelImmediately,
            effectiveEndDate: data.cancelImmediately ? todayStr : subscription.endDate,
            creditAmount,
            creditInvoiceId,
            voidedInvoices,
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // BRANCH SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════════════════

    public static async getBranchSubscriptionHistory(branchId: string) {
        const result = await DB.excu.query(
            `SELECT bs.*, sp.name AS "planName", b.name AS "branchName"
             FROM admin."BranchSubscriptions" bs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = bs."planId"
             JOIN "Branches" b ON b.id = bs."branchId"
             WHERE bs."branchId" = $1
             ORDER BY bs."createdAt" DESC`,
            [branchId], "admin"
        );
        return result.rows;
    }

    public static async getBranchSubscription(branchId: string) {
        const sub = await DB.excu.query(
            `SELECT bs.*, sp.name AS "planName"
             FROM admin."BranchSubscriptions" bs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = bs."planId"
             WHERE bs."branchId" = $1 AND bs.status = 'active'
             ORDER BY bs."createdAt" DESC LIMIT 1`,
            [branchId], "admin"
        );
        if (!sub.rows[0]) return null;

        const items = await DB.excu.query(
            `SELECT si.*, sf.name AS "featureName", sf.slug AS "featureSlug", sf.scope AS "featureScope", sf."featureType"
             FROM admin."SubscriptionItems" si
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE si."subscriptionId" = $1 AND si."subscriptionType" = 'branch' AND si."isActive" = true`,
            [sub.rows[0].id], "admin"
        );
        return { ...sub.rows[0], items: items.rows };
    }

    /**
     * Returns one row per branch belonging to a company, including the
     * most relevant subscription for that branch:
     *  - Active subscription covering today (if any)
     *  - Otherwise the most recently created subscription
     *  - Branch is included even if it has no subscription at all
     */
    public static async getBranchSubscriptionsByCompany(companyId: string) {
        const result = await DB.excu.query(
            `SELECT
                b.id AS "branchId",
                b.name AS "branchName",
                bs.id AS "subscriptionId",
                bs.status,
                bs."billingCycle",
                bs."startDate",
                bs."endDate",
                bs."renewalDate",
                bs."autoRenew",
                bs."basePrice",
                bs.currency,
                bs."cancelledAt",
                bs."createdAt",
                bs."planId",
                sp.name AS "planName",
                CASE
                    WHEN bs.id IS NULL THEN 'no_subscription'
                    WHEN bs.status = 'active' AND bs."endDate" >= CURRENT_DATE AND bs."startDate" <= CURRENT_DATE THEN 'current'
                    WHEN bs.status = 'active' AND bs."startDate" > CURRENT_DATE THEN 'future'
                    WHEN bs.status = 'active' AND bs."endDate" < CURRENT_DATE THEN 'expired_pending'
                    ELSE bs.status
                END AS "displayStatus"
             FROM "Branches" b
             LEFT JOIN LATERAL (
                SELECT *
                FROM admin."BranchSubscriptions" bs2
                WHERE bs2."branchId" = b.id
                ORDER BY
                    -- Prefer active subscription covering today
                    CASE WHEN bs2.status = 'active'
                              AND bs2."startDate" <= CURRENT_DATE
                              AND bs2."endDate" >= CURRENT_DATE THEN 0
                         WHEN bs2.status = 'active' THEN 1
                         ELSE 2
                    END,
                    bs2."createdAt" DESC
                LIMIT 1
             ) bs ON true
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = bs."planId"
             WHERE b."companyId" = $1
             ORDER BY b.name`,
            [companyId], "admin"
        );
        return result.rows;
    }

    public static async createBranchSubscription(client: PoolClient, data: any) {
        // Validate plan scope
        if (data.planId) {
            await this.assertPlanScope(client, data.planId, 'branch');
        }

        // Note: existing active subscriptions are NOT auto-expired.
        // A branch can have multiple subscriptions covering different periods.
        // Use cancelBranchSubscription to manually end one if needed.

        const result = await client.query(
            `INSERT INTO admin."BranchSubscriptions"
             ("branchId", "companyId", "planId", status, "billingCycle", "startDate", "endDate", "renewalDate", "autoRenew", "basePrice", currency, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [data.branchId, data.companyId, data.planId, data.status || 'active', data.billingCycle,
            data.startDate, data.endDate, data.renewalDate, data.autoRenew ?? true,
            data.basePrice, data.currency || 'BHD', data.notes]
        );
        const subscriptionId = result.rows[0].id;

        // If based on a plan, copy plan features
        if (data.planId) {
            await client.query(
                `INSERT INTO admin."SubscriptionItems" ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate")
                 SELECT $1, 'branch', "featureId", quantity, "unitPrice", $2, $3
                 FROM admin."PlanFeatures" WHERE "planId" = $4`,
                [subscriptionId, data.startDate, data.endDate, data.planId]
            );
        }

        // Insert any custom items
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                await this.assertNoDuplicateFeature(client, subscriptionId, 'branch', item.featureId);
                await client.query(
                    `INSERT INTO admin."SubscriptionItems" ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate")
                     VALUES ($1, 'branch', $2, $3, $4, $5, $6)`,
                    [subscriptionId, item.featureId, item.quantity || 1, item.unitPrice || 0, data.startDate, data.endDate]
                );
            }
        }

        return new ResponseData(true, "", result.rows[0]);
    }

    public static async cancelBranchSubscription(client: PoolClient, data: {
        companyId: string;
        branchId: string;
        reason?: string;
        cancelImmediately?: boolean;
        performedBy?: string;
    }) {
        const sub = await client.query(
            `SELECT bs.*, c."companyId" AS "resolvedCompanyId"
             FROM admin."BranchSubscriptions" bs
             LEFT JOIN "Branches" c ON c.id = bs."branchId"
             WHERE bs."branchId" = $1 AND bs.status = 'active'
             ORDER BY bs."createdAt" DESC LIMIT 1`,
            [data.branchId]
        );
        if (!sub.rows[0]) throw new Error("No active branch subscription found");

        const subscription = sub.rows[0];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        let creditAmount = 0;
        let creditInvoiceId: string | null = null;
        const voidedInvoices: string[] = [];

        if (data.cancelImmediately) {
            // Find invoices linked to this branch subscription
            const invoices = await client.query(
                `SELECT DISTINCT bi.id, bi."invoiceNumber", bi.status, bi.total, bi."amountPaid", bi.balance
                 FROM admin."BillingInvoices" bi
                 JOIN admin."BillingInvoiceLines" bil ON bil."invoiceId" = bi.id
                 WHERE bil."subscriptionId" = $1 AND bil."subscriptionType" = 'branch'
                   AND bi.status NOT IN ('void', 'refunded')
                 ORDER BY bi."invoiceNumber"`,
                [subscription.id]
            );

            const paidInvoices = invoices.rows.filter((inv: any) => inv.status === 'paid' || inv.status === 'partially_paid');
            const unpaidInvoices = invoices.rows.filter((inv: any) => inv.status === 'draft' || inv.status === 'issued' || inv.status === 'overdue');

            // Void unpaid invoices
            for (const inv of unpaidInvoices) {
                await client.query(
                    `UPDATE admin."BillingInvoices" SET status = 'void', "voidedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
                    [inv.id]
                );
                voidedInvoices.push(inv.invoiceNumber);
            }

            // Only create credit note if money was actually paid
            if (paidInvoices.length > 0) {
                const startDate = new Date(subscription.startDate);
                const endDate = new Date(subscription.endDate);
                const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
                const usedDays = Math.round((today.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
                const remainingDays = Math.max(0, totalDays - usedDays);

                if (totalDays > 0 && remainingDays > 0) {
                    const items = await client.query(
                        `SELECT si.*, sf.name AS "featureName"
                         FROM admin."SubscriptionItems" si
                         JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
                         WHERE si."subscriptionId" = $1 AND si."subscriptionType" = 'branch' AND si."isActive" = true`,
                        [subscription.id]
                    );

                    const prorationFactor = remainingDays / totalDays;
                    creditAmount += parseFloat(subscription.basePrice) * prorationFactor;
                    for (const item of items.rows) {
                        creditAmount += parseFloat(item.unitPrice) * item.quantity * prorationFactor;
                    }
                    creditAmount = Math.round(creditAmount * 100) / 100;

                    if (creditAmount > 0) {
                        const invNum = await this.generateInvoiceNumber();
                        const creditInv = await client.query(
                            `INSERT INTO admin."BillingInvoices"
                             ("invoiceNumber", "companyId", status, "issueDate", "dueDate", "periodStart", "periodEnd",
                              subtotal, "discountTotal", "taxTotal", total, "amountPaid", balance, currency, notes)
                             VALUES ($1, $2, 'issued', $3, $3, $4, $5, $6, 0, 0, $6, 0, $6, $7, $8)
                             RETURNING *`,
                            [invNum, subscription.companyId, todayStr, todayStr, subscription.endDate,
                             -creditAmount, subscription.currency || 'BHD',
                             `Credit for branch early cancellation — ${remainingDays}/${totalDays} days remaining`]
                        );
                        creditInvoiceId = creditInv.rows[0].id;

                        const baseCredit = Math.round(parseFloat(subscription.basePrice) * prorationFactor * 100) / 100;
                        if (baseCredit > 0) {
                            await client.query(
                                `INSERT INTO admin."BillingInvoiceLines"
                                 ("invoiceId", "subscriptionId", "subscriptionType", "lineType", description,
                                  quantity, "unitPrice", amount, "discountAmount", "taxRate", "taxAmount", total,
                                  "periodStart", "periodEnd")
                                 VALUES ($1, $2, 'branch', 'credit', $3, 1, $4, $4, 0, 0, 0, $4, $5, $6)`,
                                [creditInvoiceId, subscription.id,
                                 `Credit — branch subscription (${remainingDays} days remaining)`,
                                 -baseCredit, todayStr, subscription.endDate]
                            );
                        }

                        for (const item of items.rows) {
                            const itemCredit = Math.round(parseFloat(item.unitPrice) * item.quantity * prorationFactor * 100) / 100;
                            if (itemCredit > 0) {
                                await client.query(
                                    `INSERT INTO admin."BillingInvoiceLines"
                                     ("invoiceId", "subscriptionId", "subscriptionType", "featureId", "lineType", description,
                                      quantity, "unitPrice", amount, "discountAmount", "taxRate", "taxAmount", total,
                                      "periodStart", "periodEnd")
                                     VALUES ($1, $2, 'branch', $3, 'credit', $4, $5, $6, $7, 0, 0, 0, $7, $8, $9)`,
                                    [creditInvoiceId, subscription.id, item.featureId,
                                     `Credit — ${item.featureName}${item.quantity > 1 ? ' x' + item.quantity : ''} (${remainingDays} days)`,
                                     item.quantity, -parseFloat(item.unitPrice) * prorationFactor,
                                     -itemCredit, todayStr, subscription.endDate]
                                );
                            }
                        }
                    }
                }
            }

            await client.query(
                `UPDATE admin."BranchSubscriptions" SET status = 'cancelled', "cancelledAt" = NOW(), "endDate" = CURRENT_DATE, "autoRenew" = false, "updatedAt" = NOW()
                 WHERE id = $1`,
                [subscription.id]
            );
            await client.query(
                `UPDATE admin."SubscriptionItems" SET "isActive" = false, "endDate" = CURRENT_DATE, "updatedAt" = NOW()
                 WHERE "subscriptionId" = $1 AND "subscriptionType" = 'branch' AND "isActive" = true`,
                [subscription.id]
            );
        } else {
            await client.query(
                `UPDATE admin."BranchSubscriptions" SET "cancelledAt" = NOW(), "autoRenew" = false, "updatedAt" = NOW()
                 WHERE id = $1`,
                [subscription.id]
            );
        }

        const notes = data.reason || (data.cancelImmediately
            ? `Immediate cancellation.${creditAmount > 0 ? ' Credit: ' + creditAmount : ''}${voidedInvoices.length > 0 ? ' Voided: ' + voidedInvoices.join(', ') : ''}`
            : 'Cancelled — active until end of period');

        await client.query(
            `INSERT INTO admin."SubscriptionChanges" ("subscriptionId", "subscriptionType", "changeType", "effectiveDate", "proratedAmount", "billingInvoiceId", "performedBy", notes)
             VALUES ($1, 'branch', 'cancellation', $2, $3, $4, $5, $6)`,
            [subscription.id,
             data.cancelImmediately ? todayStr : subscription.endDate,
             creditAmount > 0 ? -creditAmount : null,
             creditInvoiceId,
             data.performedBy || null,
             notes]
        );

        return new ResponseData(true, "", {
            subscriptionId: subscription.id,
            cancelledImmediately: !!data.cancelImmediately,
            effectiveEndDate: data.cancelImmediately ? todayStr : subscription.endDate,
            creditAmount,
            creditInvoiceId,
            voidedInvoices,
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // BULK IMPORT — historical subscriptions
    // ══════════════════════════════════════════════════════════════════

    /**
     * Bulk import historical subscriptions.
     * Each row is validated & inserted independently — errors in one row don't block others.
     *
     * Row shape:
     * {
     *   subscriptionType: 'company' | 'branch',
     *   companyId: string,
     *   branchId?: string,              // required if subscriptionType = 'branch'
     *   planId?: string,                // optional
     *   billingCycle: 'monthly' | 'yearly',
     *   startDate: 'YYYY-MM-DD',
     *   endDate: 'YYYY-MM-DD',
     *   status?: 'active' | 'expired' | 'cancelled',  // default: auto-detect from endDate
     *   basePrice: number,
     *   currency?: string,
     *   autoRenew?: boolean,
     *   notes?: string,
     *   items?: [{ featureSlug?, featureId?, quantity, unitPrice }]
     * }
     *
     * Options:
     * - dryRun: validate only, don't insert
     * - skipExisting: skip rows where an overlapping subscription already exists
     */
    public static async importSubscriptions(client: PoolClient, data: {
        rows: any[];
        dryRun?: boolean;
        skipExisting?: boolean;
        performedBy?: string;
    }) {
        if (!Array.isArray(data.rows) || data.rows.length === 0) {
            throw new Error("rows array is required and must not be empty");
        }

        const results = {
            total: data.rows.length,
            imported: 0,
            skipped: 0,
            failed: 0,
            errors: [] as any[],
            imported_ids: [] as string[],
        };

        // Cache features by slug for quick lookup
        const featuresResult = await client.query(
            `SELECT id, slug FROM admin."SubscriptionFeatures"`
        );
        const featureBySlug = new Map<string, string>();
        for (const f of featuresResult.rows) {
            featureBySlug.set(f.slug, f.id);
        }

        for (let i = 0; i < data.rows.length; i++) {
            const row = data.rows[i];
            const rowNum = i + 1;

            try {
                // ── Validate required fields ──
                if (!row.subscriptionType || !['company', 'branch'].includes(row.subscriptionType)) {
                    throw new Error("subscriptionType must be 'company' or 'branch'");
                }
                if (!row.companyId) throw new Error("companyId is required");
                if (row.subscriptionType === 'branch' && !row.branchId) {
                    throw new Error("branchId is required for branch subscriptions");
                }
                if (!row.billingCycle || !['monthly', 'yearly'].includes(row.billingCycle)) {
                    throw new Error("billingCycle must be 'monthly' or 'yearly'");
                }
                if (!row.startDate || !row.endDate) {
                    throw new Error("startDate and endDate are required");
                }
                if (new Date(row.endDate) <= new Date(row.startDate)) {
                    throw new Error("endDate must be after startDate");
                }
                if (row.basePrice === undefined || row.basePrice === null) {
                    throw new Error("basePrice is required");
                }

                // ── Verify company/branch exist ──
                const companyCheck = await client.query(
                    `SELECT id FROM "Companies" WHERE id = $1`, [row.companyId]
                );
                if (!companyCheck.rows[0]) {
                    throw new Error(`Company ${row.companyId} not found`);
                }

                if (row.subscriptionType === 'branch') {
                    const branchCheck = await client.query(
                        `SELECT id, "companyId" FROM "Branches" WHERE id = $1`, [row.branchId]
                    );
                    if (!branchCheck.rows[0]) {
                        throw new Error(`Branch ${row.branchId} not found`);
                    }
                    if (branchCheck.rows[0].companyId !== row.companyId) {
                        throw new Error(`Branch ${row.branchId} does not belong to company ${row.companyId}`);
                    }
                }

                // ── Verify plan if provided ──
                if (row.planId) {
                    const planCheck = await client.query(
                        `SELECT id FROM admin."SubscriptionPlans" WHERE id = $1`, [row.planId]
                    );
                    if (!planCheck.rows[0]) {
                        throw new Error(`Plan ${row.planId} not found`);
                    }
                }

                // ── Auto-detect status if not provided ──
                const today = new Date().toISOString().split('T')[0];
                const status = row.status || (row.endDate < today ? 'expired' : 'active');

                // ── Check for overlapping existing subscription ──
                const overlapTable = row.subscriptionType === 'company'
                    ? 'admin."CompanySubscriptions"'
                    : 'admin."BranchSubscriptions"';
                const overlapColumn = row.subscriptionType === 'company' ? '"companyId"' : '"branchId"';
                const overlapId = row.subscriptionType === 'company' ? row.companyId : row.branchId;

                const overlapCheck = await client.query(
                    `SELECT id FROM ${overlapTable}
                     WHERE ${overlapColumn} = $1
                       AND "startDate" <= $2
                       AND "endDate" >= $3
                       AND status != 'cancelled'`,
                    [overlapId, row.endDate, row.startDate]
                );

                if (overlapCheck.rows.length > 0) {
                    if (data.skipExisting) {
                        results.skipped++;
                        continue;
                    } else {
                        throw new Error(`Overlapping subscription already exists (${overlapCheck.rows[0].id})`);
                    }
                }

                // ── Resolve feature items ──
                const resolvedItems: any[] = [];
                if (row.items && Array.isArray(row.items)) {
                    for (const item of row.items) {
                        let featureId = item.featureId;
                        if (!featureId && item.featureSlug) {
                            featureId = featureBySlug.get(item.featureSlug);
                            if (!featureId) {
                                throw new Error(`Feature slug '${item.featureSlug}' not found in catalog`);
                            }
                        }
                        if (!featureId) {
                            throw new Error("each item must have either featureId or featureSlug");
                        }
                        resolvedItems.push({
                            featureId,
                            quantity: item.quantity || 1,
                            unitPrice: item.unitPrice || 0,
                        });
                    }
                }

                // ── Dry run: skip insertion ──
                if (data.dryRun) {
                    results.imported++;
                    continue;
                }

                // ── Insert subscription ──
                let subscriptionId: string;
                if (row.subscriptionType === 'company') {
                    const insertResult = await client.query(
                        `INSERT INTO admin."CompanySubscriptions"
                         ("companyId", "planId", status, "billingCycle", "startDate", "endDate", "renewalDate", "autoRenew", "basePrice", currency, notes)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                        [row.companyId, row.planId || null, status, row.billingCycle,
                         row.startDate, row.endDate, row.endDate, row.autoRenew ?? false,
                         row.basePrice, row.currency || 'SAR',
                         row.notes || `Imported from historical data on ${today}`]
                    );
                    subscriptionId = insertResult.rows[0].id;
                } else {
                    const insertResult = await client.query(
                        `INSERT INTO admin."BranchSubscriptions"
                         ("branchId", "companyId", "planId", status, "billingCycle", "startDate", "endDate", "renewalDate", "autoRenew", "basePrice", currency, notes)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
                        [row.branchId, row.companyId, row.planId || null, status, row.billingCycle,
                         row.startDate, row.endDate, row.endDate, row.autoRenew ?? false,
                         row.basePrice, row.currency || 'SAR',
                         row.notes || `Imported from historical data on ${today}`]
                    );
                    subscriptionId = insertResult.rows[0].id;
                }

                // ── Insert items ──
                // If planId provided and no explicit items, copy from plan
                if (row.planId && resolvedItems.length === 0) {
                    await client.query(
                        `INSERT INTO admin."SubscriptionItems" ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate", "isActive")
                         SELECT $1, $2, "featureId", quantity, "unitPrice", $3, $4, $5
                         FROM admin."PlanFeatures" WHERE "planId" = $6`,
                        [subscriptionId, row.subscriptionType, row.startDate, row.endDate, status === 'active', row.planId]
                    );
                }

                // Insert explicit items
                for (const item of resolvedItems) {
                    await client.query(
                        `INSERT INTO admin."SubscriptionItems"
                         ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate", "isActive")
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [subscriptionId, row.subscriptionType, item.featureId, item.quantity, item.unitPrice,
                         row.startDate, row.endDate, status === 'active']
                    );
                }

                // Log import as a change entry
                await client.query(
                    `INSERT INTO admin."SubscriptionChanges"
                     ("subscriptionId", "subscriptionType", "changeType", "effectiveDate", "performedBy", notes)
                     VALUES ($1, $2, 'imported', $3, $4, $5)`,
                    [subscriptionId, row.subscriptionType, row.startDate, data.performedBy || null,
                     `Imported from historical data. Period: ${row.startDate} → ${row.endDate}`]
                );

                results.imported++;
                results.imported_ids.push(subscriptionId);
            } catch (error: any) {
                results.failed++;
                results.errors.push({
                    row: rowNum,
                    data: row,
                    error: error.message,
                });
            }
        }

        return new ResponseData(true, "", results);
    }

    /**
     * Toggle autoRenew for a company or branch subscription.
     */
    public static async setSubscriptionAutoRenew(client: PoolClient, data: {
        subscriptionId: string;
        subscriptionType: "company" | "branch";
        autoRenew: boolean;
        performedBy?: string;
    }) {
        const table = data.subscriptionType === 'company' ? 'admin."CompanySubscriptions"' : 'admin."BranchSubscriptions"';

        const result = await client.query(
            `UPDATE ${table} SET "autoRenew" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *`,
            [data.autoRenew, data.subscriptionId]
        );
        if (!result.rows[0]) throw new Error("Subscription not found");

        // Log the change
        await client.query(
            `INSERT INTO admin."SubscriptionChanges"
             ("subscriptionId", "subscriptionType", "changeType", "effectiveDate", "performedBy", notes)
             VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)`,
            [data.subscriptionId, data.subscriptionType,
             data.autoRenew ? 'auto_renew_enabled' : 'auto_renew_disabled',
             data.performedBy || null,
             data.autoRenew ? 'Auto-renewal enabled' : 'Auto-renewal disabled']
        );

        return new ResponseData(true, "", result.rows[0]);
    }

    // ══════════════════════════════════════════════════════════════════
    // MID-CYCLE CHANGES
    // ══════════════════════════════════════════════════════════════════

    /**
     * Validate feature scope matches the subscription type, and that
     * adding it would not create a duplicate.
     *
     * - company features can only be added to company subscriptions
     * - branch features can only be added to branch subscriptions
     * - boolean features cannot be duplicated (quantity features can)
     */
    private static async assertNoDuplicateFeature(
        client: PoolClient,
        subscriptionId: string,
        subscriptionType: string,
        featureId: string
    ) {
        const feature = await client.query(
            `SELECT "featureType", scope, name FROM admin."SubscriptionFeatures" WHERE id = $1`,
            [featureId]
        );
        if (!feature.rows[0]) throw new Error(`Feature ${featureId} not found`);

        // Scope must match subscription type
        if (feature.rows[0].scope !== subscriptionType) {
            throw new Error(
                `Feature '${feature.rows[0].name}' has scope '${feature.rows[0].scope}' ` +
                `and cannot be added to a ${subscriptionType} subscription`
            );
        }

        // Quantity features are allowed to be added again
        if (feature.rows[0].featureType === 'quantity') return;

        // For boolean features, check for existing active item
        const existing = await client.query(
            `SELECT id FROM admin."SubscriptionItems"
             WHERE "subscriptionId" = $1 AND "subscriptionType" = $2
               AND "featureId" = $3 AND "isActive" = true`,
            [subscriptionId, subscriptionType, featureId]
        );
        if (existing.rows.length > 0) {
            throw new Error(`Feature '${feature.rows[0].name}' already exists on this subscription`);
        }
    }

    /**
     * Add a feature mid-cycle to an existing subscription.
     * Calculates proration based on remaining days.
     */
    public static async addFeatureMidCycle(client: PoolClient, data: {
        subscriptionId: string;
        subscriptionType: "company" | "branch";
        featureId: string;
        quantity: number;
        unitPrice: number;
        effectiveDate: string;
        performedBy?: string;
    }) {
        // Reject duplicate boolean features
        await this.assertNoDuplicateFeature(client, data.subscriptionId, data.subscriptionType, data.featureId);

        // Get parent subscription to calculate proration
        const table = data.subscriptionType === 'company' ? 'admin."CompanySubscriptions"' : 'admin."BranchSubscriptions"';
        const sub = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [data.subscriptionId]);
        if (!sub.rows[0]) throw new Error("Subscription not found");

        const subscription = sub.rows[0];
        const endDate = new Date(subscription.endDate);
        const effectiveDate = new Date(data.effectiveDate);
        const totalDays = Math.ceil((endDate.getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.ceil((endDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
        const prorationFactor = remainingDays / totalDays;
        const proratedAmount = Math.round(data.unitPrice * data.quantity * prorationFactor * 100) / 100;

        // Add subscription item
        await client.query(
            `INSERT INTO admin."SubscriptionItems" ("subscriptionId", "subscriptionType", "featureId", quantity, "unitPrice", "startDate", "endDate", "addedMidCycle")
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
            [data.subscriptionId, data.subscriptionType, data.featureId, data.quantity, data.unitPrice, data.effectiveDate, subscription.endDate]
        );

        // Log the change
        await client.query(
            `INSERT INTO admin."SubscriptionChanges" ("subscriptionId", "subscriptionType", "changeType", "featureId", "newQuantity", "effectiveDate", "proratedAmount", "performedBy", notes)
             VALUES ($1, $2, 'add_feature', $3, $4, $5, $6, $7, $8)`,
            [data.subscriptionId, data.subscriptionType, data.featureId, data.quantity,
            data.effectiveDate, proratedAmount, data.performedBy,
            `Mid-cycle addition. Proration: ${remainingDays}/${totalDays} days = ${(prorationFactor * 100).toFixed(1)}%`]
        );

        return { proratedAmount, remainingDays, totalDays, prorationFactor };
    }

    /**
     * Increase quantity of an existing subscription item mid-cycle.
     */
    public static async increaseQuantityMidCycle(client: PoolClient, data: {
        subscriptionItemId: string;
        additionalQuantity: number;
        effectiveDate: string;
        performedBy?: string;
    }) {
        // Get the item and its parent subscription
        const item = await client.query(`SELECT * FROM admin."SubscriptionItems" WHERE id = $1`, [data.subscriptionItemId]);
        if (!item.rows[0]) throw new Error("Subscription item not found");

        const subItem = item.rows[0];
        const table = subItem.subscriptionType === 'company' ? 'admin."CompanySubscriptions"' : 'admin."BranchSubscriptions"';
        const sub = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [subItem.subscriptionId]);
        const subscription = sub.rows[0];

        const endDate = new Date(subscription.endDate);
        const effectiveDate = new Date(data.effectiveDate);
        const totalDays = Math.ceil((endDate.getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.ceil((endDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
        const prorationFactor = remainingDays / totalDays;
        const proratedAmount = Math.round(subItem.unitPrice * data.additionalQuantity * prorationFactor * 100) / 100;

        const previousQty = subItem.quantity;
        const newQty = previousQty + data.additionalQuantity;

        // Update quantity
        await client.query(
            `UPDATE admin."SubscriptionItems" SET quantity = $1, "updatedAt" = NOW() WHERE id = $2`,
            [newQty, data.subscriptionItemId]
        );

        // Log the change
        await client.query(
            `INSERT INTO admin."SubscriptionChanges" ("subscriptionId", "subscriptionType", "changeType", "featureId", "previousQuantity", "newQuantity", "effectiveDate", "proratedAmount", "performedBy", notes)
             VALUES ($1, $2, 'increase_quantity', $3, $4, $5, $6, $7, $8, $9)`,
            [subItem.subscriptionId, subItem.subscriptionType, subItem.featureId, previousQty, newQty,
            data.effectiveDate, proratedAmount, data.performedBy,
            `Quantity increased by ${data.additionalQuantity}. Proration: ${remainingDays}/${totalDays} days`]
        );

        return { proratedAmount, previousQty, newQty, remainingDays, totalDays };
    }

    /**
     * Remove a feature or decrease quantity mid-cycle.
     */
    public static async removeFeatureMidCycle(client: PoolClient, data: {
        subscriptionItemId: string;
        removeQuantity?: number; // if null, removes entirely
        effectiveDate: string;
        performedBy?: string;
    }) {
        const item = await client.query(`SELECT * FROM admin."SubscriptionItems" WHERE id = $1`, [data.subscriptionItemId]);
        if (!item.rows[0]) throw new Error("Subscription item not found");

        const subItem = item.rows[0];
        const previousQty = subItem.quantity;
        const removeQty = data.removeQuantity || previousQty;
        const newQty = Math.max(0, previousQty - removeQty);

        if (newQty === 0) {
            await client.query(
                `UPDATE admin."SubscriptionItems" SET "isActive" = false, "endDate" = $1, "updatedAt" = NOW() WHERE id = $2`,
                [data.effectiveDate, data.subscriptionItemId]
            );
        } else {
            await client.query(
                `UPDATE admin."SubscriptionItems" SET quantity = $1, "updatedAt" = NOW() WHERE id = $2`,
                [newQty, data.subscriptionItemId]
            );
        }

        // Calculate credit (negative proration)
        const table = subItem.subscriptionType === 'company' ? 'admin."CompanySubscriptions"' : 'admin."BranchSubscriptions"';
        const sub = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [subItem.subscriptionId]);
        const subscription = sub.rows[0];

        const endDate = new Date(subscription.endDate);
        const effectiveDate = new Date(data.effectiveDate);
        const totalDays = Math.ceil((endDate.getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.ceil((endDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
        const prorationFactor = remainingDays / totalDays;
        const creditAmount = Math.round(subItem.unitPrice * removeQty * prorationFactor * 100) / 100 * -1;

        await client.query(
            `INSERT INTO admin."SubscriptionChanges" ("subscriptionId", "subscriptionType", "changeType", "featureId", "previousQuantity", "newQuantity", "effectiveDate", "proratedAmount", "performedBy", notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [subItem.subscriptionId, subItem.subscriptionType,
            newQty === 0 ? 'remove_feature' : 'decrease_quantity',
            subItem.featureId, previousQty, newQty,
            data.effectiveDate, creditAmount, data.performedBy,
            `Removed ${removeQty} units. Credit: ${creditAmount}`]
        );

        return { creditAmount, previousQty, newQty, remainingDays, totalDays };
    }

    // ══════════════════════════════════════════════════════════════════
    // ENTITLEMENT QUERIES
    // ══════════════════════════════════════════════════════════════════

    /** Get all active features for a company (modules) — only from subscriptions covering today */
    public static async getActiveCompanyFeatures(companyId: string) {
        const result = await DB.excu.query(
            `SELECT sf.slug, sf.name, si.quantity, si."unitPrice"
             FROM admin."CompanySubscriptions" cs
             JOIN admin."SubscriptionItems" si ON si."subscriptionId" = cs.id AND si."subscriptionType" = 'company'
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE cs."companyId" = $1
               AND cs.status = 'active'
               AND cs."startDate" <= CURRENT_DATE
               AND cs."endDate" >= CURRENT_DATE
               AND si."isActive" = true
               AND si."startDate" <= CURRENT_DATE
               AND (si."endDate" IS NULL OR si."endDate" >= CURRENT_DATE)`,
            [companyId], "admin"
        );
        return result.rows;
    }

    /** Get features for a specific subscription by ID (works for company or branch, any status/period) */
    public static async getSubscriptionFeatures(subscriptionId: string, subscriptionType: "company" | "branch") {
        const table = subscriptionType === 'company'
            ? 'admin."CompanySubscriptions"'
            : 'admin."BranchSubscriptions"';
        const branchSelect = subscriptionType === 'branch'
            ? `, sub."branchId", b.name AS "branchName"`
            : '';
        const branchJoin = subscriptionType === 'branch'
            ? `LEFT JOIN "Branches" b ON b.id = sub."branchId"`
            : '';

        const result = await DB.excu.query(
            `SELECT
                sub.id AS "subscriptionId",
                sub.status,
                sub."startDate",
                sub."endDate",
                sub."billingCycle",
                sub."basePrice",
                sub."companyId",
                c.name AS "companyName",
                sp.name AS "planName"
                ${branchSelect},
                sf.id AS "featureId",
                sf.slug AS "featureSlug",
                sf.name AS "featureName",
                sf."featureType",
                sf.scope AS "featureScope",
                si.id AS "subscriptionItemId",
                si.quantity,
                si."unitPrice",
                si."isActive",
                si."addedMidCycle",
                si."startDate" AS "itemStartDate",
                si."endDate" AS "itemEndDate"
             FROM ${table} sub
             LEFT JOIN "Companies" c ON c.id = sub."companyId"
             ${branchJoin}
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = sub."planId"
             LEFT JOIN admin."SubscriptionItems" si
                ON si."subscriptionId" = sub.id
               AND si."subscriptionType" = $2
             LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE sub.id = $1 and si."isActive" = true
             ORDER BY sf.name`,
            [subscriptionId, subscriptionType], "admin"
        );
        return result.rows;
    }

    /** Get features from FUTURE company subscriptions (startDate > today) */
    public static async getFutureCompanyFeatures(companyId: string) {
        const result = await DB.excu.query(
            `SELECT
                cs.id AS "subscriptionId",
                cs."startDate",
                cs."endDate",
                cs."billingCycle",
                cs."basePrice",
                sp.name AS "planName",
                sf.id AS "featureId",
                sf.slug AS "featureSlug",
                sf.name AS "featureName",
                sf."featureType",
                si.id AS "subscriptionItemId",
                si.quantity,
                si."unitPrice"
             FROM admin."CompanySubscriptions" cs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = cs."planId"
             LEFT JOIN admin."SubscriptionItems" si
                ON si."subscriptionId" = cs.id
               AND si."subscriptionType" = 'company'
               AND si."isActive" = true
             LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE cs."companyId" = $1
               AND cs.status = 'active'
               AND cs."startDate" > CURRENT_DATE
             ORDER BY cs."startDate", sf.name`,
            [companyId], "admin"
        );
        return result.rows;
    }

    /** Get features from FUTURE branch subscriptions (startDate > today) */
    public static async getFutureBranchFeatures(branchId: string) {
        const result = await DB.excu.query(
            `SELECT
                bs.id AS "subscriptionId",
                bs."startDate",
                bs."endDate",
                bs."billingCycle",
                bs."basePrice",
                sp.name AS "planName",
                sf.id AS "featureId",
                sf.slug AS "featureSlug",
                sf.name AS "featureName",
                sf."featureType",
                si.id AS "subscriptionItemId",
                si.quantity,
                si."unitPrice"
             FROM admin."BranchSubscriptions" bs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = bs."planId"
             LEFT JOIN admin."SubscriptionItems" si
                ON si."subscriptionId" = bs.id
               AND si."subscriptionType" = 'branch'
               AND si."isActive" = true
             LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE bs."branchId" = $1
               AND bs.status = 'active'
               AND bs."startDate" > CURRENT_DATE
             ORDER BY bs."startDate", sf.name`,
            [branchId], "admin"
        );
        return result.rows;
    }

    /** Get all active features for a branch — only from subscriptions covering today */
    public static async getActiveBranchFeatures(branchId: string) {
        const result = await DB.excu.query(
            `SELECT sf.slug, sf.name, sf."featureType", si.quantity, si.id, si."unitPrice"
             FROM admin."BranchSubscriptions" bs
             JOIN admin."SubscriptionItems" si ON si."subscriptionId" = bs.id AND si."subscriptionType" = 'branch'
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE bs."branchId" = $1
               AND bs.status = 'active'
               AND bs."startDate" <= CURRENT_DATE
               AND bs."endDate" >= CURRENT_DATE
               AND si."isActive" = true
               AND si."startDate" <= CURRENT_DATE
               AND (si."endDate" IS NULL OR si."endDate" >= CURRENT_DATE)`,
            [branchId], "admin"
        );
        return result.rows;
    }

    /** Get allowed device count for a branch by device type — only from subscriptions covering today */
    public static async getAllowedDevices(branchId: string, deviceType: string) {
        const result = await DB.excu.query(
            `SELECT COALESCE(SUM(si.quantity), 0) AS "allowedCount"
             FROM admin."BranchSubscriptions" bs
             JOIN admin."SubscriptionItems" si ON si."subscriptionId" = bs.id AND si."subscriptionType" = 'branch'
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE bs."branchId" = $1
               AND bs.status = 'active'
               AND bs."startDate" <= CURRENT_DATE
               AND bs."endDate" >= CURRENT_DATE
               AND si."isActive" = true AND sf.slug = $2
               AND si."startDate" <= CURRENT_DATE
               AND (si."endDate" IS NULL OR si."endDate" >= CURRENT_DATE)`,
            [branchId, deviceType], "admin"
        );
        return parseInt(result.rows[0]?.allowedCount || '0');
    }

    /** Get current active device count for a branch */
    public static async getActiveDeviceCount(branchId: string, deviceType: string) {
        const result = await DB.excu.query(
            `SELECT COUNT(*) AS "activeCount"
             FROM admin."BranchDevices"
             WHERE "branchId" = $1 AND "deviceType" = $2 AND status = 'active'`,
            [branchId, deviceType], "admin"
        );
        return parseInt(result.rows[0]?.activeCount || '0');
    }

    /** Check if a branch can register a new device */
    public static async canRegisterDevice(branchId: string, deviceType: string) {
        const allowed = await this.getAllowedDevices(branchId, deviceType);
        const active = await this.getActiveDeviceCount(branchId, deviceType);
        return { allowed, active, canRegister: active < allowed };
    }

    // ══════════════════════════════════════════════════════════════════
    // BILLING INVOICES
    // ══════════════════════════════════════════════════════════════════

    public static async generateInvoiceNumber() {
        const result = await DB.excu.query(
            `SELECT COUNT(*) + 1 AS num FROM admin."BillingInvoices"`, [], "admin"
        );
        const num = result.rows[0].num;
        return `INV-${String(num).padStart(6, '0')}`;
    }

    /**
     * Generate a billing invoice from a company's active subscriptions.
     * Automatically builds line items from:
     * 1. Company subscription base price + company-level feature items
     * 2. All active branch subscriptions base prices + branch-level feature items
     * 3. Any pending mid-cycle prorations not yet invoiced
     *
     * Input: { companyId, invoiceNumber, taxRate?, dueDate?, discount?, notes? }
     */
    public static async createBillingInvoice(client: PoolClient, data: {
        companyId: string;
        invoiceNumber: string;
        taxRate?: number;
        dueDays?: number;
        discount?: number;
        notes?: string;
    }) {
        const taxRate = data.taxRate ?? 10; // default VAT
        const dueDays = data.dueDays ?? 30;
        const discountPct = data.discount ?? 0;

        // ── 1. Get active company subscription ──
        const companySub = await client.query(
            `SELECT cs.*, sp.name AS "planName"
             FROM admin."CompanySubscriptions" cs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = cs."planId"
             WHERE cs."companyId" = $1 AND cs.status = 'active'
             ORDER BY cs."createdAt" DESC LIMIT 1`,
            [data.companyId]
        );
        if (!companySub.rows[0]) throw new Error("No active company subscription found");
        const csub = companySub.rows[0];

        // ── 2. Get company subscription items ──
        const companyItems = await client.query(
            `SELECT si.*, sf.name AS "featureName", sf.slug AS "featureSlug", sf."featureType"
             FROM admin."SubscriptionItems" si
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             WHERE si."subscriptionId" = $1 AND si."subscriptionType" = 'company' AND si."isActive" = true`,
            [csub.id]
        );

        // ── 3. Get all active branch subscriptions for this company ──
        const branchSubs = await client.query(
            `SELECT bs.*, sp.name AS "planName", b.name AS "branchName"
             FROM admin."BranchSubscriptions" bs
             LEFT JOIN admin."SubscriptionPlans" sp ON sp.id = bs."planId"
             JOIN "Branches" b ON b.id = bs."branchId"
             WHERE bs."companyId" = $1 AND bs.status = 'active'
             ORDER BY b.name`,
            [data.companyId]
        );

        // ── 4. Get all branch subscription items ──
        const branchItemsResult = await client.query(
            `SELECT si.*, sf.name AS "featureName", sf.slug AS "featureSlug", sf."featureType",
                    bs."branchId", b.name AS "branchName"
             FROM admin."SubscriptionItems" si
             JOIN admin."SubscriptionFeatures" sf ON sf.id = si."featureId"
             JOIN admin."BranchSubscriptions" bs ON bs.id = si."subscriptionId"
             JOIN "Branches" b ON b.id = bs."branchId"
             WHERE bs."companyId" = $1 AND si."subscriptionType" = 'branch' AND si."isActive" = true
               AND bs.status = 'active'`,
            [data.companyId]
        );

        // ── 4b. Build set of already-invoiced (subscription, feature) pairs ──
        // Any combination already invoiced (non-void) will be skipped when building lines.
        // featureId IS NULL represents the base subscription line.
        const activeSubscriptionIds = [
            csub.id,
            ...branchSubs.rows.map((b: any) => b.id),
        ];

        const invoicedPairs = new Set<string>();
        if (activeSubscriptionIds.length > 0) {
            const invoicedResult = await client.query(
                `SELECT DISTINCT bil."subscriptionId", bil."featureId"
                 FROM admin."BillingInvoices" bi
                 JOIN admin."BillingInvoiceLines" bil ON bil."invoiceId" = bi.id
                 WHERE bi."companyId" = $1
                   AND bi.status NOT IN ('void', 'refunded')
                   AND bil."subscriptionId" = ANY($2)
                   AND bil."lineType" IN ('base_subscription', 'addon')`,
                [data.companyId, activeSubscriptionIds]
            );
            for (const row of invoicedResult.rows) {
                invoicedPairs.add(`${row.subscriptionId}:${row.featureId || 'base'}`);
            }
        }
        const pairKey = (subId: string, featureId: string | null) => `${subId}:${featureId || 'base'}`;

        // ── 5. Get uninvoiced mid-cycle prorations ──
        const prorations = await client.query(
            `SELECT sc.*, sf.name AS "featureName"
             FROM admin."SubscriptionChanges" sc
             LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = sc."featureId"
             WHERE sc."subscriptionId" IN (
                 SELECT id FROM admin."CompanySubscriptions" WHERE "companyId" = $1 AND status = 'active'
                 UNION ALL
                 SELECT id FROM admin."BranchSubscriptions" WHERE "companyId" = $1 AND status = 'active'
             )
             AND sc."proratedAmount" IS NOT NULL
             AND sc."billingInvoiceId" IS NULL
             ORDER BY sc."effectiveDate"`,
            [data.companyId]
        );

        // ── 6. Build line items ──
        const lines: any[] = [];
        const periodStart = csub.startDate;
        const periodEnd = csub.endDate;

        // Company base subscription line — skip if already invoiced
        if (parseFloat(csub.basePrice) > 0 && !invoicedPairs.has(pairKey(csub.id, null))) {
            const amount = parseFloat(csub.basePrice);
            lines.push({
                subscriptionId: csub.id,
                subscriptionType: 'company',
                featureId: null,
                lineType: 'base_subscription',
                description: `Company subscription${csub.planName ? ' — ' + csub.planName : ''} (${csub.billingCycle})`,
                quantity: 1,
                unitPrice: amount,
                amount,
                periodStart,
                periodEnd,
            });
        }

        // Company feature items — skip if already invoiced
        for (const item of companyItems.rows) {
            if (parseFloat(item.unitPrice) > 0 && !invoicedPairs.has(pairKey(csub.id, item.featureId))) {
                const amount = parseFloat(item.unitPrice) * item.quantity;
                lines.push({
                    subscriptionId: csub.id,
                    subscriptionType: 'company',
                    featureId: item.featureId,
                    lineType: item.addedMidCycle ? 'addon' : 'base_subscription',
                    description: `${item.featureName}${item.quantity > 1 ? ' x' + item.quantity : ''}`,
                    quantity: item.quantity,
                    unitPrice: parseFloat(item.unitPrice),
                    amount,
                    periodStart: item.startDate,
                    periodEnd: item.endDate || periodEnd,
                });
            }
        }

        // Branch base subscriptions — skip if already invoiced
        for (const bsub of branchSubs.rows) {
            if (parseFloat(bsub.basePrice) > 0 && !invoicedPairs.has(pairKey(bsub.id, null))) {
                const amount = parseFloat(bsub.basePrice);
                lines.push({
                    subscriptionId: bsub.id,
                    subscriptionType: 'branch',
                    featureId: null,
                    lineType: 'base_subscription',
                    description: `${bsub.branchName} — branch subscription${bsub.planName ? ' (' + bsub.planName + ')' : ''} (${bsub.billingCycle})`,
                    quantity: 1,
                    unitPrice: amount,
                    amount,
                    periodStart: bsub.startDate,
                    periodEnd: bsub.endDate,
                });
            }
        }

        // Branch feature items — skip if already invoiced
        for (const item of branchItemsResult.rows) {
            if (parseFloat(item.unitPrice) > 0 && !invoicedPairs.has(pairKey(item.subscriptionId, item.featureId))) {
                const amount = parseFloat(item.unitPrice) * item.quantity;
                lines.push({
                    subscriptionId: item.subscriptionId,
                    subscriptionType: 'branch',
                    featureId: item.featureId,
                    lineType: item.addedMidCycle ? 'addon' : 'base_subscription',
                    description: `${item.branchName} — ${item.featureName}${item.quantity > 1 ? ' x' + item.quantity : ''}`,
                    quantity: item.quantity,
                    unitPrice: parseFloat(item.unitPrice),
                    amount,
                    periodStart: item.startDate,
                    periodEnd: item.endDate || periodEnd,
                });
            }
        }

        // Mid-cycle prorations (not yet invoiced)
        for (const p of prorations.rows) {
            const amt = parseFloat(p.proratedAmount);
            lines.push({
                subscriptionId: p.subscriptionId,
                subscriptionType: p.subscriptionType,
                featureId: p.featureId,
                lineType: amt >= 0 ? 'proration' : 'credit',
                description: `${p.featureName || 'Plan change'} — proration (${p.changeType.replace('_', ' ')})`,
                quantity: 1,
                unitPrice: amt,
                amount: amt,
                periodStart: p.effectiveDate,
                periodEnd,
            });
        }

        // Nothing new to invoice — all items already billed and no pending prorations
        if (lines.length === 0) {
            throw new Error(
                "Nothing new to invoice for this company. " +
                "All current subscription features have already been billed for this period, " +
                "and no mid-cycle changes are pending."
            );
        }

        // ── 7. Calculate totals ──
        let subtotal = 0;
        for (const line of lines) {
            subtotal += line.amount;
        }

        const discountTotal = Math.round(subtotal * (discountPct / 100) * 100) / 100;
        const taxableAmount = subtotal - discountTotal;
        const taxTotal = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
        const total = Math.round((taxableAmount + taxTotal) * 100) / 100;

        // Apply tax to each line
        for (const line of lines) {
            const lineDiscount = Math.round(line.amount * (discountPct / 100) * 100) / 100;
            const lineTaxable = line.amount - lineDiscount;
            line.discountAmount = lineDiscount;
            line.taxRate = taxRate;
            line.taxAmount = Math.round(lineTaxable * (taxRate / 100) * 100) / 100;
            line.total = Math.round((lineTaxable + line.taxAmount) * 100) / 100;
        }

        // ── 8. Insert invoice ──
        const today = new Date();
        const issueDate = today.toISOString().split('T')[0];
        const dueDate = new Date(today.getTime() + dueDays * 86400000).toISOString().split('T')[0];
        const pStart = periodStart instanceof Date ? periodStart.toISOString().split('T')[0] : String(periodStart);
        const pEnd = periodEnd instanceof Date ? periodEnd.toISOString().split('T')[0] : String(periodEnd);

        const result = await client.query(
            `INSERT INTO admin."BillingInvoices"
             ("invoiceNumber", "companyId", status, "issueDate", "dueDate", "periodStart", "periodEnd",
              subtotal, "discountTotal", "taxTotal", total, "amountPaid", balance, currency, notes)
             VALUES ($1, $2, 'issued', $3, $4, $5, $6, $7, $8, $9, $10, 0, $10, $11, $12)
             RETURNING *`,
            [data.invoiceNumber, data.companyId, issueDate, dueDate, pStart, pEnd,
                subtotal, discountTotal, taxTotal, total,
            csub.currency || 'BHD', data.notes || null]
        );
        const invoiceId = result.rows[0].id;

        // ── 9. Insert line items ──
        for (const line of lines) {
            await client.query(
                `INSERT INTO admin."BillingInvoiceLines"
                 ("invoiceId", "subscriptionId", "subscriptionType", "featureId", "lineType",
                  description, quantity, "unitPrice", amount, "discountAmount", "taxRate", "taxAmount", total,
                  "periodStart", "periodEnd")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [invoiceId, line.subscriptionId, line.subscriptionType, line.featureId, line.lineType,
                    line.description, line.quantity, line.unitPrice, line.amount,
                    line.discountAmount, line.taxRate, line.taxAmount, line.total,
                    line.periodStart, line.periodEnd]
            );
        }

        // ── 10. Link prorations to this invoice ──
        if (prorations.rows.length > 0) {
            const prorationIds = prorations.rows.map((p: any) => p.id);
            await client.query(
                `UPDATE admin."SubscriptionChanges" SET "billingInvoiceId" = $1 WHERE id = ANY($2)`,
                [invoiceId, prorationIds]
            );
        }

        // Add discount line if applicable
        if (discountTotal > 0) {
            await client.query(
                `INSERT INTO admin."BillingInvoiceLines"
                 ("invoiceId", "lineType", description, quantity, "unitPrice", amount, "discountAmount", "taxRate", "taxAmount", total, "periodStart", "periodEnd")
                 VALUES ($1, 'discount', $2, 1, $3, $4, 0, 0, 0, $4, $5, $6)`,
                [invoiceId, `Discount ${discountPct}%`, -discountTotal, -discountTotal, periodStart, periodEnd]
            );
        }

        return new ResponseData(true, "", {
            ...result.rows[0],
            lines,
            lineCount: lines.length,
        });
    }

    public static async getBillingInvoiceById(invoiceId: string) {
        const invoice = await DB.excu.query(
            `SELECT bi.*, c.name AS "companyName"
             FROM admin."BillingInvoices" bi
             JOIN "Companies" c ON c.id = bi."companyId"
             WHERE bi.id = $1`,
            [invoiceId], "admin"
        );
        if (!invoice.rows[0]) return null;

        const lines = await DB.excu.query(
            `SELECT bil.*, sf.name AS "featureName", sf.slug AS "featureSlug"
             FROM admin."BillingInvoiceLines" bil
             LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = bil."featureId"
             WHERE bil."invoiceId" = $1
             ORDER BY bil."createdAt"`,
            [invoiceId], "admin"
        );

        const allocations = await DB.excu.query(
            `SELECT pa.*, bp."paymentNumber", bp."paymentMethod", bp."paymentDate"
             FROM admin."PaymentAllocations" pa
             JOIN admin."BillingPayments" bp ON bp.id = pa."paymentId"
             WHERE pa."invoiceId" = $1
             ORDER BY pa."allocatedAt"`,
            [invoiceId], "admin"
        );

        return { ...invoice.rows[0], lines: lines.rows, allocations: allocations.rows };
    }

    public static async getBillingInvoicesByCompany(companyId: string) {
        const result = await DB.excu.query(
            `SELECT bi.*, c.name AS "companyName"
             FROM admin."BillingInvoices" bi
             JOIN "Companies" c ON c.id = bi."companyId"
             WHERE bi."companyId" = $1
             ORDER BY bi."issueDate" DESC`,
            [companyId], "admin"
        );
        return result.rows;
    }

    public static async getAllBillingInvoices(filters: {
        page?: number;
        pageSize?: number;
        status?: string;
        companyId?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        sortBy?: string;
        sortDir?: string;
    } = {}) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(500, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (filters.status) {
            conditions.push(`bi.status = $${idx++}`);
            params.push(filters.status);
        }
        if (filters.companyId) {
            conditions.push(`bi."companyId" = $${idx++}`);
            params.push(filters.companyId);
        }
        if (filters.search) {
            conditions.push(`(bi."invoiceNumber" ILIKE $${idx} OR c.name ILIKE $${idx})`);
            params.push(`%${filters.search}%`);
            idx++;
        }
        if (filters.dateFrom) {
            conditions.push(`bi."issueDate" >= $${idx++}`);
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push(`bi."issueDate" <= $${idx++}`);
            params.push(filters.dateTo);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortBy = ['issueDate', 'dueDate', 'total', 'balance', 'invoiceNumber', 'status', 'companyName', 'createdAt']
            .includes(filters.sortBy || '') ? filters.sortBy : 'createdAt';
        const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
        const sortColumn = sortBy === 'companyName' ? 'c.name' : `bi."${sortBy}"`;

        const baseQuery = `
            FROM admin."BillingInvoices" bi
            JOIN "Companies" c ON c.id = bi."companyId"
            ${whereClause}
        `;

        const countResult = await DB.excu.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(bi.total), 0) AS "totalAmount",
                    COALESCE(SUM(bi.balance), 0) AS "totalBalance"
             ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');

        const rowsResult = await DB.excu.query(
            `SELECT bi.*, c.name AS "companyName"
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
                totalAmount: parseFloat(countResult.rows[0]?.totalAmount || '0'),
                totalBalance: parseFloat(countResult.rows[0]?.totalBalance || '0'),
            },
        };
    }

    public static async voidBillingInvoice(client: PoolClient, invoiceId: string) {
        await client.query(
            `UPDATE admin."BillingInvoices" SET status = 'void', "voidedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
            [invoiceId]
        );
        return new ResponseData(true, "Invoice voided", null);
    }

    // ══════════════════════════════════════════════════════════════════
    // PAYMENTS & ALLOCATIONS
    // ══════════════════════════════════════════════════════════════════

    public static async generatePaymentNumber() {
        const result = await DB.excu.query(
            `SELECT COUNT(*) + 1 AS num FROM admin."BillingPayments"`, [], "admin"
        );
        const num = result.rows[0].num;
        return `PAY-${String(num).padStart(6, '0')}`;
    }

    /**
     * Create a payment linked to billing invoices.
     *
     * invoiceIds mode (simple): pass invoiceIds[] and amount — auto-allocates across invoices in order.
     * allocations mode (explicit): pass allocations[] with { invoiceId, amount } for custom split.
     * If amount > total invoice balances, the remainder stays as unallocated credit.
     *
     * Input: {
     *   companyId, paymentMethod, amount, paymentDate?,
     *   invoiceIds?: string[],          // simple: pay these invoices in order
     *   allocations?: { invoiceId, amount }[], // explicit: custom split
     *   reference?, notes?, receivedBy?
     * }
     */
    public static async createPayment(client: PoolClient, data: any) {
        // Must have at least invoiceIds or allocations
        if ((!data.invoiceIds || data.invoiceIds.length === 0) && (!data.allocations || data.allocations.length === 0)) {
            throw new Error("Payment must reference at least one invoice (invoiceIds or allocations)");
        }

        const paymentDate = (data.paymentDate && data.paymentDate !== '') ? data.paymentDate : new Date().toISOString().split('T')[0];

        // Fetch all referenced invoices
        const invoiceIds = data.invoiceIds || data.allocations.map((a: any) => a.invoiceId);
        const invoices = await client.query(
            `SELECT id, total, balance, status, "companyId", "invoiceNumber"
             FROM admin."BillingInvoices"
             WHERE id = ANY($1) AND status NOT IN ('void')
             ORDER BY total DESC`,  // normal invoices first, then credit notes
            [invoiceIds]
        );

        if (invoices.rows.length === 0) throw new Error("No valid invoices found");

        // Validate company ownership
        for (const inv of invoices.rows) {
            if (inv.companyId !== data.companyId) {
                throw new Error(`Invoice ${inv.invoiceNumber} does not belong to this company`);
            }
        }

        // Separate normal invoices and credit notes
        const normalInvoices = invoices.rows.filter((inv: any) => parseFloat(inv.total) > 0 && inv.status !== 'paid');
        const creditNotes = invoices.rows.filter((inv: any) => parseFloat(inv.total) < 0 && inv.status !== 'refunded');

        const totalNormalBalance = normalInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.balance), 0);
        const totalCreditBalance = creditNotes.reduce((sum: number, inv: any) => sum + Math.abs(parseFloat(inv.balance)), 0);

        // Determine if this is an offset (credit note applied against invoices)
        const isOffset = creditNotes.length > 0 && normalInvoices.length > 0;
        const isPureRefund = creditNotes.length > 0 && normalInvoices.length === 0;

        // Calculate the net payment amount
        // If amount is provided, use it. Otherwise auto-calculate.
        let paymentAmount: number;
        if (data.amount !== undefined && data.amount !== null && data.amount !== '') {
            paymentAmount = parseFloat(data.amount);
        } else if (isOffset) {
            // Auto-calculate: net of normal balances minus credit balances
            paymentAmount = Math.max(0, totalNormalBalance - totalCreditBalance);
        } else if (isPureRefund) {
            paymentAmount = -totalCreditBalance;
        } else {
            paymentAmount = totalNormalBalance;
        }

        // For offset scenario: apply credit notes against normal invoices
        // No actual money changes hands for the offset portion
        const offsetAmount = isOffset ? Math.min(totalNormalBalance, totalCreditBalance) : 0;
        const netCashAmount = isOffset ? Math.max(0, totalNormalBalance - totalCreditBalance) : paymentAmount;

        // Determine payment status
        let paymentStatus: string;
        if (isOffset && netCashAmount === 0) {
            paymentStatus = 'completed'; // pure offset, no cash
        } else if (isPureRefund) {
            paymentStatus = 'refunded';
        } else {
            paymentStatus = 'completed';
        }

        // The stored amount is the net cash that actually moved
        // For pure offset (10 - 10 = 0), store the offset amount so the record isn't empty
        const storedAmount = isOffset ? (netCashAmount === 0 ? offsetAmount : netCashAmount) : paymentAmount;

        // Insert payment record
        const result = await client.query(
            `INSERT INTO admin."BillingPayments"
             ("companyId", "paymentNumber", amount, "allocatedAmount", "unallocatedAmount", currency,
              "paymentMethod", status, reference, "paymentDate", notes, "receivedBy")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [data.companyId, data.paymentNumber, storedAmount, storedAmount, 0,
             data.currency || 'BHD',
             data.paymentMethod || (isOffset && netCashAmount === 0 ? 'credit_offset' : data.paymentMethod),
             paymentStatus,
             data.reference || null, paymentDate,
             data.notes || (isOffset && netCashAmount === 0 ? 'Credit note offset against invoice' : null),
             data.receivedBy || null]
        );
        const paymentId = result.rows[0].id;

        const allocationResults = [];

        // Apply credit notes first (settle them)
        let creditRemaining = totalCreditBalance;
        for (const cn of creditNotes) {
            const cnBalance = Math.abs(parseFloat(cn.balance));
            const applyAmount = Math.min(cnBalance, creditRemaining);
            if (applyAmount <= 0) continue;

            await client.query(
                `INSERT INTO admin."PaymentAllocations" ("paymentId", "invoiceId", amount) VALUES ($1, $2, $3)`,
                [paymentId, cn.id, applyAmount]
            );

            const updated = await client.query(
                `UPDATE admin."BillingInvoices" SET
                 "amountPaid" = "amountPaid" - $1,
                 balance = balance + $1,
                 status = CASE WHEN balance + $1 >= 0 THEN 'refunded' ELSE 'partially_paid' END,
                 "updatedAt" = NOW()
                 WHERE id = $2
                 RETURNING id, "invoiceNumber", total, "amountPaid", balance, status`,
                [applyAmount, cn.id]
            );

            allocationResults.push({
                invoiceId: cn.id,
                invoiceNumber: cn.invoiceNumber,
                allocated: applyAmount,
                type: 'credit_note',
                invoice: updated.rows[0],
            });

            creditRemaining -= applyAmount;
        }

        // Apply to normal invoices (offset portion + any cash)
        let normalRemaining = isOffset ? offsetAmount + netCashAmount : Math.abs(paymentAmount);
        for (const inv of normalInvoices) {
            if (normalRemaining <= 0) break;
            const balance = parseFloat(inv.balance);
            const applyAmount = Math.min(normalRemaining, balance);
            if (applyAmount <= 0) continue;

            await client.query(
                `INSERT INTO admin."PaymentAllocations" ("paymentId", "invoiceId", amount) VALUES ($1, $2, $3)`,
                [paymentId, inv.id, applyAmount]
            );

            const updated = await client.query(
                `UPDATE admin."BillingInvoices" SET
                 "amountPaid" = "amountPaid" + $1,
                 balance = total - ("amountPaid" + $1),
                 status = CASE WHEN total - ("amountPaid" + $1) <= 0 THEN 'paid' ELSE 'partially_paid' END,
                 "updatedAt" = NOW()
                 WHERE id = $2
                 RETURNING id, "invoiceNumber", total, "amountPaid", balance, status`,
                [applyAmount, inv.id]
            );

            allocationResults.push({
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                allocated: applyAmount,
                type: 'invoice',
                invoice: updated.rows[0],
            });

            normalRemaining -= applyAmount;
        }

        // Handle pure refund (only credit notes, no normal invoices)
        if (isPureRefund && allocationResults.length === 0) {
            for (const cn of creditNotes) {
                const cnBalance = Math.abs(parseFloat(cn.balance));
                await client.query(
                    `INSERT INTO admin."PaymentAllocations" ("paymentId", "invoiceId", amount) VALUES ($1, $2, $3)`,
                    [paymentId, cn.id, cnBalance]
                );
                const updated = await client.query(
                    `UPDATE admin."BillingInvoices" SET
                     "amountPaid" = "amountPaid" - $1,
                     balance = balance + $1,
                     status = 'refunded', "updatedAt" = NOW()
                     WHERE id = $2
                     RETURNING id, "invoiceNumber", total, "amountPaid", balance, status`,
                    [cnBalance, cn.id]
                );
                allocationResults.push({
                    invoiceId: cn.id,
                    invoiceNumber: cn.invoiceNumber,
                    allocated: cnBalance,
                    type: 'refund',
                    invoice: updated.rows[0],
                });
            }
        }

        return new ResponseData(true, "", {
            payment: result.rows[0],
            allocations: allocationResults,
            offsetAmount,
            netCashAmount,
            isOffset,
        });
    }

    public static async allocatePayment(client: PoolClient, paymentId: string, invoiceId: string, amount: number) {
        // Validate payment has enough unallocated funds
        const payment = await client.query(`SELECT * FROM admin."BillingPayments" WHERE id = $1`, [paymentId]);
        if (!payment.rows[0]) throw new Error("Payment not found");
        if (payment.rows[0].unallocatedAmount < amount) throw new Error("Insufficient unallocated funds");

        // Validate invoice has enough balance
        const invoice = await client.query(`SELECT * FROM admin."BillingInvoices" WHERE id = $1`, [invoiceId]);
        if (!invoice.rows[0]) throw new Error("Invoice not found");
        if (invoice.rows[0].balance < amount) throw new Error("Allocation exceeds invoice balance");

        await client.query(
            `INSERT INTO admin."PaymentAllocations" ("paymentId", "invoiceId", amount) VALUES ($1, $2, $3)`,
            [paymentId, invoiceId, amount]
        );

        await client.query(
            `UPDATE admin."BillingPayments" SET "allocatedAmount" = "allocatedAmount" + $1, "unallocatedAmount" = "unallocatedAmount" - $1, "updatedAt" = NOW() WHERE id = $2`,
            [amount, paymentId]
        );

        await client.query(
            `UPDATE admin."BillingInvoices" SET
             "amountPaid" = "amountPaid" + $1,
             balance = balance - $1,
             status = CASE WHEN balance - $1 <= 0 THEN 'paid' ELSE 'partially_paid' END,
             "updatedAt" = NOW()
             WHERE id = $2`,
            [amount, invoiceId]
        );

        return new ResponseData(true, "Payment allocated", null);
    }

    public static async getPaymentsByCompany(companyId: string) {
        const result = await DB.excu.query(
            `SELECT bp.*, c.name AS "companyName"
             FROM admin."BillingPayments" bp
             JOIN "Companies" c ON c.id = bp."companyId"
             WHERE bp."companyId" = $1
             ORDER BY bp."paymentDate" DESC`,
            [companyId], "admin"
        );
        return result.rows;
    }

    public static async getPaymentById(paymentId: string) {
        const payment = await DB.excu.query(
            `SELECT bp.*, c.name AS "companyName"
             FROM admin."BillingPayments" bp
             JOIN "Companies" c ON c.id = bp."companyId"
             WHERE bp.id = $1`,
            [paymentId], "admin"
        );
        if (!payment.rows[0]) return null;

        const allocations = await DB.excu.query(
            `SELECT pa.*, bi."invoiceNumber", bi.total AS "invoiceTotal", bi.balance AS "invoiceBalance"
             FROM admin."PaymentAllocations" pa
             JOIN admin."BillingInvoices" bi ON bi.id = pa."invoiceId"
             WHERE pa."paymentId" = $1
             ORDER BY pa."allocatedAt"`,
            [paymentId], "admin"
        );

        return { ...payment.rows[0], allocations: allocations.rows };
    }

    public static async getAllPayments(filters: {
        page?: number;
        pageSize?: number;
        status?: string;
        companyId?: string;
        paymentMethod?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        sortBy?: string;
        sortDir?: string;
    } = {}) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(500, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (filters.status) {
            conditions.push(`bp.status = $${idx++}`);
            params.push(filters.status);
        }
        if (filters.companyId) {
            conditions.push(`bp."companyId" = $${idx++}`);
            params.push(filters.companyId);
        }
        if (filters.paymentMethod) {
            conditions.push(`bp."paymentMethod" = $${idx++}`);
            params.push(filters.paymentMethod);
        }
        if (filters.search) {
            conditions.push(`(bp."paymentNumber" ILIKE $${idx} OR bp.reference ILIKE $${idx} OR c.name ILIKE $${idx})`);
            params.push(`%${filters.search}%`);
            idx++;
        }
        if (filters.dateFrom) {
            conditions.push(`bp."paymentDate" >= $${idx++}`);
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push(`bp."paymentDate" <= $${idx++}`);
            params.push(filters.dateTo);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortBy = ['paymentDate', 'amount', 'paymentNumber', 'status', 'paymentMethod', 'companyName', 'createdAt']
            .includes(filters.sortBy || '') ? filters.sortBy : 'createdAt';
        const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
        const sortColumn = sortBy === 'companyName' ? 'c.name' : `bp."${sortBy}"`;

        const baseQuery = `
            FROM admin."BillingPayments" bp
            JOIN "Companies" c ON c.id = bp."companyId"
            ${whereClause}
        `;

        const countResult = await DB.excu.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(bp.amount), 0) AS "totalAmount",
                    COALESCE(SUM(bp."unallocatedAmount"), 0) AS "totalUnallocated"
             ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');

        const rowsResult = await DB.excu.query(
            `SELECT bp.*, c.name AS "companyName"
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
                totalAmount: parseFloat(countResult.rows[0]?.totalAmount || '0'),
                totalUnallocated: parseFloat(countResult.rows[0]?.totalUnallocated || '0'),
            },
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // BRANCH DEVICES
    // ══════════════════════════════════════════════════════════════════

    public static async registerDevice(client: PoolClient, data: any) {
        // Enforce subscription limit
        const check = await this.canRegisterDevice(data.branchId, data.deviceType);
        if (!check.canRegister) {
            throw new Error(`Device limit reached: ${check.active}/${check.allowed} ${data.deviceType} devices active`);
        }

        const result = await client.query(
            `INSERT INTO admin."BranchDevices" ("branchId", "companyId", "deviceType", "deviceName", "serialNumber", status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [data.branchId, data.companyId, data.deviceType, data.deviceName, data.serialNumber, data.status || 'active', data.metadata ? JSON.stringify(data.metadata) : null]
        );
        return new ResponseData(true, "", result.rows[0]);
    }

    public static async getBranchDevices(branchId: string) {
        const result = await DB.excu.query(
            `SELECT * FROM admin."BranchDevices" WHERE "branchId" = $1 AND status != 'decommissioned' ORDER BY "deviceType", "deviceName"`,
            [branchId], "admin"
        );
        return result.rows;
    }

    public static async updateDeviceStatus(client: PoolClient, deviceId: string, status: string) {
        await client.query(
            `UPDATE admin."BranchDevices" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
            [status, deviceId]
        );
        return new ResponseData(true, "Device updated", null);
    }

    // ══════════════════════════════════════════════════════════════════
    // SUBSCRIPTION CHANGE LOG
    // ══════════════════════════════════════════════════════════════════

    public static async getSubscriptionChanges(subscriptionId: string, subscriptionType: string) {
        const result = await DB.excu.query(
            `SELECT sc.*, sf.name AS "featureName", sf.slug AS "featureSlug"
             FROM admin."SubscriptionChanges" sc
             LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = sc."featureId"
             WHERE sc."subscriptionId" = $1 AND sc."subscriptionType" = $2
             ORDER BY sc."createdAt" DESC`,
            [subscriptionId, subscriptionType], "admin"
        );
        return result.rows;
    }

    /**
     * List all subscription changes with pagination and filters for admin table view.
     * Filters: changeType, subscriptionType, companyId, branchId, dateFrom, dateTo, search
     */
    public static async listSubscriptionChanges(filters: {
        page?: number;
        pageSize?: number;
        changeType?: string;
        subscriptionType?: string;
        companyId?: string;
        branchId?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
    }) {
        const page = Math.max(1, filters.page || 1);
        const pageSize = Math.min(200, Math.max(1, filters.pageSize || 25));
        const offset = (page - 1) * pageSize;

        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (filters.changeType) {
            conditions.push(`sc."changeType" = $${idx++}`);
            params.push(filters.changeType);
        }
        if (filters.subscriptionType) {
            conditions.push(`sc."subscriptionType" = $${idx++}`);
            params.push(filters.subscriptionType);
        }
        if (filters.companyId) {
            conditions.push(`COALESCE(cs."companyId", bs."companyId") = $${idx++}`);
            params.push(filters.companyId);
        }
        if (filters.branchId) {
            conditions.push(`bs."branchId" = $${idx++}`);
            params.push(filters.branchId);
        }
        if (filters.dateFrom) {
            conditions.push(`sc."createdAt" >= $${idx++}`);
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push(`sc."createdAt" <= $${idx++}`);
            params.push(filters.dateTo);
        }
        if (filters.search) {
            conditions.push(`(c.name ILIKE $${idx} OR b.name ILIKE $${idx} OR sf.name ILIKE $${idx} OR sc.notes ILIKE $${idx})`);
            params.push(`%${filters.search}%`);
            idx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const baseQuery = `
            FROM admin."SubscriptionChanges" sc
            LEFT JOIN admin."CompanySubscriptions" cs
                ON cs.id = sc."subscriptionId" AND sc."subscriptionType" = 'company'
            LEFT JOIN admin."BranchSubscriptions" bs
                ON bs.id = sc."subscriptionId" AND sc."subscriptionType" = 'branch'
            LEFT JOIN "Companies" c ON c.id = COALESCE(cs."companyId", bs."companyId")
            LEFT JOIN "Branches" b ON b.id = bs."branchId"
            LEFT JOIN admin."SubscriptionFeatures" sf ON sf.id = sc."featureId"
            LEFT JOIN admin."SubscriptionPlans" psp ON psp.id = sc."previousPlanId"
            LEFT JOIN admin."SubscriptionPlans" nsp ON nsp.id = sc."newPlanId"
            LEFT JOIN admin."BillingInvoices" bi ON bi.id = sc."billingInvoiceId"
            ${whereClause}
        `;

        // Count total
        const countResult = await DB.excu.query(
            `SELECT COUNT(*) AS total ${baseQuery}`,
            params, "admin"
        );
        const total = parseInt(countResult.rows[0]?.total || '0');

        // Fetch rows
        const rowsResult = await DB.excu.query(
            `SELECT
                sc.id,
                sc."subscriptionId",
                sc."subscriptionType",
                sc."changeType",
                sc."effectiveDate",
                sc."previousQuantity",
                sc."newQuantity",
                sc."proratedAmount",
                sc.notes,
                sc."performedBy",
                sc."createdAt",
                c.id AS "companyId",
                c.name AS "companyName",
                b.id AS "branchId",
                b.name AS "branchName",
                sf.id AS "featureId",
                sf.name AS "featureName",
                sf.slug AS "featureSlug",
                psp.name AS "previousPlanName",
                nsp.name AS "newPlanName",
                bi.id AS "billingInvoiceId",
                bi."invoiceNumber" AS "billingInvoiceNumber"
             ${baseQuery}
             ORDER BY sc."createdAt" DESC
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
    // REVENUE / ANALYTICS
    // ══════════════════════════════════════════════════════════════════

    /** Calculate Monthly Recurring Revenue (MRR) */
    public static async calculateMRR() {
        const result = await DB.excu.query(
            `SELECT
                COALESCE(SUM(
                    CASE WHEN cs."billingCycle" = 'yearly' THEN cs."basePrice" / 12
                         ELSE cs."basePrice"
                    END
                ), 0) +
                COALESCE((SELECT SUM(
                    CASE WHEN bs."billingCycle" = 'yearly' THEN bs."basePrice" / 12
                         ELSE bs."basePrice"
                    END
                ) FROM admin."BranchSubscriptions" bs WHERE bs.status = 'active'), 0)
                AS mrr
             FROM admin."CompanySubscriptions" cs
             WHERE cs.status = 'active'`,
            [], "admin"
        );
        const mrr = parseFloat(result.rows[0]?.mrr || '0');
        return { mrr, arr: mrr * 12 };
    }

    /** Get subscriptions expiring soon */
    public static async getExpiringSubscriptions(daysAhead: number = 30) {
        const companyResult = await DB.excu.query(
            `SELECT cs.*, c.name AS "companyName", 'company' AS "subscriptionType"
             FROM admin."CompanySubscriptions" cs
             JOIN "Companies" c ON c.id = cs."companyId"
             WHERE cs.status = 'active' AND cs."endDate" <= CURRENT_DATE + $1
             ORDER BY cs."endDate"`,
            [daysAhead], "admin"
        );

        const branchResult = await DB.excu.query(
            `SELECT bs.*, b.name AS "branchName", c.name AS "companyName", 'branch' AS "subscriptionType"
             FROM admin."BranchSubscriptions" bs
             JOIN "Branches" b ON b.id = bs."branchId"
             JOIN "Companies" c ON c.id = bs."companyId"
             WHERE bs.status = 'active' AND bs."endDate" <= CURRENT_DATE + $1
             ORDER BY bs."endDate"`,
            [daysAhead], "admin"
        );

        return { company: companyResult.rows, branch: branchResult.rows };
    }

    /** Get overdue invoices */
    public static async getOverdueInvoices() {
        const result = await DB.excu.query(
            `SELECT bi.*, c.name AS "companyName"
             FROM admin."BillingInvoices" bi
             JOIN "Companies" c ON c.id = bi."companyId"
             WHERE bi.status IN ('issued', 'partially_paid') AND bi."dueDate" < CURRENT_DATE
             ORDER BY bi."dueDate"`,
            [], "admin"
        );
        return result.rows;
    }
}
