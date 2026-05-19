import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PublicBlogApiService } from '../services/public-blog-api.service';
import { BlogSettingsService } from '../services/blog-settings.service';
import { BlogSeoService } from '../services/blog-seo.service';
import { CategoryPostsResult } from '../models/blog.types';

import { BlogHeaderComponent } from '../components/blog-header.component';
import { LayoutRendererComponent } from '../components/layouts/layout-renderer.component';
import { PaginationComponent } from '../components/pagination.component';
import { LoadingSkeletonComponent, ErrorBannerComponent } from '../components/ui-bits.component';
import { environment } from '../../../../environments/environment';
import { t } from '../i18n/i18n';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    BlogHeaderComponent, LayoutRendererComponent, PaginationComponent,
    LoadingSkeletonComponent, ErrorBannerComponent,
  ],
  template: `
    @if (settingsLoaded()) {
      <app-blog-header [lang]="lang()" [siteName]="siteName()" [languages]="supportedLangs()"></app-blog-header>

      <div class="container">
        <a class="back" [routerLink]="['/', lang(), 'blog']">← {{ t(lang(), 'back_to_blog') }}</a>

        @if (loading() && !result()) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (notFound()) {
          <h1>{{ t(lang(), '404_title') }}</h1>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (result(); as r) {
          <header class="banner"
                  [style.background-image]="r.category.image ? 'url(' + r.category.image + ')' : null">
            <div class="banner-inner">
              <h1>{{ r.category.name }}</h1>
              @if (r.category.description) { <p>{{ r.category.description }}</p> }
            </div>
          </header>

          <app-layout-renderer
            [posts]="r.data"
            [layout]="categoryLayout()"
            [lang]="lang()"
            [display]="display()"
            [mobile]="mobile()">
          </app-layout-renderer>

          <app-pagination
            [page]="page()"
            [pageCount]="r.pagination.totalPages"
            [lang]="lang()"
            (pageChange)="goToPage($event)">
          </app-pagination>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--body-bg, #fff); color: var(--body-text, #111); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .back { display: inline-block; padding: 12px 0; color: inherit; text-decoration: none; opacity: .7; font-size: 14px; }
    .back:hover { opacity: 1; }
    .banner {
      position: relative;
      border-radius: 16px;
      background-size: cover; background-position: center;
      background-color: rgba(99,102,241,.1);
      padding: 48px 32px;
      margin-bottom: 32px;
      color: #fff;
    }
    .banner-inner { position: relative; z-index: 1; }
    .banner::before {
      content: ''; position: absolute; inset: 0; border-radius: 16px;
      background: linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,.2));
    }
    .banner:not([style*='background-image']) { color: inherit; }
    .banner:not([style*='background-image'])::before { display: none; }
    h1 { margin: 0; font-size: 36px; }
    p { margin: 8px 0 0; opacity: .9; max-width: 700px; }
  `],
})
export class CategoryPage implements OnInit {
  private api = inject(PublicBlogApiService);
  private settingsSvc = inject(BlogSettingsService);
  private seo = inject(BlogSeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  lang = signal('en');
  slug = signal('');
  page = signal(1);
  result = signal<CategoryPostsResult | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  notFound = signal(false);
  settingsLoaded = signal(false);

  display = computed(() => this.settingsSvc.settings().display);
  mobile  = computed(() => this.settingsSvc.settings().mobile);
  categoryLayout = computed(() => this.settingsSvc.settings().layouts.categoryFeed);
  supportedLangs = computed(() => this.settingsSvc.settings().languages.supported);
  siteName       = computed(() => this.settingsSvc.settings().siteName ?? environment.siteName);

  t = t;

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(p => {
      this.lang.set(p.get('lang') ?? 'en');
      this.slug.set(p.get('categorySlug') ?? '');
      this.bootstrap();
    });
    this.route.queryParamMap.subscribe(q => {
      const p = Number(q.get('page') ?? '1') || 1;
      if (p !== this.page()) { this.page.set(p); this.load(); }
    });
  }

  private async bootstrap(): Promise<void> {
    try {
      const s = await this.settingsSvc.load();
      this.settingsLoaded.set(true);
      this.seo.setLangAndDir(this.lang(), s.languages.rtlLanguages.includes(this.lang()));
      await this.load();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load settings');
      this.settingsLoaded.set(true);
      this.loading.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    try {
      const r = await this.api.getCategoryPosts(this.slug(), this.lang(), {
        page: this.page(),
        limit: this.display().postsPerPage,
      });
      this.result.set(r);
      this.applySeo(r);
    } catch (e: any) {
      if (e?.status === 404) this.notFound.set(true);
      else this.error.set(e?.message ?? 'Failed to load category');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(p: number): void {
    this.router.navigate([], { queryParams: { page: p > 1 ? p : null }, queryParamsHandling: 'merge' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applySeo(r: CategoryPostsResult): void {
    const origin = environment.siteOrigin || '';
    const lang = this.lang();
    const alts = this.supportedLangs().map(l => ({
      lang: l,
      url: `${origin}/${l}/blog/category/${this.slug()}`,
    }));
    this.seo.apply({
      title: `${r.category.seoTitle || r.category.name} | ${this.t(lang, 'blog')} | ${this.siteName()}`,
      description: r.category.seoDescription || r.category.description || `Posts in ${r.category.name}`,
      url: `${origin}/${lang}/blog/category/${this.slug()}`,
      type: 'website',
      locale: lang,
      hreflang: alts,
      rss: this.api.rssUrl(lang),
      siteName: this.siteName(),
    });
  }
}
