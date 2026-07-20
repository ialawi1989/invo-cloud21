/**
 * Field-name patterns shared across the custom-reports feature.
 *
 * Previously these lived as static fields on ChartPreviewComponent — they're
 * now centralised here so the renderer, the numeric coercion pass, and the
 * smart-marks classifier all reason about field naming the same way.
 *
 * The patterns are intentionally heuristic; backend `DataSourceField.type`
 * and `DataSourceField.numberFormat` always win when present. These rules
 * only kick in for fields whose declared type is `number` or unspecified
 * (i.e. the value parses as a number but is semantically text).
 */

/**
 * Field names that look like numbers but are really string identifiers
 * (barcode, SKU, phone, etc.). Must not be formatted with thousand
 * separators / decimals and must NOT be classified as a numeric measure.
 */
export const IDENTIFIER_FIELD_PATTERN =
  /(^|\.|_)(barcode|sku|ean|upc|isbn|gtin|imei|iban|postcode|postalcode|zip|zipcode|phone|mobile|fax|tel|telephone|cnic|nin|ssn|vatnumber|vatno|tin|taxno|trn|crn|reference|refno|invoiceno|invoicenumber|invoicenum|orderno|ordernumber|orderid|trackingno|trackingnumber|accountno|accountnumber|cardno|cardnumber|serial|serialno|serialnumber|pin|otp)$/i;

/**
 * Field names that are booleans (isX, hasX, canX, enabled / paid / …).
 * They coerce to 0/1 via Number() but must render as their true/false text.
 */
export const BOOLEAN_FIELD_PATTERN =
  /^(is|has|can|was|will|should|did|does)[A-Z_]|^(enabled|disabled|active|inactive|deleted|archived|completed|cancelled|canceled|paid|published|visible|hidden|locked|verified|approved|rejected|pending|default|primary|required|optional|valid|invalid|expired|featured|trial|premium|free)$/i;

/**
 * Field names that always represent whole-number counts. SUM / AVG / MIN /
 * MAX of these should render without decimals (e.g. SUM(GUESTS) = 2,594
 * not 2,594.000). Used by the cell renderer and by the classifier.
 */
export const INTEGER_FIELD_PATTERN =
  /(^|\.|_)(guests?|count|qty|quantity|items?|pax|seats?|orders?|transactions?|tables?|tickets?|visits?|persons?|people|rooms?|nights?)$/i;

/**
 * Extract the underlying field name from a column key like
 * `sum.OrdersTable.guests` → `guests`.
 */
export function fieldNameOf(key: string): string {
  if (!key) return '';
  const parts = key.split('.');
  return parts[parts.length - 1] || '';
}

/**
 * Extract the aggregation prefix from a column key, or empty string.
 * Recognised: 'sum' | 'count' | 'avg' | 'max' | 'min'.
 */
const AGG_PREFIXES = new Set(['sum', 'count', 'avg', 'max', 'min']);
export function aggregationPrefixOf(key: string): string {
  if (!key) return '';
  const head = key.split('.')[0];
  return AGG_PREFIXES.has(head) ? head : '';
}

/**
 * Extract the date-part prefix from a column key, or empty string.
 * Recognised: 'day' | 'month' | 'year' | 'yearmonth' | 'yearmonthday'.
 */
const DATE_PART_PREFIXES = new Set([
  'day', 'month', 'year', 'yearmonth', 'yearmonthday',
]);
export function datePartPrefixOf(key: string): string {
  if (!key) return '';
  const head = key.split('.')[0];
  return DATE_PART_PREFIXES.has(head) ? head : '';
}

/**
 * Foreign-key / primary-key suffix matchers. Kept case-sensitive on purpose
 * so plain English words ending in lowercase "id" (`void`, `Pyramid`,
 * `solenoid`, …) don't get misclassified — only `Id` (camelCase), `ID`
 * (all-caps), or `_id` (snake_case) qualify.
 */
const CAMEL_FK_RE = /[a-z0-9](Id|ID)$/;
const SNAKE_FK_RE = /_id$/i;

/**
 * True when the field name is an identifier-style string column.
 *
 * Covers three cases:
 *   1. The literal `id` / `Id` / `ID` field (most tables' primary key).
 *   2. Foreign-key suffix: `customerId`, `branchId`, `customer_id`, …
 *   3. The IDENTIFIER_FIELD_PATTERN list — barcode / sku / phone / vat /
 *      tracking / serial / etc.
 *
 * Used both by the table renderer (so a column of UUIDs isn't formatted
 * as numbers) and by the Data-tab quick-filter list (so unique-per-row
 * columns aren't surfaced as filter sections that nobody can use).
 */
export function isIdentifierFieldName(name: string): boolean {
  if (!name) return false;
  if (name.toLowerCase() === 'id') return true;
  if (CAMEL_FK_RE.test(name)) return true;
  if (SNAKE_FK_RE.test(name)) return true;
  return IDENTIFIER_FIELD_PATTERN.test(name);
}

/** True when the field name is a boolean-style flag column. */
export function isBooleanFieldName(name: string): boolean {
  return BOOLEAN_FIELD_PATTERN.test(name);
}

/** True when the field name describes a whole-number count. */
export function isIntegerFieldName(name: string): boolean {
  return INTEGER_FIELD_PATTERN.test(name);
}
