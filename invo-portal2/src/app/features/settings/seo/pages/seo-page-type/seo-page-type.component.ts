import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { StorefrontUrlService } from '@core/auth/storefront-url.service';
import { CompanyService } from '@core/auth/company.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { SEO_PAGE_TYPES } from '../../services/seo.config';
import { SeoSettingsService } from '../../services/seo.service';
import { SeoOverridesService } from '../../services/seo-overrides.service';
import { ownerTypeFromSlug } from '../../services/seo-overrides.types';
import type { SeoOverrideListRow, SeoOverridePatch } from '../../services/seo-overrides.types';
import type { SeoPageRow, SeoPageType } from '../../services/seo.types';
import { SeoPageEditorModalComponent, SeoPageEditorData } from '../../components/seo-page-editor-modal/seo-page-editor-modal.component';
import { SeoCustomizeDefaultsComponent } from '../../components/seo-customize-defaults/seo-customize-defaults.component';

type Tab = 'edit-by-page' | 'customize-defaults';

/**
 * SEO page-type editor — `/settings/seo/:type`.
 *
 * Two-tab UI matching Invo exactly:
 *   • Edit by page — paginated table of every page of this type
 *     with focus-keyword / title / meta / indexable columns and a
 *     side-panel editor opened via `Edit`. Page rows come from the
 *     backend `Page` resource via `seo.loadPages()`; the editor
 *     persists overrides into the SEO settings document.
 *   • Customize defaults — five sub-cards (Basics & Social, Page
 *     URL, Structured data, Robots, Additional tags) edit the
 *     bundle applied to every page of this type when the per-page
 *     row leaves a field blank.
 */
