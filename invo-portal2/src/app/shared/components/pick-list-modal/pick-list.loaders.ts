import { ApiService } from '@core/http/api.service';
import { TranslateService } from '@ngx-translate/core';

import { resolveLocalizedName } from '@shared/utils/localized-name';

import { PickListLoader, PickedListItem } from './pick-list-modal.component';

/**
 * Ready-made loaders for `<app-pick-list-modal>`. Kept beside the modal so a
 * caller wiring up a picker doesn't have to know the endpoint or the response
 * quirks — pass `categoryLoader(api, translate)` and be done.
 */

/** Categories — `product/getCategoryList`. `translate` resolves each row's
 *  name in the active UI language (via `resolveLocalizedName`), falling
 *  back to the base name — same convention as `LocalizedNamePipe`. */
export function categoryLoader(api: ApiService, translate: TranslateService): PickListLoader {
  return async ({ page, limit, searchTerm }) => {
    const res = await api.request<any>(
      api.post('product/getCategoryList', { page, limit, searchTerm, sortBy: {} }),
    );
    const data = res?.data ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    const list: PickedListItem[] = raw
      .map((c) => ({
        id: String(c?.id ?? c?._id ?? ''),
        name: resolveLocalizedName(c, translate.currentLang),
        image: c?.mediaUrl?.thumbnailUrl ?? c?.image ?? undefined,
      }))
      .filter((c) => c.id);
    return { list, count: Number(data?.count ?? raw.length) || 0 };
  };
}
