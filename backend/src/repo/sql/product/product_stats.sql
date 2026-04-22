WITH bounds AS (
  SELECT
    (date_trunc('day', now()) - interval '29 days')      AS curr_start,
    date_trunc('day', now()) + interval '1 day'          AS curr_end,   -- end exclusive
    (date_trunc('day', now()) - interval '59 days')      AS prev_start,
    (date_trunc('day', now()) - interval '29 days')      AS prev_end
),
-- Current 30 days: sales and returns unified
curr_lines AS (
  -- Sales (positive)
  SELECT
    'sale'::text AS kind,
    il.qty::numeric AS qty,
    (il."subTotal" - COALESCE(il."discountTotal", 0))::numeric AS amount
  FROM "InvoiceLines" il
  JOIN "Invoices" i ON i.id = il."invoiceId"
  JOIN bounds b ON TRUE
  WHERE i.status <> 'Draft'
    AND i."companyId" = $2
    AND il."productId" = $1
    AND il."createdAt" >= b.curr_start AND il."createdAt" < b.curr_end

  UNION ALL
  -- Returns (negative)
  SELECT
    'return'::text AS kind,
    (-cnl.qty)::numeric AS qty,
    -(cnl."subTotal" - COALESCE(cnl."discountTotal", 0))::numeric AS amount
  FROM "CreditNoteLines" cnl
  JOIN "CreditNotes" cn ON cn.id = cnl."creditNoteId"
  JOIN "Invoices" i2 ON i2.id = cn."invoiceId"
  JOIN bounds b ON TRUE
  WHERE i2."companyId" = $2
    AND cnl."productId" = $1
    AND cnl."createdAt" >= b.curr_start AND cnl."createdAt" < b.curr_end
),
curr AS (
  SELECT
    -- Gross sales = only sales (ignore returns)
    SUM(CASE WHEN kind = 'sale' THEN amount ELSE 0 END)           AS sales_figure,
    -- Net revenue = sales - returns
    SUM(amount)                                                   AS total_sales,
    -- Net units = sales qty - return qty
    SUM(qty)                                                      AS units_sold
  FROM curr_lines
),

-- Previous 30 days: same logic
prev_lines AS (
  -- Sales (positive)
  SELECT
    'sale'::text AS kind,
    il.qty::numeric AS qty,
    (il."subTotal" - COALESCE(il."discountTotal", 0))::numeric AS amount
  FROM "InvoiceLines" il
  JOIN "Invoices" i ON i.id = il."invoiceId"
  JOIN bounds b ON TRUE
  WHERE i.status <> 'Draft'
    AND i."companyId" = $2
    AND il."productId" = $1
    AND il."createdAt" >= b.prev_start AND il."createdAt" < b.prev_end

  UNION ALL
  -- Returns (negative)
  SELECT
    'return'::text AS kind,
    (-cnl.qty)::numeric AS qty,
    -(cnl."subTotal" - COALESCE(cnl."discountTotal", 0))::numeric AS amount
  FROM "CreditNoteLines" cnl
  JOIN "CreditNotes" cn ON cn.id = cnl."creditNoteId"
  JOIN "Invoices" i2 ON i2.id = cn."invoiceId"
  JOIN bounds b ON TRUE
  WHERE i2."companyId" = $2
    AND cnl."productId" = $1
    AND cnl."createdAt" >= b.prev_start AND cnl."createdAt" < b.prev_end
),
prev AS (
  SELECT
    SUM(CASE WHEN kind = 'sale' THEN amount ELSE 0 END)           AS sales_figure,
    SUM(amount)                                                   AS total_sales,
    SUM(qty)                                                      AS units_sold
  FROM prev_lines
)
SELECT
  -- Values for the last 30 days
  curr.total_sales                                  AS total_sales,          -- BHD
  curr.sales_figure                                 AS sales_figure,         -- BHD
  curr.units_sold::numeric                          AS units_sold,
 
  -- % change vs previous 30 days
  ROUND( ( (curr.total_sales - prev.total_sales)
           / NULLIF(prev.total_sales, 0) )::numeric * 100, 1) AS total_sales_change_pct,
  ROUND( ( (curr.sales_figure - prev.sales_figure)
           / NULLIF(prev.sales_figure, 0) )::numeric * 100, 1) AS sales_figure_change_pct,
  ROUND(((curr.units_sold - prev.units_sold) / NULLIF(prev.units_sold, 0))::numeric * 100, 1) AS units_sold_change_pct
FROM curr, prev;