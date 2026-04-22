import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { Company } from "@src/models/admin/company";
import { SalesTargetBranches } from "@src/models/account/salesTarget";

export class salesTargetRepo {

    public static async getSalesTargetList(companyId: string, data: any) {
        try {
            const noOfBranches = ((await BranchesRepo.getBranchList(null, companyId)).data).length
            const searchTerm = data.searchTerm ? `%${data.searchTerm.toLowerCase().trim()}%` : null;
            const period = data.filter?.period ?? null
            const sortTerm = data.sortBy && data.sortBy.sortValue === "totalSalesTarget" ? '"totalSalesTarget"' : '"createdAt"';
            const year = data.filter?.year
            let orderByQuery = " ORDER BY " + sortTerm + " DESC "

            let offset = 0
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query = {
                text: `SELECT *, count(*) OVER() AS total_count 
                    FROM "SalesTargets"
                    WHERE "companyId" = $1
                    AND ($2::text IS NULL OR lower(trim("period"::text)) ILIKE $2::text)
                    AND ($3::target_period IS NULL OR "period" = $3 )
                    AND ($4::text IS NULL OR EXTRACT(YEAR FROM  "dateFrom")::text = $4)
                    ${orderByQuery} 
                    LIMIT $5
                    OFFSET $6`,
                values: [companyId, searchTerm, period, year, limit, offset]
            }

            const result = await DB.excu.query(query.text, query.values)
            let count = result.rows && result.rows.length > 0 ? Number(result.rows[0].total_count) : 0
            let pageCount = Math.ceil(count / limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (result.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const rows = result.rows.map(row => ({
                ...row,
                dateFrom: this.formatDate(row.dateFrom),
                dateTo: this.formatDate(row.dateTo),
            }));

            const resData = {
                list: rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex,
                noOfBranches:noOfBranches
            }

            return new ResponseData(true, "", resData);
        } catch (error: any) {
            throw new Error(error);
        }
    }

    public static async getSalesAgg(companyId: string, dateFrom: string, dateTo: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const branches = (await BranchesRepo.getBranchList(client, companyId)).data

            const branchIds = branches.map((item: any) => item.id);

            const params = [[companyId], branchIds, dateFrom, dateTo];

            const query = {
                text: `
                    WITH "baseBranches" AS (
                        SELECT 
                            b.id AS "branchId",
                            b."companyId",
                            COALESCE(b.name, 'Others') AS "branchName",
                            COALESCE(c.name, 'Others') AS "companyName"
                        FROM "Branches" b
                        INNER JOIN "Companies" c ON c.id = b."companyId"
                        WHERE ($1::uuid[] IS NULL OR b."companyId" = ANY($1::uuid[]))
                        AND ($2::uuid[] IS NULL OR b.id = ANY($2::uuid[]))
                    ),

                    "lines" AS (
                    SELECT
                        CASE WHEN "InvoiceLines"."isInclusiveTax" = TRUE
                            THEN (COALESCE("InvoiceLines"."subTotal",0) - COALESCE("InvoiceLines"."taxTotal",0))
                            ELSE COALESCE("InvoiceLines"."subTotal",0)
                        END AS "sales",
                        "InvoiceLines"."taxTotal",
                        "InvoiceLines"."discountTotal",
                        "InvoiceLines"."total",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."companyId",
                        "InvoiceLines"."createdAt"
                    FROM "InvoiceLines"
                    WHERE ($1::uuid[] IS NULL OR "InvoiceLines"."companyId" = ANY($1::uuid[]))
                        AND ($2::uuid[] IS NULL OR "InvoiceLines"."branchId" = ANY($2::uuid[]))
                        AND ("InvoiceLines"."createdAt" >= $3 AND "InvoiceLines"."createdAt" < $4)
                    ),

                    "invoiceData" AS (
                        SELECT
                            "Companies".id  AS "companyId",
                            "Branches".id   AS "branchId",
                            SUM("lines"."total")      AS "total",
                            SUM("lines"."taxTotal")   AS "taxTotal",
                            SUM(COALESCE("lines"."discountTotal"::text::numeric, 0))
                            + SUM(COALESCE("Invoices"."discountTotal"::text::numeric, 0)) AS "discountTotal",
                            SUM("lines"."sales")      AS "sales",
                            COUNT(DISTINCT CASE
                            WHEN ("lines"."createdAt"::date <> "Invoices"."createdAt"::date)
                                THEN "Invoices".id
                            END) AS "editedInvoices",
                            COUNT(DISTINCT CASE
                            WHEN ("lines"."createdAt"::date = "Invoices"."createdAt"::date)
                                THEN "Invoices".id
                            END) AS "newInvoices",
                            COUNT(DISTINCT "Invoices".id) AS "numberOfInvoices"
                        FROM "lines"
                        INNER JOIN "Invoices"
                            ON "Invoices".id = "lines"."invoiceId"
                        AND "Invoices"."status" <> 'Draft'
                        INNER JOIN "Branches"
                            ON "Branches".id = "lines"."branchId"
                        INNER JOIN "Companies"
                            ON "Companies".id = "lines"."companyId"
                        GROUP BY
                            "Companies".id,
                            "Branches".id
                    ),
                    "creditNoteLines" AS (
                    SELECT
                        CASE WHEN "CreditNoteLines"."isInclusiveTax" = TRUE
                        THEN (COALESCE("CreditNoteLines"."subTotal",0) - COALESCE("CreditNoteLines"."taxTotal",0))
                        ELSE COALESCE("CreditNoteLines"."subTotal",0)
                        END AS "sales",
                        "CreditNoteLines"."taxTotal",
                        "CreditNoteLines"."discountTotal",
                        "CreditNoteLines"."total",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."companyId",
                        "CreditNoteLines"."createdAt"
                    FROM "CreditNoteLines"
                    WHERE ($1::uuid[] IS NULL OR "CreditNoteLines"."companyId" = ANY($1::uuid[]))
                        AND ($2::uuid[] IS NULL OR "CreditNoteLines"."branchId" = ANY($2::uuid[]))
                        AND ("CreditNoteLines"."createdAt" >= $3 AND "CreditNoteLines"."createdAt" < $4)
                    ),

                    "creditNoteData" AS (
                    SELECT
                        "Companies".id AS "companyId",
                        "Branches".id AS "branchId",
                        SUM("creditNoteLines"."total") AS "totalReturn"
                    FROM "creditNoteLines"
                    INNER JOIN "Branches" ON "Branches".id = "creditNoteLines"."branchId"
                    INNER JOIN "Companies" ON "Companies".id = "creditNoteLines"."companyId"
                    GROUP BY "Companies".id, "Branches".id
                    )

                    SELECT
                    b."companyId",
                    b."companyName",
                    b."branchId",
                    b."branchName",
                    COALESCE(i."sales",0)::float AS "sales",
                    COALESCE(i."discountTotal",0)::float AS "discountTotal",
                    COALESCE(i."taxTotal",0)::float AS "taxTotal",
                    COALESCE(i."total",0)::float AS "total",
                    COALESCE(c."totalReturn",0)::float AS "totalReturn",
                    (COALESCE(i."total",0) - COALESCE(c."totalReturn",0))::float AS "netSales",
                    COALESCE(i."editedInvoices",0)::int AS "editedInvoices",
                    COALESCE(i."newInvoices",0)::int AS "newInvoices",
                    COALESCE(i."numberOfInvoices",0)::int AS "numberOfInvoices"
                   
                    FROM "baseBranches" b
                    LEFT JOIN "invoiceData" i ON i."branchId" = b."branchId" AND i."companyId" = b."companyId"
                    LEFT JOIN "creditNoteData" c ON c."branchId" = b."branchId" AND c."companyId" = b."companyId"
                    ORDER BY b."companyName", b."branchName";`,
                values: params,
            };

            const r = await client.query(query.text, query.values);
            await client.query("COMMIT")

            return r.rows;
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release();
        }

    }

    public static async getTargetSales(id: string, company: Company, data: any) {
        try {
            const periodInfo = this.getPeriodDates(data.period, data);
            const { startDate, endDate, diffDays, currentToday } = periodInfo;

            let target

            if (!id) {

                const prev = this.getPreviousPeriod(data.period, data);

                target = {
                    period: data.period,
                    companyId: company.id,
                    dateFrom: startDate,
                    dateTo: endDate,
                    workingDays: this.daysBetween(startDate, endDate) + 1,
                    totalSalesTarget: 0,
                    netSalesTarget: 0,
                    prevDateFrom: prev.prevStart,
                    prevDateTo: prev.prevEnd,
                    prevWorkingDays: this.daysBetween(prev.prevStart, prev.prevEnd) + 1
                }
            }
            else {
                target = await this.getSalesTargetById(id)

                const { prevStart, prevEnd } = this.getPreviousPeriod(
                    target.period,
                    data
                );

                target.prevWorkingDays = this.daysBetween(prevStart, prevEnd) + 1

                let prevTarget
                await DB.transaction(async (client: PoolClient) => {
                    const getPrevTarget = await client.query(`SELECT * FROM "SalesTargets" WHERE "dateFrom"=$1 AND "dateTo"=$2`, [prevStart, prevEnd])

                    prevTarget = getPrevTarget && getPrevTarget.rows[0] ? Number(getPrevTarget.rows[0].totalSalesTarget) : null
                })

                target.prevDateFrom = prevStart;
                target.prevDateTo = prevEnd;
                target.prevTotalSalesTarget = prevTarget
            }

            const agg = await this.getSalesAgg(target.companyId, target.dateFrom, target.dateTo);
            const aggPrev = await this.getSalesAgg(target.companyId, target.prevDateFrom, target.prevDateTo);

            const daysTotal = Number(target.workingDays || 0);
            const prevDaysTotal = Number(target.prevWorkingDays || 0);
            const daysPassed = diffDays
            const daysRemaining = Math.max(0, daysTotal - daysPassed);

            const totalTarget = Number(target.totalSalesTarget);
            const netTarget = Number(target.netSalesTarget);
            const prevTotalSalesTarget = target.prevTotalSalesTarget

            let totalActual = 0;
            let netActual = 0;
            let orderCount = 0
            let total = 0

            for (const item of agg) {
                totalActual += Number(item.sales || 0);
                netActual += Number(item.netSales || 0);
                orderCount += Number(item.numberOfInvoices);
                total += Number(item.total)
            }

            let prevTotalActual = 0;
            let prevNetActual = 0;
            let prevOrderCount = 0

            for (const item of aggPrev) {
                prevTotalActual += Number(item.sales || 0);
                prevNetActual += Number(item.netSales || 0);
                prevOrderCount += Number(item.numberOfInvoices);
            }

            const totalAch = totalTarget > 0 ? (totalActual / totalTarget) * 100 : null;
            const netAch = netTarget > 0 ? (netActual / netTarget) * 100 : null;

            // Simple forecast: current run rate * total working days
            const currentRunRate = daysPassed > 0 ? totalActual / daysPassed : 0;
            const prevRunRate = daysPassed > 0 ? prevTotalActual / daysPassed : 0;

            const forecastTotal = currentRunRate * daysTotal;
            const prevForecastTotal = prevRunRate * prevDaysTotal;

            // Required run rate to hit target for remaining days
            const requiredRunRate = daysRemaining > 0 ? Math.max(0, (totalTarget - totalActual) / daysRemaining) : 0;

            return new ResponseData(true, "", {
                period: target.period ?? 'monthly',
                dateFrom: this.formatDate(target.dateFrom),
                dateTo: this.formatDate(target.dateTo),
                currency: target.currency ?? company.currencySymbol,
                prevDateFrom: target.prevDateFrom,
                prevDateTo: target.prevDateTo,

                totals: {
                    orderCount: orderCount,
                    totalSales: totalActual,
                    netSales: netActual,
                    totalOrder: total,
                    prevOrderCount: prevOrderCount,
                    prevTotalActual: prevTotalActual,
                    prevNetActual: prevNetActual
                },

                targets: {
                    totalSalesTarget: totalTarget,
                    netSalesTarget: netTarget,
                    prevTotalSalesTarget: prevTotalSalesTarget
                },

                achievement: {
                    totalSalesPct: totalAch,
                    netSalesPct: netAch,
                },

                runRate: {
                    daysPassed,
                    workingDays: daysTotal,
                    daysRemaining,
                    currentRunRate,
                    requiredRunRate,
                    prevWorkingDays: prevDaysTotal,
                    today: currentToday,
                    avg: currentToday ? netActual / currentToday : netActual / daysPassed
                },

                forecast: {
                    forecastTotal,
                    prevForecastTotal: prevForecastTotal,
                    forecastPct: totalTarget > 0 ? (forecastTotal / totalTarget) * 100 : null,
                    status: totalTarget > 0 ? this.statusFromAchievement((forecastTotal / totalTarget) * 100) : "NoTarget",
                },
            })

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getBranchSalesTarget(id: string, company: Company, data: any) {
        try {
            const periodInfo = this.getPeriodDates(data.period, data);
            const { startDate, endDate, diffDays, currentToday } = periodInfo;

            let target
            let branchTargets: any
            if (!id) {
                target = {
                    period: data.period,
                    companyId: company.id,
                    dateFrom: startDate,
                    dateTo: endDate,
                    workingDays: this.daysBetween(startDate, endDate),
                    totalSalesTarget: 0,
                }
            }
            else {
                target = await this.getSalesTargetById(id)

                const branchTargetsRes = await DB.excu.query(
                    `SELECT "branchId", "totalSalesTarget"
                    FROM "SalesTargetBranches"
                    WHERE "salesTargetId" = $1`,
                    [id]
                );
                branchTargets = branchTargetsRes.rows;
            }

            const agg = await this.getSalesAgg(target.companyId, target.dateFrom, target.dateTo);

            const daysPassed = diffDays
            const daysTotal = this.daysBetween(startDate, endDate) + 1;
            const daysRemaining = Math.max(0, daysTotal - daysPassed) - 1;

            const rows = agg.map(x => {
                const netSales = Number(x.netSales);
                const targetAmt = branchTargets && Number(branchTargets.find((bt: any) => bt.branchId === x.branchId)?.totalSalesTarget || 0);
                const ach = targetAmt && targetAmt > 0 ? (netSales / targetAmt) * 100 : null;

                const runRate = daysPassed > 0 ? netSales / daysPassed : 0;
                const forecast = runRate * daysTotal;
                const dailyNeeded = daysRemaining > 0
                    ? Math.max(0, (targetAmt - netSales) / daysRemaining)
                    : 0;

                return {
                    ...x,
                    achievementPct: ach ?? null,
                    forecast,
                    targetAmt: targetAmt ?? null,
                    status: targetAmt > 0 ? this.statusFromAchievement((forecast / targetAmt) * 100) : "NoTarget",
                    dailyRateNeeded: dailyNeeded,
                };
            });

            return new ResponseData(true, "", {
                currency: target.currency ?? company.currencySymbol,
                daysPassed,
                workingDays: daysTotal,
                daysRemaining,
                today: currentToday,
                rows,
            })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getSalesTargetById(id: string) {
        const client = await DB.excu.client();
        try {
            let target
            await client.query("BEGIN")
            const t = await client.query(`SELECT * FROM "SalesTargets" WHERE id=$1`, [id]);
            if (!t.rows.length) return;
            target = t.rows[0];
            await client.query("COMMIT")
            return target

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error);
        }finally{
            client.release()
        }

    }

    public static async getDailySalesTarget(id: string, company: Company, data: any) {
        try {
            const agg = (await this.getTargetSales(id, company, data))?.data;
            if (!agg) return;

            const requiredDaily = agg.runRate.daysRemaining > 0 ? Math.max(0, (agg.targets.totalSalesTarget - agg.totals.totalSales) / agg.runRate.daysRemaining) : 0;

            const currentResult = await salesTargetRepo.getDaily(company, agg.dateFrom, agg.dateTo);

            const dayLabals = currentResult.rows.map((r: any) => {
                const d = new Date(r.day);
                return d.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                });
            })

            const prevResult = await salesTargetRepo.getDaily(company, agg.prevDateFrom, agg.prevDateTo);

            const prevDayLabals = prevResult.rows.map((r: any) => {
                const d = new Date(r.day);
                return d.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                });
            })

            return new ResponseData(true, "", {
                labels: dayLabals,
                actual: currentResult.rows.map((r: any) => Number(r.total)),
                requiredDaily,
                currency: agg.currency,
                prevDetails: {
                    prevDayLabals: prevDayLabals,
                    prevActual: prevResult.rows.map((r: any) => Number(r.total))
                }
            })

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getDaily(company: Company, dateFrom: any, dateTo: any) {
        try {
            const query = {
                text: `SELECT (il."createdAt"::date) AS day,
                            COALESCE(SUM(CASE 
                                WHEN il."isInclusiveTax" = TRUE 
                                    THEN COALESCE(il."subTotal", 0) - COALESCE(il."taxTotal", 0)
                                ELSE COALESCE(il."subTotal", 0)
                                    END
                                ), 0)::numeric AS total
                            FROM "InvoiceLines" il
                            INNER JOIN "Invoices" i ON i.id = il."invoiceId"
                            WHERE il."companyId" = $1
                            AND il."createdAt" >= $2::date
                            AND il."createdAt" <= $3::date
                            AND i."status" <> 'Draft'
                            GROUP BY 1
                            ORDER BY 1`,
                values: [company.id, this.formatDate(new Date(dateFrom)), this.formatDate(new Date(dateTo))]
            };
            const result = await DB.excu.query(query.text, query.values);
            return result;

        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async saveSalesTarget(companyId: string, data: any) {
        try {
            let resData;
            await DB.transaction(async (client: PoolClient) => {
                const q = `
                            INSERT INTO "SalesTargets"
                                ("companyId", "period", "dateFrom", "dateTo", "workingDays", "totalSalesTarget", "netSalesTarget", "currency")
                            VALUES
                                ($1, $2::target_period, $3::date, $4::date, $5, $6, $7, $8)
                            ON CONFLICT ("companyId", "period", "dateFrom", "dateTo")
                            DO UPDATE SET
                                "workingDays" = EXCLUDED."workingDays",
                                "totalSalesTarget" = EXCLUDED."totalSalesTarget",
                                "netSalesTarget" = EXCLUDED."netSalesTarget",
                                "currency" = EXCLUDED."currency",
                                "updatedAt" = now()
                            RETURNING *;
    `;
                const r = await client.query(q, [
                    companyId, data.period, data.dateFrom, data.dateTo, data.workingDays, data.totalSalesTarget, data.netSalesTarget, data.currency,
                ]);
                resData = r.rows[0]
                let id = r.rows[0].id;
                for (let index = 0; index < data.branches.length; index++) {
                    const element = data.branches[index];
                    element.salesTargetId = id;
                    this.saveBranchSalesTarget(client, element)
                }
            })

            if (data.forward) {
                const numberOfPeriod: number = data.forward.count;
                const mode: 'overwrite' | 'skip' = data.forward.mode;

                // Generate next N periods based on dateFrom
                const nextPeriods = this.getNextPeriods(data.period, data.dateFrom, numberOfPeriod);

                for (const periodRange of nextPeriods) {
                    // Check if a SalesTarget already exists for this period range
                    const existingResult = await DB.exec.query(
                        `SELECT id FROM "SalesTargets"
                     WHERE "companyId" = $1 AND "period" = $2::target_period
                     AND "dateFrom" = $3::date AND "dateTo" = $4::date`,
                        [companyId, data.period, periodRange.dateFrom, periodRange.dateTo]
                    );

                    const existingId: string | null = existingResult.rows[0]?.id ?? null;

                    if (existingId) {
                        // Record exists
                        if (mode === 'overwrite') {
                            // Update the SalesTarget
                            await DB.exec.query(
                                `UPDATE "SalesTargets"
                             SET "totalSalesTarget" = $2,
                                 "netSalesTarget" = $3,
                                 "updatedAt" = now()
                             WHERE id = $1`,
                                [existingId, data.totalSalesTarget, data.netSalesTarget]
                            );

                            // Update branches
                            await DB.transaction(async (client: PoolClient) => {
                                for (const branch of data.branches) {
                                    await this.saveBranchSalesTarget(client, {
                                        ...branch,
                                        salesTargetId: existingId,
                                    });
                                }
                            });

                        } else if (mode === 'skip') {
                            // Skip: do nothing for this period
                            continue;
                        }
                    } else {
                        // No existing record → insert new one
                        await DB.transaction(async (client: PoolClient) => {
                            const insertResult = await client.query(
                                `INSERT INTO "SalesTargets"
                                ("companyId", "period", "dateFrom", "dateTo", "workingDays", "totalSalesTarget", "netSalesTarget", "currency")
                             VALUES ($1, $2::target_period, $3::date, $4::date, $5, $6, $7, $8)
                             RETURNING *;`,
                                [
                                    companyId, data.period,
                                    periodRange.dateFrom, periodRange.dateTo,
                                    data.workingDays, data.totalSalesTarget,
                                    data.netSalesTarget, data.currency,
                                ]
                            );

                            const newId = insertResult.rows[0].id;

                            for (const branch of data.branches) {
                                await this.saveBranchSalesTarget(client, {
                                    ...branch,
                                    salesTargetId: newId,
                                });
                            }
                        });
                    }
                }
            }



            return new ResponseData(true, "", resData)

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async saveBranchSalesTarget(client: PoolClient, element: SalesTargetBranches) {
        try {
            await client.query(
                `
                    INSERT INTO "SalesTargetBranches"
                    ("salesTargetId", "branchId", "totalSalesTarget", "netSalesTarget")
                    VALUES ($1, $2, $3::numeric, $4::numeric)
                    ON CONFLICT ("salesTargetId", "branchId")
                    DO UPDATE SET
                    "totalSalesTarget" = EXCLUDED."totalSalesTarget",
                    "netSalesTarget" = EXCLUDED."netSalesTarget",
                    "updatedAt" = now();
                `,
                [element.salesTargetId, element.branchId, element.totalSalesTarget ?? 0, element.netSalesTarget ?? 0]
            );

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static getNextPeriods(period: string, dateFrom: string, count: number): { dateFrom: string; dateTo: string }[] {
        const periods: { dateFrom: string; dateTo: string }[] = [];
        let current = new Date(dateFrom);

        for (let i = 0; i < count; i++) {
            let nextFrom: Date;
            let nextTo: Date;

            if (period === 'monthly') {
                // Move to next month
                nextFrom = new Date(current.getFullYear(), current.getMonth() + 1 + i, 1);
                nextTo = new Date(current.getFullYear(), current.getMonth() + 2 + i, 0); // Last day of that month
            } else if (period === 'yearly') {
                nextFrom = new Date(current.getFullYear() + 1 + i, current.getMonth(), current.getDate());
                nextTo = new Date(current.getFullYear() + 2 + i, current.getMonth(), current.getDate() - 1);
            } else if (period === 'quarterly') {
                nextFrom = new Date(current.getFullYear(), current.getMonth() + (i + 1) * 3, 1);
                nextTo = new Date(current.getFullYear(), current.getMonth() + (i + 2) * 3, 0);
            } else {
                break;
            }

            //nextFrom = this.formatDate(nextFrom) 
            //nextTo = this.formatDate(nextTo)
            const formattedDateFrom = this.formatDate(nextFrom);
            const formattedDateTo = this.formatDate(nextTo);
            if (!formattedDateFrom || !formattedDateTo) {
                throw new Error('Invalid date');
            }

            periods.push({
                dateFrom: formattedDateFrom,
                dateTo: formattedDateTo,
            });
        }

        return periods;
    }


    //Helpers
    public static daysBetween(from: any, to: any): number {
        const diff = new Date(to).getTime() - new Date(from).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    public static formatDate(date: Date | string | null | undefined): string | null {
        if (!date) return null;

        // If already in YYYY-MM-DD format → return as is
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
        }

        // Convert to Date object
        const d = new Date(date);

        // Prevent invalid date
        if (isNaN(d.getTime())) return null;

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        return `${y}-${m}-${day}`;
    }

    public static statusFromAchievement(achPct: number) {
        if (achPct >= 100) return "Ahead";
        if (achPct >= 80) return "OnTrack";
        if (achPct > 0) return "Behind";
        return "Critical";
    }

    public static getPeriodDates(period: 'monthly' | 'quarterly' | 'yearly', data?: any) {
        const today = new Date();
        let startDate: Date;
        let endDate: Date;
        let currentToday

        switch (period) {
            case 'monthly':
                startDate = new Date(data.year, data.month - 1, 1);
                endDate = new Date(data.year, data.month, 0);
                break;

            case 'quarterly':
                const startMonth = (data.quarter - 1) * 3;
                startDate = new Date(data.year, startMonth, 1); // first day of quarter
                endDate = new Date(data.year, startMonth + 3, 0); // last day of quarter
                break;

            case 'yearly':
                startDate = new Date(data.year, 0, 1); // Jan 1st
                endDate = new Date(data.year, 11, 31); // Dec 31st
                break;

            default:
                throw new Error('Invalid period');
        }

        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        let diffDays = 0;

        // 🔥 CASE 1: Future period → not started
        if (today < startDate) {
            diffDays = 0;
        }
        // 🔥 CASE 2: Past period → fully completed
        else if (today > endDate) {
            diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
        }
        // 🔥 CASE 3: Current period → partial progress
        else {
            diffDays = Math.floor((today.getTime() - startDate.getTime()) / MS_PER_DAY);
            currentToday = diffDays + 1
        }

        return {
            startDate: this.formatDate(startDate),
            endDate: this.formatDate(endDate),
            diffDays,
            currentToday
        };
    }

    public static getPreviousPeriod(period: 'monthly' | 'quarterly' | 'yearly', data: any) {
        let prevStart: Date;
        let prevEnd: Date;

        switch (period) {
            case 'monthly':
                // Move to previous month
                prevStart = new Date(data.year, data.month - 2, 1);
                prevEnd = new Date(data.year, data.month - 1, 0);
                break;

            case 'quarterly':
                // const currentQuarter = Math.floor(data.month / 3); // 0 → Q1, 1 → Q2, etc.
                let prevQuarter = data.quarter - 1;
                let year = data.year;

                if (prevQuarter < 1) {
                    prevQuarter = 4; // go to Q4 of previous year
                    year -= 1;
                }

                const startMonth = (prevQuarter - 1) * 3;
                prevStart = new Date(year, startMonth, 1); // first day of previous quarter
                prevEnd = new Date(year, startMonth + 3, 0); // last day of previous quarter
                break;


            case 'yearly':
                prevStart = new Date(data.year - 1, 0, 1); // Jan 1
                prevEnd = new Date(data.year - 1, 11, 31); // Dec 31
                break;

            default:
                throw new Error('Invalid period');
        }

        return {
            prevStart: this.formatDate(prevStart),
            prevEnd: this.formatDate(prevEnd)
        };
    }

}