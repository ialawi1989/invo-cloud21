import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { PublicBlogApiService } from '../services/public-blog-api.service';
import { BlogSettingsService } from '../services/blog-settings.service';
import { BlogSeoService } from '../services/blog-seo.service';
import { TagPostsResult } from '../models/blog.types';

import { BlogHeaderComponent } from '../components/blog-header.component';
import { LayoutRendererComponent } from '../components/layouts/layout-renderer.component';
import { PaginationComponent } from '../components/pagination.component';
import { LoadingSkeletonComponent, ErrorBannerComponent } from '../components/ui-bits.component';

import { environment } from '../../../../environments/environment';
import { t } from '../i18n/i18n';

/**
 * Tag / hashtag feed. Thin-content guard: if fewer than 3 posts use
 * this tag, we ask crawlers not to index the page (matches the
 * spec). Users still see the full feed.
 */
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
        <a class="back" [routerLink]="blogLink()">← {{ t(lang(), 'back_to_blog') }}</a>

        @if (loading() && !result()) {
          <app-loading-skeleton [count]="display().postsPerPage"></app-loading-skeleton>
        } @else if (notFound()) {
          <h1>{{ t(lang(), '404_title') }}</h1>
        } @else if (error()) {
          <app-error-banner [lang]="lang()" [showRetry]="true" (retry)="load()"></app-error-banner>
        } @else {
          @if (result(); as r) {
          <header class="head">
            <h1>{{ t(lang(), 'posts_tagged', { tag: r.tag.name }) }}</h1>
            @if (r.tag.description) { <p>{{ r.tag.description }}</p> }
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
    .head { padding: 24px 0 32px; }
    h1 { margin: 0; font-size: 32px; }
    p { margin: 6px 0 0; opacity: .7; max-width: 700px; }
  `],
})
export class TagPage implements OnInit {
  private api = inject(PublicBlogApiService);
  private settingsSvc = inject(BlogSettingsService);
  private seo = inject(BlogSeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  lang = signal('en');
  slug = signal('');
  page = signal(1);
  result = signal<TagPostsResult | null>(null);
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

  /** Blog router commands, lang-less for the default language. */
  blogLink = (...segments: (string | number)[]) => this.settingsSvc.blogLink(this.lang(), ...segments);

  async ngOnInit(): Promise<void> {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(([p, q]) => ({ lang: p.get('lang') || q.get('lang') || 'en', slug: p.get('tagSlug') ?? '' })),
      distinctUntilChanged((a, b) => a.lang === b.lang && a.slug === b.slug),
    ).subscribe(({ lang, slug }) => {
      this.lang.set(lang);
      this.slug.set(slug);
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
      const r = await this.api.getTagPosts(this.slug(), this.lang(), {
        page: this.page(), limit: this.display().postsPerPage,
      });
      this.result.set(r);
      this.applySeo(r);
    } catch (e: any) {
      if (e?.status === 404) this.notFound.set(true);
      else this.error.set(e?.message ?? 'Failed to load tag');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(p: number): void {
    this.router.navigate([], { queryParams: { page: p > 1 ? p : null }, queryParamsHandling: 'merge' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applySeo(r: TagPostsResult): void {
    const lang = this.lang();
    const thin = (r.pagination.total ?? r.data.length) < 3;
    this.seo.apply({
      title: `Posts tagged #${r.tag.name} | ${this.t(lang, 'blog')}`,
      description: r.tag.description || `Posts tagged with ${r.tag.name}`,
      url: this.settingsSvc.blogUrl(lang, 'tag', this.slug()),
      noindex: thin,
      locale: lang,
      hreflang: this.supportedLangs().map(l => ({ lang: l, url: this.settingsSvc.blogUrl(l, 'tag', this.slug()) })),
      siteName: this.siteName(),
    });
  }
}
