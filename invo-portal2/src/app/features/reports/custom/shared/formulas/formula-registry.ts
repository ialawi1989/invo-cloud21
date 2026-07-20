import { ReportFormula } from '../models/custom-report.model';

/**
 * Developer-maintained fallback registry of predefined formulas, keyed by data
 * source (table) id.
 *
 * SECURITY: this registry only ever contains a formula's `key`, `name` and
 * `type` — NEVER its SQL expression. The SQL lives exclusively in backend
 * metadata and is resolved server-side by `key` (see
 * docs/custom-reports-backend-api.md). End users can neither read nor edit it.
 *
 * Resolution order (see CustomReportsService.parseDataSourceMap):
 *   1. `formulas` returned by GET /getDataSource for the table (authoritative);
 *   2. otherwise this registry — handy for local development before the
 *      backend exposes a table's formulas.
 *
 * To add a formula you must ALSO add a matching backend definition (same key)
 * that supplies the SQL expression, otherwise the filter will fail at query
 * time. Example entries are commented out below.
 */
export const REPORT_FORMULAS: { [tableId: string]: ReportFormula[] } = {
  // Each entry needs a matching backend FORMULAS[key] = { type, sql } definition.
  // SQL shown in comments is the BACKEND expression — it is NOT stored here.
  BillLinesView: [
    // sql: ("BillLinesView"."qty" * "BillLinesView"."unitCost")
    { key: 'stockValue', name: 'Stock Value', type: 'number', numberFormat: 'currency' },
  ],
  PurchaseOrderLinesView: [
    // sql: ("PurchaseOrderLinesView"."qty" * "PurchaseOrderLinesView"."unitCost")
    { key: 'stockValue', name: 'Stock Value', type: 'number', numberFormat: 'currency' },
  ],
  SalesLinesView: [
    // sql: (("SalesLinesView"."price" - "SalesLinesView"."total") )  — example margin
    { key: 'lineMargin', name: 'Line Margin', type: 'number', numberFormat: 'currency' },
  ],
};
