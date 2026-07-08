import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SidebarOptions {
  favorites:   { label: string; link: string }[];
  recentPages: { label: string; link: string }[];
}

export interface ListColumnPref {
  key: string;
  visible: boolean;
  order: number;
  /** Per-item layout inside a grouped cell. */
  displayStyle?: 'inline' | 'newLine';
  /** User-set column width in px (from the header resize handle). Omitted when
   *  the column uses its default/auto sizing. */
  width?: number;
}

export interface ListPreference {
  columns: ListColumnPref[];
}

/**
 * Persisted state for a single instance of the branch-tabs UX. Multiple
 * call sites can use the tabs component simultaneously (each with its own
 * pinned/recent/open lists) by providing a unique namespace via
 * `provideBranchTabs(namespace)`.
 */
export interface BranchTabsPreference {
  openTabIds:  string[];
  activeTabId: string | null;
  pinnedIds:   string[];
}

/** Row layout — only ratios for two-column rows are exposed to the
 *  user. `single` means the row is one full-width column. */
export type ProductFormRowLayout = 'single' | '2-1' | '1-1' | '1-2';

/** Per-section override on the product-form layout. Sections not
 *  listed in `sections[]` fall back to their catalog defaults — so
 *  new sections shipped after the user saved their prefs still show
 *  up in the right place.
 *
 *  `side` lets the user move a section across the main↔side
 *  columns; when omitted the catalog's default side wins. The
 *  newer `row` / `col` fields will be used by the upcoming
 *  multi-row layout — they're left optional so existing saves
 *  load without migration. */
export interface ProductFormSectionPref {
  id:      string;
  visible: boolean;
  order:   number;
  side?:   'main' | 'aside';
  row?:    number;
  col?:    'left' | 'right';
}

export interface ProductFormPrefs {
  sections: ProductFormSectionPref[];
  /** Per-row layout. Index matches `ProductFormSectionPref.row`.
   *  When omitted (or shorter than the highest row index referenced
   *  by sections), missing rows default to `'2-1'`. */
  rows?: ProductFormRowLayout[];
}

/** Prefs are keyed by product type — each type (inventory, batch,
 *  service, kit, …) has its own layout because the relevant
 *  sections differ wildly between types. The `*` key is the
 *  fallback used when no per-type override exists. */
export type ProductFormPrefsByType = { [productType: string]: ProductFormPrefs };

export interface EmployeeOptions {
  sidebar?: SidebarOptions;
  /** Per-entity list preferences, keyed by entity type (e.g. 'product'). */
  lists?: { [entityType: string]: ListPreference };
  /** Per-namespace branch-tabs preferences (e.g. 'productForm.branches'). */
  branchTabs?: { [namespace: string]: BranchTabsPreference };
  /** User layout for the product form — section visibility + order,
   *  keyed by product type so e.g. service products and kit products
   *  can each carry their own layout. */
  productForm?: ProductFormPrefsByType;
}

@Injectable({ providedIn: 'root' })
export class EmployeeOptionsService {
  private http = inject(HttpClient);
  private base = environment.backendUrl;

  private cached: EmployeeOptions | null = null;
  private loaded = false;
  private pendingGet: Promise<EmployeeOptions | null> | null = null;

  async get(): Promise<EmployeeOptions | null> {
    // Track loaded separately so a null/empty response doesn't trigger
    // a re-fetch on every subsequent call — `cached` can legitimately
    // be null when the server hasn't seen this employee before.
    if (this.loaded) return this.cached;
    if (this.pendingGet) return this.pendingGet;

    this.pendingGet = (async () => {
      try {
        const res: any = await firstValueFrom(
          this.http.get(`${this.base}/employee/getEmployeeOptions`)
        );
        this.cached = res?.data ?? res ?? null;
        this.loaded = true;
        return this.cached;
      } catch {
        // A failed load still counts as "we tried" — don't hammer the
        // endpoint on every call. The user can refresh to retry.
        this.loaded = true;
        return null;
      } finally {
        this.pendingGet = null;
      }
    })();

    return this.pendingGet;
  }

  async set(options: EmployeeOptions): Promise<void> {
    this.cached = options;
    this.loaded = true;
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/employee/setEmployeeOptions`, options)
      );
    } catch { /* fail silently */ }
  }

  async patch(patch: Partial<EmployeeOptions>): Promise<void> {
    const current = (await this.get()) ?? {};
    await this.set({ ...current, ...patch });
  }
}
