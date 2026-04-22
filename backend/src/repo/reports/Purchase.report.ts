import { ValidationException } from "@src/utilts/Exception";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company"
import { TimeHelper } from "@src/utilts/timeHelper";


import moment from 'moment'
import { DataColumn, ReportData } from "@src/utilts/xlsxGenerator";
import { SupplierRepo } from "../app/accounts/supplier.repo";

export class purchaseReport {

    public static async purchaseBySupplier(data: any, company: Company, brancheList: []) {
        try {
            const filter = data?.filter ?? {};
            const companyId = company.id;

            // ---------------- mode (whitelist) ----------------
            const mode: 'actual' | 'planned' | 'forecast' =
                (filter.mode === 'actual' || filter.mode === 'planned' || filter.mode === 'forecast')
                    ? filter.mode
                    : 'actual';

            // ---------------- dynamic labels (whitelist, not user input) ----------------
            const countAlias =
                mode === 'actual'
                    ? 'Number Of Billings'
                    : mode === 'planned'
                        ? 'Number Of Purchase Orders'
                        : 'Number Of Documents';

            const amountAlias =
                mode === 'actual'
                    ? 'Billing Amount'
                    : mode === 'planned'
                        ? 'Planned Amount'
                        : 'Forecast Amount';

            const creditAlias = 'Supplier Credit Amount';

            const totalAlias =
                mode === 'actual'
                    ? 'Total'
                    : mode === 'planned'
                        ? 'Total Planned'
                        : 'Total Forecast';

            // ---------------- branches ----------------
            let branches = filter?.branches ?? brancheList;
            if (!Array.isArray(branches) || branches.length === 0) branches = null;

            // ---------------- time range ----------------
            const closingTime = "00:00:00";
            const fromDate = moment(new Date(filter?.fromDate ?? null));
            const toDate = filter?.toDate ? moment(new Date(filter.toDate)) : moment(new Date());
            const { from, to } = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, company.timeOffset);

            // ---------------- paging ----------------
            const page = data?.page ?? filter?.page ?? 1;
            const limit = data?.limit ?? filter?.limit ?? 50;
            const offset = (page - 1) * limit;

            // ---------------- SQL (raw measures only; NO mode logic here) ----------------
            // NOTE:
            // - poRemaining is computed using billed-from-PO. This query assumes Billings.purchaseOrderId exists.
            // - If your real link is BillingLines.poLineId, tell me the column name and I’ll swap the join.
            const sql = `
WITH "values" AS (
  SELECT
    $1::uuid      AS "companyId",
    $2::uuid[]    AS "branches",
    $3::timestamp AS "fromDate",
    $4::timestamp AS "toDate"
),

/* ---- actual: bills lines ---- */
"bill" AS (
  SELECT
    invo."supplierId" AS "supplierId",
    COUNT(DISTINCT IL."billingId")::numeric AS "billingCount",
    SUM(
      CASE WHEN IL."isInclusiveTax" = false
        THEN COALESCE(IL."subTotal",0)::numeric + COALESCE(IL."taxTotal",0)::numeric
        ELSE COALESCE(IL."subTotal",0)::numeric
      END
    )::numeric AS "billingAmount"
  FROM "BillingLines" IL
  JOIN "values" v ON true
  JOIN "Billings" invo ON invo.id = IL."billingId"
  JOIN "Branches" b ON b.id = invo."branchId"
  WHERE b."companyId" = v."companyId"
    AND invo."status" <> 'Draft'
    AND (array_length(v."branches",1) IS NULL OR b.id = ANY(v."branches"))
    AND IL."createdAt" >= v."fromDate" AND IL."createdAt" < v."toDate"
  GROUP BY invo."supplierId"
),

/* ---- actual: supplier credits lines ---- */
"credit" AS (
  SELECT
    invo."supplierId" AS "supplierId",
    SUM(
      CASE WHEN CNL."isInclusiveTax" = false
        THEN COALESCE(CNL."subTotal",0)::numeric + COALESCE(CNL."taxTotal",0)::numeric
        ELSE COALESCE(CNL."subTotal",0)::numeric
      END
    )::numeric AS "supplierCreditAmount"
  FROM "SupplierCreditLines" CNL
  JOIN "values" v ON true
  JOIN "SupplierCredits" CN ON CN.id = CNL."supplierCreditId"
  LEFT JOIN "Billings" invo ON invo.id = CN."billingId"
  JOIN "Branches" b ON b.id = CN."branchId"
  WHERE b."companyId" = v."companyId"
    AND (array_length(v."branches",1) IS NULL OR b.id = ANY(v."branches"))
    AND CNL."createdAt" >= v."fromDate" AND CNL."createdAt" < v."toDate"
  GROUP BY invo."supplierId"
),

"actual" AS (
  SELECT
    COALESCE(b."supplierId", c."supplierId") AS "supplierId",
    COALESCE(b."billingCount", 0)::numeric AS "billingCount",
    COALESCE(b."billingAmount", 0)::numeric AS "billingAmount",
    COALESCE(c."supplierCreditAmount", 0)::numeric AS "supplierCreditAmount",
    (COALESCE(b."billingAmount", 0)::numeric - COALESCE(c."supplierCreditAmount", 0)::numeric)::numeric AS "actualTotal"
  FROM "bill" b
  FULL JOIN "credit" c ON c."supplierId" = b."supplierId"
),

/* ---- planned: PO totals ---- */
"poTotals" AS (
  SELECT
    PO."supplierId" AS "supplierId",
    COUNT(DISTINCT PO.id)::numeric AS "poCount",
    SUM(
      CASE WHEN POL."isInclusiveTax" = false
        THEN COALESCE(POL."subTotal",0)::numeric + COALESCE(POL."taxTotal",0)::numeric
        ELSE COALESCE(POL."subTotal",0)::numeric
      END
    )::numeric AS "poAmount"
  FROM "PurchaseOrderLines" POL
  JOIN "values" v ON true
  JOIN "PurchaseOrders" PO ON PO.id = POL."purchaseOrderId"
  JOIN "Branches" b ON b.id = PO."branchId"
  WHERE b."companyId" = v."companyId"
    AND (array_length(v."branches",1) IS NULL OR b.id = ANY(v."branches"))
    AND PO."createdAt" >= v."fromDate" AND PO."createdAt" < v."toDate"
  GROUP BY PO."supplierId"
),

/* ---- billed-from-PO (for remaining) ---- */
"poBilled" AS (
  SELECT
    PO."supplierId" AS "supplierId",
    SUM(
      CASE WHEN IL."isInclusiveTax" = false
        THEN COALESCE(IL."subTotal",0)::numeric + COALESCE(IL."taxTotal",0)::numeric
        ELSE COALESCE(IL."subTotal",0)::numeric
      END
    )::numeric AS "billedFromPO"
  FROM "BillingLines" IL
  JOIN "values" v ON true
  JOIN "Billings" invo ON invo.id = IL."billingId"
  JOIN "Branches" b ON b.id = invo."branchId"
  JOIN "PurchaseOrders" PO ON PO.id = invo."purchaseOrderId"
  WHERE b."companyId" = v."companyId"
    AND invo."status" <> 'Draft'
    AND (array_length(v."branches",1) IS NULL OR b.id = ANY(v."branches"))
    AND IL."createdAt" >= v."fromDate" AND IL."createdAt" < v."toDate"
  GROUP BY PO."supplierId"
),

"planned" AS (
  SELECT
    pt."supplierId",
    pt."poCount",
    pt."poAmount",
    COALESCE(pb."billedFromPO", 0)::numeric AS "billedFromPO",
    (pt."poAmount" - COALESCE(pb."billedFromPO", 0)::numeric)::numeric AS "poRemaining"
  FROM "poTotals" pt
  LEFT JOIN "poBilled" pb ON pb."supplierId" = pt."supplierId"
),

"u" AS (
  SELECT COALESCE(a."supplierId", p."supplierId") AS "supplierId"
  FROM "actual" a
  FULL JOIN "planned" p ON p."supplierId" = a."supplierId"
)

SELECT
  COUNT(*) OVER() AS "count",
  s.id AS "supplierId",
  (CASE WHEN s.id IS NOT NULL THEN COALESCE(NULLIF(s.name,''),'Supplier') ELSE 'Unknown' END) AS "supplierName",

  COALESCE(a."billingCount",0)::numeric AS "billingCount",
  COALESCE(a."billingAmount",0)::numeric AS "billingAmount",
  COALESCE(a."supplierCreditAmount",0)::numeric AS "supplierCreditAmount",
  COALESCE(a."actualTotal",0)::numeric AS "actualTotal",

  COALESCE(p."poCount",0)::numeric AS "poCount",
  COALESCE(p."poAmount",0)::numeric AS "poAmount",
  COALESCE(p."poRemaining",0)::numeric AS "poRemaining"

FROM "u"
LEFT JOIN "actual" a ON a."supplierId" = u."supplierId"
LEFT JOIN "planned" p ON p."supplierId" = u."supplierId"
LEFT JOIN "Suppliers" s ON s.id = u."supplierId"
`;

            const values = [companyId, branches, from, to];
            const paging = filter.export ? '' : ` LIMIT ${limit} OFFSET ${offset}`;
            const result = await DB.excu.query(sql + paging, values);
            const rows = result.rows ?? [];

            // ---------------- export ----------------
            // export gets raw measures + computed fields (with aliased keys) for easy Excel
            const compute = (r: any) => {
                const billingCount = Number(r.billingCount ?? 0);
                const billingAmount = Number(r.billingAmount ?? 0);
                const creditAmount = Number(r.supplierCreditAmount ?? 0);
                const actualTotal = Number(r.actualTotal ?? (billingAmount - creditAmount));

                const poCount = Number(r.poCount ?? 0);
                const poAmount = Number(r.poAmount ?? 0);
                const poRemaining = Number(r.poRemaining ?? poAmount);

                if (mode === 'actual') {
                    return { count: billingCount, amount: billingAmount, credit: creditAmount, total: actualTotal };
                }
                if (mode === 'planned') {
                    return { count: poCount, amount: poAmount, credit: 0, total: poAmount };
                }
                // forecast
                return {
                    count: billingCount + poCount,
                    amount: billingAmount + poRemaining,
                    credit: creditAmount,
                    total: actualTotal + poRemaining
                };
            };

            if (filter.export) {
                const exportRows = rows.map((r: any) => {
                    const x = compute(r);
                    return {
                        supplierId: r.supplierId,
                        supplierName: r.supplierName,
                        // dynamic alias keys:
                        [countAlias]: x.count,
                        [amountAlias]: x.amount,
                        [creditAlias]: x.credit,
                        [totalAlias]: x.total,
                        // keep raw measures too (optional, remove if you want cleaner export):
                        billingCount: Number(r.billingCount ?? 0),
                        billingAmount: Number(r.billingAmount ?? 0),
                        supplierCreditAmount: Number(r.supplierCreditAmount ?? 0),
                        actualTotal: Number(r.actualTotal ?? 0),
                        poCount: Number(r.poCount ?? 0),
                        poAmount: Number(r.poAmount ?? 0),
                        poRemaining: Number(r.poRemaining ?? 0),
                    };
                });

                // if your exporter expects ReportData, build it here:
                const report = new ReportData();
                report.filter = {
                    title: `Purchase By Supplier (${mode})`,
                    fromDate: filter.fromDate ?? null,
                    toDate: filter.toDate ?? new Date(),
                    branches,
                    mode,
                };
                report.records = exportRows;
                report.columns = [
                    { key: 'supplierName' },
                    { key: countAlias, properties: { hasTotal: true } },
                    { key: amountAlias, properties: { hasTotal: true, columnType: 'currency' } },
                    { key: creditAlias, properties: { hasTotal: true, columnType: 'currency' } },
                    { key: totalAlias, properties: { hasTotal: true, columnType: 'currency' } },
                ];
                report.fileName = `PurchaseBySupplier_${mode}`;
                return new ResponseData(true, "", report);
            }

            // ---------------- shape like your desired JSON ----------------
            const columns = [totalAlias];
            const subColumns = [countAlias, amountAlias, creditAlias, 'total'];

            const shapedRecords = rows.map((r: any) => {
                const x = compute(r);

                return {
                    supplierId: r.supplierId,
                    supplierName: r.supplierName,
                    columns,
                    summary: [
                        {
                            [totalAlias]: {
                                [countAlias]: x.count,
                                [amountAlias]: x.amount,
                                [creditAlias]: x.credit,
                                total: x.total,
                            }
                        }
                    ]
                };
            });

            const count = rows.length > 0 ? Number(rows[0].count) : 0;
            const pageCount = Math.ceil((count || 0) / limit);
            const startIndex = count === 0 ? 0 : offset + 1;
            const lastIndex = Math.min(offset + rows.length, count);

            return new ResponseData(true, "", {
                records: shapedRecords,
                columns,
                subColumns,
                count,
                pageCount,
                startIndex,
                lastIndex,
                mode
            });

        } catch (error: any) {
          
            throw new Error(error);
        }
    }

    public static async purchaseBySupplierId(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let supplierId = filter && filter.supplierId ? filter.supplierId : null;

            //if (!supplierId){throw new ValidationException('supplierId is required')}
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: ` with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid as "supplierId",
                            $3::uuid[] as "branches",
                            $4::timestamp as "fromDate",
                            $5::timestamp as "toDate"
                        )
                        ,"billingData" as(
                        select  bill."supplierId", 
                                bill."id" as "billingId",
                                bill."billingNumber",
                                sum(case when BL."isInclusiveTax" = false then ((COALESCE(BL."subTotal",0)::text::numeric) + (COALESCE(BL."taxTotal",0)::text::numeric)) else COALESCE(BL."subTotal",0)::text::numeric end) as "amount"
                        from "BillingLines" as BL
                        join "values" on true
                        inner join "Billings" as bill on bill.id = BL."billingId"
                        inner join "Branches" as branches on branches.id = bill."branchId"
                        where branches."companyId" = "values"."companyId"  
                        and bill."status" <> 'Draft' 
                        and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                        and (BL."createdAt" >= "values"."fromDate" and BL."createdAt" < "values"."toDate"  )
                        and (bill."supplierId" ="values"."supplierId" or (bill."supplierId" is null and "values"."supplierId" is null))
                        group by bill.id
                        )
                        select  count(*) over(), 
                                SUM(COALESCE("amount",0)::text::numeric) over() as "totalAmount", 
                                "billingData".* 
                        from "billingData"

                    `,
                values: [companyId, supplierId, branches, from, to]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}
                                                                            `

            const records = await DB.excu.query(query.text + limitQuery, query.values);
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { amount: t.totalAmount }
                resault = records.rows.map((e: any) => {
                    return {
                        supplierId: e.supplierId, billingId: e.billingId,
                        billingNumber: e.billingNumber, amount: e.amount
                    }
                })
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            const supplierName = await SupplierRepo.getSupplierName(supplierId)


            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Purchase By Supplier",
                    filterList: { supplierName: supplierName },
                    supplierName: supplierName,
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = resault
                report.columns = [{ key: 'billingNumber' },
                { key: 'amount', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'PurchaseBySupplier'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async purchaseByItem(data: any, company: Company, brancheList: []) {
        try {
            const filter = data?.filter ?? {};
            const companyId = company.id;

            // ---------------- mode (whitelist) ----------------
            const mode: 'actual' | 'planned' | 'forecast' =
                (filter.mode === 'actual' || filter.mode === 'planned' || filter.mode === 'forecast')
                    ? filter.mode
                    : 'actual';

            // ---------------- labels injected from code (NOT returned as columns) ----------------
            const qtyLabel =
                mode === 'planned' ? 'Ordered Qty'
                    : mode === 'forecast' ? 'Qty'
                        : 'Qty';

            const focLabel =
                mode === 'planned' ? 'FOC Items' // usually 0 for PO
                    : mode === 'forecast' ? 'FOC Items'
                        : 'FOC Items';

            const amountLabel =
                mode === 'actual' ? 'Total'
                    : mode === 'planned' ? 'Planned Amount'
                        : 'Forecast Amount';

            const avgLabel =
                mode === 'actual' ? 'Average Price'
                    : mode === 'planned' ? 'Average Planned Price'
                        : 'Average Forecast Price';

            // ---------------- branches ----------------
            let branches = filter?.branches ?? brancheList;
            if (!Array.isArray(branches) || branches.length === 0) branches = null;

            // ---------------- time range ----------------
            const closingTime = "00:00:00";
            const fromDate = moment(new Date(filter?.fromDate ?? null));
            const toDate = filter?.toDate ? moment(new Date(filter.toDate)) : moment(new Date());
            const { from, to } = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, company.timeOffset);

            // ---------------- compare / period ----------------
            const NoOfperiod = filter?.periodQty ?? null;
            const period = filter?.period ?? null;
            const compareType = String(filter?.compareType ?? 'none').toLowerCase(); // none | branch | period
            const compareKey = compareType === 'branch' || compareType === 'period' ? compareType : 'none';

            // ---------------- group by options (same behavior as your current) ----------------
            let groupId = ``;
            let groupSelectQuery = ``;
            let groupjoinQuery = ``;
            let groupByQuery = ``;
            const groupByColumn: any[] = [];

            if (filter?.groupBySupplier || filter?.groupBy === "Supplier") {
                groupId = `"supplierId",`;
                groupSelectQuery = `"Suppliers".id as "supplierId", "Suppliers".name as "supplierName",`;
                groupjoinQuery = `left join "Suppliers" ON "Suppliers".id = "records"."supplierId"`;
                groupByQuery = `"Suppliers".id ,`;
                groupByColumn.push({ key: "supplierName", properties: { groupBy: true } });
            }

            if (filter?.groupByCategory || filter?.groupBy === "Category") {
                groupSelectQuery = `"Categories".id as "categoryId", COALESCE("Categories".name, 'Other') as "categoryName",`;
                groupjoinQuery = `left join "Categories" ON "Categories".id = "Products"."categoryId"`;
                groupByQuery = `"Categories".id ,`;
                groupByColumn.push({ key: "categoryName", properties: { groupBy: true } });
            }

            groupByColumn.push({ key: 'productName' });

            // ---------------- subColumns selection (now dynamic labels) ----------------
            const DefaultSubColumns = [qtyLabel, focLabel, amountLabel, avgLabel];

            // allow UI to pass old names OR new names; normalize to labels
            const selectedSubColumns: string[] = Array.isArray(filter.subColumns) ? filter.subColumns : DefaultSubColumns;

            const normalizeSub = (c: string) => {
                const x = String(c);
                if (x === 'Qty') return qtyLabel;
                if (x === 'FOC Items') return focLabel;
                if (x === 'Total') return amountLabel;
                if (x === 'Average Price') return avgLabel;
                // if already a label (planned/forecast), keep it
                if (DefaultSubColumns.includes(x)) return x;
                return null;
            };

            const validSubColumns = selectedSubColumns.map(normalizeSub).filter(Boolean) as string[];
            const finalSubColumns = compareKey === 'none'
                ? DefaultSubColumns
                : (validSubColumns.length ? validSubColumns : DefaultSubColumns);

            // ---------------- SQL (raw measures only, NO mode logic here) ----------------
            // NOTE:
            // - planned uses PurchaseOrderLines + PurchaseOrders
            // - actual uses BillingLines + Billings
            // - forecast = (actual totals) + (PO remaining) in CODE (not SQL)
            // - PO billed link: assumes Billings.purchaseOrderId (same as supplier report)
            const sql = `
