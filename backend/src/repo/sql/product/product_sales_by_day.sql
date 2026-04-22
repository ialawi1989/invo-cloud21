

WITH days AS (
  SELECT generate_series(
    date_trunc('day', now()) - interval '29 days',
    date_trunc('day', now()),
    interval '1 day'
  )::date AS day
),

-- ----- Sales (Invoices) -----
base_il AS (
  SELECT
    il.id,
    il.qty,
    il.price,
    il."subTotal",
    il."isInclusiveTax",
    il."discountTotal",
    il."taxTotal",
    il."createdAt"
  FROM "InvoiceLines" il
  JOIN "Invoices" i ON i.id = il."invoiceId"
  WHERE i.status <> 'Draft'
    AND il."companyId" = $2
    AND il."productId" = $1
    AND il."createdAt" >= (now() - interval '30 days')
),

sales AS (
  SELECT
    (il."createdAt")::date AS day,
    SUM(
      CASE
        WHEN il."isInclusiveTax"
          THEN il."subTotal" - il."discountTotal" 
        ELSE il."subTotal" - il."discountTotal"
      END
    ) AS sales_amount,
    SUM(il.qty) AS sales_qty
  FROM base_il il
  GROUP BY (il."createdAt")::date
),

-- ----- Returns (Credit Notes) -----
base_cn AS (
  SELECT
    cnl.id,
    cnl.qty,
    cnl.price,
    cnl."subTotal",
    cnl."discountTotal",
    cnl."taxTotal",
    cnl."isInclusiveTax",
    cnl."createdAt"
  FROM "CreditNoteLines" cnl
  JOIN "CreditNotes" cn ON cn.id = cnl."creditNoteId"
  WHERE 
    cnl."companyId" = $2
    AND cnl."productId" = $1
    AND cnl."createdAt" >= (now() - interval '30 days')
),

returns AS (
  SELECT
    (cnl."createdAt")::date AS day,
    SUM(
      CASE
        WHEN cnl."isInclusiveTax"
          THEN cnl."subTotal" - cnl."discountTotal" 
        ELSE cnl."subTotal" - cnl."discountTotal"
      END
    ) AS return_amount,
    SUM(cnl.qty) AS return_qty
  FROM base_cn cnl
  GROUP BY (cnl."createdAt")::date
)

SELECT
  d.day,
  COALESCE(s.sales_qty, 0)                    AS sales_qty,
  COALESCE(r.return_qty, 0)                   AS return_qty,
  COALESCE(s.sales_amount, 0)                 AS sales_amount_with_tax,
  COALESCE(r.return_amount, 0)                AS return_amount_with_tax,
  COALESCE(s.sales_amount, 0) - COALESCE(r.return_amount, 0) AS net_amount,
  COALESCE(s.sales_qty, 0) - COALESCE(r.return_qty, 0)       AS net_qty
FROM days d
LEFT JOIN sales  s ON s.day = d.day
LEFT JOIN returns r ON r.day = d.day
ORDER BY d.day desc;