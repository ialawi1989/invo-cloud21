import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { withTranslations } from '@core/i18n/with-translations';
import { StorefrontUrlService } from '@core/auth/storefront-url.service';
import {
  SeoPageEditorModalComponent,
  SeoPageEditorData,
} from '@features/settings/seo/components/seo-page-editor-modal/seo-page-editor-modal.component';
import {
  evaluateAssistant,
  SeoSeverity,
} from '@features/settings/seo/services/seo-assistant';
import type { SeoPageRow } from '@features/settings/seo/services/seo.types';
import { SeoSettingsService } from '@features/settings/seo/services/seo.service';
import { SeoOverridesService } from '@features/settings/seo/services/seo-overrides.service';
import type { SeoOverridePatch } from '@features/settings/seo/services/seo-overrides.types';

import { Product } from '../../../../models/product-form.model';

/**
 * Product form — SEO Assistant card.
 *
 * Mirrors the Invo Stores "Edit SEO Settings" entry point: a compact
 * card showing the current focus keyword / title / meta plus a live
 * tally of failing assistant tasks. Clicking Edit opens the same
 * side-panel editor used under /settings/seo, pre-loaded with a
 * `SeoPageRow` projected from the product (name, description, image,
 * existing meta on `product.seo`).
 *
 * On save, the patched row is written back into `product.seo` and
 * the product is flagged dirty so the form's footer save button
 * picks it up. The card does *not* save the product itself — the
 * footer save flow owns the network round-trip.
 */
@Component({
  selector: 'app-pf-seo-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seo-settings.component.html',
  styleUrl: './seo-settings.component.scss',
})
export class SeoSettingsComponent implements OnInit {
  private modal      = inject(ModalService);
  private seo        = inject(SeoSettingsService);
  private overrides  = inject(SeoOverridesService);
  private toast      = inject(ToastService);
  private storefront = inject(StorefrontUrlService);

  constructor() {
    // The product form's own translations are loaded by its parent
    // component; the SEO card pulls in the settings/seo namespace
    // on top so its severity labels / "all done" copy resolve.
    withTranslations('settings/seo');

    // Refetch the SEO override whenever the bound product id changes
    // — covers the "navigate from product A → product B without
    // unmounting the form" case.
    effect(() => {
      const id = this.productInfo().id;
      if (id && id !== 'new') void this.fetchOverride(String(id));
      else                    this.overrideData.set({});
    });
  }

  productInfo = input.required<Product>();
  /** Kept for signature parity with other product-form sections so
   *  the renderer can pass it without special-casing. We don't bind
   *  to a sub-FormGroup because SEO writes through the polymorphic
   *  `SeoOverrides` endpoint, not the product save payload. */
  productForm = input.required<FormGroup>();

  /** Local override data — what the backend returned for this
   *  product (or `{}` for new / never-edited products). The editor
   *  modal patches this on Publish and we save through the
   *  `SeoOverrides` endpoint. */
  private overrideData = signal<SeoOverridePatch>({});

  ngOnInit(): void {
    // First-load path — for an existing product, fetch any saved
    // override row so the preview and assistant tally reflect what
    // the storefront would render. Brand-new products start empty.
    const id = this.productInfo().id;
    if (id && id !== 'new') void this.fetchOverride(String(id));
  }

  /** Pull the override row for one product from the polymorphic
   *  endpoint. Missing rows resolve as `{}` so the editor opens
   *  against the per-type defaults without an extra branch. */
  private async fetchOverride(productId: string): Promise<void> {
    const row = await this.overrides.getByOwner('product', productId);
    if (!row) { this.overrideData.set({}); return; }
    this.overrideData.set({
      focusKeyword:    row.focusKeyword,
      urlSlug:         row.urlSlug,
      titleTag:        row.titleTag,
      metaDescription: row.metaDescription,
      indexable:       row.indexable,
      ogTitle:         row.ogTitle,
      ogDescription:   row.ogDescription,
      ogImage:         row.ogImage,
      xTitle:          row.xTitle,
      xDescription:    row.xDescription,
      xImage:          row.xImage,
      robots:          row.robots,
      structuredData:  row.structuredData,
      additionalTags:  row.additionalTags,
      hreflangTags:    row.hreflangTags,
    });
  }

