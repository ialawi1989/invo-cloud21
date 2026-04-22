WITH il_rows AS (
  SELECT
    il."createdAt",
    i.id as "transactionId",
    i."invoiceNumber"  AS "transactionNumber",
    'invoice'          AS "transactionType",
    b.name             AS "branchName",
    c.name             AS "customerName",
    il."voidReason",
    il.qty,
    il.price,
    COALESCE(ilo.options_total, 0) AS "optionsTotal",
    CASE
      WHEN il."isInclusiveTax" THEN il."subTotal" - il."discountTotal" - il."taxTotal"
      ELSE il."subTotal" - il."discountTotal"
    END AS "subTotal",
    il."discountTotal",
    il."taxTotal",
    il.total,
    il.serial,
    il.batch,
    CASE WHEN il.qty > 0 THEN 'Sale'
         WHEN il.qty < 0 AND il.waste THEN 'Wastage'
         ELSE 'Void' END AS "type"
  FROM "InvoiceLines" il
  JOIN "Invoices" i ON i.id = il."invoiceId"
  LEFT JOIN LATERAL (
    SELECT SUM(o.qty * o.price) AS options_total
    FROM "InvoiceLineOptions" o
    WHERE o."invoiceLineId" = il.id
  ) ilo ON true
  JOIN "Branches" b ON b.id = i."branchId"
  LEFT JOIN "Customers" c ON c.id = i."customerId"
  WHERE i.status <> 'Draft'
    AND il."companyId" = $2
    AND il."productId" = $1
  ORDER BY il."createdAt" DESC, i."invoiceNumber" DESC
  LIMIT (($3)::int + ($4)::int + 1)               -- branch cap to avoid scanning everything
),
cn_rows AS (
  SELECT
    cnl."createdAt",
    cn.id as "transactionId",
    cn."creditNoteNumber" AS "transactionNumber",
    'credit_note'         AS "transactionType",
    b.name                AS "branchName",
    c.name                AS "customerName",
    NULL::text            AS "voidReason",
    cnl.qty,
    cnl.price,
    COALESCE(cnlo.options_total, 0) AS "optionsTotal",
    CASE
      WHEN cnl."isInclusiveTax" THEN cnl."subTotal" - cnl."taxTotal"
      ELSE cnl."subTotal"
    END AS "subTotal",
    cnl."discountTotal",
    cnl."taxTotal",
    cnl.total,
    cnl.serial,
    cnl.batch,
    'Return'              AS "type"
  FROM "CreditNoteLines" cnl
  JOIN "CreditNotes" cn ON cn.id = cnl."creditNoteId"
  LEFT JOIN LATERAL (
    SELECT SUM(o.qty * o.price) AS options_total
    FROM "CreditNoteLineOptions" o
    WHERE o."creditNoteLineId" = cnl.id
  ) cnlo ON true
  JOIN "Branches" b ON b.id = cn."branchId"
  JOIN "Invoices" i ON i.id = cn."invoiceId"
  LEFT JOIN "Customers" c ON c.id = i."customerId"
  WHERE cnl."companyId" = $2
    AND cnl."productId" = $1
  ORDER BY cnl."createdAt" DESC, cn."creditNoteNumber" DESC
  LIMIT (($3)::int + ($4)::int + 1)               -- branch cap
),
merged AS (
  SELECT * FROM il_rows
  UNION ALL
  SELECT * FROM cn_rows
),
-- fetch one extra row past the requested page
page_plus AS (
  SELECT *
  FROM merged
  ORDER BY "createdAt" DESC, "transactionNumber" DESC
  LIMIT (($3)::int + 1) OFFSET ($4)::int
),
has AS (
  SELECT (COUNT(*) = (($3)::int + 1)) AS has_next
  FROM page_plus
)
SELECT p.*, h.has_next
FROM (SELECT * FROM page_plus LIMIT ($3)::int) AS p
CROSS JOIN has AS h;