WITH "values" AS (
  SELECT
    $1::uuid AS "companyId",
    $2::uuid[] AS "branches",
    CASE
      WHEN (lower($5::text) = 'period' AND lower($6::text) = 'month') THEN $3::timestamp - interval '1 month' * $7::int
      WHEN (lower($5::text) = 'period' AND lower($6::text) = 'year')  THEN $3::timestamp - interval '1 year'  * $7::int
      ELSE $3::timestamp
    END AS "fromDate",
    $4::timestamp AS "toDate",
    lower($5)::text AS "compType",
    lower($6)::text AS "period"
),

/* -------- ACTUAL (Bills) -------- */
"billRec" AS (
  SELECT
    ${groupId} "BillingLines"."productId" as "productId",
    SUM(("BillingLines".total::numeric - "BillingLines"."taxTotal"::numeric))::numeric AS "amount",
    SUM(CASE WHEN "BillingLines".total::numeric = 0 THEN "BillingLines".qty::numeric ELSE 0 END)::numeric AS "foc",
    SUM("BillingLines".qty::numeric)::numeric AS "qty",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE("Branches".name,'other')
      WHEN "values"."compType" = 'period' AND "values"."period" = 'month' THEN to_char("BillingLines"."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "values"."period" = 'year'  THEN to_char("BillingLines"."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key"
  FROM "BillingLines"
  JOIN "values" ON true
  JOIN "Billings" ON "Billings"."id" = "BillingLines"."billingId"
  JOIN "Branches" ON "Branches".id = "Billings"."branchId"
  WHERE "Branches"."companyId" = "values"."companyId"
    AND (array_length("values"."branches",1) IS NULL OR "Branches".id = ANY("values"."branches"))
    AND ("BillingLines"."createdAt" >= "values"."fromDate" AND "BillingLines"."createdAt" < "values"."toDate")
  GROUP BY ${groupId} "BillingLines"."productId", "key"
),

/* -------- PLANNED (PO) -------- */
"poRec" AS (
  SELECT
    ${groupId} POL."productId" as "productId",
    SUM(
      CASE WHEN POL."isInclusiveTax" = false
        THEN (COALESCE(POL."subTotal",0)::numeric + COALESCE(POL."taxTotal",0)::numeric)
        ELSE COALESCE(POL."subTotal",0)::numeric
      END
    )::numeric AS "amount",
    0::numeric AS "foc",
    SUM(COALESCE(POL."qty",0)::numeric)::numeric AS "qty",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE("Branches".name,'other')
      WHEN "values"."compType" = 'period' AND "values"."period" = 'month' THEN to_char(PO."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "values"."period" = 'year'  THEN to_char(PO."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key"
  FROM "PurchaseOrderLines" POL
  JOIN "PurchaseOrders" PO ON PO.id = POL."purchaseOrderId"
  JOIN "Branches" ON "Branches".id = PO."branchId"
  JOIN "values" ON true
  WHERE "Branches"."companyId" = "values"."companyId"
    AND (array_length("values"."branches",1) IS NULL OR "Branches".id = ANY("values"."branches"))
    AND (PO."createdAt" >= "values"."fromDate" AND PO."createdAt" < "values"."toDate")
  GROUP BY ${groupId} POL."productId", "key"
),

/* -------- PO billed per product (to compute remaining) --------
   Assumes: Billings.purchaseOrderId exists.
   If you link by BillingLines.poLineId, tell me and I’ll swap this CTE.
*/
"poBilledByProduct" AS (
  SELECT
    ${groupId} IL."productId" as "productId",
    SUM(
      CASE WHEN IL."isInclusiveTax" = false
        THEN (COALESCE(IL."subTotal",0)::numeric + COALESCE(IL."taxTotal",0)::numeric)
        ELSE COALESCE(IL."subTotal",0)::numeric
      END
    )::numeric AS "billedAmount",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE("Branches".name,'other')
      WHEN "values"."compType" = 'period' AND "values"."period" = 'month' THEN to_char(IL."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "values"."period" = 'year'  THEN to_char(IL."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key"
  FROM "BillingLines" IL
  JOIN "values" ON true
  JOIN "Billings" invo ON invo.id = IL."billingId"
  JOIN "Branches" ON "Branches".id = invo."branchId"
  JOIN "PurchaseOrders" PO ON PO.id = invo."purchaseOrderId"
  WHERE "Branches"."companyId" = "values"."companyId"
    AND invo."status" <> 'Draft'
    AND (array_length("values"."branches",1) IS NULL OR "Branches".id = ANY("values"."branches"))
    AND (IL."createdAt" >= "values"."fromDate" AND IL."createdAt" < "values"."toDate")
  GROUP BY ${groupId} IL."productId", "key"
),

/* normalize records depending on mode (still RAW, not forecast math) */
"records" AS (
  SELECT * FROM "billRec" WHERE lower($8::text) IN ('actual','forecast')  -- we need actual part for forecast
  UNION ALL
  SELECT * FROM "poRec"   WHERE lower($8::text) IN ('planned','forecast') -- we need planned part for forecast
),

/* aggregate by group/product/key to avoid duplicates */
"agg" AS (
  SELECT
    ${groupId} "productId",
    "key",
    SUM("qty")::numeric AS "qty",
    SUM("foc")::numeric AS "foc",
    SUM("amount")::numeric AS "amount"
  FROM "records"
  GROUP BY ${groupId} "productId", "key"
),

/* totals planned per product/key to compute remaining */
"poAgg" AS (
  SELECT
    ${groupId} "productId",
    "key",
    SUM("qty")::numeric AS "poQty",
    SUM("amount")::numeric AS "poAmount"
  FROM "poRec"
  GROUP BY ${groupId} "productId", "key"
),

"poBilledAgg" AS (
  SELECT
    ${groupId} "productId",
    "key",
    SUM("billedAmount")::numeric AS "billedAmount"
  FROM "poBilledByProduct"
  GROUP BY ${groupId} "productId", "key"
)

SELECT
  ${groupSelectQuery}
  "Products".id as "productId",
  "Products".name as "productName",

  (SELECT array_agg(DISTINCT "key") FROM "agg") AS "columns",

  /* return RAW per key so Node decides mode math + label mapping */
  JSON_AGG(
    JSON_BUILD_OBJECT(
      "key",
      JSON_BUILD_OBJECT(
        'billQty', COALESCE((SELECT SUM(a2."qty") FROM "agg" a2 WHERE a2."productId"="agg"."productId" AND a2."key"="agg"."key"),0),
        'billFOC', COALESCE((SELECT SUM(a2."foc") FROM "agg" a2 WHERE a2."productId"="agg"."productId" AND a2."key"="agg"."key"),0),
        'billAmount', COALESCE((SELECT SUM(a2."amount") FROM "agg" a2 WHERE a2."productId"="agg"."productId" AND a2."key"="agg"."key"),0),

        'poQty', COALESCE((SELECT SUM(p2."poQty") FROM "poAgg" p2 WHERE p2."productId"="agg"."productId" AND p2."key"="agg"."key"),0),
        'poAmount', COALESCE((SELECT SUM(p2."poAmount") FROM "poAgg" p2 WHERE p2."productId"="agg"."productId" AND p2."key"="agg"."key"),0),

        'poBilledAmount', COALESCE((SELECT SUM(b2."billedAmount") FROM "poBilledAgg" b2 WHERE b2."productId"="agg"."productId" AND b2."key"="agg"."key"),0)
      )
    )
  ) AS "rawSummary"

FROM "agg"
JOIN "Products" ON "Products".id = "agg"."productId"
${groupjoinQuery}
GROUP BY ${groupByQuery} "Products".id
ORDER BY ${groupByQuery} "Products".id
`;

            const query = {
                text: sql,
                values: [companyId, branches, from, to, compareKey, period, NoOfperiod, mode],
            };

            const dbRes = await DB.excu.query(query.text, query.values);
            const rows = dbRes.rows ?? [];

            let columns: string[] = ["Total"];
            let results: any[] = [];
            if (rows.length > 0) {
                columns = rows[0].columns ?? columns;
                results = rows;
            }

            // sort period columns (same as your original)
            try {
                columns.sort((a, b) => moment(a, 'MMM/YYYY').diff(moment(b, 'MMM/YYYY')));
            } catch { }

            // ---------------- Node-side mode logic + shape final "summary" ----------------
            const parseRawSummary = (raw: any[]) => {
                // raw is like: [ { key: { billQty, billFOC, billAmount, poQty, poAmount, poBilledAmount } }, ... ]
                // normalize to Map(key -> obj)
                const m = new Map<string, any>();
                for (const item of raw ?? []) {
                    const k = Object.keys(item ?? {})[0];
                    if (!k) continue;
                    m.set(k, item[k]);
                }
                return m;
            };

            const buildCell = (x: any) => {
                const billQty = Number(x?.billQty ?? 0);
                const billFOC = Number(x?.billFOC ?? 0);
                const billAmount = Number(x?.billAmount ?? 0);

                const poQty = Number(x?.poQty ?? 0);
                const poAmount = Number(x?.poAmount ?? 0);
                const poBilledAmount = Number(x?.poBilledAmount ?? 0);
                const poRemaining = Math.max(poAmount - poBilledAmount, 0);

                if (mode === 'actual') {
                    const qty = billQty;
                    const foc = billFOC;
                    const total = billAmount;
                    return {
                        [qtyLabel]: qty,
                        [focLabel]: foc,
                        [amountLabel]: total,
                        [avgLabel]: (total / Math.max(qty, 1)),
                    };
                }

                if (mode === 'planned') {
                    const qty = poQty;
                    const foc = 0;
                    const total = poAmount;
                    return {
                        [qtyLabel]: qty,
                        [focLabel]: foc,
                        [amountLabel]: total,
                        [avgLabel]: (total / Math.max(qty, 1)),
                    };
                }

                // forecast
                const qty = billQty + poQty;
                const foc = billFOC; // keep actual FOC only
                const total = billAmount + poRemaining; // forecast amount = actual amount + remaining PO
                return {
                    [qtyLabel]: qty,
                    [focLabel]: foc,
                    [amountLabel]: total,
                    [avgLabel]: (total / Math.max(qty, 1)),
                };
            };

            const shaped = results.map((r: any) => {
                const rawMap = parseRawSummary(r.rawSummary);
                const summary: any[] = [];

                // build final summary structure like your current one (key -> { ... })
                for (const col of columns) {
                    const rawCell = rawMap.get(col) ?? {};
                    summary.push({
                        [col]: buildCell(rawCell)
                    });
                }

                // keep group fields + product
                const out: any = {
                    productId: r.productId,
                    productName: r.productName,
                    columns,
                    summary
                };

                if (r.supplierId !== undefined) {
                    out.supplierId = r.supplierId;
                    out.supplierName = r.supplierName;
                }
                if (r.categoryId !== undefined) {
                    out.categoryId = r.categoryId;
                    out.categoryName = r.categoryName;
                }

                return out;
            });

            const resData = {
                records: shaped,
                subColumns: finalSubColumns,
                columns
            };

            // ---------------- export ----------------
            if (filter.export) {
                const report = new ReportData();
                report.filter = {
                    title: `Purchase By Item (${mode})`,
                    fromDate: filter?.fromDate ?? null,
                    toDate: filter?.toDate ?? new Date(),
                    branches,
                    compareType: compareKey,
                    period,
                    periodQty: NoOfperiod,
                    mode
                };

                report.records = shaped;

                // columns & subColumns (same style as your original)
                for (const col of resData.columns) {
                    const childs: DataColumn[] = [];
                    for (const subcol of resData.subColumns) {
                        if (subcol === qtyLabel || subcol === focLabel) childs.push({ key: subcol });
                        else childs.push({ key: subcol, properties: { columnType: 'currency' } });
                    }
                    report.columns.push({ key: col, childs, properties: { hasSubTotal: groupByColumn.length > 1, hasTotal: true } });
                }

                report.columns = [...groupByColumn, ...report.columns];
                report.fileName = `PurchaseByItem_${mode}`;
                return new ResponseData(true, "", report);
            }

            return new ResponseData(true, "", resData);

        } catch (error: any) {
          
            throw new Error(error.message);
        }
    }

    public static async purchaseByCategory(data: any, company: Company) {
        try {
            const filter = data?.filter ?? {};
            const companyId = company.id;

            // ---------------- mode (whitelist) ----------------
            const mode: 'actual' | 'planned' | 'forecast' =
                (filter.mode === 'actual' || filter.mode === 'planned' || filter.mode === 'forecast')
                    ? filter.mode
                    : 'actual';

            // ---------------- branches ----------------
            let branches = filter?.branches ?? null;
            if (!Array.isArray(branches) || branches.length === 0) branches = null;

            // ---------------- time range ----------------
            const closingTime = "00:00:00";
            const fromDate = moment(new Date(filter?.fromDate ?? null));
            const toDate = filter?.toDate ? moment(new Date(filter.toDate)) : moment(new Date());
            const { from, to } = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, company.timeOffset);

            // ---------------- compare / period ----------------
            const NoOfperiod = filter?.periodQty ?? null;
            const period = filter?.period ?? null;
            const compareType = String(filter?.compareType ?? 'none').toLowerCase();
            const compType = (compareType === 'branch' || compareType === 'period') ? compareType : 'none';

            // ---------------- subColumns ----------------
            // keep same keys for UI/export, but allow mode-based label (optional)
            const DefaultSubColumns = ['amount', 'taxTotal', 'total'];
            const selectedSubColumns = Array.isArray(filter.subColumns) ? filter.subColumns : ['amount'];
            const validSubColumns = selectedSubColumns.filter((c: string) => DefaultSubColumns.includes(c));
            if (validSubColumns.length === 0) validSubColumns.push('amount');

            // ---------------- SQL (RAW measures only; mode logic in code) ----------------
            // NOTE:
            // - actual = Bills + Supplier Credits (your current)
            // - planned = PO totals (no tax split unless PO stores taxTotal/subTotal like lines)
            // - forecast = actual + PO remaining (remaining = poAmount - billedFromPO)
            // - PO→Bill link assumes Billings.purchaseOrderId (same as supplier/item funcs)
            const sql = `
WITH "values" AS (
  SELECT  $1::uuid AS "companyId",
          $2::uuid[] AS "branches",
          CASE
            WHEN (lower($5::TEXT) ='period' AND lower($6::TEXT)  ='month') THEN $3::timestamp - interval '1 month' * $7::int
            WHEN (lower($5::TEXT) ='period' AND lower($6::TEXT)  ='year')  THEN $3::timestamp - interval '1 year'  * $7::int
            ELSE $3::timestamp
          END AS "fromDate",
          $4::timestamp AS "toDate",
          lower($5)::text AS "compType",
          lower($6)::text AS "period"
),

/* ---------------- ACTUAL (Bills) ---------------- */
"bill" AS (
  SELECT
    prod."categoryId" AS "categoryId",
    SUM(
      CASE WHEN IL."isInclusiveTax" = true
        THEN (COALESCE(IL."subTotal",0)::numeric - COALESCE(IL."taxTotal",0)::numeric)
        ELSE COALESCE(IL."subTotal",0)::numeric
      END
    )::numeric AS "amount",
    SUM(COALESCE(IL."taxTotal",0)::numeric)::numeric AS "taxTotal",
    SUM(COALESCE(IL.total,0)::numeric)::numeric AS "total",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE(br.name,'other')
      WHEN "values"."compType" = 'period' AND "period" = 'month' THEN to_char(IL."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "period" = 'year'  THEN to_char(IL."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key"
  FROM "BillingLines" IL
  JOIN "values" ON true
  JOIN "Billings" invo ON invo.id = IL."billingId"
  LEFT JOIN "Products" prod ON prod.id = IL."productId"
  JOIN "Branches" br ON br.id = invo."branchId"
  WHERE br."companyId" = "values"."companyId"
    AND invo."status" <> 'Draft'
    AND (array_length("values"."branches",1) IS NULL OR br.id = ANY("values"."branches"))
    AND (IL."createdAt" >= "values"."fromDate" AND IL."createdAt" < "values"."toDate")
  GROUP BY prod."categoryId", "key"
),

/* ---------------- ACTUAL (Supplier Credits) ---------------- */
"credit" AS (
  SELECT
    prod."categoryId" AS "categoryId",
    (SUM(
      CASE WHEN CNL."isInclusiveTax" = true
        THEN (COALESCE(CNL."subTotal",0)::numeric - COALESCE(CNL."taxTotal",0)::numeric)
        ELSE COALESCE(CNL."subTotal",0)::numeric
      END
    ) * (-1))::numeric AS "amount",
    (SUM(COALESCE(CNL."taxTotal",0)::numeric) * (-1))::numeric AS "taxTotal",
    (SUM(COALESCE(CNL.total,0)::numeric) * (-1))::numeric AS "total",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE(br.name,'other')
      WHEN "values"."compType" = 'period' AND "period" = 'month' THEN to_char(CNL."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "period" = 'year'  THEN to_char(CNL."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key"
  FROM "SupplierCreditLines" CNL
  JOIN "values" ON true
  JOIN "SupplierCredits" CN ON CN.id = CNL."supplierCreditId"
  LEFT JOIN "Products" prod ON prod.id = CNL."productId"
  JOIN "Branches" br ON br.id = CN."branchId"
  WHERE br."companyId" = "values"."companyId"
    AND (array_length("values"."branches",1) IS NULL OR br.id = ANY("values"."branches"))
    AND (CNL."createdAt" >= "values"."fromDate" AND CNL."createdAt" < "values"."toDate")
  GROUP BY prod."categoryId", "key"
),

"actual" AS (
  SELECT
    COALESCE("Categories".id, NULL) AS "categoryId",
    COALESCE("Categories".name,'Uncategorized') AS "categoryName",
    T."key",
    SUM(COALESCE(T."amount",0))::numeric AS "amount",
    SUM(COALESCE(T."taxTotal",0))::numeric AS "taxTotal",
    SUM(COALESCE(T."total",0))::numeric AS "total"
  FROM (SELECT * FROM "bill" UNION ALL SELECT * FROM "credit") T
  LEFT JOIN "Categories" ON "Categories".id = T."categoryId"
  GROUP BY "Categories".id, "Categories".name, T."key"
),

/* ---------------- PLANNED (PO by category) ---------------- */
"po" AS (
  SELECT
    prod."categoryId" AS "categoryId",
    COALESCE(cat.name,'Uncategorized') AS "categoryName",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE(br.name,'other')
      WHEN "values"."compType" = 'period' AND "period" = 'month' THEN to_char(PO."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "period" = 'year'  THEN to_char(PO."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key",
    SUM(
      CASE WHEN POL."isInclusiveTax" = false
        THEN COALESCE(POL."subTotal",0)::numeric + COALESCE(POL."taxTotal",0)::numeric
        ELSE COALESCE(POL."subTotal",0)::numeric
      END
    )::numeric AS "poAmount"
  FROM "PurchaseOrderLines" POL
  JOIN "PurchaseOrders" PO ON PO.id = POL."purchaseOrderId"
  JOIN "Branches" br ON br.id = PO."branchId"
  JOIN "values" ON true
  LEFT JOIN "Products" prod ON prod.id = POL."productId"
  LEFT JOIN "Categories" cat ON cat.id = prod."categoryId"
  WHERE br."companyId" = "values"."companyId"
    AND (array_length("values"."branches",1) IS NULL OR br.id = ANY("values"."branches"))
    AND (PO."createdAt" >= "values"."fromDate" AND PO."createdAt" < "values"."toDate")
  GROUP BY prod."categoryId", cat.name, "key"
),

/* billed-from-PO by category (to compute remaining) */
"poBilled" AS (
  SELECT
    prod."categoryId" AS "categoryId",
    CASE
      WHEN "values"."compType" = 'branch' THEN COALESCE(br.name,'other')
      WHEN "values"."compType" = 'period' AND "period" = 'month' THEN to_char(IL."createdAt"::timestamp,'Mon/YYYY')
      WHEN "values"."compType" = 'period' AND "period" = 'year'  THEN to_char(IL."createdAt"::timestamp,'YYYY')
      ELSE 'Total'
    END AS "key",
    SUM(
      CASE WHEN IL."isInclusiveTax" = false
        THEN COALESCE(IL."subTotal",0)::numeric + COALESCE(IL."taxTotal",0)::numeric
        ELSE COALESCE(IL."subTotal",0)::numeric
      END
    )::numeric AS "billedFromPO"
  FROM "BillingLines" IL
  JOIN "values" ON true
  JOIN "Billings" invo ON invo.id = IL."billingId"
  JOIN "Branches" br ON br.id = invo."branchId"
  JOIN "PurchaseOrders" PO ON PO.id = invo."purchaseOrderId"
  LEFT JOIN "Products" prod ON prod.id = IL."productId"
  WHERE br."companyId" = "values"."companyId"
    AND invo."status" <> 'Draft'
    AND (array_length("values"."branches",1) IS NULL OR br.id = ANY("values"."branches"))
    AND (IL."createdAt" >= "values"."fromDate" AND IL."createdAt" < "values"."toDate")
  GROUP BY prod."categoryId", "key"
),

"planned" AS (
  SELECT
    p."categoryId",
    p."categoryName",
    p."key",
    p."poAmount",
    COALESCE(b."billedFromPO",0)::numeric AS "billedFromPO",
    (p."poAmount" - COALESCE(b."billedFromPO",0)::numeric)::numeric AS "poRemaining"
  FROM "po" p
  LEFT JOIN "poBilled" b ON b."categoryId" IS NOT DISTINCT FROM p."categoryId" AND b."key" = p."key"
),

/* unify keys for output */
"u" AS (
  SELECT
    COALESCE(a."categoryId", p."categoryId") AS "categoryId",
    COALESCE(a."categoryName", p."categoryName", 'Uncategorized') AS "categoryName",
    COALESCE(a."key", p."key") AS "key"
  FROM "actual" a
  FULL JOIN "planned" p
    ON p."categoryId" IS NOT DISTINCT FROM a."categoryId"
   AND p."key" = a."key"
)

SELECT
  u."categoryId",
  u."categoryName",
  u."key",

  /* raw measures (actual + planned) */
  COALESCE(a."amount",0)::numeric AS "billAmount",
  COALESCE(a."taxTotal",0)::numeric AS "billTaxTotal",
  COALESCE(a."total",0)::numeric AS "billTotal",

  COALESCE(p."poAmount",0)::numeric AS "poAmount",
  COALESCE(p."poRemaining",0)::numeric AS "poRemaining"
FROM "u" u
LEFT JOIN "actual" a
  ON a."categoryId" IS NOT DISTINCT FROM u."categoryId" AND a."key" = u."key"
LEFT JOIN "planned" p
  ON p."categoryId" IS NOT DISTINCT FROM u."categoryId" AND p."key" = u."key"
`;

            const query = {
                text: sql,
                values: [companyId, branches, from, to, compType, period, NoOfperiod]
            };

            const dbRes = await DB.excu.query(query.text, query.values);
            const rows = dbRes.rows ?? [];

            // ---------------- build columns list ----------------
            let columns: string[] = ["Total"];
            if (rows.length > 0) columns = Array.from(new Set(rows.map((r: any) => r.key)));

            // sort period keys (same logic)
            try {
                columns.sort((a, b) => moment(a, 'MMM/YYYY').diff(moment(b, 'MMM/YYYY')));
            } catch { }

            // ---------------- group rows by category ----------------
            const byCat = new Map<string, any>();
            const catKeyOf = (r: any) => String(r.categoryId ?? 'null');

            for (const r of rows) {
                const k = catKeyOf(r);
                if (!byCat.has(k)) {
                    byCat.set(k, {
                        categoryId: r.categoryId,
                        categoryName: r.categoryName ?? 'Uncategorized',
                        columns,
                        _map: new Map<string, any>()
                    });
                }
                byCat.get(k)._map.set(r.key, r);
            }

            // ---------------- mode math in code ----------------
            const buildCell = (r: any) => {
                const billAmount = Number(r?.billAmount ?? 0);
                const billTax = Number(r?.billTaxTotal ?? 0);
                const billTotal = Number(r?.billTotal ?? 0);

                const poAmount = Number(r?.poAmount ?? 0);
                const poRemaining = Number(r?.poRemaining ?? 0);

                if (mode === 'actual') {
                    return { amount: billAmount, taxTotal: billTax, total: billTotal };
                }
                if (mode === 'planned') {
                    // if PO tax split not meaningful, keep taxTotal = 0 and total = poAmount
                    return { amount: poAmount, taxTotal: 0, total: poAmount };
                }
                // forecast: actual + remaining
                return {
                    amount: billAmount + poRemaining,
                    taxTotal: billTax,             // keep actual tax only (remaining PO tax unknown unless you store it)
                    total: billTotal + poRemaining
                };
            };

            // ---------------- shape results like your current summary ----------------
            const results: any[] = [];
            for (const cat of byCat.values()) {
                const summary: any[] = [];
                for (const col of columns) {
                    const r = cat._map.get(col) ?? null;
                    summary.push({
                        [col]: buildCell(r)
                    });
                }

                results.push({
                    categoryId: cat.categoryId,
                    categoryName: cat.categoryName,
                    columns,
                    summary
                });
            }

            const resData = {
                records: results,
                subColumns: compType === 'none' ? DefaultSubColumns : validSubColumns,
                columns
            };

            // ---------------- export ----------------
            if (filter.export) {
                const report = new ReportData();
                report.filter = {
                    title: `Purchase By Category (${mode})`,
                    fromDate: filter?.fromDate ?? null,
                    toDate: filter?.toDate ?? new Date(),
                    branches,
                    compareType: compType,
                    period,
                    periodQty: NoOfperiod,
                    mode
                };

                report.records = results;

                // columns & subColumns
                resData.columns.forEach((col: any) => {
                    const childs: DataColumn[] = [];
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }));
                    report.columns.push({ key: col, childs, properties: { hasTotal: true } });
                });

                report.columns = [...[{ key: 'categoryName' }], ...report.columns];
                report.fileName = `PurchaseByCategory_${mode}`;
                return new ResponseData(true, "", report);
            }

            return new ResponseData(true, "", resData);

        } catch (error: any) {
          
            throw new Error(error.message);
        }
    }

    public static async purchaseByItemId(data: any, company: Company, productId: string, brancheList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';

            let productId = filter && filter.productId ? filter.productId : null
            if (!productId) { throw new ValidationException("productId is required") }

            let columns = ["Total"]
            let results: any = []

            let query = {
                text: ` select name as "productName" from "Products" where id =  $1 `,
                values: [productId]
            }
            const product = await DB.excu.query(query.text, query.values);



            query = {
                text: ` WITH "values" AS (
                            select  $1::uuid AS "companyId",
                                    $2::uuid[] AS "branches",
                                    case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                        when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                        else $3::timestamp 	END "fromDate",
                                    $4::timestamp AS "toDate",
                                    lower($5)::text As "compType",
                                    lower($6)::text as "period"
                        )
                       ,"records" as(
                            select  "supplierId", 
                                sum( "BillingLines".total::text::numeric - "BillingLines"."taxTotal"::text::numeric ) as total,
                                sum( case when "BillingLines".total::text::numeric = 0 then "BillingLines".qty::text::numeric end ) as "FOC",
                                sum( "BillingLines".qty::text::numeric) as "qty",
                                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                                        when "values"."compType" = 'period' and "period" = 'month' then to_char("BillingLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                        when "values"."compType" = 'period' and "period" = 'year'  then  to_char("BillingLines"."createdAt"::TIMESTAMP,'YYYY') 
                                        else 'Total' end as "key"
                            from "BillingLines" 
                            join "values" on true
                            inner join "Billings" ON "Billings"."id" = "BillingLines"."billingId"
                            inner join "Branches" ON "Branches".id = "Billings"."branchId"
                            where "Branches"."companyId" = "values"."companyId"  
                                and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                                and ("BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" < "values"."toDate"  ) 
                                and "productId" = $8
                            group by "supplierId", "key"
                        )
                        select "Suppliers".id as "supplierId", "Suppliers".name as "supplierName",
                                (select array_agg(distinct "key") from "records")   as "columns",
                                JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('Qty',COALESCE("qty",0),
                                                                                'FOC Items',COALESCE("FOC",0),
                                                                                'Total',COALESCE("total",0),
                                                                                'Average Price', (COALESCE("total",0)/greatest("qty",1))::text::double PRECISION
                                                                                ))) as "summary"

                        from "records"
                        left join "Suppliers" ON "Suppliers".id = "records"."supplierId" 
                        group by "Suppliers".id
                        order by "Suppliers".id             
                `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod, productId]
            }


            const records = await DB.excu.query(query.text, query.values);


            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }


            //sort period
            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }

            const DefaultSubColumns = ['Qty', 'FOC Items', 'Total', 'Average Price'];
            const selectedSubColumns = filter.subColumns ?? ['Qty', 'FOC Items', 'Total', 'Average Price'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push(DefaultSubColumns);
            }

            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,

            }


            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Purchase By Item",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod,
                    filterList: { productName: (product.rows && product.rows.length > 0) ? (<any>product.rows[0]).productName : null },
                    productName: (product.rows && product.rows.length > 0) ? (<any>product.rows[0]).productName : null
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => {
                        if (subcol === 'Qty' || subcol === 'FOC Items') childs.push({ key: subcol })
                        else childs.push({ key: subcol, properties: { columnType: 'currency' } })
                    })
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })



                report.columns = [...[{ key: 'supplierName' }], ...report.columns]
                report.fileName = 'PurchaseByItem'
                return new ResponseData(true, "", report)

            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async openPendingPOReport(data: any, company: Company, brancheList: []) {
        try {
            const filter = data?.filter ?? {};
            const companyId = company.id;

            // ---------------- branches ----------------
            let branches = filter?.branches ?? brancheList;
            if (!Array.isArray(branches) || branches.length === 0) branches = null;

            // ---------------- time range ----------------
            const closingTime = "00:00:00";
            const fromDate = moment(new Date(filter?.fromDate ?? null));
            const toDate = filter?.toDate ? moment(new Date(filter.toDate)) : moment(new Date());
            const { from, to } = await TimeHelper.getReportTime(
                fromDate,
                toDate,
                closingTime,
                false,
                company.timeOffset
            );

            // ---------------- paging ----------------
            const page = data?.page ?? filter?.page ?? 1;
            const limit = data?.limit ?? filter?.limit ?? 50;
            const offset = (page - 1) * limit;

            // ---------------- labels injected from code ----------------
            const countAlias = "Number Of Bills"; 
            const amountAlias = "PO Amount";
            const billedAlias = "Converted Bill Amount";
            const remainingAlias = "Remaining To Convert";
            const totalAlias = "Total";

            // ---------------- SQL (no PO status; conversion derived) ----------------
            const sql = `
                WITH "values" AS (
                  SELECT
                    $1::uuid      AS "companyId",
                    $2::uuid[]    AS "branches",
                    $3::timestamp AS "fromDate",
                    $4::timestamp AS "toDate"
                ),

                /* PO totals */
                "po" AS (
                  SELECT
                    PO.id AS "purchaseOrderId",
                    PO."purchaseNumber",
                    PO."supplierId",
                    PO."branchId",
                    PO."createdAt",
                    SUM(
                      CASE WHEN POL."isInclusiveTax" = false
                        THEN COALESCE(POL."subTotal",0)::numeric + COALESCE(POL."taxTotal",0)::numeric
                        ELSE COALESCE(POL."subTotal",0)::numeric
                      END
                    )::numeric AS "poAmount"
                  FROM "PurchaseOrders" PO
                  JOIN "values" v ON true
                  JOIN "Branches" br ON br.id = PO."branchId"
                  JOIN "PurchaseOrderLines" POL ON POL."purchaseOrderId" = PO.id
                  WHERE br."companyId" = v."companyId"
                    AND (array_length(v."branches",1) IS NULL OR br.id = ANY(v."branches"))
                    AND (PO."createdAt" >= v."fromDate" AND PO."createdAt" < v."toDate")
                  GROUP BY PO.id
                ),

                /* Converted bills amount + count for each PO */
                "billed" AS (
                  SELECT
                    invo."purchaseOrderId" AS "purchaseOrderId",
                    COUNT(DISTINCT invo.id)::int AS "billCount",
                    SUM(
                      CASE WHEN IL."isInclusiveTax" = false
                        THEN COALESCE(IL."subTotal",0)::numeric + COALESCE(IL."taxTotal",0)::numeric
                        ELSE COALESCE(IL."subTotal",0)::numeric
                      END
                    )::numeric AS "billedAmount"
                  FROM "Billings" invo
                  JOIN "BillingLines" IL ON IL."billingId" = invo.id
                  JOIN "values" v ON true
                  JOIN "Branches" br ON br.id = invo."branchId"
                  WHERE br."companyId" = v."companyId"
                    AND invo."status" <> 'Draft'
                    AND invo."purchaseOrderId" IS NOT NULL
                    AND (array_length(v."branches",1) IS NULL OR br.id = ANY(v."branches"))
                    AND (IL."createdAt" >= v."fromDate" AND IL."createdAt" < v."toDate")
                  GROUP BY invo."purchaseOrderId"
                )

                SELECT
                  /* keep PO row count for paging */
                  COUNT(*) OVER() AS "poRowCount",

                  /* total number of bills across returned rows */
                  SUM(COALESCE(b."billCount",0)) OVER() AS "totalBillCount",

                  p."purchaseOrderId",
                  p."purchaseNumber",
                  p."createdAt",
                  p."supplierId",
                  COALESCE(NULLIF(s.name,''),'Supplier') AS "supplierName",
                  p."branchId",
                  COALESCE(NULLIF(br.name,''),'Branch') AS "branchName",

                  p."poAmount",
                  COALESCE(b."billedAmount",0)::numeric AS "billedAmount",
                  COALESCE(b."billCount",0)::int AS "billCount",

                  (p."poAmount" - COALESCE(b."billedAmount",0)::numeric)::numeric AS "remainingAmount",

                  /* derived conversion status for UI */
                  CASE
                    WHEN COALESCE(b."billedAmount",0)::numeric = 0 THEN 'Not Converted'
                    WHEN COALESCE(b."billedAmount",0)::numeric < p."poAmount" THEN 'Partially Converted'
                    ELSE 'Fully Converted'
                  END AS "conversionStatus"

                FROM "po" p
                LEFT JOIN "billed" b ON b."purchaseOrderId" = p."purchaseOrderId"
                LEFT JOIN "Suppliers" s ON s.id = p."supplierId"
                LEFT JOIN "Branches" br ON br.id = p."branchId"

                /* Open/Pending only = remaining > 0 */
                WHERE (p."poAmount" - COALESCE(b."billedAmount",0)::numeric) > 0

                ORDER BY p."createdAt" DESC
`;

            const values = [companyId, branches, from, to];
            const paging = filter.export ? "" : ` LIMIT ${limit} OFFSET ${offset}`;

            const dbRes = await DB.excu.query(sql + paging, values);
            const rows = dbRes.rows ?? [];

            // ---------------- export ----------------
            if (filter.export) {
                const exportRows = rows.map((r: any) => ({
                    purchaseOrderId: r.purchaseOrderId,
                    purchaseNumber: r.purchaseNumber,
                    createdAt: r.createdAt,
                    conversionStatus: r.conversionStatus,
                    supplierId: r.supplierId,
                    supplierName: r.supplierName,
                    branchId: r.branchId,
                    branchName: r.branchName,
                    billCount: Number(r.billCount ?? 0), // ✅ include if you want in export
                    [amountAlias]: Number(r.poAmount ?? 0),
                    [billedAlias]: Number(r.billedAmount ?? 0),
                    [remainingAlias]: Number(r.remainingAmount ?? 0),
                }));

                const report = new ReportData();
                report.filter = {
                    title: "Open PO / Pending PO Report",
                    fromDate: filter?.fromDate ?? null,
                    toDate: filter?.toDate ?? new Date(),
                    branches,
                };
                report.records = exportRows;
                report.columns = [
                    { key: "createdAt" },
                    { key: "purchaseOrderId" },
                    { key: "conversionStatus" },
                    { key: "supplierName" },
                    { key: "branchName" },
                    { key: "billCount" }, // ✅ add if you want
                    { key: amountAlias, properties: { hasTotal: true, columnType: "currency" } },
                    { key: billedAlias, properties: { hasTotal: true, columnType: "currency" } },
                    { key: remainingAlias, properties: { hasTotal: true, columnType: "currency" } },
                ];
                report.fileName = "OpenPendingPOReport";
                return new ResponseData(true, "", report);
            }

            // ---------------- pivot-like shape (like your other reports) ----------------
            const columns = [totalAlias];
            const subColumns = [countAlias, amountAlias, billedAlias, remainingAlias];

            const records = rows.map((r: any) => ({
                purchaseOrderId: r.purchaseOrderId,
                purchaseNumber: r.purchaseNumber,
                createdAt: r.createdAt,
                conversionStatus: r.conversionStatus,
                supplierId: r.supplierId,
                supplierName: r.supplierName,
                branchId: r.branchId,
                branchName: r.branchName,
                billCount: Number(r.billCount ?? 0),
                columns,
                summary: [
                    {
                        [totalAlias]: {
                            [countAlias]: Number(r.billCount ?? 0), // ✅ bills count (not PO count)
                            [amountAlias]: Number(r.poAmount ?? 0),
                            [billedAlias]: Number(r.billedAmount ?? 0),
                            [remainingAlias]: Number(r.remainingAmount ?? 0),
                        },
                    },
                ],
            }));

            // paging uses PO rows count (not bills)
            const count = rows.length > 0 ? Number(rows[0].poRowCount) : 0;
            const pageCount = Math.ceil((count || 0) / limit);
            const startIndex = count === 0 ? 0 : offset + 1;
            const lastIndex = Math.min(offset + rows.length, count);

            // optional overall total bills across returned rows
            const totalBillCount = rows.length > 0 ? Number(rows[0].totalBillCount) : 0;

            return new ResponseData(true, "", {
                records,
                columns,
                subColumns,
                count,
                pageCount,
                startIndex,
                lastIndex,
                totalBillCount, // ✅ extra info if you need it
            });
        } catch (error: any) {
          
            throw new Error(error.message);
        }
    }
}