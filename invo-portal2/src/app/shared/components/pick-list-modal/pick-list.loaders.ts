import { ApiService } from '@core/http/api.service';

import { PickListLoader, PickedListItem } from './pick-list-modal.component';

/**
 * Ready-made loaders for `<app-pick-list-modal>`. Kept beside the modal so a
 * caller wiring up a picker doesn't have to know the endpoint or the response
 * quirks — pass `categoryLoader(api)` and be done.
 */

/** Categories — `product/getCategoryList`. */
export function categoryLoader(api: ApiService): PickListLoader {
  return async ({ page, limit, searchTerm }) => {
    const res = await api.request<any>(
      api.post('product/getCategoryList', { page, limit, searchTerm, sortBy: {} }),
    );
    const data = res?.data ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    const list: PickedListItem[] = raw
      .map((c) => ({
        id: String(c?.id ?? c?._id ?? ''),
        name: flattenName(c),
        image: c?.mediaUrl?.thumbnailUrl ?? c?.image ?? undefined,
      }))
      .filter((c) => c.id);
    return { list, count: Number(data?.count ?? raw.length) || 0 };
  };
}

/**
 * `name` may arrive as a translation map rather than a string — prefer the
 * pre-resolved `displayName`, else the first non-empty value in the map.
 */
function flattenName(raw: any): string {
  const dn = raw?.displayName;
  if (typeof dn === 'string' && dn.trim()) return dn;
  const n = raw?.name;
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object') {
    for (const v of Object.values(n)) {
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return '';
}
