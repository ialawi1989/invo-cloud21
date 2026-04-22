WITH rows AS (
  -- Sales 
  SELECT
    i."serviceId",
    il.qty::numeric             AS units,
    (COALESCE(il."subTotal", il.qty * il.price)
     - COALESCE(il."discountTotal", 0))::numeric AS revenue
  FROM "InvoiceLines" il
  JOIN "Invoices" i ON i.id = il."invoiceId"
  WHERE i.status <> 'Draft'
    AND il."companyId" = $2
    AND il."productId" = $1
    AND il."createdAt" >= now() - interval '30 days'

  UNION ALL

  -- Returns 
  SELECT
    i2."serviceId",
    (-cnl.qty)::numeric         AS units,
    -(COALESCE(cnl."subTotal", cnl.qty * cnl.price)
      - COALESCE(cnl."discountTotal", 0))::numeric AS revenue
  FROM "CreditNoteLines" cnl
  JOIN "CreditNotes" cn ON cn.id = cnl."creditNoteId"
  JOIN "Invoices" i2 ON i2.id = cn."invoiceId"
  WHERE i2."companyId" = $2
    AND cnl."productId" = $1
    AND cnl."createdAt" >= now() - interval '30 days'
)
SELECT
  r."serviceId",
  COALESCE(s.name, 'Other')                    AS "serviceName",
  SUM(r.units)                                 AS net_units,      -- sales - returns
  SUM(r.revenue)                               AS net_revenue,    -- sales - returns
  ROUND( (SUM(r.revenue)::numeric
          / NULLIF(SUM(SUM(r.revenue)) OVER (), 0)) * 100, 3)     AS net_revenue_pct,
  ROUND( (SUM(r.units)::numeric
          / NULLIF(SUM(SUM(r.units))   OVER (), 0)) * 100, 3)     AS net_units_pct
FROM rows r
LEFT JOIN "Services" s ON s.id = r."serviceId"
GROUP BY r."serviceId", s.name
ORDER BY net_revenue DESC;
