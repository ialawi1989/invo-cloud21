import { Injectable, computed, inject, signal } from '@angular/core';

import { PreviewService } from '../../../services/preview.service';
import { PublicNavigationApiService } from './public-navigation-api.service';
import { MobileIconBar, NavMenu } from '../models/navigation.types';

/**
 * Storefront navigation state. One source of truth for the header /
 * footer menus and the mobile icon bar, with two feeds:
 *
 *  • **Customizer preview** — when the page is embedded in the
 *    dashboard (`?customize=true`), menus stream in over postMessage
 *    via {@link PreviewService}. Those win immediately so edits paint live.
 *  • **Live site** — otherwise a one-shot `load()` pulls the published
 *    menus from the public API (tenant-aware, mirrors the blog client).
 *
 * Mirrors `BlogSettingsService`: signal-based, cached `load()` promise,
 * read-only computed views the header binds to directly.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private preview = inject(PreviewService);
  private api     = inject(PublicNavigationApiService);

  private _liveMenus  = signal<NavMenu[]>([]);
  private _liveMobile = signal<MobileIconBar | null>(null);
  private _loaded     = signal(false);
  private loading: Promise<void> | null = null;

  readonly loaded = this._loaded.asReadonly();

  /** Preview feed takes precedence whenever the dashboard has sent data. */
  private menus = computed<NavMenu[]>(() => {
    const fromPreview = this.preview.navigation()?.menus;
    if (fromPreview && fromPreview.length) return fromPreview;
    return this._liveMenus();
  });

  readonly primaryMenu = computed<NavMenu | null>(() =>
    this.menus().find(m => !m.isFooterMenu) ?? this.menus()[0] ?? null,
  );

  readonly footerMenu = computed<NavMenu | null>(() =>
    this.menus().find(m => m.isFooterMenu) ?? null,
  );

  readonly mobileBar = computed<MobileIconBar | null>(() => {
    const fromPreview = this.preview.navigation()?.mobileBar;
    if (fromPreview !== undefined && fromPreview !== null) return fromPreview;
    return this._liveMobile();
  });

  /** True once preview OR a completed live load has produced any menu. */
  readonly hasMenu = computed(() => (this.primaryMenu()?.list?.length ?? 0) > 0);

  /** One-shot load of the published navigation. Skipped in customize mode. */
  load(): Promise<void> {
    if (this.preview.isCustomizeMode()) { this._loaded.set(true); return Promise.resolve(); }
    return (this.loading ??= this.doLoad());
  }

  private async doLoad(): Promise<void> {
    try {
      const [menus, mobile] = await Promise.all([
        this.api.getMenus(),
        this.api.getMobileIconBar(),
      ]);
      this._liveMenus.set(menus);
      this._liveMobile.set(mobile);
    } catch {
      /* leave empty — header falls back to its default links */
    } finally {
      this._loaded.set(true);
    }
  }
}
