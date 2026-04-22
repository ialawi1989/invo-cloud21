WITH bounds AS (
  SELECT date_trunc('month', now()) AS curr_month_start
),
months AS (
  SELECT generate_series(
           (SELECT curr_month_start FROM bounds) - interval '11 months',
           (SELECT curr_month_start FROM bounds),
           interval '1 month'
         ) AS month_start
),
range AS (
  SELECT
    (SELECT min(month_start) FROM months)                          AS start_ts,
    (SELECT max(month_start) + interval '1 month' FROM months)     AS end_ts
),
sales AS (
  SELECT
    date_trunc('month', il."createdAt") AS month_start,
    SUM(il."subTotal" - COALESCE(il."discountTotal", 0))::numeric  AS sales_amount
  FROM "InvoiceLines" il
  JOIN "Invoices" i ON i.id = il."invoiceId"
  WHERE i.status <> 'Draft'
    AND i."companyId" = $2
    AND il."productId" = $1
    AND il."createdAt" >= (SELECT start_ts FROM range)
    AND il."createdAt" <  (SELECT end_ts   FROM range)
  GROUP BY 1
),
returns AS (
  SELECT
    date_trunc('month', cnl."createdAt") AS month_start,
    SUM(COALESCE(cnl."subTotal", cnl.qty * cnl.price)
        - COALESCE(cnl."discountTotal", 0))::numeric              AS return_amount
  FROM "CreditNoteLines" cnl
  JOIN "CreditNotes" cn ON cn.id = cnl."creditNoteId"
  JOIN "Invoices" i2 ON i2.id = cn."invoiceId"
  WHERE i2."companyId" = $2
    AND cnl."productId" = $1
    AND cnl."createdAt" >= (SELECT start_ts FROM range)
    AND cnl."createdAt" <  (SELECT end_ts   FROM range)
  GROUP BY 1
)
SELECT
  m.month_start::date                                      AS month_start,
  to_char(m.month_start, 'YYYY-MM')                        AS month_label,
  COALESCE(s.sales_amount, 0)                              AS sales_amount,
  COALESCE(r.return_amount, 0)                             AS return_amount,
  COALESCE(s.sales_amount, 0) - COALESCE(r.return_amount, 0) AS net_amount
FROM months m
LEFT JOIN sales   s USING (month_start)
LEFT JOIN returns r USING (month_start)
ORDER BY m.month_start;
-- 