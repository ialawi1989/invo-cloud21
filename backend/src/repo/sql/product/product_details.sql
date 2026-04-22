SELECT
  p.id,
  p.name,
  p."type"                            AS "type",
  p.barcode,
  p.description,
  d.name                               AS "departmentName",
  c.name                               AS "categoryName",
  b.name                               AS "brandName",
  p."defaultPrice",
  m.url->>'defaultUrl'                         AS "mediaUrl",
  p."UOM",
  p.sku
FROM "Products" p
LEFT JOIN "Categories"  c ON c.id = p."categoryId"
LEFT JOIN "Departments" d ON d.id = c."departmentId"
LEFT JOIN "Media" m on m.id = p."mediaId"
LEFT JOIN "Brands" b on b.id = p.brandid
WHERE p."companyId" = $2 and p.id = $1
ORDER BY p.name;