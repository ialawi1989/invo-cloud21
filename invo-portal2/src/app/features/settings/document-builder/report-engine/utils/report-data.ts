import { CustomerAddress } from '../../../../account/customers/models/customer.model';

/** Address-shaped fields the API returns as objects rather than strings. */
const ADDRESS_FIELDS = ['customerAddress', 'supplierAddress', 'shippingAddress'] as const;

/**
 * Adapts a raw document record into the payload the report engine binds against (ported from legacy `toReportData`).
 * What the API record can't express on its own:
 *   - `companyLogo` / `companyName` / `companyVatNumber` — the tenant identity the header prints beside the logo.
 *   - `companyCurrency` / `companyDecimals` — read by the `Currency` / `Number` filters.
 *   - `companyNote` / `companyTerms` — the company-wide footer copy (live on the company record, not the document).
 *   - `language` — read by the `localizedName` filter so product names print translated.
 *   - address fields — objects interpolate as `[object Object]`, so they are flattened like the invoice list does.
 */
export function toReportData(
  document: Record<string, unknown> | null | undefined,
  company?: CompanyLike | null,
  language?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(document ?? {}) };

  for (const key of ADDRESS_FIELDS) {
    if (key in out) out[key] = addressText(out[key]);
  }

  out['companyLogo'] = company?.mediaUrl?.defaultUrl || company?.logoUrl || company?.logo || '';
  // The company record wins, but only when it carries a value — some payloads already ship `companyVatNumber`.
  out['companyName'] = company?.name || out['companyName'] || '';
  out['companyVatNumber'] = company?.vatNumber || company?.vat || out['companyVatNumber'] || '';
  out['companyCurrency'] = company?.settings?.currencySymbol || company?.currencySymbol || '';
  out['companyDecimals'] = company?.settings?.afterDecimal ?? company?.afterDecimal ?? 2;
  out['companyNote'] = company?.invoiceOptions?.note ?? '';
  out['companyTerms'] = company?.invoiceOptions?.term ?? '';
  out['language'] = language || out['language'] || '';
  return out;
}

/** The slice of the Company record the report engine binds against. */
export interface CompanyLike {
  name?: string;
  vatNumber?: string;
  vat?: string;
  currencySymbol?: string;
  afterDecimal?: number;
  logo?: string;
  logoUrl?: string;
  settings?: { currencySymbol?: string; afterDecimal?: number } | null;
  mediaUrl?: { defaultUrl?: string };
  invoiceOptions?: { note?: string; term?: string };
}

/** Renders an address value as a single line. Strings pass through. */
export function addressText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const address = new CustomerAddress();
  address.ParseJson(value);
  return address.toString().trim();
}