  // ─── Derived state ─────────────────────────────────────────────────────
  /** SeoPageRow projected from the product. Includes the page-content
   *  snapshots (h1Text / bodyText / images / videosCount) so the
   *  assistant can evaluate the H1, body-keyword, alt-text and
   *  visual-content checks against the real product. */
  row = computed<SeoPageRow>(() => {
    const p = this.productInfo();
    const seo = this.overrideData();
    // Storefront route is `/menu/product/{key}` — one segment. The key is
    // the slug when the product has one, falling back to the id.
    //
    // NOTE: the storefront resolves that segment as a product id today
    // (NewWebsite `:parent/product/:id` → `getProduct/:id`), so a slug URL
    // only resolves once slug lookup ships there. Until then this preview
    // shows the intended canonical URL, not a guaranteed-live one.
    const slug = seo.urlSlug?.trim() || slugify(p.name || '');
    const id = String(p.id ?? 'new');
    const pagePath = `/menu/product/${slug || id}`;
    // Real "main image" for the product. `defaultImage` is the
    // legacy flat field and is often blank — the live image usually
    // lives on `mediaUrl.defaultUrl` or the first `productMedia`
    // entry. Resolve in that order so the OG preview never falls
    // back to the empty "Upload Image" pad when the product has an
    // image attached. `||` (not `??`) so empty strings also fall
    // through to the next source.
    const mainImage = mainImageUrl(p);
    return {
      id,
      pageName:         p.name || 'Product',
      pageUrl:          pagePath,
      focusKeyword:     seo.focusKeyword     ?? '',
      titleTag:         seo.titleTag         ?? '',
      metaDescription:  seo.metaDescription  ?? '',
      indexable:        seo.indexable        ?? true,
      ogTitle:          seo.ogTitle,
      ogDescription:    seo.ogDescription,
      ogImage:          seo.ogImage          || mainImage,
      xTitle:           seo.xTitle,
      xDescription:     seo.xDescription,
      xImage:           seo.xImage           || mainImage,
      robots:           seo.robots as any,
      structuredData:   seo.structuredData,
      additionalTags:   seo.additionalTags,
      hreflangTags:     seo.hreflangTags,
      // Page-content snapshots for the assistant.
      h1Text:           p.name ?? '',
      bodyText:         stripHtml(p.description ?? ''),
      images:           collectImages(p),
      videosCount:      0,
      isBlogPost:       false,
      isMultilingual:   false,
    };
  });

  /** Fully-qualified live URL for the product's storefront page.
   *  Drives the "View live page" link rendered next to the preview
   *  card. Goes through `StorefrontUrlService` so dev / test / prod
   *  and custom domains all resolve correctly. */
  liveUrl = computed(() => this.storefront.pageUrl(this.row().pageUrl));

  assistant = computed(() => {
    const site = this.seo.document()?.sitePreferences;
    return evaluateAssistant({
      row:            this.row(),
      siteIndexable:  site?.allowIndexing ?? true,
      defaultOgImage: site?.generalOgImage ?? '',
    });
  });

  /** Severity tally for the four header chips on the card. */
  readonly severityRows: { key: SeoSeverity; labelKey: string }[] = [
    { key: 'critical', labelKey: 'SEO.ASSISTANT.SEVERITY.CRITICAL' },
    { key: 'high',     labelKey: 'SEO.ASSISTANT.SEVERITY.HIGH'     },
    { key: 'medium',   labelKey: 'SEO.ASSISTANT.SEVERITY.MEDIUM'   },
    { key: 'low',      labelKey: 'SEO.ASSISTANT.SEVERITY.LOW'      },
  ];

