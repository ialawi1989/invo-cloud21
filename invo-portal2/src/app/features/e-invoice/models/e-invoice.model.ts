import { Invoice } from '../../account/models/invoice.model';

/** Payment method row of `eInvoice/getPaymentMethods/:companyId` (id, name, translation, icon, isEnabled, settings). */
export interface EInvoicePaymentMethod {
  id: string;
  name: string;
  translation?: { name?: Record<string, string> } | null;
  icon?: string | null;
  isEnabled: boolean;
  settings?: { Merchant_Identifier?: string } | null;
}

/** Mini company of `eInvoice/getInvoice` (backend `getMiniCompany`: id, country, name, slug + country settings). */
export interface EInvoiceCompany {
  id: string;
  name: string;
  slug?: string;
  country?: string;
  [key: string]: any;
}

export interface EInvoiceData {
  invoice: Invoice;
  company: EInvoiceCompany;
}

/** Result of `eInvoice/payInvoice`; `data` depends on the gateway (url / sessionId / BenefitPay config). */
export interface EInvoicePayResponse {
  success: boolean;
  msg?: string;
  ms?: string;
  data?: any;
}

/** The link token is `base64(companyId + '|+|' + invoiceId)` - exactly what the backend builds in its payment redirects. */
export function decodeEInvoiceToken(token: string | null): { companyId: string; invoiceId: string } | null {
  try {
    const [companyId, invoiceId] = atob(token ?? '').split('|+|');
    return companyId && invoiceId ? { companyId, invoiceId } : null;
  } catch {
    return null;
  }
}
