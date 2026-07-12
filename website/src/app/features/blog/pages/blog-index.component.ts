import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { PublicBlogApiService } from '../services/public-blog-api.service';
import { BlogSettingsService } from '../services/blog-settings.service';
import { BlogSeoService } from '../services/blog-seo.service';
import { BlogTaxonomy, PostListResult } from '../models/blog.types';

import { BlogHeaderComponent } from '../components/blog-header.component';
import { CategoryMenuStripComponent } from '../components/category-menu-strip.component';
import { LayoutRendererComponent } from '../components/layouts/layout-renderer.component';
import { PaginationComponent } from '../components/pagination.component';
import { LoadingSkeletonComponent, EmptyStateComponent, ErrorBannerComponent } from '../components/ui-bits.component';
import { environment } from '../../../../environments/environment';
import { t } from '../i18n/i18n';

/**
 * Blog feed root. Wires:
 *   - settings (one-shot per session)
 *   - posts list (re-fetched on lang / page change)
 *   - taxonomies (categories) for the menu strip
 *
 * All three fire in parallel on mount. We swap to skeletons during
 * the initial fetch; subsequent paginations show the previous list
 * grayed out (no jarring full-blank flash).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    BlogHeaderComponent,
    CategoryMenuStripComponent,
    LayoutRendererComponent,
    PaginationComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
  ],
  template: `
    @if (settingsLoaded()) {
      <app-blog-header
        [lang]="lang()"
        [siteName]="siteName()"
        [languages]="supportedLangs()">
      </app-blog-header>

      <div class="container">
        @if (heroImage()) {
          <div class="hero" [style.background-image]="'url(' + heroImage() + ')'">
            <div class="hero-overlay">
              <h1>{{ t(lang(), 'blog') }}</h1>
              @if (tagline()) { <p>{{ tagline() }}</p> }
            </div>
          </div>
        } @else {
          <header class="page-head">
            <h1>{{ t(lang(), 'blog') }}</h1>
            @if (tagline()) { <p>{{ tagline() }}</p> }
          </header>
        }

        @if (mobile().showCategoryMenu || !isMobile) {
          <app-category-menu-strip
            [lang]="lang()"
            [categories]="categories()">
          </app-category-menu-strip>
        }

        @if (loading() && !posts().length) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else if (posts().length === 0) {
          <app-empty-state [title]="t(lang(), 'no_posts')"></app-empty-state>
        } @else {
          <app-layout-renderer
            [posts]="posts()"
            [layout]="display().postsPerPage > 0 ? layouts.feed : 'grid'"
            [lang]="lang()"
            [display]="display()"
            [mobile]="mobile()">
          </app-layout-renderer>

          <app-pagination
            [page]="page()"
            [pageCount]="pageCount()"
            [lang]="lang()"
            (pageChange)="goToPage($event)">
          </app-pagination>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--body-bg, #fff); color: var(--body-text, #111); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .page-head { padding: 40px 0 16px; }
    .page-head h1 { margin: 0 0 8px; font-size: 36px; }
    .page-head p { margin: 0; opacity: .7; }
    .hero {
      aspect-ratio: 21 / 7;
      border-radius: 16px;
      background-size: cover;
      background-position: center;
      position: relative;
      margin-bottom: 24px;
    }
    .hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,.1));
      color: #fff;
      display: flex; flex-direction: column; justify-content: flex-end;
      padding: 32px;
      border-radius: 16px;
    }
    .hero-overlay h1 { margin: 0; font-size: 40px; }
    .hero-overlay p { margin: 6px 0 0; opacity: .9; }
  `],
})
export class BlogIndexPage implements OnInit {
  private api = inject(PublicBlogApiService);
  private settingsSvc = inject(BlogSettingsService);
  private seo = inject(BlogSeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  lang = signal('en');
  page = signal(1);
  settingsLoaded = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);
  posts = signal<PostListResult['data']>([]);
  pageCount = signal(1);
  categories = signal<BlogTaxonomy[]>([]);

  layouts = { feed: 'grid' as const };
  isMobile = false;

  display    = computed(() => this.settingsSvc.settings().display);
  mobile     = computed(() => this.settingsSvc.settings().mobile);
  supportedLangs = computed(() => this.settingsSvc.settings().languages.supported);
  siteName   = computed(() => this.settingsSvc.settings().siteName ?? environment.siteName);
  tagline    = computed(() => this.settingsSvc.settings().tagline);
  heroImage  = computed(() => this.settingsSvc.settings().heroImage);

  t = t;

  async ngOnInit(): Promise<void> {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(([p, q]) => p.get('lang') || q.get('lang') || 'en'),
      distinctUntilChanged(),
    ).subscribe(lang => { this.lang.set(lang); this.bootstrap(); });
    this.route.queryParamMap.subscribe(q => {
      const newPage = Number(q.get('page') ?? '1') || 1;
      if (newPage !== this.page()) { this.page.set(newPage); this.load(); }
    });
  }

  private async bootstrap(): Promise<void> {
    try {
      const s = await this.settingsSvc.load();
      this.layouts.feed = s.layouts.feed as any;
      this.settingsLoaded.set(true);
      this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
      this.applySeo();
      await Promise.all([this.load(), this.loadCategories()]);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load blog settings');
      this.settingsLoaded.set(true);
      this.loading.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.listPublicPosts({
        language: this.lang(),
        page: this.page(),
        limit: this.display().postsPerPage,
        sort: 'date',
        order: 'desc',
      });
      this.posts.set(res.data);
      this.pageCount.set(res.pagination?.totalPages ?? 1);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load posts');
      this.posts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.api.listPublicTaxonomies({
        language: this.lang(),
        taxonomyType: 'category',
      }));
    } catch { this.categories.set([]); }
  }

  goToPage(p: number): void {
    this.router.navigate([], {
      queryParams: { page: p > 1 ? p : null },
      queryParamsHandling: 'merge',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applySeo(): void {
    const origin = this.settingsSvc.originUrl();
    const lang = this.lang();
    const alts = this.supportedLangs().map(l => ({ lang: l, url: `${origin}/${l}/blog` }));
    this.seo.apply({
      title: `${this.t(lang, 'blog')} | ${this.siteName()}`,
      description: this.tagline() || `${this.siteName()} — ${this.t(lang, 'blog')}`,
      url: `${origin}/${lang}/blog`,
      type: 'website',
      locale: lang,
      hreflang: alts,
      rss: this.api.rssUrl(lang),
      siteName: this.siteName(),
    });
  }
}
