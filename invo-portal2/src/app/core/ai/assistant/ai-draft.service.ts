import { Injectable } from '@angular/core';

/** What the assistant prepared for a new invoice: the customer (if any), the lines and a note. */
export interface InvoiceDraft {
  customerId: string | null;
  note: string;
  lines: { productId: string; qty: number }[];
}

/**
 * Hand-off between the assistant and the document forms. The assistant only ever *prepares* a draft here; the form
 * that opens reads it once, fills itself through its normal paths and the user reviews and saves as usual, so no
 * save flow is bypassed. It also remembers which customers and products were really returned by a lookup, so a draft
 * can only reference records the assistant actually found (never an id the model made up).
 */
@Injectable({ providedIn: 'root' })
export class AiDraftService {
  /** Products returned by `find_products`, by id (the form re-fetches them with the customer's pricing). */
  readonly products = new Map<string, any>();
  /** Customer ids returned by `find_customers`. */
  readonly customerIds = new Set<string>();

  private invoice: InvoiceDraft | null = null;

  setInvoice(d: InvoiceDraft): void { this.invoice = d; }

  /** Returns the pending invoice draft once; a second call gets nothing. */
  takeInvoice(): InvoiceDraft | null {
    const d = this.invoice;
    this.invoice = null;
    return d;
  }

  /** Forget everything (a new chat). */
  clear(): void {
    this.products.clear();
    this.customerIds.clear();
    this.invoice = null;
  }
}
