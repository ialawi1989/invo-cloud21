WITH last_po AS (
  SELECT
    po.id,
    po."purchaseNumber" AS num,
    SUM(pol.qty)        AS qty,
    COALESCE(po."purchaseDate", po."createdAt") AS dt
  FROM "PurchaseOrders" po
  JOIN "PurchaseOrderLines" pol ON pol."purchaseOrderId" = po.id
  WHERE pol."productId" = $1
  GROUP BY po.id, num, dt
  ORDER BY dt DESC, num DESC
  LIMIT 1
),
last_bill AS (
  SELECT
    b.id,
    b."billingNumber" AS num,
    SUM(bl.qty)       AS qty,
    COALESCE(b."billingDate", b."createdAt") AS dt,
    b."supplierId"    AS supplier_id
  FROM "Billings" b
  JOIN "BillingLines" bl ON bl."billingId" = b.id
  WHERE bl."productId" = $1
    AND COALESCE(b.status, '') <> 'Draft'
  GROUP BY b.id, num, dt, supplier_id
  ORDER BY dt DESC, num DESC
  LIMIT 1
),
-- Pick the latest invoice that has this product
last_invoice AS (
  SELECT
    i.id,
    i."invoiceNumber" AS num,
    COALESCE(i."invoiceDate", i."createdAt") AS dt
  FROM "Invoices" i
  WHERE i."companyId" = $2
    AND i.status <> 'Draft'
    AND EXISTS (
      SELECT 1
      FROM "InvoiceLines" il
      WHERE il."invoiceId" = i.id
        AND il."productId" = $1
    )
  ORDER BY dt DESC, i."invoiceNumber" DESC
  LIMIT 1
),
-- Sum the qty for that product inside the chosen invoice
last_sold AS (
  SELECT
    li.id,
    li.num,
    SUM(il.qty) AS qty,
    li.dt
  FROM last_invoice li
  JOIN "InvoiceLines" il
    ON il."invoiceId" = li.id
   AND il."productId" = $1
  GROUP BY li.id, li.num, li.dt
),
last_supplier AS (
  SELECT s.name
  FROM "Suppliers" s
  JOIN last_bill lb ON lb.supplier_id = s.id
)
SELECT
  po.id   AS "purchaseId",
  po.num  AS "Last PO",
  po.dt   AS "Last PO Date",
  po.qty  AS "Last PO Qty",

  lb.id   AS "billId",
  lb.num  AS "Last Bill",
  lb.dt   AS "Last Bill Date",
  lb.qty  AS "Last Bill Qty",

  ls.id   AS "invoiceId",
  ls.num  AS "Last Sold",
  ls.qty  AS "Last Sold Qty",
  ls.dt   AS "Last Sold Date",

  sup.name AS "Last Supplier"
FROM (VALUES (1)) v(dummy)
LEFT JOIN last_po       po  ON TRUE
LEFT JOIN last_bill     lb  ON TRUE
LEFT JOIN last_sold     ls  ON TRUE
LEFT JOIN last_supplier sup ON TRUE;