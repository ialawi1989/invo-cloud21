import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../http';

/**
 * Minimal shape needed by callers that just show service names next to
 * checkboxes (product-form's inventory-details "Exclude Deduction", etc.).
 * The full Service model (with branches / options / media) lives in the
 * services feature; this mini list is a load-once cache for pickers.
 */
export interface ServiceMini {
  id:   string;
  name: string;
  /** `default` and `selected` are kept loose — some callers care, most don't. */
  default?: boolean;
}

/**
 * Company-wide list of "services" (order-source channels like Dine-in,
 * Delivery, Take-away, etc. — NOT the same thing as the Angular DI concept).
 *
 * One fetch per session; subsequent callers read from the cached signal.
 * Follows the same load-once pattern as `BranchConnectionService`.
 *
 * Endpoint: `POST branch/getServicList` with no params returns the full list
 * (old `ServiceManagementService.getServicList()` contract).
 */
@Injectable({ providedIn: 'root' })
export class ServiceListService {
  private api = inject(ApiService);

  services = signal<ServiceMini[]>([]);
  loaded   = signal<boolean>(false);
  /** Set while the first `load()` is in flight — lets callers await it. */
  private pending: Promise<ServiceMini[]> | null = null;

  /**
   * Fetches the full list once and caches it. Concurrent callers share the
   * same in-flight promise instead of firing duplicate requests.
   */
  async load(force = false): Promise<ServiceMini[]> {
    if (this.loaded() && !force) return this.services();
    if (this.pending) return this.pending;

    this.pending = (async () => {
      try {
        const res = await this.api.request<any>(
          this.api.post('branch/getServicList', {}),
        );
        const raw: any[] =
          res?.data?.list ?? (Array.isArray(res?.data) ? res?.data : []) ?? [];
        const list: ServiceMini[] = raw.map((s) => ({
          id:      s.id   ?? s._id ?? '',
          name:    s.name ?? '',
          default: !!s.default,
        }));
        this.services.set(list);
        return list;
      } catch {
        this.services.set([]);
        return [];
      } finally {
        this.loaded.set(true);
        this.pending = null;
      }
    })();

    return this.pending;
  }
}