@Component({
  selector: 'app-seo-page-type',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SegmentedToggleComponent,
    SeoCustomizeDefaultsComponent,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seo-page-type.component.html',
  styleUrl: './seo-page-type.component.scss',
})
export class SeoPageTypeComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private seo        = inject(SeoSettingsService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private storefront = inject(StorefrontUrlService);
  private companies  = inject(CompanyService);
  private overrides  = inject(SeoOverridesService);

  /** Resolve a page row to the full live storefront URL. Driven by
   *  `StorefrontUrlService` so dev / test / prod and custom domains
   *  all funnel through one helper. */
  liveUrl = (row: SeoPageRow): string => this.storefront.pageUrl(row.pageUrl);

  // ─── Route + catalog state ──────────────────────────────────────────────
  typeSlug = signal<string>('');
  typeDef  = computed<SeoPageType | null>(() =>
    SEO_PAGE_TYPES.find(t => t.slug === this.typeSlug()) ?? null,
  );

  // ─── Tab state ─────────────────────────────────────────────────────────
  activeTab = signal<Tab>('edit-by-page');
  readonly tabOptions: SegmentedToggleOption<Tab>[] = [
    { value: 'edit-by-page',       label: 'SEO.TYPE_EDITOR.EDIT_BY_PAGE' },
    { value: 'customize-defaults', label: 'SEO.TYPE_EDITOR.CUSTOMIZE' },
  ];

  // ─── Edit-by-page list state ───────────────────────────────────────────
  loading     = signal(true);
  pages       = signal<SeoPageRow[]>([]);
  count       = signal<number>(0);
  page        = signal<number>(1);
  pageSize    = signal<number>(15);
  searchQuery = signal<string>('');
  private searchInput$ = new Subject<string>();

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const typeLabel = this.typeDef()
      ? this.translate.instant(this.typeDef()!.labelKey)
      : this.typeSlug();
    return [
      { label: 'Settings',     routerLink: '/settings' },
      { label: 'SEO Settings', routerLink: '/settings/seo' },
      { label: `Settings for ${typeLabel}` },
    ];
  });

  /** Title-tag and meta-description as they'll render on the
   *  storefront — per-page override OR per-type default template.
   *  Used as the secondary text under the column when the user
   *  hasn't overridden the row. */
  resolvedTitle = (row: SeoPageRow): string => {
    if (row.titleTag) return row.titleTag;
    const tpl = this.seo.pageType(this.typeSlug()).defaults.basics.titleTagTemplate;
    const siteName = this.companies.currentCompanyName() || 'My Store';
    return tpl.replace('{{ pageName }}', row.pageName).replace('{{ siteName }}', siteName);
  };

  /** Visible "indexable" state combines the row's own flag with the
   *  site-wide kill switch — when site indexing is off the column
   *  badge shows everything as disabled regardless of per-row. */
  resolvedIndexable = (row: SeoPageRow): boolean => {
    const site = this.seo.document()?.sitePreferences.allowIndexing ?? true;
    return site && row.indexable;
  };

  /** Reactive shortcut to the site-wide indexing flag — drives the
   *  warning banner shown above the table when indexing is off. */
  seoIndexingAllowed = computed(
    () => this.seo.document()?.sitePreferences.allowIndexing ?? true,
  );

  constructor() {
    withTranslations('settings/seo');
  }

  async ngOnInit(): Promise<void> {
    // Debounce search input — 250ms feels snappy without hammering
    // the backend on every keystroke.
    this.searchInput$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        void this.loadPages();
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      const slug = p.get('type') ?? '';
      this.typeSlug.set(slug);
      this.activeTab.set('edit-by-page');
      void this.refresh();
    });
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([
        this.seo.document() ? Promise.resolve() : this.seo.load(),
        this.loadPages(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadPages(): Promise<void> {
    // Polymorphic listing — backend joins the owning resource table
    // (Products / Pages / Posts / …) so each row carries name + URL
    // ready to render. List pages of the form `items-list`,
    // `blog-categories`, … resolve to `ownerType: 'pageType'` with
    // the slug as the synthetic ownerId.
    const { ownerType } = ownerTypeFromSlug(this.typeSlug());
    const { list, count } = await this.overrides.list({
      ownerType,
      page:       this.page(),
      limit:      this.pageSize(),
      searchTerm: this.searchQuery(),
    });
    this.pages.set(list.map(rowFromOverride));
    this.count.set(count);
  }

  setTab(tab: Tab): void { this.activeTab.set(tab); }

  onSearchInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.searchQuery.set(v);
    this.searchInput$.next(v);
  }

  /** Open the per-page side-panel editor — modal slides in from the
   *  right with three tabs (Basics / Advanced / Social share). The
   *  modal returns the patched row, which we upsert into the SEO
   *  document and re-emit on the local list. */
  async editRow(row: SeoPageRow): Promise<void> {
    const ref = this.modal.open<SeoPageEditorModalComponent, SeoPageEditorData, SeoPageRow>(
      SeoPageEditorModalComponent,
      {
        drawer:      true,
        // Wide enough for the Social-share two-column layout (form
        // + live preview side-by-side). Falls back to a single
        // column under 720px via the modal's own media query.
        drawerWidth: '760px',
        data: {
          row,
          typeSlug: this.typeSlug(),
        },
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    // Persist the override against the polymorphic `SeoOverrides`
    // endpoint — the per-row id is the owning resource's id (or the
    // page-type slug for collection pages).
    const { ownerType } = ownerTypeFromSlug(this.typeSlug());
    const patch: SeoOverridePatch = {
      focusKeyword:    result.focusKeyword,
      urlSlug:         (result.pageUrl ?? '').replace(/^\//, ''),
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
    // Optimistic — patch the local row before the round-trip so
    // the table reflects the new state immediately.
    this.pages.update(list => list.map(p => (p.id === result.id ? result : p)));
    try {
      await this.overrides.save(ownerType, result.id, patch);
      this.toast.success('COMMON.SAVED_OK');
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Decode one `SeoOverrideListRow` from the backend into the
 *  `SeoPageRow` shape the table + editor modal already render
 *  against. The owner's name / URL travel as `ownerName` /
 *  `ownerUrl` columns; we re-project them as `pageName` / `pageUrl`
 *  so the existing template doesn't need to know the resource type. */
function rowFromOverride(o: SeoOverrideListRow): SeoPageRow {
  const slug = (o.urlSlug ?? '').trim();
  return {
    id:              o.ownerId,
    pageName:        o.ownerName || 'Untitled',
    pageUrl:         slug ? `/${slug}` : (o.ownerUrl || '/'),
    focusKeyword:    o.focusKeyword    ?? '',
    titleTag:        o.titleTag        ?? '',
    metaDescription: o.metaDescription ?? '',
    indexable:       o.indexable ?? true,
    ogTitle:         o.ogTitle,
    ogDescription:   o.ogDescription,
    ogImage:         o.ogImage,
    xTitle:          o.xTitle,
    xDescription:    o.xDescription,
    xImage:          o.xImage,
    robots:          o.robots as any,
    structuredData:  o.structuredData,
    additionalTags:  o.additionalTags,
    hreflangTags:    o.hreflangTags,
  };
}
