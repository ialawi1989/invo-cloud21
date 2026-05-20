import { Injectable, inject, signal } from '@angular/core';
import { PublicBlogApiService } from './public-blog-api.service';
import { PublicBlogSettings, defaultPublicBlogSettings } from '../models/blog-settings.types';

/**
 * One-shot settings cache. Public blog settings barely change, so we
 * load them once per session and reuse the value everywhere. Pages
 * await `load()` on mount; concurrent callers share the same promise
 * so we only ever fire one network request.
 */
@Injectable({ providedIn: 'root' })
export class BlogSettingsService {
  private api = inject(PublicBlogApiService);
  private _settings = signal<PublicBlogSettings>(defaultPublicBlogSettings());
  private _loaded   = signal<boolean>(false);
  private inflight: Promise<PublicBlogSettings> | null = null;

  settings = this._settings.asReadonly();
  loaded   = this._loaded.asReadonly();

  load(): Promise<PublicBlogSettings> {
    if (this._loaded()) return Promise.resolve(this._settings());
    if (this.inflight)  return this.inflight;
    this.inflight = (async () => {
      try {
        const s = await this.api.getPublicSettings();
        this._settings.set(s);
        this._loaded.set(true);
        return s;
      } catch {
        // Backend unavailable (no slug, endpoint not deployed, network
        // error) — fall back to safe defaults so SSR can still finish
        // rendering the page chrome instead of crashing with an
        // unhandled promise rejection and a stock Express 404.
        const fallback = defaultPublicBlogSettings();
        this._settings.set(fallback);
        this._loaded.set(true);
        return fallback;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  isRtl(lang: string): boolean {
    return this._settings().languages.rtlLanguages.includes(lang);
  }
}
