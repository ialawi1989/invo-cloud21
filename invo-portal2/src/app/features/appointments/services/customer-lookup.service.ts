import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

export interface CustomerLite {
  id: string;
  name: string;
  phone?: string;
}

/**
 * Minimal customer search for the appointment form's customer field.
 * invo-portal2 doesn't have a Customers feature yet (the sidebar's
 * `/account/customers` link has no route behind it), so this wraps just
 * the two legacy endpoints the appointment form actually needs rather than
 * building a full customer module here — verified against
 * `InvoCloudFront2/src/app/core/services/customers/customers.service.ts`.
 */
@Injectable({ providedIn: 'root' })
export class CustomerLookupService {
  private api = inject(ApiService);

  async search(term: string, page = 1, limit = 20): Promise<{ items: CustomerLite[]; hasMore: boolean }> {
    const res = await this.api.request<any>(
      this.api.post('accounts/getCustomerMiniList', { page, limit, searchTerm: term }),
    );
    const body: any = res;
    const list: any[] = body?.data?.list ?? (Array.isArray(body?.data) ? body.data : []);
    const items = list.map(toLite);
    return { items, hasMore: items.length >= limit };
  }

  async getById(id: string): Promise<CustomerLite | null> {
    const res = await this.api.request<any>(this.api.get(`accounts/getCustomer/${id}`));
    const body: any = res;
    const raw = body?.data ?? null;
    return raw ? toLite(raw) : null;
  }
}

function toLite(raw: any): CustomerLite {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: raw.name ?? raw.customerName ?? '',
    phone: raw.phone ?? raw.phoneNumber ?? raw.customerContact ?? undefined,
  };
}
