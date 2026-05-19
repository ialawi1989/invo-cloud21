import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { DEFAULT_SEO_CUSTOMIZE_DEFAULTS, EMPTY_SEO_DOCUMENT } from './seo.config';
import type {
  SeoCustomizeDefaults,
  SeoPageTypeSettings,
  SeoSettingsDocument,
  SeoSitePreferences,
} from './seo.types';

/**
 * SEO Settings — persistence layer for the *document* (site
 * preferences + per-type defaults). Per-resource overrides used to
 * live inside this document under `pageTypes[slug].pages[]`; they
 * now persist in a dedicated polymorphic `SeoOverrides` table via
 * `SeoOverridesService`, so this service is intentionally narrow:
 *
 *   • Owns the `SeoSettingsDocument` (a small JSON blob — site
 *     prefs + a `defaults` bundle per page type).
 *   • Reads / writes through the existing generic theme endpoints,
 *     discriminated with `type: 'SeoSettings'`.
 *
 * State is signal-based so consumers bind directly without
 * subscribing: read `document()`, mutate via `patchSitePreferences`
 * / `patchPageTypeDefaults`, persist with `save()`. Patches are
 * optimistic — the signal updates immediately, the HTTP round-trip
 * settles asynchronously.
 */
const ENDPOINT_LOAD = 'company/getThemeByType';
const ENDPOINT_SAVE = 'company/saveWebsiteTheme';
const DOC_TYPE      = 'SeoSettings';

@Injectable({ providedIn: 'root' })
export class SeoSettingsService {
  private http    = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  /** Reactive root document — `null` until `load()` resolves. */
  private _doc = signal<SeoSettingsDocument | null>(null);

  /** Backend row id for THIS company's SEO document. Captured on
   *  load and round-tripped on every save so the controller updates
   *  the existing row instead of inserting a fresh one each time —
   *  the `saveWebsiteTheme` endpoint splits update / insert on the
   *  presence of `id`. */
  private _docId: string | null = null;

  /** Public read-only view. Components bind to `document()` and
   *  re-render automatically when the service emits. */
  readonly document = this._doc.asReadonly();
  readonly loaded   = computed(() => this._doc() !== null);

  /** Resolve a single page-type bundle by slug. Synthesises a default
   *  bundle on the fly when the user hasn't customised this type
   *  yet, so the editor never has to special-case "first open". */
  pageType(slug: string): SeoPageTypeSettings {
    const doc = this._doc() ?? EMPTY_SEO_DOCUMENT();
    const found = doc.pageTypes[slug];
    if (found) return found;
    return {
      type:     slug,
      defaults: DEFAULT_SEO_CUSTOMIZE_DEFAULTS(),
    };
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}${ENDPOINT_LOAD}`, { type: DOC_TYPE }),
      );
      // Backend stores a list of typed blobs; the SEO doc is a
      // singleton so we take the first match (or the legacy single
      // payload, depending on backend version). Capture the row's
      // backend `id` here so the next `save()` can target the same
      // row instead of inserting a duplicate — `saveWebsiteTheme`
      // dispatches update / insert based on `data.id`.
      const row     = res?.data?.list?.[0] ?? res?.data ?? null;
      const payload = row?.template ?? row ?? null;
      this._docId = row?.id ?? null;
      this._doc.set(payload ? mergeWithDefaults(payload) : EMPTY_SEO_DOCUMENT());
    } catch {
      // Network / 404 falls through to an empty doc — the editor
      // still works and the first save creates the row server-side.
      this._docId = null;
      this._doc.set(EMPTY_SEO_DOCUMENT());
    }
  }

  // ─── Mutations ──────────────────────────────────────────────────────────

  /** Replace the site-level preferences bundle. Optimistic — emits
   *  immediately so any open editor re-renders before save() returns. */
  patchSitePreferences(patch: Partial<SeoSitePreferences>): void {
    const doc = this._doc() ?? EMPTY_SEO_DOCUMENT();
    this._doc.set({
      ...doc,
      sitePreferences: { ...doc.sitePreferences, ...patch },
    });
  }

  /** Patch one page-type's customize-defaults bundle. Sparse — only
   *  the keys present in `patch` overwrite; everything else stays
   *  intact (Invo's editor saves sub-cards independently and we want
   *  the same granularity). */
  patchPageTypeDefaults(slug: string, patch: Partial<SeoCustomizeDefaults>): void {
    const doc  = this._doc() ?? EMPTY_SEO_DOCUMENT();
    const cur  = this.pageType(slug);
    const next: SeoPageTypeSettings = {
      ...cur,
      defaults: { ...cur.defaults, ...patch },
    };
    this._doc.set({ ...doc, pageTypes: { ...doc.pageTypes, [slug]: next } });
  }

  // ─── Save ───────────────────────────────────────────────────────────────

  /** Persist the current root document. Throws on network error so
   *  callers can surface a toast; on success the local signal is
   *  already up-to-date thanks to the optimistic patch functions.
   *
   *  Sends the captured row `id` when present so the backend
   *  controller's `data.id != null` branch runs the UPDATE path
   *  instead of inserting a new row on every save. The first save
   *  (no id yet) inserts; the response carries the new id back,
   *  which we capture for subsequent saves. */
  async save(): Promise<void> {
    const doc = this._doc() ?? EMPTY_SEO_DOCUMENT();
    const body: Record<string, unknown> = {
      type:     DOC_TYPE,
      template: doc,
    };
    if (this._docId) body['id'] = this._docId;

    const res = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}${ENDPOINT_SAVE}`, body),
    );

    // Capture the id from the insert response so the next call to
    // `save()` hits the update branch. Response shape varies a
    // little between insert / update — try the common landing
    // points and ignore failures (the next `load()` would still
    // recapture).
    const returnedId = res?.data?.id ?? res?.id ?? res?.data?.list?.[0]?.id ?? null;
    if (returnedId) this._docId = String(returnedId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Merge a possibly-partial backend payload with the empty document
 *  shape so consumers can always rely on the full nested structure
 *  (no `?.` chains in every consumer). */
function mergeWithDefaults(partial: any): SeoSettingsDocument {
  const empty = EMPTY_SEO_DOCUMENT();
  return {
    sitePreferences: { ...empty.sitePreferences, ...(partial?.sitePreferences ?? {}) },
    pageTypes:       partial?.pageTypes ?? {},
  };
}