  /** Open the shared SEO editor modal pre-loaded with the projected
   *  row. When the modal resolves with a patched row, mirror its
   *  fields back onto `product.seo` and bump the tick so the
   *  preview/tally recompute. */
  async openEditor(): Promise<void> {
    const ref = this.modal.open<SeoPageEditorModalComponent, SeoPageEditorData, SeoPageRow>(
      SeoPageEditorModalComponent,
      {
        drawer:      true,
        // Wide enough for the Social-share two-column layout. The
        // modal's own SCSS collapses to one column under 720px.
        drawerWidth: '760px',
        data: {
          row:      this.row(),
          // Items-detail is the closest page-type for a product
          // detail page in the catalog, so the modal pulls its
          // default title-template / robots from there.
          typeSlug: 'items-detail',
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    const p = this.productInfo();
    const productId = String(p.id ?? '');
    // Brand-new products don't exist server-side yet, so there's
    // nowhere to attach the SEO row. Surface a hint and bail —
    // future enhancement could queue the SEO patch until the
    // product save completes.
    if (!productId || productId === 'new' || productId === '0') {
      this.toast.error('PRODUCTS.SEO.SAVE_AFTER_CREATE');
      return;
    }

    // The row's pageUrl carries the full storefront path — `/menu/product/`
    // plus the routing key. Strip the prefix so `urlSlug` persists as the
    // bare key (matching how the row is rebuilt on read), and drop it
    // entirely when the user left the id in place: that's "no slug", not a
    // slug that happens to be a UUID.
    const rawPath = (result.pageUrl ?? '').replace(/^\//, '');
    const prefix  = 'menu/product/';
    let slug      = rawPath.startsWith(prefix)
      ? rawPath.slice(prefix.length).replace(/^\//, '')
      : rawPath;
    if (slug === productId) slug = '';
    const patch: SeoOverridePatch = {
      focusKeyword:    result.focusKeyword,
      urlSlug:         slug,
      titleTag:        result.titleTag,
      metaDescription: result.metaDescription,
      indexable:       result.indexable,
      ogTitle:         result.ogTitle,
      ogDescription:   result.ogDescription,
      ogImage:         result.ogImage,
      xTitle:          result.xTitle,
      xDescription:    result.xDescription,
      xImage:          result.xImage,
      robots:          result.robots as any,
      structuredData:  result.structuredData,
      additionalTags:  result.additionalTags,
      hreflangTags:    result.hreflangTags,
    };

    // Optimistic — drop the patch into local state before the
    // round-trip so the card's preview / assistant tally update
    // immediately.
    this.overrideData.set(patch);

    try {
      await this.overrides.save('product', productId, patch);
      this.toast.success('COMMON.SAVED_OK');
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Slugify a free-text product name into a URL slug. Mirrors what
 *  the storefront would do server-side so the preview stays
 *  consistent before / after the first save. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip accents
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')  // keep Arabic block; collapse the rest
    .replace(/^-+|-+$/g, '');
}

/** Strip HTML tags from a rich-editor description so the assistant's
 *  body-keyword check matches against plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Resolve the product's "main image" URL. Walks the three places a
 *  product can carry its hero image, in priority order:
 *    1. `defaultImage` — legacy flat URL on the product payload.
 *    2. `mediaUrl.defaultUrl` — newer `ProductImage` nested object.
 *    3. `productMedia[0].defaultUrl` — gallery's first item.
 *  Returns '' when none of those produce a usable URL. */
function mainImageUrl(p: Product): string {
  const direct = p.defaultImage?.trim();
  if (direct) return direct;
  const media = p.mediaUrl?.defaultUrl?.trim();
  if (media) return media;
  const first = (p.productMedia ?? []).find(m => !!m?.defaultUrl);
  return first?.defaultUrl?.trim() ?? '';
}

/** Collect every image attached to the product into the shape the
 *  assistant expects. Walks the same sources as `mainImageUrl` plus
 *  every additional gallery entry so the alt-text task can flag
 *  any image that's missing a description. */
function collectImages(p: Product): { url?: string; altText?: string }[] {
  const out: { url?: string; altText?: string }[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined, altText: string) => {
    const u = (url ?? '').trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, altText });
  };
  push(p.defaultImage, (p.mediaUrl?.name ?? '').trim() || p.name || '');
  push(p.mediaUrl?.defaultUrl, (p.mediaUrl?.name ?? '').trim() || p.name || '');
  for (const m of p.productMedia ?? []) {
    push(m?.defaultUrl, (m?.['altText'] ?? m?.['name'] ?? '').toString().trim() || p.name || '');
  }
  return out;
}
