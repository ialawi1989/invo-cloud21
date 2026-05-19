import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '@features/settings/media/components/media-picker/media-picker-modal.component';
import type { Media } from '@features/settings/media/models/media.model';

import { SEO_PAGE_TYPES } from '../../services/seo.config';
import { SeoSettingsService } from '../../services/seo.service';
import type { SeoPageType } from '../../services/seo.types';

/**
 * SEO Settings — landing page.
 *
 * Surfaces three sections in one scroll:
 *   1. Original-language notice — sticky info banner mirroring Invo's
 *      "These settings are only for your site's original language" hint.
 *   2. Edit-by-page-type catalog — tile grid of every page type the
 *      storefront ships (Main pages, Items list, Services list, Blog
 *      posts, …). Clicking a tile navigates to `/settings/seo/:slug`.
 *   3. Site preferences — master indexing toggle and general og:image.
 *
 * Persistence is delegated to `SeoSettingsService` — this component
 * just reads/patches signals.
 */
@Component({
  selector: 'app-seo-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seo-landing.component.html',
  styleUrl: './seo-landing.component.scss',
})
export class SeoLandingComponent implements OnInit {
  private seo       = inject(SeoSettingsService);
  private toast     = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private modal     = inject(ModalService);

  loading = signal(true);
  saving  = signal(false);

  readonly pageTypes = SEO_PAGE_TYPES;
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Settings', routerLink: '/settings' },
    { label: 'SEO Settings' },
  ];

  /** Split the catalog into two columns so the grid mirrors Invo's
   *  side-by-side layout exactly. Left column gets the odd indices,
   *  right gets the even ones — matches the screenshot reference. */
  readonly leftColumn  = this.pageTypes.filter((_, i) => i % 2 === 0);
  readonly rightColumn = this.pageTypes.filter((_, i) => i % 2 === 1);

  /** Sanitised icon strings — memoised per page type so we don't
   *  re-trust the same SVG markup on every change-detection run. */
  private iconCache = new Map<string, SafeHtml>();
  icon(t: SeoPageType): SafeHtml {
    let cached = this.iconCache.get(t.slug);
    if (!cached) {
      cached = this.sanitizer.bypassSecurityTrustHtml(t.icon);
      this.iconCache.set(t.slug, cached);
    }
    return cached;
  }

  /** Read-only mirrors of the SEO document signals so the template
   *  can react to optimistic patches without exposing the full doc. */
  allowIndexing  = computed(() => this.seo.document()?.sitePreferences.allowIndexing ?? true);
  generalOgImage = computed(() => this.seo.document()?.sitePreferences.generalOgImage ?? '');

  constructor() {
    withTranslations('settings/seo');
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.seo.load();
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Site preferences mutations ─────────────────────────────────────────
  async setAllowIndexing(allow: boolean): Promise<void> {
    this.seo.patchSitePreferences({ allowIndexing: allow });
    await this.persist();
  }

  async setGeneralOgImage(url: string): Promise<void> {
    this.seo.patchSitePreferences({ generalOgImage: url });
    await this.persist();
  }

  /** Open the shared media picker to choose the site-wide default
   *  og:image. Mirrors how the product image card opens the picker —
   *  same modal, same `Media` result shape — so future picker
   *  improvements (search, folders, filters) land here for free. */
  async pickGeneralOgImage(): Promise<void> {
    const config: MediaPickerConfig = {
      contentTypes: ['image'],
      multiple:     false,
      title:        'Choose default og:image',
    };
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      { data: config, size: 'xl' },
    );
    const result = await ref.afterClosed();
    const picked = Array.isArray(result) ? result[0] : result;
    if (!picked) return;
    const url = picked.url?.defaultUrl ?? picked.url?.original ?? '';
    if (!url) return;
    await this.setGeneralOgImage(url);
  }

  /** Clear the site-wide default og:image. Empty string persists so
   *  the storefront falls back to whatever the per-type / per-page
   *  setting resolves to. */
  async clearGeneralOgImage(): Promise<void> {
    await this.setGeneralOgImage('');
  }

  /** Shared optimistic-save helper. The patch is already in the
   *  signal state by the time this runs, so a network failure
   *  surfaces only as an error toast — the visible UI doesn't
   *  flicker. */
  private async persist(): Promise<void> {
    this.saving.set(true);
    try {
      await this.seo.save();
      this.toast.success('COMMON.SAVED_OK');
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
